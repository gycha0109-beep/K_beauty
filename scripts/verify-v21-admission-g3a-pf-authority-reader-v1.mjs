#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  RECOMMENDATION_ADMISSION_AUTHORITY_STATUS,
  buildG2Input,
  buildPdaMapperInput,
  isCanonicalRecommendationUuid,
  normalizeRecommendationAdmissionAuthorityPayload,
} from "../lib/recommendation-admission-authority-contract.mjs";
import {
  VERSION as PDA_MAPPER_VERSION,
  materialize,
} from "./product-evidence/exfoliation-non-numeric-pda-offline-shadow-v1.mjs";
import {
  LEGACY_CORPUS_COUNT,
  LEGACY_CORPUS_SHA256,
  LEGACY_CORPUS_VERSION,
  evaluateInitialAdmissionGrant,
} from "./product-evidence/initial-admission-grant-policy-v1.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixturePath = path.join(root, "fixtures/recommendation-governance/g3a-pf-authority-reader-v1.json");
const migrationPath = path.join(root, "supabase/migrations/20260822083000_v21_admission_g3a_pf_authority_read_v1.sql");
const readerPath = path.join(root, "lib/recommendation-admission-authority-reader.js");
const productSourcePath = path.join(root, "lib/product-source.js");
const analyzeRoutePath = path.join(root, "app/api/analyze/route.js");
const legacyPath = path.join(root, "fixtures/recommendation-governance/legacy-frozen-recommendation-corpus-v1.txt");
const packagePath = path.join(root, "package.json");
const lockPath = path.join(root, "package-lock.json");

const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
const migration = fs.readFileSync(migrationPath, "utf8");
const readerSource = fs.readFileSync(readerPath, "utf8");
const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
const packageLock = JSON.parse(fs.readFileSync(lockPath, "utf8"));

function clone(value) {
  return structuredClone(value);
}

function evaluate(payload) {
  const normalized = normalizeRecommendationAdmissionAuthorityPayload(payload);
  if (normalized.status !== RECOMMENDATION_ADMISSION_AUTHORITY_STATUS.RESOLVED) {
    return { normalized, mapperResult: null, g2: null };
  }
  const mapperInput = buildPdaMapperInput(normalized);
  const mapperResult = materialize(mapperInput.product, mapperInput.facts, mapperInput.subject);
  const g2Input = buildG2Input(normalized, mapperResult, PDA_MAPPER_VERSION);
  const g2 = evaluateInitialAdmissionGrant(g2Input, { legacyIds: new Set() });
  return { normalized, mapperResult, g2 };
}

const results = {};

const f1 = evaluate(clone(fixture.validPayload));
assert.equal(f1.normalized.status, "AUTHORITY_RESOLVED");
assert.equal(f1.mapperResult.pda.signal_status, "GOVERNED_SIGNAL_ESTABLISHED");
assert.equal(f1.g2.decision, "INITIAL_ADMISSION_GRANT");
results.F1 = "PASS";

const f2Payload = clone(fixture.validPayload);
f2Payload.current_facts = f2Payload.current_facts.filter((fact) => fact.fact_key !== "contains_active");
const f2 = evaluate(f2Payload);
assert.equal(f2.normalized.status, "NO_AUTHORITY");
assert.equal(f2.normalized.reason, "REQUIRED_CURRENT_FACT_MISSING:contains_active");
results.F2 = "PASS";

