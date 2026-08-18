#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { buildAll, canonical, OUTPUTS, STAGE, TERMINAL } from "./build-exfoliation-normative-policy-activation-authorization-runtime-safety-v1.mjs";
let assertions = 0;
const ok = (value, message) => { assert.ok(value, message); assertions += 1; };
const eq = (actual, expected, message) => { assert.deepEqual(actual, expected, message); assertions += 1; };
const built = await buildAll();
const { summary, authorization, contract, validation, live, adapter, fixtures } = built;
eq(summary.stage, STAGE, "stage");
eq(summary.terminal, TERMINAL, "terminal");
eq(TERMINAL, "NORMATIVE_PRODUCTION_POLICY_STAGED_SHADOW_ACTIVATION_AUTHORIZED", "terminal enum");
ok(summary.decision.production_activation_authorized === true, "authorization");
eq(summary.decision.authorized_mode, "SHADOW", "authorized mode");
ok(summary.decision.enforce_authorized === false, "enforce unauthorized");
ok(summary.decision.activation_executed === false && summary.decision.runtime_active === false, "not activated");
eq(live.decision, "LIVE_SHADOW_REQUIRED_BEFORE_ENFORCE", "live shadow decision");
eq(live.live_production_traffic_observed_by_9d, 0, "live count");
ok(live.numeric_traffic_threshold_defined === false && live.numeric_duration_threshold_defined === false && live.owner_threshold_invented === false, "no threshold invention");
eq(contract.activation_gate.default, "OFF", "default off");
ok(contract.activation_gate.kill_switch_precedence === "OVERRIDES_ENABLE_AND_MODE", "kill precedence");
ok(contract.activation_gate.trusted_configuration_only === true, "trusted config only");
ok(contract.fallback.policy_action === "DEFER" && contract.fallback.legacy_path_preserved === true && contract.fallback.accidental_restrict_forbidden === true, "fallback");
ok(contract.observability.aggregate_only && contract.observability.raw_product_identity_forbidden && contract.observability.raw_user_payload_forbidden && contract.observability.secrets_forbidden, "telemetry privacy");
eq(contract.production_integration_state, "DORMANT_NOT_CANONICALLY_WIRED_IN_9D", "dormant state");
ok(validation.all_fixtures_pass && validation.fixture_count >= 25 && validation.fixture_count === validation.fixture_pass_count, "fixtures pass");
ok(fixtures.fixtures.every((item) => item.pass), "every fixture pass");
ok(adapter.prerequisite_validated && adapter.active === false && adapter.canonically_wired === false, "adapter dormant validated");
eq(adapter.formula, "existing_eligibility AND normative_policy_eligibility", "eligibility formula");
ok(adapter.score_recomputed === false && adapter.rank_recomputed === false && adapter.order_preserved === true, "no rerank");
eq(summary.evidence_replay.evaluations, 1968, "1968 replay");
eq(summary.evidence_replay.actions, { ALLOW: 2, CAUTION: 12, DEFER: 772, NOT_APPLICABLE: 1176, RESTRICT: 6 }, "actions");
eq(summary.evidence_replay.eligibility, { ELIGIBLE: 1968 }, "eligibility");
eq(summary.evidence_replay.availability, { PRESENT_AT_ENFORCEMENT_BOUNDARY: 1968 }, "availability");
eq(summary.evidence_replay.restrict_positions, [72, 118, 130, 147, 149, 153], "restrict positions");
ok(summary.evidence_replay.top1_changed === 0 && summary.evidence_replay.top3_changed === 0 && summary.evidence_replay.refill_count === 0 && summary.evidence_replay.top_k_insufficient === 0, "bounded impact");
ok(summary.invariants.ACTIVATION_EXECUTED === "NO" && summary.invariants.NORMATIVE_POLICY_RUNTIME_ACTIVE === "NO" && summary.invariants.RESTRICT_CANONICAL_EXCLUSION_ACTIVE === "NO", "activation no flags");
ok(summary.invariants.HOSTED_PRODUCT_FACT_WRITES === 0 && summary.invariants.REGISTRY_DEFINITION_DELTA === 0 && summary.invariants.MIGRATION_DELTA === 0, "hosted zero delta");
ok(summary.invariants.NUMERIC_FITTING === 0 && summary.invariants.POTENCY_ORDERING_CREATED === "NO", "no numeric fitting/potency");
ok(summary.invariants.RECOMMENDATION_SCORER_CHANGED === "NO" && summary.invariants.RECOMMENDATION_RANKER_CHANGED === "NO" && summary.invariants.LEGACY_HEURISTIC_REPLACED === "NO", "production semantics frozen");
ok(authorization.rollout_scope.numeric_percentage_defined === false && authorization.rollout_scope.implicit_user_exposure_authorized === false, "bounded authorization without invented blast radius");
eq(contract.production_integration_state, "DORMANT_NOT_CANONICALLY_WIRED_IN_9D", "9D historical integration state remains dormant");
ok(summary.decision.activation_executed === false && summary.decision.runtime_active === false && summary.decision.enforce_authorized === false, "9D historical runtime remained inactive and unenforced");
if (process.env.V21_9D_REQUIRE_CHECKED_IN === "1") {
  const root = "evidence/product-decision-axis-non-numeric-shadow-v1";
  for (const [mode, file] of Object.entries(OUTPUTS)) {
    eq(fs.readFileSync(path.join(root, file), "utf8"), canonical(built[mode]), `checked-in bytes ${mode}`);
  }
}
process.stdout.write(JSON.stringify({ stage: STAGE, terminal: TERMINAL, assertions, status: "PASS" }) + "\n");