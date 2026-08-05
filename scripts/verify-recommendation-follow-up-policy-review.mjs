import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { brotliDecompressSync } from "node:zlib";
import { spawnSync } from "node:child_process";
import path from "node:path";

const R = process.cwd();
const BASE = "f569e983ad700c07c0957f2a6ae09074ea483ff0";
const DIGEST = "78a02e711b15aef0b3930485943e424f225aaab979a17f849a6cc1fa49206abb";
const ALLOWED = new Set([
  ".codex/AI_WORK_LOG.d/2026-08-05-recommendation-follow-up-policy-review.md",
  "docs/architecture/recommendation-follow-up-policy-review-v1.md",
  "evidence/recommendation-metadata-shadow/recommendation-follow-up-policy-review-v1.json",
  "scripts/verify-recommendation-follow-up-policy-review.mjs",
  "scripts/verify-recommendation-metadata-offline-evidence.mjs"
]);
const j = async (p) => JSON.parse(await readFile(path.join(R, p), "utf8"));
const stable = (v) => Array.isArray(v)
  ? v.map(stable)
  : v && typeof v === "object"
    ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, stable(v[k])]))
    : v;
const sha = (v) => createHash("sha256").update(JSON.stringify(stable(v))).digest("hex");
const round = (v) => Math.round((v + Number.EPSILON) * 10000) / 10000;
const group = (rows, key) => {
  const result = new Map();
  for (const row of rows) {
    if (!result.has(row[key])) result.set(row[key], []);
    result.get(row[key]).push(row);
  }
  return result;
};
const scenarioChanges = (rows, field) =>
  [...group(rows, "userScenarioId").values()].filter((set) => set.some((row) => row[field])).length;

const [e, products, scenarios, deltas, summary, manifest, engine, source, doc] = await Promise.all([
  j("evidence/recommendation-metadata-shadow/recommendation-follow-up-policy-review-v1.json"),
  j("fixtures/recommendation-metadata/products-v1.json"),
  j("fixtures/recommendation-metadata/user-scenarios-v1.json"),
  j("evidence/recommendation-metadata-shadow/product-deltas-v1.json"),
  j("evidence/recommendation-metadata-shadow/scenario-summary-v1.json"),
  j("evidence/recommendation-metadata-shadow/cleanser-policy-comparison-v1.json"),
  readFile(path.join(R, "lib/skin-match-decision-engine.js"), "utf8"),
  readFile(path.join(R, "lib/product-source-core.js"), "utf8"),
  readFile(path.join(R, "docs/architecture/recommendation-follow-up-policy-review-v1.md"), "utf8")
]);

const semantic = structuredClone(e);
delete semantic.canonicalEvidenceSha256;
assert.equal(sha(semantic), DIGEST);
assert.equal(e.canonicalEvidenceSha256, DIGEST);
assert.equal(products.productCount, 164);
assert.equal(scenarios.scenarioCount, 12);
assert.equal(deltas.rowCount, 1908);
assert.equal(e.source.productsFixtureSha256, products.canonicalFixtureSha256);
assert.equal(e.source.scenarioFixtureSha256, scenarios.canonicalScenarioSha256);
assert.equal(e.source.productDeltaEvidenceSha256, deltas.canonicalEvidenceSha256);
assert.equal(e.source.scenarioSummarySha256, summary.canonicalSummarySha256);
assert.equal(e.source.cleanserAuthorityEvidenceSha256, manifest.payloadSha256);

let encoded = "";
for (const chunk of manifest.payloadChunks) {
  const content = await readFile(path.join(R, chunk.path), "utf8");
  assert.equal(content.length, chunk.length);
  assert.equal(createHash("sha256").update(content).digest("hex"), chunk.sha256);
  encoded += content;
}
assert.equal(createHash("sha256").update(encoded).digest("hex"), manifest.payloadEncodedSha256);
const payload = JSON.parse(brotliDecompressSync(Buffer.from(encoded, "base64")));
assert.equal(payload.canonicalEvidenceSha256, manifest.payloadSha256);
const rows = payload.actualCatalog.rows.map((values) =>
  Object.fromEntries(payload.actualCatalog.columns.map((column, index) => [column, values[index]]))
);
const p2 = rows.filter((row) => row.policyId === "P2");
assert.equal(p2.length, 312);
assert.equal(new Set(p2.map((row) => row.productId)).size, 26);
assert.equal(new Set(p2.filter((row) => row.deepDetected).map((row) => row.productId)).size, 9);
assert.equal(p2.filter((row) => row.heuristicValue).length, 0);
assert.deepEqual(
  [...new Set(p2.filter((row) => row.rednessRuleActive).map((row) => row.scenarioId))].sort(),
  ["U5", "U6", "U8", "U9"]
);

