import fs from 'node:fs';
import assert from 'node:assert/strict';
import {
  buildBatch3Plan,
  stableJson,
  sha256Text,
  FROZEN_AUTHORITY,
  HOSTED_PRESTATE_COUNTS,
  HOSTED_CURRENT_PROPOSITION_KEYS,
  EXPECTED_REMAINING_KEYS,
  EXISTING_SUBJECT_AUTHORITY,
} from './product-evidence/product-fact-adoption-batch-3-v1.mjs';

const BASE_MAIN_SHA = process.env.V21_8C_BASE_MAIN_SHA || 'a13e27e9e3dae0b5a38bab3324c587b99e8495d5';
const P = {
  materialization: 'evidence/product-fact-materialization-v1/cross-category-pilot-materialization-dry-run-v1.json',
  corpus: 'evidence/product-evidence-decision-axis-v1/cross-category-real-evidence-pilot-v1.json',
  mapping: 'evidence/product-evidence-decision-axis-v1/cross-category-real-fact-mapping-pilot-v1.json',
  gap: 'evidence/product-evidence-decision-axis-v1/cross-category-real-pilot-gap-report-v1.json',
  batch1: 'evidence/product-fact-adoption-v1/cross-category-adoption-batch-1-v1.json',
  batch2: 'evidence/product-fact-adoption-v1/cross-category-adoption-batch-2-v1.json',
  json: 'evidence/product-fact-adoption-v1/cross-category-adoption-batch-3-v1.json',
  md: 'docs/evidence/product-fact-adoption-batch-3-v1.md',
};
const read = p => fs.readFileSync(p, 'utf8');
const parse = p => JSON.parse(read(p));
const hashes = {
  materialization_sha256: sha256Text(read(P.materialization)),
  corpus_sha256: sha256Text(read(P.corpus)),
  mapping_sha256: sha256Text(read(P.mapping)),
  gap_sha256: sha256Text(read(P.gap)),
  batch1_sha256: sha256Text(read(P.batch1)),
  batch2_sha256: sha256Text(read(P.batch2)),
};
const materialization = parse(P.materialization);
const mapping = parse(P.mapping);
const expected = buildBatch3Plan({ materialization, mapping, baseMainSha: BASE_MAIN_SHA, inputHashes: hashes });
const frozenText = read(P.json);
const frozen = JSON.parse(frozenText);
const frozenMd = read(P.md);

let assertions = 0;
const check = (v, m) => { assertions += 1; assert.ok(v, m); };
const eq = (a, b, m) => { assertions += 1; assert.deepStrictEqual(a, b, m); };

// Frozen authority + deterministic bytes.
eq(frozen, expected, 'Batch 3 deterministic rebuild mismatch');
check(stableJson(expected) === frozenText, 'Batch 3 JSON bytes mismatch');
check(frozen.source_main_sha === BASE_MAIN_SHA, 'source main SHA mismatch');
check(hashes.materialization_sha256 === 'b2f19878f00f53d9a60dad0b1515fff1f566449e6a531825e712dfa2e3f19bb2', 'materialization authority drift');
check(hashes.corpus_sha256 === FROZEN_AUTHORITY.corpus_sha256, 'corpus hash drift');
check(hashes.mapping_sha256 === FROZEN_AUTHORITY.mapping_sha256, 'mapping hash drift');
check(hashes.gap_sha256 === FROZEN_AUTHORITY.gap_sha256, 'gap hash drift');
eq([materialization.summary.input_products, materialization.summary.resolved_subjects, materialization.summary.ambiguous_subjects, materialization.summary.confirmation_eligible_facts], [12, 11, 1, 23], 'frozen materialization summary drift');
check(mapping.summary.fused_fact_count === 23, 'frozen mapping supported total drift');

