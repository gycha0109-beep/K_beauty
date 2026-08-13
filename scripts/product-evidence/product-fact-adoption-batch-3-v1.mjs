import crypto from 'node:crypto';

export const BATCH_VERSION = 'product-fact-adoption-batch-3-v1';
export const BATCH_ID = 'v21-8c-frozen-pilot-supported-fact-completion';
export const REGISTRY_VERSION = 'product-fact-registry-cross-category-v1';
export const ADMIN_ACTOR = Object.freeze({
  user_id: 'e1a59349-fe13-43ff-86ce-078c2dce0d99',
  role: 'admin_owner',
  required_capabilities: ['admin.products.review', 'admin.operations.execute'],
});

export const FROZEN_AUTHORITY = Object.freeze({
  corpus_sha256: '47457c0242451a35305fd8eceba0ebb7e210eb9ee2e73134ccf41696d18e517d',
  mapping_sha256: 'c746c5d02f654ed7f0a8e8385611ac65ca30b9c4648fa4c6454ac863e7c9314f',
  gap_sha256: '5a4580d76cca62d90a3ac306744054c507a6d5e45b0b91a41dffb3b754980215',
  supported_confirmation_eligible_total: 23,
});

export const HOSTED_PRESTATE_COUNTS = Object.freeze({
  product_fact_registry_versions: 1,
  product_fact_definition_snapshots: 20,
  product_fact_subjects: 8,
  product_evidence_sources: 8,
  product_evidence_source_subject_bindings: 8,
  product_evidence_records: 13,
  product_fact_instances: 13,
  product_fact_evidence_links: 13,
  product_fact_review_assignments: 13,
  product_fact_review_events: 60,
  product_fact_confirmations: 13,
  product_fact_current: 13,
});

export const HOSTED_CURRENT_PROPOSITION_KEYS = Object.freeze([
  '1130020852b0028698d62c01046ce25430db8f4869b43191ae0ff02fc93f14d4',
  '5bd530c0b48f73553f935695d2254d415476b66539a88624c7e4e1d581c8f777',
  '61a9e96f7bc31ce1ed67304a4af2592ca7d27c7b931c57a786bf75807e170913',
  '6b1aecc4a6e4e78e178e68c3310c756b3a87a1b9610938c92e53ac5771eb9c1a',
  '7447a2176f490ae2db3bdb9078622b7a6f1150bbd7cb8b75016ac04582182b80',
  '89703d12e70171885f5a0db6edb1920bbd3e1ae3f2dc652c0511d93643bc1c55',
  'a00cae7249ea6472f31d6a7bf5e0e0ffec90f2dd8c241bbda78bd5b0239d8742',
  'ade30ee97c27c1bbd5280d0f671c7afae768d62386751798b73f334272d20b17',
  'b6f1424d1fef32965ec9b1d58d160f8d6b288ce5dcaf7d00fd478fc005eef098',
  'b7b5726258b05371f9486d243e703f165b8fd3ea09d158bbdd60d8248e2c11b9',
  'ca47a8163253401226cf60b5c790f80385605be5f4332e04ae4850e1c7f3163e',
  'caece34a8bcfd3e93a776bf84934dda10ad4bb33ad4706b4cca6db039032bc30',
  'f13b69729b2a15b9c1a86c4dbaa5a9718ae71e12d21ca5d8950e2e19fc39d00a',
].sort());

export const EXPECTED_REMAINING_KEYS = Object.freeze([
  '0f99e79e0ac8dea9709408ba2fc30926cdbc1531aecdb64efa1372120a50a7ee',
  '1c8be56a7ffca1f92b504e71869bb4837bd6f8dad9a34a99fe0f633d44c15506',
  '386ee490eb6db1028a882d61fe367d5ad9d44fb381c5a136b2ff92ab9d451446',
  '4ab8ddaeb4b84042635fa47846946b09bf202972b87eeaff694049c93752e06a',
  '5a48189d6158fb9bc8f994779e766adba162c3e9d13b5ff73dfccdf1fe4757db',
  '6a251131fe601a73b41f4112231423346ba6198dfded3cabf09fffd010b23a1b',
  '7e3f44c47ef50a94953249bed4ae484b1a8ee7995fd05e1d497d07c6229763b2',
  '8178abcf346b1779b649fa935b0dec0d5ea874c9394081dc898debe1172d9c18',
  'b5b242ca1dac5937a17f91e11fceef51553ca90b05549c10f0574ccdf393e348',
  'f4c8b638c67996c9d20af9b39f71e44512ba47ec649ac89d5f31ea27b2d0834d',
].sort());

