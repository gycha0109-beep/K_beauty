import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { buildBatchPlan, stableJson, sha256JsonBytes, KNOWN_HOSTED_PRODUCT_IDS, KNOWN_HOSTED_PROPOSITION_KEYS } from './product-evidence/product-fact-adoption-batch-v1.mjs';

const BASE_MAIN_SHA = process.env.V21_8A_BASE_MAIN_SHA || 'eb933621fd1320dc8270b86192d72e7636990c3f';
const read = (p) => fs.readFileSync(p, 'utf8');
const sourcePaths = {
  materialization: 'evidence/product-fact-materialization-v1/cross-category-pilot-materialization-dry-run-v1.json',
  fusion: 'evidence/product-fact-fusion-v1/cleanser-evidence-fusion-review-uncertainty-v1.json',
  decisionAxis: 'evidence/product-decision-axis-v1/cross-category-product-decision-axis-v1.json',
  shadow: 'evidence/product-recommendation-shadow-v1/legacy-vs-decision-axis-shadow-v1.json',
};
const texts = Object.fromEntries(Object.entries(sourcePaths).map(([k,p]) => [k, read(p)]));
const docs = Object.fromEntries(Object.entries(texts).map(([k,t]) => [k, JSON.parse(t)]));
const hashes = Object.fromEntries(Object.entries(texts).map(([k,t]) => [k, sha256JsonBytes(t)]));

function buildExpectedPlan() {
  const axisForSelection = structuredClone(docs.decisionAxis);
  const catalogDomainByPilot = new Map();
  for (const product of axisForSelection.products) {
    catalogDomainByPilot.set(product.pilot_id, product.domain);
    if (product.domain.startsWith('moisturizer_')) product.domain = 'moisturizer_family';
  }
  const plan = buildBatchPlan({ ...docs, decisionAxis: axisForSelection, baseMainSha: BASE_MAIN_SHA, inputHashes: hashes });
  for (const product of plan.selected_products) product.catalog_domain = catalogDomainByPilot.get(product.pilot_id);
  plan.selection_policy.domain_family_adapter = {
    sunscreen: ['sunscreen'],
    moisturizer_family: ['moisturizer_cream', 'moisturizer_balm'],
    treatment: ['treatment'],
    authority: 'V2.1-6 axis_contract.domain_axis_map family semantics',
  };
  delete plan.plan_content_sha256;
  plan.plan_content_sha256 = crypto.createHash('sha256').update(JSON.stringify(plan)).digest('hex');
  return plan;
}

const expected = buildExpectedPlan();
const frozen = JSON.parse(read('evidence/product-fact-adoption-v1/cross-category-adoption-batch-1-v1.json'));
let assertions = 0;
const check = (condition, message) => { assertions += 1; assert.ok(condition, message); };
const eq = (a,b,message) => { assertions += 1; assert.deepStrictEqual(a,b,message); };

