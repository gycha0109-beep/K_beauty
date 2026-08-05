import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { brotliDecompressSync, brotliCompressSync, constants } from "node:zlib";

const ROOT = process.cwd();
const PRODUCTS = path.join(ROOT, "fixtures/recommendation-metadata/products-v1.json");
const SCENARIOS = path.join(ROOT, "fixtures/recommendation-metadata/user-scenarios-v1.json");
const LEGACY_DELTAS = path.join(ROOT, "evidence/recommendation-metadata-shadow/product-deltas-v1.json");
const LEGACY_SUMMARY = path.join(ROOT, "evidence/recommendation-metadata-shadow/scenario-summary-v1.json");
const EVIDENCE = path.join(ROOT, "evidence/recommendation-metadata-shadow/cleanser-policy-comparison-v1.json");
const DOCUMENT = path.join(ROOT, "docs/architecture/cleanser-structured-authority-policy-review-v1.md");
const PRODUCT_DIGEST = "e4788383a21ac4207d553fbfb5300dc629b8eab5ad200ffd1313d43e94e0c856";
const SCENARIO_DIGEST = "7aa02ed3f1a264a67aee3d97c916b4a955a713fdbb173844d1727e9cfb1c918e";
const POLICY_IDS = ["P0", "P1", "P2", "P3"];
const VALID = new Set(["low_ph", "balanced", "deep_clean"]);
const COLUMNS = [
  "policyId", "scenarioId", "productId", "structuredValue", "heuristicValue",
  "deepDetected", "authoritySource", "fallbackUsed", "legacyScore", "policyScore",
  "scoreDelta", "legacyRank", "policyRank", "rankDelta", "legacyTopPick",
  "policyTopPick", "legacyTop3", "policyTop3", "penaltyApplied", "metadataUnknown",
  "metadataInvalid", "reviewRequired", "penaltyValue", "authorityConflict",
  "unapprovedAuthorityConflict", "rednessRuleActive"
];
const PRODUCTION_FILES = [
  "app/api/analyze/route.js", "lib/recommendation-scoring.ts",
  "lib/skin-match-decision-engine.js", "lib/product-source.js",
  "lib/product-source-core.js", "lib/analysis-results.js",
  "lib/premium-session-payload.js", "lib/current-products.js"
];

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

function digest(value) {
  return createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
}

function semanticDigest(value) {
  const copy = structuredClone(value);
  delete copy.generatedAt;
  delete copy.canonicalEvidenceSha256;
  return digest(copy);
}

function decodeArtifact(artifact) {
  assert.equal(artifact.artifactSchemaVersion, "cleanser-policy-comparison-artifact-v1");
  assert.equal(artifact.encoding, "brotli+base64");
  const payload = JSON.parse(brotliDecompressSync(Buffer.from(artifact.payloadBrotliBase64, "base64")));
  assert.equal(artifact.payloadSha256, payload.canonicalEvidenceSha256);
  assert.equal(artifact.rowCount, payload.actualCatalog.rowCount);
  assert.equal(artifact.adversarialFixtureCount, payload.adversarialPolicyFixture.fixtureCount);
  assert.deepEqual(artifact.verdict, payload.verdict);
  return payload;
}

function decodeRows(actualCatalog) {
  assert.equal(actualCatalog.rowsEncoding, "columnar-v1");
  assert.equal(actualCatalog.columns.length, COLUMNS.length);
  assert.deepEqual(actualCatalog.columns, COLUMNS);
  assert.equal(actualCatalog.rows.length, actualCatalog.rowCount);
  return actualCatalog.rows.map((values) => Object.fromEntries(COLUMNS.map((key, index) => [key, values[index]])));
}

function classifyMetadata(value) {
  if (value == null) return "unknown";
  return VALID.has(value) ? "valid" : "invalid";
}