export const EXISTING_SUBJECT_AUTHORITY = Object.freeze({
  T2: {
    product_id: '0b88019a-9eb2-4be9-842d-f1e60e42cf51',
    subject_id: 'c702942b-fce0-4a02-8edf-501d0c8361d0',
    subject_semantic_key: '686431e49f6ee9255bad448bb78778e67c3905e6a223e72a81e8090aca93ecb4',
    formulation_revision_key: 'pilot-freeze-06e08bafc734b5e897d77db4bc5cae4a',
    market_applicability: 'KR',
    existing_source_id: 'a2cae919-69de-4bf0-82e8-3d13996943d2',
    existing_binding_id: 'c2cdb937-dcd2-49ca-99d8-58e6ebdadf44',
    existing_parent: {
      proposition_key: '1130020852b0028698d62c01046ce25430db8f4869b43191ae0ff02fc93f14d4',
      fact_instance_id: '2462db37-e18a-415a-837c-e42ae240bc76',
      fact_key: 'contains_active',
      value_entity_identifier: 'mandelic_acid',
    },
  },
  T3: {
    product_id: '24a339bf-f380-493f-88b5-68e6be887c30',
    subject_id: 'c98cde90-dc0f-4649-88ad-412e8c04fcc7',
    subject_semantic_key: '39e39ef34ec2eb65b8e4833a9a2418f598be453d66a733b0bc9e13d64b97275f',
    formulation_revision_key: 'pilot-freeze-d131707cbd635ccff965adffac13c96b',
    market_applicability: 'US',
    existing_source_id: 'd2f59350-eb66-4447-b7ca-771381daf8ca',
    existing_binding_id: 'fa6f63f7-7a35-4148-8737-076910aa1e78',
  },
  M2: {
    product_id: 'c67266dd-3706-4929-9196-936d1f61cbc5',
    subject_id: '889b2e43-ea04-4a47-9aa9-a6b2bfbd1d28',
    subject_semantic_key: 'd5f218a69f25308636cabd9c1e889e26586c5ca6986140fa6342700468d0de48',
    formulation_revision_key: 'pilot-freeze-c1558369847dd76d15851abdbe646069',
    market_applicability: 'ZA',
    existing_source_id: '0cb7a8eb-7514-45eb-a6a5-761cd49e6cd9',
    existing_binding_id: '55d454b8-186f-4e29-96fc-2cd732dc87e2',
  },
  P3: {
    product_id: '230f1c9c-cbf8-4458-aaac-ea1010a21e8c',
    subject_id: '5f4cbfeb-524c-41b6-a0f8-723fb2a60090',
    subject_semantic_key: '5a9d4098d562c776485a9e776575737ce05837982029da10ba0dc2351eef2814',
    formulation_revision_key: 'pilot-freeze-86d7acacdd2a8ae52b233fb87cac8cb5',
    market_applicability: 'KR',
    existing_source_id: 'fb9e9588-ec67-4cf5-be16-8a8fa61ee430',
    existing_binding_id: 'b1ffe942-6ffb-4e4b-a797-2491af01e4d2',
  },
});

