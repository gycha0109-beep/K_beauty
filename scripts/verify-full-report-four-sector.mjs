import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { conditionItems, functionalMatrix, intakeSignal, reviewItems, productName, saved, verdictForSelection, groupVerdicts, selectionForVerdict } from "../lib/full-report-view.js";
import { buildPremiumConditionProjection } from "../lib/premium-condition-projection.js";

const report = { currentProductVerdicts: [
  { slotKey: "pm.functional.treatment", status: "hold" },
  { slotKey: "pm.cleanse.cleanser", status: "adjust" },
  { slotKey: "am.protect.sunscreen", status: "check_needed" },
  { slotKey: "pm.moisturize.moisturizer", status: "keep" }
] };
const before = JSON.stringify(report);
assert.deepEqual(reviewItems(report).map((x) => x.status), ["hold", "check_needed", "adjust"]);
assert.equal(JSON.stringify(report), before, "display ordering must not mutate a saved report");
for (const mode of [undefined, "UNKNOWN", "HOLD"]) {
  assert.deepEqual(functionalMatrix(report, { planMode: mode, productCandidates: [{ name: "private candidate" }] }).next, []);
}
assert.equal(functionalMatrix(report, { planMode: "START", productCandidates: [{}] }).next.length, 1);
assert.deepEqual(functionalMatrix(report, { planMode: "START", candidateExposureSuppressed: true, productCandidates: [{}] }).next, []);
assert.equal(functionalMatrix(report, {}).keep[0], report.currentProductVerdicts[3]);
assert.deepEqual(conditionItems({ responses: [] }, [{ responseKey: "legacy" }]), []);
const legacy = [{ responseKey: "legacy", action: "Original guidance" }];
assert.equal(conditionItems(null, legacy)[0], legacy[0]);
assert.equal(saved({ routinePlan: [], decisionBundle: { routinePlan: ["old"] } }, "routinePlan").length, 0);
assert.equal(intakeSignal({ premiumIntake: { answers: { productReaction: "yes" } } }, "productReaction"), "unknown");
assert.equal(intakeSignal({ premiumIntake: { stepStates: { recentContext: "skipped" }, answers: { productReaction: "yes" } } }, "productReaction"), "skipped");
assert.equal(intakeSignal({ premiumIntake: { stepStates: { recentContext: "answered" }, answers: { productReaction: "no" } } }, "productReaction"), "no");
assert.notEqual(productName({ status: "not_in_db" }), productName({ status: "not_using" }));
assert.notEqual(productName({ status: "not_using" }), productName({ status: "unanswered" }));
const selected = { category: "cleanser", status: "selected", productId: "current" };
const joined = { currentProducts: { selections: [selected, { category: "sunscreen", status: "not_in_db" }] }, currentProductVerdicts: [{ slotKey: "am.cleanser", productId: "current", status: "keep" }, { slotKey: "pm.cleanser", productId: "current", status: "keep" }, { slotKey: "am.sunscreen", status: "check_needed" }] };
assert.equal(verdictForSelection(joined, selected, "am"), joined.currentProductVerdicts[0]);
assert.equal(verdictForSelection(joined, { ...selected, status: "not_using" }, "am"), null);
assert.equal(verdictForSelection(joined, { ...selected, productId: "other" }, "am"), null);
assert.equal(selectionForVerdict(joined, { slotKey: "am.cleanser", productId: "other" }), null);
assert.equal(selectionForVerdict(joined, joined.currentProductVerdicts[2]).status, "not_in_db");
assert.equal(groupVerdicts(joined, joined.currentProductVerdicts).length, 2);
assert.equal(groupVerdicts(joined, joined.currentProductVerdicts)[0].items.length, 2);
assert.equal(productName({ status: "not_using", productSnapshot: { name: "stale product" } }), "사용 안 함");
assert.equal(productName({ status: "unanswered", productSnapshot: { name: "stale product" } }), "사용 여부 미응답");
const oldVerdict = { slotKey: "am.protect.sunscreen", status: "check_needed" };
assert.equal(verdictForSelection({ currentProductVerdicts: [oldVerdict] }, { status: "not_in_db", category: "sunscreen" }, "am", ["am.protect.sunscreen"]), oldVerdict);

const scenario = { conditionKey: "dryness_tightness", triggerState: "active", responseLevel: "reduce", maintainRoles: ["hydration", "future_role"], reduceActions: ["cleansing_friction"], reduceRoles: ["optional_role"], pauseRoles: ["optional_actives"], returnCriteria: ["tightness_signal_resolved"], escalationCriteria: ["persistent_discomfort"], evidenceKeys: ["survey:postWashFeeling"] };
const policy = { scenarios: [scenario] };
for (const locale of ["ko", "en"]) {
  const projection = buildPremiumConditionProjection({ conditionPolicy: policy, locale });
  for (const key of ["maintainRoles", "reduceActions", "reduceRoles", "pauseRoles", "returnCriteria", "escalationCriteria", "evidenceKeys"]) {
    assert.deepEqual(projection.conditionPlan.responses[0][key], scenario[key], `${locale}: lossless ${key}`);
    assert.deepEqual(projection.conditionResponses[0][key], scenario[key]);
  }
  assert.notEqual(projection.conditionPlan.responses[0].maintainRoles, scenario.maintainRoles);
}
const withoutRoles = buildPremiumConditionProjection({ conditionPolicy: { scenarios: [{ ...scenario, reduceRoles: undefined }] } });
assert.equal("reduceRoles" in withoutRoles.conditionResponses[0], false, "do not alias reduceActions as reduceRoles");
const carry = buildPremiumConditionProjection({ report: { conditionResponses: legacy }, conditionPolicy: { scenarios: [], conditionSignalState: { completeness: "minimal" } } });
assert.equal(carry.conditionPlan.responses[0].action, legacy[0].action);
assert.equal(carry.conditionPlan.responses[0].maintainRoles, undefined, "legacy role evidence stays absent");
const page = readFileSync(new URL("../app/result/full-report/page.js", import.meta.url), "utf8");
const order = page.match(/const SKIN_MATCH_SECTION_ORDER = \[([\s\S]*?)\];/)[1];
assert.deepEqual([...order.matchAll(/"([^"]+)"/g)].map((x) => x[1]), ["today-start-hub", "morning-routine", "problem-tracking", "product-plan", "adjustment-guide"]);
console.log("Full Report four-sector authority, suppression, unknown, legacy and projection checks: PASS");
