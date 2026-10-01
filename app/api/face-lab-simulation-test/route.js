import { NextResponse } from "next/server";
import {
  isFaceLabObservationAnalysis
} from "@/lib/face-lab-analysis-bundle";
import {
  buildFaceLabV2Canonical
} from "@/lib/face-lab-v2/canonical-composer";
import {
  buildFaceLabRenderSpec
} from "@/lib/face-lab-v2/render-adapter";
import {
  normalizeFaceLabV2PersistencePayload
} from "@/lib/face-lab-v2/survey-contract";
import {
  applyAnalysisGuardCookies,
  completeAnalysisRequestGuard,
  createAnalysisGuardResponse,
  failAnalysisRequestGuard,
  getAnalysisRequestGuardSecret,
  guardAnalysisRequest
} from "@/lib/security/analysis-request-guard";
import {
  getUploadFingerprintDescriptor
} from "@/lib/security/analysis-request-guard-core";
import {
  createNoStoreHeaders,
  writeSafeLog
} from "@/lib/security/error-redaction";
import {
  verifyFaceLabSimulationAuthority
} from "@/lib/server/face-lab-simulation-authority";
import {
  generateFaceLabSimulation
} from "@/lib/server/face-lab-simulation-service";
import {
  canonicalizeImageFile
} from "@/lib/server/image-upload-boundary";
import {
  resolveOpenAiApiKey
} from "@/lib/openai-env-diagnostics";
import {
  validateImageRequestContentLength,
  validateImageUpload
} from "@/lib/upload-validation";

const MAX_AUTHORITY_TOKEN_CHARS = 2048;
const MAX_ANALYSIS_JSON_CHARS = 256 * 1024;
const MAX_STATE_JSON_CHARS = 128 * 1024;
const COMMITTED_ROUTE_STATES = new Set([
  "user_selected",
  "single_route_auto"
]);

function json(body, init = {}) {
  return NextResponse.json(body, {
    ...init,
    headers:
      createNoStoreHeaders(
        init.headers
      )
  });
}

function parseJsonField(value, maxChars) {
  if (
    typeof value !== "string" ||
    !value ||
    value.length > maxChars
  ) {
    return null;
  }

  try {
    const parsed = JSON.parse(value);
    return parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed)
      ? parsed
      : null;
  } catch {
    return null;
  }
}

async function completeGuardedResponse(
  response,
  guardResult,
  resultReference = null
) {
  const completion =
    await completeAnalysisRequestGuard(
      guardResult,
      resultReference
    );

  if (!completion.ok) {
    writeSafeLog("warn", {
      event:
        "face_lab_simulation_guard_complete_failed",
      category: "internal_error",
      operation:
        "face_lab_simulation_test",
      dependency: "application",
      retryable: false
    });
  }

  return applyAnalysisGuardCookies(
    response,
    guardResult
  );
}

async function failGuardedResponse(
  response,
  guardResult
) {
  const failure =
    await failAnalysisRequestGuard(
      guardResult
    );

  if (!failure.ok) {
    writeSafeLog("warn", {
      event:
        "face_lab_simulation_guard_fail_failed",
      category: "internal_error",
      operation:
        "face_lab_simulation_test",
      dependency: "application",
      retryable: false
    });
  }

  return applyAnalysisGuardCookies(
    response,
    guardResult
  );
}

function simulationImageResponse(
  simulation
) {
  return new NextResponse(
    simulation.imageBytes,
    {
      status: 200,
      headers:
        createNoStoreHeaders({
          "Content-Type":
            simulation.mimeType ||
            "image/png",
          "Content-Length":
            String(
              simulation.imageBytes.length
            ),
          "X-Face-Lab-Simulation-Version":
            simulation.simulationVersion,
          "X-Face-Lab-Route-Id":
            simulation.routeId,
          "X-Face-Lab-Look-Id":
            simulation.lookId,
          "X-Face-Lab-Fidelity":
            simulation.fidelity?.status ||
            "not_evaluated"
        })
    }
  );
}

