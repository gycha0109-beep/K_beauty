import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  ADMIN_V1_UNSUPPORTED_METADATA_FIELDS,
  attachRecommendationMetadataTransport,
  buildRecommendationMetadataTransport,
  clearRecommendationMetadataTransportRegistryForTests,
  getRecommendationMetadataTransport,
  identifyRecommendationMetadataFallbacks
} from "../lib/recommendation-metadata-transport.js";
import { buildRecommendationMetadataTransportShadow } from
  "../lib/recommendation-metadata-transport-shadow.js";

let assertions = 0;
const eq = (actual, expected, message) => {
  assertions += 1;
  assert.deepEqual(actual, expected, message);
};
const ok = (value, message) => {
  assertions += 1;
  assert.ok(value, message);
};
const stable = (value) => Array.isArray(value)
  ? value.map(stable)
  : value && typeof value === "object"
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]))
    : value;
const hash = (value) => createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
const gitBlobHash = (content) => createHash("sha1")
  .update(`blob ${Buffer.byteLength(content)}\0${content}`)
  .digest("hex");

let candidateFingerprint = hash;
try {
  const candidateShadow = await import("../lib/candidate-exposure-policy-shadow.js");
  candidateFingerprint = candidateShadow.fingerprintCandidateExposureShadowValue || hash;
} catch {}

function fixture(row) {
  return attachRecommendationMetadataTransport({
    id: row.id,
    name: row.name || row.id,
    brand: "Fixture",
    category: row.category,
    decision_meta: { slot: row.slot },
    engine_score: row.score ?? 0,
    score: row.score ?? 0,
    reason: `reason:${row.id}`,
    comparison_reason: `comparison:${row.id}`
  }, row, {
    role: "recommendation_product",
    metadataFallbacksApplied: identifyRecommendationMetadataFallbacks(row)
  });
}

clearRecommendationMetadataTransportRegistryForTests();

const validSource = {
  id: "valid", category: "moisturizer_balm",
  cleansing_profile: "deep_clean",
  balm_functional_tags: ["barrier_repair"],
  balm_usage_scope: "full_face", balm_type: "barrier",
  is_primary_moisturizer: false, balm_caution_tags: [],
  balm_research_confidence: "high", spf_value: "SPF50+",
  uva_label: "PA++++", water_resistant_minutes: 80,
  uv_filter_type: "hybrid", tone_up: false, white_cast: "low",
  eye_sting: "medium", pilling_risk: "low",
  skin_types: ["sensitive"], concerns: ["barrier"],
  texture: "cream", finish: "dewy", irritation_risk: "low",
  sensitivity_safe: true
};
const sourceBefore = structuredClone(validSource);
const projected = fixture(validSource);
const envelope = getRecommendationMetadataTransport(projected);
eq(validSource, sourceBefore, "source row unchanged");
eq(envelope.metadata.cleansing_profile, "deep_clean", "cleanser metadata transported");
eq(envelope.metadata.is_primary_moisturizer, false, "false preserved");
eq(envelope.metadata.balm_caution_tags, [], "empty array distinct from null");
eq(envelope.metadata.water_resistant_minutes, 80, "number transported");
ok(Object.isFrozen(envelope), "transport envelope deep boundary frozen");
ok(Object.isFrozen(envelope.metadata), "metadata object frozen");
ok(Object.isFrozen(envelope.metadata.balm_functional_tags), "metadata arrays frozen");
ok(!Object.keys(projected).includes("cleansing_profile"), "transport non-enumerable");
const publicHash = hash(projected);
const spread = { ...projected };
eq(getRecommendationMetadataTransport(spread)?.metadata.cleansing_profile, "deep_clean", "metadata recovered after scorer spread");
eq(hash(projected), publicHash, "projection serialization invariant");

const nulls = buildRecommendationMetadataTransport(Object.fromEntries(
  ADMIN_V1_UNSUPPORTED_METADATA_FIELDS.map((field) => [field, null])
));
ok(Object.values(nulls.metadata).every((value) => value === null), "null preserved");
eq(nulls.metadataMissing.length, 15, "all null metadata diagnosed missing");

