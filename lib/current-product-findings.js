import { resolveProductFunctionalProfile } from "./product-functional-profile.js";

const SOURCE_STATES = new Set(["selected", "not_in_db", "not_using", "unanswered"]);
const DIRECT_AXES_BY_DIRECTION = {
  exfoliation: ["exfoliation"],
  hydration: ["hydration", "moisture_lock"],
  soothing: ["soothing", "barrier_support"],
  tone_care: ["tone_care"],
  acne_care: ["acne_care"],
  sunscreen_protection: ["sunscreen_protection"],
  wrinkle_care: ["wrinkle_care"]
};
const DIRECTION_BY_GOAL = {
  pores_texture: "exfoliation",
  oil_acne: "acne_care",
  barrier_redness: "soothing",
  dehydration: "hydration",
  uneven_tone: "tone_care",
  protection: "sunscreen_protection"
};
const MEANINGFUL_DUPLICATE_ROLES = new Set(["functional_leave_on", "hydration_base"]);
const CONFIDENCE_RANK = { none: 0, low: 1, medium: 2, high: 3 };
const STRENGTH_RANK = { none: 0, low: 1, medium: 2, high: 3 };

function normalizeText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeSourceState(value) {
  const state = normalizeText(value);
  return SOURCE_STATES.has(state) ? state : "unanswered";
}

function normalizeSelections(currentProducts) {
  if (Array.isArray(currentProducts)) {
    return currentProducts;
  }

  if (Array.isArray(currentProducts?.selections)) {
    return currentProducts.selections;
  }

  return [];
}

function getSnapshot(selection) {
  return selection?.productSnapshot || selection?.product || null;
}

function getCategory(selection, snapshot) {
  return String(snapshot?.category || selection?.category || "").trim();
}

function getProductId(selection, snapshot) {
  return String(snapshot?.id || selection?.productId || selection?.product_id || "").trim() || null;
}

function getProductName(snapshot) {
  const brand = String(snapshot?.brand || snapshot?.brandName || "").trim();
  const name = String(snapshot?.name || snapshot?.productName || "").trim();
  return [brand, name].filter(Boolean).join(" ") || null;
}

function resolveDirection(primaryGoal, functionalDirection) {
  const direction = normalizeText(functionalDirection);

  if (DIRECT_AXES_BY_DIRECTION[direction]) {
    return direction;
  }

  return DIRECTION_BY_GOAL[normalizeText(primaryGoal)] || "";
}

function getDirectAxes(primaryGoal, functionalDirection) {
  const direction = resolveDirection(primaryGoal, functionalDirection);
  return DIRECT_AXES_BY_DIRECTION[direction] || [];
}

function rankAtLeast(value, rankMap, minimum) {
  return (rankMap[value] || 0) >= (rankMap[minimum] || 0);
}

function isRinseOffLimited(profile) {
  return Boolean(profile?.cautionTags?.includes("rinse_off_limit"));
}

function hasSunscreenMetadata(profile) {
  return !profile?.cautionTags?.includes("sunscreen_metadata_incomplete");
}

function isAxisDirectSupport(axis, profile) {
  if (!axis || !profile) {
    return false;
  }

  if (isRinseOffLimited(profile)) {
    return false;
  }

  if (!rankAtLeast(axis.confidence, CONFIDENCE_RANK, "medium")) {
    return false;
  }

  if (!rankAtLeast(axis.strength, STRENGTH_RANK, "low")) {
    return false;
  }

  if (axis.axis === "sunscreen_protection") {
    return profile.categoryRole === "protection" && hasSunscreenMetadata(profile);
  }

  if (axis.axis === "tone_care") {
    return profile.categoryRole === "functional_leave_on";
  }

  if (axis.axis === "acne_care" || axis.axis === "wrinkle_care") {
    return profile.categoryRole === "functional_leave_on";
  }

  if (axis.axis === "exfoliation") {
    return ["functional_leave_on", "hydration_base"].includes(profile.categoryRole);
  }

  if (axis.axis === "hydration" || axis.axis === "moisture_lock") {
    return ["support", "hydration_base", "functional_leave_on"].includes(profile.categoryRole);
  }

  if (axis.axis === "soothing") {
    return ["support", "hydration_base", "functional_leave_on"].includes(profile.categoryRole);
  }

  if (axis.axis === "barrier_support") {
    return (
      rankAtLeast(axis.confidence, CONFIDENCE_RANK, "high") &&
      ["support", "hydration_base", "functional_leave_on"].includes(profile.categoryRole)
    );
  }

  return false;
}

function getMatchingAxes(profile, directAxes) {
  if (!profile?.evaluable || !Array.isArray(profile.functionalAxes)) {
    return [];
  }

  return profile.functionalAxes
    .filter((axis) => directAxes.includes(axis.axis))
    .filter((axis) => isAxisDirectSupport(axis, profile))
    .map((axis) => axis.axis);
}

function getReasonForSelected({ profile, matchedAxes, directAxes }) {
  if (!profile) {
    return "selected product snapshot is unavailable";
  }

  if (!profile.evaluable) {
    return "selected product has no usable functional signal evidence";
  }

  if (isRinseOffLimited(profile)) {
    return "selected product is cleanser with rinse-off limitation";
  }

  if (matchedAxes.length) {
    return `selected product has ${matchedAxes.join(", ")} signal with ${profile.categoryRole} category`;
  }

  const availableAxes = profile.functionalAxes.map((axis) => axis.axis).filter(Boolean);

  if (availableAxes.length) {
    return `selected product functional axes (${availableAxes.join(", ")}) do not directly match ${directAxes.join(", ") || "the requested direction"}`;
  }

  return "selected product does not have direct functional signal evidence for this direction";
}

