import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  V21_9L_CONTEXT_BUCKET_VERSION,
  V21_9L_ORGANIC_EVIDENCE_SCHEMA_VERSION,
  buildV21_9LOrganicEvidenceRows,
  validateV21_9LOrganicEvidenceRows
} from "../../lib/exfoliation-normative-policy-organic-evidence-context.js";
import {
  V21_9L_ORGANIC_EVIDENCE_RPC,
  persistV21_9LOrganicEvidenceRows,
  scheduleV21_9LOrganicEvidencePersistence
} from "../../lib/exfoliation-normative-policy-organic-evidence-store.js";

const ROOT = process.cwd();
const MIGRATION = path.join(
  ROOT,
  "supabase/migrations/20260820093000_v21_9l_organic_shadow_evidence_daily_v1.sql"
);
const CONTEXT_FILE = path.join(
  ROOT,
  "lib/exfoliation-normative-policy-organic-evidence-context.js"
);
const STORE_FILE = path.join(
  ROOT,
  "lib/exfoliation-normative-policy-organic-evidence-store.js"
);
const PROVENANCE_FILE = path.join(
  ROOT,
  "lib/exfoliation-normative-policy-production-provenance.js"
);
const DOC_FILE = path.join(
  ROOT,
  "docs/evidence/v21-9l-organic-shadow-evidence-durability-v1.md"
);

const ACTIONS = ["ALLOW", "CAUTION", "RESTRICT", "DEFER", "NOT_APPLICABLE"];
const EXACT_ROW_KEYS = [
  "bucket_date",
  "evidence_schema_version",
  "activation_version",
  "policy_contract_version",
  "runtime_version",
  "production_source",
  "context_bucket_version",
  "partition_key",
  "partition_value",
  "execution_count",
  "candidate_evaluation_count",
  "allow_count",
  "caution_count",
  "restrict_count",
  "defer_count",
  "not_applicable_count",
  "fallback_count",
  "runtime_error_count",
  "hypothetical_exclusion_count",
  "actual_exclusion_count",
  "stop_required_count"
].sort();

function telemetry(overrides = {}) {
  return {
    evidenceType: "normative_policy_runtime_aggregate",
    schemaVersion: "exfoliation-normative-production-policy-runtime-telemetry-v1",
    effectiveMode: "SHADOW",
    runtimeExecutionCount: 164,
    runtimeErrorCount: 0,
    actionCounts: {
      ALLOW: 2,
      CAUTION: 1,
      RESTRICT: 3,
      DEFER: 157,
      NOT_APPLICABLE: 1
    },
    fallbackCount: 0,
    hypotheticalExclusionCount: 3,
    actualNormativeExclusionCount: 0,
    stopRequired: false,
    stopReasons: [],
    activationVersion: "exfoliation-non-numeric-pda-normative-production-policy-activation-v1",
    policyContractVersion: "exfoliation-non-numeric-pda-normative-production-policy-decision-contract-v1",
    runtimeVersion: "exfoliation-non-numeric-pda-normative-production-policy-shadow-v1",
    ...overrides
  };
}

function observation(source, overrides = {}) {
  return {
    productionSource: source,
    effectiveMode: "SHADOW",
    runtimeActive: true,
    canonicalMutationApplied: false,
    restrictCanonicalExclusionCount: 0,
    telemetry: telemetry({ productionSource: source, ...(overrides.telemetry || {}) }),
    ...overrides,
    telemetry: telemetry({ productionSource: source, ...(overrides.telemetry || {}) })
  };
}

const input = {
  skinType: "combination",
  sensitivity: "high",
  mainConcerns: ["barrier", "redness"],
  primaryConcern: "barrier",
  postWashFeeling: "tight",
  afternoonSkinChange: "red_or_irritated",
  cleansingFrequency: "twice",
  environmentExposure: ["aircon"],
  preferredTexture: "gel",
  mostDislikedFeel: "greasy",
  genderPreference: "unspecified",
  recentSkinChange: "yes",
  recentlyChangedProduct: "no",
  sunscreenPreferenceState: "skipped",
  user_id: "must-not-persist",
  sessionToken: "must-not-persist",
  rawImage: "must-not-persist",
  questionnairePayload: { freeText: "must-not-persist" }
};
const NOW = "2026-08-20T09:30:00.000Z";

function rowsFor(source, overrides = {}) {
  return buildV21_9LOrganicEvidenceRows({
    input,
    observation: observation(source, overrides),
    now: NOW
  });
}

function totalRow(rows) {
  return rows.find((row) => row.partition_key === "TOTAL");
}

function partitionRow(rows, key) {
  return rows.find((row) => row.partition_key === key);
}

