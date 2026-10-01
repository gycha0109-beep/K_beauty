import { NextResponse } from "next/server";
import {
  isFaceLabObservationAnalysis
} from "@/lib/face-lab-analysis-bundle";
import {
  FACE_LAB_AI_SIMULATION_VERSION
} from "@/lib/face-lab-v2/simulation-service-core";
import {
  FACE_LAB_SIMULATION_INSTRUCTION_VERSION
} from "@/lib/face-lab-v2/simulation-instructions";
import {
  FACE_LAB_SIMULATION_EDIT_SCOPE_DIMENSIONS,
  FACE_LAB_SIMULATION_IDENTITY_DIMENSIONS,
  FACE_LAB_SIMULATION_IDENTITY_REVIEW_VALUES,
  FACE_LAB_SIMULATION_SCOPE_REVIEW_VALUES,
  buildFaceLabSimulationIdentityScopeReview
} from "@/lib/face-lab-v2/evaluation/simulation-identity-scope-review";
import {
  FACE_LAB_SIMULATION_COLOR_REVIEW_VALUES,
  FACE_LAB_SIMULATION_ROUTE_REVIEW_VALUES,
  buildFaceLabSimulationRouteColorReview,
  buildFaceLabSimulationRouteColorReviewTemplate
} from "@/lib/face-lab-v2/evaluation/simulation-route-color-review";
import {
  reconstructFaceLabSimulationRenderAuthority
} from "@/lib/face-lab-v2/simulation-render-authority";
import {
  verifyFaceLabSimulationReviewTicket
} from "@/lib/face-lab-v2/simulation-review-ticket-core";
import {
  applyAnalysisGuardCookies,
  createAnalysisGuardResponse,
  failAnalysisRequestGuard,
  getAnalysisRequestGuardSecret,
  guardAnalysisRequest
} from "@/lib/security/analysis-request-guard";
import {
  createNoStoreHeaders,
  writeSafeLog
} from "@/lib/security/error-redaction";

const MAX_REQUEST_BYTES = 512 * 1024;
const MAX_REVIEW_TICKET_CHARS = 4096;

function json(body, init = {}) {
  return NextResponse.json(body, {
    ...init,
    headers:
      createNoStoreHeaders(
        init.headers
      )
  });
}

function isObject(value) {
  return Boolean(value) &&
    typeof value === "object" &&
    !Array.isArray(value);
}

function summarizeReview({
  identityScopeReview,
  routeColorReview
}) {
  const checks = {
    identity:
      identityScopeReview
        .checks
        .identity_preservation
        .status,
    editScope:
      identityScopeReview
        .checks
        .edit_scope
        .status,
    route:
      routeColorReview
        .checks
        .route_adherence
        .status,
    color:
      routeColorReview
        .checks
        .color_fidelity
        .status
  };
  const values =
    Object.values(checks);

  let overall = "pass";

  if (
    checks.identity === "fail" ||
    checks.editScope === "fail"
  ) {
    overall = "fail";
  } else if (
    values.includes(
      "not_evaluated"
    )
  ) {
    overall =
      "not_evaluated";
  } else if (
    values.includes("review") ||
    values.includes("fail")
  ) {
    overall = "review";
  }

  return {
    overall,
    ...checks
  };
}