function buildNonSelectedFinding(selection, sourceState) {
  const category = String(selection?.category || "").trim();

  if (sourceState === "not_in_db") {
    return {
      sourceState,
      category,
      productId: null,
      productName: null,
      canEvaluate: false,
      relationToPlan: "not_evaluable",
      matchedAxes: [],
      reason: "product is used but unavailable in database",
      profile: null
    };
  }

  if (sourceState === "not_using") {
    return {
      sourceState,
      category,
      productId: null,
      productName: null,
      canEvaluate: false,
      relationToPlan: "empty_slot",
      matchedAxes: [],
      reason: "category explicitly marked as not used",
      profile: null
    };
  }

  return {
    sourceState: "unanswered",
    category,
    productId: null,
    productName: null,
    canEvaluate: false,
    relationToPlan: "unknown_usage",
    matchedAxes: [],
    reason: "category usage was not answered",
    profile: null
  };
}

function buildSelectedFinding(selection, directAxes) {
  const snapshot = getSnapshot(selection);
  const category = getCategory(selection, snapshot);
  const productId = getProductId(selection, snapshot);
  const productName = getProductName(snapshot);

  if (!snapshot || typeof snapshot !== "object") {
    return {
      sourceState: "selected",
      category,
      productId,
      productName,
      canEvaluate: false,
      relationToPlan: "not_evaluable",
      matchedAxes: [],
      reason: "selected product snapshot is unavailable",
      profile: null
    };
  }

  const profile = resolveProductFunctionalProfile({
    ...snapshot,
    id: snapshot.id || selection.productId || selection.product_id,
    category: snapshot.category || selection.category
  });
  const matchedAxes = getMatchingAxes(profile, directAxes);
  const relationToPlan = !profile.evaluable
    ? "not_evaluable"
    : matchedAxes.length
      ? "supports_goal"
      : "different_goal";

  return {
    sourceState: "selected",
    category,
    productId,
    productName,
    canEvaluate: Boolean(profile.evaluable),
    relationToPlan,
    matchedAxes,
    reason: getReasonForSelected({ profile, matchedAxes, directAxes }),
    profile
  };
}

function qualifiesForDuplicateAxis(finding) {
  if (finding?.relationToPlan !== "supports_goal") {
    return false;
  }

  if (!MEANINGFUL_DUPLICATE_ROLES.has(finding.profile?.categoryRole)) {
    return false;
  }

  if (isRinseOffLimited(finding.profile)) {
    return false;
  }

  return finding.matchedAxes.some((axisName) => {
    const axis = finding.profile?.functionalAxes?.find((item) => item.axis === axisName);
    return (
      axis &&
      rankAtLeast(axis.confidence, CONFIDENCE_RANK, "medium") &&
      rankAtLeast(axis.strength, STRENGTH_RANK, "medium")
    );
  });
}

function applyDuplicateAxis(findings) {
  const counts = new Map();

  findings
    .filter(qualifiesForDuplicateAxis)
    .forEach((finding) => {
      finding.matchedAxes.forEach((axis) => {
        counts.set(axis, (counts.get(axis) || 0) + 1);
      });
    });

  const duplicatedAxes = new Set(
    Array.from(counts.entries())
      .filter(([, count]) => count >= 2)
      .map(([axis]) => axis)
  );

  if (!duplicatedAxes.size) {
    return findings;
  }

  return findings.map((finding) => {
    if (!qualifiesForDuplicateAxis(finding)) {
      return finding;
    }

    const matchedDuplicateAxes = finding.matchedAxes.filter((axis) => duplicatedAxes.has(axis));

    if (!matchedDuplicateAxes.length) {
      return finding;
    }

    return {
      ...finding,
      relationToPlan: "duplicate_axis",
      reason: `selected product shares direct ${matchedDuplicateAxes.join(", ")} support with another selected product`
    };
  });
}

function buildSummary(findings) {
  return {
    evaluableSelectedCount: findings.filter(
      (finding) => finding.sourceState === "selected" && finding.canEvaluate
    ).length,
    notInDbCount: findings.filter((finding) => finding.sourceState === "not_in_db").length,
    notUsingCount: findings.filter((finding) => finding.sourceState === "not_using").length,
    unansweredCount: findings.filter((finding) => finding.sourceState === "unanswered").length,
    supportsGoalCount: findings.filter(
      (finding) =>
        finding.relationToPlan === "supports_goal" ||
        finding.relationToPlan === "duplicate_axis"
    ).length,
    directFunctionalSupportExists: findings.some(
      (finding) =>
        finding.relationToPlan === "supports_goal" ||
        finding.relationToPlan === "duplicate_axis"
    )
  };
}

export function buildCurrentProductFindings({
  currentProducts,
  primaryGoal = "",
  functionalDirection = ""
} = {}) {
  const selections = normalizeSelections(currentProducts);
  const directAxes = getDirectAxes(primaryGoal, functionalDirection);
  const findings = applyDuplicateAxis(
    selections.map((selection) => {
      const sourceState = normalizeSourceState(selection?.status);

      if (sourceState !== "selected") {
        return buildNonSelectedFinding(selection, sourceState);
      }

      return buildSelectedFinding(selection, directAxes);
    })
  );

  return {
    findings,
    summary: buildSummary(findings)
  };
}

export const CURRENT_PRODUCT_FINDING_RELATIONS = [
  "supports_goal",
  "different_goal",
  "duplicate_axis",
  "not_evaluable",
  "empty_slot",
  "unknown_usage"
];
