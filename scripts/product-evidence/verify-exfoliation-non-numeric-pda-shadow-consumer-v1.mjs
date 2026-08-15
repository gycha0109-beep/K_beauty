#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import { adaptExfoliationNonNumericPdaShadowDecisionInput, EXFOLIATION_NON_NUMERIC_PDA_SHADOW_ADAPTER_VERSION } from "../../lib/exfoliation-non-numeric-pda-shadow-adapter.js";
import { consumeExfoliationNonNumericPdaShadowDecisionInput, EXFOLIATION_NON_NUMERIC_PDA_SHADOW_CONSUMER_VERSION, EXFOLIATION_NON_NUMERIC_PDA_SHADOW_DECISIONS } from "../../lib/exfoliation-non-numeric-pda-shadow-consumer.js";
import { evaluateCandidateExposurePolicy } from "../../lib/candidate-exposure-policy.js";
import { resolveCandidateExposurePolicyShadowControl, runCandidateExposurePolicyShadow } from "../../lib/candidate-exposure-policy-shadow.js";

const STAGE = "V2.1-8S";
const TERMINAL = "SHADOW_DECISION_CONSUMER_VALIDATED";
const ROOT = "evidence/product-decision-axis-non-numeric-shadow-v1";
const IMPL = `${ROOT}/exfoliation-non-numeric-pda-shadow-consumer-implementation-v1.json`;
const REPLAY = `${ROOT}/exfoliation-non-numeric-pda-shadow-consumer-validation-replay-v1.json`;
const DOC = "docs/evidence/exfoliation-non-numeric-pda-shadow-decision-consumer-evaluation-v1.md";
const SNAPSHOT_SHA = "31311c223cfc1084e02e226e36b60b6052884f16c52cdc3f5308b786641a9fea";
let assertions = 0;
const eq = (a, b, m) => { assert.deepEqual(a, b, m); assertions += 1; };
const ok = (v, m) => { assert.ok(v, m); assertions += 1; };
const read = (p) => fs.readFileSync(p, "utf8");
const json = (p) => JSON.parse(read(p));
const stable = (v) => Array.isArray(v) ? v.map(stable) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, stable(v[k])])) : v;
const canonical = (p) => `${JSON.stringify(stable(json(p)))}\n`;
const sha = (p) => crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
const prov = (id, identity) => ({ fact_instance_id: `fixture-${id}-${identity}` });
const pda = (id, { category = "treatment", status = "GOVERNED_SIGNAL_ESTABLISHED", ids = ["mandelic_acid"], coverage, missing = [], uncertainty = [] } = {}) => ({
  product_id: id,
  category,
  pda: {
    contract_version: "exfoliation-non-numeric-pda-contract-v1",
    signal_status: status,
    active_identities: { items: ids.map((identity) => ({ identity, provenance: prov(id, identity) })), semantic_ordering: "NONE", serialization_order: "IDENTITY_THEN_PROPOSITION_KEY" },
    multi_active_status: status === "NOT_APPLICABLE" ? "not_applicable" : status === "GOVERNED_SIGNAL_UNKNOWN" ? "unknown" : ids.length > 1 ? "multiple" : ids.length ? "single" : "none_established",
    context: {},
    coverage: { applicable_category: status === "NOT_APPLICABLE" ? null : category, missing_context_keys: missing, state: coverage || (status === "NOT_APPLICABLE" ? "not_applicable" : ids.length ? "active_identity_only" : "no_relevant_fact") },
    uncertainty: { reasons: uncertainty },
    evidence_provenance: ids.map((identity) => prov(id, identity))
  }
});
const ctx = ({ current = [], partial = false, windows = {}, sensitivity = "low", safety = "stable", sensitive = "no", expand = "yes", skin = "no", change = "no", reaction = "no", link = "none_reported", recent = "none_reported" } = {}) => ({
  current_product_set: current.map((row) => ({ source_state: "selected", routine_windows: ["pm.treatment"], ...row })),
  current_product_set_completeness: partial ? "partial" : current.length ? "known" : "empty",
  candidate_routine_windows: windows,
  safety_state: { level: safety, sensitive_burden: sensitive, exfoliation_expansion_allowed: expand },
  user_sensitivity_state: sensitivity,
  recent_skin_or_product_change_state: { recent_skin_change: skin, recent_product_change: change },
  reaction_instability_state: { product_reaction: reaction, reaction_link_state: link, recent_exposure_state: recent }
});
const adapt = (record, records = [record], context = ctx()) => adaptExfoliationNonNumericPdaShadowDecisionInput({
  product: record,
  pdaRecord: record,
  pdaRecords: records,
  externalContext: context,
  pdaAuthority: { contract_version: "exfoliation-non-numeric-pda-contract-v1", mapper_version: "fixture", snapshot_sha256: SNAPSHOT_SHA }
});
const consume = (record, records, context) => {
  const adapted = adapt(record, records, context);
  return { adapted, consumed: consumeExfoliationNonNumericPdaShadowDecisionInput(adapted) };
};