function assertOnlyBoundedRows(rows) {
  assert.equal(validateV21_9LOrganicEvidenceRows(rows).valid, true);
  for (const row of rows) {
    assert.deepEqual(Object.keys(row).sort(), EXACT_ROW_KEYS);
    assert.equal(row.bucket_date, "2026-08-20");
    assert.equal(row.evidence_schema_version, V21_9L_ORGANIC_EVIDENCE_SCHEMA_VERSION);
    assert.equal(row.context_bucket_version, V21_9L_CONTEXT_BUCKET_VERSION);
  }
}

// T1 — ORGANIC provenance persists only organic aggregate rows.
{
  const rows = rowsFor("ORGANIC_PRODUCTION");
  assertOnlyBoundedRows(rows);
  assert.ok(rows.length >= 6);
  assert.ok(rows.every((row) => row.production_source === "ORGANIC_PRODUCTION"));
}

// T2 — CONTROLLED provenance remains controlled.
{
  const rows = rowsFor("CONTROLLED_PRODUCTION_PROBE");
  assertOnlyBoundedRows(rows);
  assert.ok(rows.every((row) => row.production_source === "CONTROLLED_PRODUCTION_PROBE"));
  assert.ok(rows.every((row) => row.production_source !== "ORGANIC_PRODUCTION"));
}

// T3 — UNKNOWN provenance remains unknown.
{
  const rows = rowsFor("UNKNOWN_PRODUCTION_SOURCE");
  assertOnlyBoundedRows(rows);
  assert.ok(rows.every((row) => row.production_source === "UNKNOWN_PRODUCTION_SOURCE"));
}

// T4 — Missing/malformed provenance fails closed to UNKNOWN, never ORGANIC.
{
  const missing = buildV21_9LOrganicEvidenceRows({
    input,
    observation: {
      effectiveMode: "SHADOW",
      runtimeActive: true,
      telemetry: telemetry({ productionSource: undefined })
    },
    now: NOW
  });
  assertOnlyBoundedRows(missing);
  assert.ok(missing.every((row) => row.production_source === "UNKNOWN_PRODUCTION_SOURCE"));

  const malformed = rowsFor("CALLER_ASSERTED_ORGANIC");
  assertOnlyBoundedRows(malformed);
  assert.ok(malformed.every((row) => row.production_source === "UNKNOWN_PRODUCTION_SOURCE"));
}

// T5 — Context derivation is deterministic and bounded.
{
  const a = rowsFor("ORGANIC_PRODUCTION");
  const b = rowsFor("ORGANIC_PRODUCTION");
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  assert.equal(partitionRow(a, "PRIMARY_CONCERN_CLASS").partition_value, "barrier");
  assert.equal(partitionRow(a, "SENSITIVITY_RISK_CLASS").partition_value, "HIGH");
  assert.equal(partitionRow(a, "CONCERN_STRUCTURE_CLASS").partition_value, "MULTI");
  assert.equal(partitionRow(a, "RECENT_INSTABILITY_CLASS").partition_value, "PRESENT");
}

// T6 — Raw questionnaire/input is not present in persisted rows.
{
  const serialized = JSON.stringify(rowsFor("ORGANIC_PRODUCTION"));
  for (const forbidden of [
    "must-not-persist",
    "user_id",
    "sessionToken",
    "rawImage",
    "questionnairePayload",
    "aircon",
    "greasy"
  ]) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
}

// T7 — Nested/casing/separator variants of forbidden identity/raw keys are rejected.
{
  const base = totalRow(rowsFor("ORGANIC_PRODUCTION"));
  const variants = [
    "userId", "user_id", "USER-ID",
    "sessionToken", "session_token", "authToken", "accessToken", "refreshToken",
    "rawIp", "ipAddress", "rawImage", "photoData",
    "questionnairePayload", "surveyPayload", "requestBody", "responseBody",
    "identifyingFreeText", "productId", "product_name"
  ];
  for (const key of variants) {
    const bad = [{ ...base, nested: { [key]: "x" } }];
    const validation = validateV21_9LOrganicEvidenceRows(bad);
    assert.equal(validation.valid, false, key);
    assert.ok(validation.errors.includes("forbidden_persistence_field"), key);
  }
}

// T8 — Exact action vocabulary is represented by fixed count columns only.
{
  const row = totalRow(rowsFor("ORGANIC_PRODUCTION"));
  assert.equal(row.allow_count, 2);
  assert.equal(row.caution_count, 1);
  assert.equal(row.restrict_count, 3);
  assert.equal(row.defer_count, 157);
  assert.equal(row.not_applicable_count, 1);
  assert.deepEqual(ACTIONS.sort(), ["ALLOW", "CAUTION", "DEFER", "NOT_APPLICABLE", "RESTRICT"].sort());
}

// T9 — Candidate evaluation count aggregation is exact.
{
  assert.equal(totalRow(rowsFor("ORGANIC_PRODUCTION")).candidate_evaluation_count, 164);
}

// T10 — Fallback/runtime-error aggregation is exact.
{
  const rows = rowsFor("ORGANIC_PRODUCTION", {
    telemetry: { fallbackCount: 4, runtimeErrorCount: 2 }
  });
  assert.equal(totalRow(rows).fallback_count, 4);
  assert.equal(totalRow(rows).runtime_error_count, 2);
}

