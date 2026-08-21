#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import {
  ACCEPTED_PDA,
  ACCEPTED_REGISTRY,
  CATEGORY_CLASSIFICATION,
  GRANT_SEMANTICS,
  INITIAL_ADMISSION_AUTHORITY_OWNER,
  INITIAL_ADMISSION_POLICY_VERSION,
  LEGACY_CORPUS_COUNT,
  LEGACY_CORPUS_SHA256,
  LEGACY_CORPUS_VERSION,
  REQUIRED_PDAS,
  REQUIRED_PRODUCT_FACTS,
  SUPPORTED_CATEGORIES,
  classifyInitialAdmissionCategory,
  evaluateInitialAdmissionGrant,
  isLegacyCorpusMember,
} from "./initial-admission-grant-policy-v1.mjs";

const CORPUS_PATH = "fixtures/recommendation-governance/legacy-frozen-recommendation-corpus-v1.txt";
const FIXTURE_PATH = "fixtures/recommendation-governance/initial-admission-grant-v1.json";

function sha256(text) {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}
function clone(value) {
  return structuredClone(value);
}
function expectNoGrant(input, legacyIds, expectedReasonFragment = null) {
  const result = evaluateInitialAdmissionGrant(input, { legacyIds });
  assert.equal(result.grant, false);
  assert.equal(result.decision, "NO_GRANT");
  if (expectedReasonFragment) {
    assert.ok(result.reasons.some((reason) => reason.includes(expectedReasonFragment)), `${expectedReasonFragment} not found in ${result.reasons.join(",")}`);
  }
  return result;
}
function expectGrant(input, legacyIds) {
  const result = evaluateInitialAdmissionGrant(input, { legacyIds });
  assert.equal(result.grant, true);
  assert.equal(result.decision, "INITIAL_ADMISSION_GRANT");
  assert.equal(result.policyVersion, INITIAL_ADMISSION_POLICY_VERSION);
  assert.equal(result.owner, INITIAL_ADMISSION_AUTHORITY_OWNER);
  return result;
}

const corpusRaw = fs.readFileSync(CORPUS_PATH, "utf8");
assert.ok(corpusRaw.endsWith("\n"), "legacy corpus must retain final LF");
const corpusLines = corpusRaw.slice(0, -1).split("\n");
const buildA = `${[...corpusLines].sort().join("\n")}\n`;
const buildB = `${[...new Set(corpusRaw.trimEnd().split(/\r?\n/).map((id) => id.toLowerCase()))].sort().join("\n")}\n`;
const legacyIds = new Set(corpusLines);
const fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, "utf8"));
const positive = fixture.positiveFixture;

// F1 exact legacy corpus = 164.
assert.equal(corpusLines.length, LEGACY_CORPUS_COUNT);
assert.equal(legacyIds.size, LEGACY_CORPUS_COUNT);
assert.ok(corpusLines.every((id) => id === id.toLowerCase()));
assert.deepEqual(corpusLines, [...corpusLines].sort());
assert.equal(sha256(corpusRaw), LEGACY_CORPUS_SHA256);

// F2 independent canonical Build A/B equality.
assert.equal(buildA, corpusRaw);
assert.equal(buildB, corpusRaw);
assert.equal(sha256(buildA), LEGACY_CORPUS_SHA256);
assert.equal(sha256(buildB), LEGACY_CORPUS_SHA256);

// F3 non-member cannot inherit legacy authority.
assert.equal(isLegacyCorpusMember(positive.product.id, legacyIds), false);
assert.equal(isLegacyCorpusMember(corpusLines[0], legacyIds), true);

// F4 non-legacy + unresolved identity -> NO GRANT.
{
  const input = clone(positive);
  input.product.identityStatus = "unresolved";
  expectNoGrant(input, legacyIds, "CANONICAL_PRODUCT_IDENTITY_UNRESOLVED");
}

