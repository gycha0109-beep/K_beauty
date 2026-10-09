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
// R4-C-R5 is an append-only first-party unit-label observation. It cannot
// reinterpret the frozen R4-C-R4 record or grant real-world identity authority.
const r5 = JSON.parse(fs.readFileSync(
  "evidence/product-fact-catalog-expansion-v1/data-ai29c-filter-r4-c-r5-first-party-unit-conflict-v1.json",
  "utf8",
));
function evaluateR5(x) {
  const fails = [];
  if (x.stage !== "DATA-AI29C-FILTER-R4-C-R5" ||
      x.decision !== "FIRST_PARTY_UNIT_CONFLICT_REPRODUCED_MANUFACTURER_ATTESTATION_HOLD" ||
      x.conclusion !== "PUBLIC_FIRST_PARTY_INCONSISTENCY_IS_NOT_A_MANUFACTURER_SIGNED_OR_ADMIN_ATTESTED_SAME_SKU_FORMULATION" ||
      x.next_gate !== "AWAIT_BRAND_OR_MANUFACTURER_EXPLICIT_SKU_AND_FORMULATION_EQUIVALENCE_EVIDENCE") {
    fails.push("R5_STAGE_OR_APPROVAL_BOUNDARY");
  }
  const [single, bundle, retailer] = x.checked_urls ?? [];
  if (x.checked_urls?.length !== 3 ||
      single?.source_tier !== "BRAND_FIRST_PARTY" ||
      single?.product_no !== 31 ||
      single?.url !== "https://bushmankorea.com/product/detail.html?product_no=31" ||
      single?.title_unit !== "50ml" || single?.disclosure_unit !== "50ml" ||
      bundle?.source_tier !== "BRAND_FIRST_PARTY" ||
      bundle?.product_no !== 50 ||
      bundle?.url !== "https://bushmankorea.com/product/detail.html?product_no=50" ||
      bundle?.title_unit !== "50g" || bundle?.disclosure_unit !== "190ml/50ml" ||
      bundle?.disclosure_unit_scope !== "190ml 태닝오일과 50ml 선크림의 세트" ||
      retailer?.source_tier !== "RETAILER" ||
      retailer?.product_no !== "270878000493" ||
      retailer?.title_unit !== "50g" || retailer?.disclosure_unit !== "50g") {
    fails.push("R5_SOURCE_LABEL_REPRODUCTION");
  }
  const strength = x.evidence_strength ?? {};
  const yes = ["same_brand","same_named_pro_product","public_inci_sequence_appears_matching","first_party_unit_conflict_reproduced"];
  const no = ["identical_sku_confirmed","barcode_link_confirmed","manufacturer_formulation_revision_confirmed",
              "manufacturer_explicit_response","content_sha256_independently_computed","prior_source_digests_recomputed"];
  if (yes.some(k => strength[k] !== true) || no.some(k => strength[k] !== false)) {
    fails.push("R5_PROOF_OVERCLAIM");
  }
  const external = x.external_reference_boundary ?? {};
  if (external.japanese_listing_jan !== "8809990190508" ||
      external.jan_source_kind !== "third_party_catalog_unverified_against_brand_sku" ||
      external.sku_equivalence_inferred_from_jan !== false) {
    fails.push("R5_EXTERNAL_IDENTIFIER_MISUSED");
  }
  const contact = x.human_escalation ?? {};
  if (contact.brand_contact_from_official_footer !== "bushmankorea@gmail.com" ||
      contact.phone_from_official_footer !== "02-998-5127" ||
      contact.outreach_sent !== false ||
      contact.manufacturer_response_received !== false ||
      contact.approval_audit_created !== false ||
      contact.requested_clarifications?.length !== 4) {
    fails.push("R5_HUMAN_APPROVAL_MISREPRESENTED");
  }
  const prod = x.frozen_production ?? {};
  if (prod.product_id !== r2.target.productId ||
      prod.subject_id !== r2.target.subjectId ||
      prod.identity_resolution_version !== r2.target.fromAuthority ||
      prod.attestation_table_present !== false ||
      prod.preflight_rpc_present !== false ||
      prod.confirmation_rpc_present !== false ||
      prod.upgrade_audit_count !== 0 ||
      prod.current_semantic_review_count !== 0 ||
      prod.live_db_write_count !== 0) {
    fails.push("R5_PRODUCTION_SCOPE_OR_WRITE");
  }
  const changes = x.prohibited_changes ?? {};
  const changeKeys = ["product_subject_update","official_source_binding_update","fact_evidence_update",
    "production_r2_r3_migration","independent_attestation_issued","subject_identity_authority_upgraded",
    "semantic_review_granted","admission_granted","ranking_beta_uva_water_enabled"];
  if (Object.keys(changes).sort().join() !== changeKeys.sort().join() ||
      changeKeys.some(k => changes[k] !== false)) {
    fails.push("R5_UNAUTHORIZED_ACTIVATION");
  }
  return fails;
}
assert.deepEqual(evaluateR5(r5), [], "R5 must fail closed without manufacturer response");
const r5Negatives = [
  ["false_brand_solo_label", x => x.checked_urls[0].title_unit = "50g", "R5_SOURCE_LABEL_REPRODUCTION"],
  ["false_brand_bundle_label", x => x.checked_urls[1].title_unit = "50ml", "R5_SOURCE_LABEL_REPRODUCTION"],
  ["false_brand_bundle_disclosure", x => x.checked_urls[1].disclosure_unit = "190ml/50g", "R5_SOURCE_LABEL_REPRODUCTION"],
  ["forged_sku", x => x.evidence_strength.identical_sku_confirmed = true, "R5_PROOF_OVERCLAIM"],
  ["fabricated_brand_response", x => x.evidence_strength.manufacturer_explicit_response = true, "R5_PROOF_OVERCLAIM"],
  ["unverified_jan_promoted", x => x.external_reference_boundary.sku_equivalence_inferred_from_jan = true, "R5_EXTERNAL_IDENTIFIER_MISUSED"],
  ["outreach_falsified", x => x.human_escalation.outreach_sent = true, "R5_HUMAN_APPROVAL_MISREPRESENTED"],
  ["approval_falsified", x => x.human_escalation.approval_audit_created = true, "R5_HUMAN_APPROVAL_MISREPRESENTED"],
  ["live_migration", x => x.frozen_production.attestation_table_present = true, "R5_PRODUCTION_SCOPE_OR_WRITE"],
  ["activation_escalation", x => x.prohibited_changes.admission_granted = true, "R5_UNAUTHORIZED_ACTIVATION"],
];
for (const [label, edit, expected] of r5Negatives) {
  const bad = structuredClone(r5);
  edit(bad);
  assert.ok(evaluateR5(bad).includes(expected), label);
}

console.log(JSON.stringify({
  stage:e.stage,
  status:"PASS",
  decision:e.decision,
  negativeTests:negativeTests.length,
  r5NegativeTests:r5Negatives.length,
  r5Decision:r5.decision,
  publicSourceComparison:"PASS_NOT_IDENTITY_ATTESTATION",
  subjectAuthority:"HOLD",
  productionWrites:0
},null,2));