function simulate(magnitude) {
  const all = [];
  let top1 = 0, top3 = 0, applied = 0, maxMove = 0, maxDrop = 0, unchanged = 0, deepTop3 = 0;
  for (const set of group(p2, "scenarioId").values()) {
    const ranked = set.map((row) => ({
      ...row,
      score: row.legacyScore - (row.rednessRuleActive && row.deepDetected ? magnitude : 0)
    })).sort((a, b) => b.score - a.score || a.legacyRank - b.legacyRank)
      .map((row, index) => ({ ...row, rank: index + 1, top1: index === 0, top3: index < 3 }));
    top1 += Number(ranked.find((row) => row.legacyTopPick).productId !== ranked[0].productId);
    top3 += Number(
      JSON.stringify(ranked.filter((row) => row.legacyTop3).map((row) => row.productId).sort()) !==
      JSON.stringify(ranked.filter((row) => row.top3).map((row) => row.productId).sort())
    );
    for (const row of ranked) {
      const delta = row.rank - row.legacyRank;
      maxMove = Math.max(maxMove, Math.abs(delta));
      if (magnitude > 0 && row.rednessRuleActive && row.deepDetected) {
        applied += 1; maxDrop = Math.max(maxDrop, delta);
        unchanged += Number(delta === 0); deepTop3 += Number(row.top3);
      }
      all.push(row);
    }
  }
  return {
    candidateId: `P${magnitude}`,
    deepCleanProductsRemainingTop3InRednessScenarioCount: deepTop3,
    largestPenalizedProductRankDrop: maxDrop,
    maxAbsoluteRankMovementAllProducts: maxMove,
    maxAdverseScoreDelta: magnitude ? -magnitude : 0,
    meanScoreDeltaAllCleanserRows: round(
      all.reduce((sum, row) => sum + row.score - row.legacyScore, 0) / all.length
    ),
    nonRednessScoreDeltaRows: all.filter((row) => !row.rednessRuleActive && row.score !== row.legacyScore).length,
    penaltyAppliedRows: applied,
    penaltyRowsRankUnchanged: unchanged,
    penaltyValue: magnitude ? -magnitude : 0,
    top3ChangedScenarios: top3,
    topPickChangedScenarios: top1
  };
}
assert.deepEqual([0, 8, 12, 18].map(simulate), e.cleanserPenaltyCalibration.candidateResults);
assert.equal(e.cleanserPenaltyCalibration.verdict, "PENALTY_REQUIRES_MORE_EVIDENCE");
assert.equal(e.cleanserPenaltyCalibration.activationAllowed, false);
assert.deepEqual(e.cleanserPenaltyCalibration.rednessTop3Distance.map((x) => x.gapToTop3Cutoff), [47.3, 51, 26.8, 47]);
for (const fixture of e.cleanserPenaltyCalibration.adversarialMarginFixtures) {
  for (const outcome of fixture.candidateOutcomes) {
    const magnitude = Number(outcome.candidateId.slice(1));
    const margin = Math.round((fixture.deepLeadMargin - magnitude) * 10) / 10;
    assert.equal(outcome.postPenaltyMarginDeepMinusSafe, margin);
    assert.equal(outcome.exactTie, margin === 0);
    assert.equal(outcome.topPick, margin >= 0 ? "deep_clean" : "safe_cleanser");
  }
}

const balm = products.products.filter((p) => p.category === "moisturizer_balm");
assert.equal(balm.length, 20);
assert.equal(balm.filter((p) => p.is_primary_moisturizer === true).length, 7);
assert.equal(balm.filter((p) => p.is_primary_moisturizer === false).length, 13);
const a = deltas.rows.filter((row) => row.policy === "balm_candidate_a");
const b = deltas.rows.filter((row) => row.policy === "balm_candidate_b");
assert.deepEqual(
  [a.filter((r) => r.eligibilityChanged).length, scenarioChanges(a, "topPickChanged"), scenarioChanges(a, "top3Changed")],
  [156, 2, 2]
);
assert.deepEqual(
  [b.filter((r) => r.eligibilityChanged).length, scenarioChanges(b, "topPickChanged"), scenarioChanges(b, "top3Changed")],
  [84, 2, 2]
);
assert.equal(summary.questions.balm.nonPrimaryProductsExposedInLegacyTopPickOrTop3, 2);
assert.equal(b.find((r) => r.productId === "8c2c12e7-2fa6-4230-bee6-958a4dc9dc97" && r.userScenarioId === "U11").candidateTop3, true);
assert.equal(e.balmPrimaryRoleReview.semanticVerdict, "BALM_CANDIDATE_A_REVIEWABLE");
assert.equal(e.balmPrimaryRoleReview.activationVerdict, "DO_NOT_ACTIVATE");

