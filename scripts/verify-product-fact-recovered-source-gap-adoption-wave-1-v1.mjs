import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  ADMIN_ACTOR,
  buildAdoptionPlan,
  EXPECTED_PROPOSITIONS,
  FROZEN_AUTHORITY,
  HOSTED_POSTSTATE_COUNTS,
  HOSTED_PRESTATE_COUNTS,
  renderAdoptionMarkdown,
  sha256Text,
  SOURCE,
  SOURCE_MAIN_SHA,
  stableJson,
  SUBJECT,
} from './product-evidence/product-fact-recovered-source-gap-adoption-wave-1-v1.mjs';
import { proposition } from './product-evidence/product-fact-source-gap-recovery-wave-1-v1.mjs';

const P = {
  evidence: 'evidence/product-evidence-expansion-v1/source-gap-recovery-wave-1-v1.json',
  materialization: 'evidence/product-fact-adoption-v1/source-gap-recovery-wave-1-materialization-v1.json',
  markdown8d: 'docs/evidence/product-fact-source-gap-recovery-wave-1-v1.md',
  batch3: 'evidence/product-fact-adoption-v1/cross-category-adoption-batch-3-v1.json',
  json: 'evidence/product-fact-adoption-v1/recovered-source-gap-adoption-wave-1-v1.json',
  markdown: 'docs/evidence/product-fact-recovered-source-gap-adoption-wave-1-v1.md',
  core: 'scripts/product-evidence/product-fact-recovered-source-gap-adoption-wave-1-v1.mjs',
  builder: 'scripts/build-product-fact-recovered-source-gap-adoption-wave-1-v1.mjs',
};
const read = relative => fs.readFileSync(relative, 'utf8').replace(/\r\n?/gu, '\n');
const parse = relative => JSON.parse(read(relative));
const hash = relative => sha256Text(read(relative));
const inputHashes = {
  evidence_sha256: hash(P.evidence),
  materialization_sha256: hash(P.materialization),
  markdown_sha256: hash(P.markdown8d),
};
const baseMainSha = process.env.V21_8E_BASE_MAIN_SHA || SOURCE_MAIN_SHA;
const expected = buildAdoptionPlan({
  evidence: parse(P.evidence),
  materialization: parse(P.materialization),
  batch3: parse(P.batch3),
  sourceMainSha: baseMainSha,
  inputHashes,
});
const frozenText = read(P.json);
const frozen = JSON.parse(frozenText);
const frozenMarkdown = read(P.markdown);
let assertions = 0;
const check = (value, message) => { assertions += 1; assert.ok(value, message); };
const eq = (actual, wanted, message) => { assertions += 1; assert.deepStrictEqual(actual, wanted, message); };

eq(inputHashes, FROZEN_AUTHORITY, 'V2.1-8D frozen artifact authority drift');
eq(frozen, expected, 'deterministic adoption-plan rebuild mismatch');
check(frozenText === stableJson(expected), 'canonical plan JSON bytes mismatch');
check(frozenMarkdown === renderAdoptionMarkdown(expected), 'canonical plan Markdown bytes mismatch');
check(frozen.source_main_sha === SOURCE_MAIN_SHA, 'source main SHA mismatch');
check(frozen.authority.historical_current_proposition_keys.length === 23, 'historical Current exact set must contain 23');
check(new Set(frozen.authority.historical_current_proposition_keys).size === 23, 'historical Current proposition collision');

eq(frozen.hosted_prestate.counts, HOSTED_PRESTATE_COUNTS, 'Hosted prestate count model drift');
eq(frozen.expected_poststate.counts, HOSTED_POSTSTATE_COUNTS, 'Hosted poststate count model drift');
eq(frozen.hosted_prestate.active_admin_owner, ADMIN_ACTOR, 'canonical admin drift');
eq(frozen.hosted_prestate.migration_versions, ['20260809115932', '20260810174400', '20260810174410'], 'migration authority drift');
eq(frozen.exact_scope, {
  products: 1, subjects: 1, sources: 1, bindings: 1, evidence: 2, facts: 2, confirmations: 2, current: 2,
  excluded_pilots: ['M3', 'P1', 'P2'],
}, 'exact scope drift');

check(frozen.subject.product_id === SUBJECT.product_id, 'M1 product mismatch');
check(frozen.subject.payload.subject_semantic_key === SUBJECT.payload.subject_semantic_key, 'M1 Subject semantic key mismatch');
check(frozen.subject.payload.formulation_revision_key === SUBJECT.payload.formulation_revision_key, 'M1 formulation mismatch');
check(frozen.subject.payload.variant_key === null, 'M1 variant must remain null');
check(frozen.subject.payload.market_applicability === null, 'M1 Subject market must remain null');
check(frozen.subject.payload.region_applicability === null, 'M1 Subject region must remain null');
check(frozen.binding_contract.scope_relation === 'narrower', 'binding scope must remain narrower');
check(frozen.binding_contract.subject_identity_change_required === false, 'Subject mutation must remain false');
check(frozen.source.canonical_locator === SOURCE.canonical_locator, 'canonical source mismatch');
check(frozen.source.content_digest === SOURCE.content_digest, 'source content digest mismatch');

