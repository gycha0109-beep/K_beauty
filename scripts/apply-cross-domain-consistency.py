from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text(encoding="utf-8")
    if old not in text:
        raise SystemExit(f"pattern not found in {path}: {old[:120]!r}")
    p.write_text(text.replace(old, new, 1), encoding="utf-8")

# premium-decision-state imports and orchestration
path = "lib/premium-decision-state.js"
replace_once(path,
'import { buildFunctionalPolicy, FUNCTIONAL_POLICY_VERSION } from "./functional-policy.js";\n',
'import { buildFunctionalPolicy, FUNCTIONAL_POLICY_VERSION } from "./functional-policy.js";\nimport { buildCrossDomainConsistency, CROSS_DOMAIN_CONSISTENCY_VERSION } from "./cross-domain-consistency.js";\nimport { buildEffectivePolicySet, EFFECTIVE_POLICY_SET_VERSION } from "./effective-policy-set.js";\n')
replace_once(path,
'const DECISION_BUNDLE_VERSION = "premium-decision-bundle-v4";',
'const DECISION_BUNDLE_VERSION = "premium-decision-bundle-v5";')
replace_once(path,
'  condition: CONDITION_POLICY_VERSION,\n  conditionProjection: PREMIUM_CONDITION_PROJECTION_VERSION\n',
'  condition: CONDITION_POLICY_VERSION,\n  conditionProjection: PREMIUM_CONDITION_PROJECTION_VERSION,\n  consistency: CROSS_DOMAIN_CONSISTENCY_VERSION,\n  effectivePolicySet: EFFECTIVE_POLICY_SET_VERSION\n')
replace_once(path,
'  conditionPolicy,\n  conditionProjection\n}) {',
'  rawPolicies,\n  consistency,\n  effectivePolicySource,\n  conditionPolicy,\n  conditionProjection\n}) {')
replace_once(path,
'    context,\n    functionalPolicy,',
'    context,\n    rawPolicies,\n    consistency,\n    effectivePolicySource,\n    functionalPolicy,')
old = '''  const functionalPolicy = buildFunctionalPolicy(policyContext);
  const functionalDecisions = buildPremiumFunctionalDecisions({
    ...policyContext,
    functionalPolicy
  });
  const functionalProjection = buildPremiumFunctionalProjection({
    report,
    functionalPolicy,
    locale
  });
  const routinePolicy = buildRoutinePolicy({ sharedContext: context });
  const routineProjection = buildPremiumRoutineProjection({
    report,
    routinePolicy,
    locale
  });
  const conditionPolicy = buildConditionPolicy({ sharedContext: context });
  const conditionProjection = buildPremiumConditionProjection({
    report,
    conditionPolicy,
    locale
  });
'''
new = '''  const rawFunctionalPolicy = buildFunctionalPolicy(policyContext);
  const rawRoutinePolicy = buildRoutinePolicy({ sharedContext: context });
  const rawConditionPolicy = buildConditionPolicy({ sharedContext: context });
  const rawPolicies = {
    functional: rawFunctionalPolicy,
    routine: rawRoutinePolicy,
    condition: rawConditionPolicy
  };
  const consistency = buildCrossDomainConsistency({
    sharedContext: context,
    functionalPolicy: rawFunctionalPolicy,
    routinePolicy: rawRoutinePolicy,
    conditionPolicy: rawConditionPolicy
  });
  const effectivePolicySet = buildEffectivePolicySet({
    sharedContext: context,
    functionalPolicy: rawFunctionalPolicy,
    routinePolicy: rawRoutinePolicy,
    conditionPolicy: rawConditionPolicy,
    consistency
  });
  const functionalPolicy = effectivePolicySet.functionalPolicy;
  const routinePolicy = effectivePolicySet.routinePolicy;
  const conditionPolicy = effectivePolicySet.conditionPolicy;
  const functionalDecisions = buildPremiumFunctionalDecisions({
    ...policyContext,
    functionalPolicy
  });
  const functionalProjection = buildPremiumFunctionalProjection({
    report,
    functionalPolicy,
    locale
  });
  const routineProjection = buildPremiumRoutineProjection({
    report,
    routinePolicy,
    locale
  });
  const conditionProjection = buildPremiumConditionProjection({
    report,
    conditionPolicy,
    locale,
    allowLegacyFallback: effectivePolicySet.source === "raw"
  });
'''
replace_once(path, old, new)
replace_once(path,
'    routineProjection,\n    conditionPolicy,',
'    routineProjection,\n    rawPolicies,\n    consistency,\n    effectivePolicySource: effectivePolicySet.source,\n    conditionPolicy,')
replace_once(path,
'    decisionBundle,\n    functionalPolicy,',
'    decisionBundle,\n    rawPolicies,\n    consistency,\n    effectivePolicySource: effectivePolicySet.source,\n    functionalPolicy,')

