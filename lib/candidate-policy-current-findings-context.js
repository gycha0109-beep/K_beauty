import { FUNCTIONAL_POLICY_VERSION } from "./functional-policy.js";
import { FUNCTIONAL_RANKING_GOAL_AXES } from "./functional-ranking-contract.js";
import { SHARED_SKIN_DECISION_CONTEXT_VERSION } from "./shared-skin-decision-context.js";

export const CANDIDATE_POLICY_CURRENT_FINDINGS_CONTEXT_VERSION =
  "candidate-policy-current-findings-context-v1";

const CONTEXT_SOURCE = "canonical_shared_context_product_exposure";
const VALID_SOURCE_STATES = new Set(["selected", "not_in_db", "not_using", "unanswered"]);
const VALID_RELATIONS = new Set([
  "supports_goal",
  "different_goal",
  "duplicate_axis",
  "not_evaluable",
  "empty_slot",
  "unknown_usage"
]);
const VALID_EXPOSURE_STATES = new Set([
  "valid_empty",
  "populated",
  "not_using",
  "unanswered",
  "partial_unknown"
]);
const CONFIDENCE_RANK = Object.freeze({ none: 0, low: 1, medium: 2, high: 3 });
const STRENGTH_RANK = Object.freeze({ none: 0, low: 1, medium: 2, high: 3 });
const REASON_PATTERN = /^[a-z0-9][a-z0-9_:.-]{0,79}$/;

function normalizeText(value) {
  return String(value ?? "").normalize("NFKC").trim().toLowerCase();
}

