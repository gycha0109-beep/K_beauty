import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  FACE_LAB_AI_SIMULATION_VERSION
} from "../lib/face-lab-v2/simulation-service-core.js";
import {
  FACE_LAB_SIMULATION_INSTRUCTION_VERSION
} from "../lib/face-lab-v2/simulation-instructions.js";
import {
  FACE_LAB_SIMULATION_PROVIDER_CONFIG_VERSION
} from "../lib/face-lab-v2/simulation-provider-config.js";
import {
  reconstructFaceLabSimulationRenderAuthority
} from "../lib/face-lab-v2/simulation-render-authority.js";
import {
  buildFaceLabSimulationEvidencePacket
} from "../lib/face-lab-v2/evaluation/simulation-evidence-packet.js";
import {
  buildFaceLabSimulationIdentityScopeReview,
  FACE_LAB_SIMULATION_EDIT_SCOPE_DIMENSIONS,
  FACE_LAB_SIMULATION_IDENTITY_DIMENSIONS,
  FACE_LAB_SIMULATION_IDENTITY_SCOPE_REVIEW_VERSION
} from "../lib/face-lab-v2/evaluation/simulation-identity-scope-review.js";
import {
  buildFaceLabV2CoverageCohort
} from "../lib/face-lab-v2/evaluation/harness.js";

function identity(value = "stable") {
  return Object.fromEntries(
    FACE_LAB_SIMULATION_IDENTITY_DIMENSIONS.map(
      (dimension) => [
        dimension,
        value
      ]
    )
  );
}

function editScope(value = "unchanged") {
  return Object.fromEntries(
    FACE_LAB_SIMULATION_EDIT_SCOPE_DIMENSIONS.map(
      (dimension) => [
        dimension,
        value
      ]
    )
  );
}

function review(overrides = {}) {
  return buildFaceLabSimulationIdentityScopeReview({
    caseId: "GATE-G-C-001",
    reviewerRef: "operator-01",
    identity: identity(),
    editScope: editScope(),
    ...overrides
  });
}

assert.deepEqual(
  FACE_LAB_SIMULATION_IDENTITY_DIMENSIONS,
  [
    "facial_geometry",
    "eye_anatomy",
    "nose_geometry",
    "jaw_chin_geometry",
    "ear_geometry"
  ]
);
assert.deepEqual(
  FACE_LAB_SIMULATION_EDIT_SCOPE_DIMENSIONS,
  [
    "face_structure",
    "background",
    "clothing",
    "body",
    "head_pose",
    "camera_perspective",
    "expression",
    "lighting_direction",
    "unrequested_beautification"
  ]
);

const allStable = review();
assert.equal(allStable.status, "ready");
assert.equal(
  allStable.reviewVersion,
  FACE_LAB_SIMULATION_IDENTITY_SCOPE_REVIEW_VERSION
);
assert.equal(
  allStable.checks.identity_preservation.status,
  "pass"
);
assert.equal(
  allStable.checks.edit_scope.status,
  "pass"
);
assert.match(
  allStable.responseDigest,
  /^[a-f0-9]{64}$/
);
assert.equal(
  review().responseDigest,
  allStable.responseDigest
);

const identityMajorInput = identity();
identityMajorInput.facial_geometry =
  "major_drift";
identityMajorInput.ear_geometry =
  "not_assessable";
const identityMajor = review({
  identity: identityMajorInput
});
assert.equal(
  identityMajor.checks
    .identity_preservation.status,
  "fail"
);
assert.deepEqual(
  identityMajor.checks
    .identity_preservation.findings
    .map((item) => item.code),
  ["IDENTITY_MAJOR_DRIFT"]
);
assert.equal(
  identityMajor.checks
    .identity_preservation.findings[0]
    .failureSource,
  "evaluation_uncertain"
);

const identityMinorInput = identity();
identityMinorInput.eye_anatomy =
  "minor_drift";
const identityMinor = review({
  identity: identityMinorInput
});
assert.equal(
  identityMinor.checks
    .identity_preservation.status,
  "review"
);
assert.equal(
  identityMinor.checks
    .identity_preservation.findings[0]
    .code,
  "IDENTITY_MINOR_DRIFT"
);