function resolvePolicy(policyId, structuredValue, heuristicValue) {
  const metadataStatus = classifyMetadata(structuredValue);
  const structuredDeep = metadataStatus === "valid" && structuredValue === "deep_clean";
  const structuredNonDeep = metadataStatus === "valid" && ["low_ph", "balanced"].includes(structuredValue);
  const metadataUnknown = metadataStatus === "unknown";
  const metadataInvalid = metadataStatus === "invalid";
  let deepDetected = false;
  let fallbackUsed = false;

  if (policyId === "P0") deepDetected = Boolean(heuristicValue);
  else if (policyId === "P1") {
    if (metadataStatus === "valid") deepDetected = structuredDeep;
    else {
      deepDetected = Boolean(heuristicValue);
      fallbackUsed = true;
    }
  } else if (policyId === "P2") {
    deepDetected = structuredDeep || Boolean(heuristicValue);
    fallbackUsed = metadataUnknown || metadataInvalid;
  } else if (policyId === "P3") {
    deepDetected = metadataStatus === "valid" && structuredDeep;
  } else throw new Error(`unknown policy: ${policyId}`);

  return {
    deepDetected,
    fallbackUsed,
    metadataUnknown,
    metadataInvalid,
    reviewRequired: metadataUnknown || metadataInvalid || (structuredNonDeep && Boolean(heuristicValue)),
    authorityConflict: metadataStatus === "valid" && structuredDeep !== Boolean(heuristicValue),
    unapprovedAuthorityConflict: structuredNonDeep && Boolean(heuristicValue)
  };
}

function sortedSemanticRows(rows) {
  return [...rows].sort((left, right) =>
    left.policyId.localeCompare(right.policyId) ||
    left.scenarioId.localeCompare(right.scenarioId, "en", { numeric: true }) ||
    left.productId.localeCompare(right.productId)
  );
}

function validateRows(rows) {
  assert.equal(rows.length, 1248);
  const keys = new Set();
  for (const row of rows) {
    const key = `${row.policyId}:${row.scenarioId}:${row.productId}`;
    assert(!keys.has(key), `duplicate policy row: ${key}`);
    keys.add(key);
    assert(POLICY_IDS.includes(row.policyId));
    assert.equal(row.scoreDelta, Math.round((row.policyScore - row.legacyScore) * 10) / 10);
    assert.equal(row.rankDelta, row.policyRank - row.legacyRank);
    assert.equal(row.penaltyValue, row.penaltyApplied ? -18 : 0);
    const expected = resolvePolicy(row.policyId, row.structuredValue, row.heuristicValue);
    for (const field of [
      "deepDetected", "fallbackUsed", "metadataUnknown", "metadataInvalid",
      "reviewRequired", "authorityConflict", "unapprovedAuthorityConflict"
    ]) assert.equal(row[field], expected[field], `${key}:${field}`);
    assert.equal(row.penaltyApplied, row.rednessRuleActive && row.deepDetected);
    if (!row.rednessRuleActive) assert.equal(row.scoreDelta, 0);
  }
  assert.equal(keys.size, 1248);
}

function validateAggregates(payload, rows) {
  const aggregates = new Map(payload.actualCatalog.aggregates.map((item) => [item.policyId, item]));
  assert.deepEqual([...aggregates.keys()], POLICY_IDS);
  assert.equal(aggregates.get("P0").deepDetectedCount, 0);
  for (const policyId of ["P1", "P2", "P3"]) {
    const aggregate = aggregates.get(policyId);
    assert.equal(aggregate.productsEvaluated, 26);
    assert.equal(aggregate.scenariosEvaluated, 12);
    assert.equal(aggregate.productScenarioRows, 312);
    assert.equal(aggregate.deepDetectedCount, 9);
    assert.equal(aggregate.newlyDetectedCount, 9);
    assert.equal(aggregate.structuredOnlyCount, 9);
    assert.equal(aggregate.penaltyAppliedCount, 36);
    assert.equal(aggregate.penaltyAppliedProductCount, 9);
    assert.equal(aggregate.topPickChangedCount, 0);
    assert.equal(aggregate.top3ChangedCount, 0);
    assert.equal(aggregate.maxAbsoluteScoreDelta, 18);
    assert.equal(aggregate.maxAbsoluteRankDelta, 3);
    const policyRows = rows.filter((row) => row.policyId === policyId);
    assert.equal(policyRows.filter((row) => row.penaltyApplied).length, aggregate.penaltyAppliedCount);
  }
  const impact = payload.actualCatalog.impact;
  assert.equal(impact.penaltyAppliedButRankUnchangedRows, 27);
  assert.equal(impact.penaltyAppliedButRankAlwaysUnchangedProducts, 6);
  assert.equal(impact.deepCleanProductsRemainingTop3AfterPenalty, 0);
  assert.equal(impact.topPickChangedScenarios, 0);
  assert.equal(impact.top3ChangedScenarios, 0);
  assert.equal(impact.largestPenalizedProductRankDrop, 2);
  assert.equal(impact.maxAbsoluteRankDeltaAllProducts, 3);
  assert.equal(impact.largestAdverseScoreDelta, -18);
  assert.equal(impact.smallestAdjacentLegacyScoreMargin, 0);
  assert.equal(impact.smallestPositiveAdjacentLegacyScoreMargin, 0.1);
  assert.equal(impact.smallestTop1Top2LegacyMargin, 0.2);
  assert.equal(impact.nonRednessScenarioScoreDeltaCount, 0);
  assert.equal(impact.nonCleanserCategoryChangeCount, 0);
}

