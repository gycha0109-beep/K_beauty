import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { enqueueTransportDriftCases } from "./trust-transport-drift-case-enqueue.mjs";
import { runTransportDriftHandoff } from "./trust-transport-drift-handoff-worker.mjs";
import { capturePhase8i4gCanarySnapshot } from "./trust-phase8i4g-canary-snapshot.mjs";
import { buildCanaryActivationSignal } from "./trust-phase8i4g-canary-activation-signal.mjs";
import {
  confirmTrustGroupedRelocation,
  loadTrustGroupedRelocationQueue,
  runTrustGroupedRelocationPreflight,
} from "../lib/admin/trust-grouped-relocation.js";

const CONTRACT = "trust-phase8i4g-isolated-e2e-v1";
const ACTOR = "92000000-0000-4000-8000-000000004001";
const PRODUCT = "94000000-0000-4000-8000-000000004001";
const SUBJECT = "95000000-0000-4000-8000-000000004001";
const OLD = "https://official.example.test/products/e2e-sunscreen";
const REPLACEMENT =
  "https://official.example.test/products/e2e-sunscreen-successor";
const REGISTRY_PATH =
  "tests/fixtures/trust-phase8i4g-e2e/policy-registry-v1.json";

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`TRUST_PHASE8I4G_E2E_ENV_REQUIRED:${name}`);
  return value;
}

async function rpc(client, name, args = {}) {
  const { data, error } = await client.rpc(name, args);
  if (error) {
    throw new Error(
      `TRUST_PHASE8I4G_E2E_RPC_FAILED:${name}:${error.code || "RPC"}:${error.message}`,
    );
  }
  return data;
}

async function scopedCount(client, table, configure = null) {
  let query = client.from(table).select("*", { count: "exact", head: true });
  if (configure) query = configure(query);
  const { count, error } = await query;
  if (error) throw new Error(`TRUST_PHASE8I4G_E2E_COUNT_FAILED:${table}`);
  return count ?? 0;
}

const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
const client = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const result = {
  contract: CONTRACT,
  result: "FAIL",
  production_database_used: false,
  hosted_branch_used: false,
  stages: {},
};

const waiting = await loadTrustGroupedRelocationQueue({
  actorUserId: ACTOR,
  limit: 20,
});
assert.equal(waiting.count, 0);
assert.equal(waiting.canary.state, "WAITING_FOR_REAL_READY_FOR_8I4");
result.stages.initial_admin_queue = "PASS";

const beforeProtected = {
  instances: await scopedCount(client, "product_fact_instances", (q) =>
    q.eq("subject_id", SUBJECT),
  ),
  current: await scopedCount(client, "product_fact_current", (q) =>
    q.eq("subject_id", SUBJECT),
  ),
  confirmations: await scopedCount(client, "product_fact_confirmations"),
  recommendations: await scopedCount(client, "recommendation_logs", (q) =>
    q.eq("product_id", PRODUCT),
  ),
};
assert.equal(beforeProtected.instances, 1);
assert.equal(beforeProtected.current, 1);
assert.equal(beforeProtected.recommendations, 0);
result.stages.fixture_materialized = "PASS";

const targets = await rpc(
  client,
  "get_trust_official_source_transport_targets_v1",
);
assert.equal(targets.contract, "trust-official-source-transport-targets-v1");
assert.equal(targets.ready_source_count, 3);
assert.equal(targets.unique_ready_target_count, 1);
assert.equal(targets.targets.length, 3);
for (const target of targets.targets) {
  assert.equal(target.product_ids.length, 1);
  assert.equal(target.product_ids[0], PRODUCT);
  assert.equal(target.subject_ids.length, 1);
  assert.equal(target.subject_ids[0], SUBJECT);
  assert.equal(target.effective_locator, OLD);
}