export const BATCH_2_HOSTED_AUTHORITY_CORRECTION = Object.freeze([
  { product_id:'0bb742d2-df6b-49a7-8e29-8f76ae62ac0d', proposition_key:'61a9e96f7bc31ce1ed67304a4af2592ca7d27c7b931c57a786bf75807e170913', fact_instance_id:'ed8b3bcb-b9b7-41b7-8e62-d2a349f0c45f', confirmation_id:'98e23691-98df-41eb-876f-46a17f790eda', evidence_id:'77a64faa-51c7-416b-8aa9-2b29d98e4906', source_id:'3fa2f78b-d7c4-4355-bbda-79e747a3ea99', binding_id:'f1734dc9-8ad2-458d-a976-966bfe6e6ef8' },
  { product_id:'0bb742d2-df6b-49a7-8e29-8f76ae62ac0d', proposition_key:'b7b5726258b05371f9486d243e703f165b8fd3ea09d158bbdd60d8248e2c11b9', fact_instance_id:'d97b73b3-401b-4fe3-8a28-59a727a8ccc0', confirmation_id:'e43940ea-0a52-4edc-aa7f-d08e2770f1ad', evidence_id:'edc9bdd1-87c1-42f3-8eeb-5fb0e35d9367', source_id:'3fa2f78b-d7c4-4355-bbda-79e747a3ea99', binding_id:'f1734dc9-8ad2-458d-a976-966bfe6e6ef8' },
  { product_id:'25b2763f-529f-4b2e-a436-2e0776279c55', proposition_key:'6b1aecc4a6e4e78e178e68c3310c756b3a87a1b9610938c92e53ac5771eb9c1a', fact_instance_id:'8b2e9031-4c88-4fae-9179-2876c5fff110', confirmation_id:'88215ded-b038-49b1-8cac-f25c0747c763', evidence_id:'2cc344f4-8e48-4b90-8222-6a7ebe61259d', source_id:'4f74de41-9515-495c-8c93-19ab1cd3cf6d', binding_id:'2fc36710-b0db-4210-afc0-60c4ac488de0' },
  { product_id:'fa5b1f6b-1e55-47b0-bfa1-494be512df07', proposition_key:'89703d12e70171885f5a0db6edb1920bbd3e1ae3f2dc652c0511d93643bc1c55', fact_instance_id:'532138b9-fd99-49a3-b5ae-9ad677162055', confirmation_id:'5030d053-6783-499e-b714-613cdcacc7f3', evidence_id:'42d8fc22-2348-470b-a89a-6eddac9fe14c', source_id:'f5eb21f8-4829-4c9b-b927-ccdfb43cdd1b', binding_id:'c674e798-f8bd-40f6-9add-ec5b64a4525f' },
  { product_id:'fa5b1f6b-1e55-47b0-bfa1-494be512df07', proposition_key:'f13b69729b2a15b9c1a86c4dbaa5a9718ae71e12d21ca5d8950e2e19fc39d00a', fact_instance_id:'f1b5f4c9-d099-4594-9b3c-73b13bd3ce00', confirmation_id:'56798708-0b7d-42b5-a2ae-2be2ed0e2c5a', evidence_id:'9f4e862b-e16a-4858-b67a-72daa09bd1ac', source_id:'f5eb21f8-4829-4c9b-b927-ccdfb43cdd1b', binding_id:'c674e798-f8bd-40f6-9add-ec5b64a4525f', parent_fact_instance_id:'532138b9-fd99-49a3-b5ae-9ad677162055' },
]);

const stable = (a,b) => String(a).localeCompare(String(b));
export const stableJson = value => `${JSON.stringify(value, null, 2)}\n`;
export const sha256Text = value => crypto.createHash('sha256').update(value).digest('hex');
const indexBy = (rows,key) => new Map(rows.map(row => [row[key],row]));
const scoped = (scope,key) => scope?.[key] ?? null;

function sourcePayload(source) {
  return {
    canonical_locator: source.canonical_locator,
    publisher: source.publisher,
    source_kind: source.source_kind,
    source_metadata: source.source_metadata,
    content_digest: source.content_digest,
    external_snapshot_reference: source.external_snapshot_reference,
    market: source.market,
    region: source.region,
    locale: source.locale,
    published_at: source.published_at,
    accessed_at: source.accessed_at,
    observed_at: source.observed_at,
  };
}