const identityUnknownInput = identity();
identityUnknownInput.eye_anatomy =
  "minor_drift";
identityUnknownInput.ear_geometry =
  "not_assessable";
const identityUnknown = review({
  identity: identityUnknownInput
});
assert.equal(
  identityUnknown.checks
    .identity_preservation.status,
  "not_evaluated"
);
assert.deepEqual(
  identityUnknown.diagnostics
    .identity.minorDriftDimensions,
  ["eye_anatomy"]
);
assert.deepEqual(
  identityUnknown.checks
    .identity_preservation.findings,
  []
);

const scopeMajorInput = editScope();
scopeMajorInput.background =
  "major_change";
scopeMajorInput.body =
  "not_assessable";
const scopeMajor = review({
  editScope: scopeMajorInput
});
assert.equal(
  scopeMajor.checks.edit_scope.status,
  "fail"
);
assert.equal(
  scopeMajor.checks.edit_scope
    .findings[0].code,
  "SCOPE_BACKGROUND"
);

const scopeMinorInput = editScope();
scopeMinorInput.camera_perspective =
  "minor_change";
const scopeMinor = review({
  editScope: scopeMinorInput
});
assert.equal(
  scopeMinor.checks.edit_scope.status,
  "review"
);
assert.equal(
  scopeMinor.checks.edit_scope
    .findings[0].code,
  "OVER_EDITED"
);
assert.equal(
  scopeMinor.checks.edit_scope
    .findings[0].targetRef,
  "camera_perspective"
);

const beautificationInput = editScope();
beautificationInput
  .unrequested_beautification =
  "major_change";
const beautification = review({
  editScope: beautificationInput
});
assert.equal(
  beautification.checks.edit_scope.status,
  "review"
);
assert.equal(
  beautification.checks.edit_scope
    .findings[0].code,
  "SCOPE_UNREQUESTED_BEAUTIFICATION"
);

const scopeUnknownInput = editScope();
scopeUnknownInput.background =
  "minor_change";
scopeUnknownInput.clothing =
  "not_assessable";
const scopeUnknown = review({
  editScope: scopeUnknownInput
});
assert.equal(
  scopeUnknown.checks.edit_scope.status,
  "not_evaluated"
);
assert.deepEqual(
  scopeUnknown.diagnostics
    .editScope.minorChangeDimensions,
  ["background"]
);

const missingIdentity = identity();
delete missingIdentity.ear_geometry;
assert.equal(
  review({
    identity: missingIdentity
  }).reason,
  "identity_response_invalid"
);

const unknownScope = {
  ...editScope(),
  hairstyle: "unchanged"
};
assert.equal(
  review({
    editScope: unknownScope
  }).reason,
  "edit_scope_unknown_dimension"
);

assert.equal(
  review({
    reviewerRef:
      "operator@example.com"
  }).reason,
  "reviewer_ref_not_pseudonymous"
);

const serializedReview =
  JSON.stringify(allStable);
for (const forbidden of [
  "data:image/",
  "imageBytes",
  "providerPayload",
  "sourceImagePath",
  "outputImagePath"
]) {
  assert.equal(
    serializedReview.includes(forbidden),
    false
  );
}

function buildRenderableFixture() {
  const cohort =
    buildFaceLabV2CoverageCohort({
      caseCount: 12
    });

  for (const item of cohort.cases) {
    const preview =
      reconstructFaceLabSimulationRenderAuthority({
        analysis: item.analysis,
        rawState: {
          surveyAnswers:
            item.surveyAnswers,
          targetFinderResult: null,
          selectedRouteId:
            "invalid-preview-route"
        },
        locale: "ko"
      });

    if (
      preview.status === "ready"
    ) {
      return {
        item,
        rawState: {
          surveyAnswers:
            item.surveyAnswers,
          targetFinderResult: null,
          selectedRouteId:
            preview.renderSpec.routeId
        },
        reconstructed: preview
      };
    }
  }

  for (const item of cohort.cases) {
    const candidateState = {
      surveyAnswers:
        item.surveyAnswers,
      targetFinderResult: null,
      selectedRouteId: null
    };

    const initial =
      reconstructFaceLabSimulationRenderAuthority({
        analysis: item.analysis,
        rawState: candidateState,
        locale: "ko"
      });

    if (
      initial.status === "ready"
    ) {
      return {
        item,
        rawState: candidateState,
        reconstructed: initial
      };
    }
  }

  throw new Error(
    "no renderable Gate G-C fixture"
  );
}

