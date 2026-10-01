import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildFaceLabV2Canonical
} from "../lib/face-lab-v2/canonical-composer.js";
import {
  FACE_LAB_AI_SIMULATION_VERSION
} from "../lib/face-lab-v2/simulation-service-core.js";
import {
  FACE_LAB_SIMULATION_INSTRUCTION_VERSION
} from "../lib/face-lab-v2/simulation-instructions.js";
import {
  reconstructFaceLabSimulationRenderAuthority
} from "../lib/face-lab-v2/simulation-render-authority.js";
import {
  buildFaceLabSimulationEvidencePacket
} from "../lib/face-lab-v2/evaluation/simulation-evidence-packet.js";
import {
  requiresFaceLabColorFidelity
} from "../lib/face-lab-v2/evaluation/simulation-evaluation.js";
import {
  buildFaceLabSimulationIdentityScopeReview
} from "../lib/face-lab-v2/evaluation/simulation-identity-scope-review.js";
import {
  buildFaceLabSimulationRouteColorReview,
  buildFaceLabSimulationRouteColorReviewTemplate,
  FACE_LAB_SIMULATION_COLOR_REVIEW_VALUES,
  FACE_LAB_SIMULATION_ROUTE_COLOR_REVIEW_VERSION,
  FACE_LAB_SIMULATION_ROUTE_REVIEW_VALUES
} from "../lib/face-lab-v2/evaluation/simulation-route-color-review.js";
import {
  buildFaceLabV2CoverageCohort
} from "../lib/face-lab-v2/evaluation/harness.js";

function identityStable() {
  return {
    facial_geometry: "stable",
    eye_anatomy: "stable",
    nose_geometry: "stable",
    jaw_chin_geometry: "stable",
    ear_geometry: "stable"
  };
}

function scopeStable() {
  return {
    face_structure: "unchanged",
    background: "unchanged",
    clothing: "unchanged",
    body: "unchanged",
    head_pose: "unchanged",
    camera_perspective: "unchanged",
    expression: "unchanged",
    lighting_direction: "unchanged",
    unrequested_beautification:
      "unchanged"
  };
}

function responseMap(targets, value) {
  return Object.fromEntries(
    targets.map((target) => [
      target.operationId,
      value
    ])
  );
}

function buildFixtureSet() {
  const cohort =
    buildFaceLabV2CoverageCohort({
      caseCount: 32
    });

  let color = null;
  let noColor = null;
  let multiple = null;

  for (const item of cohort.cases) {
    const preview =
      buildFaceLabV2Canonical({
        analysis: item.analysis,
        surveyAnswers:
          item.surveyAnswers,
        targetFinderResult: null,
        selectedRouteId: null,
        locale: "ko"
      });

    for (
      const route of
      preview?.routes?.routes || []
    ) {
      const rawState = {
        surveyAnswers:
          item.surveyAnswers,
        targetFinderResult: null,
        selectedRouteId:
          route.routeId
      };

      const reconstructed =
        reconstructFaceLabSimulationRenderAuthority({
          analysis:
            item.analysis,
          rawState,
          locale: "ko"
        });

      if (
        reconstructed.status !==
        "ready"
      ) {
        continue;
      }

      const fixture = {
        item,
        rawState,
        reconstructed
      };
      const hasColor =
        requiresFaceLabColorFidelity(
          reconstructed.renderSpec
        );

      if (hasColor && !color) {
        color = fixture;
      }

      if (!hasColor && !noColor) {
        noColor = fixture;
      }

      if (
        reconstructed
          .renderSpec
          .operations.length >= 2 &&
        !multiple
      ) {
        multiple = fixture;
      }

      if (
        color &&
        noColor &&
        multiple
      ) {
        return {
          color,
          noColor,
          multiple
        };
      }
    }
  }

  return {
    color,
    noColor,
    multiple
  };
}

const fixtures =
  buildFixtureSet();

assert.ok(
  fixtures.color,
  "Gate G-D requires a color-intent fixture"
);
assert.ok(
  fixtures.noColor,
  "Gate G-D requires a no-color fixture"
);
assert.ok(
  fixtures.multiple,
  "Gate G-D requires a multi-operation fixture"
);

