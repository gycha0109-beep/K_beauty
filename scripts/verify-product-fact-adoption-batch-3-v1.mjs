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
const paths = {
  materialization: 'evidence/product-fact-materialization-v1/cross-category-pilot-materialization-dry-run-v1.json',
  corpus: 'evidence/product-evidence-decision-axis-v1/cross-category-real-evidence-pilot-v1.json',
  mapping: 'evidence/product-evidence-decision-axis-v1/cross-category-real-fact-mapping-pilot-v1.json',
  gap: 'evidence/product-evidence-decision-axis-v1/cross-category-real-pilot-gap-report-v1.json',
  batch1: 'evidence/product-fact-adoption-v1/cross-category-adoption-batch-1-v1.json',
  batch2: 'evidence/product-fact-adoption-v1/cross-category-adoption-batch-2-v1.json',
  frozenJson: 'evidence/product-fact-adoption-v1/cross-category-adoption-batch-3-v1.json',
  frozenMd: 'docs/evidence/product-fact-adoption-batch-3-v1.md',
};
const read = p => fs.readFileSync(p, 'utf8');
const parse = p => JSON.parse(read(p));
const inputHashes = {
  materialization_sha256: sha256Text(read(paths.materialization)),
  corpus_sha256: sha256Text(read(paths.corpus)),
  mapping_sha256: sha256Text(read(paths.mapping)),
  gap_sha256: sha256Text(read(paths.gap)),
  batch1_sha256: sha256Text(read(paths.batch1)),
  batch2_sha256: sha256Text(read(paths.batch2)),
};
const materialization = parse(paths.materialization);
const mapping = parse(paths.mapping);
const expected = buildBatch3Plan({ materialization, mapping, baseMainSha: BASE_MAIN_SHA, inputHashes });
const frozenText = read(paths.frozenJson);
const frozen = JSON.parse(frozenText);
const frozenMd = read(paths.frozenMd);

let assertions = 0;
const check = (condition, message) => { assertions += 1; assert.ok(condition, message); };
const eq = (actual, expectedValue, message) => { assertions += 1; assert.deepStrictEqual(actual, expectedValue, message); };

// Frozen authority and deterministic rebuild.
eq(frozen, expected, 'frozen Batch 3 plan must equal deterministic rebuild');
check(stableJson(expected) === frozenText, 'Batch 3 canonical JSON bytes mismatch');
check(frozen.source_main_sha === BASE_MAIN_SHA, 'source main authority mismatch');
check(inputHashes.materialization_sha256 === 'b2f19878f00f53d9a60dad0b1515fff1f566449e6a531825e712dfa2e3f19bb2', 'V2.1-2 materialization drift');
check(inputHashes.corpus_sha256 === FROZEN_AUTHORITY.corpus_sha256, 'frozen corpus drift');
check(inputHashes.mapping_sha256 === FROZEN_AUTHORITY.mapping_sha256, 'frozen mapping drift');
check(inputHashes.gap_sha256 === FROZEN_AUTHORITY.gap_sha256, 'frozen gap drift');
check(materialization.summary.input_products === 12, 'frozen product count drift');
check(materialization.summary.resolved_subjects === 11, 'resolved subject count drift');
check(materialization.summary.ambiguous_subjects === 1, 'ambiguous subject count drift');
check(materialization.summary.confirmation_eligible_facts === 23, 'confirmation eligible total drift');
check(mapping.summary.fused_fact_count === 23, 'mapping supported total drift');

// Set-difference selection: supported eligible 23 MINUS Hosted Current 13 = exact 10.
const supported = materialization.fact_proposals
  .filter(row => row.semantic_status === 'supported' && row.confirmation_eligibility === 'eligible');
const hostedCurrent = new Set(HOSTED_CURRENT_PROPOSITION_KEYS);
const independentlyRemaining = supported
  .map(row => row.proposition_key)
  .filter(key => !hostedCurrent.has(key))
  .sort();
