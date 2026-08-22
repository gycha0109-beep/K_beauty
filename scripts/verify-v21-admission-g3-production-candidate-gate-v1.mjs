#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  RECOMMENDATION_ADMISSION_AUTHORITY_READ_CONTRACT_VERSION,
  noRecommendationAdmissionAuthority,
  normalizeRecommendationAdmissionAuthorityPayload,
} from "../lib/recommendation-admission-authority-contract.mjs";
import {
  RECOMMENDATION_CANDIDATE_ADMISSION_CONTRACT_VERSION,
  RECOMMENDATION_CANDIDATE_ADMISSION_TYPE,
  RECOMMENDATION_CANDIDATE_ADMISSION_MAX_NONLEGACY_READS,
  RecommendationCandidateAdmissionInfrastructureError,
  admitRecommendationProductsWithDependencies,
  evaluateRecommendationCandidateAdmission,
  projectAdmittedRecommendationProducts,
} from "../lib/recommendation-candidate-admission-core.mjs";
import {
  LEGACY_RECOMMENDATION_CORPUS_COUNT,
  LEGACY_RECOMMENDATION_CORPUS_IDS,
  LEGACY_RECOMMENDATION_CORPUS_SHA256,
  isExactLegacyRecommendationCorpusMember,
} from "../lib/recommendation-legacy-corpus-v1.mjs";
import {
  RECOMMENDATION_PRODUCT_ENUMERATION_VERSION,
  RecommendationProductEnumerationError,
  enumerateRecommendationProductsDeterministically,
} from "../lib/recommendation-product-enumerator.mjs";
import {
  INITIAL_ADMISSION_POLICY_VERSION,
} from "./product-evidence/initial-admission-grant-policy-v1.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURE_PATH = path.join(ROOT, "fixtures/recommendation-governance/g3-production-candidate-admission-v1.json");
const CORPUS_PATH = path.join(ROOT, "fixtures/recommendation-governance/legacy-frozen-recommendation-corpus-v1.txt");
const PRODUCT_SOURCE_PATH = path.join(ROOT, "lib/product-source.js");
const fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, "utf8"));
const results = {};

function record(id, detail = "PASS") {
  results[id] = detail;
}

function syntheticUuid(index) {
  return `00000000-0000-4000-8000-${index.toString(16).padStart(12, "0")}`;
}

function product(id, category = "treatment") {
  return Object.freeze({ id, category, brand: "Synthetic", name: `Synthetic ${id}` });
}

function fact({
  semanticStatus = "supported",
  identity = "salicylic_acid",
  factKey = "contains_active",
  propositionKey = "a".repeat(64),
} = {}) {
  return {
    proposition_key: propositionKey,
    fact_instance_id: "22222222-2222-4222-8222-222222222222",
    subject_id: "11111111-1111-4111-8111-111111111111",
    confirmation_id: "33333333-3333-4333-8333-333333333333",
    fact_key: factKey,
    registry_version: "product-fact-registry-cross-category-v1",
    proposition_serializer_version: "product-fact-proposition-pilot-v1",
    semantic_status: semanticStatus,
    value_type: "entity_identifier",
    value_boolean: null,
    value_enum: null,
    value_number: null,
    value_unit: null,
    value_range_min: null,
    value_range_max: null,
    value_entity_identifier: identity,
    parent_proposition_key: null,
    parent_fact_instance_id: null,
    authority_ceiling: "product_specific_primary",
    fused_confidence: "high",
    valid_from: null,
    valid_to: null,
  };
}

