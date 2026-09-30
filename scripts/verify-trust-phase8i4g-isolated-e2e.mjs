import assert from "node:assert/strict";
import fs from "node:fs";

const materializer = fs.readFileSync(
  "scripts/materialize-trust-phase8i4g-isolated-e2e.mjs",
  "utf8",
);
const runner = fs.readFileSync(
  "scripts/run-trust-phase8i4g-isolated-e2e.mjs",
  "utf8",
);
const workflow = fs.readFileSync(
  ".github/workflows/trust-phase8h3-relocation-revalidation.yml",
  "utf8",
);
const seed = fs.readFileSync(
  "tests/fixtures/trust-phase8i4g-e2e/20991231235959_trust_phase8i4g_e2e_seed.sql",
  "utf8",
);

for (const required of [
  "20260928081244_trust_phase8i2_transport_foundation_v1.sql",
  "20260929045848_trust_phase8i3a_drift_case_bridge_v1.sql",
  "20260929110902_trust_phase8i4_grouped_relocation_v1.sql",
  "20260930090756_trust_phase8i4g_canary_read_boundary_v1.sql",
  "production_database_used: false",
  "hosted_branch_used: false",
]) {
  assert.ok(materializer.includes(required), "materializer missing: " + required);
}

for (const required of [
  "record_trust_official_source_transport_observation_v1",
  "enqueueTransportDriftCases",
  "runTransportDriftHandoff",
  'runId: "phase8i3e-scheduled-900001-1"',
  "capturePhase8i4gCanarySnapshot",
  "loadTrustGroupedRelocationQueue",
  "runTrustGroupedRelocationPreflight",
  "confirmTrustGroupedRelocation",
  "FIRST_REAL_CANARY_CLOSED_PASS",
  "protected_authority_unchanged",
]) {
  assert.ok(runner.includes(required), "isolated e2e runner missing: " + required);
}

for (const forbidden of [
  "https://bygrczggxfuisupcevaz.supabase.co",
  "create_branch",
  "admin_confirm_trust_official_source_grouped_relocation_v1",
]) {
  assert.equal(
    runner.includes(forbidden),
    false,
    "isolated runner must not bind Production/hosted or bypass Admin service: " +
      forbidden,
  );
}

assert.ok(
  seed.includes("TEST / LOCAL E2E ONLY. NOT A PRODUCTION MIGRATION."),
);
assert.equal(seed.includes("trust_official_source_transport_incidents"), false);
assert.equal(
  runner.includes('scopedCount(client, "trust_official_source_transport_incidents"'),
  false,
);
assert.equal(
  seed.includes("trust_official_source_transport_drift_evaluations"),
  false,
);
assert.equal(seed.includes("trust_official_source_relocation_groups"), false);
assert.equal(workflow.includes("npx --no-install tsx"), false);

for (const required of [
  "isolated_first_real_canary_e2e:",
  "materialize-trust-phase8i4g-isolated-e2e.mjs",
  "run-trust-phase8i4g-isolated-e2e.mjs",
  "github.event_name != 'schedule'",
  'npx --yes "tsx@4.23.15" --tsconfig jsconfig.json',
]) {
  assert.ok(workflow.includes(required), "workflow e2e contract missing: " + required);
}

console.log(
  JSON.stringify(
    {
      contract: "trust-phase8i4g-isolated-e2e-static-verification-v1",
      result: "PASS",
      production_database_used: false,
      hosted_branch_used: false,
      synthetic_ready_inserted: false,
      synthetic_transport_incident_inserted: false,
      admin_service_bypassed: false,
    },
    null,
    2,
  ),
);
