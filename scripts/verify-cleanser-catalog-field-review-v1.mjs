#!/usr/bin/env node
import fs from "node:fs";
import crypto from "node:crypto";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const corpusPath = path.resolve(here, "../evidence/catalog/cleanser-field-review-v1.json");

const ALLOWED_PROFILES = new Set(["low_ph", "balanced", "deep_clean"]);
const ALLOWED_STATES = new Set(["reviewed_valid", "reviewed_unknown", "reviewed_conflict", "not_applicable"]);
const ALLOWED_CONFIDENCE = new Set(["high", "medium", "low", "unknown"]);
const ALLOWED_EVIDENCE_TYPES = new Set([
  "official_product_page",
  "manufacturer_documentation",
  "ingredient_list",
  "review_corpus",
  "manual_conflict_record",
]);
const EXPECTED = {
  version: "cleanser-catalog-field-review-v1",
  reviewContract: "admin-product-review-v2",
  metadataSchema: "cleanser-metadata-v1",
  reviewPolicy: "cleanser-metadata-review-policy-v1",
  evidenceSchema: "product-review-field-evidence-v1",
  productCount: 26,
};

function fail(message) {
  throw new Error(message);
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function digestWithoutSelf(corpus) {
  const copy = structuredClone(corpus);
  delete copy.canonical_sha256;
  return crypto.createHash("sha256").update(stableJson(copy), "utf8").digest("hex");
}

function isPrivateIp(host) {
  const version = net.isIP(host);
  if (version === 4) {
    const parts = host.split(".").map(Number);
    if (parts[0] === 10 || parts[0] === 127 || parts[0] === 0) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    return false;
  }
  if (version === 6) {
    const h = host.toLowerCase();
    return h === "::1" || h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80:");
  }
  return false;
}

function assertSafeHttps(raw, context) {
  let u;
  try {
    u = new URL(raw);
  } catch {
    fail(`${context}: invalid URL`);
  }
  if (u.protocol !== "https:") fail(`${context}: source_reference must be HTTPS`);
  if (u.username || u.password) fail(`${context}: URL credentials are forbidden`);
  const host = u.hostname.toLowerCase();
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || isPrivateIp(host)) {
    fail(`${context}: unsafe hostname`);
  }
}