for (let index = 0; index < targets.targets.length; index += 1) {
  const target = targets.targets[index];
  const base = {
    p_source_id: target.source_id,
    p_target_key: target.target_key,
    p_transport_result: "REDIRECTED",
    p_http_status: 200,
    p_final_locator: REPLACEMENT,
    p_redirect_chain: [
      { status: 301, from: OLD, to: REPLACEMENT },
    ],
    p_worker_version: "trust-phase8i4g-isolated-e2e-v1",
    p_transport_metadata: {
      fixture: CONTRACT,
      network_used: false,
    },
  };
  const first = await rpc(
    client,
    "record_trust_official_source_transport_observation_v1",
    {
      ...base,
      p_request_id: `phase8i4g-e2e-r1-${index + 1}`,
      p_probe_group_id: "phase8i4g-e2e-probe-r1",
      p_checked_at: "2026-09-30T00:00:00Z",
    },
  );
  assert.equal(first.status, "recorded");

  const second = await rpc(
    client,
    "record_trust_official_source_transport_observation_v1",
    {
      ...base,
      p_request_id: `phase8i4g-e2e-r2-${index + 1}`,
      p_probe_group_id: "phase8i4g-e2e-probe-r2",
      p_checked_at: "2026-09-30T00:31:00Z",
    },
  );
  assert.equal(second.status, "recorded");
  assert.ok(second.incident_id);
}
assert.equal(
  await scopedCount(client, "trust_official_source_transport_incidents"),
  3,
);
result.stages.transport_incidents = "PASS";

const enqueue = await enqueueTransportDriftCases({ client, limit: 100 });
assert.equal(enqueue.contract, "trust-phase8i3-drift-case-enqueue-result-v1");
assert.equal(enqueue.candidate_count, 1);
assert.equal(enqueue.new_case_count, 1);
assert.equal(enqueue.new_link_count, 3);
assert.equal(enqueue.blocked_count, 0);

const cases = await rpc(
  client,
  "get_trust_official_source_transport_drift_cases_v1",
  { p_limit: 100 },
);
assert.equal(cases.case_count, 1);
const driftCase = cases.cases[0];
assert.equal(driftCase.incident_kind, "CONFIRMED_REDIRECT");
assert.equal(driftCase.route_hint, "REDIRECT_QUALIFICATION");
assert.equal(driftCase.effective_locator, OLD);
assert.equal(driftCase.confirmed_final_locator, REPLACEMENT);
assert.equal(driftCase.source_ids.length, 3);
assert.equal(driftCase.incident_ids.length, 3);
result.stages.drift_case = "PASS";

const registry = JSON.parse(await fs.readFile(REGISTRY_PATH, "utf8"));
const evaluation = await runTransportDriftHandoff({
  client,
  registry,
  runId: "phase8i3e-scheduled-900001-1",
  limit: 100,
  record: true,
  now: () => new Date("2026-09-30T01:00:00Z"),
  observeCandidate: async (candidateLocator) => ({
    ok: true,
    final_url: candidateLocator,
    content_type: "text/html; charset=utf-8",
    title: "E2E Sunscreen SPF50+ – E2E Official",
    canonical_url: candidateLocator,
    content_digest: "a".repeat(64),
    text: "E2E Sunscreen SPF50+ deterministic official product page.",
  }),
  runRediscovery: async () => {
    throw new Error("TRUST_PHASE8I4G_E2E_UNEXPECTED_REDISCOVERY");
  },
});
assert.equal(evaluation.case_count, 1);
assert.equal(evaluation.evaluated_count, 1);
assert.equal(evaluation.recorded_count, 1);
assert.equal(evaluation.result_counts.READY_FOR_8I4, 1);
assert.equal(evaluation.rows[0].result_kind, "READY_FOR_8I4");
assert.match(
  evaluation.rows[0].recorder_result?.evaluation_id || "",
  /^[0-9a-f-]{36}$/i,
);
result.stages.scheduled_evaluation = "PASS";
result.stages.ready_for_8i4 = "PASS";

const snapshot = await capturePhase8i4gCanarySnapshot({
  client,
  limit: 1000,
  now: () => new Date("2026-09-30T01:01:00Z"),
});
assert.equal(snapshot.state, "REAL_READY_DETECTED_REQUIRES_ADMIN_PREFLIGHT");
assert.equal(snapshot.candidate_count, 1);
assert.equal(snapshot.candidates[0].canary_rank, 1);
assert.equal(snapshot.candidates[0].provenance.eligible, true);
assert.equal(
  snapshot.candidates[0].provenance.kind,
  "PHASE8I3E_SCHEDULED_REAL",
);
const activation = buildCanaryActivationSignal(snapshot);
assert.equal(
  activation.state,
  "FIRST_REAL_CANARY_ADMIN_ATTENTION_REQUIRED",
);
assert.equal(activation.automatic_confirmation, false);
result.stages.canary_detection = "PASS";