// Independent set difference: frozen supported+eligible 23 MINUS Hosted Current 13 = exact 10.
const supported = materialization.fact_proposals.filter(x => x.semantic_status === 'supported' && x.confirmation_eligibility === 'eligible');
const hosted = new Set(HOSTED_CURRENT_PROPOSITION_KEYS);
const remaining = supported.map(x => x.proposition_key).filter(x => !hosted.has(x)).sort();
eq(supported.length, 23, 'supported eligible total must be 23');
eq(HOSTED_CURRENT_PROPOSITION_KEYS.length, 13, 'Hosted Current baseline model must be 13');
eq(remaining, [...EXPECTED_REMAINING_KEYS], 'remaining supported set must be exact 10');
eq(frozen.remaining_proposition_keys, [...EXPECTED_REMAINING_KEYS], 'frozen remaining key set drift');
eq(frozen.hosted_prestate.counts, HOSTED_PRESTATE_COUNTS, 'Hosted prestate count model drift');
check(frozen.summary.frozen_supported_total === 23, 'supported total mismatch');
check(frozen.summary.hosted_initial_current === 13, 'initial Current mismatch');
check(frozen.summary.remaining_supported === 10, 'remaining count mismatch');
check(frozen.summary.new_unique_products === 0, 'new products must be zero');
check(frozen.summary.new_subjects === 0, 'new subjects must be zero');
check(frozen.summary.new_facts === 10 && frozen.summary.new_current === 10, 'new Fact/Current delta must be 10');
check(frozen.summary.expected_new_sources === 0 && frozen.summary.expected_new_bindings === 0, 'new Source/Binding delta must be zero');
check(frozen.summary.expected_new_evidence === 10, 'new Evidence delta must be 10');
check(frozen.summary.expected_final_current === 23 && frozen.summary.expected_adopted_unique_products === 8, 'final Current/product target mismatch');

// Existing subject reuse only.
eq(frozen.selected_subjects.map(x => x.pilot_id), ['M2', 'P3', 'T2', 'T3'], 'selected subjects must be exactly M2/P3/T2/T3');
for (const row of frozen.selected_subjects) {
  const a = EXISTING_SUBJECT_AUTHORITY[row.pilot_id];
  check(!!a, `missing subject authority ${row.pilot_id}`);
  eq([row.product_id, row.subject_id, row.subject_semantic_key, row.formulation_revision_key, row.market_applicability], [a.product_id, a.subject_id, a.subject_semantic_key, a.formulation_revision_key, a.market_applicability], `Hosted subject mismatch ${row.pilot_id}`);
  check(row.identity_status === 'resolved' && row.current_state === 'current', `subject state mismatch ${row.pilot_id}`);
}
check(frozen.selected_facts.every(x => x.hosted_source_reuse.expected_reuse && x.hosted_source_reuse.source_id && x.hosted_source_reuse.binding_id), 'all Batch 3 source/binding rows must be reused');
check(frozen.selected_facts.every(x => x.semantic_status === 'supported' && x.authority_ceiling === 'product_specific_primary' && x.fused_confidence === 'high'), 'selected Fact authority mismatch');
check(frozen.selected_facts.every(x => x.planned_operation === 'reuse_subject_ingest_evidence_review_preflight_confirm_current'), 'planned operation mismatch');

// Exact proposition semantics from frozen bytes.
const byKey = new Map(frozen.selected_facts.map(x => [x.proposition_key, x]));
const semantics = new Map([
  ['0f99e79e0ac8dea9709408ba2fc30926cdbc1531aecdb64efa1372120a50a7ee', ['M2','active_concentration','number_unit',5,'percent']],
  ['386ee490eb6db1028a882d61fe367d5ad9d44fb381c5a136b2ff92ab9d451446', ['M2','contains_active','entity_identifier','panthenol',null]],
  ['1c8be56a7ffca1f92b504e71869bb4837bd6f8dad9a34a99fe0f633d44c15506', ['P3','contains_active','entity_identifier','lactic_acid',null]],
  ['4ab8ddaeb4b84042635fa47846946b09bf202972b87eeaff694049c93752e06a', ['P3','pad_surface_texture','enum','embossed',null]],
  ['5a48189d6158fb9bc8f994779e766adba162c3e9d13b5ff73dfccdf1fe4757db', ['P3','wipe_off_use','boolean',true,null]],
  ['6a251131fe601a73b41f4112231423346ba6198dfded3cabf09fffd010b23a1b', ['T3','recommended_use_frequency','range_unit',[2,2],'times_per_day']],
  ['7e3f44c47ef50a94953249bed4ae484b1a8ee7995fd05e1d497d07c6229763b2', ['T2','active_concentration','number_unit',10,'percent']],
  ['8178abcf346b1779b649fa935b0dec0d5ea874c9394081dc898debe1172d9c18', ['T2','contains_active','entity_identifier','sodium_hyaluronate_crosspolymer',null]],
  ['b5b242ca1dac5937a17f91e11fceef51553ca90b05549c10f0574ccdf393e348', ['P3','contains_active','entity_identifier','salicylic_acid',null]],
  ['f4c8b638c67996c9d20af9b39f71e44512ba47ec649ac89d5f31ea27b2d0834d', ['T2','recommended_use_frequency','range_unit',[1,1],'times_per_day']],
]);
for (const [key, [pilot, factKey, type, value, unit]] of semantics) {
  const x = byKey.get(key);
  check(!!x, `missing proposition ${key}`);
  eq([x.pilot_id, x.fact_key, x.typed_columns.value_type], [pilot, factKey, type], `typed identity mismatch ${key}`);
  if (type === 'number_unit') eq([Number(x.typed_columns.value_number), x.typed_columns.value_unit], [value, unit], `number_unit mismatch ${key}`);
  if (type === 'range_unit') eq([Number(x.typed_columns.value_range_min), Number(x.typed_columns.value_range_max), x.typed_columns.value_unit], [value[0], value[1], unit], `range_unit mismatch ${key}`);
  if (type === 'entity_identifier') check(x.typed_columns.value_entity_identifier === value, `entity mismatch ${key}`);
  if (type === 'enum') check(x.typed_columns.value_enum === value, `enum mismatch ${key}`);
  if (type === 'boolean') check(x.typed_columns.value_boolean === value, `boolean mismatch ${key}`);
}

