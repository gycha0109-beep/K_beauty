import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { buildBatch2Plan, stableJson, sha256JsonBytes, EXISTING_ADOPTED_PRODUCT_IDS, EXISTING_CURRENT_PROPOSITION_KEYS, EXCLUSION_REASONS, HOSTED_PRESTATE_COUNTS, HOSTED_PRESTATE_DIGEST } from './product-evidence/product-fact-adoption-batch-2-v1.mjs';

const BASE_MAIN_SHA = process.env.V21_8B_BASE_MAIN_SHA || '0839c8138b022a98490af874b46354b1a5f5116b';
const read = (p) => fs.readFileSync(p, 'utf8');
const paths = {
  materialization: 'evidence/product-fact-materialization-v1/cross-category-pilot-materialization-dry-run-v1.json',
  fusion: 'evidence/product-fact-fusion-v1/cleanser-evidence-fusion-review-uncertainty-v1.json',
  decisionAxis: 'evidence/product-decision-axis-v1/cross-category-product-decision-axis-v1.json',
  shadow: 'evidence/product-recommendation-shadow-v1/legacy-vs-decision-axis-shadow-v1.json',
  batch1: 'evidence/product-fact-adoption-v1/cross-category-adoption-batch-1-v1.json',
};
const texts = Object.fromEntries(Object.entries(paths).map(([k,p]) => [k, read(p)]));
const docs = Object.fromEntries(Object.entries(texts).map(([k,t]) => [k, JSON.parse(t)]));
const hashes = Object.fromEntries(Object.entries(texts).map(([k,t]) => [k, sha256JsonBytes(t)]));
const expected = buildBatch2Plan({ ...docs, baseMainSha: BASE_MAIN_SHA, inputHashes: hashes });
expected.plan_content_sha256 = crypto.createHash('sha256').update(JSON.stringify(expected)).digest('hex');
const frozenText = read('evidence/product-fact-adoption-v1/cross-category-adoption-batch-2-v1.json');
const frozen = JSON.parse(frozenText);

let assertions = 0;
const check = (condition, message) => { assertions += 1; assert.ok(condition, message); };
const eq = (a,b,message) => { assertions += 1; assert.deepStrictEqual(a,b,message); };

eq(frozen, expected, 'frozen Batch 2 plan must equal deterministic rebuild');
check(stableJson(expected) === frozenText, 'Batch 2 canonical JSON bytes mismatch');
check(frozen.authority.source_main_sha === BASE_MAIN_SHA, 'source main authority mismatch');
check(frozen.authority.hosted_prestate_digest === HOSTED_PRESTATE_DIGEST, 'Hosted prestate digest mismatch');
eq(frozen.hosted_prestate.counts, HOSTED_PRESTATE_COUNTS, 'Hosted prestate counts mismatch');
check(hashes.materialization === 'b2f19878f00f53d9a60dad0b1515fff1f566449e6a531825e712dfa2e3f19bb2', 'V2.1-2 materialization drift');
check(hashes.fusion === '86332b78ec38d79f8dfa12c5879cee46f4a22979d69945ee2f5a9dcc7038b802', 'V2.1-4 fusion drift');
check(hashes.decisionAxis === '5dc5c7975be7474bf0767951ea63074ed60968faabee5fdb8734153ff698ab5e', 'V2.1-6 axis drift');
check(hashes.shadow === '7059cd691a0819e935d3debbd1912c7b92a2e3998557bfde28a6ded4a4659e1f', 'V2.1-7 shadow drift');
check(frozen.authority.batch_1_sha256 === hashes.batch1, 'V2.1-8A Batch 1 hash mismatch');

check(frozen.summary.new_products === 3, 'Batch 2 must select exactly 3 products');
check(frozen.summary.new_subjects === 3, 'Batch 2 must plan exactly 3 new subjects');
check(frozen.summary.new_facts === 5, 'Batch 2 must select exactly 5 Facts');
check(frozen.summary.new_current_pointers === 5, 'Batch 2 must plan exactly 5 Current pointers');
check(frozen.summary.new_evidence_records === 5, 'Batch 2 must plan exactly 5 Evidence records');
check(frozen.summary.unique_sources === 3, 'Batch 2 expected unique source count mismatch');
check(frozen.summary.unique_bindings === 3, 'Batch 2 expected unique binding count mismatch');
check(frozen.summary.batch_limit_valid === true, 'Batch 2 hard limit invalid');