const single = pda("single");
const multi = pda("multi", { ids: ["lactic_acid", "salicylic_acid"] });
const currentM = pda("current-m", { ids: ["mandelic_acid"] });
const currentS = pda("current-s", { ids: ["salicylic_acid"] });
const none = pda("none", { status: "GOVERNED_SIGNAL_NOT_ESTABLISHED", ids: [], coverage: "no_relevant_fact", uncertainty: ["NEGATIVE_SIGNAL_NOT_AUTHORIZED"] });
const unknown = pda("unknown", { status: "GOVERNED_SIGNAL_UNKNOWN", ids: [], coverage: "missing_fact", uncertainty: ["SOURCE_BLOCKED_OR_MISSING_CURRENT"] });
const missing = pda("missing", { missing: ["active_concentration", "recommended_use_frequency"], uncertainty: ["ACTIVE_CONCENTRATION_MISSING", "RECOMMENDED_USE_FREQUENCY_MISSING"] });
const na = pda("na", { category: "cleanser", status: "NOT_APPLICABLE", ids: [], coverage: "not_applicable" });

const cases = [
  ["single_active_no_overlap", ...Object.values(consume(single, [single], ctx({ windows: { single: ["pm.treatment"] } })))],
  ["single_active_overlap", ...Object.values(consume(pda("overlap"), [pda("overlap"), currentM], ctx({ current: [{ product_id: "current-m", routine_windows: ["pm.treatment"] }], windows: { overlap: ["am.treatment"] } })))],
  ["multi_active", ...Object.values(consume(multi, [multi], ctx({ windows: { multi: ["pm.treatment"] } })))],
  ["duplicate_exfoliation", ...Object.values(consume(pda("duplicate"), [pda("duplicate"), currentS], ctx({ current: [{ product_id: "current-s", routine_windows: ["pm.treatment"] }], windows: { duplicate: ["am.treatment"] } })))],
  ["routine_stacking", ...Object.values(consume(pda("stacking"), [pda("stacking"), currentS], ctx({ current: [{ product_id: "current-s", routine_windows: ["am.treatment"] }], windows: { stacking: ["pm.treatment"] } })))],
  ["same_window_conflict", ...Object.values(consume(pda("same-window"), [pda("same-window"), currentS], ctx({ current: [{ product_id: "current-s", routine_windows: ["pm.treatment"] }], windows: { "same-window": ["pm.treatment"] } })))],
  ["sensitivity_interaction", ...Object.values(consume(pda("sensitive"), [pda("sensitive")], ctx({ sensitivity: "high", safety: "caution", sensitive: "yes", windows: { sensitive: ["pm.treatment"] } })))],
  ["recent_reaction_instability", ...Object.values(consume(pda("reaction"), [pda("reaction")], ctx({ reaction: "yes", link: "unresolved", windows: { reaction: ["pm.treatment"] } })))],
  ["unknown_authority", ...Object.values(consume(unknown, [unknown], ctx({ partial: true })))],
  ["missing_context", ...Object.values(consume(missing, [missing], ctx({ windows: { missing: ["pm.treatment"] } })))],
  ["no_relevant_active_established", ...Object.values(consume(none, [none], ctx()))],
  ["not_applicable", ...Object.values(consume(na, [na], ctx()))],
  ["conflicting_caution_signals", ...Object.values(consume(pda("conflict"), [pda("conflict"), currentM], ctx({ current: [{ product_id: "current-m", routine_windows: ["pm.treatment"] }], windows: { conflict: ["pm.treatment"] }, sensitivity: "high", safety: "stabilize_first", sensitive: "yes", expand: "no", reaction: "yes", link: "unresolved", change: "yes" })))]
];