const cohort =
  buildFaceLabV2CoverageCohort({
    caseCount: 12
  });
let integration = null;

for (const item of cohort.cases) {
  const previewState = {
    surveyAnswers:
      item.surveyAnswers,
    targetFinderResult: null,
    selectedRouteId: null
  };

  const previewCanonicalModule =
    await import(
      "../lib/face-lab-v2/canonical-composer.js"
    );
  const preview =
    previewCanonicalModule
      .buildFaceLabV2Canonical({
        analysis: item.analysis,
        surveyAnswers:
          item.surveyAnswers,
        targetFinderResult: null,
        selectedRouteId: null,
        locale: "ko"
      });
  const routeId =
    preview?.routes?.routes?.[0]
      ?.routeId;

  if (!routeId) continue;

  const rawState = {
    ...previewState,
    selectedRouteId: routeId
  };
  const reconstructed =
    reconstructFaceLabSimulationRenderAuthority({
      analysis: item.analysis,
      rawState,
      locale: "ko"
    });

  if (
    reconstructed.status === "ready"
  ) {
    integration = {
      item,
      rawState,
      reconstructed
    };
    break;
  }
}

assert.ok(
  integration,
  "Gate G-C requires one renderable integration fixture"
);

const integrationReview =
  buildFaceLabSimulationIdentityScopeReview({
    caseId: "GATE-G-C-PACKET",
    reviewerRef: "operator-01",
    identity: identity(),
    editScope: editScope()
  });

const packet =
  buildFaceLabSimulationEvidencePacket({
    caseId: "GATE-G-C-PACKET",
    analysis:
      integration.item.analysis,
    rawState:
      integration.rawState,
    locale: "ko",
    canonicalSourceImageBytes:
      Buffer.from(
        "canonical-source-gate-g-c"
      ),
    outputImageBytes:
      Buffer.from(
        "output-gate-g-c"
      ),
    responseMeta: {
      simulationVersion:
        FACE_LAB_AI_SIMULATION_VERSION,
      instructionVersion:
        FACE_LAB_SIMULATION_INSTRUCTION_VERSION,
      providerConfigVersion:
        FACE_LAB_SIMULATION_PROVIDER_CONFIG_VERSION,
      providerConfigFingerprint:
        "d".repeat(64),
      routeId:
        integration.reconstructed
          .renderSpec.routeId,
      lookId:
        integration.reconstructed
          .renderSpec.lookId,
      renderSpecSha256:
        integration.reconstructed
          .renderSpecSha256
    },
    checks:
      integrationReview.checks,
    checkEvidenceRefs: [
      {
        evidenceVersion:
          integrationReview.reviewVersion,
        evidenceDigest:
          integrationReview.responseDigest,
        checkIds:
          Object.keys(
            integrationReview.checks
          )
      }
    ]
  });

assert.equal(packet.status, "ready");
assert.equal(
  packet.evaluation.checks
    .identity_preservation.status,
  "pass"
);
assert.equal(
  packet.evaluation.checks
    .edit_scope.status,
  "pass"
);
assert.equal(
  packet.evaluation.checks
    .route_adherence.status,
  "not_evaluated"
);
assert.equal(
  packet.evaluation.verdict,
  "not_evaluated"
);
assert.deepEqual(
  packet.checkEvidenceRefs,
  [
    {
      evidenceVersion:
        FACE_LAB_SIMULATION_IDENTITY_SCOPE_REVIEW_VERSION,
      evidenceDigest:
        integrationReview.responseDigest,
      checkIds: [
        "edit_scope",
        "identity_preservation"
      ]
    }
  ]
);
assert.equal(
  JSON.stringify(packet).includes(
    "operator-01"
  ),
  false,
  "packet must retain review digest, not reviewer identity"
);
assert.equal(
  JSON.stringify(packet).includes(
    "stable"
  ),
  false,
  "packet must not duplicate raw Human response matrix"
);