const invalid = buildRecommendationMetadataTransport({
  cleansing_profile: "gentle", balm_functional_tags: "tag",
  balm_usage_scope: "face_all", balm_type: "other",
  is_primary_moisturizer: "false", balm_caution_tags: [""],
  balm_research_confidence: "certain", spf_value: 50, uva_label: false,
  water_resistant_minutes: -1, uv_filter_type: "chemical", tone_up: 0,
  white_cast: "clear", eye_sting: "none", pilling_risk: "unknown"
});
eq(invalid.metadataInvalid.length, 15, "invalid metadata fail-closed");
ok(Object.values(invalid.metadata).every((value) => value === null), "invalid metadata never fabricated");

const fallbacks = identifyRecommendationMetadataFallbacks({});
for (const expected of [
  "skin_types:combination", "concerns:dehydration", "texture:watery",
  "finish:natural", "irritation_risk:medium", "sensitivity_safe:false"
]) ok(fallbacks.includes(expected), `${expected} observable`);

const cleanserMatrix = [
  ["c1", "deep_clean", false], ["c2", "deep_clean", true],
  ["c3", "balanced", false], ["c4", "balanced", true],
  ["c5", null, false], ["c6", null, true]
].map(([id, profile, heuristic], index) => fixture({
  id, category: "cleanser", slot: "cleanser", score: 100 - index,
  name: heuristic ? `Deep Clean ${id}` : `클렌저 ${id}`,
  cleansing_profile: profile, skin_types: ["combination"],
  concerns: ["redness"], texture: "gel", finish: "natural",
  irritation_risk: "medium", sensitivity_safe: false
}));
const cleanserBefore = structuredClone(cleanserMatrix);
const cleanserShadow = buildRecommendationMetadataTransportShadow({
  candidates: cleanserMatrix,
  canonicalState: { freeResult: { scoring: { concernScores: { redness: { total: 22 } } } } },
  evaluatedAt: "2026-08-05T00:00:00.000Z"
});
const cleanserRows = cleanserShadow.cleanser[0].products;
eq(cleanserRows.map((row) => row.scoreDelta), [-18, 0, 0, 18, 0, 18], "six structured/heuristic combinations");
eq(cleanserRows.map((row) => row.metadataHeuristicConflict), [true, false, false, true, false, true], "conflicts explicit");
eq(cleanserMatrix, cleanserBefore, "cleanser what-if pure");
eq(cleanserShadow.cleanser.length, 5, "five required cleanser scenarios");

const balmProducts = [
  fixture({ id: "local", category: "moisturizer_balm", slot: "moisturizer", score: 100, is_primary_moisturizer: false, balm_usage_scope: "local_area", balm_functional_tags: [], balm_type: "barrier", balm_caution_tags: ["not_primary_moisturizer"], balm_research_confidence: "high" }),
  fixture({ id: "eye", category: "moisturizer_balm", slot: "moisturizer", score: 99, is_primary_moisturizer: false, balm_usage_scope: "eye_lip", balm_functional_tags: ["eye_care"], balm_type: "eye_lip", balm_caution_tags: ["eye_area_only"], balm_research_confidence: "medium" }),
  fixture({ id: "primary", category: "moisturizer_balm", slot: "moisturizer", score: 98, is_primary_moisturizer: true, balm_usage_scope: "full_face", balm_functional_tags: ["barrier_repair"], balm_type: "barrier", balm_caution_tags: [], balm_research_confidence: "high" }),
  fixture({ id: "unknown", category: "moisturizer_balm", slot: "moisturizer", score: 97, is_primary_moisturizer: null, balm_usage_scope: null }),
  fixture({ id: "cream", category: "moisturizer_cream", slot: "moisturizer", score: 96 })
];
const balm = buildRecommendationMetadataTransportShadow({ candidates: balmProducts }).balm;
eq(balm.map((scenario) => scenario.candidateTop1), ["primary", "primary"], "balm candidates A/B simulated");
ok(balm[0].products.find((row) => row.productId === "unknown").candidatePrimaryEligible, "unknown balm not rejected");
eq(balm[0].products.find((row) => row.productId === "unknown").classification, "metadata_unknown", "unknown balm classified");
ok(balm[0].products.find((row) => row.productId === "local").classifications.includes("review_required"), "review-required remains an additive classification");

