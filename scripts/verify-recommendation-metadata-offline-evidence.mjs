import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const generatedArg = args.indexOf("--generated");
const GENERATED_ROOT = generatedArg >= 0 ? path.resolve(args[generatedArg + 1]) : ROOT;
const ALLOW_MISSING = args.includes("--allow-missing");
const EXPECTED_CATEGORIES = {
  cleanser: 26,
  moisturizer_balm: 20,
  moisturizer_cream: 10,
  moisturizer_gel: 10,
  moisturizer_lotion_emulsion: 21,
  sunscreen: 11,
  toner_essence: 24,
  toner_pad: 24,
  treatment: 18
};
const PRODUCT_KEYS = [
  "balm_caution_tags","balm_functional_tags","balm_research_confidence","balm_type","balm_usage_scope",
  "brand","category","cleansing_profile","concerns","eye_sting","finish","id","ingredient_signals",
  "irritation_risk","is_mens","is_primary_moisturizer","market_signals","name","pilling_risk","price_max",
  "price_min","product_form","recommendation_tier","review_signals","sensitivity_safe","size_ml","skin_types",
  "spf_value","texture","tone_up","unit_price_per_10ml","uv_filter_type","uva_label","water_resistant_minutes","white_cast"
].sort();
const FORBIDDEN_KEYS = new Set(["access_token","authorization","buy_link","cookie","credentials","email","external_url","image_url","password","raw_provider_response","refresh_token","service_role_key","session","source_url","user_id"]);
const SECRET_PATTERNS = [/\bsk-[A-Za-z0-9_-]{16,}\b/,/service[_-]?role/i,/bearer\s+[A-Za-z0-9._-]{16,}/i,/-----BEGIN [A-Z ]+PRIVATE KEY-----/];
const ARTIFACTS = [
  "evidence/recommendation-metadata-shadow/product-deltas-v1.json",
  "evidence/recommendation-metadata-shadow/scenario-summary-v1.json",
  "evidence/recommendation-metadata-shadow/category-summary-v1.csv",
  "docs/architecture/recommendation-metadata-shadow-evidence-v1.md"
];

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  return value;
}
function canonical(value) { return JSON.stringify(stable(value)); }
function digest(value) { return createHash("sha256").update(canonical(value)).digest("hex"); }
function without(value, key) { const clone = structuredClone(value); delete clone[key]; return clone; }
function walk(value, visitor, pathParts = []) {
  visitor(value, pathParts);
  if (Array.isArray(value)) value.forEach((item, index) => walk(item, visitor, [...pathParts, String(index)]));
  else if (value && typeof value === "object") Object.entries(value).forEach(([key,item]) => walk(item, visitor, [...pathParts,key]));
}
function validateNoForbidden(value) {
  walk(value, (item, parts) => {
    const key = parts.at(-1);
    if (key) assert(!FORBIDDEN_KEYS.has(key.toLowerCase()), `forbidden field: ${parts.join(".")}`);
    if (typeof item === "string") {
      assert(!/^https?:\/\//i.test(item), `raw URL forbidden: ${parts.join(".")}`);
      for (const pattern of SECRET_PATTERNS) assert(!pattern.test(item), `secret-like value: ${parts.join(".")}`);
    }
  });
}
function validateFixture(fixture) {
  assert.equal(fixture.schemaVersion, "recommendation-metadata-products-v1");
  assert.equal(fixture.productCount, 164);
  assert.equal(fixture.products.length, 164);
  assert.equal(new Set(fixture.products.map((row) => row.id)).size, 164);
  assert.deepEqual(fixture.categoryCounts, EXPECTED_CATEGORIES);
  assert.equal(fixture.canonicalFixtureSha256, digest(without(fixture, "canonicalFixtureSha256")));
  for (const product of fixture.products) assert.deepEqual(Object.keys(product).sort(), PRODUCT_KEYS, `schema drift: ${product.id}`);
  const sorted = [...fixture.products].sort((left,right) => String(left.category).localeCompare(String(right.category),"en") || String(left.brand).localeCompare(String(right.brand),"en") || String(left.name).localeCompare(String(right.name),"en") || String(left.id).localeCompare(String(right.id),"en"));
  assert.deepEqual(fixture.products.map((row) => row.id), sorted.map((row) => row.id), "fixture sort drift");
  assert.equal(fixture.products.filter((row) => row.category === "cleanser" && row.cleansing_profile === "low_ph").length, 10);
  assert.equal(fixture.products.filter((row) => row.category === "cleanser" && row.cleansing_profile === "balanced").length, 7);
  assert.equal(fixture.products.filter((row) => row.category === "cleanser" && row.cleansing_profile === "deep_clean").length, 9);
  assert.equal(fixture.products.filter((row) => row.category === "cleanser" && row.cleansing_profile == null).length, 0);
  assert.equal(fixture.products.filter((row) => row.category === "moisturizer_balm" && row.is_primary_moisturizer === true).length, 7);
  assert.equal(fixture.products.filter((row) => row.category === "moisturizer_balm" && row.is_primary_moisturizer === false).length, 13);
  assert.equal(fixture.products.filter((row) => row.category === "sunscreen" && row.spf_value != null).length, 11);
  assert.equal(fixture.products.filter((row) => row.category === "sunscreen" && row.uva_label != null).length, 11);
  assert.equal(fixture.products.filter((row) => row.category === "sunscreen" && row.water_resistant_minutes != null).length, 1);
  validateNoForbidden(fixture);
}
function validateScenarioFixture(fixture) {
  assert.equal(fixture.schemaVersion, "recommendation-metadata-user-scenarios-v1");
  assert(fixture.scenarioCount >= 8);
  assert.equal(fixture.scenarioCount, fixture.scenarios.length);
  assert.equal(new Set(fixture.scenarios.map((row) => row.id)).size, fixture.scenarios.length);
  assert.equal(fixture.canonicalScenarioSha256, digest(without(fixture, "canonicalScenarioSha256")));
  validateNoForbidden(fixture);
}
function validateEvidence(productDeltas, summary) {
  assert.equal(productDeltas.schemaVersion, "recommendation-metadata-product-deltas-v1");
  assert.equal(productDeltas.rowCount, 1908);
  assert.equal(productDeltas.rows.length, 1908);
  assert.equal(productDeltas.canonicalEvidenceSha256, digest(without(productDeltas, "canonicalEvidenceSha256")));
  const byScenarioPolicy = new Map();
  for (const row of productDeltas.rows) {
    const key = `${row.userScenarioId}:${row.policy}`;
    if (!byScenarioPolicy.has(key)) byScenarioPolicy.set(key, []);
    byScenarioPolicy.get(key).push(row);
    assert.equal(row.scoreDelta, Math.round((row.candidateScore - row.legacyScore) * 10) / 10);
    assert.equal(row.eligibilityChanged, row.legacyPrimaryEligible !== row.candidatePrimaryEligible);
    assert.equal(row.penaltyChanged, row.legacyPenalty !== row.candidatePenalty);
  }
  for (const scenario of Array.from({ length: 12 }, (_, index) => `U${index + 1}`)) {
    assert.equal(byScenarioPolicy.get(`${scenario}:cleanser_structured_authority`)?.length, 26);
    assert.equal(byScenarioPolicy.get(`${scenario}:balm_candidate_a`)?.length, 61);
    assert.equal(byScenarioPolicy.get(`${scenario}:balm_candidate_b`)?.length, 61);
    assert.equal(byScenarioPolicy.get(`${scenario}:sunscreen_completeness`)?.length, 11);
  }
  assert.equal(summary.schemaVersion, "recommendation-metadata-scenario-summary-v1");
  assert.equal(summary.canonicalSummarySha256, digest(without(summary, "canonicalSummarySha256")));
  assert.equal(summary.overallStatus, "EVIDENCE_READY_NO_ACTIVATION");
  assert.equal(summary.scenarios.length, 12);
  assert.equal(summary.aggregates.length, 48);
  for (const invariant of ["allActualRankingHashesMatch","allActualResponseHashesMatch","allScoreHashesMatch","allExplanationHashesMatch","allPersistenceHashesMatch","allCandidatePolicyFingerprintsMatch"]) assert.equal(summary.productionInvariance[invariant], true, invariant);
  assert.equal(summary.questions.cleanser.falseNegativeProducts, 9);
  assert.equal(summary.questions.balm.metadataUnknownProducts, 0);
  assert.equal(summary.questions.sunscreen.currentCatalogRankChangeCount, 0);
  assert.equal(summary.questions.sunscreen.waterResistanceUnknownProducts, 10);
  assert.equal(summary.questions.sunscreen.virtualIncompleteFixture.passed, true);
  for (const aggregate of summary.aggregates) {
    const rows = byScenarioPolicy.get(`${aggregate.scenario}:${aggregate.policy}`);
    assert(rows, `aggregate rows missing: ${aggregate.scenario}:${aggregate.policy}`);
    assert.equal(aggregate.productsEvaluated, rows.length);
    assert.equal(aggregate.eligibilityChangedCount, rows.filter((row) => row.eligibilityChanged).length);
    assert.equal(aggregate.penaltyChangedCount, rows.filter((row) => row.penaltyChanged).length);
    assert.equal(aggregate.topPickChanged, rows.some((row) => row.topPickChanged));
    assert.equal(aggregate.top3Changed, rows.some((row) => row.top3Changed));
  }
  validateNoForbidden(productDeltas);
  validateNoForbidden(summary);
}
async function listFiles(directory) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await listFiles(target));
    else output.push(target);
  }
  return output;
}
async function verifyNoRuntimeImports() {
  for (const root of ["app","lib","components"]) {
    const directory = path.join(ROOT, root);
    for (const file of await listFiles(directory)) {
      if (!/\.(?:js|jsx|ts|tsx|mjs)$/.test(file)) continue;
      const source = await readFile(file, "utf8");
      assert(!source.includes("fixtures/recommendation-metadata"), `Production fixture import: ${path.relative(ROOT,file)}`);
      assert(!source.includes("evidence/recommendation-metadata-shadow"), `Production evidence import: ${path.relative(ROOT,file)}`);
    }
  }
  const scorer = await readFile(path.join(ROOT, "lib/recommendation-scoring.ts"), "utf8");
  const engine = await readFile(path.join(ROOT, "lib/skin-match-decision-engine.js"), "utf8");
  assert(!scorer.includes("recommendation-metadata-transport-shadow"));
  assert(!engine.includes("recommendation-metadata-transport-shadow"));
}
function runBuilder(output, productsFixture, scenariosFixture) {
  const result = spawnSync(process.execPath, ["--loader", "./scripts/recommendation-metadata-offline-loader.mjs", "scripts/build-recommendation-metadata-offline-evidence.mjs", "--output", output, "--products-fixture", productsFixture, "--scenarios-fixture", scenariosFixture], { cwd: ROOT, encoding: "utf8", env: { ...process.env, ENABLE_EVALUATOR_BOUNDARY_CANDIDATE_POLICY_RUNTIME: "", DISABLE_EVALUATOR_BOUNDARY_CANDIDATE_POLICY_RUNTIME: "" } });
  if (result.status !== 0) throw new Error(`builder failed: ${result.stdout}\n${result.stderr}`);
}
async function compareArtifacts(leftRoot, rightRoot) {
  for (const relative of ARTIFACTS) {
    const left = await readFile(path.join(leftRoot, relative));
    const right = await readFile(path.join(rightRoot, relative));
    assert(left.equals(right), `artifact byte drift: ${relative}`);
  }
}