// T11 — SHADOW actual exclusion is structurally rejected when non-zero.
{
  const rows = rowsFor("ORGANIC_PRODUCTION", {
    telemetry: { actualNormativeExclusionCount: 1 }
  });
  assert.deepEqual(rows, []);
}

// T12 — Persistence/scheduling failures never throw into Recommendation authority.
{
  const rows = rowsFor("ORGANIC_PRODUCTION");
  const rpcFailure = await persistV21_9LOrganicEvidenceRows(rows, {
    createClient: () => ({
      rpc: async () => ({ data: null, error: new Error("isolated") })
    })
  });
  assert.equal(rpcFailure.ok, false);

  let afterPromise = null;
  const sentinel = Object.freeze({ recommendation: "unchanged" });
  assert.doesNotThrow(() => {
    const result = scheduleV21_9LOrganicEvidencePersistence(
      { input, observation: observation("ORGANIC_PRODUCTION"), now: NOW },
      {
        force: true,
        afterImpl: (callback) => {
          afterPromise = callback();
        },
        persistImpl: async () => {
          throw new Error("isolated");
        }
      }
    );
    assert.equal(result.scheduled, true);
    assert.deepEqual(sentinel, { recommendation: "unchanged" });
  });
  await afterPromise;
}

const migration = fs.readFileSync(MIGRATION, "utf8");
const contextSource = fs.readFileSync(CONTEXT_FILE, "utf8");
const storeSource = fs.readFileSync(STORE_FILE, "utf8");
const provenanceSource = fs.readFileSync(PROVENANCE_FILE, "utf8");
const docSource = fs.existsSync(DOC_FILE) ? fs.readFileSync(DOC_FILE, "utf8") : "";

// T13 — Concurrent increments use one atomic SQL UPSERT, not application read-modify-write.
{
  assert.match(migration, /on conflict[\s\S]+do update set/i);
  assert.match(migration, /execution_count\s*=\s*recommendation_shadow_evidence_daily_v1\.execution_count\s*\+\s*excluded\.execution_count/i);
  assert.match(migration, /candidate_evaluation_count\s*=\s*recommendation_shadow_evidence_daily_v1\.candidate_evaluation_count\s*\+\s*excluded\.candidate_evaluation_count/i);
  assert.equal(/select[\s\S]+execution_count[\s\S]+update[\s\S]+execution_count/i.test(storeSource), false);
}

// T14 — No high-cardinality idempotency/dedup identifier; replay limitation is explicit.
{
  const schemaAndRuntime = `${migration}\n${contextSource}\n${storeSource}`;
  for (const forbidden of ["request_id", "requestId", "session_id", "sessionId", "user_id", "userId", "idempotency_key"] ) {
    assert.equal(schemaAndRuntime.includes(forbidden), false, forbidden);
  }
  assert.match(docSource, /at-least-once/i);
  assert.match(docSource, /exactly-once/i);
  assert.match(docSource, /자동 재시도|automatic retry/i);
}

// T15 — OFF mode creates no durable evidence rows.
{
  const rows = buildV21_9LOrganicEvidenceRows({
    input,
    observation: {
      ...observation("ORGANIC_PRODUCTION"),
      effectiveMode: "OFF",
      runtimeActive: false
    },
    now: NOW
  });
  assert.deepEqual(rows, []);
}

// T16 — SHADOW context building/scheduling does not mutate canonical input or observation.
{
  const cleanInput = structuredClone(input);
  const obs = observation("ORGANIC_PRODUCTION");
  const cleanObs = structuredClone(obs);
  buildV21_9LOrganicEvidenceRows({ input, observation: obs, now: NOW });
  assert.deepEqual(input, cleanInput);
  assert.deepEqual(obs, cleanObs);
}

// T17 — 9L runtime code does not authorize or implement ENFORCE.
{
  const runtimeOwned = `${contextSource}\n${storeSource}\n${provenanceSource}\n${migration}`;
  assert.equal(/authorizedMode\s*=|enforceActive\s*=|enforcementAllowed\s*=/.test(runtimeOwned), false);
  assert.equal(/EXFOLIATION_NORMATIVE_POLICY_MODE/.test(runtimeOwned), false);
}

// T18 — 9L observability store is structurally separate from Product Fact authority.
{
  const owned = `${migration}\n${contextSource}\n${storeSource}`;
  for (const table of [
    "product_fact_current",
    "product_fact_instances",
    "product_fact_confirmations",
    "product_fact_registry_versions",
    "product_fact_definition_snapshots"
  ]) {
    assert.equal(owned.includes(table), false, table);
  }
  assert.equal(V21_9L_ORGANIC_EVIDENCE_RPC, "record_recommendation_shadow_evidence_daily_v1");
}

console.log("V2.1-9L T1-T18 PASS");