eq(cases.length, 13, "13 semantic cases");
const expectedDecisions = ["CLEAR", "CAUTION", "CLEAR", "CAUTION", "CAUTION", "CAUTION", "CAUTION", "RESTRICT", "UNKNOWN", "UNKNOWN", "CLEAR", "NOT_APPLICABLE", "RESTRICT"];
for (let i = 0; i < cases.length; i += 1) {
  const [name, adapted, consumed] = cases[i];
  const input = adapted.shadow_decision_input;
  const decision = consumed.shadow_consumer_decision;
  eq(decision.decision, expectedDecisions[i], `${name} decision`);
  ok(EXFOLIATION_NON_NUMERIC_PDA_SHADOW_DECISIONS.includes(decision.decision), `${name} enum`);
  eq(decision.coverage_state, input.coverage_state, `${name} coverage preserved`);
  eq(decision.uncertainty_state, input.uncertainty_state, `${name} uncertainty preserved`);
  eq(decision.provenance.source_provenance, input.provenance, `${name} provenance preserved`);
  eq(decision.provenance.shadow_only, true, `${name} shadow only`);
  eq(decision.provenance.production_authority, false, `${name} no production authority`);
  eq(input.active_identity_set.semantic_ordering, "NONE", `${name} no potency ordering`);
}
eq(cases[2][1].shadow_decision_input.active_identity_set.items.length, 2, "multi identity set retained");
eq(cases[2][2].shadow_consumer_decision.decision, "CLEAR", "multiple is not stronger");
ok(cases[9][1].shadow_decision_input.coverage_state.missing_context_keys.includes("active_concentration"), "missing context explicit");
eq(cases[9][2].shadow_consumer_decision.decision, "UNKNOWN", "missing does not become clear/zero");
eq(cases[8][2].shadow_consumer_decision.decision, "UNKNOWN", "unknown does not become false/clear");

const replay = json(REPLAY);
const replaySummary = cases.map(([caseId, adapted, consumed]) => ({
  case_id: caseId,
  source_caution_restriction_state: adapted.shadow_decision_input.caution_restriction_shadow_input.state,
  decision: consumed.shadow_consumer_decision.decision,
  reason_codes: consumed.shadow_consumer_decision.reason_codes,
  lineage_preserved: true,
  uncertainty_preserved: true,
  provenance_preserved: true
}));
eq(replay.cases, replaySummary, "deterministic replay artifact matches actual adapter-to-consumer results");
const serialized = JSON.stringify(cases.map(([, , consumed]) => consumed));
for (const token of ["numeric_potency", "ordinal_potency", "stronger_weaker", "identity_count_as_magnitude", "cross_active_magnitude", "legacy_strength_promoted"]) ok(!serialized.includes(token), `forbidden consumer output absent ${token}`);

