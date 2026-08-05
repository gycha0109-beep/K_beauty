import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { brotliDecompressSync } from "node:zlib";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const REVIEW_BASE = "f569e983ad700c07c0957f2a6ae09074ea483ff0";
const PRODUCT_DIGEST = "e4788383a21ac4207d553fbfb5300dc629b8eab5ad200ffd1313d43e94e0c856";
const SCENARIO_DIGEST = "7aa02ed3f1a264a67aee3d97c916b4a955a713fdbb173844d1727e9cfb1c918e";
const EXPECTED_EVIDENCE_DIGEST = "7d88adc4ec5e44d891808dadc7f8a8743bf5b5997474e11499e37ee22b3874a8";
const ALLOWED_REVIEW_PATHS = new Set([
  ".codex/AI_WORK_LOG.d/2026-08-05-recommendation-follow-up-policy-review.md",
  "docs/architecture/recommendation-follow-up-policy-review-v1.md",
  "evidence/recommendation-metadata-shadow/recommendation-follow-up-policy-review-v1.json",
  "scripts/verify-recommendation-follow-up-policy-review.mjs",
  "scripts/verify-recommendation-metadata-offline-evidence.mjs"
]);

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

function round(value, places = 4) {
  const multiplier = 10 ** places;
  return Math.round((value + Number.EPSILON) * multiplier) / multiplier;
}

function decodeColumnarRows(payload) {
  return payload.actualCatalog.rows.map((values) =>
    Object.fromEntries(payload.actualCatalog.columns.map((column, index) => [column, values[index]]))
  );
}

async function decodeCleanserPayload(manifest) {
  const chunks = [];
  for (const chunk of manifest.payloadChunks) {
    const content = await readFile(path.join(ROOT, chunk.path), "utf8");
    assert.equal(content.length, chunk.length);
    assert.equal(createHash("sha256").update(content).digest("hex"), chunk.sha256);
    chunks.push(content);
  }
  const encoded = chunks.join("");
  assert.equal(encoded.length, manifest.payloadEncodedLength);
  assert.equal(createHash("sha256").update(encoded).digest("hex"), manifest.payloadEncodedSha256);
  const payload = JSON.parse(brotliDecompressSync(Buffer.from(encoded, "base64")));
  assert.equal(payload.canonicalEvidenceSha256, manifest.payloadSha256);
  return payload;
}

function groupBy(items, key) {
  const groups = new Map();
  for (const item of items) {
    const value = item[key];
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(item);
  }
  return groups;
}

