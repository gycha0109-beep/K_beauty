import crypto from 'node:crypto';

export const BATCH_VERSION = 'product-fact-adoption-batch-1-v1';
export const REGISTRY_VERSION = 'product-fact-registry-cross-category-v1';
export const KNOWN_HOSTED_PRODUCT_IDS = new Set([
  '0b88019a-9eb2-4be9-842d-f1e60e42cf51',
  '230f1c9c-cbf8-4458-aaac-ea1010a21e8c',
]);
export const KNOWN_HOSTED_PROPOSITION_KEYS = new Set([
  '1130020852b0028698d62c01046ce25430db8f4869b43191ae0ff02fc93f14d4',
  'b6f1424d1fef32965ec9b1d58d160f8d6b288ce5dcaf7d00fd478fc005eef098',
]);

const DOMAIN_POLICIES = [
  { domain: 'sunscreen', mode: 'keys', keys: ['spf_value', 'uva_label'] },
  { domain: 'moisturizer_family', mode: 'keys', keys: ['primary_use_role', 'barrier_support_claim'] },
  { domain: 'treatment', mode: 'many', key: 'contains_active', count: 2 },
];

const stable = (a, b) => String(a).localeCompare(String(b));
const sha256Text = (value) => crypto.createHash('sha256').update(value).digest('hex');
export const sha256JsonBytes = (text) => sha256Text(text);
export const stableJson = (value) => `${JSON.stringify(value, null, 2)}\n`;

function byFrozenId(rows, field) {
  return new Map(rows.map((row) => [row[field], row]));
}

function scopedValue(scope, key) {
  const v = scope?.[key];
  return v == null ? null : v;
}

function selectedEvidenceIsSimple(evidence, binding) {
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

function simpleFact(fact, evidenceById, bindingByRef) {
  if (fact.confirmation_eligibility !== 'eligible'
    || fact.semantic_status !== 'supported'
    || fact.authority_ceiling !== 'product_specific_primary'
    || fact.fused_confidence !== 'high'
    || fact.parent_proposition_key !== null
    || fact.frozen_parent_fact_instance_id !== null
    || fact.opposing_evidence_refs?.length
    || fact.context_evidence_refs?.length
    || fact.supporting_evidence_refs?.length !== 1
    || KNOWN_HOSTED_PROPOSITION_KEYS.has(fact.proposition_key)) return false;
  const evidence = evidenceById.get(fact.supporting_evidence_refs[0]);
  const binding = evidence ? bindingByRef.get(evidence.binding_ref) : null;
  return selectedEvidenceIsSimple(evidence, binding);
}

function factSelectionForPolicy(facts, policy) {
  const sorted = [...facts].sort((a, b) => stable(a.fact_key, b.fact_key) || stable(a.proposition_key, b.proposition_key));
  if (policy.mode === 'keys') {
    const selected = [];
    for (const key of policy.keys) {
      const found = sorted.find((fact) => fact.fact_key === key);
      if (!found) return null;
      selected.push(found);
    }
    return selected;
  }
  const matching = sorted.filter((fact) => fact.fact_key === policy.key);
  return matching.length >= policy.count ? matching.slice(0, policy.count) : null;
}

function exclusionReason(fact, selectedKeys, selectedPilotIds, evidenceById, bindingByRef) {
  if (KNOWN_HOSTED_PROPOSITION_KEYS.has(fact.proposition_key)) return 'already_hosted_v21_3';
  if (fact.confirmation_eligibility !== 'eligible') return `confirmation_${fact.confirmation_eligibility || 'blocked'}:${fact.block_reason || 'unspecified'}`;
  if (fact.semantic_status !== 'supported') return `semantic_status:${fact.semantic_status}`;
  if (fact.authority_ceiling !== 'product_specific_primary') return `authority:${fact.authority_ceiling}`;
  if (fact.fused_confidence !== 'high') return `confidence:${fact.fused_confidence}`;
  if (fact.parent_proposition_key !== null || fact.frozen_parent_fact_instance_id !== null) return 'parent_dependency_deferred';
  if (fact.opposing_evidence_refs?.length) return 'opposing_evidence_deferred';
  if (fact.context_evidence_refs?.length) return 'context_evidence_deferred';
  if (fact.supporting_evidence_refs?.length !== 1) return 'non_simple_support_set';
  const evidence = evidenceById.get(fact.supporting_evidence_refs?.[0]);
  const binding = evidence ? bindingByRef.get(evidence.binding_ref) : null;
  if (!selectedEvidenceIsSimple(evidence, binding)) return 'source_or_binding_not_simple_primary';
  if (!selectedPilotIds.has(fact.pilot_id)) return 'product_not_selected_batch_1';
  if (!selectedKeys.has(fact.proposition_key)) return 'fact_not_selected_by_domain_policy';
  return 'selected';
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
    parent_fact_instance_id: null,
    parent_proposition_key: null,
    authority_ceiling: fact.authority_ceiling,
    fused_confidence: fact.fused_confidence,
    fusion_policy_version: fact.fusion_policy_version,
    fusion_input_digest: '__HOSTED_RUNTIME_FUSION_INPUT_DIGEST__',
    supporting_evidence_ids: ['__HOSTED_EVIDENCE_ID__'],
    opposing_evidence_ids: [],
  };
}