eq(supported.length, 23, 'supported eligible set must contain 23 propositions');
eq(HOSTED_CURRENT_PROPOSITION_KEYS.length, 13, 'Hosted Current baseline model must contain 13 propositions');
eq(independentlyRemaining, [...EXPECTED_REMAINING_KEYS], 'remaining set must be exact 10-key closure');
eq(frozen.remaining_proposition_keys, [...EXPECTED_REMAINING_KEYS], 'frozen remaining key set drift');
check(frozen.summary.frozen_supported_total === 23, 'frozen supported total mismatch');
check(frozen.summary.hosted_initial_current === 13, 'Hosted initial Current mismatch');
check(frozen.summary.remaining_supported === 10, 'remaining supported count mismatch');
check(frozen.summary.new_unique_products === 0, 'new product plan must be zero');
check(frozen.summary.new_subjects === 0, 'new subject plan must be zero');
check(frozen.summary.new_facts === 10 && frozen.summary.new_current === 10, 'Fact/Current delta must be 10');
check(frozen.summary.expected_new_sources === 0 && frozen.summary.expected_new_bindings === 0, 'Source/Binding delta must be zero');
check(frozen.summary.expected_new_evidence === 10, 'Evidence delta must be 10');
check(frozen.summary.expected_final_current === 23, 'final Current target must be 23');
check(frozen.summary.expected_adopted_unique_products === 8, 'adopted product count must remain 8');
eq(frozen.hosted_prestate.counts, HOSTED_PRESTATE_COUNTS, 'Hosted prestate count model drift');

// Selected products/subjects must be exactly the four already-adopted resolved/current subjects.
eq(frozen.selected_subjects.map(row => row.pilot_id), ['M2', 'P3', 'T2', 'T3'], 'selected subject pilot set/order drift');
eq(new Set(frozen.selected_facts.map(row => row.pilot_id)), new Set(['M2', 'P3', 'T2', 'T3']), 'selected Fact products drift');
for (const row of frozen.selected_subjects) {
  const authority = EXISTING_SUBJECT_AUTHORITY[row.pilot_id];
  check(!!authority, `missing Hosted subject authority ${row.pilot_id}`);
  check(row.product_id === authority.product_id, `product id mismatch ${row.pilot_id}`);
  check(row.subject_id === authority.subject_id, `subject id mismatch ${row.pilot_id}`);
  check(row.subject_semantic_key === authority.subject_semantic_key, `subject semantic key mismatch ${row.pilot_id}`);
  check(row.formulation_revision_key === authority.formulation_revision_key, `formulation revision mismatch ${row.pilot_id}`);
  check(row.identity_status === 'resolved' && row.current_state === 'current', `subject state mismatch ${row.pilot_id}`);
}
check(frozen.selected_facts.every(row => row.hosted_source_reuse.expected_reuse === true), 'all sources/bindings must be reuse operations');
check(frozen.selected_facts.every(row => row.hosted_source_reuse.source_id && row.hosted_source_reuse.binding_id), 'source/binding Hosted IDs required');
check(frozen.selected_facts.every(row => row.authority_ceiling === 'product_specific_primary' && row.fused_confidence === 'high'), 'remaining Fact authority/confidence drift');
check(frozen.selected_facts.every(row => row.semantic_status === 'supported'), 'remaining set contains non-supported Fact');
check(frozen.selected_facts.every(row => row.planned_operation === 'reuse_subject_ingest_evidence_review_preflight_confirm_current'), 'planned operation drift');