function simulatePenalty(rows, magnitude) {
  const scenarioGroups = groupBy(rows, "scenarioId");
  const allRows = [];
  let topPickChangedScenarios = 0;
  let top3ChangedScenarios = 0;
  let penaltyAppliedRows = 0;
  let maxAbsoluteRankMovementAllProducts = 0;
  let largestPenalizedProductRankDrop = 0;
  let penaltyRowsRankUnchanged = 0;
  let deepCleanProductsRemainingTop3InRednessScenarioCount = 0;

  for (const scenarioRows of scenarioGroups.values()) {
    const ranked = scenarioRows
      .map((row) => ({
        ...row,
        candidateScore:
          row.legacyScore - (row.rednessRuleActive && row.deepDetected ? magnitude : 0)
      }))
      .sort((left, right) =>
        right.candidateScore - left.candidateScore || left.legacyRank - right.legacyRank
      )
      .map((row, index) => ({
        ...row,
        candidateRank: index + 1,
        candidateTopPick: index === 0,
        candidateTop3: index < 3
      }));

    const legacyTopPick = ranked.find((row) => row.legacyTopPick)?.productId;
    const candidateTopPick = ranked.find((row) => row.candidateTopPick)?.productId;
    if (legacyTopPick !== candidateTopPick) topPickChangedScenarios += 1;

    const legacyTop3 = ranked.filter((row) => row.legacyTop3).map((row) => row.productId).sort();
    const candidateTop3 = ranked.filter((row) => row.candidateTop3).map((row) => row.productId).sort();
    if (JSON.stringify(legacyTop3) !== JSON.stringify(candidateTop3)) top3ChangedScenarios += 1;

    for (const row of ranked) {
      row.rankDeltaCandidate = row.candidateRank - row.legacyRank;
      maxAbsoluteRankMovementAllProducts = Math.max(
        maxAbsoluteRankMovementAllProducts,
        Math.abs(row.rankDeltaCandidate)
      );
      if (row.rednessRuleActive && row.deepDetected && magnitude > 0) {
        penaltyAppliedRows += 1;
        largestPenalizedProductRankDrop = Math.max(
          largestPenalizedProductRankDrop,
          row.rankDeltaCandidate
        );
        if (row.rankDeltaCandidate === 0) penaltyRowsRankUnchanged += 1;
        if (row.candidateTop3) deepCleanProductsRemainingTop3InRednessScenarioCount += 1;
      }
      allRows.push(row);
    }
  }

  const scoreDeltas = allRows.map((row) => row.candidateScore - row.legacyScore);
  return {
    candidateId: `P${magnitude}`,
    penaltyValue: -magnitude,
    topPickChangedScenarios,
    top3ChangedScenarios,
    penaltyAppliedRows,
    meanScoreDeltaAllCleanserRows: round(
      scoreDeltas.reduce((sum, value) => sum + value, 0) / scoreDeltas.length
    ),
    maxAdverseScoreDelta: magnitude > 0 ? -magnitude : 0,
    maxAbsoluteRankMovementAllProducts,
    largestPenalizedProductRankDrop,
    penaltyRowsRankUnchanged,
    deepCleanProductsRemainingTop3InRednessScenarioCount,
    nonRednessScoreDeltaRows: allRows.filter(
      (row) => !row.rednessRuleActive && row.candidateScore !== row.legacyScore
    ).length
  };
}

function countScenarioChanges(rows, field) {
  const groups = groupBy(rows, "userScenarioId");
  return [...groups.values()].filter((group) => group.some((row) => Boolean(row[field]))).length;
}

function validateMarginFixtures(fixtures) {
  const expectedMargins = [0.2, 8, 12, 16, 18, 18.1];
  assert.deepEqual(fixtures.map((fixture) => fixture.deepLeadMargin), expectedMargins);
  const magnitudes = [0, 8, 12, 18];

  for (const fixture of fixtures) {
    assert.equal(fixture.legacyTopPick, "deep_clean");
    assert.deepEqual(
      fixture.candidateOutcomes.map((outcome) => outcome.candidateId),
      magnitudes.map((magnitude) => `P${magnitude}`)
    );
    for (const outcome of fixture.candidateOutcomes) {
      const magnitude = Number(outcome.candidateId.slice(1));
      const margin = round(fixture.deepLeadMargin - magnitude, 1);
      assert.equal(outcome.postPenaltyMarginDeepMinusSafe, margin);
      assert.equal(outcome.exactTie, margin === 0);
      assert.equal(outcome.topPick, margin >= 0 ? "deep_clean" : "safe_cleanser");
    }
  }
}

function validateTaskDiff() {
  const result = spawnSync("git", ["diff", "--name-only", `${REVIEW_BASE}..HEAD`], {
    cwd: ROOT,
    encoding: "utf8"
  });
  assert.equal(result.status, 0, result.stderr || "git diff failed");
  const paths = result.stdout.split(/\r?\n/).filter(Boolean).sort();
  assert(paths.length > 0);
  for (const file of paths) assert(ALLOWED_REVIEW_PATHS.has(file), `unexpected review path: ${file}`);
  assert.equal(paths.some((file) => file.startsWith("app/")), false);
  assert.equal(paths.some((file) => file.startsWith("lib/")), false);
  assert.equal(paths.some((file) => file.startsWith("supabase/")), false);
  assert.equal(paths.some((file) => file.startsWith(".github/workflows/")), false);
  assert.equal(paths.includes("package.json"), false);
  assert.equal(paths.includes("package-lock.json"), false);
}