# functional projection: no recommendation candidates when suppressed/held
path = "lib/premium-functional-projection.js"
replace_once(path,
'  const functionalPlan = {\n',
'  const candidateExposureSuppressed = policy.recommendationSuppressed === true || policy.planMode === "HOLD";\n  const functionalPlan = {\n')
replace_once(path,
'    productCandidates: products.slice(0, 3),',
'    productCandidates: candidateExposureSuppressed ? [] : products.slice(0, 3),\n    candidateExposureSuppressed,\n    candidateExposureSuppressionReason: candidateExposureSuppressed ? policy.suppressionReason || "policy_hold" : null,')
replace_once(path,
'    budgetAlternatives: Array.isArray(report?.budgetAlternatives)\n      ? report.budgetAlternatives.slice(0, 3)\n      : [],',
'    budgetAlternatives: candidateExposureSuppressed\n      ? []\n      : Array.isArray(report?.budgetAlternatives)\n        ? report.budgetAlternatives.slice(0, 3)\n        : [],')

# routine projection: never attach a candidate product to omitted/held steps
path = "lib/premium-routine-projection.js"
replace_once(path,
'    const product = pool.find((item) => {',
'    if (step?.requirement === "omit" || step?.action === "hold") return null;\n    const product = pool.find((item) => {')

# condition projection: explicit legacy fallback switch
path = "lib/premium-condition-projection.js"
replace_once(path,
'function mergeLegacyFallback(report, responses, conditionPolicy) {',
'function mergeLegacyFallback(report, responses, conditionPolicy, allowLegacyFallback) {')
replace_once(path,
'  const legacy = Array.isArray(report?.conditionResponses) ? report.conditionResponses : [];',
'  if (!allowLegacyFallback) return responses;\n  const legacy = Array.isArray(report?.conditionResponses) ? report.conditionResponses : [];')
replace_once(path,
'export function buildPremiumConditionProjection({ report = {}, conditionPolicy, locale = "ko" } = {}) {',
'export function buildPremiumConditionProjection({ report = {}, conditionPolicy, locale = "ko", allowLegacyFallback = true } = {}) {')
replace_once(path,
'  const responses = mergeLegacyFallback(report, fallback, conditionPolicy).slice(0, 5);',
'  const responses = mergeLegacyFallback(report, fallback, conditionPolicy, allowLegacyFallback).slice(0, 5);')