export async function POST(request) {
  let analysisGuard = null;

  try {
    const declaredLength =
      Number(
        request.headers.get(
          "content-length"
        ) || 0
      );

    if (
      Number.isFinite(
        declaredLength
      ) &&
      declaredLength >
        MAX_REQUEST_BYTES
    ) {
      return json(
        {
          success: false,
          error:
            "request_too_large"
        },
        { status: 413 }
      );
    }

    let body = null;

    try {
      body =
        await request.json();
    } catch {
      return json(
        {
          success: false,
          error:
            "invalid_request"
        },
        { status: 400 }
      );
    }

    if (!isObject(body)) {
      return json(
        {
          success: false,
          error:
            "invalid_request"
        },
        { status: 400 }
      );
    }

    const mode =
      body.mode === "submit"
        ? "submit"
        : body.mode ===
            "template"
          ? "template"
          : null;
    const locale =
      body.locale === "en"
        ? "en"
        : "ko";
    const reviewTicket =
      typeof body.reviewTicket ===
        "string"
        ? body.reviewTicket
        : null;
    const analysis =
      body.analysis;
    const rawState =
      body.faceLabV2State;

    if (
      !mode ||
      !reviewTicket ||
      reviewTicket.length >
        MAX_REVIEW_TICKET_CHARS ||
      !isFaceLabObservationAnalysis(
        analysis
      ) ||
      !isObject(rawState)
    ) {
      return json(
        {
          success: false,
          error:
            "invalid_request"
        },
        { status: 400 }
      );
    }

    const reconstructed =
      reconstructFaceLabSimulationRenderAuthority({
        analysis,
        rawState,
        locale
      });

    if (
      reconstructed.status !==
      "ready"
    ) {
      return json(
        {
          success: false,
          error:
            reconstructed.reason
        },
        { status: 409 }
      );
    }

    const guardSecret =
      getAnalysisRequestGuardSecret();

    if (!guardSecret) {
      return json(
        {
          success: false,
          error:
            "simulation_review_unavailable"
        },
        { status: 503 }
      );
    }

    const ticket =
      verifyFaceLabSimulationReviewTicket({
        token:
          reviewTicket,
        secret:
          guardSecret,
        analysis,
        faceLabV2State:
          reconstructed
            .normalizedState,
        locale,
        renderSpecSha256:
          reconstructed
            .renderSpecSha256,
        routeId:
          reconstructed
            .renderSpec.routeId,
        lookId:
          reconstructed
            .renderSpec.lookId,
        simulationVersion:
          FACE_LAB_AI_SIMULATION_VERSION,
        instructionVersion:
          FACE_LAB_SIMULATION_INSTRUCTION_VERSION
      });

    if (!ticket.ok) {
      return json(
        {
          success: false,
          error:
            ticket.code
        },
        {
          status:
            ticket.code ===
            "simulation_review_ticket_expired"
              ? 401
              : 403
        }
      );
    }

    const routeColorTemplate =
      buildFaceLabSimulationRouteColorReviewTemplate({
        caseId:
          ticket.caseId,
        analysis,
        rawState:
          reconstructed
            .normalizedState,
        locale
      });

    if (
      routeColorTemplate.status !==
      "ready"
    ) {
      return json(
        {
          success: false,
          error:
            routeColorTemplate.reason
        },
        { status: 409 }
      );
    }

    let responseBody = null;
    let fingerprintReview = null;

    if (mode === "template") {
      responseBody = {
        success: true,
        mode,
        caseId:
          ticket.caseId,
        expiresAt:
          ticket.expiresAt,
        identity: {
          dimensions: [
            ...FACE_LAB_SIMULATION_IDENTITY_DIMENSIONS
          ],
          values: [
            ...FACE_LAB_SIMULATION_IDENTITY_REVIEW_VALUES
          ]
        },
        editScope: {
          dimensions: [
            ...FACE_LAB_SIMULATION_EDIT_SCOPE_DIMENSIONS
          ],
          values: [
            ...FACE_LAB_SIMULATION_SCOPE_REVIEW_VALUES
          ]
        },
        route: {
          values: [
            ...FACE_LAB_SIMULATION_ROUTE_REVIEW_VALUES
          ],
          targets:
            routeColorTemplate
              .routeTargets
        },
        color: {
          values: [
            ...FACE_LAB_SIMULATION_COLOR_REVIEW_VALUES
          ],
          targets:
            routeColorTemplate
              .colorTargets
        },
        trace: {
          routeId:
            ticket.routeId,
          lookId:
            ticket.lookId,
          renderSpecSha256:
            ticket.renderSpecSha256,
          providerConfigVersion:
            ticket.providerConfigVersion,
          providerConfigFingerprint:
            ticket.providerConfigFingerprint
        }
      };
    } else {
      const identityScopeReview =
        buildFaceLabSimulationIdentityScopeReview({
          caseId:
            ticket.caseId,
          reviewerRef:
            body.reviewerRef,
          identity:
            body.identity,
          editScope:
            body.editScope
        });

      if (
        identityScopeReview.status !==
        "ready"
      ) {
        return json(
          {
            success: false,
            error:
              identityScopeReview
                .reason
          },
          { status: 400 }
        );
      }

      const routeColorReview =
        buildFaceLabSimulationRouteColorReview({
          caseId:
            ticket.caseId,
          reviewerRef:
            body.reviewerRef,
          analysis,
          rawState:
            reconstructed
              .normalizedState,
          locale,
          renderSpecSha256:
            ticket.renderSpecSha256,
          routeOperations:
            body.routeOperations,
          colorTargets:
            body.colorTargets
        });

      if (
        routeColorReview.status !==
        "ready"
      ) {
        return json(
          {
            success: false,
            error:
              routeColorReview
                .reason
          },
          { status: 400 }
        );
      }

      responseBody = {
        success: true,
        mode,
        caseId:
          ticket.caseId,
        identityScopeReview,
        routeColorReview,
        trace: {
          routeId:
            ticket.routeId,
          lookId:
            ticket.lookId,
          renderSpecSha256:
            ticket.renderSpecSha256,
          providerConfigVersion:
            ticket.providerConfigVersion,
          providerConfigFingerprint:
            ticket.providerConfigFingerprint
        },
        summary:
          summarizeReview({
            identityScopeReview,
            routeColorReview
          })
      };
      fingerprintReview = {
        identityScopeReviewDigest:
          identityScopeReview
            .responseDigest,
        routeColorReviewDigest:
          routeColorReview
            .responseDigest
      };
    }

    analysisGuard =
      await guardAnalysisRequest({
        request,
        endpoint:
          "face-reading-test",
        fingerprintInput: {
          purpose:
            "face-lab-simulation-review",
          mode,
          caseId:
            ticket.caseId,
          renderSpecSha256:
            ticket.renderSpecSha256,
          providerConfigFingerprint:
            ticket.providerConfigFingerprint,
          ...fingerprintReview
        }
      });

    if (!analysisGuard.ok) {
      return createAnalysisGuardResponse(
        analysisGuard,
        locale
      );
    }

    return applyAnalysisGuardCookies(
      json(responseBody),
      analysisGuard
    );
  } catch {
    if (analysisGuard?.ok) {
      await failAnalysisRequestGuard(
        analysisGuard
      );
    }

    writeSafeLog("error", {
      event:
        "face_lab_simulation_review_test_failed",
      category:
        "internal_error",
      operation:
        "face_lab_simulation_review_test",
      dependency:
        "application",
      retryable:
        false
    });

    return applyAnalysisGuardCookies(
      json(
        {
          success: false,
          error:
            "simulation_review_failed"
        },
        { status: 500 }
      ),
      analysisGuard
    );
  }
}