const invalidChecks =
  buildFaceLabSimulationEvidencePacket({
    caseId: "GATE-G-C-BAD-CHECKS",
    analysis:
      integration.item.analysis,
    rawState:
      integration.rawState,
    locale: "ko",
    canonicalSourceImageBytes:
      Buffer.from("source"),
    outputImageBytes:
      Buffer.from("output"),
    responseMeta: {
      simulationVersion:
        FACE_LAB_AI_SIMULATION_VERSION,
      instructionVersion:
        FACE_LAB_SIMULATION_INSTRUCTION_VERSION,
      providerConfigVersion:
        FACE_LAB_SIMULATION_PROVIDER_CONFIG_VERSION,
      providerConfigFingerprint:
        "d".repeat(64),
      routeId:
        integration.reconstructed
          .renderSpec.routeId,
      lookId:
        integration.reconstructed
          .renderSpec.lookId,
      renderSpecSha256:
        integration.reconstructed
          .renderSpecSha256
    },
    checks: []
  });
assert.equal(
  invalidChecks.reason,
  "checks_invalid"
);

const mismatchedEvidenceRef =
  buildFaceLabSimulationEvidencePacket({
    caseId: "GATE-G-C-BAD-REF",
    analysis:
      integration.item.analysis,
    rawState:
      integration.rawState,
    locale: "ko",
    canonicalSourceImageBytes:
      Buffer.from("source"),
    outputImageBytes:
      Buffer.from("output"),
    responseMeta: {
      simulationVersion:
        FACE_LAB_AI_SIMULATION_VERSION,
      instructionVersion:
        FACE_LAB_SIMULATION_INSTRUCTION_VERSION,
      providerConfigVersion:
        FACE_LAB_SIMULATION_PROVIDER_CONFIG_VERSION,
      providerConfigFingerprint:
        "d".repeat(64),
      routeId:
        integration.reconstructed
          .renderSpec.routeId,
      lookId:
        integration.reconstructed
          .renderSpec.lookId,
      renderSpecSha256:
        integration.reconstructed
          .renderSpecSha256
    },
    checks:
      integrationReview.checks,
    checkEvidenceRefs: [
      {
        evidenceVersion:
          integrationReview.reviewVersion,
        evidenceDigest:
          integrationReview.responseDigest,
        checkIds: [
          "route_adherence"
        ]
      }
    ]
  });
assert.equal(
  mismatchedEvidenceRef.status,
  "invalid"
);
assert.equal(
  mismatchedEvidenceRef.reason,
  "check_evidence_ref_without_supplied_check"
);

const packetCliSource =
  readFileSync(
    "scripts/build-face-lab-v2-simulation-evidence-packet.mjs",
    "utf8"
  );
const reviewCliSource =
  readFileSync(
    "scripts/build-face-lab-v2-simulation-identity-scope-review.mjs",
    "utf8"
  );

for (const required of [
  "checkEvidencePaths",
  "duplicate check evidence",
  "check evidence caseId mismatch",
  "responseDigest",
  "reviewVersion"
]) {
  assert.ok(
    packetCliSource.includes(required),
    "packet CLI missing check evidence integration: " +
      required
  );
}

assert.equal(
  packetCliSource.includes(
    "writeFile"
  ),
  false
);
assert.equal(
  reviewCliSource.includes(
    "writeFile"
  ),
  false
);
assert.equal(
  reviewCliSource.includes(
    "generateFaceLabSimulation"
  ),
  false
);

console.log(
  "FACE_LAB_V2_SIMULATION_IDENTITY_SCOPE_REVIEW=PASS"
);
