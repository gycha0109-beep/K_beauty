import assert from "node:assert/strict";
import fs from "node:fs";
import {
  POLICY_REGISTRY_CONTRACT,
  runTransportDriftHandoff,
  stableDigest,
} from "./trust-transport-drift-handoff-worker.mjs";

const registryPath =
  "docs/evidence/trust-phase8i3-transport-drift-evaluation-policy-registry-v1.json";
const workerPath = "scripts/trust-transport-drift-handoff-worker.mjs";
const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
const workerSource = fs.readFileSync(workerPath, "utf8");

assert.equal(registry.contract, POLICY_REGISTRY_CONTRACT);
assert.equal(registry.version, "v1");
assert.equal(registry.retry_interval_hours, 6);
assert.equal(registry.policies.length, 2);

const scopes = new Set();
for (const policy of registry.policies) {
  const expectedKey = `product:${policy.product_id}:subject:${policy.subject_id}`;
  assert.equal(policy.policy_key, expectedKey);
  assert.ok(!scopes.has(expectedKey));
  scopes.add(expectedKey);
  assert.ok(policy.historical_source_ids.length >= 1);
  assert.equal(
    policy.direct_qualification_template.governed_subject.product_id,
    policy.product_id,
  );
  assert.equal(
    policy.direct_qualification_template.governed_subject.subject_id,
    policy.subject_id,
  );
  assert.equal(policy.rediscovery_case_template.product_id, policy.product_id);
  assert.equal(policy.rediscovery_case_template.subject_id, policy.subject_id);
}

const ricePolicy = registry.policies.find(
  (p) => p.product_id === "25b2763f-529f-4b2e-a436-2e0776279c55",
);
const aquaPolicy = registry.policies.find(
  (p) => p.product_id === "765b3ca1-6927-49b0-bee6-4138d03dd915",
);
assert.ok(ricePolicy);
assert.ok(aquaPolicy);
assert.equal(ricePolicy.historical_source_ids.length, 3);
assert.equal(
  ricePolicy.direct_qualification_template.reviewed_binding.binding_id,
  "0dae6fce-111e-4d5b-9b6e-d87f95e9a40c",
);
assert.equal(aquaPolicy.direct_qualification_template.reviewed_binding, null);
assert.equal(
  aquaPolicy.rediscovery_case_template.qualification_template.requirements
    .allow_anchor_only_subject_proof,
  false,
);
assert.equal(
  aquaPolicy.rediscovery_case_template.qualification_template.requirements
    .allow_anchor_only_formulation_proof,
  false,
);

function caseFor(policy, overrides = {}) {
  return {
    contract: "trust-phase8i3-drift-case-v1",
    case_id: overrides.case_id || crypto.randomUUID(),
    case_key: overrides.case_key || stableDigest({
      product_id: policy?.product_id || "unknown",
      subject_id: policy?.subject_id || "unknown",
      nonce: overrides.case_id || "fixture",
    }),
    case_digest: overrides.case_digest || overrides.case_key || stableDigest({
      product_id: policy?.product_id || "unknown",
      subject_id: policy?.subject_id || "unknown",
      nonce: overrides.case_id || "fixture",
    }),
    event_id: crypto.randomUUID(),
    event_type: "SOURCE_TRANSPORT_DRIFT",
    event_disposition: "REVIEW_REQUIRED",
    incident_kind: "CONFIRMED_REDIRECT",
    target_key: "official-transport-url-sha256:" + "a".repeat(64),
    product_id: policy?.product_id || "11111111-1111-4111-8111-111111111111",
    subject_id: policy?.subject_id || "22222222-2222-4222-8222-222222222222",
    effective_locator:
      policy?.direct_qualification_template?.historical_source?.canonical_locator ||
      "https://example.com/products/unknown",
    confirmed_final_locator: "https://beautyofjoseon.com/",
    episode_started_at: "2026-09-28T00:00:00.000Z",
    episode_anchor_probe_group_id: "fixture-probe-group",
    route_hint: "REDIRECT_QUALIFICATION",
    incident_ids: [crypto.randomUUID()],
    source_ids: policy ? [...policy.historical_source_ids] : [crypto.randomUUID()],
    latest_evaluation: null,
    ...overrides,
  };
}

