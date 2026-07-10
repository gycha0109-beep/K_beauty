import assert from "node:assert/strict";
import { buildFunctionalCandidatePolicy } from "../lib/functional-candidate-policy.js";

const CANDIDATES = {
  topPick: { id: "top" },
  supportingProducts: [{ id: "support-1" }, { id: "support-2" }],
  budgetAlternatives: [{ id: "budget-1" }]
};

function policy(input) {
  return buildFunctionalCandidatePolicy({
    candidates: CANDIDATES,
    ...input
  });
}

function assertPolicy(name, input, expected) {
  const result = policy(input);

  Object.entries(expected).forEach(([key, value]) => {
    assert.equal(result[key], value, `${name}: expected ${key} to be ${value}`);
  });

  assert.ok(result.reason, `${name}: reason exists`);
  assert.equal(typeof result.maxVisibleCandidates, "number", `${name}: maxVisibleCandidates is number`);

  return result;
}

assertPolicy(
  "suppressed",
  { decision: { recommendationSuppressed: true, suppressionReason: "sensitivity_barrier" }, findings: [] },
  {
    visibility: "hidden",
    intent: "stabilize_first",
    maxVisibleCandidates: 0
  }
);

assertPolicy(
  "duplicate axis",
  {
    decision: { recommendationSuppressed: false },
    findings: [{ sourceState: "selected", relationToPlan: "duplicate_axis" }]
  },
  {
    visibility: "collapsed",
    intent: "stabilize_first",
    maxVisibleCandidates: 1
  }
);

assertPolicy(
  "supports goal",
  {
    decision: { recommendationSuppressed: false },
    findings: [{ sourceState: "selected", relationToPlan: "supports_goal" }]
  },
  {
    visibility: "collapsed",
    intent: "keep_current",
    maxVisibleCandidates: 1
  }
);

assertPolicy(
  "selected different goal",
  {
    decision: { recommendationSuppressed: false },
    findings: [
      { sourceState: "selected", relationToPlan: "different_goal" },
      { sourceState: "selected", relationToPlan: "different_goal" }
    ]
  },
  {
    visibility: "limited",
    intent: "add_missing_step",
    maxVisibleCandidates: 1
  }
);

assertPolicy(
  "not in db",
  {
    decision: { recommendationSuppressed: false },
    findings: [{ sourceState: "not_in_db", relationToPlan: "not_evaluable" }]
  },
  {
    visibility: "collapsed",
    intent: "review_uncertain",
    maxVisibleCandidates: 1
  }
);

assertPolicy(
  "not using",
  {
    decision: { recommendationSuppressed: false },
    findings: [{ sourceState: "not_using", relationToPlan: "empty_slot" }]
  },
  {
    visibility: "visible",
    intent: "add_missing_step",
    maxVisibleCandidates: 3
  }
);

assertPolicy(
  "unanswered only",
  {
    decision: { recommendationSuppressed: false },
    findings: [{ sourceState: "unanswered", relationToPlan: "unknown_usage" }]
  },
  {
    visibility: "collapsed",
    intent: "review_uncertain",
    maxVisibleCandidates: 1
  }
);

assertPolicy(
  "no findings",
  { decision: { recommendationSuppressed: false }, findings: [] },
  {
    visibility: "collapsed",
    intent: "review_uncertain",
    maxVisibleCandidates: 1
  }
);

const noCandidates = buildFunctionalCandidatePolicy({
  decision: { recommendationSuppressed: false },
  findings: [{ sourceState: "not_using", relationToPlan: "empty_slot" }]
});
assert.equal(noCandidates.visibility, "visible", "no candidates still returns policy visibility");
assert.equal(noCandidates.maxVisibleCandidates, 0, "no candidates max is 0");
assert.deepEqual(noCandidates.candidateGroups, {}, "no candidates returns empty groups");

console.log("verify-functional-candidate-policy: ok");
