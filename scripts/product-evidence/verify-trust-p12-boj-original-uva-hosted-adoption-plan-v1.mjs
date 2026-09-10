#!/usr/bin/env node
import fs from "node:fs";
import crypto from "node:crypto";
import assert from "node:assert/strict";

const path="evidence/product-fact-adoption-v1/trust-p12-boj-original-uva-hosted-adoption-plan-v1.json";
const p=JSON.parse(fs.readFileSync(path,"utf8"));
const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==="object"?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
const digest=v=>crypto.createHash("sha256").update(typeof v==="string"?v:JSON.stringify(stable(v))).digest("hex");

const PRODUCT="25b2763f-529f-4b2e-a436-2e0776279c55";
const SUBJECT="0865df81-9cd9-438c-8167-380b932c1dc0";
const SUBJECT_KEY="2f5345df7de1decc70af71677652186cb9c2d61e215240a03b29f5e23d1ece44";
const VARIANT="Relief_Sun_Rice_Probiotics";
const URL="https://beautyofjoseon.com/products/relief-sun-rice-probiotics";

assert.equal(p.version,"trust-p12-boj-original-uva-hosted-adoption-plan-v1");
assert.equal(p.stage,"TRUST-P12");
assert.equal(p.phase,"A_DETERMINISTIC_PLAN_FREEZE");
assert.equal(p.source_main_sha,"5fd5cbbe0274bc9b0092263afc5f51d3f42fd3f9");
assert.equal(p.phase_a_expected_writes,0);
assert.equal(p.phase_b_execution_authorized,false);

const {plan_content_sha256,...withoutPlanDigest}=p;
assert.equal(digest(withoutPlanDigest),plan_content_sha256);
assert.equal(plan_content_sha256,"c282dabe9f5c7b6572bf5f771841dd96386c0d8e8a6b01cb7fa6543b5abe9921");

assert.equal(p.subject.product_id,PRODUCT);
assert.equal(p.subject.subject_id,SUBJECT);
assert.equal(p.subject.subject_semantic_key,SUBJECT_KEY);
assert.equal(p.subject.variant_key,VARIANT);
assert.equal(p.subject.formulation_revision_key,"pilot-freeze-1b04778e8aba22d6d6e45233a8f75e9a");
assert.equal(p.subject.identity_status,"resolved");
assert.equal(p.subject.current_state,"current");
assert.equal(p.subject.market_applicability,"GLOBAL");
assert.equal(p.subject.subject_write_required,false);

const propositionIdentity={
  serializer_version:p.authority.proposition_serializer_version,
  subject_semantic_key:SUBJECT_KEY,
  registry_version:p.authority.registry_version,
  fact_key:"uva_label",
  value_identity:"PA++++",
  scope:{market:"GLOBAL",variant:VARIANT},
  qualifier:{},
  parent_proposition_key:null
};
assert.equal(digest(propositionIdentity),p.proposition.proposition_key);
assert.equal(p.proposition.proposition_key,"ea34c1e334b846df861b198bd658c3ce1a98d422433e66d0b3e3d7c584915f01");
assert.equal(p.proposition.fact_key,"uva_label");
assert.equal(p.proposition.value,"PA++++");
assert.equal(p.proposition.value_type,"enum");
assert.equal(p.proposition.raw_claim,"PA++++");
assert.deepEqual(p.proposition.scope,{market:"GLOBAL",variant:VARIANT});
assert.deepEqual(p.proposition.qualifier,{});
assert.equal(p.proposition.evidence_class,"product_claim");
assert.equal(p.proposition.evidence_authority,"product_specific_primary");
assert.equal(p.proposition.authority_ceiling,"product_specific_primary");
assert.equal(p.proposition.support_direction,"supports");
assert.equal(p.proposition.negative_admissibility,"not_applicable");
assert.equal(p.proposition.fused_confidence,"high");