// Exact ten propositions and exact typed values from frozen mapping/materialization.
const byKey = new Map(frozen.selected_facts.map(row => [row.proposition_key, row]));
const exact = [
  ['0f99e79e0ac8dea9709408ba2fc30926cdbc1531aecdb64efa1372120a50a7ee', 'M2', 'active_concentration', 'number_unit', 5, 'percent'],
  ['386ee490eb6db1028a882d61fe367d5ad9d44fb381c5a136b2ff92ab9d451446', 'M2', 'contains_active', 'entity_identifier', 'panthenol', null],
  ['1c8be56a7ffca1f92b504e71869bb4837bd6f8dad9a34a99fe0f633d44c15506', 'P3', 'contains_active', 'entity_identifier', 'lactic_acid', null],
  ['4ab8ddaeb4b84042635fa47846946b09bf202972b87eeaff694049c93752e06a', 'P3', 'pad_surface_texture', 'enum', 'embossed', null],
  ['5a48189d6158fb9bc8f994779e766adba162c3e9d13b5ff73dfccdf1fe4757db', 'P3', 'wipe_off_use', 'boolean', true, null],
  ['6a251131fe601a73b41f4112231423346ba6198dfded3cabf09fffd010b23a1b', 'T3', 'recommended_use_frequency', 'range_unit', [2, 2], 'times_per_day'],
  ['7e3f44c47ef50a94953249bed4ae484b1a8ee7995fd05e1d497d07c6229763b2', 'T2', 'active_concentration', 'number_unit', 10, 'percent'],
  ['8178abcf346b1779b649fa935b0dec0d5ea874c9394081dc898debe1172d9c18', 'T2', 'contains_active', 'entity_identifier', 'sodium_hyaluronate_crosspolymer', null],
  ['b5b242ca1dac5937a17f91e11fceef51553ca90b05549c10f0574ccdf393e348', 'P3', 'contains_active', 'entity_identifier', 'salicylic_acid', null],
  ['f4c8b638c67996c9d20af9b39f71e44512ba47ec649ac89d5f31ea27b2d0834d', 'T2', 'recommended_use_frequency', 'range_unit', [1, 1], 'times_per_day'],
];
for (const [key, pilot, factKey, valueType, value, unit] of exact) {
  const row = byKey.get(key);
  check(!!row, `missing proposition ${key}`);
  check(row.pilot_id === pilot && row.fact_key === factKey, `semantic identity mismatch ${key}`);
  check(row.typed_columns.value_type === valueType, `value type mismatch ${key}`);
  if (valueType === 'number_unit') {
    check(Number(row.typed_columns.value_number) === value && row.typed_columns.value_unit === unit, `number_unit mismatch ${key}`);
  } else if (valueType === 'range_unit') {
    check(Number(row.typed_columns.value_range_min) === value[0] && Number(row.typed_columns.value_range_max) === value[1] && row.typed_columns.value_unit === unit, `range_unit mismatch ${key}`);
  } else if (valueType === 'entity_identifier') {
    check(row.typed_columns.value_entity_identifier === value, `entity identifier mismatch ${key}`);
  } else if (valueType === 'enum') {
    check(row.typed_columns.value_enum === value, `enum mismatch ${key}`);
  } else if (valueType === 'boolean') {
    check(row.typed_columns.value_boolean === value, `boolean mismatch ${key}`);
  }
}

// Dependency closure.
const t2Child = byKey.get('7e3f44c47ef50a94953249bed4ae484b1a8ee7995fd05e1d497d07c6229763b2');
check(t2Child.dependency.kind === 'existing_hosted_parent', 'T2 existing-parent mode missing');
check(t2Child.dependency.parent_proposition_key === '1130020852b0028698d62c01046ce25430db8f4869b43191ae0ff02fc93f14d4', 'T2 parent proposition mismatch');
check(t2Child.dependency.parent_fact_instance_id === '2462db37-e18a-415a-837c-e42ae240bc76', 'T2 actual Hosted mandelic parent FI mismatch');
check(!frozen.selected_facts.some(row => row.proposition_key === t2Child.dependency.parent_proposition_key), 'T2 mandelic parent must not be recreated');

const m2Parent = byKey.get('386ee490eb6db1028a882d61fe367d5ad9d44fb381c5a136b2ff92ab9d451446');
const m2Child = byKey.get('0f99e79e0ac8dea9709408ba2fc30926cdbc1531aecdb64efa1372120a50a7ee');
check(m2Child.dependency.kind === 'same_batch_parent', 'M2 same-batch-parent mode missing');
check(m2Child.dependency.parent_proposition_key === m2Parent.proposition_key, 'M2 parent proposition mismatch');
check(m2Child.dependency.parent_fact_instance_id === '__HOSTED_PARENT_FACT_INSTANCE_ID_FROM_BATCH__', 'M2 must use runtime Hosted parent FI placeholder');
check(frozen.selected_facts.indexOf(m2Parent) < frozen.selected_facts.indexOf(m2Child), 'M2 parent must execute before child');

// Cardinality-many must survive the Fact plane unchanged.
eq(frozen.cardinality_many_contract.T2, ['mandelic_acid', 'sodium_hyaluronate_crosspolymer'], 'T2 cardinality-many collapse');
eq(frozen.cardinality_many_contract.T3, ['hyaluronic_acid', 'sodium_dna'], 'T3 cardinality-many collapse');
eq(frozen.cardinality_many_contract.P3, ['lactic_acid', 'salicylic_acid'], 'P3 cardinality-many collapse');
check(frozen.cardinality_many_contract.collapse_forbidden === true, 'Fact-plane dedupe must be forbidden');
check(frozen.selected_facts.filter(row => row.pilot_id === 'P3' && row.fact_key === 'contains_active').length === 2, 'P3 two active identity Facts must remain separate');

