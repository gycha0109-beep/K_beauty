#!/usr/bin/env node
import fs from "node:fs";
import crypto from "node:crypto";
import assert from "node:assert/strict";

const p=JSON.parse(fs.readFileSync("evidence/product-fact-adoption-v1/trust-p12a-boj-original-uva-plan-correction-v1.json","utf8"));
const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==="object"?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
const digest=v=>crypto.createHash("sha256").update(JSON.stringify(stable(v))).digest("hex");

assert.equal(p.version,"trust-p12a-boj-original-uva-plan-correction-v1");
assert.equal(p.stage,"TRUST-P12A");
assert.equal(p.phase,"A_AUTHORITY_CORRECTION_FREEZE");
assert.equal(p.source_main_sha,"90e6f6c35efe553e91a4cee068e4138ce652f10c");
assert.equal(p.supersedes.stage,"TRUST-P12");
assert.equal(p.supersedes.merge_sha,"90e6f6c35efe553e91a4cee068e4138ce652f10c");
assert.equal(p.supersedes.artifact_blob_sha,"83e1eaa52c11b8dbe7e66b2b8a43038a2e855546");
assert.equal(p.supersedes.incorrect_field,"subject.market_applicability");
assert.equal(p.supersedes.incorrect_value,"GLOBAL");
assert.equal(p.supersedes.correct_value,null);

const {plan_content_sha256,...withoutDigest}=p;
assert.equal(digest(withoutDigest),plan_content_sha256);
assert.equal(plan_content_sha256,"959ec06947a417864d8a1c5ee86f417a0a0688ab2698a221f3f3c0035245d385");

assert.equal(p.subject.product_id,"25b2763f-529f-4b2e-a436-2e0776279c55");
assert.equal(p.subject.subject_id,"0865df81-9cd9-438c-8167-380b932c1dc0");
assert.equal(p.subject.subject_semantic_key,"2f5345df7de1decc70af71677652186cb9c2d61e215240a03b29f5e23d1ece44");
assert.equal(p.subject.variant_key,"Relief_Sun_Rice_Probiotics");
assert.equal(p.subject.identity_status,"resolved");
assert.equal(p.subject.current_state,"current");
assert.equal(p.subject.market_applicability,null);
assert.equal(p.subject.region_applicability,null);
assert.equal(p.subject.subject_write_required,false);

assert.equal(p.fact_scope.fact_key,"uva_label");
assert.equal(p.fact_scope.value,"PA++++");
assert.equal(p.fact_scope.market,"GLOBAL");
assert.equal(p.fact_scope.variant,"Relief_Sun_Rice_Probiotics");
assert.equal(p.fact_scope.subject_market_applicability,null);

assert.equal(p.retained_deterministic_identity.proposition_key,"ea34c1e334b846df861b198bd658c3ce1a98d422433e66d0b3e3d7c584915f01");
assert.equal(p.retained_deterministic_identity.source_content_digest,"e09425390b1fbf0e9c4eb4c4a3d1b2854f25d6a7de82a99f57a56a575184e7c9");
assert.equal(p.retained_deterministic_identity.canonical_evidence_digest,"95920464b02a26fa8e31ab057fbbc2157cbb761f0a7eed91d8db7df8121cdb69");
assert.equal(p.retained_deterministic_identity.proposition_changed,false);
assert.equal(p.retained_deterministic_identity.source_observation_changed,false);
assert.equal(p.retained_deterministic_identity.evidence_identity_changed,false);

assert.deepEqual(p.production_readback.counts,{subjects:20,sources:20,bindings:20,evidence:48,fact_instances:48,evidence_links:48,review_assignments:48,confirmations:48,current:48});
assert.deepEqual(p.production_readback.target,{subject_count:1,spf_current:1,uva_current:0,proposition_current:0,source_digest_rows:0,evidence_digest_rows:0,open_assignments:0,confirmation_request_conflicts:0});
assert.equal(p.production_readback.actor.role,"admin_owner");
assert.equal(p.production_readback.actor.is_active,true);
assert.equal(p.production_readback.latest_registry,"product-fact-registry-cross-category-v1");

assert.equal(p.phase_a_expected_writes,0);
assert.equal(p.phase_b_execution_authorized,false);
assert.equal(p.phase_b_contract.subject_registration_required,false);
assert.equal(p.phase_b_contract.direct_table_dml,false);
assert.equal(p.phase_b_contract.fresh_preflight_required,true);
assert.equal(p.invariants.old_p12_plan_must_not_be_used_unmodified_for_execution,true);
assert.equal(p.invariants.subject_market_applicability_is_null,true);
assert.equal(p.invariants.fact_market_scope_is_global,true);
assert.equal(p.invariants.schema_or_rpc_mutation,false);
assert.equal(p.invariants.registry_mutation,false);
assert.equal(p.invariants.recommendation_or_ranking_change,false);
assert.equal(p.next_gate.status,"CORRECTED_PHASE_A_FREEZE_ONLY");

console.log(JSON.stringify({ok:true,stage:p.stage,corrected_subject_market:p.subject.market_applicability,fact_market:p.fact_scope.market,proposition_key:p.retained_deterministic_identity.proposition_key,phase_a_writes:p.phase_a_expected_writes,plan_content_sha256:p.plan_content_sha256},null,2));