function result(fixture, policyId) {
  return fixture.policyResults.find((item) => item.policyId === policyId);
}

function validateAdversarial(payload) {
  const fixtures = new Map(payload.adversarialPolicyFixture.rows.map((item) => [item.fixtureId, item]));
  assert.equal(fixtures.size, 12);
  assert(!result(fixtures.get("A"), "P0").deepDetected);
  assert(result(fixtures.get("A"), "P2").deepDetected);
  assert(!result(fixtures.get("C"), "P1").deepDetected);
  assert(result(fixtures.get("C"), "P2").deepDetected);
  assert(result(fixtures.get("D"), "P2").reviewRequired);
  assert(result(fixtures.get("G"), "P2").fallbackUsed);
  assert(!result(fixtures.get("G"), "P3").deepDetected);
  assert(result(fixtures.get("I"), "P2").invalid);
  assert(result(fixtures.get("I"), "P2").deepDetected);
  assert(!result(fixtures.get("I"), "P3").deepDetected);
  for (const fixtureId of ["H", "J", "L"]) assert(result(fixtures.get(fixtureId), "P2").fallbackUsed);
}

async function validateImportBoundary() {
  for (const relative of PRODUCTION_FILES) {
    let source;
    try {
      source = await readFile(path.join(ROOT, relative), "utf8");
    } catch (error) {
      if (error.code === "ENOENT") continue;
      throw error;
    }
    for (const forbidden of [
      "cleanser-policy-comparison-v1",
      "verify-cleanser-structured-authority-policy-review",
      "cleanser-authority-policy-review-v1"
    ]) assert(!source.includes(forbidden), `Production evidence reference: ${relative}`);
  }
  const engine = await readFile(path.join(ROOT, "lib/skin-match-decision-engine.js"), "utf8");
  for (const anchor of [
    "deep clean", "pore deep", "clarified finish", "perfect whip",
    'reasons.push("redness-deep-clean")', "function isDeepCleanser(product)"
  ]) assert(engine.includes(anchor), `legacy contract anchor missing: ${anchor}`);
  assert(/total\s*-=\s*18/.test(engine));
}

function validateNegativeControls(payload) {
  const tampered = structuredClone(payload);
  tampered.actualCatalog.rows[0][COLUMNS.indexOf("policyRank")] = 999;
  assert.notEqual(semanticDigest(tampered), payload.canonicalEvidenceSha256);

  const aggregateMismatch = structuredClone(payload);
  aggregateMismatch.actualCatalog.aggregates.find((item) => item.policyId === "P2").productsEvaluated += 1;
  assert.throws(() => validateAggregates(aggregateMismatch, decodeRows(aggregateMismatch.actualCatalog)));

  const duplicatePolicy = structuredClone(payload);
  duplicatePolicy.policies[3].policyId = "P2";
  assert.notDeepEqual(duplicatePolicy.policies.map((item) => item.policyId), POLICY_IDS);

  assert.throws(() => resolvePolicy("P9", "deep_clean", false));
  assert.equal(resolvePolicy("P2", null, true).fallbackUsed, true);
  assert.equal(resolvePolicy("P2", "low_ph", true).deepDetected, true);
  assert.equal(resolvePolicy("P1", "low_ph", true).deepDetected, false);
}

