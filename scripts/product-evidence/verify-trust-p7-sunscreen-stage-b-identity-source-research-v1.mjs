import fs from "node:fs";

const artifactPath = "evidence/product-fact-subject-coverage-v1/trust-p7-sunscreen-stage-b-identity-source-research-v1.json";
const p6Path = "evidence/product-fact-subject-coverage-v1/trust-p6-sunscreen-product-fact-subject-coverage-v1.json";
const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
const p6 = JSON.parse(fs.readFileSync(p6Path, "utf8"));

const expectedIds = [
  "9983f167-24e7-4223-bd86-446ce6ced31b",
  "765b3ca1-6927-49b0-bee6-4138d03dd915",
  "dd326b18-ea56-45fb-8571-42186b6c9159",
  "2d3591f2-2216-4043-8493-a9492806ef8b"
];
const eligibleIds = new Set([
  "765b3ca1-6927-49b0-bee6-4138d03dd915",
  "dd326b18-ea56-45fb-8571-42186b6c9159",
  "2d3591f2-2216-4043-8493-a9492806ef8b"
]);
const blockedId = "9983f167-24e7-4223-bd86-446ce6ced31b";
const allowedFactKeys = new Set(["spf_value", "uva_label"]);
const allowedScopeRelations = new Set(["equivalent", "narrower", "broader", "disjoint", "overlapping"]);
const commitRe = /^[0-9a-f]{40}$/i;

function fail(message) { throw new Error(`TRUST_P7_VERIFY_FAILED: ${message}`); }
function assert(condition, message) { if (!condition) fail(message); }
function sorted(values) { return [...values].sort(); }
function assertHttps(url, message) {
  let parsed;
  try { parsed = new URL(url); } catch { fail(`${message}: invalid URL`); }
  assert(parsed.protocol === "https:", `${message}: non-HTTPS URL`);
  assert(!parsed.username && !parsed.password, `${message}: credentialed URL`);
}

assert(artifact.version === "trust-p7-sunscreen-stage-b-identity-source-research-v1", "version");
assert(artifact.stage === "TRUST-P7", "stage");
assert(artifact.scope === "targeted-sunscreen-stage-b-identity-source-research-freeze", "scope");
assert(commitRe.test(artifact.authority.source_main_sha), "source main SHA");
assert(artifact.authority.source_main_sha === "30a11e00273462391374dcc7efb16325cf018fcb", "fresh main authority");
assert(artifact.authority.upstream_p6_merge_sha === "e655c1102998dfa769a1a8fb200d7fe5e0c60d66", "P6 merge authority");
assert(artifact.authority.upstream_p6_artifact === p6Path, "P6 artifact authority");
assert(artifact.authority.registry_version === "product-fact-registry-cross-category-v1", "registry version");
assert(artifact.authority.subject_serializer === "product-fact-subject-identity-v1", "subject serializer");
assert(artifact.authority.proposition_serializer === "product-fact-proposition-pilot-v1", "proposition serializer");
assert(artifact.authority.identity_resolution_version === "trust-p7-sunscreen-stage-b-identity-v1", "identity version");
assert(Number.isFinite(Date.parse(artifact.authority.researched_at)) && /(?:Z|[+-]\d{2}:\d{2})$/.test(artifact.authority.researched_at), "offset-aware researched_at");
assert(artifact.authority.research_role === "adjudication_freeze_not_product_fact_evidence_ingest", "research role");

const p6Ready = p6.uncovered_products.filter((row) => row.status === "SOURCE_IDENTITY_RESEARCH_READY").map((row) => row.product_id);
assert(JSON.stringify(sorted(p6Ready)) === JSON.stringify(sorted(expectedIds)), "P6 research-ready set changed");
assert(Array.isArray(artifact.products) && artifact.products.length === 4, "product count");
assert(JSON.stringify(sorted(artifact.products.map((row) => row.product_id))) === JSON.stringify(sorted(expectedIds)), "P7 product set");
assert(JSON.stringify(sorted(artifact.allowed_fact_keys)) === JSON.stringify(sorted(allowedFactKeys)), "allowed fact keys");

for (const row of artifact.products) {
  assert(row.identity?.status === "resolved", `${row.product_id}: identity unresolved`);
  assert(row.identity?.relation === "equivalent", `${row.product_id}: non-equivalent identity`);
  assert(typeof row.identity.variant_key_proposal === "string" && row.identity.variant_key_proposal.length > 0, `${row.product_id}: variant proposal`);
  assert(typeof row.identity.formulation_revision_key_proposal === "string" && row.identity.formulation_revision_key_proposal.length > 0, `${row.product_id}: formulation proposal`);
  assert(Array.isArray(row.sources) && row.sources.length > 0, `${row.product_id}: sources`);
  for (const source of row.sources) {
    assertHttps(source.url, row.product_id);
    assert(source.source_kind === "official_product_page", `${row.product_id}: source kind`);
    assert(source.identity_support === true, `${row.product_id}: identity support`);
    assert(allowedScopeRelations.has(source.scope_relation_to_subject_proposal), `${row.product_id}: scope relation`);
  }
  assert(Array.isArray(row.accepted_fact_support), `${row.product_id}: accepted facts`);
  for (const fact of row.accepted_fact_support) {
    assert(allowedFactKeys.has(fact.fact_key), `${row.product_id}: unsupported fact key`);
    assertHttps(fact.evidence_source_url, `${row.product_id}: evidence source`);
    const source = row.sources.find((candidate) => candidate.url === fact.evidence_source_url);
    assert(source?.machine_verifiable_fact_support === true, `${row.product_id}: fact source not machine-verifiable`);
  }
}