// Exclusions must preserve frozen blocked/RNE/insufficient/ambiguous semantics.
const excluded = frozen.excluded_candidates;
for (const pilot of ['M1', 'M3', 'P1']) check(excluded.some(row => row.pilot_id === pilot && row.reason === 'source_blocked'), `${pilot} source-blocked exclusion missing`);
check(excluded.some(row => row.pilot_id === 'P2' && row.reason === 'identity_ambiguous'), 'NEEDLY/P2 ambiguous exclusion missing');
check(excluded.some(row => row.pilot_id === 'T3' && row.fact_key === 'active_concentration' && row.reason === 'reviewed_not_established'), 'T3 RNE exclusion missing');
check(excluded.some(row => row.pilot_id === 'T3' && row.fact_key === 'hydration_change' && row.reason === 'evidence_insufficient'), 'T3 insufficient exclusion missing');
check(excluded.filter(row => row.pilot_id === 'P3' && row.fact_key === 'active_concentration' && row.reason === 'reviewed_not_established').length === 2, 'P3 RNE concentration exclusions missing');

// Canonical RPC lifecycle: new evidence event + initial under_review assignment + ready transition + confirm = 4 events/Fact.
const expectedReviewEventDelta = frozen.selected_facts.length * 4;
check(expectedReviewEventDelta === 40, 'canonical review-event delta must be 40');
check(HOSTED_PRESTATE_COUNTS.product_fact_review_events + expectedReviewEventDelta === 100, 'expected final review-event count must be 100');

// Read-only Batch 2 authority correction ledger must remain complete and non-mutating.
check(frozen.batch_2_hosted_authority_correction.length === 5, 'Batch 2 correction ledger size mismatch');
check(frozen.batch_2_hosted_authority_correction.some(row => row.proposition_key === '61a9e96f7bc31ce1ed67304a4af2592ca7d27c7b931c57a786bf75807e170913' && row.fact_instance_id === 'ed8b3bcb-b9b7-41b7-8e62-d2a349f0c45f'), 'Round Lab correction missing');
check(frozen.batch_2_hosted_authority_correction.some(row => row.proposition_key === 'f13b69729b2a15b9c1a86c4dbaa5a9718ae71e12d21ca5d8950e2e19fc39d00a' && row.parent_fact_instance_id === '532138b9-fd99-49a3-b5ae-9ad677162055'), 'Derma Factory correction missing');

// Production lifecycle and authority boundaries stay inactive.
check(frozen.expected_final_frozen_supported_proposition_keys.length === 23, 'final frozen-supported exact set size mismatch');
eq(frozen.expected_final_frozen_supported_proposition_keys, [...new Set([...HOSTED_CURRENT_PROPOSITION_KEYS, ...EXPECTED_REMAINING_KEYS])].sort(), 'final 23 exact-set closure mismatch');
check(frozen.lifecycle.catalog_fully_adopted === false, 'catalog fully adopted must remain NO');
check(frozen.lifecycle.decision_axis_production_calibrated === false, 'Decision Axis calibration must remain NO');
check(frozen.lifecycle.decision_axis_production_consumption === false, 'Decision Axis production consumption must remain NO');
check(frozen.lifecycle.recommendation_scorer_changed === false, 'recommendation scorer changed must remain NO');
check(frozen.lifecycle.recommendation_activated === false, 'recommendation activation must remain NO');
check(frozen.lifecycle.admin_product_fact_ui_operational === false, 'Admin Product Fact UI must remain NO');

const offlineSources = [
  read('scripts/product-evidence/product-fact-adoption-batch-3-v1.mjs'),
  read('scripts/build-product-fact-adoption-batch-3-v1.mjs'),
  read('scripts/verify-product-fact-adoption-batch-3-v1.mjs'),
].join('\n');
check(!/from\s+['"](?:\.\.\/)*app\//.test(offlineSources), 'production app import forbidden');
check(!/from\s+['"](?:\.\.\/)*components\//.test(offlineSources), 'production component import forbidden');
check(!/recommendation.*score|score.*recommendation/i.test(offlineSources), 'Product Fact direct-to-score edge forbidden in Batch 3 tooling');
check(!/admin_register_product_fact_subject_v1/.test(offlineSources), 'Batch 3 subject registration call forbidden');
check(!/registry_publish|republish/i.test(offlineSources), 'Batch 3 registry republish forbidden');

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