function evidencePayload(evidence) {
  return {
    registry_version: evidence.registry_version,
    fact_key: evidence.fact_key,
    proposition_key: evidence.proposition_key,
    proposition_serializer_version: evidence.proposition_serializer_version,
    proposition_value_identity: evidence.proposition_value_identity,
    parent_proposition_key: evidence.parent_proposition_key,
    evidence_class: evidence.evidence_class,
    evidence_authority: evidence.evidence_authority,
    confidence: evidence.confidence,
    support_direction: evidence.support_direction,
    negative_admissibility: evidence.negative_admissibility,
    market: scoped(evidence.scope,'market'),
    region: scoped(evidence.scope,'region'),
    locale: scoped(evidence.scope,'locale'),
    valid_from: scoped(evidence.scope,'valid_from'),
    valid_to: scoped(evidence.scope,'valid_to'),
    qualifier: evidence.qualifier_context || {},
    canonical_evidence_digest: evidence.canonical_evidence_digest,
    supersedes_evidence_id: null,
  };
}

function confirmTemplate(fact, dependency) {
  return {
    assignment_id: '__HOSTED_ASSIGNMENT_ID__',
    subject_id: dependency.subject_id,
    registry_version: fact.registry_version,
    fact_key: fact.fact_key,
    proposition_key: fact.proposition_key,
    proposition_serializer_version: 'product-fact-proposition-pilot-v1',
    semantic_status: fact.semantic_status,
    value_type: fact.typed_columns.value_type,
    value_boolean: fact.typed_columns.value_boolean,
    value_enum: fact.typed_columns.value_enum,
    value_number: fact.typed_columns.value_number,
    value_unit: fact.typed_columns.value_unit,
    value_range_min: fact.typed_columns.value_range_min,
    value_range_max: fact.typed_columns.value_range_max,
    value_entity_identifier: fact.typed_columns.value_entity_identifier,
    market: scoped(fact.scope,'market'),
    region: scoped(fact.scope,'region'),
    locale: scoped(fact.scope,'locale'),
    valid_from: scoped(fact.scope,'valid_from'),
    valid_to: scoped(fact.scope,'valid_to'),
    qualifier: fact.qualifier_context || {},
    parent_fact_instance_id: dependency.parent_fact_instance_id,
    parent_proposition_key: fact.parent_proposition_key,
    authority_ceiling: fact.authority_ceiling,
    fused_confidence: fact.fused_confidence,
    fusion_policy_version: fact.fusion_policy_version,
    fusion_input_digest: '__HOSTED_RUNTIME_FUSION_INPUT_DIGEST__',
    supporting_evidence_ids: ['__HOSTED_EVIDENCE_ID__'],
    opposing_evidence_ids: [],
  };
}

function dependencyFor(fact,pilotId) {
  if (!fact.parent_proposition_key) return { kind:'none', subject_id:EXISTING_SUBJECT_AUTHORITY[pilotId].subject_id, parent_fact_instance_id:null };
  if (pilotId === 'T2' && fact.proposition_key === '7e3f44c47ef50a94953249bed4ae484b1a8ee7995fd05e1d497d07c6229763b2') {
    return { kind:'existing_hosted_parent', subject_id:EXISTING_SUBJECT_AUTHORITY.T2.subject_id, parent_proposition_key:EXISTING_SUBJECT_AUTHORITY.T2.existing_parent.proposition_key, parent_fact_instance_id:EXISTING_SUBJECT_AUTHORITY.T2.existing_parent.fact_instance_id };
  }
  if (pilotId === 'M2' && fact.proposition_key === '0f99e79e0ac8dea9709408ba2fc30926cdbc1531aecdb64efa1372120a50a7ee') {
    return { kind:'same_batch_parent', subject_id:EXISTING_SUBJECT_AUTHORITY.M2.subject_id, parent_proposition_key:'386ee490eb6db1028a882d61fe367d5ad9d44fb381c5a136b2ff92ab9d451446', parent_fact_instance_id:'__HOSTED_PARENT_FACT_INSTANCE_ID_FROM_BATCH__' };
  }
  throw new Error(`unresolved parent dependency ${pilotId}:${fact.proposition_key}`);
}

