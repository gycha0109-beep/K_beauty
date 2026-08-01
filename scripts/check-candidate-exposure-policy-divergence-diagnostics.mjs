import assert from "node:assert/strict";
import { buildCandidateExposureUnexpectedDivergenceDiagnostics } from "../lib/candidate-exposure-policy-divergence-diagnostics.js";

const legacyExecution = {
  receivers: [
    {
      productId: "candidate-a",
      baselineExposureGroup: "primary_candidate",
      futureExposureGroup: "unchanged"
    },
    {
      productId: "candidate-b",
      baselineExposureGroup: "hidden_candidate",
      futureExposureGroup: "unchanged"
    },
    {
      productId: "candidate-c",
      baselineExposureGroup: "primary_candidate",
      futureExposureGroup: "unchanged"
    }
  ]
};

const decisions = [
  {
    candidateRef: "candidate-a",
    exposure: "hidden",
    reasonCodes: ["canonical_goal_match"]
  },
  {
    candidateRef: "candidate-b",
    exposure: "hidden",
    reasonCodes: ["canonical_goal_match"]
  },
  {
    candidateRef: "candidate-c",
    exposure: "hidden",
    reasonCodes: ["stabilization_active_block"]
  }
];

const diagnostics = buildCandidateExposureUnexpectedDivergenceDiagnostics({
  decisions,
  legacyExecution
});

assert.deepEqual(diagnostics, {
  schemaVersion: "candidate-exposure-policy-divergence-diagnostics-v1",
  unexpectedDivergenceCount: 1,
  transitionCounts: {
    "primary>hidden|canonical_goal_match": 1
  }
});

const reversed = buildCandidateExposureUnexpectedDivergenceDiagnostics({
  decisions: [...decisions].reverse(),
  legacyExecution
});
assert.deepEqual(reversed, diagnostics);

const serialized = JSON.stringify(diagnostics);
for (const forbidden of ["candidate-a", "candidate-b", "candidate-c", "productId", "candidateRef"]) {
  assert.equal(serialized.includes(forbidden), false, forbidden);
}

console.log("check-candidate-exposure-policy-divergence-diagnostics: PASS");
