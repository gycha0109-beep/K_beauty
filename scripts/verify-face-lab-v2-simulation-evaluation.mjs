import assert from "node:assert/strict";
import {
  FACE_LAB_IDENTITY_LOCK,
  FACE_LAB_RENDER_SPEC_VERSION
} from "../lib/face-lab-v2/render-adapter.js";
import {
  FACE_LAB_SIMULATION_EVALUATION_CHECKS,
  FACE_LAB_SIMULATION_EVALUATION_VERSION,
  FACE_LAB_SIMULATION_FAILURE_SOURCES,
  FACE_LAB_SIMULATION_FAILURE_TAXONOMY,
  adjudicateFaceLabSimulationEvidence,
  requiresFaceLabColorFidelity,
  validateFaceLabSimulationEvidence
} from "../lib/face-lab-v2/evaluation/simulation-evaluation.js";

const SOURCE_HASH = "a".repeat(64);
const OUTPUT_HASH = "b".repeat(64);

function renderSpec({ color = false } = {}) {
  return {
    status: "ready",
    renderSpecVersion: FACE_LAB_RENDER_SPEC_VERSION,
    routeId: "route:test",
    lookId: "look:test",
    identityLock: [...FACE_LAB_IDENTITY_LOCK],
    operations: [
      {
        operationId: "render-operation:hair_shape",
        slotKey: "hair_shape",
        targetRegions: ["hair"],
        colorAuthority: {
          fidelityState: "none",
          candidateSemanticAttributes: {},
          requestedSemanticAttributes: {},
          preferredSemanticAttributes: {}
        }
      },
      ...(color
        ? [{
            operationId: "render-operation:overall_palette",
            slotKey: "overall_palette",
            targetRegions: ["rendered_style_elements"],
            colorAuthority: {
              fidelityState: "semantic_only",
              candidateSemanticAttributes: {},
              requestedSemanticAttributes: {},
              preferredSemanticAttributes: {
                temperatureDirection: "cool_neutral"
              }
            }
          }]
        : [])
    ]
  };
}

function check(status, findings = []) {
  return { status, findings };
}

function evidence({
  colorStatus = "not_applicable",
  identity = check("pass"),
  route = check("pass"),
  color = null,
  scope = check("pass")
} = {}) {
  return {
    caseId: "GATE-G-FIXTURE-001",
    simulationVersion: "face-lab-ai-simulation-v1",
    sourceImageSha256: SOURCE_HASH,
    outputImageSha256: OUTPUT_HASH,
    renderSpecVersion: FACE_LAB_RENDER_SPEC_VERSION,
    routeId: "route:test",
    lookId: "look:test",
    checks: {
      identity_preservation: identity,
      route_adherence: route,
      color_fidelity: color || check(colorStatus),
      edit_scope: scope
    }
  };
}

assert.equal(FACE_LAB_SIMULATION_EVALUATION_VERSION, "face-lab-simulation-evaluation-v1");
assert.deepEqual(FACE_LAB_SIMULATION_EVALUATION_CHECKS, [
  "identity_preservation",
  "route_adherence",
  "color_fidelity",
  "edit_scope"
]);
assert.ok(Object.isFrozen(FACE_LAB_SIMULATION_FAILURE_TAXONOMY));
assert.deepEqual(FACE_LAB_SIMULATION_FAILURE_SOURCES, [
  "render_spec",
  "instruction_builder",
  "provider",
  "evaluation_uncertain"
]);
assert.equal(
  FACE_LAB_SIMULATION_FAILURE_TAXONOMY.IDENTITY_MAJOR_DRIFT.severity,
  "hard"
);
assert.equal(
  FACE_LAB_SIMULATION_FAILURE_TAXONOMY.ROUTE_OPERATION_MISSED.severity,
  "review"
);
assert.equal(
  FACE_LAB_SIMULATION_FAILURE_TAXONOMY.SCOPE_CAMERA_PERSPECTIVE.severity,
  "hard"
);

const noColor = renderSpec();
assert.equal(requiresFaceLabColorFidelity(noColor), false);

const allPass = adjudicateFaceLabSimulationEvidence({
  renderSpec: noColor,
  evidence: evidence()
});
assert.equal(allPass.status, "evaluated");
assert.equal(allPass.verdict, "pass");
assert.equal(allPass.reason, "all_applicable_checks_passed");
assert.equal(allPass.colorFidelityRequired, false);
assert.equal(allPass.checks.color_fidelity.status, "not_applicable");

const identityFail = adjudicateFaceLabSimulationEvidence({
  renderSpec: noColor,
  evidence: evidence({
    identity: check("fail", [
      { code: "IDENTITY_MAJOR_DRIFT", targetRef: "facial_geometry" }
    ])
  })
});
assert.equal(identityFail.verdict, "fail");
assert.equal(identityFail.reason, "hard_gate_failed");
assert.equal(identityFail.hardFailures.length, 1);

const scopeFail = adjudicateFaceLabSimulationEvidence({
  renderSpec: noColor,
  evidence: evidence({
    scope: check("fail", [
      { code: "SCOPE_BACKGROUND", targetRef: "background" }
    ])
  })
});
assert.equal(scopeFail.verdict, "fail");
assert.equal(scopeFail.hardFailures.length, 1);