// F5 resolved product but PF Subject unresolved -> NO GRANT.
{
  const input = clone(positive);
  input.subject.identityStatus = "unresolved";
  expectNoGrant(input, legacyIds, "PRODUCT_FACT_SUBJECT_UNRESOLVED_OR_NON_CURRENT");
}

// F6 required Current Fact absent -> NO GRANT.
{
  const input = clone(positive);
  input.currentFacts = [];
  expectNoGrant(input, legacyIds, "REQUIRED_CURRENT_FACT_MISSING");
}

// F7 required Fact non-positive authority state -> NO GRANT.
for (const semanticStatus of ["evidence_conflict", "evidence_insufficient", "reviewed_not_established", "unknown"]) {
  const input = clone(positive);
  input.currentFacts[0].semanticStatus = semanticStatus;
  expectNoGrant(input, legacyIds, "REQUIRED_CURRENT_FACT_NON_POSITIVE_AUTHORITY");
}

// F8 required PDA absent -> NO GRANT.
{
  const input = clone(positive);
  input.pda = {};
  expectNoGrant(input, legacyIds, "REQUIRED_PDA_ABSENT_OR_AXIS_MISMATCH");
}

// F9 mapper/version mismatch -> NO GRANT.
{
  const input = clone(positive);
  input.pda.mapperVersion = "unsupported-mapper-v999";
  expectNoGrant(input, legacyIds, "PDA_MAPPER_VERSION_MISMATCH");
}
{
  const input = clone(positive);
  input.authority.registryChecksum = "mismatch";
  expectNoGrant(input, legacyIds, "PRODUCT_FACT_REGISTRY_MISMATCH");
}

// F10 unsupported/insufficient category -> NO GRANT.
{
  const input = clone(positive);
  input.product.category = "sunscreen";
  expectNoGrant(input, legacyIds, "INITIAL_ADMISSION_AUTHORITY_INSUFFICIENT");
}
{
  const input = clone(positive);
  input.product.category = "unknown_category";
  expectNoGrant(input, legacyIds, "INITIAL_ADMISSION_UNSUPPORTED");
}

// F11 legacy/default metadata only -> NO GRANT.
expectNoGrant({ product: positive.product, legacyMetadata: positive.legacyMetadata }, legacyIds);

// F12 PF adoption alone -> NO GRANT.
{
  const input = clone(positive);
  delete input.pda;
  expectNoGrant(input, legacyIds, "REQUIRED_PDA_ABSENT_OR_AXIS_MISMATCH");
}

// F13 PDA computability alone -> NO GRANT.
expectNoGrant({ product: positive.product, pda: positive.pda }, legacyIds);

// F14 CandidatePolicy/normative ALLOW alone -> NO GRANT.
expectNoGrant({
  product: positive.product,
  candidatePolicy: { action: "ALLOW" },
  normativePolicy: { policy_action: "ALLOW" },
}, legacyIds);

// F15 fully authoritative supported-category lineage -> INITIAL_ADMISSION_GRANT = YES.
for (const category of SUPPORTED_CATEGORIES) {
  const input = clone(positive);
  input.product.category = category;
  expectGrant(input, legacyIds);
}
// Product-level admission is about authoritative description, not efficacy: supported non-axis identity may be a complete NOT_ESTABLISHED PDA state.
{
  const input = clone(positive);
  input.currentFacts[0].valueEntityIdentifier = "niacinamide";
  input.pda.signalStatus = "GOVERNED_SIGNAL_NOT_ESTABLISHED";
  input.pda.coverageState = "no_relevant_fact";
  input.pda.uncertaintyReasons = ["NEGATIVE_SIGNAL_NOT_AUTHORIZED", "NO_V1_RELEVANT_ACTIVE_IDENTITY_MATCH"];
  expectGrant(input, legacyIds);
}

// F16 same product with stale/non-current authority -> NO GRANT.
{
  const input = clone(positive);
  input.currentFacts[0].stale = true;
  expectNoGrant(input, legacyIds, "REQUIRED_CURRENT_FACT_AUTHORITY_INCOMPLETE");
}
{
  const input = clone(positive);
  input.pda.stale = true;
  expectNoGrant(input, legacyIds, "PDA_NON_CURRENT_OR_STALE");
}