# Architecture document
Path("docs/architecture/cross-domain-consistency-v1.md").write_text('''# Cross-domain Consistency v1

## Purpose

FunctionalPolicy, RoutinePolicy, and ConditionPolicy remain sibling policies that read the same SharedSkinDecisionContext. This layer runs after all three raw policies and before any Premium projection. It detects contradictions and prevents a critical conflict from reaching storage or UI.

## Inputs

- SharedSkinDecisionContext
- raw FunctionalPolicy
- raw RoutinePolicy
- raw ConditionPolicy

It does not read functionalPlan, routineStructure, currentProductVerdicts, conditionResponses, or localized UI copy.

## Output

`cross-domain-consistency-v1` records deterministic violations, verdict, severity, confidence, and an optional stabilization fallback. Warning-only results keep raw policies. Critical or insufficient-context results select a complete stabilization policy set.

## Storage meaning

Decision Bundle v5 stores `rawPolicies`, `consistency`, and `effectivePolicySource`. Existing top-level functional/routine/condition policies and projections remain compatibility fields and represent the effective policy set actually shown to the user.

## Fail-closed fallback

The fallback blocks new active expansion, sets active frequency to zero, keeps cleansing/hydration/barrier support/sun protection, forbids unknown-product replacement, and preserves actual condition signals without inventing product causation.

## Projection boundaries

- suppressed or held functional policies expose no product candidates or budget alternatives;
- omitted or held routine steps receive no recommended product attachment;
- consistency fallback disables legacy condition-response carryover.

## Legacy behavior

Saved historical snapshots are not rewritten by this module. Rebuild paths create a new context and a new Bundle v5; direct reentry continues to display the stored snapshot.
''', encoding="utf-8")