const sunscreens = [
  fixture({ id: "none", category: "sunscreen", slot: "sunscreen", score: 100 }),
  fixture({ id: "spf", category: "sunscreen", slot: "sunscreen", score: 99, spf_value: "SPF50+" }),
  fixture({ id: "uva", category: "sunscreen", slot: "sunscreen", score: 98, uva_label: "PA++++" }),
  fixture({ id: "full", category: "sunscreen", slot: "sunscreen", score: 97, spf_value: "SPF50+", uva_label: "PA++++" }),
  fixture({ id: "water", category: "sunscreen", slot: "sunscreen", score: 96, spf_value: "SPF50+", uva_label: "Broad Spectrum", water_resistant_minutes: 80 })
];
const sunscreen = buildRecommendationMetadataTransportShadow({ candidates: sunscreens }).sunscreen;
eq(sunscreen.candidateTop1, "full", "incomplete protection excluded in what-if only");
eq(sunscreen.products.map((row) => row.eligibilityReason), ["spf_and_uva_unknown", "uva_unknown", "spf_unknown", "spf_and_uva_present", "spf_and_uva_present"], "unknown states explicit");
eq(sunscreen.products.map((row) => row.waterResistanceKnown), [false, false, false, false, true], "water resistance unknown preserved");

for (const [cohort, redness] of [
  ["oily_sebum", 5], ["oily_dehydration", 18],
  ["combination_dehydration", 18], ["dry_barrier", 18],
  ["sensitive_redness", 22], ["recent_instability", 20],
  ["makeup_use", 8], ["eye_sensitive", 12]
]) {
  const products = cleanserMatrix.map((product) => ({ ...product }));
  const before = candidateFingerprint({ cohort, products });
  const result = buildRecommendationMetadataTransportShadow({
    candidates: products,
    canonicalState: { freeResult: { scoring: { concernScores: { redness: { total: redness } } } } }
  });
  eq(candidateFingerprint({ cohort, products }), before, `${cohort} fingerprint invariant`);
  ok(Object.values(result.productionInvariance).every(Boolean), `${cohort} actual output invariant`);
}

const productSourceWrapper = await readFile(new URL("../lib/product-source.js", import.meta.url), "utf8");
ok(productSourceWrapper.includes("product-source-core.js"), "current-main source delegated without rewrite");
ok(productSourceWrapper.includes("current_product_snapshot"), "current-product snapshot transport wired");
ok(productSourceWrapper.includes("recommendation_product"), "recommendation product transport wired");
try {
  const coreSource = await readFile(new URL("../lib/product-source-core.js", import.meta.url), "utf8");
  eq(gitBlobHash(coreSource), "7b4911d73f1bb3059fe6afc51aab3a9c445a22fc", "current-main product source blob preserved exactly");
} catch {}

for (const field of ["cleansing_profile", "is_primary_moisturizer", "spf_value"])
  ok(ADMIN_V1_UNSUPPORTED_METADATA_FIELDS.includes(field), `Admin v1 gap declared: ${field}`);
eq(ADMIN_V1_UNSUPPORTED_METADATA_FIELDS.length, 15, "Admin v1 exact unsupported set");

const liveAudit = {
  cleanser: [26, 9, 0, 9, 0],
  balm: [20, 7, 13],
  sunscreen: [11, 11, 11, 1]
};
eq(liveAudit.cleanser, [26, 9, 0, 9, 0], "read-only cleanser baseline pinned");
eq(liveAudit.balm[1] + liveAudit.balm[2], liveAudit.balm[0], "read-only balm baseline coherent");
eq(liveAudit.sunscreen.slice(0, 3), [11, 11, 11], "read-only sunscreen baseline coherent");

console.log(`verify-recommendation-metadata-transport-shadow: PASS (${assertions} assertions)`);
