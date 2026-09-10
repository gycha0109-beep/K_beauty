import fs from "node:fs";
import crypto from "node:crypto";

const artifactPath =
  "evidence/product-fact-subject-coverage-v1/trust-p6-sunscreen-product-fact-subject-coverage-v1.json";
const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

const expectedStatuses = new Set([
  "SOURCE_IDENTITY_RESEARCH_READY",
  "MARKET_FORMULATION_SCOPE_REVIEW_REQUIRED",
  "MARKET_SCOPE_REVIEW_REQUIRED",
  "IDENTITY_FORMULATION_REVISION_REVIEW_REQUIRED",
  "SOURCE_FORMULATION_DISCOVERY_REQUIRED"
]);
const expectedRpcs = [
  "admin_register_product_fact_subject_v1",
  "admin_ingest_product_fact_evidence_v1",
  "admin_prepare_product_fact_review_v1",
  "admin_preflight_product_fact_confirmation_v1",
  "admin_confirm_product_fact_v1"
];
const uuidRe =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const sha256Re = /^[0-9a-f]{64}$/i;
const commitRe = /^[0-9a-f]{40}$/i;

function fail(message) {
  throw new Error(`TRUST_P6_VERIFY_FAILED: ${message}`);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function canonicalValue(value) {
  if (value === null) return null;
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalValue(value[key])])
    );
  }
  return value;
}

function sha256(value) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(canonicalValue(value)))
    .digest("hex");
}

function assertHttpsSource(source, productId) {
  assert(
    source.source_role === "discovery_only_not_fact_evidence",
    `${productId}: source role`
  );
  let url;
  try {
    url = new URL(source.url);
  } catch {
    fail(`${productId}: invalid source URL`);
  }
  assert(url.protocol === "https:", `${productId}: non-HTTPS source`);
  assert(!url.username && !url.password, `${productId}: credentialed source URL`);
}

assert(
  artifact.version === "trust-p6-sunscreen-product-fact-subject-coverage-v1",
  "version"
);
assert(artifact.stage === "TRUST-P6", "stage");
assert(commitRe.test(artifact.authority.source_main_sha), "source main SHA");
assert(
  sha256Re.test(artifact.authority.database_snapshot_sha256),
  "database snapshot SHA-256"
);
assert(
  sha256Re.test(artifact.authority.artifact_snapshot_sha256),
  "artifact snapshot SHA-256"
);
assert(
  Number.isFinite(Date.parse(artifact.authority.captured_at)) &&
    /(?:Z|[+-]\d{2}:\d{2})$/.test(artifact.authority.captured_at),
  "offset-aware captured_at"
);
assert(artifact.authority.category === "sunscreen", "category");
assert(
  artifact.authority.source_role === "discovery_only_not_fact_evidence",
  "authority source role"
);

assert(Array.isArray(artifact.snapshot_rows), "snapshot rows");
assert(artifact.snapshot_rows.length === 11, "snapshot row count");
assert(
  sha256(artifact.snapshot_rows) === artifact.authority.artifact_snapshot_sha256,
  "artifact snapshot semantic digest"
);

const productIds = artifact.snapshot_rows.map((row) => row.product_id);
assert(productIds.every((id) => uuidRe.test(id)), "snapshot UUID");
assert(new Set(productIds).size === productIds.length, "duplicate snapshot product ID");

const identityKeys = artifact.snapshot_rows.map(
  (row) => `${row.normalized_brand}\u0000${row.normalized_name}`
);
assert(new Set(identityKeys).size === identityKeys.length, "normalized identity collision");
assert(
  artifact.snapshot_rows.every(
    (row) =>
      typeof row.brand === "string" &&
      row.brand.trim() &&
      typeof row.normalized_brand === "string" &&
      row.normalized_brand.trim() &&
      typeof row.normalized_name === "string" &&
      row.normalized_name.trim()
  ),
  "blank catalog identity"
);

const coveredFromSnapshot = artifact.snapshot_rows.filter(
  (row) =>
    row.subject_id &&
    row.identity_status === "resolved" &&
    row.current_state === "current" &&
    row.current_fact_count > 0
);
const uncoveredFromSnapshot = artifact.snapshot_rows.filter((row) => !row.subject_id);