const fixturePath = path.join(ROOT, "fixtures/recommendation-metadata/products-v1.json");
const scenarioPath = path.join(ROOT, "fixtures/recommendation-metadata/user-scenarios-v1.json");
const fixture = JSON.parse(await readFile(fixturePath, "utf8"));
const scenarios = JSON.parse(await readFile(scenarioPath, "utf8"));
validateFixture(fixture);
validateScenarioFixture(scenarios);
await verifyNoRuntimeImports();

const generatedProductDeltas = JSON.parse(await readFile(path.join(GENERATED_ROOT, "evidence/recommendation-metadata-shadow/product-deltas-v1.json"), "utf8"));
const generatedSummary = JSON.parse(await readFile(path.join(GENERATED_ROOT, "evidence/recommendation-metadata-shadow/scenario-summary-v1.json"), "utf8"));
validateEvidence(generatedProductDeltas, generatedSummary);
if (!ALLOW_MISSING) {
  const repositoryProductDeltas = JSON.parse(await readFile(path.join(ROOT, "evidence/recommendation-metadata-shadow/product-deltas-v1.json"), "utf8"));
  const repositorySummary = JSON.parse(await readFile(path.join(ROOT, "evidence/recommendation-metadata-shadow/scenario-summary-v1.json"), "utf8"));
  validateEvidence(repositoryProductDeltas, repositorySummary);
  await compareArtifacts(ROOT, GENERATED_ROOT);
}