function resolvedAuthority(productId, category = "treatment", { semanticStatus = "supported" } = {}) {
  return normalizeRecommendationAdmissionAuthorityPayload({
    read_contract_version: RECOMMENDATION_ADMISSION_AUTHORITY_READ_CONTRACT_VERSION,
    status: "AUTHORITY_RESOLVED",
    product: {
      product_id: productId,
      category,
    },
    subject: {
      subject_id: "11111111-1111-4111-8111-111111111111",
      product_id: productId,
      subject_identity_serializer_version: "product-fact-subject-identity-v1",
      identity_status: "resolved",
      identity_resolution_version: "catalog-evidence-research-wave-1-identity-v1",
      current_state: "current",
      valid_from: null,
      valid_to: null,
    },
    registry: {
      registry_version: "product-fact-registry-cross-category-v1",
      registry_checksum: "79d41ac13de8080df5199543e31ad7bbc1c1763836ef776313613b7547b79575",
      identity_serializer_version: "product-fact-subject-identity-v1",
    },
    current_facts: [fact({ semanticStatus })],
  });
}

function mockPageFetcher(rows) {
  const frozen = [...rows].sort((a, b) => a.id.localeCompare(b.id));
  return async ({ afterId, limit }) => {
    const start = afterId == null ? 0 : frozen.findIndex((row) => row.id > afterId);
    if (start < 0) return [];
    return frozen.slice(start, start + limit);
  };
}

async function assertInfrastructureFailure(promise, reason) {
  await assert.rejects(
    promise,
    (error) =>
      error instanceof RecommendationCandidateAdmissionInfrastructureError &&
      error.reason === reason,
  );
}

async function verifyEnumeration() {
  const legacyRows = LEGACY_RECOMMENDATION_CORPUS_IDS.map((id) => ({ id }));
  const e1 = await enumerateRecommendationProductsDeterministically({
    fetchPage: mockPageFetcher(legacyRows),
    pageSize: 50,
  });
  assert.equal(e1.enumeratedCount, 164);
  assert.deepEqual(e1.rows.map((row) => row.id), LEGACY_RECOMMENDATION_CORPUS_IDS);
  record("E1");

  const over500Rows = Array.from({ length: 601 }, (_, index) => ({ id: syntheticUuid(index + 1) }));
  const e2 = await enumerateRecommendationProductsDeterministically({
    fetchPage: mockPageFetcher(over500Rows),
    pageSize: 128,
  });
  assert.equal(e2.enumeratedCount, 601);
  assert.equal(new Set(e2.rows.map((row) => row.id)).size, 601);
  record("E2");

  assert.equal(e2.rows[127].id, over500Rows[127].id);
  assert.equal(e2.rows[128].id, over500Rows[128].id);
  record("E3");

  const e4 = await enumerateRecommendationProductsDeterministically({
    fetchPage: mockPageFetcher(over500Rows),
    pageSize: 128,
  });
  const listA = e2.rows.map((row) => row.id);
  const listB = e4.rows.map((row) => row.id);
  assert.deepEqual(listA, listB);
  const hashA = crypto.createHash("sha256").update(`${JSON.stringify(listA)}\n`).digest("hex");
  const hashB = crypto.createHash("sha256").update(`${JSON.stringify(listB)}\n`).digest("hex");
  assert.equal(hashA, hashB);
  record("E4", hashA);

  let calls = 0;
  await assert.rejects(
    enumerateRecommendationProductsDeterministically({
      pageSize: 2,
      fetchPage: async () => {
        calls += 1;
        if (calls === 2) throw new Error("synthetic_page_failure");
        return [{ id: syntheticUuid(1) }, { id: syntheticUuid(2) }];
      },
    }),
    (error) => error instanceof RecommendationProductEnumerationError && error.reason === "PAGE_QUERY_FAILED",
  );
  record("E5");

  await assert.rejects(
    enumerateRecommendationProductsDeterministically({
      pageSize: 3,
      fetchPage: async () => [
        { id: syntheticUuid(1) },
        { id: syntheticUuid(1) },
      ],
    }),
    (error) => error instanceof RecommendationProductEnumerationError && error.reason === "DUPLICATE_PRODUCT_ID",
  );
  record("E6");
}