const sourceObservation={
  version:"trust-p12-boj-current-official-observation-v1",
  canonical_locator:URL,
  publisher:"Beauty of Joseon",
  source_kind:"official_product_page",
  source_market:"GLOBAL",
  product_identity:{
    prior_name:"Relief Sun : Rice + Probiotics",
    current_name:"Relief Sun : Rice + Niacinamide",
    size_ml:50,
    formula_changed:false,
    ingredients_changed:false,
    size_changed:false
  },
  machine_verifiable_fact_support:{spf_value:"SPF50+",uva_label:"PA++++"},
  identity_continuity_basis:"official FAQ states only the name changed; formula, ingredients, size, and product remain unchanged"
};
assert.equal(digest(sourceObservation),p.source.content_digest);
assert.equal(p.source.content_digest,"e09425390b1fbf0e9c4eb4c4a3d1b2854f25d6a7de82a99f57a56a575184e7c9");
assert.equal(p.source.canonical_locator,URL);
assert.equal(p.source.publisher,"Beauty of Joseon");
assert.equal(p.source.source_kind,"official_product_page");
assert.equal(p.source.market,"GLOBAL");
assert.equal(p.source.identity_continuity.official_faq_name_change_only,true);
assert.equal(p.source.identity_continuity.formula_unchanged,true);
assert.equal(p.source.identity_continuity.ingredients_unchanged,true);
assert.equal(p.source.identity_continuity.size_unchanged,true);
assert.ok(p.source.observed_claims.includes("PA++++"));
assert.ok(p.source.observed_claims.includes("SPF50+"));

const evidenceIdentity={
  version:"trust-p12-canonical-evidence-v1",
  product_id:PRODUCT,
  subject_semantic_key:SUBJECT_KEY,
  source_ref:p.source.source_ref,
  source_content_digest:p.source.content_digest,
  fact_key:"uva_label",
  raw_claim:"PA++++",
  proposition_key:p.proposition.proposition_key,
  proposition_value_identity:"PA++++",
  scope:{market:"GLOBAL",variant:VARIANT},
  qualifier:{},
  evidence_class:"product_claim",
  evidence_authority:"product_specific_primary",
  support_direction:"supports"
};
assert.equal(digest(evidenceIdentity),p.proposition.canonical_evidence_digest);
assert.equal(p.proposition.canonical_evidence_digest,"95920464b02a26fa8e31ab057fbbc2157cbb761f0a7eed91d8db7df8121cdb69");

assert.deepEqual(p.hosted_prestate,{bindings:20,checked_at:"2026-09-11T06:14:04.998027+09:00",confirmations:48,current:48,evidence:48,evidence_digest_rows:0,evidence_links:48,existing_locator_rows:1,fact_instances:48,new_source_identity_rows:0,open_assignment_rows:0,proposition_current_rows:0,review_assignments:48,sources:20,subjects:20,target_spf_current:1,target_subjects:1,target_uva_current:0});
assert.deepEqual(p.phase_b_planned_delta,{bindings:1,confirmations:1,current:1,evidence:1,evidence_links:1,fact_instances:1,review_assignments:1,sources:1,subjects:0});
assert.equal(p.phase_b_contract.subject_registration_required,false);
assert.deepEqual(p.phase_b_contract.rpc_sequence,["admin_ingest_product_fact_evidence_v1","admin_prepare_product_fact_review_v1","admin_preflight_product_fact_confirmation_v1","admin_confirm_product_fact_v1"]);
assert.deepEqual(p.phase_b_contract.review_states,["under_review","ready_for_confirm"]);
assert.equal(p.phase_b_contract.all_planned_confirmation_preflights_before_any_confirm,true);
assert.equal(p.phase_b_contract.direct_table_dml,false);
assert.equal(p.invariants.existing_subject_reused,true);
assert.equal(p.invariants.new_subject_for_rename,false);
assert.equal(p.invariants.direct_product_fact_dml,false);
assert.equal(p.invariants.schema_or_rpc_mutation,false);
assert.equal(p.invariants.registry_mutation,false);
assert.equal(p.invariants.recommendation_or_ranking_change,false);
assert.equal(p.next_gate.status,"PHASE_A_FREEZE_ONLY");
assert.deepEqual(p.next_gate.eligible_fact_keys,["uva_label"]);

console.log(JSON.stringify({ok:true,stage:p.stage,product_id:PRODUCT,subject_id:SUBJECT,fact_key:p.proposition.fact_key,value:p.proposition.value,proposition_key:p.proposition.proposition_key,source_content_digest:p.source.content_digest,canonical_evidence_digest:p.proposition.canonical_evidence_digest,phase_a_writes:p.phase_a_expected_writes,planned_delta:p.phase_b_planned_delta},null,2));