const temp = await mkdtemp(path.join(os.tmpdir(), "recommendation-metadata-evidence-"));
try {
  const runA = path.join(temp, "a");
  const runB = path.join(temp, "b");
  const runReversed = path.join(temp, "reversed");
  runBuilder(runA, fixturePath, scenarioPath);
  runBuilder(runB, fixturePath, scenarioPath);
  await compareArtifacts(runA, runB);
  const reversedFixturePath = path.join(temp, "products-reversed.json");
  const reversedScenarioPath = path.join(temp, "scenarios-reversed.json");
  await writeFile(reversedFixturePath, JSON.stringify({ ...fixture, products: [...fixture.products].reverse() }));
  await writeFile(reversedScenarioPath, JSON.stringify({ ...scenarios, scenarios: [...scenarios.scenarios].reverse() }));
  runBuilder(runReversed, reversedFixturePath, reversedScenarioPath);
  await compareArtifacts(runA, runReversed);

  const duplicate = structuredClone(fixture);
  duplicate.products[1].id = duplicate.products[0].id;
  assert.throws(() => validateFixture(duplicate));
  const missing = structuredClone(fixture);
  missing.products.pop(); missing.productCount -= 1;
  assert.throws(() => validateFixture(missing));
  const categoryMismatch = structuredClone(fixture);
  categoryMismatch.categoryCounts.cleanser -= 1;
  assert.throws(() => validateFixture(categoryMismatch));
  const metadataTamper = structuredClone(fixture);
  metadataTamper.products[0].cleansing_profile = "deep_clean";
  assert.throws(() => validateFixture(metadataTamper));
  const invalidEnum = structuredClone(fixture);
  invalidEnum.products[0].cleansing_profile = "extreme_clean";
  invalidEnum.canonicalFixtureSha256 = digest(without(invalidEnum, "canonicalFixtureSha256"));
  assert(!["low_ph","balanced","deep_clean",null].includes(invalidEnum.products[0].cleansing_profile));
  const unknownField = structuredClone(fixture);
  unknownField.products[0].unexpected = true;
  unknownField.canonicalFixtureSha256 = digest(without(unknownField, "canonicalFixtureSha256"));
  assert.throws(() => validateFixture(unknownField));
  const secret = structuredClone(fixture);
  secret.products[0].name = "sk-proj-abcdefghijklmnopqrstuvwxyz";
  secret.canonicalFixtureSha256 = digest(without(secret, "canonicalFixtureSha256"));
  assert.throws(() => validateFixture(secret));
  const rawUrl = structuredClone(fixture);
  rawUrl.products[0].name = "https://example.com/product";
  rawUrl.canonicalFixtureSha256 = digest(without(rawUrl, "canonicalFixtureSha256"));
  assert.throws(() => validateFixture(rawUrl));
  const rankTamper = structuredClone(generatedProductDeltas);
  rankTamper.rows[0].candidateRank = 999;
  assert.throws(() => validateEvidence(rankTamper, generatedSummary));
  const aggregateTamper = structuredClone(generatedSummary);
  aggregateTamper.aggregates[0].productsEvaluated += 1;
  aggregateTamper.canonicalSummarySha256 = digest(without(aggregateTamper, "canonicalSummarySha256"));
  assert.throws(() => validateEvidence(generatedProductDeltas, aggregateTamper));
} finally {
  await rm(temp, { recursive: true, force: true });
}
console.log(`RECOMMENDATION_METADATA_EVIDENCE_VERIFY=PASS products=164 scenarios=12 rows=${generatedProductDeltas.rowCount}`);