for (const [fixtureName, semanticStatus, expectedSignal, expectedReason] of [
  ["F3", "evidence_insufficient", "GOVERNED_SIGNAL_UNKNOWN", "PDA_AUTHORITY_BLOCKED:EVIDENCE_INSUFFICIENT"],
  ["F4", "evidence_conflict", "GOVERNED_SIGNAL_BLOCKED", "PDA_AUTHORITY_BLOCKED:CONFLICTING_GOVERNED_FACT"],
]) {
  const payload = clone(fixture.validPayload);
  const contains = payload.current_facts.find((fact) => fact.fact_key === "contains_active");
  contains.semantic_status = semanticStatus;
  contains.value_type = null;
  contains.value_boolean = null;
  contains.value_enum = null;
  contains.value_number = null;
  contains.value_unit = null;
  contains.value_range_min = null;
  contains.value_range_max = null;
  contains.value_entity_identifier = null;
  const result = evaluate(payload);
  assert.equal(result.normalized.status, "AUTHORITY_RESOLVED");
  assert.equal(result.mapperResult.pda.signal_status, expectedSignal);
  assert.equal(result.g2.decision, "NO_GRANT");
  assert.ok(result.g2.reasons.includes(expectedReason) || result.g2.reasons.some((reason) => reason.includes(semanticStatus === "evidence_insufficient" ? "EVIDENCE_INSUFFICIENT" : "CONFLICTING_GOVERNED_FACT")));
  results[fixtureName] = "PASS";
}

const f5Payload = clone(fixture.validPayload);
f5Payload.subject.current_state = "historical";
const f5 = evaluate(f5Payload);
assert.equal(f5.normalized.status, "NO_AUTHORITY");
results.F5 = "PASS";

const f6Payload = clone(fixture.validPayload);
f6Payload.registry.registry_version = "product-fact-registry-mismatch-v0";
f6Payload.registry.registry_checksum = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
for (const fact of f6Payload.current_facts) fact.registry_version = f6Payload.registry.registry_version;
const f6 = evaluate(f6Payload);
assert.equal(f6.normalized.status, "AUTHORITY_RESOLVED");
assert.equal(f6.g2.decision, "NO_GRANT");
assert.ok(f6.g2.reasons.includes("PRODUCT_FACT_REGISTRY_MISMATCH"));
results.F6 = "PASS";

const f7Payload = clone(fixture.validPayload);
for (const fact of f7Payload.current_facts) fact.proposition_serializer_version = "product-fact-proposition-mismatch-v0";
const f7 = evaluate(f7Payload);
assert.equal(f7.normalized.status, "AUTHORITY_RESOLVED");
assert.equal(f7.g2.decision, "NO_GRANT");
assert.ok(f7.g2.reasons.some((reason) => reason.includes("AUTHORITY_INCOMPLETE")));
results.F7 = "PASS";

const f8Payload = clone(fixture.validPayload);
f8Payload.product.category = "cleanser";
const f8 = evaluate(f8Payload);
assert.equal(f8.normalized.status, "AUTHORITY_RESOLVED");
assert.equal(f8.g2.decision, "NO_GRANT");
assert.ok(f8.g2.reasons.includes("INITIAL_ADMISSION_AUTHORITY_INSUFFICIENT"));
results.F8 = "PASS";

assert.equal(isCanonicalRecommendationUuid("not-a-uuid"), false);
results.A10 = "PASS";

const unknown = normalizeRecommendationAdmissionAuthorityPayload({
  read_contract_version: "recommendation-admission-authority-read-v1",
  status: "NO_AUTHORITY",
  reason: "CANONICAL_PRODUCT_NOT_FOUND",
});
assert.equal(unknown.status, "NO_AUTHORITY");
results.A11 = "PASS";

const allowedFactKeys = new Set([
  "proposition_key", "fact_instance_id", "subject_id", "confirmation_id", "fact_key", "registry_version",
  "proposition_serializer_version", "semantic_status", "value_type", "value_boolean", "value_enum", "value_number",
  "value_unit", "value_range_min", "value_range_max", "value_entity_identifier", "parent_proposition_key",
  "parent_fact_instance_id", "authority_ceiling", "fused_confidence", "valid_from", "valid_to",
]);
for (const fact of f1.normalized.authority.currentFacts) {
  assert.deepEqual(new Set(Object.keys(fact)), allowedFactKeys);
}
assert.deepEqual(new Set(Object.keys(f1.normalized.authority.product)), new Set(["product_id", "category"]));
results.A12 = "PASS";

