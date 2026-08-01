import {
  CANDIDATE_EXPOSURE_POLICY_VERSION,
  buildCandidateLaneEligibility,
  validateCandidateExposureDecision
} from "./candidate-exposure-policy-contract.js";
import { runCandidateExposureEvaluatorAdapter } from "./candidate-exposure-policy-evaluator-adapter.js";
import { resolveProductFunctionalProfile } from "./product-functional-profile.js";

const ACTIVE_AXES = new Set(["exfoliation", "acne_care", "tone_care", "wrinkle_care"]);
const REASON_ORDER = new Map([
  "invalid_context",
  "current_findings_missing",
  "current_findings_invalid",
  "usage_unknown",
  "product_not_evaluable",
  "metadata_incomplete",
  "protection_evidence_incomplete",
  "irritation_risk",
  "stabilization_active_block",
  "expansion_prohibited",
  "already_using",
  "duplicate_axis",
  "replacement_intent_unknown",
  "partial_context",
  "missing_step",
  "protection_maintained",
  "canonical_goal_match"
].map((reason, index) => [reason, index]));

function candidateRef(product, index) {
  return String(product?.id || product?.productId || product?.product_id || "").trim() || `candidate_${index + 1}`;
}

function sortedReasons(reasons) {
  return Array.from(new Set(reasons)).sort(
    (left, right) => (REASON_ORDER.get(left) ?? 999) - (REASON_ORDER.get(right) ?? 999) ||
      left.localeCompare(right, "en")
  );
}

function normalizeFindings(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { state: input == null ? "missing" : "invalid", findings: [] };
  }
  if (!Array.isArray(input.findings) || !input.summary || typeof input.summary !== "object") {
    return { state: "invalid", findings: [] };
  }
  if (input.findings.some((finding) => !finding || typeof finding !== "object")) {
    return { state: "invalid", findings: [] };
  }
  const unknownCount = input.findings.filter(
    (finding) => ["unanswered", "not_in_db"].includes(finding.sourceState) ||
      finding.relationToPlan === "not_evaluable"
  ).length;
  return {
    state: unknownCount > 0 && unknownCount < input.findings.length ? "partial" : "valid",
    findings: input.findings
  };
}

function validateCanonicalState(canonicalState) {
  const context = canonicalState?.decisionBundle?.context;
  const functionalPolicy = canonicalState?.functionalPolicy;
  const consistency = canonicalState?.consistency;
  const valid = Boolean(
    context &&
    typeof context.version === "string" &&
    functionalPolicy &&
    typeof functionalPolicy.version === "string" &&
    consistency &&
    typeof consistency.version === "string" &&
    typeof functionalPolicy.functionalDirection === "string"
  );
  return { valid, context, functionalPolicy, consistency };
}

function hasAxis(profile, direction) {
  return Array.isArray(profile?.functionalAxes) &&
    profile.functionalAxes.some((axis) => axis?.axis === direction);
}

function isActive(profile) {
  return Array.isArray(profile?.functionalAxes) &&
    profile.functionalAxes.some((axis) => ACTIVE_AXES.has(axis?.axis));
}

function sameProductFinding(findings, ref) {
  return findings.find(
    (finding) => finding?.sourceState === "selected" && String(finding?.productId || "") === ref
  );
}

function relationFor({ findingsState, findings, ref, profile, direction }) {
  if (findingsState === "missing" || findingsState === "invalid") return "not_evaluable";
  if (sameProductFinding(findings, ref)) return "same_product";
  if (findingsState === "partial") return "different_axis";
  if (findings.some((finding) => finding?.sourceState === "unanswered")) return "unknown_usage";
  if (
    findings.some((finding) =>
      finding?.sourceState === "not_in_db" || finding?.relationToPlan === "not_evaluable"
    )
  ) return "not_evaluable";
  if (
    findings.some((finding) =>
      finding?.sourceState === "not_using" || finding?.relationToPlan === "empty_slot"
    )
  ) return "empty_slot";
  if (
    hasAxis(profile, direction) &&
    findings.some((finding) =>
      ["supports_goal", "duplicate_axis"].includes(finding?.relationToPlan)
    )
  ) return "same_axis";
  if (findings.length) return "different_axis";
  return "none";
}