// Existing-parent + same-batch-parent closure.
const t2 = byKey.get('7e3f44c47ef50a94953249bed4ae484b1a8ee7995fd05e1d497d07c6229763b2');
check(t2.dependency.kind === 'existing_hosted_parent', 'T2 existing-parent mode missing');
check(t2.dependency.parent_proposition_key === '1130020852b0028698d62c01046ce25430db8f4869b43191ae0ff02fc93f14d4', 'T2 parent proposition mismatch');
check(t2.dependency.parent_fact_instance_id === '2462db37-e18a-415a-837c-e42ae240bc76', 'T2 actual Hosted parent FI mismatch');
check(!frozen.selected_facts.some(x => x.proposition_key === t2.dependency.parent_proposition_key), 'T2 mandelic Fact must not be recreated');
const m2Parent = byKey.get('386ee490eb6db1028a882d61fe367d5ad9d44fb381c5a136b2ff92ab9d451446');
const m2Child = byKey.get('0f99e79e0ac8dea9709408ba2fc30926cdbc1531aecdb64efa1372120a50a7ee');
check(m2Child.dependency.kind === 'same_batch_parent', 'M2 same-batch-parent mode missing');
check(m2Child.dependency.parent_proposition_key === m2Parent.proposition_key, 'M2 parent proposition mismatch');
check(m2Child.dependency.parent_fact_instance_id === '__HOSTED_PARENT_FACT_INSTANCE_ID_FROM_BATCH__', 'M2 runtime parent FI placeholder missing');
check(frozen.selected_facts.indexOf(m2Parent) < frozen.selected_facts.indexOf(m2Child), 'M2 parent must precede child');

// Cardinality-many / exclusions.
eq(frozen.cardinality_many_contract.T2, ['mandelic_acid','sodium_hyaluronate_crosspolymer'], 'T2 cardinality collapse');
eq(frozen.cardinality_many_contract.T3, ['hyaluronic_acid','sodium_dna'], 'T3 cardinality collapse');
eq(frozen.cardinality_many_contract.P3, ['lactic_acid','salicylic_acid'], 'P3 cardinality collapse');
check(frozen.cardinality_many_contract.collapse_forbidden === true, 'Fact-plane dedupe must be forbidden');
check(frozen.selected_facts.filter(x => x.pilot_id === 'P3' && x.fact_key === 'contains_active').length === 2, 'P3 two active Facts must remain separate');
for (const pilot of ['M1','M3','P1']) check(frozen.excluded_candidates.some(x => x.pilot_id === pilot && x.reason === 'source_blocked'), `${pilot} source-blocked exclusion missing`);
check(frozen.excluded_candidates.some(x => x.pilot_id === 'P2' && x.reason === 'identity_ambiguous'), 'P2 ambiguous exclusion missing');
check(frozen.excluded_candidates.some(x => x.pilot_id === 'T3' && x.fact_key === 'active_concentration' && x.reason === 'reviewed_not_established'), 'T3 RNE exclusion missing');
check(frozen.excluded_candidates.some(x => x.pilot_id === 'T3' && x.fact_key === 'hydration_change' && x.reason === 'evidence_insufficient'), 'T3 insufficient exclusion missing');
check(frozen.excluded_candidates.filter(x => x.pilot_id === 'P3' && x.fact_key === 'active_concentration' && x.reason === 'reviewed_not_established').length === 2, 'P3 RNE exclusions missing');

