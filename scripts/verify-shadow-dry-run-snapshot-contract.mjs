import assert from "node:assert/strict";
import {
  ALLOWED_SNAPSHOT_FIELDS,
  FORBIDDEN_SNAPSHOT_FIELDS,
  SHADOW_DRY_RUN_SNAPSHOT_CONTRACT_VERSION,
  buildBaselineRecommendationSnapshot,
  buildBaselineResponseShapeSnapshot,
  buildShadowBoundaryHintSnapshot,
  buildShadowComparisonSnapshot,
  buildShadowReceiverSnapshot,
  validateShadowDryRunSnapshot
} from "../lib/shadow-dry-run-snapshot-contract.js";

function assertValid(snapshot, message) {
  const result = validateShadowDryRunSnapshot(snapshot);
  assert.equal(result.valid, true, `${message}: ${JSON.stringify(result.errors)}`);
  assert.equal(result.summary.runtimeConnected, false);
  assert.equal(result.summary.routeInvoked, false);
  assert.equal(result.summary.supabaseWriteExecuted, false);
  assert.equal(result.summary.runtimeMutation, false);
  return result;
}

function assertInvalidWithCode(snapshot, code) {
  const result = validateShadowDryRunSnapshot(snapshot);
  assert.equal(result.valid, false, `${code} sample should fail`);
  assert(
    result.errors.some((error) => error.code === code),
    `expected ${code}, got ${result.errors.map((error) => error.code).join(", ")}`
  );
  return result;
}

assert.equal(typeof SHADOW_DRY_RUN_SNAPSHOT_CONTRACT_VERSION, "string");
assert(ALLOWED_SNAPSHOT_FIELDS.baselineResponseShapeSnapshot.includes("responseShapeHash"));
assert(ALLOWED_SNAPSHOT_FIELDS.baselineRecommendationSnapshot.includes("supportingProductIdsInOrder"));
assert(FORBIDDEN_SNAPSHOT_FIELDS.includes("brand"));
assert(FORBIDDEN_SNAPSHOT_FIELDS.includes("purchase_url"));
assert(FORBIDDEN_SNAPSHOT_FIELDS.includes("full_api_response_body"));

const responseShape = buildBaselineResponseShapeSnapshot({
  summary: "string-value-not-stored",
  topPick: { id: "top-1", hiddenValue: "not-stored" },
  morning: [{ id: "morning-1" }],
  night: [{ id: "night-1" }]
});
assertValid(responseShape, "baseline response shape snapshot should pass");
assert.equal(responseShape.valueDumped, false);
assert.equal(Object.prototype.hasOwnProperty.call(responseShape, "summary"), false);

assertInvalidWithCode(
  {
    ...responseShape,
    fullApiResponseBody: { topPick: { id: "top-1" } }
  },
  "forbidden_field_present"
);

const recommendation = buildBaselineRecommendationSnapshot({
  topPick: { id: "top-1", name: "not-output" },
  supportingProducts: [{ id: "support-1" }, { id: "support-2" }],
  budgetAlternatives: [{ id: "budget-1" }]
});
assertValid(recommendation, "baseline recommendation snapshot should pass");
assert.deepEqual(recommendation.supportingProductIdsInOrder, ["support-1", "support-2"]);
assert.equal(Object.prototype.hasOwnProperty.call(recommendation, "name"), false);

assertInvalidWithCode(
  {
    ...recommendation,
    brand: "forbidden"
  },
  "forbidden_field_present"
);
assertInvalidWithCode(
  {
    ...recommendation,
    purchaseUrl: "https://example.invalid/product"
  },
  "forbidden_field_present"
);

const boundary = buildShadowBoundaryHintSnapshot([
  {
    productId: "p-1",
    category: "serum",
    sourceHardFilterReason: "recent_instability_active_limited",
    boundaryDecision: "downgrade_to_collapsed_candidate",
    futureEvaluatorAction: "pass_with_collapsed_hint",
    candidatePolicyHint: "collapsed_candidate_hint",
    safetyMetadataClass: "safe_low_risk",
    reasonKeys: ["low_irritation_risk", "sensitivity_safe_true"]
  }
]);
assertValid(boundary, "boundary hint snapshot should pass");

const receiver = buildShadowReceiverSnapshot([
  {
    productId: "p-1",
    category: "serum",
    receivedHint: "collapsed_candidate_hint",
    receiverDecision: "accept_collapsed_candidate_hint",
    futureExposureGroup: "collapsed_candidate",
    visibilityPriority: "collapsed",
    userMessageType: "stabilize_first_context",
    safetyMetadataClass: "safe_low_risk",
    reasonKeys: ["low_irritation_risk"]
  }
]);
assertValid(receiver, "receiver snapshot should pass");
assert.equal(receiver.aggregate.highRiskCollapsedReceiverCount, 0);

assertInvalidWithCode(
  {
    ...receiver,
    receivers: [
      {
        ...receiver.receivers[0],
        productName: "forbidden"
      }
    ]
  },
  "forbidden_field_present"
);

const comparison = buildShadowComparisonSnapshot({
  baselineResponseShapeSnapshot: responseShape,
  baselineRecommendationSnapshot: recommendation,
  shadowBoundaryHintSnapshot: boundary,
  shadowReceiverSnapshot: receiver
});
assertValid(comparison, "comparison snapshot should pass");
assert.equal(comparison.killConditionTriggered, false);
assert.equal(comparison.recommendationChanged, false);

const highRiskReceiver = buildShadowReceiverSnapshot([
  {
    productId: "p-2",
    category: "treatment",
    receivedHint: "collapsed_candidate_hint",
    receiverDecision: "accept_collapsed_candidate_hint",
    futureExposureGroup: "collapsed_candidate",
    visibilityPriority: "collapsed",
    userMessageType: "stabilize_first_context",
    safetyMetadataClass: "unsafe_high_risk",
    reasonKeys: ["high_irritation_risk"]
  }
]);
const highRiskComparison = buildShadowComparisonSnapshot({
  baselineResponseShapeSnapshot: responseShape,
  baselineRecommendationSnapshot: recommendation,
  shadowBoundaryHintSnapshot: boundary,
  shadowReceiverSnapshot: highRiskReceiver
});
assertValid(highRiskComparison, "high-risk comparison snapshot remains structurally valid");
assert.equal(highRiskComparison.highRiskCollapsedReceiverCount, 1);
assert.equal(highRiskComparison.killConditionTriggered, true);
assert(highRiskComparison.killConditionReasons.includes("high_risk_collapsed_receiver_count_not_zero"));

const missingRequired = { ...recommendation };
delete missingRequired.topPickId;
assertInvalidWithCode(missingRequired, "missing_required_field");

assertInvalidWithCode(
  {
    ...comparison,
    runtimeConnected: true
  },
  "runtime_connected_not_false"
);

const first = validateShadowDryRunSnapshot(
  buildShadowComparisonSnapshot({
    baselineResponseShapeSnapshot: responseShape,
    baselineRecommendationSnapshot: recommendation,
    shadowBoundaryHintSnapshot: boundary,
    shadowReceiverSnapshot: receiver
  })
);
const second = validateShadowDryRunSnapshot(
  buildShadowComparisonSnapshot({
    baselineResponseShapeSnapshot: responseShape,
    baselineRecommendationSnapshot: recommendation,
    shadowBoundaryHintSnapshot: boundary,
    shadowReceiverSnapshot: receiver
  })
);
assert.deepEqual(first, second, "snapshot validation should be deterministic");

console.log("verify-shadow-dry-run-snapshot-contract passed");