const suns = products.products.filter((p) => p.category === "sunscreen");
assert.equal(suns.length, 11);
for (const field of ["spf_value", "uva_label", "uv_filter_type", "white_cast", "eye_sting", "pilling_risk", "tone_up"]) {
  assert.equal(suns.filter((p) => p[field] != null).length, 11);
}
assert.equal(suns.filter((p) => p.water_resistant_minutes != null).length, 1);
const sunRows = deltas.rows.filter((row) => row.policy === "sunscreen_completeness");
assert.deepEqual(
  [sunRows.filter((r) => r.eligibilityChanged).length, scenarioChanges(sunRows, "topPickChanged"), scenarioChanges(sunRows, "top3Changed")],
  [0, 0, 0]
);
assert.equal(summary.controls.sunscreenIncompleteFixture.passed, true);
assert.equal(e.sunscreenCompletenessReview.semanticVerdict, "CURRENT_CATALOG_NOOP_POLICY_REVIEWABLE");
assert.equal(e.sunscreenCompletenessReview.activationVerdict, "DO_NOT_ACTIVATE");

assert.equal(products.products.filter((p) => p.category === "toner_pad").length, 24);
assert.equal(products.products.filter((p) => p.category === "treatment").length, 18);
assert.deepEqual(e.crossCategoryBacklog.fabricatedFallback.currentValues, {
  concerns: ["dehydration"], finish: "natural", irritation_risk: "medium",
  sensitivity_safe: false, skin_types: ["combination"], texture: "watery"
});
for (const anchor of [
  'mapConcerns(product.concerns, ["dehydration"])',
  'mapSkinTypes(product.skin_types, ["combination"])',
  'function mapTexture(value, fallback = "watery")',
  'function mapFinish(value, fallback = "natural")',
  "const sensitivitySafe = Boolean(product.sensitivity_safe);"
]) assert(source.includes(anchor));
for (const anchor of [
  "function computeIngredientSignalScore", "computeReviewSignalScore",
  "function computeMarketConfidenceScore", "function getHeroBoost",
  "function getHardPenalty", 'reasons.push("redness-deep-clean")'
]) assert(engine.includes(anchor));
assert(/total\s*-=\s*18/.test(engine));
assert(/total\s*\+=\s*16/.test(engine));
assert(/total\s*\+=\s*14/.test(engine));

assert.equal(e.adminDependency.cleanserAdminV2Observed, false);
assert.equal(e.adminDependency.catalogReviewStatus, "NOT_AVAILABLE");
assert.equal(e.integrationDependencies.adminPr166.providesCleanserAdminV2, false);
assert.equal(e.integrationDependencies.faceVisionPr133.mustIntegrateBeforeActivation, true);
assert.equal(e.overallStatus, "RECOMMENDATION_SIDE_READY_WAITING_ADMIN_CONTRACT");
for (const marker of [
  "PENALTY_REQUIRES_MORE_EVIDENCE", "BALM_CANDIDATE_A_REVIEWABLE",
  "CURRENT_CATALOG_NOOP_POLICY_REVIEWABLE", "RECOMMENDATION_SIDE_READY_WAITING_ADMIN_CONTRACT",
  "DO_NOT_ACTIVATE"
]) assert(doc.includes(marker));

for (const file of ["app/api/analyze/route.js", "lib/skin-match-decision-engine.js", "lib/product-source.js", "lib/product-source-core.js", "lib/current-products.js"]) {
  assert.equal((await readFile(path.join(R, file), "utf8")).includes("recommendation-follow-up-policy-review-v1"), false);
}
const diff = spawnSync("git", ["diff", "--name-only", `${BASE}..HEAD`], { cwd: R, encoding: "utf8" });
assert.equal(diff.status, 0, diff.stderr);
const paths = diff.stdout.split(/\r?\n/).filter(Boolean);
assert(paths.length > 0);
for (const file of paths) assert(ALLOWED.has(file), `unexpected review path: ${file}`);

console.log("verify-recommendation-follow-up-policy-review: PASS (R2 unresolved; R3/R4 reviewable but inactive; R5 frozen)");
