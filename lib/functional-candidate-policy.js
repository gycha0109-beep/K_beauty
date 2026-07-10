const VISIBILITY_MAX_CANDIDATES = {
  hidden: 0,
  collapsed: 1,
  limited: 1,
  visible: 3
};

function normalizeFindings(input) {
  if (Array.isArray(input)) {
    return input;
  }

  if (Array.isArray(input?.findings)) {
    return input.findings;
  }

  return [];
}

function normalizeCandidates(candidates) {
  if (!candidates || typeof candidates !== "object") {
    return {};
  }

  return candidates;
}

function countAvailableCandidates(candidates = {}) {
  return Object.values(candidates).reduce((total, value) => {
    if (Array.isArray(value)) {
      return total + value.length;
    }

    if (value && typeof value === "object") {
      return total + 1;
    }

    return total;
  }, 0);
}

function hasRelation(findings, relationToPlan) {
  return findings.some((finding) => finding?.relationToPlan === relationToPlan);
}

function hasSourceState(findings, sourceState) {
  return findings.some((finding) => finding?.sourceState === sourceState);
}

function getSelectedFindings(findings) {
  return findings.filter((finding) => finding?.sourceState === "selected");
}

function getPolicyState({ decision, findings }) {
  if (decision?.recommendationSuppressed === true) {
    return {
      visibility: "hidden",
      intent: "stabilize_first",
      reason: `recommendation suppressed by skin-state signal${decision?.suppressionReason ? `: ${decision.suppressionReason}` : ""}`
    };
  }

  if (hasRelation(findings, "duplicate_axis")) {
    return {
      visibility: "collapsed",
      intent: "stabilize_first",
      reason: "current selected products already share the same functional direction"
    };
  }

  if (hasRelation(findings, "supports_goal")) {
    return {
      visibility: "collapsed",
      intent: "keep_current",
      reason: "current selected product has verified support for this functional direction"
    };
  }

  const selectedFindings = getSelectedFindings(findings);

  if (
    selectedFindings.length > 0 &&
    selectedFindings.every((finding) => finding.relationToPlan === "different_goal")
  ) {
    return {
      visibility: "limited",
      intent: "add_missing_step",
      reason: "selected products are evaluable but do not directly support this functional direction"
    };
  }

  if (hasSourceState(findings, "not_in_db") || hasRelation(findings, "not_evaluable")) {
    return {
      visibility: "collapsed",
      intent: "review_uncertain",
      reason: "current product information is not evaluable enough for a stronger candidate display"
    };
  }

  if (hasSourceState(findings, "not_using") || hasRelation(findings, "empty_slot")) {
    return {
      visibility: "visible",
      intent: "add_missing_step",
      reason: "a target routine category is marked as not used"
    };
  }

  if (hasSourceState(findings, "unanswered") || hasRelation(findings, "unknown_usage")) {
    return {
      visibility: "collapsed",
      intent: "review_uncertain",
      reason: "current routine usage was not answered"
    };
  }

  return {
    visibility: "collapsed",
    intent: "review_uncertain",
    reason: "current product findings are unavailable"
  };
}

function buildGroupPolicy({ visibility, maxVisibleCandidates, candidateCount }) {
  const hasCandidates = candidateCount > 0;

  if (!hasCandidates || visibility === "hidden") {
    return {
      visible: false,
      collapsed: false,
      limit: 0
    };
  }

  if (visibility === "collapsed") {
    return {
      visible: true,
      collapsed: true,
      limit: Math.min(maxVisibleCandidates, candidateCount)
    };
  }

  return {
    visible: true,
    collapsed: false,
    limit: Math.min(maxVisibleCandidates, candidateCount)
  };
}

function buildCandidateGroups(candidates = {}, visibility, maxVisibleCandidates) {
  const primaryItems = [
    ...(candidates.topPick ? [candidates.topPick] : []),
    ...(Array.isArray(candidates.primary) ? candidates.primary : []),
    ...(Array.isArray(candidates.supportingProducts) ? candidates.supportingProducts : [])
  ].filter(Boolean);
  const alternatives = [
    ...(Array.isArray(candidates.alternatives) ? candidates.alternatives : []),
    ...(Array.isArray(candidates.altPicks) ? candidates.altPicks : [])
  ].filter(Boolean);
  const budget = Array.isArray(candidates.budgetAlternatives)
    ? candidates.budgetAlternatives.filter(Boolean)
    : [];

  return {
    primary: buildGroupPolicy({
      visibility,
      maxVisibleCandidates,
      candidateCount: primaryItems.length
    }),
    alternatives: buildGroupPolicy({
      visibility: visibility === "visible" ? "limited" : visibility,
      maxVisibleCandidates,
      candidateCount: alternatives.length
    }),
    budget: buildGroupPolicy({
      visibility: visibility === "visible" ? "limited" : visibility,
      maxVisibleCandidates,
      candidateCount: budget.length
    })
  };
}

export function buildFunctionalCandidatePolicy({
  decision = {},
  findings: findingsInput,
  candidates: candidatesInput
} = {}) {
  const findings = normalizeFindings(findingsInput);
  const candidates = normalizeCandidates(candidatesInput);
  const candidateCount = countAvailableCandidates(candidates);
  const state = getPolicyState({ decision, findings });
  const maxVisibleCandidates =
    candidateCount > 0 ? VISIBILITY_MAX_CANDIDATES[state.visibility] : 0;

  return {
    visibility: state.visibility,
    intent: state.intent,
    reason: state.reason,
    maxVisibleCandidates,
    candidateGroups: candidateCount
      ? buildCandidateGroups(candidates, state.visibility, maxVisibleCandidates)
      : {}
  };
}

export const FUNCTIONAL_CANDIDATE_POLICY_VALUES = {
  visibility: ["hidden", "collapsed", "limited", "visible"],
  intent: [
    "stabilize_first",
    "add_missing_step",
    "keep_current",
    "compare_later",
    "replace_later",
    "review_uncertain"
  ]
};