const queue = await loadTrustGroupedRelocationQueue({
  actorUserId: ACTOR,
  limit: 20,
});
assert.equal(queue.count, 1);
assert.equal(queue.canary.state, "FIRST_REAL_CANARY_READY_FOR_ADMIN_PREFLIGHT");
assert.equal(queue.items[0].canary.isFirstRealCanary, true);
assert.equal(queue.items[0].canary.confirmationAllowed, true);
result.stages.admin_queue = "PASS";

const preflight = await runTrustGroupedRelocationPreflight({
  actorUserId: ACTOR,
  caseId: queue.items[0].caseId,
  evaluationId: queue.items[0].evaluationId,
});
assert.equal(preflight.status, "ready_for_explicit_admin_confirmation");
assert.equal(preflight.canaryProvenance.eligible, true);
assert.equal(preflight.historicalSourceIds.length, 3);
assert.equal(preflight.incidentIds.length, 3);
assert.match(preflight.preflightHash, /^[0-9a-f]{64}$/);
result.stages.admin_preflight = "PASS";

const confirmed = await confirmTrustGroupedRelocation({
  actorUserId: ACTOR,
  caseId: preflight.caseId,
  evaluationId: preflight.evaluationId,
  preflightHash: preflight.preflightHash,
});
assert.equal(confirmed.status, "confirmed");
assert.ok(confirmed.groupId);
assert.ok(confirmed.relocationId);
assert.equal(confirmed.historicalSourceCount, 3);
assert.equal(confirmed.incidentCount, 3);
assert.equal(confirmed.productFactWrites, 0);
assert.equal(confirmed.evidenceSourceWrites, 0);
assert.equal(confirmed.recommendationWrites, 0);
assert.equal(confirmed.semanticResolutionWrites, 0);
assert.equal(
  confirmed.canaryClosurePack?.state,
  "FIRST_REAL_CANARY_CLOSED_PASS",
);
assert.equal(confirmed.canaryClosurePack?.authorityInvariant, "PASS");
assert.equal(confirmed.canaryClosurePack?.groupedLineage, "PASS");
assert.equal(confirmed.canaryClosurePack?.idempotentReplay, "PASS");
assert.equal(confirmed.canaryClosurePack?.phase8h3Handoff, "PASS");
assert.equal(confirmed.canaryClosurePack?.closureAudit, "PASS");
assert.equal(
  confirmed.canaryClosurePack?.nextGroupedConfirmationAllowed,
  true,
);
result.stages.grouped_confirmation = "PASS";
result.stages.idempotent_replay = "PASS";
result.stages.authority_invariants = "PASS";
result.stages.lineage = "PASS";
result.stages.phase8h3_handoff = "PASS";
result.stages.closure_audit = "PASS";

const afterProtected = {
  instances: await scopedCount(client, "product_fact_instances", (q) =>
    q.eq("subject_id", SUBJECT),
  ),
  current: await scopedCount(client, "product_fact_current", (q) =>
    q.eq("subject_id", SUBJECT),
  ),
  confirmations: await scopedCount(client, "product_fact_confirmations"),
  recommendations: await scopedCount(client, "recommendation_logs", (q) =>
    q.eq("product_id", PRODUCT),
  ),
};
assert.deepEqual(afterProtected, beforeProtected);

const closedQueue = await loadTrustGroupedRelocationQueue({
  actorUserId: ACTOR,
  limit: 20,
});
assert.equal(closedQueue.canary.state, "FIRST_REAL_CANARY_CLOSED_PASS");
assert.equal(closedQueue.canary.closurePass, true);

result.result = "PASS";
result.case_id = preflight.caseId;
result.evaluation_id = preflight.evaluationId;
result.group_id = confirmed.groupId;
result.relocation_id = confirmed.relocationId;
result.protected_authority_unchanged = true;
result.automatic_semantic_authority = false;
process.stdout.write(JSON.stringify(result, null, 2) + "\n");