const ambiguousPayload = clone(fixture.validPayload);
ambiguousPayload.current_facts.push(clone(ambiguousPayload.current_facts[0]));
const ambiguous = normalizeRecommendationAdmissionAuthorityPayload(ambiguousPayload);
assert.equal(ambiguous.status, "NO_AUTHORITY");
assert.equal(ambiguous.reason, "AMBIGUOUS_CURRENT_AUTHORITY");
results.A13 = "PASS";

const repeatA = JSON.stringify(normalizeRecommendationAdmissionAuthorityPayload(clone(fixture.validPayload)));
const repeatB = JSON.stringify(normalizeRecommendationAdmissionAuthorityPayload(clone(fixture.validPayload)));
assert.equal(repeatA, repeatB);
results.A14 = "PASS";

const malformed = normalizeRecommendationAdmissionAuthorityPayload({ unexpected: true });
assert.equal(malformed.status, "NO_AUTHORITY");
results.A26 = "PASS";

assert.match(migration, /security definer/i);
assert.match(migration, /set search_path = ''/i);
assert.match(migration, /owner to recommendation_admission_reader_owner/i);
assert.match(migration, /revoke all on function public\.read_recommendation_admission_authority_v1\(uuid\)[\s\S]*from public, anon, authenticated, service_role/i);
assert.match(migration, /grant execute on function public\.read_recommendation_admission_authority_v1\(uuid\)[\s\S]*to recommendation_admission_runtime/i);
assert.doesNotMatch(migration, /password\s+['"]/i);
assert.doesNotMatch(migration, /grant\s+execute[\s\S]{0,200}service_role/i);
assert.doesNotMatch(migration, /to\s+(anon|authenticated)[\s\S]{0,80}using\s*\(true\)/i);

assert.match(readerSource, /import\s+"server-only"/);
assert.match(readerSource, /process\.env\[RECOMMENDATION_ADMISSION_DATABASE_URL_ENV\]/);
assert.match(readerSource, /prepare:\s*false/);
assert.match(readerSource, /max:\s*1/);
assert.doesNotMatch(readerSource, /NEXT_PUBLIC_/);
assert.doesNotMatch(readerSource, /console\.(log|error|warn)/);
assert.equal(packageJson.dependencies.postgres, "3.4.9");
assert.equal(packageLock.packages?.[""]?.dependencies?.postgres, "3.4.9");
assert.equal(packageLock.packages?.["node_modules/postgres"]?.version, "3.4.9");

const legacyBytes = fs.readFileSync(legacyPath);
const legacyText = legacyBytes.toString("utf8");
const legacyIds = legacyText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
assert.equal(fixture.legacyContract.version, LEGACY_CORPUS_VERSION);
assert.equal(fixture.legacyContract.count, LEGACY_CORPUS_COUNT);
assert.equal(fixture.legacyContract.sha256, LEGACY_CORPUS_SHA256);
assert.equal(fixture.legacyContract.readerRequired, false);
assert.equal(legacyIds.length, LEGACY_CORPUS_COUNT);
assert.equal(crypto.createHash("sha256").update(legacyBytes).digest("hex"), LEGACY_CORPUS_SHA256);
assert.doesNotMatch(fs.readFileSync(productSourcePath, "utf8"), /recommendation-admission-authority-reader/);
assert.doesNotMatch(fs.readFileSync(analyzeRoutePath, "utf8"), /recommendation-admission-authority-reader/);
results.A25 = "PASS";

process.stdout.write(`${JSON.stringify({
  stage: "V2.1-ADMISSION-G3A-CONT",
  fixtureVersion: fixture.fixtureVersion,
  securityFixtures: results,
  functionalFixtures: Object.fromEntries(Object.entries(results).filter(([key]) => /^F\d+$/.test(key))),
  driver: { package: "postgres", version: "3.4.9", prepare: false, max: 1 },
  legacy: fixture.legacyContract,
  primaryResult: "REPOSITORY_G3A_READER_CONTRACT_VERIFIED",
}, null, 2)}\n`);
