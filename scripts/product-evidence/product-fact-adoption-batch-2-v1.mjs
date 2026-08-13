import crypto from 'node:crypto';

export const BATCH_VERSION = 'product-fact-adoption-batch-2-v1';
export const BATCH_ID = 'v21-8b-cross-category-batch-2';
export const REGISTRY_VERSION = 'product-fact-registry-cross-category-v1';
export const ADMIN_ACTOR = Object.freeze({
  user_id: 'e1a59349-fe13-43ff-86ce-078c2dce0d99',
  role: 'admin_owner',
  bootstrap_state: 'ALREADY_YES',
  required_capabilities: ['admin.products.review', 'admin.operations.execute'],
});
export const HOSTED_PRESTATE_DIGEST = 'f07c2814deda56a2f92ae9ba996cbf4741e1ab7c4aa7f5c1d4b7f570b60375fd';
export const HOSTED_PRESTATE_COUNTS = Object.freeze({
  product_fact_registry_versions: 1,
  product_fact_definition_snapshots: 20,
  product_fact_subjects: 5,
  product_evidence_sources: 5,
  product_evidence_source_subject_bindings: 5,
  product_evidence_records: 8,
  product_fact_instances: 8,
  product_fact_evidence_links: 8,
  product_fact_review_assignments: 8,
  product_fact_review_events: 37,
  product_fact_confirmations: 8,
  product_fact_current: 8,
});

export const EXISTING_ADOPTED_PRODUCT_IDS = new Set([
  '0b88019a-9eb2-4be9-842d-f1e60e42cf51',
  '230f1c9c-cbf8-4458-aaac-ea1010a21e8c',
  '24a339bf-f380-493f-88b5-68e6be887c30',
  'c67266dd-3706-4929-9196-936d1f61cbc5',
  'cbcd06a2-de29-47ca-afd1-ab1d5de93903',
]);

export const EXISTING_CURRENT_PROPOSITION_KEYS = new Set([
  '1130020852b0028698d62c01046ce25430db8f4869b43191ae0ff02fc93f14d4',
  'b6f1424d1fef32965ec9b1d58d160f8d6b288ce5dcaf7d00fd478fc005eef098',
  'ca47a8163253401226cf60b5c790f80385605be5f4332e04ae4850e1c7f3163e',
  'caece34a8bcfd3e93a776bf84934dda10ad4bb33ad4706b4cca6db039032bc30',
  '5bd530c0b48f73553f935695d2254d415476b66539a88624c7e4e1d581c8f777',
  '7447a2176f490ae2db3bdb9078622b7a6f1150bbd7cb8b75016ac04582182b80',
  'ade30ee97c27c1bbd5280d0f671c7afae768d62386751798b73f334272d20b17',
  'a00cae7249ea6472f31d6a7bf5e0e0ffec90f2dd8c241bbda78bd5b0239d8742',
]);

export const BATCH_1_FACT_FAMILIES = new Set([
  'spf_value',
  'uva_label',
  'primary_use_role',
  'barrier_support_claim',
  'contains_active',
  'product_format',
]);

export const EXCLUSION_REASONS = Object.freeze([
  'already_adopted',
  'identity_ambiguous',
  'variant_ambiguous',
  'formulation_ambiguous',
  'authority_below_batch_threshold',
  'semantic_status_not_supported',
  'evidence_insufficient',
  'reviewed_not_established',
  'evidence_conflict',
  'parent_fact_missing',
  'batch_budget_exceeded',
  'lower_priority_than_selected',
  'not_required_for_batch_2',
]);

const LIMITS = Object.freeze({ products: 4, subjects: 4, facts: 8, current: 8, evidence: 10 });
const stable = (a, b) => String(a).localeCompare(String(b));
export const stableJson = (value) => `${JSON.stringify(value, null, 2)}\n`;
export const sha256Text = (value) => crypto.createHash('sha256').update(value).digest('hex');
export const sha256JsonBytes = (text) => sha256Text(text);

const by = (rows, field) => new Map(rows.map((row) => [row[field], row]));
const scopedValue = (scope, key) => scope?.[key] ?? null;