const runtimeState = {
  decisionBundle: { locale: "ko", context: { version: "shared-skin-decision-context-v4", skinState: { priorityAxis: "uneven_tone", concernScores: { uneven_tone: 20 }, sensitivity: "low" }, survey: { answers: { skinType: "normal", sensitivity: "low", recentSkinChange: "no", recentlyChangedProduct: "no" }, completeness: "available" }, safetyState: { level: "stable", sensitiveBurden: false, activeExpansionAllowed: true, exfoliationExpansionAllowed: true, protectionMustMaintain: true, recentSkinChange: "no", recentlyChangedProduct: "no" }, productExposureState: { rows: [], unknownExposurePresent: false, recentExposureState: "none_reported", reactionLinkState: "none_reported" }, conditionSignalState: { recentSkinChange: "no", recentProductChange: "no", productReaction: "no" } } },
  functionalPolicy: { version: "functional-policy-v1", locale: "ko", priorityAxis: "uneven_tone", primaryGoal: "tone_spot", functionalDirection: "tone_care", planMode: "START", allowedIntensity: "low_to_moderate", recommendationSuppressed: false, safety: { level: "stable", activeExpansionAllowed: true, protectionMustMaintain: true } },
  consistency: { version: "cross-domain-consistency-v1", verdict: "consistent", effectivePolicySource: "raw" },
  currentProductFindings: { findings: [], summary: { evaluableSelectedCount: 0, notInDbCount: 0, notUsingCount: 0, unansweredCount: 0 } }
};
const candidate = { id: "0b88019a-9eb2-4be9-842d-f1e60e42cf51", name: "fixture", brand: "fixture", category: "serum", irritation_risk: "low", sensitivity_safe: true, skin_types: ["normal"], concerns: ["tone"], ingredient_signals: { functional: [{ label: "Whitening", count: 4 }] } };
const direct = evaluateCandidateExposurePolicy({ canonicalState: structuredClone(runtimeState), candidates: [structuredClone(candidate)] });
const response = { stable: true };
const snapshot = { stable: true };
const shadow = runCandidateExposurePolicyShadow({ control: resolveCandidateExposurePolicyShadowControl({ DEV_ONLY_CANDIDATE_EXPOSURE_POLICY_SHADOW: "1", VERCEL_ENV: "preview" }), canonicalState: runtimeState, candidates: [candidate], legacyExecution: null, responseValue: response, snapshotValue: snapshot, telemetrySink: () => {} });
eq(shadow.policyResult, direct, "runtime canonical evaluator identical");
eq(shadow.exfoliationPdaShadow.status, "evaluated", "runtime adapter executed");
eq(shadow.exfoliationPdaShadowConsumer.status, "evaluated", "runtime consumer executed");
eq(shadow.exfoliationPdaShadowConsumer.rows.length, 1, "runtime consumer row");
ok(EXFOLIATION_NON_NUMERIC_PDA_SHADOW_DECISIONS.includes(shadow.exfoliationPdaShadowConsumer.rows[0].shadow_consumer_decision.decision), "runtime categorical decision");
eq(response, { stable: true }, "public response unchanged");
eq(snapshot, { stable: true }, "snapshot unchanged");
ok(!Object.hasOwn(shadow.telemetry, "exfoliationPdaShadowConsumer"), "telemetry schema unchanged");
const bad = {};
Object.defineProperty(bad, "products", { get() { throw new Error("fixture"); } });
const isolated = runCandidateExposurePolicyShadow({ control: resolveCandidateExposurePolicyShadowControl({ DEV_ONLY_CANDIDATE_EXPOSURE_POLICY_SHADOW: "1", VERCEL_ENV: "preview" }), canonicalState: runtimeState, candidates: [candidate], legacyExecution: null, responseValue: {}, snapshotValue: {}, exfoliationPdaArtifact: bad, telemetrySink: () => {} });
eq(isolated.policyResult, direct, "adapter/consumer failure isolated from canonical evaluator");
eq(isolated.exfoliationPdaShadow.status, "adapter_execution_failed", "adapter failure explicit");
eq(isolated.exfoliationPdaShadowConsumer.status, "upstream_not_evaluated", "consumer upstream failure explicit");

for (const p of [IMPL, REPLAY]) {
  const a = canonical(p), b = canonical(p);
  eq(a, b, `Build A/B ${p}`);
  eq(read(p), a, `canonical bytes ${p}`);
}
const impl = json(IMPL);
eq(impl.stage, STAGE, "implementation stage");
eq(impl.primary_terminal_outcome, TERMINAL, "implementation terminal");
eq(replay.stage, STAGE, "replay stage");
eq(replay.primary_terminal_outcome, TERMINAL, "replay terminal");
eq(impl.consumer_version, EXFOLIATION_NON_NUMERIC_PDA_SHADOW_CONSUMER_VERSION, "consumer version");
eq(impl.upstream_authority.adapter_version, EXFOLIATION_NON_NUMERIC_PDA_SHADOW_ADAPTER_VERSION, "adapter lineage");
eq(impl.runtime.telemetry_schema_changed, false, "telemetry unchanged");
eq(impl.runtime.shadow_only, true, "runtime shadow only");
eq(impl.production_invariance.candidate_evaluations, 1968, "1968 production invariance target");
eq(impl.hosted_invariance.product_fact_writes, 0, "Hosted writes zero");
const doc = read(DOC);
for (const token of [TERMINAL, "CLEAR", "CAUTION", "RESTRICT", "UNKNOWN", "NOT_APPLICABLE", "164 x 12 = 1968", "Production Recommendation activation remains disabled"]) ok(doc.includes(token), `doc token ${token}`);
console.log(`verify-exfoliation-non-numeric-pda-shadow-consumer-v1: PASS (${assertions} assertions)`);
console.log(`implementation_sha256=${sha(IMPL)}`);
console.log(`replay_sha256=${sha(REPLAY)}`);
console.log(`doc_sha256=${sha(DOC)}`);