function mockClient(cases, recorded) {
  return {
    async rpc(fn, args) {
      if (fn === "get_trust_official_source_transport_drift_cases_v1") {
        return {
          data: {
            contract: "trust-phase8i3-drift-case-list-v1",
            case_count: cases.length,
            cases,
          },
          error: null,
        };
      }
      if (fn === "record_trust_official_source_transport_drift_evaluation_v1") {
        recorded.push(args);
        return {
          data: {
            status: "recorded",
            idempotent: false,
            evaluation_id: crypto.randomUUID(),
            case_id: args.p_case_id,
            result_kind: args.p_result_kind,
            authority_mutation: false,
          },
          error: null,
        };
      }
      return { data: null, error: { code: "UNEXPECTED_RPC", message: fn } };
    },
  };
}

function ambiguousObservation(url) {
  return {
    ok: true,
    final_url: url,
    content_type: "text/html",
    title: "Beauty of Joseon",
    canonical_url: url,
    content_digest: "c".repeat(64),
    text: "Beauty of Joseon official website",
  };
}

function exactRiceRediscovery(batch) {
  const candidate =
    "https://beautyofjoseon.com/products/relief-sun-rice-niacinamide";
  return Promise.resolve({
    contract: "trust-phase8h-official-source-rediscovery-batch-v1",
    authority: "DISCOVERY_AND_QUALIFICATION_EVIDENCE_ONLY_NOT_RELOCATION_AUTHORITY",
    results: [
      {
        case_id: batch.cases[0].case_id,
        disposition: "QUALIFIED_EXACT_CANDIDATE_FOUND",
        exact_candidate_count: 1,
        rediscovery: {
          disposition: "CANDIDATES_DISCOVERED",
          candidate_count: 1,
        },
        qualifications: [
          {
            candidate: {
              candidate_locator: candidate,
              discovery_method: "official_sitemap",
            },
            qualification: {
              contract: "trust-phase8h-source-identity-qualification-v1",
              historical_source_id: batch.cases[0].historical_source_id,
              historical_locator:
                batch.cases[0].qualification_template.historical_source
                  .canonical_locator,
              product_id: batch.cases[0].product_id,
              subject_id: batch.cases[0].subject_id,
              candidate_locator: candidate,
              candidate_source_kind:
                batch.cases[0].qualification_template.candidate_defaults
                  .source_kind,
              discovery_method: "official_sitemap",
              disposition: "QUALIFIED_EXACT",
              reason: "exact_governed_identity_proven",
              qualification_digest: "d".repeat(64),
              mutation_policy: "READ_ONLY_NO_PRODUCTION_WRITE",
              authority:
                "QUALIFICATION_EVIDENCE_ONLY_REQUIRES_GOVERNED_RELOCATION",
            },
          },
        ],
      },
    ],
  });
}

function heldRediscovery(batch) {
  return Promise.resolve({
    contract: "trust-phase8h-official-source-rediscovery-batch-v1",
    authority: "DISCOVERY_AND_QUALIFICATION_EVIDENCE_ONLY_NOT_RELOCATION_AUTHORITY",
    results: [
      {
        case_id: batch.cases[0].case_id,
        disposition: "CANDIDATES_HELD_AFTER_QUALIFICATION",
        exact_candidate_count: 0,
        rediscovery: {
          disposition: "CANDIDATES_DISCOVERED",
          candidate_count: 1,
        },
        qualifications: [
          {
            candidate: {
              candidate_locator:
                "https://beautyofjoseon.com/products/relief-sun-aqua-fresh",
              discovery_method: "external_search_seed",
            },
            qualification: {
              contract: "trust-phase8h-source-identity-qualification-v1",
              candidate_locator:
                "https://beautyofjoseon.com/products/relief-sun-aqua-fresh",
              disposition: "UNSUPPORTED_SEMANTICS",
              reason: "reviewed_subject_lineage_not_proven",
              qualification_digest: "e".repeat(64),
              authority: "NON_AUTHORITATIVE_HOLD",
            },
          },
        ],
      },
    ],
  });
}