function subjectEligible(subject) {
  return subject
    && subject.identity_status === 'resolved'
    && subject.materialization_eligibility === 'eligible'
    && subject.current_creation_eligibility === true
    && subject.confirmation_eligibility === true
    && subject.proposed_subject_identity?.current_state === 'current';
}

function evidenceEligible(evidence, binding) {
  return evidence
    && evidence.materialization_eligibility === 'eligible'
    && evidence.evidence_authority === 'product_specific_primary'
    && evidence.confidence === 'high'
    && evidence.support_direction === 'supports'
    && evidence.negative_admissibility === 'not_applicable'
    && binding
    && binding.evidence_admissibility === 'eligible'
    && ['exact_subject_match', 'equivalent_presentation_match'].includes(binding.binding_state)
    && ['equivalent', 'narrower'].includes(binding.scope_relation);
}

function baseFactEligible(fact, evidenceById, bindingByRef) {
  if (fact.confirmation_eligibility !== 'eligible'
    || fact.semantic_status !== 'supported'
    || fact.authority_ceiling !== 'product_specific_primary'
    || fact.fused_confidence !== 'high'
    || fact.opposing_evidence_refs?.length
    || fact.context_evidence_refs?.length
    || fact.supporting_evidence_refs?.length !== 1
    || EXISTING_CURRENT_PROPOSITION_KEYS.has(fact.proposition_key)) return false;
  const evidence = evidenceById.get(fact.supporting_evidence_refs[0]);
  return evidenceEligible(evidence, evidence ? bindingByRef.get(evidence.binding_ref) : null);
}

function dependencyClosure(facts, evidenceById, bindingByRef) {
  const eligible = facts.filter((fact) => baseFactEligible(fact, evidenceById, bindingByRef));
  const byFrozenFactId = new Map(eligible.map((fact) => [fact.frozen_fact_instance_id, fact]));
  const byProp = new Map(eligible.map((fact) => [fact.proposition_key, fact]));
  return eligible.filter((fact) => {
    if (!fact.parent_proposition_key && !fact.frozen_parent_fact_instance_id) return true;
    const parent = fact.frozen_parent_fact_instance_id
      ? byFrozenFactId.get(fact.frozen_parent_fact_instance_id)
      : byProp.get(fact.parent_proposition_key);
    return !!parent && parent.proposition_key === fact.parent_proposition_key;
  });
}

function dependencyOrder(a, b) {
  const aChild = a.parent_proposition_key ? 1 : 0;
  const bChild = b.parent_proposition_key ? 1 : 0;
  return aChild - bChild || stable(a.fact_key, b.fact_key) || stable(a.proposition_key, b.proposition_key);
}

function productComparator(a, b) {
  return b.newFactFamilyCount - a.newFactFamilyCount
    || b.eligibleFactCount - a.eligibleFactCount
    || stable(a.pilotId, b.pilotId)
    || stable(a.productId, b.productId);
}

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

function bindingPayload(binding) {
  return {
    product_id: binding.catalog_product_id,
    subject_id: '__HOSTED_SUBJECT_ID__',
    binding_state: binding.binding_state,
    scope_relation: binding.scope_relation,
    presentation_metadata: binding.presentation_metadata,
    identity_resolution_version: binding.identity_resolution_version,
    reviewed_at: binding.reviewed_at,
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
    market: scopedValue(evidence.scope, 'market'),
    region: scopedValue(evidence.scope, 'region'),
    locale: scopedValue(evidence.scope, 'locale'),
    valid_from: scopedValue(evidence.scope, 'valid_from'),
    valid_to: scopedValue(evidence.scope, 'valid_to'),
    qualifier: evidence.qualifier_context || {},
    canonical_evidence_digest: evidence.canonical_evidence_digest,
    supersedes_evidence_id: null,
  };
}