assert(artifact.counts.catalog_products === 11, "catalog count");
assert(artifact.counts.resolved_current_subject_products === 3, "covered count");
assert(artifact.counts.subject_gap_products === 8, "gap count");
assert(
  artifact.counts.mechanical_subject_creation_eligible === 0,
  "mechanical count"
);
assert(
  artifact.counts.normalized_identity_collisions === 0,
  "identity collision count"
);
assert(artifact.counts.blank_identity_rows === 0, "blank identity count");
assert(
  artifact.counts.product_fact_subject_rows_at_capture === 16,
  "PF subject prestate"
);
assert(
  artifact.counts.product_fact_current_rows_at_capture === 41,
  "PF current prestate"
);
assert(coveredFromSnapshot.length === 3, "derived covered count");
assert(uncoveredFromSnapshot.length === 8, "derived uncovered count");

assert(Array.isArray(artifact.covered_products), "covered products");
assert(artifact.covered_products.length === 3, "covered products length");
for (const row of artifact.covered_products) {
  assert(uuidRe.test(row.product_id), `${row.product_id}: covered product UUID`);
  assert(uuidRe.test(row.subject_id), `${row.product_id}: subject UUID`);
  assert(row.identity_status === "resolved", `${row.product_id}: resolved identity`);
  assert(row.current_state === "current", `${row.product_id}: current state`);
  assert(row.current_fact_count > 0, `${row.product_id}: current facts`);
}

assert(Array.isArray(artifact.uncovered_products), "uncovered products");
assert(artifact.uncovered_products.length === 8, "uncovered products length");
const observedClassificationCounts = {};
for (const row of artifact.uncovered_products) {
  assert(uuidRe.test(row.product_id), `${row.product_id}: uncovered product UUID`);
  assert(expectedStatuses.has(row.status), `${row.product_id}: unsupported status`);
  assert(
    row.mechanical_subject_creation_eligible === false,
    `${row.product_id}: mechanical creation must remain false`
  );
  observedClassificationCounts[row.status] =
    (observedClassificationCounts[row.status] || 0) + 1;
  assert(
    Array.isArray(row.official_source_candidates),
    `${row.product_id}: source candidates`
  );
  row.official_source_candidates.forEach((source) =>
    assertHttpsSource(source, row.product_id)
  );
  assert(
    typeof row.gate_note === "string" && row.gate_note.trim(),
    `${row.product_id}: gate note`
  );
}

assert(
  JSON.stringify(observedClassificationCounts) ===
    JSON.stringify(artifact.classification_counts),
  "classification counts"
);

assert(artifact.invariants.hosted_product_fact_writes === 0, "Hosted PF writes");
assert(artifact.invariants.direct_product_fact_writes === 0, "direct PF writes");
assert(
  artifact.invariants.recommendation_or_ranking_changes === 0,
  "recommendation/ranking changes"
);
assert(
  artifact.invariants.subject_creation_authorized_by_this_artifact === false,
  "subject creation authority"
);
assert(
  artifact.invariants.fact_ingest_authorized_by_this_artifact === false,
  "fact ingest authority"
);
assert(
  artifact.invariants.historical_handoff_catalog_snapshot_reused_as_authority ===
    false,
  "historical snapshot authority"
);

assert(
  artifact.reuse.selection_path ===
    "scripts/product-evidence/product-fact-catalog-selection-v1.mjs",
  "selection path reuse"
);
assert(
  artifact.reuse.research_path ===
    "scripts/product-evidence/product-fact-catalog-evidence-research-wave-1-v1.mjs",
  "research path reuse"
);
assert(
  artifact.reuse.adoption_path ===
    "scripts/product-evidence/product-fact-catalog-hosted-adoption-wave-1-v1.mjs",
  "adoption path reuse"
);
assert(
  JSON.stringify(artifact.reuse.controlled_rpcs) === JSON.stringify(expectedRpcs),
  "controlled RPC contract"
);
assert(
  artifact.reuse.new_parallel_subject_materialization_path_required === false,
  "parallel materialization path"
);

assert(
  artifact.next_gate.first_batch_status === "SOURCE_IDENTITY_RESEARCH_READY",
  "next gate status"
);
assert(artifact.next_gate.first_batch_product_count === 4, "next gate batch count");

console.log(
  JSON.stringify(
    {
      ok: true,
      stage: artifact.stage,
      source_main_sha: artifact.authority.source_main_sha,
      database_snapshot_sha256: artifact.authority.database_snapshot_sha256,
      artifact_snapshot_sha256: artifact.authority.artifact_snapshot_sha256,
      catalog_products: artifact.counts.catalog_products,
      covered: artifact.counts.resolved_current_subject_products,
      gaps: artifact.counts.subject_gap_products,
      mechanical_subject_creation_eligible:
        artifact.counts.mechanical_subject_creation_eligible,
      classification_counts: artifact.classification_counts,
      hosted_product_fact_writes: artifact.invariants.hosted_product_fact_writes,
      next_gate: artifact.next_gate.name
    },
    null,
    2
  )
);