async function verifyLegacy() {
  const first = LEGACY_RECOMMENDATION_CORPUS_IDS[0];
  let readerCalls = 0;
  const legacyDecision = await evaluateRecommendationCandidateAdmission(product(first), {
    reader: async () => {
      readerCalls += 1;
      return noRecommendationAdmissionAuthority("SHOULD_NOT_BE_CALLED");
    },
  });
  assert.equal(legacyDecision.admissionType, RECOMMENDATION_CANDIDATE_ADMISSION_TYPE.LEGACY);
  assert.equal(readerCalls, 0);
  record("L1");

  const nonmember = syntheticUuid(700);
  await evaluateRecommendationCandidateAdmission(product(nonmember), {
    reader: async () => {
      readerCalls += 1;
      return noRecommendationAdmissionAuthority("CANONICAL_PRODUCT_NOT_FOUND");
    },
  });
  assert.equal(readerCalls, 1);
  record("L2");

  assert.equal(isExactLegacyRecommendationCorpusMember(first.toUpperCase()), false);
  record("L3");

  assert.equal(isExactLegacyRecommendationCorpusMember(nonmember), false);
  record("L4");

  const before = [...LEGACY_RECOMMENDATION_CORPUS_IDS];
  const simulatedCatalog = [...before.map((id) => ({ id })), { id: nonmember }];
  assert.equal(simulatedCatalog.length, 165);
  assert.deepEqual(LEGACY_RECOMMENDATION_CORPUS_IDS, before);
  record("L5");

  simulatedCatalog.reverse();
  simulatedCatalog.pop();
  assert.deepEqual(LEGACY_RECOMMENDATION_CORPUS_IDS, before);
  record("L6");

  const corpusText = fs.readFileSync(CORPUS_PATH, "utf8");
  const corpusHash = crypto.createHash("sha256").update(corpusText, "utf8").digest("hex");
  assert.equal(LEGACY_RECOMMENDATION_CORPUS_COUNT, 164);
  assert.equal(corpusHash, LEGACY_RECOMMENDATION_CORPUS_SHA256);
  assert.equal(corpusText.endsWith("\n"), true);
  record("L7", corpusHash);
}

