#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  establishRelocationFreshBaseline,
  verifyRelocatedSource,
} from "./trust-source-verification-worker.mjs";

const blueprintPath = "docs/evidence/trust-phase8h3-relocation-aware-verification-db-blueprint-v1.sql";
const workerPath = "scripts/trust-source-verification-worker.mjs";
const blueprint = fs.readFileSync(blueprintPath, "utf8");
const worker = fs.readFileSync(workerPath, "utf8");

for (const token of [
  "get_official_source_relocation_verification_target_v1",
  "v_relocation.result <> 'confirmed'",
  "v_old_binding.binding_state <> 'retired'",
  "v_replacement_binding.binding_state <> 'resolved'",
  "v_replacement_review.scope_relation <> 'equivalent'",
  "v_historical_source.canonical_locator is distinct from v_relocation.old_locator",
  "'canonical_baseline', v_profile.canonical_baseline",
  "grant execute on function public.get_official_source_relocation_verification_target_v1(uuid)",
  "to service_role",
]) {
  assert.ok(blueprint.includes(token), `missing relocation resolver contract token: ${token}`);
}

for (const forbidden of [
  "update public.product_evidence_sources",
  "update public.product_evidence_records",
  "update public.product_fact_current",
  "insert into public.product_fact_instances",
  "admin_confirm_product_fact_v1(",
]) {
  assert.ok(!blueprint.toLowerCase().includes(forbidden.toLowerCase()), `resolver must remain read-only: ${forbidden}`);
}

for (const token of [
  'WORKER_VERSION = "trust-source-verification-worker-v3"',
  "establishRelocationFreshBaseline",
  "verifyRelocatedSource",
  "get_official_source_relocation_verification_target_v1",
  "SOURCE_RELOCATION_TARGET_DRIFT",
  "SOURCE_RELOCATION_PROFILE_TARGET_MISMATCH",
  'observation_mode: "confirmed-official-source-relocation"',
  'mode === "relocation-baseline"',
  'mode === "relocation-verify"',
  'relocationId: argValue("relocation-id")',
]) {
  assert.ok(worker.includes(token), `missing relocation-aware worker token: ${token}`);
}

assert.ok(
  worker.includes("fetchOfficialBytes(target.canonical_locator, fetchImpl)"),
  "generic source verification must continue to fetch the historical target canonical locator",
);

const replacementLocator = "https://example.com/products/niacinamide-serum?variant=1";
const historicalSourceId = "11111111-1111-4111-8111-111111111111";
const relocationId = "22222222-2222-4222-8222-222222222222";
const replacementBindingId = "33333333-3333-4333-8333-333333333333";
const replacementReviewId = "44444444-4444-4444-8444-444444444444";
const actorUserId = "55555555-5555-4555-8555-555555555555";
const html = `<!doctype html><html><head>
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"Product","name":"Niacinamide 20% Serum","description":"Niacinamide serum with 20 percent concentration."}
</script>
<title>Niacinamide 20% Serum</title>
</head><body>Official product page</body></html>`;

function response(body, { status = 200, headers = {} } = {}) {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      ...headers,
    },
  });
}

const state = {
  profile: null,
  baselineArgs: null,
  verificationArgs: null,
};

const client = {
  async rpc(fn, args) {
    if (fn === "get_official_source_relocation_verification_target_v1") {
      assert.equal(args.p_relocation_id, relocationId);
      return {
        data: {
          relocation_id: relocationId,
          historical_source_id: historicalSourceId,
          replacement_binding_id: replacementBindingId,
          replacement_review_id: replacementReviewId,
          replacement_locator: replacementLocator,
          source_metadata: {},
          verification_profile: state.profile,
        },
        error: null,
      };
    }

    if (fn === "admin_register_product_evidence_source_verification_profile_v1") {
      state.baselineArgs = args;
      state.profile = {
        profile_id: "66666666-6666-4666-8666-666666666666",
        baseline_content_digest: args.p_baseline_content_digest,
        digest_basis: args.p_digest_basis,
        adapter_key: args.p_adapter_key,
        adapter_version: args.p_adapter_version,
        comparability_state: "COMPARABLE",
        baseline_kind: args.p_baseline_kind,
        canonical_baseline: args.p_canonical_baseline,
        profile_digest: "a".repeat(64),
      };
      return { data: state.profile, error: null };
    }

    if (fn === "record_product_evidence_source_verification_v2") {
      state.verificationArgs = args;
      return {
        data: {
          verification_id: "77777777-7777-4777-8777-777777777777",
          verification_result: args.p_verification_result,
          observed_content_digest: args.p_observed_content_digest,
        },
        error: null,
      };
    }

    return { data: null, error: { code: "UNEXPECTED_RPC", message: fn } };
  },
};

const fetchStable = async () => response(html);

await establishRelocationFreshBaseline(client, {
  relocationId,
  actorUserId,
  requestId: "phase8h3-test-baseline",
  fetchImpl: fetchStable,
});

assert.equal(state.baselineArgs.p_source_id, historicalSourceId);
assert.equal(state.baselineArgs.p_baseline_kind, "fresh_recovery");
assert.equal(state.baselineArgs.p_digest_basis, "canonical-official-product-semantics-v1");
assert.equal(state.baselineArgs.p_adapter_key, "official-product-semantic");
assert.equal(state.baselineArgs.p_adapter_version, "v1");
assert.equal(state.baselineArgs.p_canonical_baseline.final_url, replacementLocator);
assert.equal(state.baselineArgs.p_canonical_baseline.observed_final_url, replacementLocator);
assert.equal(state.baselineArgs.p_profile_metadata.relocation_id, relocationId);
assert.equal(state.baselineArgs.p_profile_metadata.observation_mode, "confirmed-official-source-relocation");

const verification = await verifyRelocatedSource(client, {
  relocationId,
  requestId: "phase8h3-test-verification",
  fetchImpl: fetchStable,
});

assert.equal(verification.verification_result, "unchanged");
assert.equal(state.verificationArgs.p_verification_profile_id, state.profile.profile_id);
assert.equal(state.verificationArgs.p_observed_content_digest, state.profile.baseline_content_digest);
assert.equal(state.verificationArgs.p_verification_result, "unchanged");
assert.equal(state.verificationArgs.p_verification_metadata.final_url, replacementLocator);
assert.equal(state.verificationArgs.p_verification_metadata.observed_final_url, replacementLocator);
assert.equal(state.verificationArgs.p_verification_metadata.relocation_id, relocationId);

let redirectCalls = 0;
const fetchDrift = async () => {
  redirectCalls += 1;
  if (redirectCalls === 1) {
    return response("", {
      status: 302,
      headers: { location: "https://example.org/different-product" },
    });
  }
  return response(html);
};

await assert.rejects(
  establishRelocationFreshBaseline(client, {
    relocationId,
    actorUserId,
    requestId: "phase8h3-test-drift",
    fetchImpl: fetchDrift,
  }),
  /SOURCE_RELOCATION_TARGET_DRIFT/,
);

console.log("TRUST_PHASE8H3_RELOCATION_AWARE_VERIFICATION=PASS");
