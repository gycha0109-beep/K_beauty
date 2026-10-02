import { NextResponse } from "next/server";
import {
  buildFaceLabSimulationIdentityScopeReview
} from "@/lib/face-lab-v2/evaluation/simulation-identity-scope-review";
import {
  buildFaceLabSimulationRouteColorReview
} from "@/lib/face-lab-v2/evaluation/simulation-route-color-review";
import {
  buildFaceLabSimulationPilotCapture
} from "@/lib/face-lab-v2/evaluation/simulation-pilot-capture";
import {
  faceLabPrivateArtifactStem
} from "@/lib/face-lab-v2/evaluation/private-artifact-filename";

export const runtime = "nodejs";

const MAX_REQUEST_BYTES = 512 * 1024;
const CHANGE_INTENSITIES =
  new Set(["minimal", "light", "moderate", "high"]);

function json(body, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0"
    }
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
      identityScopeReview.checks
        .identity_preservation.status,
    editScope:
      identityScopeReview.checks
        .edit_scope.status,
    route:
      routeColorReview.checks
        .route_adherence.status,
    color:
      routeColorReview.checks
        .color_fidelity.status
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
    values.includes("not_evaluated")
  ) {
    overall = "not_evaluated";
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

function responseMetaFromInput(
  reviewInput
) {
  const simulation =
    reviewInput.simulation;

  if (!isObject(simulation)) {
    return null;
  }

  return {
    reviewCaseId:
      reviewInput.caseId,
    simulationVersion:
      simulation.simulationVersion,
    instructionVersion:
      simulation.instructionVersion,
    providerConfigVersion:
      simulation.providerConfigVersion,
    providerConfigFingerprint:
      simulation.providerConfigFingerprint,
    routeId:
      simulation.routeId,
    lookId:
      simulation.lookId,
    renderSpecSha256:
      simulation.renderSpecSha256
  };
}

export async function POST(request) {
  if (process.env.NODE_ENV === "production") {
    return json(
      {
        success: false,
        error:
          "private_review_route_disabled"
      },
      404
    );
  }

  const declaredLength =
    Number(
      request.headers.get(
        "content-length"
      ) || 0
    );

  if (
    Number.isFinite(declaredLength) &&
    declaredLength >
      MAX_REQUEST_BYTES
  ) {
    return json(
      {
        success: false,
        error:
          "request_too_large"
      },
      413
    );
  }

  const body =
    await request.json()
      .catch(() => null);

  if (
    !isObject(body) ||
    !isObject(body.reviewInput) ||
    !isObject(body.responses)
  ) {
    return json(
      {
        success: false,
        error:
          "private_review_input_invalid"
      },
      400
    );
  }

  const reviewInput =
    body.reviewInput;
  const responses =
    body.responses;

  if (
    reviewInput.schemaVersion !==
      "face-lab-g-e2b-provider-review-input-v1" ||
    !reviewInput.caseId ||
    !reviewInput.campaignId ||
    !reviewInput.intentGroupId ||
    !Number.isSafeInteger(
      reviewInput.generationIndex
    ) ||
    !isObject(reviewInput.analysis) ||
    !isObject(
      reviewInput.faceLabV2State
    )
  ) {
    return json(
      {
        success: false,
        error:
          "private_review_input_contract_invalid"
      },
      400
    );
  }

  const artifactStem =
    faceLabPrivateArtifactStem(
      reviewInput.caseId
    );

  if (!artifactStem) {
    return json(
      {
        success: false,
        error:
          "private_review_case_id_invalid"
      },
      400
    );
  }

  const identityScopeReview =
    buildFaceLabSimulationIdentityScopeReview({
      caseId:
        reviewInput.caseId,
      reviewerRef:
        responses.reviewerRef,
      identity:
        responses.identity,
      editScope:
        responses.editScope
    });

  if (
    identityScopeReview.status !==
      "ready"
  ) {
    return json(
      {
        success: false,
        error:
          identityScopeReview.reason
      },
      422
    );
  }

  const routeColorReview =
    buildFaceLabSimulationRouteColorReview({
      caseId:
        reviewInput.caseId,
      reviewerRef:
        responses.reviewerRef,
      analysis:
        reviewInput.analysis,
      rawState:
        reviewInput.faceLabV2State,
      locale: "ko",
      renderSpecSha256:
        reviewInput.simulation
          ?.renderSpecSha256,
      routeOperations:
        responses.routeOperations,
      colorTargets:
        responses.colorTargets
    });

  if (
    routeColorReview.status !==
      "ready"
  ) {
    return json(
      {
        success: false,
        error:
          routeColorReview.reason
      },
      422
    );
  }

  const responseMeta =
    responseMetaFromInput(
      reviewInput
    );

  const capture =
    buildFaceLabSimulationPilotCapture({
      caseId:
        reviewInput.caseId,
      locale: "ko",
      sourceMimeType:
        body.sourceMimeType,
      outputMimeType:
        body.outputMimeType,
      analysis:
        reviewInput.analysis,
      faceLabV2State:
        reviewInput.faceLabV2State,
      responseMeta,
      identityScopeReview,
      routeColorReview
    });

  if (
    capture.status !== "ready"
  ) {
    return json(
      {
        success: false,
        error:
          capture.reason
      },
      422
    );
  }

  const changeIntensity =
    reviewInput.faceLabV2State
      ?.surveyAnswers
      ?.changeTolerance;

  if (
    !CHANGE_INTENSITIES.has(
      changeIntensity
    )
  ) {
    return json(
      {
        success: false,
        error:
          "private_review_change_intensity_invalid"
      },
      422
    );
  }

  const runSpec = {
    captureManifestPath:
      `./${capture.fileNames.manifest}`,
    campaignId:
      reviewInput.campaignId,
    intentGroupId:
      reviewInput.intentGroupId,
    generationIndex:
      reviewInput.generationIndex,
    changeIntensity,
    routeSelectionState:
      "user_selected"
  };

  return json({
    success: true,
    caseId:
      reviewInput.caseId,
    identityScopeReview,
    routeColorReview,
    capture: {
      fileNames:
        capture.fileNames,
      manifest:
        capture.manifest
    },
    runSpec,
    runSpecFileName:
      `${artifactStem}.pilot-case-run.json`,
    summary:
      summarizeReview({
        identityScopeReview,
        routeColorReview
      })
  });
}
