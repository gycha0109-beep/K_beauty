import { resolveCandidatePolicyHintReceiver } from "./candidate-policy-hint-receiver-contract.js";
import {
  resolveCandidatePolicyRuntimeSafetyGate,
  validateCandidatePolicyRuntimeSafetyContext
} from "./candidate-policy-runtime-safety.js";
import { resolveEvaluatorBoundaryCollapsedHint } from "./evaluator-boundary-collapsed-hint-contract.js";
import { resolveEvaluatorRecentInstabilityBoundaryPolicy } from "./evaluator-recent-instability-boundary-policy.js";
import { resolveFunctionalGuardExposurePolicy } from "./functional-guard-exposure-policy.js";
import { evaluateFunctionalRankingCandidate } from "./functional-ranking-contract.js";
import { resolveProductFunctionalProfile } from "./product-functional-profile.js";
import { resolveRecentInstabilityGuardPolicy } from "./recent-instability-guard-policy.js";

const ACTIVE_AXES = new Set(["exfoliation", "acne_care", "tone_care", "wrinkle_care"]);
const STABILIZING_AXES = new Set(["hydration", "moisture_lock", "barrier_support", "soothing"]);

function productId(product) {
  return String(product?.id || product?.productId || product?.product_id || "").trim() || null;
}

function categoryOf(product) {
  return String(product?.category || "").trim().toLowerCase() || "unknown";
}

function safetyMetadataClass(product, profile) {
  const risk = String(product?.irritation_risk || "").trim().toLowerCase();
  const safe = typeof product?.sensitivity_safe === "boolean" ? product.sensitivity_safe : null;
  const profileComplete = profile?.evaluable !== false && Array.isArray(profile?.functionalAxes) && profile.functionalAxes.length > 0;

  if (!risk || safe == null || !profileComplete) return "metadata_incomplete";
  if (safe && risk === "low") return "safe_low_risk";
  if (safe && risk === "medium") return "safe_medium_risk";
  if (!safe && risk === "high") return "unsafe_high_risk";
  return "mixed_or_uncertain";
}

function functionalProfile(profile) {
  const axes = Array.isArray(profile?.functionalAxes) ? profile.functionalAxes : [];
  const active = axes.some((axis) => ACTIVE_AXES.has(axis?.axis));
  const stabilizing = axes.some((axis) => STABILIZING_AXES.has(axis?.axis));
  if (active && stabilizing) return "mixed";
  if (active) return "active_leaning";
  if (stabilizing) return "stabilizing_leaning";
  return "unknown";
}

function activeOnlyExpectedExposure(boundaryPolicyResult, metadataClass) {
  const context = boundaryPolicyResult?.policyContext || {};
  if (!boundaryPolicyResult?.applies || !context.activeAxisPresent || context.stabilizingAxisPresent) return null;
  if (metadataClass === "metadata_incomplete") return "insufficient_evidence_candidate";
  if (context.irritationRisk === "high" || context.sensitivitySafe === false || context.strongCautionSignal) {
    return "hidden_candidate";
  }
  return "collapsed_candidate";
}

function increment(counts, key) {
  const normalized = key || "unknown";
  counts[normalized] = (counts[normalized] || 0) + 1;
}

function applyCandidateSafetyGate(receiverResult, safetyGate) {
  if (safetyGate.allowed) {
    return {
      ...receiverResult,
      safetyGateApplied: false,
      safetyGateReason: null,
      safetyGateVersion: safetyGate.version
    };
  }
  const insufficient = safetyGate.exposureGroup === "insufficient_evidence_candidate";
  return {
    ...receiverResult,
    applies: true,
    receiverDecision: insufficient
      ? "route_to_insufficient_evidence"
      : "preserve_hidden_candidate",
    futureExposureGroup: safetyGate.exposureGroup,
    visibilityPriority: insufficient ? "reduced" : "hidden",
    userMessageType: insufficient
      ? "insufficient_evidence_notice"
      : "hard_safety_guard_notice",
    reasons: Array.from(new Set([
      ...(Array.isArray(receiverResult.reasons) ? receiverResult.reasons : []),
      ...safetyGate.reasonCodes
    ])).sort(),
    safetyGateApplied: true,
    safetyGateReason: safetyGate.reasonCode,
    safetyGateVersion: safetyGate.version
  };
}