export async function POST(request) {
  let analysisGuard = null;

  try {
    const contentLengthValidation =
      validateImageRequestContentLength(
        request
      );

    if (!contentLengthValidation.ok) {
      return json(
        {
          success: false,
          error:
            contentLengthValidation.code ===
            "too_large"
              ? "request_too_large"
              : "invalid_request"
        },
        { status: 400 }
      );
    }

    const formData =
      await request.formData();
    const image =
      formData.get("image");
    const locale =
      formData.get("locale") === "en"
        ? "en"
        : "ko";
    const authorityToken =
      formData.get(
        "simulationAuthority"
      );
    const analysis =
      parseJsonField(
        formData.get("analysis"),
        MAX_ANALYSIS_JSON_CHARS
      );
    const rawState =
      parseJsonField(
        formData.get("faceLabV2State"),
        MAX_STATE_JSON_CHARS
      );

    if (
      !image ||
      typeof image.arrayBuffer !==
        "function" ||
      typeof authorityToken !==
        "string" ||
      !authorityToken ||
      authorityToken.length >
        MAX_AUTHORITY_TOKEN_CHARS ||
      !isFaceLabObservationAnalysis(
        analysis
      ) ||
      !rawState
    ) {
      return json(
        {
          success: false,
          error: "invalid_request"
        },
        { status: 400 }
      );
    }

    const imageValidation =
      validateImageUpload(image);

    if (!imageValidation.ok) {
      return json(
        {
          success: false,
          error:
            imageValidation.code ===
            "too_large"
              ? "image_too_large"
              : "invalid_image"
        },
        { status: 400 }
      );
    }

    const imageBuffer =
      Buffer.from(
        await image.arrayBuffer()
      );
    const canonicalImage =
      await canonicalizeImageFile(
        image,
        imageBuffer
      );

    if (!canonicalImage.ok) {
      return json(
        {
          success: false,
          error: "invalid_image"
        },
        { status: 400 }
      );
    }

    const guardSecret =
      getAnalysisRequestGuardSecret();

    if (!guardSecret) {
      return json(
        {
          success: false,
          error:
            "simulation_unavailable"
        },
        { status: 503 }
      );
    }

    const authority =
      verifyFaceLabSimulationAuthority({
        token: authorityToken,
        secret: guardSecret,
        imageBuffer:
          canonicalImage.bytes,
        analysis,
        locale
      });

    if (!authority.ok) {
      return json(
        {
          success: false,
          error: authority.code
        },
        {
          status:
            authority.code ===
            "simulation_authority_expired"
              ? 401
              : 403
        }
      );
    }

    const normalized =
      normalizeFaceLabV2PersistencePayload(
        rawState
      );

    analysisGuard =
      await guardAnalysisRequest({
        request,
        endpoint:
          "face-lab-simulation-test",
        fingerprintInput: {
          locale,
          image:
            getUploadFingerprintDescriptor(
              image
            ),
          analysisSha256:
            authority.analysisSha256,
          imageSha256:
            authority.imageSha256,
          faceLabV2State: normalized
        }
      });

    if (!analysisGuard.ok) {
      return createAnalysisGuardResponse(
        analysisGuard,
        locale
      );
    }

    const canonicalV2 =
      buildFaceLabV2Canonical({
        analysis,
        surveyAnswers:
          normalized.surveyAnswers,
        targetFinderResult:
          normalized.targetFinderResult,
        selectedRouteId:
          normalized.selectedRouteId,
        locale
      });

    if (
      canonicalV2?.targetStyle
        ?.status !== "available"
    ) {
      return failGuardedResponse(
        json(
          {
            success: false,
            error:
              "target_style_not_confirmed"
          },
          { status: 409 }
        ),
        analysisGuard
      );
    }

    if (
      !COMMITTED_ROUTE_STATES.has(
        canonicalV2?.routes
          ?.selectionState
      ) ||
      canonicalV2
        ?.appearanceHandoff
        ?.status !== "available"
    ) {
      return failGuardedResponse(
        json(
          {
            success: false,
            error:
              "route_not_committed"
          },
          { status: 409 }
        ),
        analysisGuard
      );
    }

    const canonicalLook =
      canonicalV2?.looks?.status ===
        "available" &&
      Array.isArray(
        canonicalV2.looks.looks
      )
        ? canonicalV2.looks.looks.find(
            (look) =>
              look?.routeId ===
              canonicalV2
                .appearanceHandoff
                .routeId
          )
        : null;

    if (!canonicalLook) {
      return failGuardedResponse(
        json(
          {
            success: false,
            error:
              "canonical_look_unavailable"
          },
          { status: 409 }
        ),
        analysisGuard
      );
    }

    const renderSpec =
      buildFaceLabRenderSpec({
        appearanceHandoff:
          canonicalV2
            .appearanceHandoff,
        look: canonicalLook,
        bindingsBySlot: {}
      });

    if (
      renderSpec?.status !==
      "ready"
    ) {
      return failGuardedResponse(
        json(
          {
            success: false,
            error:
              "render_spec_unavailable"
          },
          { status: 409 }
        ),
        analysisGuard
      );
    }

    const { apiKey } =
      resolveOpenAiApiKey();

    if (!apiKey) {
      return failGuardedResponse(
        json(
          {
            success: false,
            error:
              "simulation_unavailable"
          },
          { status: 503 }
        ),
        analysisGuard
      );
    }

    let simulation = null;

    try {
      simulation =
        await generateFaceLabSimulation({
          apiKey,
          imageBuffer:
            canonicalImage.bytes,
          mimeType:
            canonicalImage.mimeType,
          renderSpec
        });
    } catch {
      return failGuardedResponse(
        json(
          {
            success: false,
            error:
              "simulation_failed"
          },
          { status: 503 }
        ),
        analysisGuard
      );
    }

    return completeGuardedResponse(
      simulationImageResponse(
        simulation
      ),
      analysisGuard,
      {
        simulationVersion:
          simulation
            .simulationVersion,
        routeId:
          simulation.routeId,
        lookId:
          simulation.lookId,
        fidelityStatus:
          simulation.fidelity
            ?.status ||
          "not_evaluated"
      }
    );
  } catch {
    if (analysisGuard?.ok) {
      await failAnalysisRequestGuard(
        analysisGuard
      );
    }

    writeSafeLog("error", {
      event:
        "face_lab_simulation_test_failed",
      category: "internal_error",
      operation:
        "face_lab_simulation_test",
      dependency: "application",
      retryable: false
    });

    return applyAnalysisGuardCookies(
      json(
        {
          success: false,
          error: "simulation_failed"
        },
        { status: 500 }
      ),
      analysisGuard
    );
  }
}
