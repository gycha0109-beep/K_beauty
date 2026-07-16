const product = (id, category = "treatment", label = "Exfoliation", extra = {}) => ({
  id, brand: "Fixture", name: id, category,
  ...(category === "treatment" ? { product_form: "serum" } : {}),
  skin_types: ["combination"], concerns: ["pores"], texture: "light", finish: "natural",
  irritation_risk: "low", sensitivity_safe: true,
  ingredient_signals: { functional: [{ label, count: 4 }], source: "fixture" },
  review_signals: { source: "fixture" }, market_signals: { source: "fixture" },
  image_url: "https://example.invalid/image.jpg", buy_link: "https://example.invalid/buy", price_min: 10000,
  ...extra
});
const baseReport = (answers = {}, extra = {}) => ({
  freeResult: {
    priority: { axis: "pores", score: 22 },
    scoring: { concernScores: { pores: { total: 22 }, barrier: { total: 8 }, redness: { total: 5 }, dehydration: { total: 10 } } },
    answers: { recentSkinChange: "no", recentlyChangedProduct: "no", productReaction: "no", postWashFeeling: "comfortable", afternoonSkinChange: "mostly_same", cleansingFrequency: "twice", ...answers }
  },
  currentProducts: { selections: [], summary: { total: 0, selectedCount: 0 } },
  ...extra
});
const selected = (p) => ({ status: "selected", category: p.category, productId: p.id, productSnapshot: p });
const common = ["BUNDLE_VERSION","BUNDLE_LINEAGE","NO_REDUNDANT_EFFECTIVE_POLICIES","PROTECTION_MUST_MAINTAIN","INPUT_IMMUTABILITY"];
const scenario = (id, title, report, expected = {}, extra = {}) => { const { expected: extraExpected, ...rest } = extra; return { id, title, description: title, tags: ["integrated"], report, ...rest, expected: { invariants: common, ...expected, ...(extraExpected || {}) } }; };
const active = product("eval-active-a");
const activeB = product("eval-active-b");
const unknown = product("eval-unknown", "treatment", "Unregistered Magic Complex");
const cleanser = product("eval-cleanser", "cleanser", "Exfoliation");
const serum = product("eval-serum", "serum", "Exfoliation");
const sunscreen = product("eval-sunscreen", "sunscreen", "UV Protection", { spf_value: 50, uva_label: "PA++++", uv_filter_type: "organic", tone_up: false, white_cast: "none", eye_sting: "low", pilling_risk: "low" });
const partialSun = product("eval-sunscreen-partial", "sunscreen", "UV Protection", { spf_value: 50 });
const sensitiveScores = { pores: { total: 10 }, barrier: { total: 24 }, redness: { total: 20 }, dehydration: { total: 18 } };
const sensitiveReport = (selection, answers = {}) => baseReport(answers, { freeResult: { priority: { axis: "barrier", score: 24 }, scoring: { concernScores: sensitiveScores }, answers: { recentSkinChange: "no", recentlyChangedProduct: "no", productReaction: "no", ...answers } }, currentProducts: { selections: selection ? [selected(selection)] : [], summary: { total: selection ? 1 : 0, selectedCount: selection ? 1 : 0 } } });
export const fixtureManifest = {
  version: "premium-integrated-evaluation-fixtures-v1",
  scenarios: [
    scenario("S01_STABLE_BASELINE", "Stable baseline", baseReport(), { consistency: [{ path: "verdict", operator: "equals", expected: "consistent" }], effectivePolicies: [{ path: "routine.invariants.sunscreenRequiredInMorning", operator: "equals", expected: true }] }),
    scenario("S02_SENSITIVE_WITHOUT_ACTIVE_BURDEN", "Sensitive without active burden", sensitiveReport(null), { context: [{ path: "safetyState.level", operator: "equals", expected: "caution" }] }),
    scenario("S03_SENSITIVE_WITH_ACTIVE_TREATMENT", "Sensitive with active treatment", sensitiveReport(active), { context: [{ path: "safetyState.level", operator: "equals", expected: "stabilize_first" }], effectivePolicies: [{ path: "functional.planMode", operator: "equals", expected: "HOLD" }, { path: "routine.weeklySchedule.activeDaysMax", operator: "equals", expected: 0 }], invariants: [...common, "RAW_POLICY_IMMUTABILITY", "FALLBACK_PROJECTION_ENFORCEMENT"] }, { catalogProducts: [active], expected: { context: [{ path: "safetyState.level", operator: "equals", expected: "stabilize_first" }], effectivePolicies: [{ path: "functional.planMode", operator: "equals", expected: "HOLD" }, { path: "routine.weeklySchedule.activeDaysMax", operator: "equals", expected: 0 }], crossLaneRules: ["DATA_DECISION_ACTIVE_AXIS_ALIGNMENT"], invariants: [...common, "RAW_POLICY_IMMUTABILITY", "FALLBACK_PROJECTION_ENFORCEMENT"] } }),
    scenario("S04_DUPLICATE_ACTIVE_AXIS", "Duplicate active axis", baseReport({}, { currentProducts: { selections: [selected(active), selected(activeB)], summary: { total: 2, selectedCount: 2 } } }), { context: [{ path: "productExposureState.duplicateActiveAxes", operator: "includes", expected: "exfoliation" }], invariants: [...common, "RAW_POLICY_IMMUTABILITY", "FALLBACK_PROJECTION_ENFORCEMENT"] }, { catalogProducts: [active, activeB] }),
    scenario("S05_UNKNOWN_NOT_IN_DB_PRODUCT", "Unknown not in DB", baseReport({}, { currentProducts: { selections: [{ status: "not_in_db", category: "serum", productId: null }], summary: { total: 1, notInDbCount: 1 } } }), { context: [{ path: "productExposureState.unknownProductCount", operator: "equals", expected: 1 }], invariants: [...common, "UNKNOWN_PRODUCT_NON_CAUSATION"] }),
    scenario("S06_SELECTED_NON_EVALUABLE_PRODUCT", "Selected non-evaluable product", baseReport({}, { currentProducts: { selections: [selected(unknown)], summary: { total: 1, selectedCount: 1 } } }), { dataAudit: [{ path: "rows.0.capabilities.functionalProfileEvaluable", operator: "equals", expected: false }], context: [{ path: "productExposureState.rows.0.evaluable", operator: "equals", expected: false }], crossLaneRules: ["DATA_DECISION_ACTIVE_AXIS_ALIGNMENT","DATA_DECISION_UNKNOWN_ALIGNMENT"] }, { catalogProducts: [unknown] }),
    scenario("S07_RECENT_SKIN_CHANGE_NO_PRODUCT_EVIDENCE", "Recent skin change", sensitiveReport(null, { recentSkinChange: "yes" }), { context: [{ path: "safetyState.level", operator: "equals", expected: "stabilize_first" }], invariants: [...common, "PRODUCT_CAUSATION_EVIDENCE"] }),
    scenario("S08_CONFIRMED_PRODUCT_REACTION", "Confirmed product reaction", sensitiveReport(active, { productReaction: "yes", recentSkinChange: "yes" }), { context: [{ path: "conditionSignalState.productReaction", operator: "equals", expected: "yes" }] }, { catalogProducts: [active] }),
    scenario("S09_CLEANSER_WITH_ACTIVE_LABEL", "Cleanser active label", baseReport({}, { currentProducts: { selections: [selected(cleanser)], summary: { total: 1, selectedCount: 1 } } }), { context: [{ path: "productExposureState.rows.0.activeExposure", operator: "equals", expected: false }], dataAudit: [{ path: "rows.0.capabilities.functionalProfileEvaluable", operator: "equals", expected: true }] }, { catalogProducts: [cleanser] }),
    scenario("S10_LEGACY_SERUM_CATEGORY", "Legacy serum category", baseReport({}, { currentProducts: { selections: [selected(serum)], summary: { total: 1, selectedCount: 1 } } }), { dataAudit: [{ path: "rows.0.capabilities.recommendationCategoryReady", operator: "equals", expected: false }, { path: "rows.0.capabilities.currentProductCategoryReady", operator: "equals", expected: true }], crossLaneRules: ["DATA_DECISION_CATEGORY_ALIGNMENT"] }, { catalogProducts: [serum] }),
    scenario("S11_COMPLETE_SUNSCREEN", "Complete sunscreen", baseReport({}, { currentProducts: { selections: [selected(sunscreen)], summary: { total: 1, selectedCount: 1 } } }), { dataAudit: [{ path: "rows.0.capabilities.sunscreenProtectionReady", operator: "equals", expected: true }, { path: "rows.0.capabilities.sunscreenPreferenceReady", operator: "equals", expected: true }], crossLaneRules: ["DATA_DECISION_SUNSCREEN_ALIGNMENT"] }, { catalogProducts: [sunscreen] }),
    scenario("S12_PARTIAL_SUNSCREEN_METADATA", "Partial sunscreen", baseReport({}, { currentProducts: { selections: [selected(partialSun)], summary: { total: 1, selectedCount: 1 } } }), { dataAudit: [{ path: "rows.0.capabilities.sunscreenProtectionReady", operator: "equals", expected: false }, { path: "rows.0.gaps", operator: "array_contains_subset", expected: { code: "SUNSCREEN_METADATA_PARTIAL" } }] }, { catalogProducts: [partialSun] }),
    scenario("S13_INCOMPLETE_PERSISTED_SURVEY_RAW_SOURCE", "Incomplete persisted survey", { freeResult: { priority: { axis: "barrier", score: 20 }, scoring: { concernScores: { barrier: { total: 20 } } } }, conditionResponses: [{ responseKey: "cleansing_load", status: "reduce", title: "legacy", summary: "legacy", reasons: [], action: "legacy" }] }, { context: [{ path: "survey.completeness", operator: "not_equals", expected: "available" }] }),
    scenario("S14_STABILIZATION_FALLBACK_BYPASS_ATTEMPT", "Fallback bypass attempt", { ...sensitiveReport(active, { recentSkinChange: "yes" }), topPick: { id: "stale-top", category: "treatment" }, budgetAlternatives: [{ id: "stale-budget", category: "treatment" }], conditionResponses: [{ responseKey: "active_load", status: "avoid_for_now", legacyCarryover: true }] }, { projections: [{ path: "functionalPlan.productCandidates", operator: "length_equals", expected: 0 }, { path: "functionalPlan.budgetAlternatives", operator: "length_equals", expected: 0 }], invariants: [...common, "RAW_POLICY_IMMUTABILITY", "FALLBACK_PROJECTION_ENFORCEMENT"] }, { catalogProducts: [active] }),
    scenario("S15_LOCALE_PARITY_KO", "Locale parity KO", baseReport(), {}, { logicalScenarioId: "S15_LOCALE_PARITY", variant: "ko", options: { locale: "ko" } }),
    scenario("S15_LOCALE_PARITY_EN", "Locale parity EN", baseReport(), {}, { logicalScenarioId: "S15_LOCALE_PARITY", variant: "en", options: { locale: "en" } }),
    scenario("S16_REBUILD_REVISION", "Rebuild revision", baseReport(), {}, { revisions: [
      { id: "same", operation: "rebuild_same", expected: { hashRelation: "same_as_previous", revisionRelation: "same_as_previous" } },
      { id: "products", operation: "replace_current_products", payload: { selections: [selected(active)], summary: { total: 1, selectedCount: 1 } }, expected: { hashRelation: "different_from_previous", revisionRelation: "increment_by_one" } },
      { id: "survey", operation: "replace_survey_answers", payload: { recentSkinChange: "yes", recentlyChangedProduct: "no", productReaction: "no" }, expected: { hashRelation: "different_from_previous", revisionRelation: "increment_by_one" } }
    ] })
  ],
  comparisons: [{ id: "CMP_S15_KO_EN", type: "locale_structural_parity", leftScenarioId: "S15_LOCALE_PARITY_KO", rightScenarioId: "S15_LOCALE_PARITY_EN", equalPaths: ["context.skinState","context.safetyState","context.productExposureState","consistency.verdict","effectivePolicySource","effectivePolicies.functional.planMode","effectivePolicies.routine.weeklySchedule"] }]
};
export default fixtureManifest;