function executionComparator(a,b) {
  const pilot = stable(a.pilot_id,b.pilot_id);
  if (pilot) return pilot;
  const product = stable(a.product_id,b.product_id);
  if (product) return product;
  const aDepth = a.dependency.kind === 'same_batch_parent' ? 1 : 0;
  const bDepth = b.dependency.kind === 'same_batch_parent' ? 1 : 0;
  return aDepth-bDepth || stable(a.fact_key,b.fact_key) || stable(a.proposition_key,b.proposition_key);
}

export function buildBatch3Plan({ materialization, mapping, baseMainSha, inputHashes }) {
  if (materialization.summary?.input_products !== 12 || materialization.summary?.confirmation_eligible_facts !== 23) throw new Error('materialization authority mismatch');
  if (mapping.summary?.fused_fact_count !== 23) throw new Error('mapping supported total mismatch');
  const supported = materialization.fact_proposals.filter(f => f.semantic_status === 'supported' && f.confirmation_eligibility === 'eligible');
  if (supported.length !== 23) throw new Error(`supported set=${supported.length}`);
  const current = new Set(HOSTED_CURRENT_PROPOSITION_KEYS);
  const remaining = supported.filter(f => !current.has(f.proposition_key));
  const keys = remaining.map(f=>f.proposition_key).sort();
  if (stableJson(keys) !== stableJson(EXPECTED_REMAINING_KEYS)) throw new Error(`remaining supported set mismatch: ${stableJson(keys)}`);

  const subjectByPilot = indexBy(materialization.subjects,'pilot_id');
  const evidenceById = indexBy(materialization.evidence_records,'frozen_evidence_id');
  const sourceByRef = new Map(materialization.sources.map(x=>[x.source_ref,x]));
  const bindingByRef = new Map(materialization.source_subject_bindings.map(x=>[x.binding_ref,x]));
  const mappingByPilot = indexBy(mapping.products,'pilot_id');

  const selected = remaining.map(fact => {
    const pilotId = fact.pilot_id;
    const authority = EXISTING_SUBJECT_AUTHORITY[pilotId];
    if (!authority) throw new Error(`unexpected remaining pilot ${pilotId}`);
    const subject = subjectByPilot.get(pilotId);
    if (!subject || subject.identity_status !== 'resolved' || subject.proposed_subject_identity?.current_state !== 'current') throw new Error(`subject invalid ${pilotId}`);
    if (subject.catalog_product_id !== authority.product_id || subject.proposed_subject_identity.subject_semantic_key !== authority.subject_semantic_key) throw new Error(`Hosted subject authority mismatch ${pilotId}`);
    if (fact.supporting_evidence_refs?.length !== 1 || fact.opposing_evidence_refs?.length || fact.context_evidence_refs?.length) throw new Error(`evidence shape invalid ${pilotId}:${fact.proposition_key}`);
    if (fact.authority_ceiling !== 'product_specific_primary' || fact.fused_confidence !== 'high') throw new Error(`authority invalid ${pilotId}:${fact.proposition_key}`);
    const evidence = evidenceById.get(fact.supporting_evidence_refs[0]);
    const binding = evidence && bindingByRef.get(evidence.binding_ref);
    const source = binding && sourceByRef.get(binding.source_ref);
    if (!evidence || !binding || !source) throw new Error(`source chain missing ${pilotId}:${fact.proposition_key}`);
    if (evidence.materialization_eligibility !== 'eligible' || binding.evidence_admissibility !== 'eligible') throw new Error(`source chain blocked ${pilotId}:${fact.proposition_key}`);
    const dep = dependencyFor(fact,pilotId);
    const mapped = mappingByPilot.get(pilotId);
    return {
      pilot_id: pilotId,
      product_id: authority.product_id,
      product_name: subject.product_identity_input?.canonical_product_name ?? null,
      category: mapped?.domain ?? null,
      subject_id: authority.subject_id,
      subject_semantic_key: authority.subject_semantic_key,
      identity_status: 'resolved',
      current_state: 'current',
      formulation_revision_key: authority.formulation_revision_key,
      market_applicability: authority.market_applicability,
      fact_key: fact.fact_key,
      proposition_key: fact.proposition_key,
      typed_value: fact.typed_value,
      typed_columns: fact.typed_columns,
      semantic_status: fact.semantic_status,
      authority_ceiling: fact.authority_ceiling,
      fused_confidence: fact.fused_confidence,
      frozen_fact_instance_id: fact.frozen_fact_instance_id,
      frozen_evidence_ref: evidence.frozen_evidence_id,
      source_ref: source.source_ref,
      binding_ref: binding.binding_ref,
      source_identity: sourcePayload(source),
      hosted_source_reuse: { source_id: authority.existing_source_id, binding_id: authority.existing_binding_id, expected_reuse: true },
      binding_state: binding.binding_state,
      scope_relation: binding.scope_relation,
      evidence_class: evidence.evidence_class,
      evidence_digest: evidence.canonical_evidence_digest,
      evidence_payload: evidencePayload(evidence),
      dependency: dep,
      existing_hosted_state: 'subject_exists_current_fact_missing',
      planned_operation: 'reuse_subject_ingest_evidence_review_preflight_confirm_current',
      confirmation_template: confirmTemplate(fact,dep),
    };
  }).sort(executionComparator);

  const excluded = [
    { pilot_id:'M1', product_id:'4aa41038-de5b-4125-97b0-a50e7575cc00', reason:'source_blocked', detail:'mapped_facts=[]; frozen primary-source gap' },
    { pilot_id:'M3', product_id:'4cbd41f3-1357-42c6-a6c7-6df0e90d54a7', reason:'source_blocked', detail:'mapped_facts=[]; official-source gap' },
    { pilot_id:'P1', product_id:'d9e40ddb-b1e2-46e4-92db-82744227dfe3', reason:'source_blocked', detail:'mapped_facts=[]; physical-source gap' },
    { pilot_id:'P2', product_id:'38dc094e-4148-4566-a743-a09815265f44', reason:'identity_ambiguous', detail:'mapped_facts=[]; version lineage unresolved' },
    { pilot_id:'T3', reason:'reviewed_not_established', fact_key:'active_concentration' },
    { pilot_id:'T3', reason:'evidence_insufficient', fact_key:'hydration_change' },
    { pilot_id:'P3', reason:'reviewed_not_established', fact_key:'active_concentration', proposition_value_identity:'lactic_acid' },
    { pilot_id:'P3', reason:'reviewed_not_established', fact_key:'active_concentration', proposition_value_identity:'salicylic_acid' },
  ];

  const finalKeys = [...new Set([...HOSTED_CURRENT_PROPOSITION_KEYS,...keys])].sort();
  return {
    batch_version: BATCH_VERSION,
    batch_id: BATCH_ID,
    source_main_sha: baseMainSha,
    authority: { registry_version:REGISTRY_VERSION, frozen:FROZEN_AUTHORITY, input_hashes:inputHashes },
    hosted_prestate: { counts:HOSTED_PRESTATE_COUNTS, current_proposition_keys:HOSTED_CURRENT_PROPOSITION_KEYS, current_count:13, adopted_unique_products:8 },
    admin_actor: ADMIN_ACTOR,
    selection_algorithm: 'frozen_supported_confirmation_eligible_propositions MINUS hosted_current_proposition_keys',
    stable_execution_order: ['pilot_id ASC','product_id ASC','same-batch parent before child','fact_key ASC','proposition_key ASC'],
    summary: { frozen_supported_total:23, hosted_initial_current:13, remaining_supported:10, selected_products:4, new_subjects:0, new_unique_products:0, new_facts:10, new_current:10, expected_new_evidence:10, expected_new_sources:0, expected_new_bindings:0, expected_final_current:23, expected_adopted_unique_products:8 },
    selected_products: [...new Set(selected.map(x=>x.product_id))].sort(),
    selected_subjects: [...new Map(selected.map(x=>[x.subject_id,{pilot_id:x.pilot_id,product_id:x.product_id,subject_id:x.subject_id,subject_semantic_key:x.subject_semantic_key,identity_status:x.identity_status,current_state:x.current_state,formulation_revision_key:x.formulation_revision_key,market_applicability:x.market_applicability}])).values()].sort((a,b)=>stable(a.pilot_id,b.pilot_id)),
    selected_facts: selected,
    remaining_proposition_keys: keys,
    expected_final_frozen_supported_proposition_keys: finalKeys,
    excluded_candidates: excluded,
    batch_2_hosted_authority_correction: BATCH_2_HOSTED_AUTHORITY_CORRECTION,
    dependency_contract: {
      existing_parent: { child_proposition_key:'7e3f44c47ef50a94953249bed4ae484b1a8ee7995fd05e1d497d07c6229763b2', ...EXISTING_SUBJECT_AUTHORITY.T2.existing_parent },
      same_batch_parent: { parent_proposition_key:'386ee490eb6db1028a882d61fe367d5ad9d44fb381c5a136b2ff92ab9d451446', child_proposition_key:'0f99e79e0ac8dea9709408ba2fc30926cdbc1531aecdb64efa1372120a50a7ee' },
    },
    cardinality_many_contract: {
      T2: ['mandelic_acid','sodium_hyaluronate_crosspolymer'],
      T3: ['hyaluronic_acid','sodium_dna'],
      P3: ['lactic_acid','salicylic_acid'],
      collapse_forbidden: true,
    },
    lifecycle: { catalog_fully_adopted:false, decision_axis_production_calibrated:false, decision_axis_production_consumption:false, recommendation_scorer_changed:false, recommendation_activated:false, admin_product_fact_ui_operational:false },
  };
}