// F17 Grant YES does not imply score/rank/recommendation result.
{
  const result = expectGrant(clone(positive), legacyIds);
  assert.equal("score" in result, false);
  assert.equal("rank" in result, false);
  assert.equal("recommendation" in result, false);
  assert.equal(result.semantics.impliesRecommendationRank, false);
  assert.equal(result.semantics.modifiesScoring, false);
  assert.equal(result.semantics.impliesSafety, false);
  assert.equal(result.semantics.impliesEfficacy, false);
  assert.equal(result.semantics.impliesApproval, false);
  assert.equal(result.semantics.impliesUniversalSuitability, false);
}

// F18 Grant YES does not imply CandidatePolicy/ENFORCE authorization.
{
  const result = expectGrant(clone(positive), legacyIds);
  assert.equal(result.semantics.bypassesCandidatePolicy, false);
  assert.equal(result.semantics.bypassesLaterPolicyRestriction, false);
  assert.equal(result.semantics.authorizesEnforce, false);
  assert.equal(result.semantics.activatesEnforce, false);
}

// F19 unsupported category cannot obtain Grant even with populated legacy metadata.
{
  const input = clone(positive);
  input.product.category = "cleanser";
  input.legacyMetadata = {
    concerns: ["barrier", "pores", "acne"],
    popularity: 999999999,
    ranking: 1,
    normalizeProductFallbackComplete: true,
  };
  expectNoGrant(input, legacyIds, "INITIAL_ADMISSION_AUTHORITY_INSUFFICIENT");
}

// F20 evaluating a new product cannot mutate frozen legacy membership/digest.
{
  const beforeSize = legacyIds.size;
  const beforeHash = sha256(fs.readFileSync(CORPUS_PATH, "utf8"));
  expectGrant(clone(positive), legacyIds);
  assert.equal(legacyIds.size, beforeSize);
  assert.equal(sha256(fs.readFileSync(CORPUS_PATH, "utf8")), beforeHash);
  assert.equal(beforeHash, LEGACY_CORPUS_SHA256);
}

// Contract-level authority assertions.
assert.equal(LEGACY_CORPUS_VERSION, "LEGACY_FROZEN_RECOMMENDATION_CORPUS_V1");
assert.equal(ACCEPTED_REGISTRY.version, "product-fact-registry-cross-category-v1");
assert.equal(ACCEPTED_PDA.axisKey, "exfoliation_load");
assert.deepEqual(SUPPORTED_CATEGORIES, ["toner_essence", "toner_pad", "treatment"]);
assert.deepEqual(REQUIRED_PRODUCT_FACTS.treatment, ["contains_active"]);
assert.deepEqual(REQUIRED_PDAS.treatment, ["exfoliation_load"]);
assert.equal(classifyInitialAdmissionCategory("cleanser"), "INITIAL_ADMISSION_AUTHORITY_INSUFFICIENT");
assert.equal(GRANT_SEMANTICS.createsInitialCandidateEligibilityOnly, true);
assert.equal(GRANT_SEMANTICS.authorizesEnforce, false);
assert.equal(CATEGORY_CLASSIFICATION.sunscreen, "INITIAL_ADMISSION_AUTHORITY_INSUFFICIENT");

console.log(JSON.stringify({
  status: "PASS",
  stage: "V2.1-ADMISSION-G2",
  policyVersion: INITIAL_ADMISSION_POLICY_VERSION,
  legacyCorpusVersion: LEGACY_CORPUS_VERSION,
  legacyCount: corpusLines.length,
  legacySha256: sha256(corpusRaw),
  supportedCategories: SUPPORTED_CATEGORIES,
  fixtures: "F1-F20",
  primaryOutcome: "NON_LEGACY_INITIAL_CANDIDATE_ADMISSION_AUTHORITY_FROZEN",
}));
