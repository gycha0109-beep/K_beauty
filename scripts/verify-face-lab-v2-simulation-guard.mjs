import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  FACE_LAB_USAGE_POLICY,
  getFaceLabUsagePolicy
} from "../lib/face-lab-usage-policy.js";

const SIMULATION_ENDPOINT = "face-lab-simulation-test";
const SIMULATION_PATH = "/api/face-lab-simulation-test";
const core = readFileSync(
  "lib/security/analysis-request-guard-core.js",
  "utf8"
);
const migration = readFileSync(
  "supabase/migrations/20261001043000_face_lab_simulation_test_guard_v1.sql",
  "utf8"
);
const guard = readFileSync(
  "lib/security/analysis-request-guard.js",
  "utf8"
);

const simulationUsage = FACE_LAB_USAGE_POLICY.simulationTest;

for (const required of [
  '"face-lab-simulation-test": createFaceLabGuardPolicy(',
  "FACE_LAB_USAGE_POLICY.simulationTest",
  '"/api/face-lab-simulation-test"',
  "requireIdempotency: usagePolicy.requireIdempotency === true"
]) {
  assert.ok(
    core.includes(required),
    "simulation guard policy source missing: " + required
  );
}

assert.equal(simulationUsage.guardEndpoint, SIMULATION_ENDPOINT);
assert.equal(simulationUsage.mode, "simulation-test");
assert.equal(simulationUsage.consumesProductionQuota, false);
assert.equal(simulationUsage.requireIdempotency, true);
assert.equal(getFaceLabUsagePolicy("simulation-test"), simulationUsage);

assert.ok(
  simulationUsage.limits.user.perDay <
    FACE_LAB_USAGE_POLICY.test.limits.user.perDay,
  "simulation UAT user quota must stay below observation-only UAT quota"
);
assert.ok(
  simulationUsage.limits.anonymous.perDay <
    FACE_LAB_USAGE_POLICY.test.limits.anonymous.perDay,
  "simulation UAT anonymous quota must stay below observation-only UAT quota"
);
assert.ok(
  simulationUsage.limits.ip.perDay <
    FACE_LAB_USAGE_POLICY.test.limits.ip.perDay,
  "simulation UAT IP ceiling must stay below observation-only UAT quota"
);

for (const required of [
  "(policy.requireIdempotency === true && idempotencyValidation.missing)",
  'createDeniedResult("invalid_idempotency_key", { httpStatus: 400 })'
]) {
  assert.ok(
    guard.includes(required),
    "simulation idempotency guard missing: " + required
  );
}

for (const required of [
  "analysis_request_rate_windows_endpoint_check",
  "analysis_request_idempotency_endpoint_check",
  "'analyze', 'face-reading', 'face-reading-test', 'face-lab-simulation-test', 'result-read'",
  "'analyze', 'face-reading', 'face-lab-simulation-test'",
  "create or replace function public.consume_analysis_rate_limits",
  "create or replace function public.refund_analysis_rate_limits",
  "create or replace function public.claim_analysis_idempotency",
  "p_endpoint not in ('analyze', 'face-reading', 'face-lab-simulation-test')",
  "security invoker",
  "revoke all on table public.analysis_request_idempotency from public, anon, authenticated",
  "grant select, insert, update, delete on table public.analysis_request_idempotency to service_role",
  "revoke all on function public.claim_analysis_idempotency(text, text, text, text, text, timestamptz, integer) from public, anon, authenticated",
  "grant execute on function public.claim_analysis_idempotency(text, text, text, text, text, timestamptz, integer) to service_role"
]) {
  assert.ok(
    migration.includes(required),
    "simulation guard migration missing: " + required
  );
}

for (const forbidden of [
  "grant execute on function public.claim_analysis_idempotency(text, text, text, text, text, timestamptz, integer) to anon",
  "grant execute on function public.claim_analysis_idempotency(text, text, text, text, text, timestamptz, integer) to authenticated"
]) {
  assert.equal(
    migration.includes(forbidden),
    false,
    "simulation idempotency authority must stay server-only: " + forbidden
  );
}

console.log(JSON.stringify({
  ok: true,
  endpoint: SIMULATION_ENDPOINT,
  path: SIMULATION_PATH,
  productionQuotaConsumed: false,
  idempotencyRequired: true,
  failureQuotaRefund: true,
  limits: simulationUsage.limits
}, null, 2));