assert.deepEqual(
  FACE_LAB_SIMULATION_ROUTE_REVIEW_VALUES,
  [
    "executed",
    "partial",
    "missed",
    "contradicted",
    "not_assessable"
  ]
);
assert.deepEqual(
  FACE_LAB_SIMULATION_COLOR_REVIEW_VALUES,
  [
    "on_target",
    "near_target",
    "off_target",
    "not_assessable"
  ]
);

function templateFor(fixture, caseId) {
  const template =
    buildFaceLabSimulationRouteColorReviewTemplate({
      caseId,
      analysis:
        fixture.item.analysis,
      rawState:
        fixture.rawState,
      locale: "ko"
    });

  assert.equal(
    template.status,
    "ready"
  );
  assert.equal(
    template.trace
      .renderSpecSha256,
    fixture.reconstructed
      .renderSpecSha256
  );
  assert.equal(
    template.routeTargets.length,
    fixture.reconstructed
      .renderSpec
      .operations.length
  );
  assert.equal(
    template.rawImagesIncluded,
    false
  );

  return template;
}

function reviewFor(
  fixture,
  caseId,
  {
    routeValue = "executed",
    colorValue = "on_target",
    routeOverrides = {},
    colorOverrides = {},
    reviewerRef = "operator-01",
    digest = null
  } = {}
) {
  const template =
    templateFor(
      fixture,
      caseId
    );

  return {
    template,
    review:
      buildFaceLabSimulationRouteColorReview({
        caseId,
        reviewerRef,
        analysis:
          fixture.item.analysis,
        rawState:
          fixture.rawState,
        locale: "ko",
        renderSpecSha256:
          digest ||
          template.trace
            .renderSpecSha256,
        routeOperations: {
          ...responseMap(
            template.routeTargets,
            routeValue
          ),
          ...routeOverrides
        },
        colorTargets: {
          ...responseMap(
            template.colorTargets,
            colorValue
          ),
          ...colorOverrides
        }
      })
  };
}

const colorPass =
  reviewFor(
    fixtures.color,
    "GATE-G-D-COLOR-PASS"
  );
assert.equal(
  colorPass.review.status,
  "ready"
);
assert.equal(
  colorPass.review.reviewVersion,
  FACE_LAB_SIMULATION_ROUTE_COLOR_REVIEW_VERSION
);
assert.equal(
  colorPass.review.checks
    .route_adherence.status,
  "pass"
);
assert.equal(
  colorPass.review.checks
    .color_fidelity.status,
  "pass"
);
assert.match(
  colorPass.review.responseDigest,
  /^[a-f0-9]{64}$/
);
assert.equal(
  reviewFor(
    fixtures.color,
    "GATE-G-D-COLOR-PASS"
  ).review.responseDigest,
  colorPass.review.responseDigest
);

const nearTarget =
  reviewFor(
    fixtures.color,
    "GATE-G-D-NEAR",
    {
      colorValue:
        "near_target"
    }
  );
assert.equal(
  nearTarget.review.checks
    .color_fidelity.status,
  "pass"
);
assert.ok(
  nearTarget.review
    .diagnostics.color
    .nearTargetOperationIds
    .length > 0
);

const firstColorId =
  colorPass.template
    .colorTargets[0]
    .operationId;
const offTarget =
  reviewFor(
    fixtures.color,
    "GATE-G-D-OFF",
    {
      colorOverrides: {
        [firstColorId]:
          "off_target"
      }
    }
  );
assert.equal(
  offTarget.review.checks
    .color_fidelity.status,
  "review"
);
assert.equal(
  offTarget.review.checks
    .color_fidelity.findings[0]
    .code,
  "COLOR_OFF_TARGET"
);

const colorUnknown =
  reviewFor(
    fixtures.color,
    "GATE-G-D-COLOR-UNKNOWN",
    {
      colorOverrides: {
        [firstColorId]:
          "not_assessable"
      }
    }
  );
assert.equal(
  colorUnknown.review.checks
    .color_fidelity.status,
  "not_evaluated"
);

