import { resolveProductFunctionalProfile } from "./product-functional-profile.js";

export const CANDIDATE_POLICY_RUNTIME_SAFETY_CONTEXT_VERSION =
  "candidate-policy-runtime-safety-context-v1";
export const CANDIDATE_POLICY_RUNTIME_SAFETY_GATE_VERSION =
  "candidate-policy-runtime-safety-gate-v1";

const ACTIVE_EXPANSION_AXES = new Set([
  "exfoliation",
  "acne_care",
  "tone_care",
  "wrinkle_care"
]);
const VALID_UV_FILTER_TYPES = new Set(["mineral", "organic", "hybrid"]);

function normalizeText(value) {
  return String(value ?? "").normalize("NFKC").trim().toLowerCase();
}

function present(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  return true;
}

function unique(values = []) {
  return Array.from(new Set(values.filter(Boolean))).sort();
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function normalizedAxes(profile = {}) {
  return unique(
    (Array.isArray(profile.functionalAxes) ? profile.functionalAxes : [])
      .map((axis) => normalizeText(axis?.axis))
  );
}

export function validateCandidatePolicyRuntimeSafetyContext(context) {
  const errors = [];
  if (!context || typeof context !== "object" || Array.isArray(context)) {
    return { valid: false, errors: ["canonical_safety_context_missing"] };
  }
  if (context.version !== CANDIDATE_POLICY_RUNTIME_SAFETY_CONTEXT_VERSION) {
    errors.push("candidate_safety_context_version_invalid");
  }
  if (context.source !== "canonical_shared_context_functional_policy") {
    errors.push("candidate_safety_context_source_invalid");
  }
  if (!present(context.policyVersion)) errors.push("candidate_safety_policy_version_missing");
  for (const key of [
    "stabilizationMode",
    "recommendationSuppressed",
    "activeExpansionAllowed",
    "protectionRequired"
  ]) {
    if (typeof context[key] !== "boolean") errors.push(`candidate_safety_${key}_invalid`);
  }
  if (!Array.isArray(context.reasonCodes) ||
      context.reasonCodes.some((reason) => !/^[a-z0-9][a-z0-9_:.-]{0,79}$/.test(String(reason)))) {
    errors.push("candidate_safety_reason_codes_invalid");
  }
  return { valid: errors.length === 0, errors };
}

export function buildCandidatePolicyRuntimeSafetyContext({
  sharedContext = {},
  functionalPolicy = {},
  effectivePolicySource = "raw"
} = {}) {
  const safety = functionalPolicy?.safety || sharedContext?.safetyState || {};
  const stabilizationMode = Boolean(
    safety.level === "stabilize_first" ||
    safety.activeExpansionAllowed === false ||
    functionalPolicy.planMode === "HOLD" ||
    functionalPolicy.recommendationSuppressed === true
  );
  const context = {
    version: CANDIDATE_POLICY_RUNTIME_SAFETY_CONTEXT_VERSION,
    source: "canonical_shared_context_functional_policy",
    policyVersion: String(functionalPolicy?.version || "unknown"),
    effectivePolicySource: String(effectivePolicySource || "raw"),
    stabilizationMode,
    recommendationSuppressed: functionalPolicy.recommendationSuppressed === true,
    activeExpansionAllowed: safety.activeExpansionAllowed === true,
    protectionRequired: safety.protectionMustMaintain !== false,
    reasonCodes: unique([
      ...(Array.isArray(safety.reasonCodes) ? safety.reasonCodes : []),
      ...(Array.isArray(functionalPolicy.reasonCodes) ? functionalPolicy.reasonCodes : []),
      ...(stabilizationMode ? ["canonical_stabilization_active"] : []),
      ...(safety.activeExpansionAllowed === false ? ["canonical_active_expansion_blocked"] : []),
      ...(safety.protectionMustMaintain !== false ? ["canonical_protection_required"] : [])
    ])
  };
  const validation = validateCandidatePolicyRuntimeSafetyContext(context);
  if (!validation.valid) {
    throw new Error(`Candidate safety context invalid: ${validation.errors.join(",")}`);
  }
  return deepFreeze(context);
}

export function resolveSunscreenProtectionReadiness(product = {}, productProfile = null) {
  const profile = productProfile || resolveProductFunctionalProfile(product);
  const axes = normalizedAxes(profile);
  const applicable =
    profile?.categoryRole === "protection" ||
    normalizeText(product?.category) === "sunscreen" ||
    axes.includes("sunscreen_protection");
  if (!applicable) {
    return {
      applicable: false,
      ready: true,
      missingFields: [],
      invalidFields: [],
      reasonCodes: []
    };
  }

  const missingFields = [
    ...(!present(product?.spf_value) ? ["spf_value"] : []),
    ...(!present(product?.uva_label) ? ["uva_label"] : []),
    ...(!present(product?.uv_filter_type) ? ["uv_filter_type"] : [])
  ];
  const invalidFields = present(product?.uv_filter_type) &&
    !VALID_UV_FILTER_TYPES.has(normalizeText(product.uv_filter_type))
    ? ["uv_filter_type"]
    : [];
  const ready = missingFields.length === 0 && invalidFields.length === 0;
  return {
    applicable: true,
    ready,
    missingFields,
    invalidFields,
    reasonCodes: ready
      ? []
      : unique([
          "sunscreen_protection_metadata_incomplete",
          ...missingFields.map((field) => `sunscreen_${field}_missing`),
          ...invalidFields.map((field) => `sunscreen_${field}_invalid`)
        ])
  };
}

export function resolveCandidatePolicyRuntimeSafetyGate({
  product = {},
  productProfile = null,
  candidateSafetyContext = null
} = {}) {
  const validation = validateCandidatePolicyRuntimeSafetyContext(candidateSafetyContext);
  const profile = productProfile || resolveProductFunctionalProfile(product);
  const functionalAxes = normalizedAxes(profile);
  const activeExpansion = functionalAxes.some((axis) => ACTIVE_EXPANSION_AXES.has(axis));
  const protection = resolveSunscreenProtectionReadiness(product, profile);

  if (!validation.valid) {
    return {
      version: CANDIDATE_POLICY_RUNTIME_SAFETY_GATE_VERSION,
      allowed: false,
      exposureGroup: "hidden_candidate",
      reasonCode: validation.errors.includes("canonical_safety_context_missing")
        ? "canonical_safety_context_missing"
        : "canonical_safety_context_invalid",
      reasonCodes: unique(validation.errors),
      categoryRole: profile?.categoryRole || "unknown",
      functionalAxes,
      activeExpansion,
      sunscreenProtectionApplicable: protection.applicable,
      sunscreenProtectionReady: protection.ready
    };
  }

  if (candidateSafetyContext.protectionRequired && protection.applicable && !protection.ready) {
    return {
      version: CANDIDATE_POLICY_RUNTIME_SAFETY_GATE_VERSION,
      allowed: false,
      exposureGroup: "insufficient_evidence_candidate",
      reasonCode: "sunscreen_protection_metadata_incomplete",
      reasonCodes: protection.reasonCodes,
      categoryRole: profile?.categoryRole || "unknown",
      functionalAxes,
      activeExpansion,
      sunscreenProtectionApplicable: true,
      sunscreenProtectionReady: false
    };
  }

  if (candidateSafetyContext.stabilizationMode &&
      candidateSafetyContext.activeExpansionAllowed === false &&
      activeExpansion) {
    return {
      version: CANDIDATE_POLICY_RUNTIME_SAFETY_GATE_VERSION,
      allowed: false,
      exposureGroup: "hidden_candidate",
      reasonCode: "stabilization_active_expansion_blocked",
      reasonCodes: ["stabilization_active_expansion_blocked"],
      categoryRole: profile?.categoryRole || "unknown",
      functionalAxes,
      activeExpansion: true,
      sunscreenProtectionApplicable: protection.applicable,
      sunscreenProtectionReady: protection.ready
    };
  }

  return {
    version: CANDIDATE_POLICY_RUNTIME_SAFETY_GATE_VERSION,
    allowed: true,
    exposureGroup: "unchanged",
    reasonCode: null,
    reasonCodes: [],
    categoryRole: profile?.categoryRole || "unknown",
    functionalAxes,
    activeExpansion,
    sunscreenProtectionApplicable: protection.applicable,
    sunscreenProtectionReady: protection.ready
  };
}
