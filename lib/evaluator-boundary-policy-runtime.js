import { buildEvaluatorBoundaryPolicyExecution } from "./evaluator-boundary-policy-shadow.js";

const EXPECTED_RECEIVER_RESULTS = new Map([
  ["accept_collapsed_candidate_hint", "collapsed_candidate"],
  ["preserve_hidden_candidate", "hidden_candidate"],
  ["route_to_insufficient_evidence", "insufficient_evidence_candidate"],
  ["keep_existing_exposure", "unchanged"]
]);

function productId(product) {
  return String(product?.id || product?.productId || product?.product_id || "").trim() || null;
}

function countBy(items, key) {
  return items.reduce((counts, item) => {
    const value = item?.[key] || "unknown";
    counts[value] = (counts[value] || 0) + 1;
    return counts;
  }, {});
}

function hasSafetyViolation(violationCounts = {}) {
  return [
    "highRiskCollapsed",
    "sensitivityUnsafeAccepted",
    "metadataIncompleteAccepted",
    "strongCautionAccepted",
    "activeOnlyViolation"
  ].some((key) => Number(violationCounts[key] || 0) > 0);
}

function receiverIsExpected(receiver) {
  return receiver && EXPECTED_RECEIVER_RESULTS.get(receiver.receiverDecision) === receiver.futureExposureGroup;
}

export function buildEvaluatorBoundaryPolicyRuntime({
  products,
  surveyContract = {},
  goalPolicy = {},
  currentProductFindings = null
} = {}) {
  const execution = buildEvaluatorBoundaryPolicyExecution({
    products,
    surveyContract,
    goalPolicy,
    currentProductFindings,
    runtimeConnected: true
  });
  const receiversByProductId = new Map(execution.receivers.map((receiver) => [receiver.productId, receiver]));
  const exposureRows = (Array.isArray(products) ? products : []).map((product) => {
    const id = productId(product);
    const receiver = receiversByProductId.get(id);

    if (!receiverIsExpected(receiver)) {
      return {
        productId: id,
        baselineExposureGroup: "unchanged",
        appliedExposureGroup: "hidden_candidate",
        receiverDecision: receiver?.receiverDecision || "not_applicable",
        applied: true,
        rejectionReason: "unexpected_receiver_result"
      };
    }

    return {
      productId: id,
      baselineExposureGroup: "unchanged",
      appliedExposureGroup: receiver.futureExposureGroup,
      receiverDecision: receiver.receiverDecision,
      applied: receiver.futureExposureGroup !== "unchanged",
      rejectionReason: receiver.futureExposureGroup === "unchanged" ? null : receiver.receiverDecision
    };
  });
  const runtimeBlocked = hasSafetyViolation(execution.violationCounts);
  const unexpectedReceiverCount = exposureRows.filter(
    (row) => row.rejectionReason === "unexpected_receiver_result"
  ).length;
  const visibleCandidateIds = runtimeBlocked
    ? []
    : exposureRows
      .filter((row) => row.appliedExposureGroup === "unchanged")
      .map((row) => row.productId)
      .filter(Boolean);

  return {
    evidenceType: "evaluator_boundary_policy_runtime",
    runtimeConnected: true,
    policyApplicationStatus: runtimeBlocked ? "blocked_safety_violation" : "applied",
    candidateCounts: {
      before: exposureRows.length,
      after: visibleCandidateIds.length,
      removed: exposureRows.length - visibleCandidateIds.length
    },
    unexpectedReceiverCount,
    rejectionReasonCounts: countBy(exposureRows.filter((row) => row.rejectionReason), "rejectionReason"),
    exposureGroupCounts: countBy(exposureRows, "appliedExposureGroup"),
    visibleCandidateIds,
    exposureRows,
    boundaryHints: execution.boundaryHints,
    receivers: execution.receivers,
    violationCounts: execution.violationCounts
  };
}