const noColor =
  reviewFor(
    fixtures.noColor,
    "GATE-G-D-NO-COLOR"
  );
assert.equal(
  noColor.template
    .colorTargets.length,
  0
);
assert.equal(
  noColor.review.checks
    .color_fidelity.status,
  "not_applicable"
);

const multi =
  reviewFor(
    fixtures.multiple,
    "GATE-G-D-MULTI"
  );
const [
  firstOperationId,
  secondOperationId
] =
  multi.template
    .routeTargets
    .map((target) =>
      target.operationId
    );

for (const [value, code] of [
  [
    "partial",
    "UNDER_EDITED"
  ],
  [
    "missed",
    "ROUTE_OPERATION_MISSED"
  ],
  [
    "contradicted",
    "ROUTE_OPERATION_CONTRADICTED"
  ]
]) {
  const evaluated =
    reviewFor(
      fixtures.multiple,
      "GATE-G-D-" +
        value.toUpperCase(),
      {
        routeOverrides: {
          [firstOperationId]:
            value
        }
      }
    );

  assert.equal(
    evaluated.review.checks
      .route_adherence.status,
    "review"
  );
  assert.ok(
    evaluated.review.checks
      .route_adherence.findings
      .some(
        (finding) =>
          finding.code === code &&
          finding.targetRef ===
            firstOperationId
      )
  );
}

const routeUnknown =
  reviewFor(
    fixtures.multiple,
    "GATE-G-D-ROUTE-UNKNOWN",
    {
      routeOverrides: {
        [firstOperationId]:
          "not_assessable"
      }
    }
  );
assert.equal(
  routeUnknown.review.checks
    .route_adherence.status,
  "not_evaluated"
);

const observedIssueWins =
  reviewFor(
    fixtures.multiple,
    "GATE-G-D-ISSUE-WINS",
    {
      routeOverrides: {
        [firstOperationId]:
          "contradicted",
        [secondOperationId]:
          "not_assessable"
      }
    }
  );
assert.equal(
  observedIssueWins.review.checks
    .route_adherence.status,
  "review"
);
assert.deepEqual(
  observedIssueWins.review
    .diagnostics.route
    .notAssessableOperationIds,
  [secondOperationId]
);

const staleDigest =
  reviewFor(
    fixtures.color,
    "GATE-G-D-STALE",
    {
      digest:
        "f".repeat(64)
    }
  );
assert.equal(
  staleDigest.review.status,
  "invalid"
);
assert.equal(
  staleDigest.review.reason,
  "render_spec_digest_mismatch"
);

const overlongDigest =
  reviewFor(
    fixtures.color,
    "GATE-G-D-OVERLONG",
    {
      digest:
        colorPass.template.trace
          .renderSpecSha256 +
        "a"
    }
  );
assert.equal(
  overlongDigest.review.status,
  "invalid"
);
assert.equal(
  overlongDigest.review.reason,
  "render_spec_digest_mismatch"
);

const badTargetTemplate =
  templateFor(
    fixtures.color,
    "GATE-G-D-BAD-TARGET"
  );
const badTargetRoutes =
  responseMap(
    badTargetTemplate
      .routeTargets,
    "executed"
  );
delete badTargetRoutes[
  badTargetTemplate
    .routeTargets[0]
    .operationId
];
badTargetRoutes[
  "render-operation:invented"
] = "executed";

const badTarget =
  buildFaceLabSimulationRouteColorReview({
    caseId:
      "GATE-G-D-BAD-TARGET",
    reviewerRef:
      "operator-01",
    analysis:
      fixtures.color
        .item.analysis,
    rawState:
      fixtures.color
        .rawState,
    locale: "ko",
    renderSpecSha256:
      badTargetTemplate
        .trace
        .renderSpecSha256,
    routeOperations:
      badTargetRoutes,
    colorTargets:
      responseMap(
        badTargetTemplate
          .colorTargets,
        "on_target"
      )
  });
assert.equal(
  badTarget.status,
  "invalid"
);
assert.equal(
  badTarget.reason,
  "route_response_targets_mismatch"
);