// Canonical lifecycle event math: evidence_ingested + assignment prepared under_review + transition ready + fact_confirmed.
const expectedReviewEventDelta = frozen.selected_facts.length * 4;
check(expectedReviewEventDelta === 40, 'review event delta must be 40');
check(HOSTED_PRESTATE_COUNTS.product_fact_review_events + expectedReviewEventDelta === 100, 'final review event count must be 100');

// Batch 2 correction ledger / final closure / production isolation.
check(frozen.batch_2_hosted_authority_correction.length === 5, 'Batch 2 correction ledger must contain 5 rows');
check(frozen.batch_2_hosted_authority_correction.some(x => x.proposition_key === '61a9e96f7bc31ce1ed67304a4af2592ca7d27c7b931c57a786bf75807e170913' && x.fact_instance_id === 'ed8b3bcb-b9b7-41b7-8e62-d2a349f0c45f'), 'Round Lab correction missing');
check(frozen.batch_2_hosted_authority_correction.some(x => x.proposition_key === 'f13b69729b2a15b9c1a86c4dbaa5a9718ae71e12d21ca5d8950e2e19fc39d00a' && x.parent_fact_instance_id === '532138b9-fd99-49a3-b5ae-9ad677162055'), 'Derma correction missing');
eq(frozen.expected_final_frozen_supported_proposition_keys, [...new Set([...HOSTED_CURRENT_PROPOSITION_KEYS, ...EXPECTED_REMAINING_KEYS])].sort(), 'final 23 exact-set closure mismatch');
check(frozen.lifecycle.catalog_fully_adopted === false, 'catalog fully adopted must remain NO');
check(frozen.lifecycle.decision_axis_production_calibrated === false, 'Decision Axis calibration must remain NO');
check(frozen.lifecycle.decision_axis_production_consumption === false, 'Decision Axis consumption must remain NO');
check(frozen.lifecycle.recommendation_scorer_changed === false, 'recommendation scorer must remain unchanged');
check(frozen.lifecycle.recommendation_activated === false, 'recommendation activation must remain NO');
check(frozen.lifecycle.admin_product_fact_ui_operational === false, 'Admin Product Fact UI must remain NO');

const tooling = [
  read('scripts/product-evidence/product-fact-adoption-batch-3-v1.mjs'),
  read('scripts/build-product-fact-adoption-batch-3-v1.mjs'),
  read('scripts/verify-product-fact-adoption-batch-3-v1.mjs'),
].join('\n');
const importLines = tooling.split('\n').filter(line => /^\s*import\s/.test(line));
check(!importLines.some(line => /(?:app|components)\//.test(line)), 'production runtime import forbidden');
check(!importLines.some(line => /recommendation|score/i.test(line)), 'Product Fact direct-to-score import edge forbidden');
check(!/admin_register_product_fact_subject_v1/.test(tooling), 'subject registration call forbidden');
check(!/registry_publish_v1|admin_publish_product_fact_registry/i.test(tooling), 'registry republish forbidden');
check(/Frozen supported confirmation-eligible: \*\*23\*\*/.test(frozenMd), 'Markdown supported total missing');
check(/Remaining supported set: \*\*10\*\*/.test(frozenMd), 'Markdown remaining total missing');
check(/New subjects: \*\*0\*\*/.test(frozenMd), 'Markdown new-subject boundary missing');

console.log('PASS verify-product-fact-adoption-batch-3-v1');
console.log(`assertions=${assertions}`);
console.log('supported=23 hosted_current=13 remaining=10 new_products=0 new_subjects=0');
console.log(`remaining_keys=${EXPECTED_REMAINING_KEYS.join(',')}`);
console.log('selected_pilots=M2,P3,T2,T3');
console.log('existing_parent=T2:mandelic_acid->active_concentration_10_percent');
console.log('same_batch_parent=M2:panthenol->active_concentration_5_percent');
console.log('p3_cardinality_many=lactic_acid+salicylic_acid');
console.log('expected_review_event_delta=40 expected_final_review_events=100');
console.log(`json_sha256=${sha256Text(frozenText)}`);
console.log(`md_sha256=${sha256Text(frozenMd)}`);
console.log('production_consumption=NO recommendation_activation=NO hosted_writes=0');