eq(frozen, expected, 'frozen plan must equal deterministic rebuild');
check(stableJson(expected) === read('evidence/product-fact-adoption-v1/cross-category-adoption-batch-1-v1.json'), 'canonical JSON bytes mismatch');
check(frozen.authority.base_main_sha === BASE_MAIN_SHA, 'base main authority mismatch');
check(hashes.materialization === 'b2f19878f00f53d9a60dad0b1515fff1f566449e6a531825e712dfa2e3f19bb2', 'V2.1-2 artifact drift');
check(hashes.fusion === '86332b78ec38d79f8dfa12c5879cee46f4a22979d69945ee2f5a9dcc7038b802', 'V2.1-4 fusion artifact drift');
check(hashes.decisionAxis === '5dc5c7975be7474bf0767951ea63074ed60968faabee5fdb8734153ff698ab5e', 'V2.1-6 artifact drift');
check(hashes.shadow === '7059cd691a0819e935d3debbd1912c7b92a2e3998557bfde28a6ded4a4659e1f', 'V2.1-7 shadow artifact drift');
check(frozen.authority.cleanser_axis_sha256 === 'fbddc761328f2caa5025a5867061866d17f16d24cb6566fe82d0796c20a4a0b4', 'V2.1-5 axis authority drift');
check(frozen.summary.new_products === 3, 'Batch 1 must contain exactly 3 new products');
check(frozen.summary.new_facts === 6, 'Batch 1 must contain exactly 6 new Facts');
check(frozen.summary.new_current_pointers === 6, 'Batch 1 current budget mismatch');
check(frozen.summary.batch_limit_valid === true, 'Batch budget invalid');
eq(frozen.selected_products.map((p)=>p.domain), ['sunscreen','moisturizer_family','treatment'], 'domain family shape mismatch');
eq(frozen.selected_products.map((p)=>p.catalog_domain), ['sunscreen','moisturizer_balm','treatment'], 'catalog domain preservation mismatch');
eq(frozen.selected_products.map((p)=>p.pilot_id), ['S3','M2','T3'], 'deterministic Batch 1 selection drift');
check(new Set(frozen.selected_products.map((p)=>p.product_id)).size === 3, 'selected product IDs must be unique');
check(frozen.selected_products.every((p)=>p.identity_status==='resolved' && p.current_state==='current'), 'selected subject must be resolved/current');
check(frozen.selected_products.every((p)=>!KNOWN_HOSTED_PRODUCT_IDS.has(p.product_id)), 'already Hosted product selected');
const facts = frozen.selected_fact_proposals;
check(facts.length === 6, 'selected Fact count mismatch');
check(new Set(facts.map((f)=>f.expected_proposition_key)).size === 6, 'proposition keys must be unique');
check(facts.every((f)=>!KNOWN_HOSTED_PROPOSITION_KEYS.has(f.expected_proposition_key)), 'already Hosted proposition selected');
check(facts.every((f)=>f.semantic_status==='supported'), 'non-supported Fact selected');
check(facts.every((f)=>f.authority_ceiling==='product_specific_primary'), 'non-primary authority selected');
check(facts.every((f)=>f.fused_confidence==='high'), 'non-high confidence selected');
check(facts.every((f)=>f.rpc_materialization.confirmation_template.parent_fact_instance_id===null && f.rpc_materialization.confirmation_template.parent_proposition_key===null), 'parent-dependent Fact selected');
check(facts.every((f)=>f.rpc_materialization.evidence.support_direction==='supports' && f.rpc_materialization.evidence.negative_admissibility==='not_applicable'), 'support semantics mismatch');
check(facts.every((f)=>['exact_subject_match','equivalent_presentation_match'].includes(f.rpc_materialization.binding.binding_state)), 'binding state unsafe');
check(facts.every((f)=>['equivalent','narrower'].includes(f.rpc_materialization.binding.scope_relation)), 'scope relation unsafe');
check(facts.every((f)=>f.rpc_materialization.evidence.evidence_authority==='product_specific_primary'), 'Evidence authority mismatch');
check(facts.every((f)=>f.rpc_materialization.evidence.confidence==='high'), 'Evidence confidence mismatch');
check(frozen.selected_products.every((p)=>p.brand!=='NEEDLY'), 'NEEDLY must not be selected');
check(frozen.excluded_proposals.some((x)=>x.reason==='already_hosted_v21_3'), 'existing Hosted propositions must be explicitly excluded');
check(frozen.execution_contract.registry_republish===false, 'registry republish forbidden');
check(frozen.execution_contract.controlled_rpc_only===true, 'controlled RPC boundary missing');
check(frozen.execution_contract.direct_product_fact_table_write===false, 'direct PF write must be false');
check(frozen.execution_contract.preflight_before_each_confirm===true, 'preflight gate missing');
check(frozen.execution_contract.confirm_exact_retry_required===true, 'idempotency gate missing');
check(frozen.execution_contract.stale_prestate_negative_required===true, 'stale gate missing');
check(frozen.lifecycle.PRODUCT_FACT_CATALOG_ADOPTED===false, 'full adoption must remain false');
check(frozen.lifecycle.CATALOG_FULLY_ADOPTED===false, 'catalog fully adopted must remain false');
check(frozen.lifecycle.DECISION_AXIS_PRODUCTION_CONSUMPTION===false, 'Decision Axis production consumption forbidden');
check(frozen.lifecycle.RECOMMENDATION_SCORER_CHANGED===false, 'scorer change forbidden');
check(frozen.lifecycle.RECOMMENDATION_ACTIVATED===false, 'recommendation activation forbidden');
check(frozen.lifecycle.HOSTED_WRITES_EXECUTED_BY_THIS_ARTIFACT_BUILD===0, 'offline build must write zero Hosted rows');
check(frozen.expected_writes.product_fact_instances===6 && frozen.expected_writes.product_fact_current===6, 'Fact/Current expected write budget mismatch');
check(frozen.expected_writes.product_fact_registry_versions===0 && frozen.expected_writes.product_fact_definition_snapshots===0, 'registry write expected unexpectedly');
check(frozen.expected_writes.product_fact_subjects===3, 'subject write expectation mismatch');
check(frozen.expected_writes.product_evidence_sources===3, 'source write expectation mismatch');
check(frozen.expected_writes.product_evidence_source_subject_bindings===3, 'binding write expectation mismatch');
check(frozen.expected_writes.product_evidence_records===6, 'Evidence write expectation mismatch');
check(frozen.expected_writes.product_fact_review_assignments===6, 'assignment write expectation mismatch');
check(frozen.expected_writes.product_fact_review_events===27, 'review event expectation mismatch');
check(frozen.expected_writes.product_fact_confirmations===6, 'confirmation write expectation mismatch');
check(frozen.expected_writes.product_fact_current===6, 'Current write expectation mismatch');
check(!JSON.stringify(frozen).includes('reviewer_email'), 'reviewer email leakage');
check(!JSON.stringify(frozen).includes('admin_email'), 'admin identity leakage');

console.log('PASS verify-product-fact-adoption-batch-1-v1');
console.log(`assertions=${assertions}`);
console.log(`products=${frozen.summary.new_products} facts=${frozen.summary.new_facts} current=${frozen.summary.new_current_pointers}`);
console.log(`selected=${frozen.selected_products.map((p)=>`${p.pilot_id}:${p.domain}/${p.catalog_domain}`).join(',')}`);
console.log(`expected_subjects=${frozen.expected_writes.product_fact_subjects} expected_sources=${frozen.expected_writes.product_evidence_sources} expected_bindings=${frozen.expected_writes.product_evidence_source_subject_bindings} expected_evidence=${frozen.expected_writes.product_evidence_records}`);
console.log('controlled_rpc_only=YES direct_pf_write=NO hosted_writes=0 production_consumption=NO recommendation_activation=NO');