assert.equal(
  reviewFor(
    fixtures.color,
    "GATE-G-D-BAD-REVIEWER",
    {
      reviewerRef:
        "person@example.com"
    }
  ).review.reason,
  "reviewer_ref_not_pseudonymous"
);

const templateSerialized =
  JSON.stringify(
    colorPass.template
  );
for (const forbidden of [
  "imageBytes",
  "data:image/",
  "providerPayload",
  "analysis",
  "faceLabV2State"
]) {
  assert.equal(
    templateSerialized.includes(
      forbidden
    ),
    false,
    "review template leaked private/provider material: " +
      forbidden
  );
}

const identityScope =
  buildFaceLabSimulationIdentityScopeReview({
    caseId:
      "GATE-G-D-FULL-PACKET",
    reviewerRef:
      "operator-01",
    identity:
      identityStable(),
    editScope:
      scopeStable()
  });

const routeColor =
  reviewFor(
    fixtures.color,
    "GATE-G-D-FULL-PACKET"
  ).review;

const fullPacket =
  buildFaceLabSimulationEvidencePacket({
    caseId:
      "GATE-G-D-FULL-PACKET",
    analysis:
      fixtures.color
        .item.analysis,
    rawState:
      fixtures.color
        .rawState,
    locale: "ko",
    canonicalSourceImageBytes:
      Buffer.from(
        "canonical-source-gate-g-d"
      ),
    outputImageBytes:
      Buffer.from(
        "output-gate-g-d"
      ),
    responseMeta: {
      simulationVersion:
        FACE_LAB_AI_SIMULATION_VERSION,
      instructionVersion:
        FACE_LAB_SIMULATION_INSTRUCTION_VERSION,
      routeId:
        fixtures.color
          .reconstructed
          .renderSpec.routeId,
      lookId:
        fixtures.color
          .reconstructed
          .renderSpec.lookId,
      renderSpecSha256:
        fixtures.color
          .reconstructed
          .renderSpecSha256
    },
    checks: {
      ...identityScope.checks,
      ...routeColor.checks
    },
    checkEvidenceRefs: [
      {
        evidenceVersion:
          identityScope
            .reviewVersion,
        evidenceDigest:
          identityScope
            .responseDigest,
        checkIds:
          Object.keys(
            identityScope.checks
          )
      },
      {
        evidenceVersion:
          routeColor
            .reviewVersion,
        evidenceDigest:
          routeColor
            .responseDigest,
        checkIds:
          Object.keys(
            routeColor.checks
          )
      }
    ]
  });

assert.equal(
  fullPacket.status,
  "ready"
);
assert.equal(
  fullPacket.evaluation.verdict,
  "pass"
);
assert.deepEqual(
  Object.fromEntries(
    Object.entries(
      fullPacket
        .evaluation
        .checks
    ).map(
      ([checkId, check]) => [
        checkId,
        check.status
      ]
    )
  ),
  {
    identity_preservation:
      "pass",
    route_adherence:
      "pass",
    color_fidelity:
      "pass",
    edit_scope:
      "pass"
  }
);
assert.equal(
  fullPacket
    .checkEvidenceRefs.length,
  2
);
const fullSerialized =
  JSON.stringify(fullPacket);
assert.equal(
  fullSerialized.includes(
    "operator-01"
  ),
  false
);
assert.equal(
  fullSerialized.includes(
    "on_target"
  ),
  false
);
assert.equal(
  fullSerialized.includes(
    "executed"
  ),
  false
);

const templateCli =
  readFileSync(
    "scripts/build-face-lab-v2-simulation-route-color-template.mjs",
    "utf8"
  );
const reviewCli =
  readFileSync(
    "scripts/build-face-lab-v2-simulation-route-color-review.mjs",
    "utf8"
  );

for (const source of [
  templateCli,
  reviewCli
]) {
  assert.equal(
    source.includes(
      "generateFaceLabSimulation"
    ),
    false
  );
  assert.equal(
    source.includes(
      "writeFile"
    ),
    false
  );
}

console.log(
  "FACE_LAB_V2_SIMULATION_ROUTE_COLOR_REVIEW=PASS"
);