function walkForbiddenKeys(value, trail = "$") {
  if (Array.isArray(value)) {
    value.forEach((item, i) => walkForbiddenKeys(item, `${trail}[${i}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    const lower = key.toLowerCase();
    const forbidden = new Set([
      "candidate_id",
      "candidateid",
      "reviewer",
      "reviewer_id",
      "reviewerid",
      "admin_audit",
      "admin_audit_row",
      "audit_row",
      "export_batch_id",
      "evidence_id",
    ]);
    if (forbidden.has(lower)) fail(`${trail}.${key}: Admin/import lineage key is forbidden in catalog corpus`);
    walkForbiddenKeys(child, `${trail}.${key}`);
  }
}

function destination(product) {
  if (product.review_state === "reviewed_valid") return product.reviewed_profile;
  return product.review_state;
}

const index = JSON.parse(fs.readFileSync(corpusPath, "utf8"));
const partPaths = Array.isArray(index.product_parts) ? index.product_parts : [];
if (partPaths.length < 1) fail("product_parts missing");
const products = [];
for (const [partIndex, relativePath] of partPaths.entries()) {
  if (typeof relativePath !== "string" || !relativePath.startsWith("evidence/catalog/cleanser-field-review-v1.part-")) {
    fail(`product_parts[${partIndex}]: invalid corpus shard path`);
  }
  const resolved = path.resolve(here, "..", relativePath);
  const part = JSON.parse(fs.readFileSync(resolved, "utf8"));
  if (!part || part.part !== partIndex + 1 || !Array.isArray(part.products)) fail(`product_parts[${partIndex}]: invalid shard`);
  products.push(...part.products);
}
const { product_parts: _parts, ...indexWithoutParts } = index;
const corpus = { ...indexWithoutParts, products };

if (corpus.version !== EXPECTED.version) fail("corpus version mismatch");
if (corpus.review_contract_version !== EXPECTED.reviewContract) fail("review contract mismatch");
if (corpus.cleansing_profile_schema_version !== EXPECTED.metadataSchema) fail("metadata schema mismatch");
if (corpus.review_policy_version !== EXPECTED.reviewPolicy) fail("review policy mismatch");
if (corpus.field_evidence_schema_version !== EXPECTED.evidenceSchema) fail("field evidence schema mismatch");
if (corpus.product_count !== EXPECTED.productCount) fail("declared product_count must equal 26");
if (!Array.isArray(corpus.products) || corpus.products.length !== EXPECTED.productCount) fail("products length must equal 26");
if (corpus.legacy_seed_policy !== "not_used") fail("legacy seed policy must be not_used");
if (corpus.admin_v2_import_bundle !== false) fail("catalog corpus must not claim to be an Admin v2 import bundle");

walkForbiddenKeys(corpus);

const ids = new Set();
const evidenceIds = new Set();
const stateCounts = { reviewed_valid: 0, reviewed_unknown: 0, reviewed_conflict: 0, not_applicable: 0 };
const reviewedCounts = { low_ph: 0, balanced: 0, deep_clean: 0, null: 0 };
const legacyCounts = { low_ph: 0, balanced: 0, deep_clean: 0, null: 0 };
const evidenceTypeCounts = {
  official_product_page: 0,
  manufacturer_documentation: 0,
  ingredient_list: 0,
  review_corpus: 0,
  manual_conflict_record: 0,
};
const transition = {};
for (const legacy of ["low_ph", "balanced", "deep_clean", "null"]) {
  transition[legacy] = {
    low_ph: 0,
    balanced: 0,
    deep_clean: 0,
    reviewed_unknown: 0,
    reviewed_conflict: 0,
    not_applicable: 0,
  };
}
let legacyUnchanged = 0;
let legacyChanged = 0;
let legacyToNull = 0;
let nullToValid = 0;
let evidenceTotal = 0;
const sourceUrls = new Set();

for (const [index, product] of corpus.products.entries()) {
  const label = `products[${index}]`;
  if (typeof product.product_id !== "string" || !product.product_id) fail(`${label}: product_id missing`);
  if (ids.has(product.product_id)) fail(`${label}: duplicate product_id`);
  ids.add(product.product_id);

  if (product.legacy_used_for_decision !== false) fail(`${label}: legacy_profile must not be used as decision input`);
  if (product.legacy_profile !== null && !ALLOWED_PROFILES.has(product.legacy_profile)) fail(`${label}: invalid legacy_profile`);
  if (product.reviewed_profile !== null && !ALLOWED_PROFILES.has(product.reviewed_profile)) fail(`${label}: invalid reviewed_profile`);
  if (!ALLOWED_STATES.has(product.review_state)) fail(`${label}: invalid review_state`);
  if (!ALLOWED_CONFIDENCE.has(product.confidence)) fail(`${label}: invalid confidence`);
  if (!Array.isArray(product.evidence) || product.evidence.length < 1) fail(`${label}: review attempt must record evidence`);

  stateCounts[product.review_state] += 1;
  reviewedCounts[product.reviewed_profile ?? "null"] += 1;
  legacyCounts[product.legacy_profile ?? "null"] += 1;

  if (product.review_state === "reviewed_valid") {
    if (product.reviewed_profile === null) fail(`${label}: reviewed_valid requires non-null profile`);
    if (product.confidence === "unknown") fail(`${label}: reviewed_valid confidence cannot be unknown`);
    const supported = product.evidence.some((e) => e.supported_value === product.reviewed_profile);
    if (!supported) fail(`${label}: reviewed_valid requires evidence supporting reviewed_profile`);
  } else if (product.review_state === "reviewed_unknown") {
    if (product.reviewed_profile !== null || product.confidence !== "unknown") fail(`${label}: reviewed_unknown requires null/unknown`);
  } else if (product.review_state === "reviewed_conflict") {
    if (product.reviewed_profile !== null || product.confidence !== "unknown") fail(`${label}: reviewed_conflict requires null/unknown`);
    const supportedValues = new Set(product.evidence.map((e) => e.supported_value).filter((v) => v !== null));
    if (supportedValues.size < 2) fail(`${label}: reviewed_conflict requires at least two distinct supported values`);
  } else if (product.review_state === "not_applicable") {
    if (product.reviewed_profile !== null || product.confidence !== "unknown") fail(`${label}: not_applicable requires null/unknown`);
  }

  const expectedLegacyMatch = product.reviewed_profile !== null && product.reviewed_profile === product.legacy_profile;
  if (product.legacy_matches_review !== expectedLegacyMatch) fail(`${label}: legacy_matches_review mismatch`);

  for (const [eIndex, evidence] of product.evidence.entries()) {
    const eLabel = `${label}.evidence[${eIndex}]`;
    if (typeof evidence.catalog_evidence_id !== "string" || !/^cfrv1-\d{2}-\d{2}$/.test(evidence.catalog_evidence_id)) {
      fail(`${eLabel}: invalid offline catalog_evidence_id`);
    }
    if (evidenceIds.has(evidence.catalog_evidence_id)) fail(`${eLabel}: duplicate catalog_evidence_id`);
    evidenceIds.add(evidence.catalog_evidence_id);
    if (!ALLOWED_EVIDENCE_TYPES.has(evidence.evidence_type)) fail(`${eLabel}: invalid evidence_type`);
    if (evidence.supported_value !== null && !ALLOWED_PROFILES.has(evidence.supported_value)) fail(`${eLabel}: invalid supported_value`);
    if (typeof evidence.evidence_summary !== "string" || !evidence.evidence_summary.trim()) fail(`${eLabel}: empty evidence_summary`);
    assertSafeHttps(evidence.source_reference, eLabel);
    evidenceTypeCounts[evidence.evidence_type] += 1;
    evidenceTotal += 1;
    sourceUrls.add(evidence.source_reference);
  }

  const legacyKey = product.legacy_profile ?? "null";
  transition[legacyKey][destination(product)] += 1;
  if (product.reviewed_profile !== null && product.reviewed_profile === product.legacy_profile) legacyUnchanged += 1;
  else if (product.reviewed_profile !== null && product.reviewed_profile !== product.legacy_profile) legacyChanged += 1;
  if (product.legacy_profile !== null && product.reviewed_profile === null) legacyToNull += 1;
  if (product.legacy_profile === null && product.reviewed_profile !== null) nullToValid += 1;
}

if (ids.size !== 26) fail("unique product_id count must equal 26");

const expectedSummary = {
  legacy_profile_counts: legacyCounts,
  review_state_counts: stateCounts,
  reviewed_profile_counts: reviewedCounts,
  legacy_comparison: {
    legacy_unchanged: legacyUnchanged,
    legacy_changed: legacyChanged,
    legacy_to_null: legacyToNull,
    null_to_valid: nullToValid,
  },
  transition_matrix: transition,
  evidence_type_counts: evidenceTypeCounts,
  external_url_count: evidenceTotal,
  unique_external_url_count: sourceUrls.size,
};
if (stableJson(corpus.summary) !== stableJson(expectedSummary)) fail("summary does not match recomputed corpus values");

for (const [key, value] of Object.entries(corpus.production_invariance ?? {})) {
  if (value !== 0) fail(`production_invariance.${key} must be 0`);
}
for (const required of ["db_writes", "hosted_migrations", "admin_activation", "recommendation_activation", "score_ranking_delta", "pr_167_delta"]) {
  if (!(required in (corpus.production_invariance ?? {}))) fail(`production_invariance.${required} missing`);
}

const actualDigest = digestWithoutSelf(corpus);
if (!/^[a-f0-9]{64}$/.test(corpus.canonical_sha256 ?? "")) fail("canonical_sha256 malformed");
if (actualDigest !== corpus.canonical_sha256) fail(`canonical SHA-256 mismatch: expected ${corpus.canonical_sha256}, got ${actualDigest}`);

console.log("PASS verify-cleanser-catalog-field-review-v1");
console.log(`products=${corpus.products.length} unique_product_ids=${ids.size}`);
console.log(`reviewed_valid=${stateCounts.reviewed_valid} reviewed_unknown=${stateCounts.reviewed_unknown} reviewed_conflict=${stateCounts.reviewed_conflict} not_applicable=${stateCounts.not_applicable}`);
console.log(`reviewed_low_ph=${reviewedCounts.low_ph} reviewed_balanced=${reviewedCounts.balanced} reviewed_deep_clean=${reviewedCounts.deep_clean} reviewed_null=${reviewedCounts.null}`);
console.log(`evidence_records=${evidenceTotal} unique_source_urls=${sourceUrls.size}`);
console.log(`canonical_sha256=${actualDigest}`);