export function renderBatch3Markdown(plan) {
  const lines = [
    '# V2.1-8C — Frozen Pilot Supported-Fact Completion', '',
    `- Batch: \`${plan.batch_id}\``,
    `- Source main: \`${plan.source_main_sha}\``,
    `- Frozen supported confirmation-eligible: **${plan.summary.frozen_supported_total}**`,
    `- Hosted initial Current: **${plan.summary.hosted_initial_current}**`,
    `- Remaining supported set: **${plan.summary.remaining_supported}**`,
    `- New subjects: **${plan.summary.new_subjects}**`,
    `- Expected final Current: **${plan.summary.expected_final_current}**`, '',
    '## Remaining exact set', '',
    ...plan.selected_facts.map(f => `- ${f.pilot_id} / ${f.fact_key} / \`${f.proposition_key}\` / ${JSON.stringify(f.typed_value)} / dependency=${f.dependency.kind}`), '',
    '## Exclusions', '',
    ...plan.excluded_candidates.map(x => `- ${x.pilot_id}: ${x.reason}${x.fact_key ? ` / ${x.fact_key}` : ''}`), '',
    '## Batch 2 Hosted authority correction', '',
    'The rows below are read-only authority corrections. Historical Batch 2 artifacts and DB rows are not rewritten.', '',
    ...plan.batch_2_hosted_authority_correction.map(x => `- \`${x.proposition_key}\`: FI=\`${x.fact_instance_id}\`, confirmation=\`${x.confirmation_id}\`, evidence=\`${x.evidence_id}\`, source=\`${x.source_id}\`, binding=\`${x.binding_id}\``), '',
    '## Boundary', '',
    '- Frozen authority completion only; no new evidence research.',
    '- No Subject registration is planned.',
    '- No production Decision Axis consumption or recommendation activation.',
    '- Source-blocked / ambiguous / RNE / insufficient candidates remain unadopted.', '',
  ];
  return `${lines.join('\n')}\n`;
}