eq(frozen.selected_products.map((p)=>p.pilot_id), ['S1','S2','T1'], 'Batch 2 deterministic execution product order drift');
eq(frozen.selected_products.map((p)=>p.category), ['sunscreen','sunscreen','treatment'], 'Batch 2 category coverage drift');
check(frozen.selected_products.every((p)=>p.identity_status==='resolved' && p.current_state==='current'), 'selected subject must be resolved/current');
check(frozen.selected_products.every((p)=>!EXISTING_ADOPTED_PRODUCT_IDS.has(p.product_id)), 'already adopted product selected');

const facts = frozen.selected_facts;
eq(facts.map((f)=>`${f.pilot_id}:${f.fact_key}:${f.expected_proposition_key}`), [
  'S1:spf_value:61a9e96f7bc31ce1ed67304a4af2592ca7d27c7b931c57a786bf75807e170913',
  'S1:uva_label:b7b5726258b05371f9486d243e703f165b8fd3ea09d158bbdd60d8248e2c11b9',
  'S2:spf_value:6b1aecc4a6e4e78e178e68c3310c756b3a87a1b9610938c92e53ac5771eb9c1a',
  'T1:contains_active:89703d12e70171885f5a0db6edb1920bbd3e1ae3f2dc652c0511d93643bc1c55',
  'T1:active_concentration:f13b69729b2a15b9c1a86c4dbaa5a9718ae71e12d21ca5d8950e2e19fc39d00a',
], 'selected Fact exact stable order drift');
check(new Set(facts.map((f)=>f.expected_proposition_key)).size === 5, 'selected proposition keys must be unique');
check(facts.every((f)=>!EXISTING_CURRENT_PROPOSITION_KEYS.has(f.expected_proposition_key)), 'existing Current proposition selected');
check(facts.every((f)=>f.semantic_status==='supported'), 'non-supported Fact selected');
check(facts.every((f)=>f.authority_ceiling==='product_specific_primary'), 'non-primary authority selected');
check(facts.every((f)=>f.fused_confidence==='high'), 'non-high confidence selected');
check(facts.every((f)=>f.rpc_materialization.evidence.evidence_authority==='product_specific_primary'), 'Evidence authority drift');
check(facts.every((f)=>f.rpc_materialization.evidence.confidence==='high'), 'Evidence confidence drift');
check(facts.every((f)=>f.rpc_materialization.evidence.support_direction==='supports'), 'Evidence support direction drift');
check(facts.every((f)=>['exact_subject_match','equivalent_presentation_match'].includes(f.rpc_materialization.binding.binding_state)), 'binding state unsafe');
check(facts.every((f)=>['equivalent','narrower'].includes(f.rpc_materialization.binding.scope_relation)), 'scope relation unsafe');

const child = facts.find((f)=>f.fact_key==='active_concentration');
const parent = facts.find((f)=>f.expected_proposition_key==='89703d12e70171885f5a0db6edb1920bbd3e1ae3f2dc652c0511d93643bc1c55');
check(!!child && !!parent, 'T1 parent/child pair missing');
check(child.parent_dependency.required === true, 'T1 concentration dependency not marked required');
check(child.parent_dependency.parent_proposition_key === parent.expected_proposition_key, 'T1 child parent proposition mismatch');
check(child.rpc_materialization.confirmation_template.parent_fact_instance_id === '__HOSTED_PARENT_FACT_INSTANCE_ID__', 'T1 child Hosted parent placeholder missing');
check(child.rpc_materialization.confirmation_template.parent_proposition_key === parent.expected_proposition_key, 'T1 child confirmation parent proposition mismatch');
check(facts.indexOf(parent) < facts.indexOf(child), 'parent must execute before child');

const excludedByPilot = new Map(frozen.excluded_products.map((row)=>[row.pilot_id,row]));
for (const pilot of ['M2','P3','S3','T2','T3']) check(excludedByPilot.get(pilot)?.reason === 'already_adopted', `${pilot} must be excluded as already_adopted`);
for (const pilot of ['M1','M3','P1']) check(excludedByPilot.get(pilot)?.reason === 'authority_below_batch_threshold', `${pilot} authority exclusion drift`);
check(excludedByPilot.get('P2')?.reason === 'identity_ambiguous', 'NEEDLY P2 must remain identity_ambiguous');
check(frozen.excluded_facts.some((f)=>f.pilot_id==='S2' && f.fact_key==='uv_filter_type' && f.reason==='reviewed_not_established'), 'S2 reviewed_not_established exclusion missing');
check([...frozen.excluded_products,...frozen.excluded_facts].every((r)=>EXCLUSION_REASONS.includes(r.reason)), 'unknown exclusion reason emitted');
check(!frozen.selected_products.some((p)=>p.pilot_id==='P2'), 'NEEDLY must not be selected');