function emptyResult(runtimeConnected, candidateSafetyContext) {
  const safetyContextValidation =
    validateCandidatePolicyRuntimeSafetyContext(candidateSafetyContext);
  return {
    evidenceType: runtimeConnected
      ? "evaluator_boundary_policy_runtime_execution"
      : "evaluator_boundary_policy_shadow_execution",
    runtimeConnected,
    candidateCount: 0,
    boundaryApplicableCount: 0,
    safetyContextValid: safetyContextValidation.valid,
    safetyContextVersion: candidateSafetyContext?.version || null,
    safetyPolicyVersion: candidateSafetyContext?.policyVersion || null,
    safetyBlockReasonCounts: {},
    safetyBlockCategoryCounts: {},
    safetyBlockFunctionalAxisCounts: {},
    boundaryHints: [],
    receivers: [],
    violationCounts: {
      highRiskCollapsed: 0,
      sensitivityUnsafeAccepted: 0,
      metadataIncompleteAccepted: 0,
      strongCautionAccepted: 0,
      activeOnlyViolation: 0,
      sunscreenProtectionFailOpen: 0,
      stabilizationActiveExpansionFailOpen: 0,
      canonicalSafetyContextMissing: safetyContextValidation.valid ? 0 : 1
    }
  };
}

export function buildEvaluatorBoundaryPolicyExecution({
  products,
  surveyContract = {},
  goalPolicy = {},
  currentProductFindings = null,
  candidateSafetyContext = null,
  runtimeConnected = false
} = {}) {
  const result = emptyResult(runtimeConnected === true, candidateSafetyContext);

  for (const product of Array.isArray(products) ? products : []) {
    if (!product || typeof product !== "object") continue;

    const profile = resolveProductFunctionalProfile(product);
    const candidateEvaluation = evaluateFunctionalRankingCandidate({
      product,
      surveyContract,
      goalPolicy,
      productProfile: profile,
      currentProductFindings
    });
    const recentInstabilityGuardPolicy = resolveRecentInstabilityGuardPolicy({
      surveySafety: surveyContract.safety || {},
      goalPolicy,
      product,
      productProfile: profile
    });
    const currentExposureDecision = resolveFunctionalGuardExposurePolicy({
      candidateEvaluation,
      recentInstabilityGuardPolicy,
      goalPolicy
    });
    const boundaryPolicyResult = resolveEvaluatorRecentInstabilityBoundaryPolicy({
      candidateEvaluation,
      surveySafety: surveyContract.safety || {},
      goalPolicy,
      product,
      productProfile: profile
    });
    const metadataClass = safetyMetadataClass(product, profile);
    const collapsedHintResult = resolveEvaluatorBoundaryCollapsedHint({
      candidateEvaluation,
      boundaryPolicyResult,
      exposureContext: {
        currentExposureStatus: currentExposureDecision.exposureStatus,
        safetyMetadataProfile: metadataClass,
        functionalProfile: functionalProfile(profile),
        category: categoryOf(product),
        strongCautionSignal: boundaryPolicyResult.policyContext?.strongCautionSignal === true
      }
    });
    const baseReceiverResult = resolveCandidatePolicyHintReceiver({
      candidateEvaluation,
      collapsedHintResult,
      currentExposureDecision,
      guardExposurePolicy: {
        ...currentExposureDecision,
        safetyMetadataProfile: metadataClass,
        strongCautionSignal: boundaryPolicyResult.policyContext?.strongCautionSignal === true,
        policyContext: {
          ...currentExposureDecision.policyContext,
          ...boundaryPolicyResult.policyContext,
          safetyMetadataProfile: metadataClass
        }
      }
    });
    const safetyGate = resolveCandidatePolicyRuntimeSafetyGate({
      product,
      productProfile: profile,
      candidateSafetyContext
    });
    const receiverResult = applyCandidateSafetyGate(baseReceiverResult, safetyGate);
    const expectedActiveOnlyExposure = activeOnlyExpectedExposure(boundaryPolicyResult, metadataClass);
    const collapsedAccepted = receiverResult.futureExposureGroup === "collapsed_candidate";
    const sensitivityUnsafe = boundaryPolicyResult.policyContext?.sensitivitySafe === false;
    const strongCautionSignal = boundaryPolicyResult.policyContext?.strongCautionSignal === true;

    result.candidateCount += 1;
    if (boundaryPolicyResult.applies) result.boundaryApplicableCount += 1;
    if (!safetyGate.allowed) {
      increment(result.safetyBlockReasonCounts, safetyGate.reasonCode);
      increment(result.safetyBlockCategoryCounts, categoryOf(product));
      for (const axis of safetyGate.functionalAxes) {
        increment(result.safetyBlockFunctionalAxisCounts, axis);
      }
    }
    result.boundaryHints.push({
      productId: productId(product),
      category: categoryOf(product),
      sourceHardFilterReason: collapsedHintResult.sourceHardFilterReason,
      boundaryDecision: collapsedHintResult.boundaryDecision,
      futureEvaluatorAction: collapsedHintResult.futureEvaluatorAction,
      candidatePolicyHint: collapsedHintResult.candidatePolicyHint,
      safetyMetadataClass: metadataClass,
      safetyGateApplied: !safetyGate.allowed,
      safetyGateReason: safetyGate.reasonCode,
      reasonKeys: collapsedHintResult.reasons,
      runtimeConnected: result.runtimeConnected
    });
    result.receivers.push({
      productId: productId(product),
      category: categoryOf(product),
      receivedHint: receiverResult.receivedHint,
      receiverDecision: receiverResult.receiverDecision,
      futureExposureGroup: receiverResult.futureExposureGroup,
      visibilityPriority: receiverResult.visibilityPriority,
      userMessageType: receiverResult.userMessageType,
      safetyMetadataClass: metadataClass,
      sensitivityUnsafe,
      strongCautionSignal,
      activeOnlyViolation: safetyGate.allowed &&
        expectedActiveOnlyExposure !== null &&
        receiverResult.futureExposureGroup !== expectedActiveOnlyExposure,
      safetyGateApplied: !safetyGate.allowed,
      safetyGateReason: safetyGate.reasonCode,
      reasonKeys: receiverResult.reasons,
      runtimeConnected: result.runtimeConnected
    });

    if (collapsedAccepted && (metadataClass === "unsafe_high_risk" || boundaryPolicyResult.policyContext?.irritationRisk === "high")) result.violationCounts.highRiskCollapsed += 1;
    if (collapsedAccepted && sensitivityUnsafe) result.violationCounts.sensitivityUnsafeAccepted += 1;
    if (collapsedAccepted && metadataClass === "metadata_incomplete") result.violationCounts.metadataIncompleteAccepted += 1;
    if (collapsedAccepted && strongCautionSignal) result.violationCounts.strongCautionAccepted += 1;
    if (safetyGate.allowed &&
        expectedActiveOnlyExposure !== null &&
        receiverResult.futureExposureGroup !== expectedActiveOnlyExposure) {
      result.violationCounts.activeOnlyViolation += 1;
    }
    if (safetyGate.sunscreenProtectionApplicable &&
        !safetyGate.sunscreenProtectionReady &&
        receiverResult.futureExposureGroup === "unchanged") {
      result.violationCounts.sunscreenProtectionFailOpen += 1;
    }
    if (safetyGate.activeExpansion &&
        candidateSafetyContext?.stabilizationMode === true &&
        candidateSafetyContext?.activeExpansionAllowed === false &&
        receiverResult.futureExposureGroup === "unchanged") {
      result.violationCounts.stabilizationActiveExpansionFailOpen += 1;
    }
  }

  return result;
}

export function buildEvaluatorBoundaryPolicyShadow(input = {}) {
  return buildEvaluatorBoundaryPolicyExecution({
    ...input,
    runtimeConnected: false
  });
}