eq(frozen.execution_order, ['primary_use_role', 'barrier_support_claim'], 'execution order drift');
eq(frozen.facts.map(row => row.fact_key), ['primary_use_role', 'barrier_support_claim'], 'Fact set/order drift');
eq(frozen.facts.map(row => row.proposition_key), [EXPECTED_PROPOSITIONS.primary_use_role, EXPECTED_PROPOSITIONS.barrier_support_claim], 'proposition set drift');
eq(frozen.facts.map(row => row.typed_value), ['multi_area', true], 'typed value drift');
for (const row of frozen.facts) {
  const regenerated = proposition(row.fact_key, row.typed_value, SUBJECT.payload.subject_semantic_key, { market: 'KR' });
  check(regenerated.proposition_key === row.proposition_key, `repository-native proposition mismatch ${row.fact_key}`);
  eq(row.scope, { market: 'KR' }, `Fact scope mismatch ${row.fact_key}`);
  check(row.semantic_status === 'supported', `semantic status mismatch ${row.fact_key}`);
  check(row.authority_ceiling === 'product_specific_primary', `authority mismatch ${row.fact_key}`);
  check(row.fused_confidence === 'high', `confidence mismatch ${row.fact_key}`);
  check(row.parent_proposition_key === null, `parent must be null ${row.fact_key}`);
  check(row.ingest_payload.binding.subject_id === '__HOSTED_SUBJECT_ID__', `Subject placeholder missing ${row.fact_key}`);
  check(row.ingest_payload.binding.scope_relation === 'narrower', `binding scope mismatch ${row.fact_key}`);
  check(row.ingest_payload.evidence.canonical_evidence_digest === row.canonical_evidence_digest, `evidence digest mismatch ${row.fact_key}`);
  eq(row.review_payloads.map(payload => payload.operational_state), ['under_review', 'ready_for_confirm'], `review lifecycle mismatch ${row.fact_key}`);
  check(row.confirmation_payload.assignment_id === '__HOSTED_ASSIGNMENT_ID__', `assignment placeholder missing ${row.fact_key}`);
  check(row.confirmation_payload.fusion_input_digest === '__HOSTED_RUNTIME_FUSION_INPUT_DIGEST__', `fusion placeholder missing ${row.fact_key}`);
  eq(row.confirmation_payload.supporting_evidence_ids, ['__HOSTED_EVIDENCE_ID__'], `evidence placeholder mismatch ${row.fact_key}`);
}

eq(frozen.controlled_rpc_sequence, [
  'admin_register_product_fact_subject_v1',
  'admin_ingest_product_fact_evidence_v1',
  'admin_prepare_product_fact_review_v1',
  'admin_preflight_product_fact_confirmation_v1',
  'admin_confirm_product_fact_v1',
], 'controlled RPC sequence drift');
eq(frozen.expected_writes, {
  product_fact_registry_versions: 0,
  product_fact_definition_snapshots: 0,
  product_fact_subjects: 1,
  product_evidence_sources: 1,
  product_evidence_source_subject_bindings: 1,
  product_evidence_records: 2,
  product_fact_instances: 2,
  product_fact_evidence_links: 2,
  product_fact_review_assignments: 2,
  product_fact_review_events: 8,
  product_fact_confirmations: 2,
  product_fact_current: 2,
}, 'expected write set drift');

check(frozen.invariants.existing_current_23_unchanged, 'historical Current invariance missing');
check(frozen.invariants.m3_p1_p2_subject_and_current_zero, 'non-candidate spillover guard missing');
check(!frozen.invariants.registry_republish && !frozen.invariants.ddl && !frozen.invariants.schema_mutation, 'schema boundary weakened');
check(!frozen.invariants.direct_product_fact_table_write, 'direct Product Fact write boundary weakened');
check(!frozen.invariants.recommendation_scorer_changed && !frozen.invariants.recommendation_activated, 'recommendation boundary weakened');
check(!frozen.invariants.decision_axis_production_consumption && !frozen.invariants.catalog_fully_adopted, 'lifecycle boundary weakened');

const runtimeText = [read(P.core), read(P.builder)].join('\n');
check(!/\b(?:insert|update|delete|alter|drop|truncate)\b[\s\S]{0,80}\bproduct_fact_/iu.test(runtimeText), 'direct Product Fact SQL forbidden');
check(!runtimeText.includes('admin_publish_product_fact_registry_v1'), 'Registry publication forbidden');
check(!/from ['"].*(?:app|components|lib)\//u.test(runtimeText), 'production runtime import forbidden');
check(/Current: \*\*23 → 25\*\*/u.test(frozenMarkdown), 'Markdown Current target missing');
check(/M3, P1, and P2 remain excluded/u.test(frozenMarkdown), 'Markdown exclusion boundary missing');

console.log('PASS verify-product-fact-recovered-source-gap-adoption-wave-1-v1');
console.log(`assertions=${assertions}`);
console.log('scope=1_product,1_subject,1_source,1_binding,2_evidence,2_facts,2_confirmations,2_current');
console.log(`propositions=${frozen.facts.map(row => row.proposition_key).join(',')}`);
console.log(`json_sha256=${sha256Text(frozenText)}`);
console.log(`md_sha256=${sha256Text(frozenMarkdown)}`);
console.log('hosted_writes=0 recommendation_activation=NO');