function overrideForCanonicalSemantics({
  baseExposure,
  canonical,
  findingsState,
  findings,
  product,
  ref,
  profile
}) {
  const { context, functionalPolicy, consistency } = canonical;
  const reasons = [];
  let exposure = baseExposure;
  let evidenceState = "complete";
  const relation = relationFor({
    findingsState,
    findings,
    ref,
    profile,
    direction: functionalPolicy.functionalDirection
  });
  const candidateActive = isActive(profile);
  const metadataIncomplete = profile?.evaluable === false ||
    !Array.isArray(profile?.functionalAxes) ||
    profile.functionalAxes.length === 0;
  const irritationRisk = String(product?.irritation_risk || "").toLowerCase();
  const sensitivityHigh = context?.safetyState?.sensitiveBurden === true ||
    functionalPolicy?.safety?.level === "stabilize_first";
  const protectionCandidate = profile?.categoryRole === "protection" ||
    hasAxis(profile, "sunscreen_protection");
  const protectionIncomplete = protectionCandidate &&
    Array.isArray(profile?.cautionTags) &&
    profile.cautionTags.includes("sunscreen_metadata_incomplete");

  if (findingsState === "missing") {
    return {
      exposure: "insufficient_evidence",
      reasons: ["current_findings_missing"],
      relation,
      evidenceState: "invalid"
    };
  }
  if (findingsState === "invalid") {
    return {
      exposure: "insufficient_evidence",
      reasons: ["current_findings_invalid"],
      relation,
      evidenceState: "invalid"
    };
  }
  if (metadataIncomplete) {
    exposure = "insufficient_evidence";
    reasons.push("metadata_incomplete");
    evidenceState = "insufficient";
  }
  if (protectionIncomplete && functionalPolicy?.safety?.protectionMustMaintain) {
    exposure = "insufficient_evidence";
    reasons.push("protection_evidence_incomplete");
    evidenceState = "insufficient";
  } else if (protectionCandidate && functionalPolicy?.safety?.protectionMustMaintain) {
    reasons.push("protection_maintained");
  }
  if (sensitivityHigh && irritationRisk === "high") {
    exposure = "hidden";
    reasons.push("irritation_risk");
  }
  if (candidateActive && (
    functionalPolicy?.planMode === "HOLD" ||
    functionalPolicy?.recommendationSuppressed === true ||
    consistency?.effectivePolicySource === "stabilization_fallback"
  )) {
    exposure = "hidden";
    reasons.push("stabilization_active_block");
  } else if (candidateActive && functionalPolicy?.safety?.activeExpansionAllowed === false) {
    exposure = "hidden";
    reasons.push("expansion_prohibited");
  }

  if (relation === "same_product") {
    exposure = "hidden";
    reasons.push("already_using");
  } else if (relation === "same_axis" && !["hidden", "insufficient_evidence"].includes(exposure)) {
    exposure = exposure === "collapsed" ? "collapsed" : "contextual";
    reasons.push("duplicate_axis", "replacement_intent_unknown");
  } else if (relation === "empty_slot") {
    reasons.push("missing_step");
  } else if (relation === "unknown_usage") {
    exposure = "insufficient_evidence";
    reasons.push("usage_unknown");
    evidenceState = "insufficient";
  } else if (relation === "not_evaluable") {
    exposure = "insufficient_evidence";
    reasons.push("product_not_evaluable");
    evidenceState = "insufficient";
  } else if (findingsState === "partial") {
    if (!["hidden", "insufficient_evidence"].includes(exposure)) exposure = "contextual";
    reasons.push("partial_context");
    evidenceState = "partial";
  }

  if (!reasons.length || !["hidden", "insufficient_evidence"].includes(exposure)) {
    reasons.push("canonical_goal_match");
  }

  return { exposure, reasons, relation, evidenceState };
}

