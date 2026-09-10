#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {C,buildPlan,pretty,digest} from "./trust-p10-lrp-recovered-spf-hosted-adoption-plan-v1.mjs";

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const read=p=>fs.readFileSync(path.join(ROOT,p),"utf8");
const blob=p=>execFileSync("git",["hash-object",p],{cwd:ROOT,encoding:"utf8"}).trim();

assert.equal(blob(C.p9Path),C.p9Blob,"P9 blob authority drift");
assert.equal(blob(C.p7Path),C.p7Blob,"P7 blob authority drift");
const p9=JSON.parse(read(C.p9Path));
const p7=JSON.parse(read(C.p7Path));
const frozen=JSON.parse(read(C.output));
const rebuilt=buildPlan(p9,p7);

assert.equal(pretty(frozen),pretty(rebuilt),"deterministic plan drift");
assert.equal(frozen.plan_content_sha256,digest(Object.fromEntries(Object.entries(frozen).filter(([k])=>k!=="plan_content_sha256"))),"plan digest");
assert.equal(frozen.plan_content_sha256,"ea9e640baf878c0f2fa8298c01a251dd0d240105f6958e567a389ffeba48d8d5");
assert.equal(frozen.source_main_sha,C.sourceMain);
assert.equal(frozen.phase,"A_DETERMINISTIC_PLAN_FREEZE");
assert.equal(frozen.phase_a_expected_writes,0);
assert.equal(frozen.phase_b_execution_authorized,false);
assert.equal(frozen.exact_scope.products,1);
assert.equal(frozen.exact_scope.subjects,1);
assert.equal(frozen.exact_scope.sources,1);
assert.equal(frozen.exact_scope.bindings,1);
assert.equal(frozen.exact_scope.propositions,1);
assert.deepEqual(frozen.exact_scope.fact_keys,["spf_value"]);
assert.deepEqual(frozen.exact_scope.blocked_fact_keys,["uva_label"]);
assert.deepEqual(frozen.exact_scope.eligible_product_ids,[C.product]);

const subject=frozen.subjects[0];
assert.equal(subject.product_id,C.product);
assert.equal(subject.variant_key,"ANTHELIOS_SUN_FLUID_KR_50ML");
assert.equal(subject.formulation_revision_key,"trust-p7-lrp-4833-current");
assert.equal(subject.market_applicability,"KR");
assert.equal(subject.subject_semantic_key,"75f3d410ae03c5ffef800fedb28f706741fe59f3490e6155e396d6151b5ce527");
assert.match(subject.subject_semantic_key,/^[0-9a-f]{64}$/);

const source=frozen.sources[0];
assert.equal(source.product_id,C.product);
assert.equal(source.canonical_locator,"https://www.laroche-posay.si/anthelios/anthelios-nevidni-fluid-spf50-brez-vonja");
assert.equal(source.publisher,"La Roche-Posay Slovenia");
assert.equal(source.source_market,"SI");
assert.equal(source.binding_scope_relation,"narrower");
assert.deepEqual(source.companion_identity_source_urls,["https://www.larocheposay.co.kr/product/view/4833.do"]);
assert.equal(source.digest_basis,"trust-p9-recovered-source-observation-v1-not-live-page-bytes");
assert.equal(source.content_digest,"e935ea69040aab9ffd1bb62472555c5188a9b5e1810e2dd358d750d9325abeb3");
assert.match(source.content_digest,/^[0-9a-f]{64}$/);

const proposition=frozen.propositions[0];
assert.equal(proposition.product_id,C.product);
assert.equal(proposition.fact_key,"spf_value");
assert.equal(proposition.raw_claim,"SPF50+");
assert.equal(proposition.value,50);
assert.equal(proposition.value_type,"number");
assert.deepEqual(proposition.qualifier,{plus_modifier:"plus"});
assert.deepEqual(proposition.scope,{market:"KR",variant:"ANTHELIOS_SUN_FLUID_KR_50ML"});
assert.equal(proposition.subject_semantic_key,subject.subject_semantic_key);
assert.equal(proposition.proposition_key,"9be0d8a4cc57d8738b45955565fc7023761087ee7f50b55e7ea0d2223cdbf515");
assert.equal(proposition.canonical_evidence_digest,"96786c34454fef1ddfc70e741c964a9934d722ea35ecace55a808cf6b38baebf");
assert.equal(proposition.evidence_class,"product_claim");
assert.equal(proposition.evidence_authority,"product_specific_primary");
assert.equal(proposition.authority_ceiling,"product_specific_primary");
assert.equal(proposition.support_direction,"supports");
assert.match(proposition.proposition_key,/^[0-9a-f]{64}$/);
assert.match(proposition.canonical_evidence_digest,/^[0-9a-f]{64}$/);

const blocked=frozen.blocked_facts[0];
assert.equal(blocked.fact_key,"uva_label");
assert.equal(blocked.disposition,"FACT_SOURCE_RECOVERY_REQUIRED");
assert.equal(blocked.observed_same_formula_claim,"UVA-PF 46");
assert.equal(blocked.required_value_kind,"direct_pa_label");
assert.equal(blocked.inference_prohibited,"UVA-PF 46 -> PA++++");
assert.equal(frozen.invariants.uva_label_inference,false);
assert.equal(frozen.invariants.uva_pf_to_pa_conversion,false);
assert.equal(frozen.invariants.cross_market_source_narrowed_to_kr,true);
assert.equal(frozen.invariants.new_fact_kind,false);
assert.equal(frozen.invariants.registry_mutation,false);
assert.equal(frozen.invariants.schema_or_rpc_mutation,false);
assert.equal(frozen.invariants.recommendation_or_ranking_change,false);
assert.equal(frozen.phase_b_contract.direct_table_dml,false);
assert.equal(frozen.phase_b_contract.all_planned_confirmation_preflights_before_any_confirm,true);
assert.equal(frozen.phase_b_contract.runtime_ids,"server_returned_only");
assert.deepEqual(frozen.phase_b_planned_delta,{subjects:1,sources:1,bindings:1,evidence:1,fact_instances:1,evidence_links:1,review_assignments:1,confirmations:1,current:1});
assert.deepEqual(frozen.hosted_prestate,{subjects:19,sources:19,bindings:19,evidence:47,fact_instances:47,review_assignments:47,confirmations:47,current:47,target_subjects:0,target_current:0,target_source_locators:0});
assert.deepEqual(frozen.next_gate.eligible_fact_keys,["spf_value"]);
assert.deepEqual(frozen.next_gate.blocked_fact_keys,["uva_label"]);
assert.equal(frozen.next_gate.status,"PHASE_A_FREEZE_ONLY");

console.log(JSON.stringify({
  ok:true,
  stage:frozen.stage,
  source_main_sha:frozen.source_main_sha,
  product_id:C.product,
  subject_semantic_key:subject.subject_semantic_key,
  proposition_key:proposition.proposition_key,
  propositions:1,
  phase_a_writes:0,
  plan_content_sha256:frozen.plan_content_sha256,
  blocked_fact_keys:frozen.next_gate.blocked_fact_keys
},null,2));