const riceCase = caseFor(ricePolicy, {
  case_id: "11111111-1111-4111-8111-111111111111",
});
const aquaCase = caseFor(aquaPolicy, {
  case_id: "22222222-2222-4222-8222-222222222222",
});
const unknownCase = caseFor(null, {
  case_id: "33333333-3333-4333-8333-333333333333",
});
const skippedHoldCase = caseFor(ricePolicy, {
  case_id: "44444444-4444-4444-8444-444444444444",
  latest_evaluation: {
    policy_key: ricePolicy.policy_key,
    policy_version: registry.version,
    result_kind: "HOLD",
    created_at: "2026-09-28T00:00:00.000Z",
  },
});

const recorded = [];
let observeCalls = 0;
let rediscoveryCalls = 0;
const result = await runTransportDriftHandoff({
  client: mockClient(
    [riceCase, aquaCase, unknownCase, skippedHoldCase],
    recorded,
  ),
  registry,
  runId: "phase8i3b-fixture",
  record: true,
  now: () => new Date("2026-09-29T00:00:00.000Z"),
  observeCandidate: async (url) => {
    observeCalls += 1;
    return ambiguousObservation(url);
  },
  runRediscovery: async (batch) => {
    rediscoveryCalls += 1;
    return batch.cases[0].product_id === ricePolicy.product_id
      ? exactRiceRediscovery(batch)
      : heldRediscovery(batch);
  },
});

assert.equal(result.contract, "trust-phase8i3-transport-drift-handoff-result-v1");
assert.equal(result.case_count, 4);
assert.equal(result.evaluated_count, 3);
assert.equal(result.skipped_count, 1);
assert.equal(result.network_evaluation_count, 2);
assert.equal(result.recorded_count, 3);
assert.deepEqual(result.result_counts, {
  READY_FOR_8I4: 1,
  HOLD: 1,
  POLICY_REQUIRED: 1,
});
assert.equal(observeCalls, 2);
assert.equal(rediscoveryCalls, 2);
assert.equal(recorded.length, 3);