const [
  evidence,
  products,
  scenarios,
  deltas,
  summary,
  cleanserManifest,
  engineSource,
  productSource,
  document
] = await Promise.all([
  "evidence/recommendation-metadata-shadow/recommendation-follow-up-policy-review-v1.json",
  "fixtures/recommendation-metadata/products-v1.json",
  "fixtures/recommendation-metadata/user-scenarios-v1.json",
  "evidence/recommendation-metadata-shadow/product-deltas-v1.json",
  "evidence/recommendation-metadata-shadow/scenario-summary-v1.json",
  "evidence/recommendation-metadata-shadow/cleanser-policy-comparison-v1.json"
].map((relative) => readFile(path.join(ROOT, relative), "utf8").then(JSON.parse)).concat([
  readFile(path.join(ROOT, "lib/skin-match-decision-engine.js"), "utf8"),
  readFile(path.join(ROOT, "lib/product-source-core.js"), "utf8"),
  readFile(path.join(ROOT, "docs/architecture/recommendation-follow-up-policy-review-v1.md"), "utf8")
]));

assert.equal(evidence.schemaVersion, "recommendation-follow-up-policy-review-v1");
const evidenceCopy = structuredClone(evidence);
delete evidenceCopy.canonicalEvidenceSha256;
assert.equal(digest(evidenceCopy), EXPECTED_EVIDENCE_DIGEST);
assert.equal(evidence.canonicalEvidenceSha256, EXPECTED_EVIDENCE_DIGEST);

assert.equal(products.productCount, 164);
assert.equal(products.canonicalFixtureSha256, PRODUCT_DIGEST);
assert.equal(scenarios.scenarioCount, 12);
assert.equal(scenarios.canonicalScenarioSha256, SCENARIO_DIGEST);
assert.equal(deltas.rowCount, 1908);
assert.equal(evidence.source.productsFixtureSha256, PRODUCT_DIGEST);
assert.equal(evidence.source.scenarioFixtureSha256, SCENARIO_DIGEST);
assert.equal(evidence.source.productDeltaEvidenceSha256, deltas.canonicalEvidenceSha256);
assert.equal(evidence.source.scenarioSummarySha256, summary.canonicalSummarySha256);
assert.equal(evidence.source.cleanserAuthorityEvidenceSha256, cleanserManifest.payloadSha256);

const cleanserPayload = await decodeCleanserPayload(cleanserManifest);
const cleanserRows = decodeColumnarRows(cleanserPayload);
const p2Rows = cleanserRows.filter((row) => row.policyId === "P2");
assert.equal(p2Rows.length, 312);
assert.equal(new Set(p2Rows.map((row) => row.productId)).size, 26);
assert.equal(new Set(p2Rows.filter((row) => row.deepDetected).map((row) => row.productId)).size, 9);
assert.equal(new Set(p2Rows.filter((row) => row.heuristicValue).map((row) => row.productId)).size, 0);
assert.deepEqual(
  [...new Set(p2Rows.filter((row) => row.rednessRuleActive).map((row) => row.scenarioId))].sort(),
  ["U5", "U6", "U8", "U9"]
);

const computedCandidates = [0, 8, 12, 18].map((magnitude) => simulatePenalty(p2Rows, magnitude));
assert.deepEqual(computedCandidates, evidence.cleanserPenaltyCalibration.candidateResults);
for (const candidate of computedCandidates) {
  assert.equal(candidate.topPickChangedScenarios, 0);
  assert.equal(candidate.top3ChangedScenarios, 0);
  assert.equal(candidate.nonRednessScoreDeltaRows, 0);
}
assert.equal(evidence.cleanserPenaltyCalibration.verdict, "PENALTY_REQUIRES_MORE_EVIDENCE");
assert.equal(evidence.cleanserPenaltyCalibration.activationAllowed, false);
assert.deepEqual(
  evidence.cleanserPenaltyCalibration.rednessTop3Distance.map((item) => item.gapToTop3Cutoff),
  [47.3, 51, 26.8, 47]
);
validateMarginFixtures(evidence.cleanserPenaltyCalibration.adversarialMarginFixtures);
assert.equal(evidence.cleanserPenaltyCalibration.scoreScale.prioritySlotHeroBoost, 16);
assert.equal(evidence.cleanserPenaltyCalibration.scoreScale.perfectWhipHeroBoost, 14);