function decisionForInvalidContext(product, index, canonical) {
  const exposure = "insufficient_evidence";
  return {
    policyVersion: CANDIDATE_EXPOSURE_POLICY_VERSION,
    candidateRef: candidateRef(product, index),
    exposure,
    reasonCodes: ["invalid_context"],
    currentProductRelation: "not_evaluable",
    evidenceState: "invalid",
    laneEligibility: buildCandidateLaneEligibility(exposure),
    provenance: {
      policy: CANDIDATE_EXPOSURE_POLICY_VERSION,
      adapterExposure: exposure,
      contextVersion: String(canonical?.context?.version || "invalid"),
      functionalPolicyVersion: String(canonical?.functionalPolicy?.version || "invalid"),
      consistencyVersion: String(canonical?.consistency?.version || "invalid")
    }
  };
}

export function evaluateCandidateExposurePolicy({
  canonicalState,
  candidates
} = {}) {
  const products = Array.isArray(candidates) ? candidates : [];
  const canonical = validateCanonicalState(canonicalState);

  if (!canonical.valid) {
    return {
      policyVersion: CANDIDATE_EXPOSURE_POLICY_VERSION,
      status: "invalid_canonical_input",
      decisions: products.map((product, index) => decisionForInvalidContext(product, index, canonical))
    };
  }

  const findingsResult = normalizeFindings(canonicalState.currentProductFindings);
  const adapter = runCandidateExposureEvaluatorAdapter({
    products,
    sharedContext: canonical.context,
    functionalPolicy: canonical.functionalPolicy,
    currentProductFindings: canonicalState.currentProductFindings
  });
  const duplicateRefs = new Set();
  const seenRefs = new Set();
  products.forEach((product, index) => {
    const ref = candidateRef(product, index);
    if (seenRefs.has(ref)) duplicateRefs.add(ref);
    seenRefs.add(ref);
  });

  const decisions = products.map((product, index) => {
    const ref = candidateRef(product, index);
    const profile = resolveProductFunctionalProfile(product);
    const adapterRow = adapter.rows[index] || { exposure: "insufficient_evidence" };
    const resolved = duplicateRefs.has(ref)
      ? {
          exposure: "insufficient_evidence",
          reasons: ["invalid_context"],
          relation: "not_evaluable",
          evidenceState: "invalid"
        }
      : overrideForCanonicalSemantics({
          baseExposure: adapterRow.exposure,
          canonical,
          findingsState: findingsResult.state,
          findings: findingsResult.findings,
          product,
          ref,
          profile
        });
    const decision = {
      policyVersion: CANDIDATE_EXPOSURE_POLICY_VERSION,
      candidateRef: ref,
      exposure: resolved.exposure,
      reasonCodes: sortedReasons(resolved.reasons),
      currentProductRelation: resolved.relation,
      evidenceState: resolved.evidenceState,
      laneEligibility: buildCandidateLaneEligibility(resolved.exposure, {
        treatmentEligible: profile?.categoryRole === "functional_leave_on"
      }),
      provenance: {
        policy: CANDIDATE_EXPOSURE_POLICY_VERSION,
        adapterExposure: adapterRow.exposure,
        contextVersion: canonical.context.version,
        functionalPolicyVersion: canonical.functionalPolicy.version,
        consistencyVersion: canonical.consistency.version
      }
    };
    const validation = validateCandidateExposureDecision(decision);
    if (!validation.valid) {
      throw new Error("candidate_exposure_contract_invalid");
    }
    return decision;
  });

  return {
    policyVersion: CANDIDATE_EXPOSURE_POLICY_VERSION,
    status: "evaluated",
    decisions,
    evaluatorExecution: adapter.execution
  };
}