async function verifyFocusedAdmissionCases() {
  const id = syntheticUuid(800);
  const valid = resolvedAuthority(id, "treatment");

  const g1 = await evaluateRecommendationCandidateAdmission(product(id), {
    reader: async () => valid,
  });
  assert.equal(g1.admissionType, RECOMMENDATION_CANDIDATE_ADMISSION_TYPE.INITIAL_GRANT);
  assert.equal(g1.g2.decision, "INITIAL_ADMISSION_GRANT");
  record("G1");

  const g2 = await evaluateRecommendationCandidateAdmission(product(syntheticUuid(801)), {
    reader: async () => noRecommendationAdmissionAuthority("CANONICAL_PRODUCT_NOT_FOUND"),
  });
  assert.equal(g2.admissionType, RECOMMENDATION_CANDIDATE_ADMISSION_TYPE.REJECTED);
  record("G2");

  const g3 = await evaluateRecommendationCandidateAdmission(product(syntheticUuid(802)), {
    reader: async () => noRecommendationAdmissionAuthority("REQUIRED_CURRENT_FACT_MISSING:contains_active"),
  });
  assert.equal(g3.admissionType, RECOMMENDATION_CANDIDATE_ADMISSION_TYPE.REJECTED);
  record("G3");

  assert.equal(g1.pda.signal_status, "GOVERNED_SIGNAL_ESTABLISHED");
  assert.equal(g1.pda.active_identities.items[0].identity, "salicylic_acid");
  record("G4");

  const insufficientId = syntheticUuid(803);
  const g5 = await evaluateRecommendationCandidateAdmission(product(insufficientId), {
    reader: async () => resolvedAuthority(insufficientId, "treatment", { semanticStatus: "evidence_insufficient" }),
  });
  assert.equal(g5.admissionType, RECOMMENDATION_CANDIDATE_ADMISSION_TYPE.REJECTED);
  assert.equal(g5.pda.signal_status, "GOVERNED_SIGNAL_UNKNOWN");
  assert.equal(g5.pda.uncertainty.reasons.includes("EVIDENCE_INSUFFICIENT"), true);
  record("G5");

  const conflictId = syntheticUuid(804);
  const g6 = await evaluateRecommendationCandidateAdmission(product(conflictId), {
    reader: async () => resolvedAuthority(conflictId, "treatment", { semanticStatus: "evidence_conflict" }),
  });
  assert.equal(g6.admissionType, RECOMMENDATION_CANDIDATE_ADMISSION_TYPE.REJECTED);
  assert.equal(g6.pda.signal_status, "GOVERNED_SIGNAL_BLOCKED");
  assert.equal(g6.pda.uncertainty.reasons.includes("CONFLICTING_GOVERNED_FACT"), true);
  record("G6");

  const unsupportedId = syntheticUuid(805);
  const g7 = await evaluateRecommendationCandidateAdmission(product(unsupportedId, "cleanser"), {
    reader: async () => resolvedAuthority(unsupportedId, "cleanser"),
  });
  assert.equal(g7.admissionType, RECOMMENDATION_CANDIDATE_ADMISSION_TYPE.REJECTED);
  assert.equal(g7.g2.reasons.includes("INITIAL_ADMISSION_AUTHORITY_INSUFFICIENT"), true);
  record("G7");

  await assertInfrastructureFailure(
    evaluateRecommendationCandidateAdmission(product(syntheticUuid(806)), {
      reader: async () => noRecommendationAdmissionAuthority("MALFORMED_RPC_OUTPUT"),
    }),
    "MALFORMED_RPC_OUTPUT",
  );
  record("G8");

  await assertInfrastructureFailure(
    evaluateRecommendationCandidateAdmission(product(syntheticUuid(807)), {
      reader: async () => noRecommendationAdmissionAuthority("PF_AUTHORITY_READ_TIMEOUT"),
    }),
    "PF_AUTHORITY_READ_TIMEOUT",
  );
  record("G9");

  await assertInfrastructureFailure(
    evaluateRecommendationCandidateAdmission(product(syntheticUuid(808)), {
      reader: async () => noRecommendationAdmissionAuthority("READ_CONTRACT_VERSION_MISMATCH"),
    }),
    "READ_CONTRACT_VERSION_MISMATCH",
  );
  record("G10");

  const nonGrantId = syntheticUuid(809);
  const g11 = await evaluateRecommendationCandidateAdmission(product(nonGrantId), {
    reader: async () => resolvedAuthority(nonGrantId, "treatment"),
    g2Evaluator: () => ({ decision: "NO_GRANT", grant: false, reasons: ["SYNTHETIC_NON_GRANT"] }),
  });
  assert.equal(g11.admissionType, RECOMMENDATION_CANDIDATE_ADMISSION_TYPE.REJECTED);
  assert.equal(g11.reasonCodes.includes("SYNTHETIC_NON_GRANT"), true);
  record("G11");

  let projectorCalls = 0;
  const projected = projectAdmittedRecommendationProducts(
    { decisions: [g11] },
    (row) => {
      projectorCalls += 1;
      return row;
    },
  );
  assert.equal(projectorCalls, 0);
  assert.deepEqual(projected, []);
  record("G12");
}

