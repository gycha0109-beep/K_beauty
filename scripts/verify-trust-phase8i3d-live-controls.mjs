import assert from "node:assert/strict";
import fs from "node:fs";

const workflow = fs.readFileSync(
  ".github/workflows/trust-phase8h3-relocation-revalidation.yml",
  "utf8",
);
const worker = fs.readFileSync(
  "scripts/trust-transport-drift-handoff-worker.mjs",
  "utf8",
);
const liveVerifier = fs.readFileSync(
  "scripts/verify-trust-phase8i3d-live-result.mjs",
  "utf8",
);

assert.ok(workflow.includes("transport_handoff_mode:"));
assert.ok(workflow.includes("Phase 8I-3 transport drift handoff mode"));
assert.ok(workflow.includes("- evaluate"));

const liveCondition =
  "if: github.event_name == 'workflow_dispatch' && inputs.transport_mode == 'none' && inputs.transport_handoff_mode == 'evaluate'";
assert.ok(workflow.includes(liveCondition));

const legacyCondition =
  "if: github.event_name == 'workflow_dispatch' && inputs.transport_mode == 'none' && inputs.transport_handoff_mode == 'none'";
assert.equal(workflow.split(legacyCondition).length - 1, 2);

assert.ok(
  workflow.includes(
    "if: github.event_name == 'schedule' || inputs.transport_mode == 'canary' || inputs.transport_mode == 'full'",
  ),
  "Phase 8I-2 scheduled transport boundary must remain unchanged",
);

const liveStart = workflow.indexOf("  transport_handoff_live:");
assert.ok(liveStart >= 0);
const liveJob = workflow.slice(liveStart);

for (const required of [
  "name: Phase 8I-3D live transport drift evaluation",
  "needs: verify",
  "SUPABASE_URL: https://bygrczggxfuisupcevaz.supabase.co",
  "SUPABASE_SERVICE_ROLE_KEY:",
  'test "$GITHUB_REF" = "refs/heads/main"',
  'test "$(git rev-parse HEAD)" = "$GITHUB_SHA"',
  "trust-phase8i3-transport-drift-evaluation-policy-registry-v1.json",
  "--record=true",
  "--limit=100",
  "verify-trust-phase8i3d-live-result.mjs",
  "actions/upload-artifact@v7",
  "retention-days: 30",
]) {
  assert.ok(liveJob.includes(required), `live handoff boundary missing: ${required}`);
}

assert.equal(
  liveCondition.includes("schedule"),
  false,
  "Phase 8I-3D canary must remain manual-only until post-live closure",
);
assert.equal(
  liveJob.includes("enqueue_trust_official_source_transport_drift_cases_v1"),
  false,
  "manual live evaluation must not perform a second implicit backfill",
);

for (const forbidden of [
  "admin_confirm_trust_official_source_relocation_v1",
  "admin_confirm_product_fact_v1",
  "product_fact_current",
]) {
  assert.equal(
    worker.includes(forbidden),
    false,
    `evaluation worker authority escalation forbidden: ${forbidden}`,
  );
}

for (const required of [
  'assert.equal(result.case_count, 2)',
  'assert.equal(result.evaluated_count, 2)',
  'assert.equal(result.skipped_count, 0)',
  'assert.equal(result.recorded_count, 2)',
  'assert.equal(result.result_counts.POLICY_REQUIRED ?? 0, 0)',
  "NO_AUTOMATIC_RELOCATION_OR_PRODUCT_FACT_MUTATION",
]) {
  assert.ok(liveVerifier.includes(required), `live verifier missing: ${required}`);
}

console.log("TRUST_PHASE8I3D_LIVE_CONTROLS_VERIFIED");