const routeReview = adjudicateFaceLabSimulationEvidence({
  renderSpec: noColor,
  evidence: evidence({
    route: check("fail", [
      { code: "ROUTE_OPERATION_CONTRADICTED", targetRef: "hair_shape" }
    ])
  })
});
assert.equal(routeReview.verdict, "review");
assert.equal(routeReview.reason, "quality_review_required");
assert.equal(routeReview.hardFailures.length, 0);

const incomplete = adjudicateFaceLabSimulationEvidence({
  renderSpec: noColor,
  evidence: evidence({
    route: check("not_evaluated")
  })
});
assert.equal(incomplete.verdict, "not_evaluated");
assert.equal(incomplete.reason, "required_check_pending");

const colorSpec = renderSpec({ color: true });
assert.equal(requiresFaceLabColorFidelity(colorSpec), true);

const colorPass = adjudicateFaceLabSimulationEvidence({
  renderSpec: colorSpec,
  evidence: evidence({
    color: check("pass")
  })
});
assert.equal(colorPass.verdict, "pass");
assert.equal(colorPass.colorFidelityRequired, true);

const colorReview = adjudicateFaceLabSimulationEvidence({
  renderSpec: colorSpec,
  evidence: evidence({
    color: check("fail", [
      { code: "COLOR_OFF_TARGET", targetRef: "overall_palette" }
    ])
  })
});
assert.equal(colorReview.verdict, "review");

const invalidColorNA = validateFaceLabSimulationEvidence({
  renderSpec: colorSpec,
  evidence: evidence()
});
assert.equal(invalidColorNA.valid, false);
assert.equal(invalidColorNA.reason, "check_not_applicable_invalid");
assert.equal(invalidColorNA.invalidCheckId, "color_fidelity");

const unknownCode = adjudicateFaceLabSimulationEvidence({
  renderSpec: noColor,
  evidence: evidence({
    route: check("review", [
      { code: "NOT_A_REAL_FAILURE" }
    ])
  })
});
assert.equal(unknownCode.status, "invalid");
assert.equal(unknownCode.reason, "finding_code_unknown");

const attributedRouteReview = adjudicateFaceLabSimulationEvidence({
  renderSpec: noColor,
  evidence: evidence({
    route: check("review", [
      {
        code: "ROUTE_OPERATION_MISSED",
        targetRef: "hair_shape",
        failureSource: "instruction_builder"
      }
    ])
  })
});
assert.equal(attributedRouteReview.verdict, "review");
assert.equal(
  attributedRouteReview.reviewFindings[0].failureSource,
  "instruction_builder"
);

const invalidFailureSource = adjudicateFaceLabSimulationEvidence({
  renderSpec: noColor,
  evidence: evidence({
    route: check("review", [
      {
        code: "ROUTE_OPERATION_MISSED",
        failureSource: "unknown_layer"
      }
    ])
  })
});
assert.equal(invalidFailureSource.status, "invalid");
assert.equal(invalidFailureSource.reason, "finding_failure_source_invalid");

const wrongDimension = adjudicateFaceLabSimulationEvidence({
  renderSpec: noColor,
  evidence: evidence({
    route: check("review", [
      { code: "IDENTITY_MINOR_DRIFT" }
    ])
  })
});
assert.equal(wrongDimension.status, "invalid");
assert.equal(wrongDimension.reason, "finding_check_mismatch");

const hardFindingMustFail = adjudicateFaceLabSimulationEvidence({
  renderSpec: noColor,
  evidence: evidence({
    identity: check("review", [
      { code: "IDENTITY_MAJOR_DRIFT" }
    ])
  })
});
assert.equal(hardFindingMustFail.status, "invalid");
assert.equal(hardFindingMustFail.reason, "hard_finding_requires_fail");

const hardGateFailWithoutHardFinding = adjudicateFaceLabSimulationEvidence({
  renderSpec: noColor,
  evidence: evidence({
    identity: check("fail", [
      { code: "IDENTITY_MINOR_DRIFT" }
    ])
  })
});
assert.equal(hardGateFailWithoutHardFinding.status, "invalid");
assert.equal(
  hardGateFailWithoutHardFinding.reason,
  "hard_gate_fail_requires_hard_finding"
);

const wrongSimulationVersion = adjudicateFaceLabSimulationEvidence({
  renderSpec: noColor,
  evidence: {
    ...evidence(),
    simulationVersion: "face-lab-ai-simulation-old"
  }
});
assert.equal(wrongSimulationVersion.status, "invalid");
assert.equal(wrongSimulationVersion.reason, "simulation_version_mismatch");

const overlongHash = adjudicateFaceLabSimulationEvidence({
  renderSpec: noColor,
  evidence: {
    ...evidence(),
    sourceImageSha256: SOURCE_HASH + "a"
  }
});
assert.equal(overlongHash.status, "invalid");
assert.equal(overlongHash.reason, "image_hash_invalid");

const mismatch = adjudicateFaceLabSimulationEvidence({
  renderSpec: noColor,
  evidence: {
    ...evidence(),
    routeId: "route:other"
  }
});
assert.equal(mismatch.status, "invalid");
assert.equal(mismatch.reason, "evidence_intent_mismatch");

const rawImageFields = JSON.stringify(allPass);
assert.equal(rawImageFields.includes("data:image/"), false);
assert.equal(rawImageFields.includes("imageBytes"), false);
assert.equal(rawImageFields.includes("providerPayload"), false);

console.log("FACE_LAB_V2_SIMULATION_EVALUATION=PASS");
