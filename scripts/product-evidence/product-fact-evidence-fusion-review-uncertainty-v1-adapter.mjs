import {
  FACT_KEYS,
  buildFusionArtifact,
  canonicalJson,
  normalizeCleanserEvidence,
  fuseProductFact,
  sha256Json,
  CORPUS_SHA256,
  VERSION,
} from "./product-fact-evidence-fusion-review-uncertainty-v1.mjs";

export { canonicalJson, CORPUS_SHA256, VERSION };

const BRMUD_PRODUCT_ID = "5448b8c3-cf87-4561-a699-3baf3dcb3dab";
const BRMUD_SUPPLEMENT_ID = "v21-4-brmud-official-deep-clean-001";
const ALLOWED_IDENTITY_RELATIONS = new Set(["exact_subject_match", "equivalent_presentation_match"]);

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

export function validateFusionAuthorityUpgrade(supplement) {
  invariant(supplement?.version === "cleanser-fusion-authority-upgrade-v1", "unexpected authority upgrade version");
  invariant(Array.isArray(supplement.records) && supplement.records.length === 1, "authority upgrade must contain exactly one record");
  const record = supplement.records[0];
  invariant(record.catalog_evidence_id === BRMUD_SUPPLEMENT_ID, "unexpected supplemental evidence id");
  invariant(record.product_id === BRMUD_PRODUCT_ID, "supplement must target BRMUD only");
  invariant(record.source_class === "official_product_page", "supplement must use official product authority");
  invariant(record.fact_key === "deep_cleansing" && record.supported_value === "deep_clean", "supplement semantic target mismatch");
  invariant(record.confidence === "high", "supplement confidence must be explicitly high");
  invariant(ALLOWED_IDENTITY_RELATIONS.has(record.identity_relation), "supplement identity relation is not admissible");
  invariant(record.scope_relation === "equivalent", "supplement scope relation must be equivalent");
  invariant(record.review_observation_superseded_as_fact_authority === false, "review observation must not be promoted into fact authority");
  invariant(/^https:\/\/en\.brmudkorea\.com\//.test(record.source_reference), "supplement must reference official BRMUD domain");
  return record;
}

function normalizeNonAdmissibleDirections(product) {
  product.normalized_evidence = product.normalized_evidence.map((item) => item.admissible_for_fact
    ? item
    : { ...item, support_direction: "context_only", negative_admissibility: "context_only" });
}

export function buildFusionArtifactWithAuthorityUpgrade(corpus, supplement) {
  const record = validateFusionAuthorityUpgrade(supplement);
  const artifact = buildFusionArtifact(corpus);

  for (const product of artifact.products) {
    const rawProduct = corpus.products.find((item) => item.product_id === product.product_id);
    normalizeNonAdmissibleDirections(product);
    product.facts = FACT_KEYS.map((factKey) => fuseProductFact({
      factKey,
      normalizedEvidence: product.normalized_evidence,
      reviewState: rawProduct?.review_state ?? null,
    }));
  }

  const rawProduct = corpus.products.find((item) => item.product_id === BRMUD_PRODUCT_ID);
  const product = artifact.products.find((item) => item.product_id === BRMUD_PRODUCT_ID);
  invariant(rawProduct && product, "BRMUD product missing from frozen corpus replay");
  invariant(/renewal|alias drift/i.test(String(rawProduct.identity_notes ?? "")), "frozen BRMUD alias-drift identity basis missing");

  const normalizedSupplement = {
    ...normalizeCleanserEvidence(rawProduct, record),
    confidence: record.confidence,
    identity_relation: record.identity_relation,
    scope_relation: record.scope_relation,
    provenance_kind: "v21_4_official_authority_upgrade",
    frozen_external_evidence: true,
    snapshot_basis: record.snapshot_basis,
  };
  invariant(normalizedSupplement.admissible_for_fact === true, "official BRMUD supplement must be fact-admissible");
  invariant(normalizedSupplement.evidence_authority === "product_specific_primary", "official BRMUD supplement authority mismatch");

  product.normalized_evidence = [...product.normalized_evidence, normalizedSupplement]
    .sort((a, b) => a.catalog_evidence_id.localeCompare(b.catalog_evidence_id, "en"));
  product.facts = FACT_KEYS.map((factKey) => fuseProductFact({
    factKey,
    normalizedEvidence: product.normalized_evidence,
    reviewState: rawProduct.review_state,
  }));

  const facts = artifact.products.flatMap((item) => item.facts);
  artifact.authority = {
    ...artifact.authority,
    authority_upgrade_version: supplement.version,
    authority_upgrade_digest: sha256Json(supplement),
    authority_upgrade_records: supplement.records.length,
  };
  artifact.summary = {
    ...artifact.summary,
    supported: facts.filter((item) => item.semantic_status === "supported").length,
    reviewed_not_established: facts.filter((item) => item.semantic_status === "reviewed_not_established").length,
    evidence_insufficient: facts.filter((item) => item.semantic_status === "evidence_insufficient").length,
    evidence_conflict: facts.filter((item) => item.semantic_status === "evidence_conflict").length,
    not_reviewed: facts.filter((item) => item.semantic_status === "not_reviewed").length,
    supplemental_product_claim_evidence: 1,
    review_observation_promotions: 0,
  };
  artifact.authority_upgrade = {
    version: supplement.version,
    record_count: 1,
    target_product_id: BRMUD_PRODUCT_ID,
    evidence_id: BRMUD_SUPPLEMENT_ID,
    source_reference: record.source_reference,
    identity_relation: record.identity_relation,
    scope_relation: record.scope_relation,
    review_observation_remains_context_only: true,
  };
  return artifact;
}