const productRows = products.products;
const balmProducts = productRows.filter((product) => product.category === "moisturizer_balm");
assert.equal(balmProducts.length, 20);
assert.equal(balmProducts.filter((product) => product.is_primary_moisturizer === true).length, 7);
assert.equal(balmProducts.filter((product) => product.is_primary_moisturizer === false).length, 13);
const scopeCounts = Object.fromEntries(
  [...new Set(balmProducts.map((product) => product.balm_usage_scope))]
    .sort()
    .map((scope) => [scope, balmProducts.filter((product) => product.balm_usage_scope === scope).length])
);
assert.deepEqual(scopeCounts, evidence.balmPrimaryRoleReview.scopeCounts);

const balmARows = deltas.rows.filter((row) => row.policy === "balm_candidate_a");
const balmBRows = deltas.rows.filter((row) => row.policy === "balm_candidate_b");
assert.equal(balmARows.filter((row) => row.eligibilityChanged).length, 156);
assert.equal(balmBRows.filter((row) => row.eligibilityChanged).length, 84);
assert.equal(countScenarioChanges(balmARows, "topPickChanged"), 2);
assert.equal(countScenarioChanges(balmARows, "top3Changed"), 2);
assert.equal(countScenarioChanges(balmBRows, "topPickChanged"), 2);
assert.equal(countScenarioChanges(balmBRows, "top3Changed"), 2);
assert.equal(summary.questions.balm.nonPrimaryProductsExposedInLegacyTopPickOrTop3, 2);
assert.equal(summary.questions.balm.localOrEyeLipLegacyTopPickCases, 1);
const multiAreaExposure = balmBRows.find(
  (row) =>
    row.productId === "8c2c12e7-2fa6-4230-bee6-958a4dc9dc97" &&
    row.userScenarioId === "U11"
);
assert(multiAreaExposure);
assert.equal(multiAreaExposure.candidateTop3, true);
assert.equal(evidence.balmPrimaryRoleReview.semanticVerdict, "BALM_CANDIDATE_A_REVIEWABLE");
assert.deepEqual(
  evidence.balmPrimaryRoleReview.dependencyVerdicts,
  ["NEEDS_BALM_ADMIN_CONTRACT", "NEEDS_ROLE_SCHEMA_REVIEW"]
);
assert.equal(evidence.balmPrimaryRoleReview.activationVerdict, "DO_NOT_ACTIVATE");

const sunscreens = productRows.filter((product) => product.category === "sunscreen");
assert.equal(sunscreens.length, 11);
for (const field of [
  "spf_value", "uva_label", "uv_filter_type", "white_cast",
  "eye_sting", "pilling_risk", "tone_up"
]) {
  assert.equal(sunscreens.filter((product) => product[field] != null).length, 11, field);
}
assert.equal(sunscreens.filter((product) => product.water_resistant_minutes != null).length, 1);
const sunscreenRows = deltas.rows.filter((row) => row.policy === "sunscreen_completeness");
assert.equal(sunscreenRows.filter((row) => row.eligibilityChanged).length, 0);
assert.equal(countScenarioChanges(sunscreenRows, "topPickChanged"), 0);
assert.equal(countScenarioChanges(sunscreenRows, "top3Changed"), 0);
assert.equal(summary.controls.sunscreenIncompleteFixture.passed, true);
assert.equal(evidence.sunscreenCompletenessReview.semanticVerdict, "CURRENT_CATALOG_NOOP_POLICY_REVIEWABLE");
assert.deepEqual(
  evidence.sunscreenCompletenessReview.dependencyVerdicts,
  ["ADMIN_V2_REQUIRED", "NEEDS_SUNSCREEN_COMPLETENESS_CONTRACT"]
);
assert.equal(evidence.sunscreenCompletenessReview.activationVerdict, "DO_NOT_ACTIVATE");