function confirmationTemplate(fact) {
  return {
    assignment_id: '__HOSTED_ASSIGNMENT_ID__',
    subject_id: '__HOSTED_SUBJECT_ID__',
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
    market: scopedValue(fact.scope, 'market'),
    region: scopedValue(fact.scope, 'region'),
    locale: scopedValue(fact.scope, 'locale'),
    valid_from: scopedValue(fact.scope, 'valid_from'),
    valid_to: scopedValue(fact.scope, 'valid_to'),
    qualifier: fact.qualifier_context || {},
    parent_fact_instance_id: fact.parent_proposition_key ? '__HOSTED_PARENT_FACT_INSTANCE_ID__' : null,
    parent_proposition_key: fact.parent_proposition_key,
    authority_ceiling: fact.authority_ceiling,
    fused_confidence: fact.fused_confidence,
    fusion_policy_version: fact.fusion_policy_version,
    fusion_input_digest: '__HOSTED_RUNTIME_FUSION_INPUT_DIGEST__',
    supporting_evidence_ids: ['__HOSTED_EVIDENCE_ID__'],
    opposing_evidence_ids: [],
  };
}

function enumReasonForFact(fact) {
  if (EXISTING_CURRENT_PROPOSITION_KEYS.has(fact.proposition_key)) return 'already_adopted';
  if (fact.semantic_status === 'reviewed_not_established') return 'reviewed_not_established';
  if (fact.semantic_status === 'evidence_insufficient') return 'evidence_insufficient';
  if (fact.semantic_status === 'evidence_conflict') return 'evidence_conflict';
  if (fact.semantic_status !== 'supported') return 'semantic_status_not_supported';
  if (fact.parent_proposition_key || fact.frozen_parent_fact_instance_id) return 'parent_fact_missing';
  if (fact.authority_ceiling !== 'product_specific_primary' || fact.fused_confidence !== 'high') return 'authority_below_batch_threshold';
  return 'not_required_for_batch_2';
}