function normalizeId(value) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function unique(values = []) {
  return Array.from(new Set(values.filter(Boolean))).sort();
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function rankAtLeast(value, ranks, minimum) {
  return (ranks[normalizeText(value)] || 0) >= (ranks[minimum] || 0);
}

function normalizedAxes(row = {}) {
  return (Array.isArray(row.functionalAxes) ? row.functionalAxes : [])
    .map((axis) => ({
      axis: normalizeText(axis?.axis),
      strength: normalizeText(axis?.strength) || "none",
      confidence: normalizeText(axis?.confidence) || "none"
    }))
    .filter((axis) => axis.axis);
}

function axisCanSupportGoal(axis, row) {
  if (!axis || !row?.evaluable) return false;
  if (!rankAtLeast(axis.confidence, CONFIDENCE_RANK, "medium")) return false;
  if (!rankAtLeast(axis.strength, STRENGTH_RANK, "low")) return false;
  if (Array.isArray(row.cautionTags) && row.cautionTags.includes("rinse_off_limit")) return false;
  if (
    axis.axis === "sunscreen_protection" &&
    (row.categoryRole !== "protection" ||
      (Array.isArray(row.cautionTags) && row.cautionTags.includes("sunscreen_metadata_incomplete")))
  ) {
    return false;
  }
  return true;
}

function buildFinding(row, goalAxes, duplicateActiveAxes) {
  const sourceState = VALID_SOURCE_STATES.has(normalizeText(row?.sourceState))
    ? normalizeText(row.sourceState)
    : "unanswered";
  const category = normalizeText(row?.category) || null;
  const productId = normalizeId(row?.productId);
  const functionalAxes = normalizedAxes(row);
  const matchedAxes = unique(
    functionalAxes
      .filter((axis) => goalAxes.includes(axis.axis))
      .filter((axis) => axisCanSupportGoal(axis, row))
      .map((axis) => axis.axis)
  );

  if (sourceState === "not_in_db") {
    return {
      sourceState,
      category,
      productId: null,
      canEvaluate: false,
      relationToPlan: "not_evaluable",
      matchedAxes: [],
      activeAxes: [],
      reasonCodes: ["current_product_not_in_db"]
    };
  }

  if (sourceState === "not_using") {
    return {
      sourceState,
      category,
      productId: null,
      canEvaluate: false,
      relationToPlan: "empty_slot",
      matchedAxes: [],
      activeAxes: [],
      reasonCodes: ["current_product_not_using"]
    };
  }

  if (sourceState !== "selected") {
    return {
      sourceState: "unanswered",
      category,
      productId: null,
      canEvaluate: false,
      relationToPlan: "unknown_usage",
      matchedAxes: [],
      activeAxes: [],
      reasonCodes: ["current_product_usage_unanswered"]
    };
  }

  const activeAxes = unique(Array.isArray(row?.activeAxes) ? row.activeAxes.map(normalizeText) : []);
  if (row?.evaluable !== true) {
    return {
      sourceState,
      category,
      productId,
      canEvaluate: false,
      relationToPlan: "not_evaluable",
      matchedAxes: [],
      activeAxes,
      reasonCodes: ["current_product_selected_not_evaluable"]
    };
  }

  const duplicatedMatches = matchedAxes.filter((axis) => duplicateActiveAxes.includes(axis));
  const relationToPlan = duplicatedMatches.length
    ? "duplicate_axis"
    : matchedAxes.length
      ? "supports_goal"
      : "different_goal";

  return {
    sourceState,
    category,
    productId,
    canEvaluate: true,
    relationToPlan,
    matchedAxes,
    activeAxes,
    reasonCodes: unique([
      relationToPlan === "duplicate_axis" ? "current_product_duplicate_axis" : null,
      relationToPlan === "supports_goal" ? "current_product_supports_ranking_goal" : null,
      relationToPlan === "different_goal" ? "current_product_different_goal" : null
    ])
  };
}

function buildSummary(findings) {
  return {
    productCount: findings.length,
    selectedCount: findings.filter((finding) => finding.sourceState === "selected").length,
    evaluableSelectedCount: findings.filter(
      (finding) => finding.sourceState === "selected" && finding.canEvaluate
    ).length,
    unknownProductCount: findings.filter(
      (finding) => finding.sourceState === "not_in_db" || finding.relationToPlan === "not_evaluable"
    ).length,
    notInDbCount: findings.filter((finding) => finding.sourceState === "not_in_db").length,
    notUsingCount: findings.filter((finding) => finding.sourceState === "not_using").length,
    unansweredCount: findings.filter((finding) => finding.sourceState === "unanswered").length,
    supportsRankingGoalCount: findings.filter(
      (finding) => ["supports_goal", "duplicate_axis"].includes(finding.relationToPlan)
    ).length,
    duplicateAxisCount: findings.filter((finding) => finding.relationToPlan === "duplicate_axis").length,
    differentGoalCount: findings.filter((finding) => finding.relationToPlan === "different_goal").length
  };
}

function resolveExposureState(findings, summary) {
  if (!findings.length) return "valid_empty";
  if (summary.unansweredCount > 0) return "unanswered";
  if (summary.unknownProductCount > 0) return "partial_unknown";
  if (summary.notUsingCount === findings.length) return "not_using";
  return "populated";
}

function sameSummary(actual = {}, expected = {}) {
  return Object.keys(expected).every((key) => Number(actual?.[key]) === Number(expected[key]));
}

export function validateCandidatePolicyCurrentFindingsContext(context) {
  const errors = [];
  if (!context || typeof context !== "object" || Array.isArray(context)) {
    return { valid: false, errors: ["canonical_current_findings_context_missing"] };
  }
  if (context.version !== CANDIDATE_POLICY_CURRENT_FINDINGS_CONTEXT_VERSION) {
    errors.push("candidate_current_findings_context_version_invalid");
  }
  if (context.source !== CONTEXT_SOURCE) {
    errors.push("candidate_current_findings_context_source_invalid");
  }
  if (context.sharedContextVersion !== SHARED_SKIN_DECISION_CONTEXT_VERSION) {
    errors.push("candidate_current_findings_shared_context_version_invalid");
  }
  if (context.functionalPolicyVersion !== FUNCTIONAL_POLICY_VERSION) {
    errors.push("candidate_current_findings_policy_version_invalid");
  }
  if (!Array.isArray(context.findings)) {
    errors.push("candidate_current_findings_rows_invalid");
  }
  if (!VALID_EXPOSURE_STATES.has(context.exposureState)) {
    errors.push("candidate_current_findings_exposure_state_invalid");
  }
  const findings = Array.isArray(context.findings) ? context.findings : [];
  const seenProductIds = new Set();
  for (const finding of findings) {
    if (!finding || typeof finding !== "object" || Array.isArray(finding)) {
      errors.push("candidate_current_finding_invalid");
      continue;
    }
    if (!VALID_SOURCE_STATES.has(finding.sourceState)) {
      errors.push("candidate_current_finding_source_state_invalid");
    }
    if (!VALID_RELATIONS.has(finding.relationToPlan)) {
      errors.push("candidate_current_finding_relation_invalid");
    }
    if (typeof finding.canEvaluate !== "boolean") {
      errors.push("candidate_current_finding_evaluable_invalid");
    }
    if (!Array.isArray(finding.matchedAxes) || !Array.isArray(finding.activeAxes)) {
      errors.push("candidate_current_finding_axes_invalid");
    }
    if (
      !Array.isArray(finding.reasonCodes) ||
      finding.reasonCodes.some((reason) => !REASON_PATTERN.test(String(reason)))
    ) {
      errors.push("candidate_current_finding_reason_codes_invalid");
    }
    if (finding.productId) {
      if (seenProductIds.has(finding.productId)) {
        errors.push("candidate_current_finding_product_id_duplicate");
      }
      seenProductIds.add(finding.productId);
    }
  }
  const expectedSummary = buildSummary(findings);
  if (!context.summary || typeof context.summary !== "object" || !sameSummary(context.summary, expectedSummary)) {
    errors.push("candidate_current_findings_summary_mismatch");
  }
  if (context.exposureState !== resolveExposureState(findings, expectedSummary)) {
    errors.push("candidate_current_findings_exposure_state_mismatch");
  }
  if (
    !Array.isArray(context.reasonCodes) ||
    context.reasonCodes.some((reason) => !REASON_PATTERN.test(String(reason)))
  ) {
    errors.push("candidate_current_findings_reason_codes_invalid");
  }
  return { valid: errors.length === 0, errors: unique(errors) };
}

export function buildCandidatePolicyCurrentFindingsContext({
  sharedContext = {},
  functionalPolicy = {}
} = {}) {
  const rows = Array.isArray(sharedContext?.productExposureState?.rows)
    ? sharedContext.productExposureState.rows
    : [];
  const rankingGoal = normalizeText(functionalPolicy?.priorityAxis);
  const goalAxes = unique(FUNCTIONAL_RANKING_GOAL_AXES[rankingGoal] || []);
  const duplicateActiveAxes = unique(
    Array.isArray(sharedContext?.productExposureState?.duplicateActiveAxes)
      ? sharedContext.productExposureState.duplicateActiveAxes.map(normalizeText)
      : []
  );
  const findings = rows.map((row) => buildFinding(row, goalAxes, duplicateActiveAxes));
  const summary = buildSummary(findings);
  const context = {
    version: CANDIDATE_POLICY_CURRENT_FINDINGS_CONTEXT_VERSION,
    source: CONTEXT_SOURCE,
    sharedContextVersion: String(sharedContext?.version || ""),
    functionalPolicyVersion: String(functionalPolicy?.version || ""),
    rankingGoal: rankingGoal || null,
    exposureState: resolveExposureState(findings, summary),
    findings,
    summary,
    reasonCodes: unique([
      findings.length ? "current_findings_present" : "current_findings_valid_empty",
      summary.unknownProductCount ? "current_findings_partial_unknown" : null,
      summary.unansweredCount ? "current_findings_unanswered" : null,
      summary.supportsRankingGoalCount ? "current_findings_support_ranking_goal" : null,
      summary.duplicateAxisCount ? "current_findings_duplicate_axis" : null
    ])
  };
  const validation = validateCandidatePolicyCurrentFindingsContext(context);
  if (!validation.valid) {
    throw new Error(`Candidate current findings context invalid: ${validation.errors.join(",")}`);
  }
  return deepFreeze(context);
}