const [products, scenarios, legacyDeltas, legacySummary, artifact, document] = await Promise.all([
  PRODUCTS, SCENARIOS, LEGACY_DELTAS, LEGACY_SUMMARY, EVIDENCE, DOCUMENT
].map(async (file, index) => index === 5 ? readFile(file, "utf8") : JSON.parse(await readFile(file, "utf8"))));

assert.equal(products.canonicalFixtureSha256, PRODUCT_DIGEST);
assert.equal(scenarios.canonicalScenarioSha256, SCENARIO_DIGEST);
assert.equal(products.productCount, 164);
assert.equal(scenarios.scenarioCount, 12);
assert.equal(legacyDeltas.rowCount, 1908);
assert.equal(legacyDeltas.fixtureSha256, PRODUCT_DIGEST);
assert.equal(legacyDeltas.scenarioSha256, SCENARIO_DIGEST);
assert.equal(legacySummary.overallStatus, "EVIDENCE_READY_NO_ACTIVATION");

const payload = decodeArtifact(artifact);
assert.equal(payload.canonicalEvidenceSha256, semanticDigest(payload));
assert.equal(payload.source.productsFixtureSha256, PRODUCT_DIGEST);
assert.equal(payload.source.scenarioFixtureSha256, SCENARIO_DIGEST);
assert.deepEqual(payload.policies.map((item) => item.policyId), POLICY_IDS);
assert.equal(new Set(payload.policies.map((item) => item.policyId)).size, 4);
assert.equal(payload.databaseAudit.mode, "read_only");
assert.equal(payload.databaseAudit.productCount, 164);
assert.equal(payload.databaseAudit.cleanserCount, 26);
assert.equal(payload.databaseAudit.cleansingProfileCoverageCount, 26);
assert.equal(payload.databaseAudit.cleansingProfileInvalidCount, 0);
assert.equal(payload.databaseAudit.fieldSpecificCleansingProfileProvenanceAvailable, false);
assert.equal(payload.penaltyContract.value, -18);
assert.equal(payload.penaltyContract.candidateRemoval, false);
assert.equal(payload.penaltyContract.verdict, "EXISTING_PENALTY_NEEDS_RECALIBRATION");
assert.deepEqual(payload.verdict, {
  policySemantics: "STRUCTURED_POSITIVE_AUTHORITY_REVIEWABLE",
  operationalReadiness: "BLOCKED_ADMIN_CONTRACT",
  recommendedPolicyId: "P2",
  penaltyVerdict: "EXISTING_PENALTY_NEEDS_RECALIBRATION",
  overall: "POLICY_REVIEW_COMPLETE_NO_ACTIVATION"
});

const rows = decodeRows(payload.actualCatalog);
validateRows(rows);
validateAggregates(payload, rows);
validateAdversarial(payload);
for (const invariant of Object.values(payload.productionInvariance)) assert.equal(invariant, true);

const sorted = sortedSemanticRows(rows);
assert.deepEqual(sortedSemanticRows([...rows].reverse()), sorted);
const timestampChanged = structuredClone(payload);
timestampChanged.generatedAt = "2099-01-01T00:00:00.000Z";
assert.equal(semanticDigest(timestampChanged), payload.canonicalEvidenceSha256);
const options = { params: { [constants.BROTLI_PARAM_QUALITY]: 11, [constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_TEXT } };
const repackedA = brotliCompressSync(Buffer.from(JSON.stringify(payload)), options);
const repackedB = brotliCompressSync(Buffer.from(JSON.stringify(payload)), options);
assert(repackedA.equals(repackedB));

for (const marker of [
  "STRUCTURED_POSITIVE_AUTHORITY_REVIEWABLE", "BLOCKED_ADMIN_CONTRACT",
  "EXISTING_PENALTY_NEEDS_RECALIBRATION", "POLICY_REVIEW_COMPLETE_NO_ACTIVATION",
  "CandidateExposurePolicy activation이 아니다"
]) assert(document.includes(marker), `policy document marker missing: ${marker}`);

await validateImportBoundary();
validateNegativeControls(payload);

console.log(
  `CLEANSER_STRUCTURED_AUTHORITY_POLICY_REVIEW=PASS products=26 scenarios=12 policies=4 rows=${rows.length} adversarial=12 digest=${payload.canonicalEvidenceSha256}`
);