for (const id of eligibleIds) {
  const row = artifact.products.find((candidate) => candidate.product_id === id);
  assert(row?.disposition === "ADOPTION_PREFLIGHT_ELIGIBLE", `${id}: eligible disposition`);
  assert(row.accepted_fact_support.length === 2, `${id}: expected SPF and PA support`);
  const spf = row.accepted_fact_support.find((fact) => fact.fact_key === "spf_value");
  const pa = row.accepted_fact_support.find((fact) => fact.fact_key === "uva_label");
  assert(spf?.normalized_value === 50, `${id}: SPF normalization`);
  assert(pa?.normalized_value === "PA++++", `${id}: PA normalization`);
}

const blocked = artifact.products.find((row) => row.product_id === blockedId);
assert(blocked?.disposition === "FACT_SOURCE_RECOVERY_REQUIRED", "La Roche disposition");
assert(blocked.identity.status === "resolved", "La Roche identity must remain resolved");
assert(blocked.accepted_fact_support.length === 0, "La Roche must not gain inferred facts");
assert(blocked.sources.every((source) => source.machine_verifiable_fact_support === false), "La Roche fact source boundary");
assert(blocked.sources[0].url === "https://www.larocheposay.co.kr/product/view/4833.do", "La Roche canonical source");

const red = artifact.products.find((row) => row.product_id === "dd326b18-ea56-45fb-8571-42186b6c9159");
assert(red.localized_name_adjudication?.catalog_label === "레드 카밍", "AESTURA Red catalog label");
assert(red.localized_name_adjudication?.official_kr_label === "레드진정", "AESTURA Red KR label");
assert(red.localized_name_adjudication?.official_international_label === "Red Calming", "AESTURA Red international label");
assert(red.localized_name_adjudication?.disposition === "equivalent_localized_alias", "AESTURA Red localized alias adjudication");

assert(artifact.counts.p6_research_ready_products === 4, "P6 ready count");
assert(artifact.counts.researched_products === 4, "researched count");
assert(artifact.counts.identity_resolved_products === 4, "identity resolved count");
assert(artifact.counts.adoption_preflight_eligible === 3, "eligible count");
assert(artifact.counts.fact_source_recovery_required === 1, "blocked count");
assert(artifact.counts.mechanical_subject_creation_eligible === 0, "mechanical creation count");
assert(artifact.counts.hosted_product_fact_writes === 0, "hosted writes");
assert(artifact.counts.direct_product_fact_writes === 0, "direct writes");
assert(artifact.invariants.subject_creation_authorized_by_this_artifact === false, "subject creation authority");
assert(artifact.invariants.fact_ingest_authorized_by_this_artifact === false, "fact ingest authority");
assert(artifact.invariants.confirmation_authorized_by_this_artifact === false, "confirmation authority");
assert(artifact.invariants.recommendation_or_ranking_changes === 0, "recommendation changes");
assert(artifact.invariants.non_first_party_sources_used_for_positive_fact_support === 0, "non-first-party positive support");
assert(artifact.invariants.new_parallel_subject_materialization_path_required === false, "parallel materialization path");

assert(artifact.reuse.research_path === "scripts/product-evidence/product-fact-catalog-evidence-research-wave-1-v1.mjs", "research path reuse");
assert(artifact.reuse.adoption_path === "scripts/product-evidence/product-fact-catalog-hosted-adoption-wave-1-v1.mjs", "adoption path reuse");
assert(JSON.stringify(sorted(artifact.next_gate.eligible_product_ids)) === JSON.stringify(sorted(eligibleIds)), "next eligible set");
assert(JSON.stringify(artifact.next_gate.blocked_product_ids) === JSON.stringify([blockedId]), "next blocked set");
assert(artifact.next_gate.eligible_action === "existing_hosted_adoption_preflight_only", "eligible action");
assert(artifact.next_gate.blocked_action === "first_party_fact_source_recovery_without_subject_or_fact_write", "blocked action");

console.log(JSON.stringify({
  ok: true,
  stage: artifact.stage,
  source_main_sha: artifact.authority.source_main_sha,
  researched_products: artifact.counts.researched_products,
  identity_resolved_products: artifact.counts.identity_resolved_products,
  adoption_preflight_eligible: artifact.counts.adoption_preflight_eligible,
  fact_source_recovery_required: artifact.counts.fact_source_recovery_required,
  hosted_product_fact_writes: artifact.counts.hosted_product_fact_writes,
  direct_product_fact_writes: artifact.counts.direct_product_fact_writes
}, null, 2));