# Focused verifier
Path("scripts/verify-cross-domain-consistency.mjs").write_text(r'''import assert from "node:assert/strict";
import { buildCrossDomainConsistency } from "../lib/cross-domain-consistency.js";
import { buildEffectivePolicySet } from "../lib/effective-policy-set.js";
import { buildPremiumDecisionState } from "../lib/premium-decision-state.js";
import { buildPremiumFunctionalProjection } from "../lib/premium-functional-projection.js";
import { buildPremiumRoutineProjection } from "../lib/premium-routine-projection.js";
import { buildPremiumConditionProjection } from "../lib/premium-condition-projection.js";

function baseContext(overrides = {}) {
  return {
    skinState: { priorityAxis: "pores", concernScores: { pores: 20 } },
    survey: { completeness: "available", answers: {} },
    safetyState: { level: "stable", protectionMustMaintain: true },
    productExposureState: { rows: [], unknownProductCount: 0, duplicateActiveAxes: [] },
    routineBurdenState: { activeStackBurden: "none", cleansingBurden: "normal", layerBurden: "normal" },
    conditionSignalState: { productReaction: "no", completeness: "complete" },
    ...overrides
  };
}

function baseFunctional(overrides = {}) {
  return {
    version: "functional-policy-v1",
    functionalDirection: "exfoliation",
    primaryGoal: "pores_texture",
    secondaryGoal: null,
    status: "now",
    planMode: "START",
    allowedIntensity: "low_to_moderate",
    recommendationSuppressed: false,
    suppressionReason: null,
    targetCategories: ["treatment"],
    reasonCodes: [],
    safety: { protectionMustMaintain: true },
    goals: [],
    ...overrides
  };
}

function baseRoutine(overrides = {}) {
  const value = {
    version: "routine-policy-v1",
    windows: {
      morning: { mode: "balanced", steps: [
        { stepKey: "am.cleanse", role: "cleanser", requirement: "required", action: "maintain", frequencyCap: { unit: "week", maximum: 7 } },
        { stepKey: "am.hydration", role: "hydration_base", requirement: "required", action: "maintain", frequencyCap: { unit: "week", maximum: 7 } },
        { stepKey: "am.sunscreen", role: "sunscreen", requirement: "required", action: "maintain", frequencyCap: { unit: "week", maximum: 7 } }
      ] },
      evening: { mode: "controlled_active", steps: [
        { stepKey: "pm.cleanse", role: "cleanser", requirement: "required", action: "maintain", frequencyCap: { unit: "week", maximum: 7 } },
        { stepKey: "pm.treatment", role: "functional_leave_on", requirement: "optional", action: "maintain", frequencyCap: { unit: "week", maximum: 3 } },
        { stepKey: "pm.moisturizer", role: "hydration_base", requirement: "required", action: "maintain", frequencyCap: { unit: "week", maximum: 7 } }
      ] }
    },
    weeklySchedule: { activeDaysMax: 3, restDaysMin: 4, sameAxisSameDayAllowed: false },
    productActions: [],
    prohibitedSameWindow: [],
    introductionOrder: [{ order: 4, role: "functional_leave_on", gate: "skin_stable_for_several_days" }],
    invariants: { protectionMustMaintain: true, sunscreenRequiredInMorning: true, unknownProductReplacementForbidden: true },
    confidence: "high",
    reasonCodes: [],
    evidenceKeys: []
  };
  return { ...value, ...overrides };
}

function baseCondition(overrides = {}) {
  return {
    version: "condition-policy-v1",
    responseMode: "steady",
    scenarios: [],
    invariants: { protectionMustMaintain: true, unknownProductStopForbidden: true },
    confidence: "high",
    reasonCodes: [],
    ...overrides
  };
}

const normalInput = {
  sharedContext: baseContext(),
  functionalPolicy: baseFunctional(),
  routinePolicy: baseRoutine(),
  conditionPolicy: baseCondition()
};
assert.equal(buildCrossDomainConsistency(normalInput).verdict, "consistent");
assert.deepEqual(buildCrossDomainConsistency(normalInput), buildCrossDomainConsistency(normalInput));

const blockedInput = {
  ...normalInput,
  sharedContext: baseContext({ safetyState: { level: "stabilize_first", protectionMustMaintain: true } })
};
const blocked = buildCrossDomainConsistency(blockedInput);
assert.equal(blocked.verdict, "blocked");
assert.equal(blocked.effectivePolicySource, "stabilization_fallback");
assert.ok(blocked.violations.some((item) => item.ruleId === "CONSISTENCY_SAFETY_ACTIVE_EXPANSION"));

const effective = buildEffectivePolicySet({ ...blockedInput, consistency: blocked });
assert.equal(effective.source, "stabilization_fallback");
assert.equal(effective.functionalPolicy.planMode, "HOLD");
assert.equal(effective.functionalPolicy.allowedIntensity, "hold");
assert.equal(effective.routinePolicy.weeklySchedule.activeDaysMax, 0);
assert.equal(effective.routinePolicy.windows.evening.steps.find((item) => item.stepKey === "pm.treatment").requirement, "omit");
assert.equal(effective.routinePolicy.windows.morning.steps.find((item) => item.stepKey === "am.sunscreen").frequencyCap.maximum, 7);

const missingProtection = buildCrossDomainConsistency({
  ...normalInput,
  routinePolicy: baseRoutine({ windows: { ...baseRoutine().windows, morning: { mode: "balanced", steps: [] } } })
});
assert.ok(missingProtection.violations.some((item) => item.ruleId === "CONSISTENCY_PROTECTION_MISSING"));

const duplicate = buildCrossDomainConsistency({
  ...normalInput,
  sharedContext: baseContext({
    productExposureState: { rows: [], unknownProductCount: 0, duplicateActiveAxes: ["exfoliation"] },
    routineBurdenState: { activeStackBurden: "confirmed" }
  }),
  routinePolicy: baseRoutine({ weeklySchedule: { activeDaysMax: 3, restDaysMin: 4, sameAxisSameDayAllowed: true } })
});
assert.ok(duplicate.violations.some((item) => item.ruleId === "CONSISTENCY_DUPLICATE_AXIS_SAME_DAY"));
assert.ok(duplicate.violations.some((item) => item.ruleId === "CONSISTENCY_DUPLICATE_AXIS_EXPANSION"));

const unknownContext = baseContext({
  productExposureState: {
    rows: [{ sourceState: "not_in_db", productId: "unknown", routineSlots: ["pm.treatment"], evaluable: false }],
    unknownProductCount: 1,
    duplicateActiveAxes: []
  }
});
const unknown = buildCrossDomainConsistency({
  ...normalInput,
  sharedContext: unknownContext,
  routinePolicy: baseRoutine({
    productActions: [{ slotKey: "pm.treatment", productId: "unknown", action: "hold" }],
    confidence: "high"
  })
});
assert.ok(unknown.violations.some((item) => item.ruleId === "CONSISTENCY_UNKNOWN_PRODUCT_STOP"));
assert.ok(unknown.violations.some((item) => item.ruleId === "CONSISTENCY_UNKNOWN_PRODUCT_CONFIDENCE"));

const noReaction = buildCrossDomainConsistency({
  ...normalInput,
  routinePolicy: baseRoutine({ productActions: [{ slotKey: "pm.treatment", productId: "known", action: "hold" }] })
});
assert.ok(noReaction.violations.some((item) => item.ruleId === "CONSISTENCY_PRODUCT_BLAME_WITHOUT_REACTION_EVIDENCE"));

const functionalProjection = buildPremiumFunctionalProjection({
  report: { topPick: { id: "p1", name: "Candidate" }, budgetAlternatives: [{ id: "p2", name: "Budget" }] },
  functionalPolicy: effective.functionalPolicy,
  locale: "ko"
});
assert.deepEqual(functionalProjection.functionalPlan.productCandidates, []);
assert.deepEqual(functionalProjection.functionalPlan.budgetAlternatives, []);

const routineProjection = buildPremiumRoutineProjection({
  report: { topPick: { id: "p1", name: "Treatment", category: "treatment" } },
  routinePolicy: effective.routinePolicy,
  locale: "ko"
});
assert.equal(routineProjection.routinePlan.nightSteps.find((item) => item.productRole === "functional_leave_on").product, null);

const legacyReport = { conditionResponses: [{ responseKey: "active_load", status: "avoid_for_now" }] };
const minimalCondition = baseCondition({ conditionSignalState: { completeness: "minimal" }, scenarios: [] });
assert.equal(buildPremiumConditionProjection({ report: legacyReport, conditionPolicy: minimalCondition, allowLegacyFallback: true }).conditionPlan.responses[0].responseKey, "active_load");
assert.ok(!buildPremiumConditionProjection({ report: legacyReport, conditionPolicy: minimalCondition, allowLegacyFallback: false }).conditionPlan.responses.some((item) => item.legacyCarryover));

const report = {
  freeResult: {
    priority: { axis: "pores", score: 20 },
    scoring: { concernScores: { pores: 20 } },
    answers: { recentSkinChange: "yes" }
  },
  currentProducts: { selections: [] }
};
const decisionState = buildPremiumDecisionState(report, { locale: "ko", source: "consistency_verifier" });
assert.equal(decisionState.decisionBundle.version, "premium-decision-bundle-v5");
assert.ok(decisionState.rawPolicies.functional);
assert.ok(decisionState.consistency);
assert.equal(decisionState.effectivePolicySource, "stabilization_fallback");
assert.equal(decisionState.functionalPolicy, decisionState.decisionBundle.functionalPolicy);
assert.equal(decisionState.decisionBundle.effectivePolicies, undefined);

console.log("cross-domain consistency verifier passed");
''', encoding="utf-8")

# Work log: concise task entry; do not modify AI_CONTEXT.
worklog = Path(".codex/AI_WORK_LOG.md")
entry = '''\n\n## Cross-domain consistency v1\n\n- Type: execution/review, Medium-high structural decision integration.\n- Delta: added post-policy contradiction detection, fail-closed effective policies, Bundle v5 metadata, and projection guards.\n- Protected impact: no DB/Auth/RLS/Storage/Provider/Payment/Secret/Production execution; existing saved-report compatibility fields are preserved.\n- Verification: focused consistency verifier plus existing policy, decision-state, reentry, architecture, build, and diff checks.\n'''
worklog.write_text(worklog.read_text(encoding="utf-8") + entry, encoding="utf-8")
