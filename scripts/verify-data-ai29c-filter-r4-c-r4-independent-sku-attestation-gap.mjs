#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";

const evidencePath =
  "evidence/product-fact-catalog-expansion-v1/data-ai29c-filter-r4-c-r4-independent-sku-attestation-gap-v1.json";
const e = JSON.parse(fs.readFileSync(evidencePath, "utf8"));
const r2 = JSON.parse(fs.readFileSync(
  "evidence/product-fact-catalog-expansion-v1/data-ai29c-filter-r4-c-r2-bushman-subject-authority-rpc-implementation-v1.json",
  "utf8",
));
const r3Sql = fs.readFileSync(
  "supabase/migrations/20261009043000_data_ai29c_filter_r4_c_r3_bushman_replay_digest_guard_v1.sql",
  "utf8",
);
const HEX = /^[0-9a-f]{64}$/;
function evaluate(x) {
  const fail = [];
  if (x.stage !== "DATA-AI29C-FILTER-R4-C-R4" ||
    x.decision !== "R4_C_R4_PUBLIC_SOURCE_CROSSCHECK_COMPLETE_IDENTITY_ATTESTATION_HOLD" ||
    x.production_writes !== 0) fail.push("STAGE_OR_WRITE_BOUNDARY");

  const id = x.identity ?? {};
  if (id.product_id !== r2.target.productId ||
    id.subject_id !== r2.target.subjectId ||
    id.subject_semantic_key !== r2.target.subjectSemanticKey ||
    id.formulation_revision_key !== "data-ai29c-c5-bushman-waterproof-pro-current" ||
    id.subject_label !== "BUSHMAN Waterproof Pro Suncream 50g" ||
    id.current_authority !== r2.target.fromAuthority ||
    id.required_authority !== r2.target.toAuthority) fail.push("SUBJECT_IDENTITY_SCOPE");

  const ss = x.source_comparison ?? [];
  if (!Array.isArray(ss) || ss.length !== 3 ||
    ss[0]?.origin !== "brand_first_party" ||
    ss[1]?.origin !== "retailer_supplier_listing" ||
    ss[2]?.origin !== "retailer_listing" ||
    ss[0]?.unit_label !== "50ml" ||
    ss[1]?.unit_label !== "50g" ||
    ss[2]?.unit_label !== "50g" ||
    !ss[0]?.url?.startsWith("https://bushmankorea.com/product/") ||
    !ss[1]?.url?.startsWith("https://www.ssgdfs.com/kr/goos/initDetailGoos") ||
    !ss[2]?.url?.startsWith("https://www.musinsa.com/products/")) {
    fail.push("PUBLIC_SOURCE_PROVENANCE");
  }
  const p = x.production_read_only_snapshot ?? {};
  if (p.official_product_binding_count !== 1 ||
    p.official_source_review_count !== 1 ||
    p.official_source_subject_binding_count !== r2.frozenOfficialSourcePairs.length ||
    p.latest_frozen_source_id !== "94b32b8d-8340-4b91-9e62-646794fd4f41" ||
    p.latest_frozen_source_digest !== r2.frozenOfficialSourcePairs.find(
      s => s.source_id === "94b32b8d-8340-4b91-9e62-646794fd4f41"
    )?.content_digest ||
    !HEX.test(p.latest_frozen_source_digest ?? "") ||
    p.current_product_facts !== 3 || p.fact_instances !== 3 ||
    p.research_tasks !== 4 || p.evidence_records !== 3 ||
    p.current_semantic_review_count !== 0 ||
    p.subject_authority_unchanged !== true ||
    p.attestation_table_deployed !== false ||
    p.confirmation_rpc_deployed !== false ||
    p.identity_upgrade_audit_count !== 0) fail.push("PRODUCTION_READ_ONLY_SNAPSHOT");

  const a = x.independent_attestation ?? {};
  const expectedKeys = [
    "manufacturer_signed_or_first_party_explicit_sku_equivalence",
    "manufacturer_or_brand_direct_response",
    "same_sku_or_batch_or_barcode_cross_reference",
    "unit_label_reconciled_by_approved_reviewer",
    "full_ingredient_list_revision_equivalence_independently_verified",
    "fresh_observation_sha256_verified_and_ingested",
    "approval_audit_record_created",
    "attestation_writer_deployed",
    "attestation_approved"
  ];
  if (Object.keys(a).sort().join() !== expectedKeys.sort().join() ||
    expectedKeys.some(k => a[k] !== false)) fail.push("ATTESTATION_NOT_PROVEN");

  const assessment = x.assessment ?? {};
  if (assessment.unit_display_conflict !== true ||
    assessment.exact_product_identity_established !== false ||
    assessment.formulation_identity_established !== false ||
    assessment.market_equivalence_attested !== false ||
    assessment.name_and_spf_match !== true ||
    assessment.manufacturer_name_match !== true ||
    assessment.ingredient_markers_match !== true) fail.push("PROOF_LEVEL_OVERSTATED");

  const gates = x.authority_outcome ?? {};
  const expectedGateKeys = [
    "subject_upgrade_allowed", "production_migration_allowed", "issue_attestation_allowed",
    "production_preflight_allowed", "semantic_review_allowed",
    "admission_allowed", "recommendation_activation_allowed"
  ];
  if (Object.keys(gates).sort().join() !== expectedGateKeys.sort().join() ||
    expectedGateKeys.some(k => gates[k] !== false)) fail.push("AUTHORITY_ESCALATION");

  if (x.merged_r3?.pr !== 1174 ||
      x.merged_r3?.merge_sha !== "1e20ad810119ab53e3bbf89771faba749aacb29c" ||
      x.merged_r3?.post_merge_ci !== "PASS" ||
      !r3Sql.includes("product_fact_controlled_sha256_json_v1(p_payload)") ||
      !Array.isArray(x.future_required_evidence) ||
      x.future_required_evidence.length !== 4 ||
      x.next_gate !== "BRAND_MANUFACTURER_FIRST_PARTY_SKU_FORMULATION_EQUIVALENCE_EVIDENCE_REQUIRED") {
    fail.push("PREREQUISITES_OR_NEXT_GATE");
  }
  return fail;
}
assert.deepEqual(evaluate(e), [], "Expected HOLD evidence must pass");
const negativeTests = [
  ["forged_subject", x => x.identity.subject_id = "other", "SUBJECT_IDENTITY_SCOPE"],
  ["changed_official_unit", x => x.source_comparison[0].unit_label = "50g", "PUBLIC_SOURCE_PROVENANCE"],
  ["changed_retailer_unit", x => x.source_comparison[1].unit_label = "50ml", "PUBLIC_SOURCE_PROVENANCE"],
  ["source_digest_mismatch", x => x.production_read_only_snapshot.latest_frozen_source_digest = "0".repeat(64), "PRODUCTION_READ_ONLY_SNAPSHOT"],
  ["false_production_rpc", x => x.production_read_only_snapshot.confirmation_rpc_deployed = true, "PRODUCTION_READ_ONLY_SNAPSHOT"],
  ["fabricated_brand_approval", x => x.independent_attestation.manufacturer_or_brand_direct_response = true, "ATTESTATION_NOT_PROVEN"],
  ["fabricated_fresh_digest", x => x.independent_attestation.fresh_observation_sha256_verified_and_ingested = true, "ATTESTATION_NOT_PROVEN"],
  ["fabricated_identity", x => x.assessment.exact_product_identity_established = true, "PROOF_LEVEL_OVERSTATED"],
  ["fabricated_attestation", x => x.independent_attestation.attestation_approved = true, "ATTESTATION_NOT_PROVEN"],
  ["unauthorized_migration", x => x.authority_outcome.production_migration_allowed = true, "AUTHORITY_ESCALATION"],
  ["unauthorized_admission", x => x.authority_outcome.admission_allowed = true, "AUTHORITY_ESCALATION"],
  ["production_write", x => x.production_writes = 1, "STAGE_OR_WRITE_BOUNDARY"],
];
for (const [name, mutation, expected] of negativeTests) {
  const changed = structuredClone(e);
  mutation(changed);
  assert.ok(evaluate(changed).includes(expected), name);
}
console.log(JSON.stringify({
  stage:e.stage,
  status:"PASS",
  decision:e.decision,
  negativeTests:negativeTests.length,
  publicSourceComparison:"PASS_NOT_IDENTITY_ATTESTATION",
  subjectAuthority:"HOLD",
  productionWrites:0
},null,2));