check(frozen.expected_writes.product_fact_subjects===3, 'subject expected delta mismatch');
check(frozen.expected_writes.product_evidence_sources===3, 'source expected delta mismatch');
check(frozen.expected_writes.product_evidence_source_subject_bindings===3, 'binding expected delta mismatch');
check(frozen.expected_writes.product_evidence_records===5, 'Evidence expected delta mismatch');
check(frozen.expected_writes.product_fact_instances===5, 'Fact Instance expected delta mismatch');
check(frozen.expected_writes.product_fact_evidence_links===5, 'Evidence Link expected delta mismatch');
check(frozen.expected_writes.product_fact_review_assignments===5, 'assignment expected delta mismatch');
check(frozen.expected_writes.product_fact_review_events===23, 'review event expected delta mismatch');
check(frozen.expected_writes.product_fact_confirmations===5, 'confirmation expected delta mismatch');
check(frozen.expected_writes.product_fact_current===5, 'Current expected delta mismatch');
check(frozen.expected_final_hosted.counts.product_fact_current===13, 'expected final Current count mismatch');
check(frozen.expected_final_hosted.current_proposition_keys.length===13, 'expected exact Current set size mismatch');
check(frozen.expected_final_hosted.unique_adopted_product_count===8, 'expected adopted product total mismatch');
check(frozen.expected_final_hosted.current_fact_count===13, 'expected adopted Current fact total mismatch');

check(frozen.execution_contract.controlled_rpc_only===true, 'controlled RPC boundary missing');
check(frozen.execution_contract.direct_product_fact_table_write===false, 'direct PF write must remain false');
check(frozen.execution_contract.registry_republish===false, 'registry republish forbidden');
check(frozen.execution_contract.migration_count===0 && frozen.execution_contract.ddl_count===0, 'migration/DDL must be zero');
check(frozen.execution_contract.preflight_zero_write_required===true, 'preflight zero-write gate missing');
check(frozen.execution_contract.stale_prestate_negative_minimum===1, 'stale negative minimum mismatch');
check(frozen.execution_contract.confirm_exact_retry_required===true, 'idempotent retry gate missing');
check(frozen.execution_contract.existing_current_mutation_allowed===false, 'existing Current mutation must remain forbidden');
check(frozen.execution_contract.legacy_scalar_sync===false, 'legacy scalar sync must remain false');
check(frozen.lifecycle.CATALOG_FULLY_ADOPTED===false, 'full catalog adoption must remain false');
check(frozen.lifecycle.PRODUCT_DECISION_AXIS_PRODUCTION_CALIBRATED===false, 'Decision Axis calibration must remain false');
check(frozen.lifecycle.DECISION_AXIS_PRODUCTION_CONSUMPTION===false, 'Decision Axis production consumption forbidden');
check(frozen.lifecycle.RECOMMENDATION_SCORER_CHANGED===false, 'recommendation scorer change forbidden');
check(frozen.lifecycle.RECOMMENDATION_ACTIVATED===false, 'recommendation activation forbidden');
check(frozen.lifecycle.ADMIN_PRODUCT_FACT_UI_OPERATIONAL===false, 'Admin Product Fact UI must remain non-operational');
check(frozen.lifecycle.HOSTED_WRITES_EXECUTED_BY_THIS_ARTIFACT_BUILD===0, 'offline artifact build must execute zero Hosted writes');
check(frozen.admin_actor.user_id==='e1a59349-fe13-43ff-86ce-078c2dce0d99' && frozen.admin_actor.role==='admin_owner', 'canonical Admin actor mismatch');
check(frozen.admin_actor.bootstrap_state==='ALREADY_YES', 'bootstrap lifecycle must be already yes');

console.log('PASS verify-product-fact-adoption-batch-2-v1');
console.log(`assertions=${assertions}`);
console.log(`products=${frozen.summary.new_products} facts=${frozen.summary.new_facts} current=${frozen.summary.new_current_pointers}`);
console.log(`selected=${frozen.selected_products.map((p)=>p.pilot_id).join(',')}`);
console.log(`expected_subjects=${frozen.expected_writes.product_fact_subjects} expected_sources=${frozen.expected_writes.product_evidence_sources} expected_bindings=${frozen.expected_writes.product_evidence_source_subject_bindings} expected_evidence=${frozen.expected_writes.product_evidence_records}`);
console.log('parent_dependency=T1:contains_active->active_concentration');
console.log('controlled_rpc_only=YES direct_pf_write=NO hosted_writes=0 production_consumption=NO recommendation_activation=NO');