async function verifyAdmissionSetAndScaleBound() {
  const legacy = LEGACY_RECOMMENDATION_CORPUS_IDS.slice(0, 3).map((id) => product(id));
  const grantId = syntheticUuid(900);
  const rejectId = syntheticUuid(901);
  const admitted = await admitRecommendationProductsWithDependencies(
    [...legacy, product(grantId), product(rejectId)],
    {
      reader: async (productId) =>
        productId === grantId
          ? resolvedAuthority(productId, "treatment")
          : noRecommendationAdmissionAuthority("CANONICAL_PRODUCT_NOT_FOUND"),
    },
  );
  assert.deepEqual(admitted.summary, {
    enumeratedCount: 5,
    legacyAdmittedCount: 3,
    nonlegacyCheckedCount: 2,
    nonlegacyGrantedCount: 1,
    nonlegacyRejectedCount: 1,
    authorityFailureCount: 0,
    concurrency: 1,
    maxNonlegacyReads: RECOMMENDATION_CANDIDATE_ADMISSION_MAX_NONLEGACY_READS,
  });

  const tooMany = Array.from(
    { length: RECOMMENDATION_CANDIDATE_ADMISSION_MAX_NONLEGACY_READS + 1 },
    (_, index) => product(syntheticUuid(1000 + index)),
  );
  let calls = 0;
  await assertInfrastructureFailure(
    admitRecommendationProductsWithDependencies(tooMany, {
      reader: async () => {
        calls += 1;
        return noRecommendationAdmissionAuthority("CANONICAL_PRODUCT_NOT_FOUND");
      },
    }),
    "NONLEGACY_AUTHORITY_READ_SCALE_CEILING_EXCEEDED",
  );
  assert.equal(calls, 0);
  record("N_PLUS_ONE_BOUND", `${RECOMMENDATION_CANDIDATE_ADMISSION_MAX_NONLEGACY_READS}/request; concurrency=1`);
}

function verifyProductionSourceOrdering() {
  const source = fs.readFileSync(PRODUCT_SOURCE_PATH, "utf8");
  assert.equal(source.includes(".limit(500)"), false);
  assert.equal(source.includes('.order("id", { ascending: true })'), true);
  assert.equal(source.includes("enumerateRecommendationProductsDeterministically"), true);
  assert.equal(source.includes("admitRecommendationProducts(data)"), true);
  assert.equal(source.includes("admittedRows.filter"), true);

  const admissionIndex = source.indexOf("admission = await admitRecommendationProducts(data)");
  const projectionIndex = source.indexOf("projectAdmittedRecommendationProducts(admission");
  const normalizationIndex = source.indexOf("const builtProduct = buildSupabaseProduct(product)");
  assert.ok(admissionIndex > 0);
  assert.ok(projectionIndex > admissionIndex);
  assert.ok(normalizationIndex > projectionIndex);
  record("ORDERING_INVARIANT");
}

async function main() {
  assert.equal(fixture.version, "g3-production-candidate-admission-fixtures-v1");
  assert.deepEqual(fixture.cases.map((entry) => entry.id), Array.from({ length: 12 }, (_, index) => `G${index + 1}`));
  assert.equal(RECOMMENDATION_CANDIDATE_ADMISSION_CONTRACT_VERSION, "production-recommendation-candidate-admission-v1");
  assert.equal(RECOMMENDATION_PRODUCT_ENUMERATION_VERSION, "recommendation-product-enumeration-v1");
  assert.equal(INITIAL_ADMISSION_POLICY_VERSION, "initial-admission-grant-policy-v1");

  await verifyEnumeration();
  await verifyLegacy();
  await verifyFocusedAdmissionCases();
  await verifyAdmissionSetAndScaleBound();
  verifyProductionSourceOrdering();

  for (const id of fixture.enumeration) assert.ok(results[id]);
  for (const id of fixture.legacy) assert.ok(results[id]);
  for (const entry of fixture.cases) assert.ok(results[entry.id]);

  process.stdout.write(`${JSON.stringify({
    stage: "V2.1-ADMISSION-G3",
    result: "PASS",
    contractVersion: RECOMMENDATION_CANDIDATE_ADMISSION_CONTRACT_VERSION,
    enumerationVersion: RECOMMENDATION_PRODUCT_ENUMERATION_VERSION,
    legacyCount: LEGACY_RECOMMENDATION_CORPUS_COUNT,
    legacySha256: LEGACY_RECOMMENDATION_CORPUS_SHA256,
    cases: results,
  }, null, 2)}\n`);
}

await main();