export function buildBatch2Plan({ materialization, fusion, decisionAxis, shadow, batch1, baseMainSha, inputHashes }) {
  if (materialization.summary?.input_products !== 12 || materialization.summary?.confirmation_eligible_facts !== 23) throw new Error('V2.1-2 authority summary mismatch');
  if (fusion.lifecycle?.RECOMMENDATION_ACTIVATED !== false) throw new Error('V2.1-4 lifecycle mismatch');
  if (decisionAxis.lifecycle?.HOSTED_PRODUCT_FACT_WRITES !== 0 || decisionAxis.axis_contract?.numeric_estimate_calibrated !== false) throw new Error('V2.1-6 lifecycle mismatch');
  if (shadow.lifecycle?.OFFLINE_SHADOW_CONSUMPTION !== true || shadow.lifecycle?.DECISION_AXIS_PRODUCTION_CONSUMPTION !== false) throw new Error('V2.1-7 lifecycle mismatch');
  if (batch1.lifecycle?.RECOMMENDATION_ACTIVATED !== false || batch1.summary?.new_facts !== 6) throw new Error('V2.1-8A authority mismatch');

  const subjectByPilot = by(materialization.subjects, 'pilot_id');
  const sourceByRef = new Map(materialization.sources.map((row) => [row.source_ref, row]));
  const bindingByRef = new Map(materialization.source_subject_bindings.map((row) => [row.binding_ref, row]));
  const evidenceById = by(materialization.evidence_records, 'frozen_evidence_id');
  const axisByPilot = new Map(decisionAxis.products.map((row) => [row.pilot_id, row]));
  const factsByPilot = new Map();
  for (const fact of materialization.fact_proposals) {
    if (!factsByPilot.has(fact.pilot_id)) factsByPilot.set(fact.pilot_id, []);
    factsByPilot.get(fact.pilot_id).push(fact);
  }

  const excludedProducts = [];
  const candidates = [];
  for (const [pilotId, axisProduct] of [...axisByPilot].sort(([a],[b]) => stable(a,b))) {
    const subject = subjectByPilot.get(pilotId);
    const productId = axisProduct.product_id;
    if (EXISTING_ADOPTED_PRODUCT_IDS.has(productId)) {
      excludedProducts.push({ pilot_id: pilotId, product_id: productId, reason: 'already_adopted', detail: 'existing Hosted Current product before Batch 2' });
      continue;
    }
    if (!subjectEligible(subject)) {
      const reason = subject?.identity_status === 'ambiguous' ? 'identity_ambiguous' : 'not_required_for_batch_2';
      excludedProducts.push({ pilot_id: pilotId, product_id: productId, reason, detail: subject?.block_reason || `identity_status=${subject?.identity_status || 'missing'}` });
      continue;
    }
    const eligibleFacts = dependencyClosure(factsByPilot.get(pilotId) || [], evidenceById, bindingByRef).sort(dependencyOrder);
    if (!eligibleFacts.length) {
      excludedProducts.push({ pilot_id: pilotId, product_id: productId, reason: 'authority_below_batch_threshold', detail: 'no supported high-confidence product-specific-primary Fact with admissible exact/equivalent Evidence' });
      continue;
    }
    const newFactFamilyCount = new Set(eligibleFacts.filter((f) => !BATCH_1_FACT_FAMILIES.has(f.fact_key)).map((f) => f.fact_key)).size;
    candidates.push({ pilotId, productId, axisProduct, subject, eligibleFacts, eligibleFactCount: eligibleFacts.length, newFactFamilyCount });
  }

  candidates.sort(productComparator);
  const chosen = [];
  let factBudget = 0;
  for (const candidate of candidates) {
    if (chosen.length >= LIMITS.products || factBudget + candidate.eligibleFacts.length > LIMITS.facts) {
      excludedProducts.push({ pilot_id: candidate.pilotId, product_id: candidate.productId, reason: 'batch_budget_exceeded', detail: `eligible_facts=${candidate.eligibleFacts.length}` });
      continue;
    }
    chosen.push(candidate);
    factBudget += candidate.eligibleFacts.length;
  }

  // Execution order is independent of score order and stable across runtimes.
  chosen.sort((a,b) => stable(a.pilotId,b.pilotId) || stable(a.productId,b.productId));

  const selectedProducts = chosen.map((candidate) => {
    const facts = candidate.eligibleFacts.map((fact) => {
      const evidence = evidenceById.get(fact.supporting_evidence_refs[0]);
      const binding = bindingByRef.get(evidence.binding_ref);
      const source = sourceByRef.get(evidence.source_ref);
      if (!source) throw new Error(`source missing for ${fact.proposition_key}`);
      return {
        proposal_ref: fact.proposal_ref,
        pilot_id: candidate.pilotId,
        product_id: candidate.productId,
        fact_key: fact.fact_key,
        typed_value: fact.typed_value,
        semantic_status: fact.semantic_status,
        authority_ceiling: fact.authority_ceiling,
        fused_confidence: fact.fused_confidence,
        source_ref: evidence.source_ref,
        binding_ref: evidence.binding_ref,
        evidence_ref: evidence.evidence_ref,
        canonical_evidence_digest: evidence.canonical_evidence_digest,
        offline_fusion_input_digest: fact.fusion_input_digest,
        expected_proposition_key: fact.proposition_key,
        parent_dependency: fact.parent_proposition_key ? {
          required: true,
          frozen_parent_fact_instance_id: fact.frozen_parent_fact_instance_id,
          parent_proposition_key: fact.parent_proposition_key,
          execution_rule: 'confirm_parent_first_then_bind_hosted_parent_fact_instance_id',
        } : { required: false, frozen_parent_fact_instance_id: null, parent_proposition_key: null, execution_rule: null },
        existing_hosted_state: 'absent_before_batch_2',
        planned_operation: 'controlled_rpc_confirm_to_current',
        rpc_materialization: {
          source: sourcePayload(source),
          binding: bindingPayload(binding),
          evidence: evidencePayload(evidence),
          confirmation_template: confirmationTemplate(fact),
        },
      };
    });
    return {
      pilot_id: candidate.pilotId,
      product_id: candidate.productId,
      brand: candidate.axisProduct.brand,
      name: candidate.axisProduct.name,
      category: candidate.axisProduct.domain,
      subject_semantic_key: candidate.subject.proposed_subject_identity.subject_semantic_key,
      identity_status: candidate.subject.identity_status,
      current_state: candidate.subject.proposed_subject_identity.current_state,
      subject_payload: candidate.subject.proposed_subject_identity,
      selection_score: {
        new_fact_family_count_desc: candidate.newFactFamilyCount,
        eligible_fact_count_desc: candidate.eligibleFactCount,
        stable_pilot_id: candidate.pilotId,
        stable_product_id: candidate.productId,
      },
      facts,
    };
  });

  const selectedFacts = selectedProducts.flatMap((p) => p.facts);
  const selectedKeys = new Set(selectedFacts.map((f) => f.expected_proposition_key));
  const selectedPilots = new Set(selectedProducts.map((p) => p.pilot_id));
  const excludedFacts = materialization.fact_proposals
    .filter((fact) => !selectedKeys.has(fact.proposition_key))
    .map((fact) => {
      let reason;
      if (EXISTING_ADOPTED_PRODUCT_IDS.has(axisByPilot.get(fact.pilot_id)?.product_id)) reason = 'already_adopted';
      else if (subjectByPilot.get(fact.pilot_id)?.identity_status === 'ambiguous') reason = 'identity_ambiguous';
      else if (!selectedPilots.has(fact.pilot_id)) reason = enumReasonForFact(fact) === 'not_required_for_batch_2' ? 'lower_priority_than_selected' : enumReasonForFact(fact);
      else reason = enumReasonForFact(fact);
      return { proposal_ref: fact.proposal_ref, pilot_id: fact.pilot_id, fact_key: fact.fact_key, proposition_key: fact.proposition_key, semantic_status: fact.semantic_status, reason };
    })
    .sort((a,b) => stable(a.pilot_id,b.pilot_id) || stable(a.fact_key,b.fact_key) || stable(a.proposition_key,b.proposition_key));

  excludedProducts.sort((a,b) => stable(a.pilot_id,b.pilot_id) || stable(a.product_id,b.product_id));
  for (const row of [...excludedProducts, ...excludedFacts]) {
    if (!EXCLUSION_REASONS.includes(row.reason)) throw new Error(`unknown exclusion reason ${row.reason}`);
  }

  const uniqueSources = new Set(selectedFacts.map((f) => f.source_ref));
  const uniqueBindings = new Set(selectedFacts.map((f) => f.binding_ref));
  const expectedWrites = {
    product_fact_registry_versions: 0,
    product_fact_definition_snapshots: 0,
    product_fact_subjects: selectedProducts.length,
    product_evidence_sources: uniqueSources.size,
    product_evidence_source_subject_bindings: uniqueBindings.size,
    product_evidence_records: selectedFacts.length,
    product_fact_instances: selectedFacts.length,
    product_fact_evidence_links: selectedFacts.length,
    product_fact_review_assignments: selectedFacts.length,
    product_fact_review_events: selectedProducts.length + selectedFacts.length + (selectedFacts.length * 3),
    product_fact_confirmations: selectedFacts.length,
    product_fact_current: selectedFacts.length,
  };

  const finalCounts = Object.fromEntries(Object.entries(HOSTED_PRESTATE_COUNTS).map(([key,value]) => [key, value + (expectedWrites[key] || 0)]));
  const finalCurrentPropositionKeys = [...EXISTING_CURRENT_PROPOSITION_KEYS, ...selectedKeys].sort(stable);
  const batchLimitValid = selectedProducts.length <= LIMITS.products
    && selectedProducts.length <= LIMITS.subjects
    && selectedFacts.length <= LIMITS.facts
    && selectedFacts.length <= LIMITS.current
    && selectedFacts.length <= LIMITS.evidence;

  const plan = {
    version: BATCH_VERSION,
    stage: 'V2.1-8B_CONTROLLED_HOSTED_PRODUCT_FACT_ADOPTION_BATCH_2',
    batch_id: BATCH_ID,
    authority: {
      source_main_sha: baseMainSha,
      registry_version: REGISTRY_VERSION,
      materialization_sha256: inputHashes.materialization,
      fusion_sha256: inputHashes.fusion,
      cross_category_axis_sha256: inputHashes.decisionAxis,
      shadow_sha256: inputHashes.shadow,
      batch_1_sha256: inputHashes.batch1,
      frozen_corpus_sha256: '47457c0242451a35305fd8eceba0ebb7e210eb9ee2e73134ccf41696d18e517d',
      mapping_sha256: 'c746c5d02f654ed7f0a8e8385611ac65ca30b9c4648fa4c6454ac863e7c9314f',
      gap_sha256: '5a4580d76cca62d90a3ac306744054c507a6d5e45b0b91a41dffb3b754980215',
      hosted_prestate_digest: HOSTED_PRESTATE_DIGEST,
    },
    admin_actor: ADMIN_ACTOR,
    selection_policy: {
      candidate_source: 'frozen_cross_category_pilot_only',
      required: ['resolved_identity','current_subject','eligible_binding','supported','product_specific_primary','high_confidence','dependency_closed'],
      priority: ['new_fact_family_count_desc','eligible_fact_count_desc','pilot_id_asc','product_id_asc'],
      final_execution_order: ['pilot_id_asc','product_id_asc','parent_before_child','fact_key_asc','proposition_key_asc'],
      authority_over_diversity: true,
      random_selection: false,
      limits: LIMITS,
    },
    hosted_prestate: {
      digest: HOSTED_PRESTATE_DIGEST,
      counts: HOSTED_PRESTATE_COUNTS,
      current_proposition_keys: [...EXISTING_CURRENT_PROPOSITION_KEYS].sort(stable),
      adopted_product_count: EXISTING_ADOPTED_PRODUCT_IDS.size,
      current_fact_count: EXISTING_CURRENT_PROPOSITION_KEYS.size,
      canonical_admin_owner_already_provisioned: true,
    },
    selected_products: selectedProducts,
    selected_subjects: selectedProducts.map((p) => ({ pilot_id:p.pilot_id, product_id:p.product_id, subject_semantic_key:p.subject_semantic_key, identity_status:p.identity_status, current_state:p.current_state })),
    selected_facts: selectedFacts,
    excluded_products: excludedProducts,
    excluded_facts: excludedFacts,
    parent_dependency_decisions: selectedFacts.filter((f) => f.parent_dependency.required).map((f) => ({ pilot_id:f.pilot_id, fact_key:f.fact_key, proposition_key:f.expected_proposition_key, ...f.parent_dependency })),
    coverage: {
      categories: [...new Set(selectedProducts.map((p) => p.category))].sort(stable),
      fact_families: [...new Set(selectedFacts.map((f) => f.fact_key))].sort(stable),
      new_vs_batch_1_fact_families: [...new Set(selectedFacts.filter((f) => !BATCH_1_FACT_FAMILIES.has(f.fact_key)).map((f) => f.fact_key))].sort(stable),
    },
    expected_writes: expectedWrites,
    expected_final_hosted: {
      counts: finalCounts,
      current_proposition_keys: finalCurrentPropositionKeys,
      unique_adopted_product_count: EXISTING_ADOPTED_PRODUCT_IDS.size + selectedProducts.length,
      current_fact_count: EXISTING_CURRENT_PROPOSITION_KEYS.size + selectedFacts.length,
      unexpected_current_count: 0,
    },
    summary: {
      new_products: selectedProducts.length,
      new_subjects: selectedProducts.length,
      new_facts: selectedFacts.length,
      new_current_pointers: selectedFacts.length,
      new_evidence_records: selectedFacts.length,
      unique_sources: uniqueSources.size,
      unique_bindings: uniqueBindings.size,
      batch_limit_valid: batchLimitValid,
    },
    execution_contract: {
      repository_authority_before_hosted_write: true,
      registry_republish: false,
      controlled_rpc_only: true,
      direct_product_fact_table_write: false,
      preflight_before_each_confirm: true,
      preflight_zero_write_required: true,
      stale_prestate_negative_minimum: 1,
      confirm_exact_retry_required: true,
      existing_current_mutation_allowed: false,
      legacy_scalar_sync: false,
      migration_count: 0,
      ddl_count: 0,
    },
    lifecycle: {
      PRODUCT_FACT_PARTIAL_CATALOG_ADOPTION_PLANNED: true,
      PRODUCT_FACT_ADOPTION_BATCH_2_COMPLETE: false,
      CATALOG_FULLY_ADOPTED: false,
      PRODUCT_DECISION_AXIS_PRODUCTION_CALIBRATED: false,
      DECISION_AXIS_PRODUCTION_CONSUMPTION: false,
      RECOMMENDATION_SCORER_CHANGED: false,
      RECOMMENDATION_ACTIVATED: false,
      ADMIN_PRODUCT_FACT_UI_OPERATIONAL: false,
      HOSTED_WRITES_EXECUTED_BY_THIS_ARTIFACT_BUILD: 0,
    },
  };
  if (!batchLimitValid) throw new Error('Batch 2 limit exceeded');
  return plan;
}