export function buildBatchPlan({ materialization, fusion, decisionAxis, shadow, baseMainSha, inputHashes }) {
  if (materialization.summary?.input_products !== 12 || materialization.summary?.confirmation_eligible_facts !== 23) throw new Error('V2.1-2 authority summary mismatch');
  if (decisionAxis.lifecycle?.HOSTED_PRODUCT_FACT_WRITES !== 0 || decisionAxis.axis_contract?.numeric_estimate_calibrated !== false) throw new Error('V2.1-6 lifecycle mismatch');
  if (shadow.lifecycle?.OFFLINE_SHADOW_CONSUMPTION !== true || shadow.lifecycle?.DECISION_AXIS_PRODUCTION_CONSUMPTION !== false) throw new Error('V2.1-7 lifecycle mismatch');
  if (fusion.lifecycle?.RECOMMENDATION_ACTIVATED !== false) throw new Error('V2.1-4 lifecycle mismatch');

  const subjectByPilot = byFrozenId(materialization.subjects, 'pilot_id');
  const sourceByRef = new Map(materialization.sources.map((row) => [row.source_ref, row]));
  const bindingByRef = new Map(materialization.source_subject_bindings.map((row) => [row.binding_ref, row]));
  const evidenceById = byFrozenId(materialization.evidence_records, 'frozen_evidence_id');
  const domainByPilot = new Map(decisionAxis.products.map((row) => [row.pilot_id, row]));
  const factsByPilot = new Map();
  for (const fact of materialization.fact_proposals) {
    if (!factsByPilot.has(fact.pilot_id)) factsByPilot.set(fact.pilot_id, []);
    factsByPilot.get(fact.pilot_id).push(fact);
  }

  const selected = [];
  for (const policy of DOMAIN_POLICIES) {
    const candidates = [];
    for (const [pilotId, axisProduct] of domainByPilot) {
      if (axisProduct.domain !== policy.domain || KNOWN_HOSTED_PRODUCT_IDS.has(axisProduct.product_id)) continue;
      const subject = subjectByPilot.get(pilotId);
      if (!subject || subject.identity_status !== 'resolved' || subject.materialization_eligibility !== 'eligible'
        || subject.current_creation_eligibility !== true || subject.confirmation_eligibility !== true
        || subject.proposed_subject_identity?.current_state !== 'current') continue;
      const simple = (factsByPilot.get(pilotId) || []).filter((fact) => simpleFact(fact, evidenceById, bindingByRef));
      const chosenFacts = factSelectionForPolicy(simple, policy);
      if (!chosenFacts) continue;
      const blockedBindingCount = materialization.source_subject_bindings.filter((b) => b.pilot_id === pilotId && b.evidence_admissibility !== 'eligible').length;
      const blockedEvidenceCount = materialization.evidence_records.filter((e) => e.pilot_id === pilotId && e.materialization_eligibility !== 'eligible').length;
      candidates.push({ pilotId, axisProduct, subject, chosenFacts, blockedBindingCount, blockedEvidenceCount });
    }
    candidates.sort((a, b) => a.blockedBindingCount - b.blockedBindingCount
      || a.blockedEvidenceCount - b.blockedEvidenceCount
      || stable(a.pilotId, b.pilotId));
    if (!candidates.length) throw new Error(`no safe Batch 1 candidate for ${policy.domain}`);
    selected.push(candidates[0]);
  }

  const selectedProducts = selected.map((candidate) => {
    const factRecords = candidate.chosenFacts.map((fact) => {
      const evidence = evidenceById.get(fact.supporting_evidence_refs[0]);
      const binding = bindingByRef.get(evidence.binding_ref);
      const source = sourceByRef.get(evidence.source_ref);
      if (!source) throw new Error(`source missing for ${fact.proposition_key}`);
      return {
        proposal_ref: fact.proposal_ref,
        product_id: candidate.axisProduct.product_id,
        pilot_id: candidate.pilotId,
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
        already_hosted: false,
        adoption_action: 'controlled_rpc_confirm_to_current',
        lineage: {
          subject_semantic_key: candidate.subject.proposed_subject_identity.subject_semantic_key,
          evidence_ref: evidence.evidence_ref,
          source_ref: evidence.source_ref,
          provenance_container: source.source_metadata?.provenance_container || null,
        },
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
      product_id: candidate.axisProduct.product_id,
      brand: candidate.axisProduct.brand,
      name: candidate.axisProduct.name,
      domain: candidate.axisProduct.domain,
      subject_semantic_key: candidate.subject.proposed_subject_identity.subject_semantic_key,
      identity_status: candidate.subject.identity_status,
      current_state: candidate.subject.proposed_subject_identity.current_state,
      market: candidate.subject.product_identity_input.selected_market,
      selection_metrics: {
        blocked_binding_count: candidate.blockedBindingCount,
        blocked_evidence_count: candidate.blockedEvidenceCount,
      },
      subject_payload: candidate.subject.proposed_subject_identity,
      facts: factRecords,
    };
  });

  const selectedKeys = new Set(selectedProducts.flatMap((p) => p.facts.map((f) => f.expected_proposition_key)));
  const selectedPilotIds = new Set(selectedProducts.map((p) => p.pilot_id));
  const excluded = materialization.fact_proposals
    .map((fact) => ({
      proposal_ref: fact.proposal_ref,
      pilot_id: fact.pilot_id,
      fact_key: fact.fact_key,
      proposition_key: fact.proposition_key,
      semantic_status: fact.semantic_status,
      reason: exclusionReason(fact, selectedKeys, selectedPilotIds, evidenceById, bindingByRef),
    }))
    .filter((row) => row.reason !== 'selected')
    .sort((a, b) => stable(a.pilot_id, b.pilot_id) || stable(a.fact_key, b.fact_key) || stable(a.proposition_key, b.proposition_key));

  const selectedFacts = selectedProducts.flatMap((p) => p.facts);
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

  const plan = {
    version: BATCH_VERSION,
    stage: 'V2.1-8A_CONTROLLED_HOSTED_PRODUCT_FACT_ADOPTION_BATCH_1',
    batch_id: 'v21-8a-cross-category-batch-1',
    authority: {
      base_main_sha: baseMainSha,
      registry_version: REGISTRY_VERSION,
      registry_blob: materialization.input_freeze.registry.git_blob,
      materialization_sha256: inputHashes.materialization,
      fusion_sha256: inputHashes.fusion,
      cleanser_axis_sha256: decisionAxis.authority.cleanser_axis_sha256,
      cross_category_axis_sha256: inputHashes.decisionAxis,
      shadow_sha256: inputHashes.shadow,
      frozen_corpus_sha256: materialization.input_freeze.corpus.sha256,
      mapping_sha256: materialization.input_freeze.mapping.sha256,
      gap_sha256: materialization.input_freeze.gap_report.sha256,
      legacy_recommendation_reference: '783afb91a964f5d762f46846f9ef854902b48e95',
      hosted_prestate_contract: 'V2.1-3 exact two-Current readback required before execution',
    },
    selection_policy: {
      source: 'frozen_cross_category_pilot_only',
      domain_order: DOMAIN_POLICIES.map((p) => p.domain),
      product_requirements: ['resolved_identity','current_subject','materialization_eligible','confirmation_eligible','not_already_hosted'],
      fact_requirements: ['supported','product_specific_primary','high_confidence','root_fact','single_supporting_evidence','eligible_exact_or_equivalent_binding','no_opposition','no_context'],
      domain_fact_policy: {
        sunscreen: ['spf_value','uva_label'],
        moisturizer_family: ['primary_use_role','barrier_support_claim'],
        treatment: ['contains_active','contains_active'],
      },
      stable_tiebreak: ['blocked_binding_count_asc','blocked_evidence_count_asc','pilot_id_asc'],
      random_selection: false,
    },
    hosted_prestate_reference: {
      already_hosted_product_ids: [...KNOWN_HOSTED_PRODUCT_IDS].sort(stable),
      already_hosted_proposition_keys: [...KNOWN_HOSTED_PROPOSITION_KEYS].sort(stable),
      fixture_only: false,
      authoritative_only_after_live_readback: true,
    },
    selected_products: selectedProducts,
    selected_subjects: selectedProducts.map((p) => ({ product_id: p.product_id, pilot_id: p.pilot_id, subject_semantic_key: p.subject_semantic_key, subject_payload: p.subject_payload })),
    selected_fact_proposals: selectedFacts,
    excluded_proposals: excluded,
    summary: {
      new_products: selectedProducts.length,
      new_subjects: selectedProducts.length,
      new_sources: uniqueSources.size,
      new_bindings: uniqueBindings.size,
      new_evidence: selectedFacts.length,
      new_facts: selectedFacts.length,
      new_current_pointers: selectedFacts.length,
      blocked_or_deferred_propositions: excluded.length,
      write_budget_products_max: 3,
      write_budget_facts_max: 6,
      batch_limit_valid: selectedProducts.length <= 3 && selectedFacts.length <= 6,
    },
    expected_writes: expectedWrites,
    execution_contract: {
      registry_republish: false,
      controlled_rpc_only: true,
      direct_product_fact_table_write: false,
      preflight_before_each_confirm: true,
      confirm_exact_retry_required: true,
      stale_prestate_negative_required: true,
      admin_capability: 'existing_auth_actor_transaction_scoped_admin_operator_only; persistent residue must equal zero',
      hosted_runtime_fusion_digest: 'must be recomputed from allocated Hosted subject/evidence UUIDs by canonical helper',
      product_transaction_granularity: true,
    },
    lifecycle: {
      PRODUCT_FACT_PARTIAL_CATALOG_ADOPTION_PLANNED: true,
      PRODUCT_FACT_CATALOG_ADOPTED: false,
      CATALOG_FULLY_ADOPTED: false,
      PRODUCT_DECISION_AXIS_PRODUCTION_CALIBRATED: false,
      DECISION_AXIS_PRODUCTION_CONSUMPTION: false,
      RECOMMENDATION_SCORER_CHANGED: false,
      RECOMMENDATION_ACTIVATED: false,
      HOSTED_WRITES_EXECUTED_BY_THIS_ARTIFACT_BUILD: 0,
    },
  };
  plan.plan_content_sha256 = sha256Text(JSON.stringify(plan));
  return plan;
}