assert.equal(productRows.filter((product) => product.category === "toner_pad").length, 24);
assert.equal(productRows.filter((product) => product.category === "treatment").length, 18);
assert.deepEqual(evidence.crossCategoryBacklog.tonerPad.missingAxes, [
  "physical_friction", "embossing", "wipe_off_use", "exfoliation_frequency"
]);
assert.deepEqual(evidence.crossCategoryBacklog.treatment.missingAxes, [
  "active_identity", "active_strength", "recommended_frequency",
  "leave_on_or_rinse_off", "current_product_active_overlap"
]);
assert.deepEqual(evidence.crossCategoryBacklog.fabricatedFallback.currentValues, {
  concerns: ["dehydration"],
  finish: "natural",
  irritation_risk: "medium",
  sensitivity_safe: false,
  skin_types: ["combination"],
  texture: "watery"
});
for (const sourceAnchor of [
  'mapConcerns(product.concerns, ["dehydration"])',
  'mapSkinTypes(product.skin_types, ["combination"])',
  'function mapTexture(value, fallback = "watery")',
  'function mapFinish(value, fallback = "natural")',
  'return "medium";',
  "const sensitivitySafe = Boolean(product.sensitivity_safe);"
]) assert(productSource.includes(sourceAnchor), `fallback anchor missing: ${sourceAnchor}`);

for (const engineAnchor of [
  "function computeIngredientSignalScore",
  "computeReviewSignalScore",
  "function computeMarketConfidenceScore",
  "function getHeroBoost",
  "function getHardPenalty",
  'reasons.push("redness-deep-clean")'
]) assert(engineSource.includes(engineAnchor), `score source anchor missing: ${engineAnchor}`);
assert(/total\s*-=\s*18/.test(engineSource));
assert(/total\s*\+=\s*16/.test(engineSource));
assert(/total\s*\+=\s*14/.test(engineSource));

assert.equal(evidence.adminDependency.cleanserAdminV2Observed, false);
assert.equal(evidence.adminDependency.catalogReviewStatus, "NOT_AVAILABLE");
assert.deepEqual(evidence.adminDependency.activationBlockedBy, [
  "BLOCKED_ADMIN_CONTRACT", "BLOCKED_CATALOG_REVIEW", "BLOCKED_PENALTY_CALIBRATION"
]);
assert.equal(evidence.integrationDependencies.faceVisionPr133.mustIntegrateBeforeActivation, true);
assert.equal(evidence.integrationDependencies.adminPr166.providesCleanserAdminV2, false);
assert.equal(evidence.overallStatus, "RECOMMENDATION_SIDE_READY_WAITING_ADMIN_CONTRACT");

for (const marker of [
  "PENALTY_REQUIRES_MORE_EVIDENCE",
  "BALM_CANDIDATE_A_REVIEWABLE",
  "CURRENT_CATALOG_NOOP_POLICY_REVIEWABLE",
  "RECOMMENDATION_SIDE_READY_WAITING_ADMIN_CONTRACT",
  "DO_NOT_ACTIVATE"
]) assert(document.includes(marker), `document marker missing: ${marker}`);

for (const relative of [
  "app/api/analyze/route.js",
  "lib/skin-match-decision-engine.js",
  "lib/product-source.js",
  "lib/product-source-core.js",
  "lib/current-products.js"
]) {
  const source = await readFile(path.join(ROOT, relative), "utf8");
  assert.equal(
    source.includes("recommendation-follow-up-policy-review-v1"),
    false,
    `Production evidence import/reference: ${relative}`
  );
}

const tampered = structuredClone(evidence);
tampered.cleanserPenaltyCalibration.candidateResults[1].topPickChangedScenarios = 1;
const tamperedCopy = structuredClone(tampered);
delete tamperedCopy.canonicalEvidenceSha256;
assert.notEqual(digest(tamperedCopy), EXPECTED_EVIDENCE_DIGEST);

validateTaskDiff();

console.log(
  "verify-recommendation-follow-up-policy-review: PASS " +
  "(R2 penalty unresolved; R3 balm A reviewable; R4 current-catalog sunscreen no-op; " +
  "R5 backlog frozen; no activation)"
);