const readyRecord = recorded.find((row) => row.p_result_kind === "READY_FOR_8I4");
const holdRecord = recorded.find((row) => row.p_result_kind === "HOLD");
const policyRecord = recorded.find((row) => row.p_result_kind === "POLICY_REQUIRED");
assert.ok(readyRecord);
assert.ok(holdRecord);
assert.ok(policyRecord);
assert.equal(readyRecord.p_evaluation_mode, "REDISCOVERY");
assert.match(readyRecord.p_candidate_locator, /^https:\/\//);
assert.equal(readyRecord.p_qualification_digest, "d".repeat(64));
assert.equal(
  readyRecord.p_result_payload.qualified_historical_source_id,
  ricePolicy.rediscovery_case_template.historical_source_id,
);
assert.equal(
  readyRecord.p_result_payload.rediscovery.qualifications[0].qualification
    .historical_source_id,
  ricePolicy.rediscovery_case_template.historical_source_id,
);
assert.equal(
  readyRecord.p_result_payload.qualified_exact.historical_source_id,
  ricePolicy.rediscovery_case_template.historical_source_id,
);
assert.equal(
  readyRecord.p_result_payload.qualified_exact.disposition,
  "QUALIFIED_EXACT",
);
assert.equal(
  readyRecord.p_result_payload.qualified_exact.qualification_digest,
  readyRecord.p_qualification_digest,
);
assert.equal(holdRecord.p_candidate_locator, null);
assert.equal(policyRecord.p_candidate_locator, null);
assert.equal(
  result.rows.find((row) => row.case_id === unknownCase.case_id).network_used,
  false,
);
assert.equal(
  result.rows.find((row) => row.case_id === skippedHoldCase.case_id).skip_reason,
  "HOLD_STABLE_UNTIL_POLICY_OR_NEW_CASE",
);

const directReadyCase = caseFor(ricePolicy, {
  case_id: "55555555-5555-4555-8555-555555555555",
  confirmed_final_locator:
    "https://beautyofjoseon.com/products/relief-sun-rice-niacinamide",
});
const directRecorded = [];
let directRediscoveryCalls = 0;
const directResult = await runTransportDriftHandoff({
  client: mockClient([directReadyCase], directRecorded),
  registry,
  runId: "phase8i3b-direct",
  record: true,
  observeCandidate: async (url) => ({
    ok: true,
    final_url: url,
    content_type: "text/html",
    title: "Relief Sun Rice + Niacinamide SPF50+",
    canonical_url: url,
    content_digest: "f".repeat(64),
    text: "Relief Sun Rice + Niacinamide SPF50+",
  }),
  runRediscovery: async () => {
    directRediscoveryCalls += 1;
    throw new Error("rediscovery must not run after direct exact qualification");
  },
});
assert.equal(directResult.result_counts.READY_FOR_8I4, 1);
assert.equal(directResult.rows[0].evaluation_mode, "REDIRECT_DIRECT");
assert.equal(
  directRecorded[0].p_result_payload.qualified_historical_source_id,
  ricePolicy.direct_qualification_template.historical_source.source_id,
);
assert.equal(
  directRecorded[0].p_result_payload.direct_qualification.historical_source_id,
  ricePolicy.direct_qualification_template.historical_source.source_id,
);
assert.equal(
  directRecorded[0].p_result_payload.qualified_exact.historical_source_id,
  ricePolicy.direct_qualification_template.historical_source.source_id,
);
assert.equal(
  directRecorded[0].p_result_payload.qualified_exact.disposition,
  "QUALIFIED_EXACT",
);
assert.equal(directRediscoveryCalls, 0);

const missingQualifiedSourceCase = caseFor(ricePolicy, {
  case_id: "77777777-7777-4777-8777-777777777777",
});
await assert.rejects(
  () =>
    runTransportDriftHandoff({
      client: mockClient([missingQualifiedSourceCase], []),
      registry,
      runId: "phase8i3b-missing-qualified-source",
      record: false,
      observeCandidate: async (url) => ambiguousObservation(url),
      runRediscovery: async (batch) => {
        const value = await exactRiceRediscovery(batch);
        delete value.results[0].qualifications[0].qualification
          .historical_source_id;
        return value;
      },
    }),
  /TRUST_PHASE8I3_READY_FOR_8I4_QUALIFIED_SOURCE_LINEAGE_INVALID/,
);

const recentRetryCase = caseFor(ricePolicy, {
  case_id: "66666666-6666-4666-8666-666666666666",
  latest_evaluation: {
    policy_key: ricePolicy.policy_key,
    policy_version: registry.version,
    result_kind: "RETRYABLE",
    created_at: "2026-09-29T00:00:00.000Z",
  },
});
let retryNetwork = 0;
const retryResult = await runTransportDriftHandoff({
  client: mockClient([recentRetryCase], []),
  registry,
  runId: "phase8i3b-retry",
  record: false,
  now: () => new Date("2026-09-29T03:00:00.000Z"),
  observeCandidate: async () => {
    retryNetwork += 1;
    return ambiguousObservation("https://beautyofjoseon.com/");
  },
  runRediscovery: async () => {
    retryNetwork += 1;
    return heldRediscovery({ cases: [{ case_id: "never" }] });
  },
});
assert.equal(retryResult.evaluated_count, 0);
assert.equal(retryResult.skipped_count, 1);
assert.equal(retryResult.rows[0].skip_reason, "RETRY_INTERVAL_NOT_REACHED");
assert.equal(retryNetwork, 0);

for (const forbidden of [
  ".from(",
  "admin_confirm_trust_official_source_relocation_v1",
  "admin_confirm_product_fact_v1",
  "product_fact_current",
  "product_evidence_sources",
  "trust_official_source_relocations",
]) {
  assert.equal(
    workerSource.includes(forbidden),
    false,
    `worker must not contain direct authority mutation path: ${forbidden}`,
  );
}

for (const required of [
  "get_trust_official_source_transport_drift_cases_v1",
  "record_trust_official_source_transport_drift_evaluation_v1",
  "qualifyOfficialSourceIdentity",
  "runRediscoveryQualificationBatch",
  "POLICY_REQUIRED",
  "READY_FOR_8I4",
  "qualified_historical_source_id",
  "qualified_exact",
  "TRUST_PHASE8I3_READY_FOR_8I4_QUALIFIED_SOURCE_LINEAGE_INVALID",
  "RETRY_INTERVAL_NOT_REACHED",
  "HOLD_STABLE_UNTIL_POLICY_OR_NEW_CASE",
  "NO_AUTOMATIC_RELOCATION_OR_PRODUCT_FACT_MUTATION",
]) {
  assert.ok(workerSource.includes(required), `worker contract missing: ${required}`);
}

console.log("TRUST_PHASE8I3B_EVALUATION_WORKER_VERIFIED");
