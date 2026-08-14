import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { proposition } from './product-fact-source-gap-recovery-wave-1-v1.mjs';

export const PLAN_VERSION = 'recovered-source-gap-adoption-wave-1-v1';
export const PLAN_ID = 'v21-8e-m1-illiyoon-controlled-hosted-adoption';
export const REGISTRY_VERSION = 'product-fact-registry-cross-category-v1';
export const SOURCE_MAIN_SHA = 'da4e499b9b33af5a36c33e2c4c189462d731786b';
export const ADMIN_ACTOR = Object.freeze({
  user_id: 'e1a59349-fe13-43ff-86ce-078c2dce0d99',
  role: 'admin_owner',
  is_active: true,
});

export const FROZEN_AUTHORITY = Object.freeze({
  evidence_sha256: '587afd259b12b93f11bb0ebae65370e12d07cf2b623c35c962ba4cf1ee72c3bc',
  materialization_sha256: '9324d64492332da47bf118aa21ec3e9177c98f821b4c5f0556b8c3a9e8c55735',
  markdown_sha256: '76e9d46fc19a9a0f28167e0d63107da3710b93a9154f18b168071e8dfcfc8565',
});

export const HOSTED_PRESTATE_COUNTS = Object.freeze({
  product_fact_registry_versions: 1,
  product_fact_definition_snapshots: 20,
  product_fact_subjects: 8,
  product_evidence_sources: 8,
  product_evidence_source_subject_bindings: 8,
  product_evidence_records: 23,
  product_fact_instances: 23,
  product_fact_evidence_links: 23,
  product_fact_review_assignments: 23,
  product_fact_review_events: 100,
  product_fact_confirmations: 23,
  product_fact_current: 23,
});

export const HOSTED_POSTSTATE_COUNTS = Object.freeze({
  product_fact_registry_versions: 1,
  product_fact_definition_snapshots: 20,
  product_fact_subjects: 9,
  product_evidence_sources: 9,
  product_evidence_source_subject_bindings: 9,
  product_evidence_records: 25,
  product_fact_instances: 25,
  product_fact_evidence_links: 25,
  product_fact_review_assignments: 25,
  product_fact_review_events: 108,
  product_fact_confirmations: 25,
  product_fact_current: 25,
});

export const SUBJECT = Object.freeze({
  pilot_id: 'M1',
  product_id: '4aa41038-de5b-4125-97b0-a50e7575cc00',
  brand: 'ILLIYOON',
  product: 'Ceramide Ato Concentrate Cream 150mL / 세라마이드 아토 집중크림',
  payload: Object.freeze({
    product_id: '4aa41038-de5b-4125-97b0-a50e7575cc00',
    subject_semantic_key: 'd600446336216d911d4aada62502fcbcc5b800abc671094b27fa5625f241d810',
    subject_identity_serializer_version: 'product-fact-subject-identity-v1',
    variant_key: null,
    formulation_revision_key: 'pilot-freeze-eaa1452f7abd275fb4d096089a03e4b2',
    formulation_label: 'Ceramide Ato Concentrate Cream 150mL / 세라마이드 아토 집중크림',
    identity_status: 'resolved',
    identity_resolution_version: 'cross-category-real-evidence-pilot-v1',
    current_state: 'current',
    market_applicability: null,
    region_applicability: null,
    valid_from: null,
    valid_to: null,
    predecessor_subject_id: null,
    supersession_kind: null,
  }),
});

export const SOURCE = Object.freeze({
  canonical_locator: 'https://www.apgroup.com/int/ko/news/2026-03-27-2.html',
  publisher: 'Amorepacific',
  source_kind: 'official_manufacturer_product_news',
  source_metadata: Object.freeze({
    frozen_source_ref: 'source:wave1:M1:amorepacific',
    exact_product_identity_match: true,
    size_match: true,
    authority: 'product_specific_primary',
    provenance_container: 'evidence/product-evidence-expansion-v1/source-gap-recovery-wave-1-v1.json#accepted_sources/0',
  }),
  content_digest: 'c6a548b3c48d7a60d8c24e31e9cff38d1d7e5bd0ea1fdab4fe934ced3164f7a1',
  external_snapshot_reference: null,
  market: 'KR',
  region: null,
  locale: 'ko-KR',
  published_at: null,
  accessed_at: '2026-08-14',
  observed_at: null,
});

export const EXPECTED_PROPOSITIONS = Object.freeze({
  primary_use_role: '00bb4342dc4f76621a6961b928f39910aa311d5fa3e9b5f01d27fbc385a2c3c4',
  barrier_support_claim: 'bbf0b595d0b81eae256ffa6b06065430e36c528f9d20cdd14c575c992c2be2fd',
});

export const stable = value => Array.isArray(value)
  ? value.map(stable)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]))
    : value;
export const stableJson = value => `${JSON.stringify(stable(value), null, 2)}\n`;
export const sha256Text = value => crypto.createHash('sha256').update(value).digest('hex');

function typedColumns(factKey, value) {
  return {
    value_type: factKey === 'primary_use_role' ? 'enum' : 'boolean',
    value_boolean: factKey === 'barrier_support_claim' ? value : null,
    value_enum: factKey === 'primary_use_role' ? value : null,
    value_number: null,
    value_unit: null,
    value_range_min: null,
    value_range_max: null,
    value_entity_identifier: null,
  };
}

function buildFact({ evidenceRow, factRow }) {
  const factKey = factRow.fact_key;
  const value = factRow.typed_value;
  const regenerated = proposition(factKey, value, SUBJECT.payload.subject_semantic_key, { market: 'KR' });
  assert.equal(regenerated.proposition_key, EXPECTED_PROPOSITIONS[factKey], `proposition authority mismatch: ${factKey}`);
  assert.equal(factRow.proposition_key, regenerated.proposition_key, `frozen fact mismatch: ${factKey}`);
  assert.equal(evidenceRow.proposition_key, regenerated.proposition_key, `frozen evidence mismatch: ${factKey}`);
  const columns = typedColumns(factKey, value);
  return {
    fact_key: factKey,
    typed_value: value,
    proposition_key: regenerated.proposition_key,
    proposition_identity: regenerated.identity,
    semantic_status: 'supported',
    authority_ceiling: 'product_specific_primary',
    fused_confidence: 'high',
    support_direction: 'supports',
    scope: { market: 'KR' },
    parent_proposition_key: null,
    evidence_ref: evidenceRow.evidence_ref,
    evidence_class: evidenceRow.evidence_class,
    canonical_evidence_digest: evidenceRow.canonical_evidence_digest,
    typed_columns: columns,
    ingest_payload: {
      source: SOURCE,
      binding: {
        product_id: SUBJECT.product_id,
        subject_id: '__HOSTED_SUBJECT_ID__',
        binding_state: 'exact_subject_match',
        scope_relation: 'narrower',
        presentation_metadata: {
          source_ref: 'source:wave1:M1:amorepacific',
          source_market: 'KR',
          subject_market_applicability: null,
          subject_identity_change_required: false,
        },
        identity_resolution_version: 'cross-category-real-evidence-pilot-v1',
        reviewed_at: '2026-08-14',
      },
      evidence: {
        registry_version: REGISTRY_VERSION,
        fact_key: factKey,
        proposition_key: regenerated.proposition_key,
        proposition_serializer_version: 'product-fact-proposition-pilot-v1',
        proposition_value_identity: value,
        parent_proposition_key: null,
        evidence_class: evidenceRow.evidence_class,
        evidence_authority: 'product_specific_primary',
        confidence: 'high',
        support_direction: 'supports',
        negative_admissibility: 'not_applicable',
        market: 'KR',
        region: null,
        locale: null,
        valid_from: null,
        valid_to: null,
        qualifier: {},
        canonical_evidence_digest: evidenceRow.canonical_evidence_digest,
        supersedes_evidence_id: null,
      },
    },
    review_payloads: [
      {
        product_id: SUBJECT.product_id,
        subject_id: '__HOSTED_SUBJECT_ID__',
        registry_version: REGISTRY_VERSION,
        fact_key: factKey,
        proposition_key: regenerated.proposition_key,
        operational_state: 'under_review',
        assigned_to: ADMIN_ACTOR.user_id,
        review_policy_version: PLAN_VERSION,
        reason_code: 'v21_8e_recovered_source_gap_adoption',
      },
      {
        product_id: SUBJECT.product_id,
        subject_id: '__HOSTED_SUBJECT_ID__',
        registry_version: REGISTRY_VERSION,
        fact_key: factKey,
        proposition_key: regenerated.proposition_key,
        operational_state: 'ready_for_confirm',
        assigned_to: ADMIN_ACTOR.user_id,
        review_policy_version: PLAN_VERSION,
        reason_code: 'v21_8e_recovered_source_gap_ready',
      },
    ],
    confirmation_payload: {
      assignment_id: '__HOSTED_ASSIGNMENT_ID__',
      subject_id: '__HOSTED_SUBJECT_ID__',
      registry_version: REGISTRY_VERSION,
      fact_key: factKey,
      proposition_key: regenerated.proposition_key,
      proposition_serializer_version: 'product-fact-proposition-pilot-v1',
      semantic_status: 'supported',
      ...columns,
      market: 'KR',
      region: null,
      locale: null,
      valid_from: null,
      valid_to: null,
      qualifier: {},
      parent_fact_instance_id: null,
      parent_proposition_key: null,
      authority_ceiling: 'product_specific_primary',
      fused_confidence: 'high',
      fusion_policy_version: 'v2.1-4-product-fact-evidence-fusion-v1',
      fusion_input_digest: '__HOSTED_RUNTIME_FUSION_INPUT_DIGEST__',
      supporting_evidence_ids: ['__HOSTED_EVIDENCE_ID__'],
      opposing_evidence_ids: [],
    },
  };
}

export function buildAdoptionPlan({ evidence, materialization, batch3, sourceMainSha, inputHashes }) {
  assert.equal(sourceMainSha, SOURCE_MAIN_SHA, 'source main authority drift');
  assert.deepEqual(inputHashes, FROZEN_AUTHORITY, 'V2.1-8D artifact authority drift');
  assert.equal(evidence.version, 'source-gap-recovery-wave-1-v1');
  assert.equal(materialization.version, 'source-gap-recovery-wave-1-materialization-v1');
  assert.equal(evidence.historical_m1_subject.subject_semantic_key, SUBJECT.payload.subject_semantic_key);
  assert.equal(evidence.m1_scope_adjudication.result, 'VALID_NARROWER_FACT_SCOPE');
  assert.equal(evidence.m1_scope_adjudication.binding_scope_relation, 'narrower');
  assert.equal(evidence.m1_scope_adjudication.subject_identity_change_required, false);
  assert.equal(materialization.candidate.product_id, SUBJECT.product_id);
  assert.equal(materialization.non_candidates.length, 3);
  assert.deepEqual(materialization.non_candidates.map(row => row.pilot_id), ['M3', 'P1', 'P2']);

  const executionOrder = ['primary_use_role', 'barrier_support_claim'];
  const evidenceByFact = new Map(evidence.evidence_records.map(row => [row.fact_key, row]));
  const factsByFact = new Map(evidence.fact_proposals.map(row => [row.fact_key, row]));
  const facts = executionOrder.map(factKey => buildFact({
    evidenceRow: evidenceByFact.get(factKey),
    factRow: factsByFact.get(factKey),
  }));
  const historicalKeys = [...batch3.expected_final_frozen_supported_proposition_keys].sort();
  assert.equal(historicalKeys.length, 23, 'historical Current authority must contain 23 propositions');

  const plan = {
    version: PLAN_VERSION,
    stage: 'V2.1-8E',
    plan_id: PLAN_ID,
    source_main_sha: sourceMainSha,
    authority: {
      input_hashes: inputHashes,
      registry_version: REGISTRY_VERSION,
      historical_current_proposition_keys: historicalKeys,
      historical_current_count: 23,
    },
    hosted_prestate: {
      counts: HOSTED_PRESTATE_COUNTS,
      m1_subject_count: 0,
      m1_source_count: 0,
      m1_current_count: 0,
      adopted_unique_products: 8,
      active_admin_owner: ADMIN_ACTOR,
      migration_versions: ['20260809115932', '20260810174400', '20260810174410'],
    },
    exact_scope: {
      products: 1,
      subjects: 1,
      sources: 1,
      bindings: 1,
      evidence: 2,
      facts: 2,
      confirmations: 2,
      current: 2,
      excluded_pilots: ['M3', 'P1', 'P2'],
    },
    subject: SUBJECT,
    source: SOURCE,
    binding_contract: {
      binding_state: 'exact_subject_match',
      scope_relation: 'narrower',
      subject_identity_change_required: false,
    },
    execution_order: executionOrder,
    facts,
    controlled_rpc_sequence: [
      'admin_register_product_fact_subject_v1',
      'admin_ingest_product_fact_evidence_v1',
      'admin_prepare_product_fact_review_v1',
      'admin_preflight_product_fact_confirmation_v1',
      'admin_confirm_product_fact_v1',
    ],
    expected_writes: {
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
    },
    expected_poststate: {
      counts: HOSTED_POSTSTATE_COUNTS,
      m1_subject_count: 1,
      m1_current_count: 2,
      adopted_unique_products: 9,
    },
    invariants: {
      existing_current_23_unchanged: true,
      legacy_business_tables_unchanged: ['products', 'source_rankings', 'recommendation_logs'],
      m3_p1_p2_subject_and_current_zero: true,
      registry_republish: false,
      ddl: false,
      schema_mutation: false,
      direct_product_fact_table_write: false,
      recommendation_scorer_changed: false,
      recommendation_activated: false,
      decision_axis_production_consumption: false,
      catalog_fully_adopted: false,
    },
  };
  return { ...plan, plan_content_sha256: sha256Text(stableJson(plan)) };
}

export function renderAdoptionMarkdown(plan) {
  return `# V2.1-8E — Recovered Source-Gap Hosted Adoption Wave 1\n\n` +
    `> Deterministic Phase A execution freeze. Hosted writes occur only after exact-head CI, squash merge, and exact-main closeout.\n\n` +
    `- Source main: \`${plan.source_main_sha}\`\n` +
    `- Product: \`${plan.subject.product_id}\` / ${plan.subject.brand} ${plan.subject.product}\n` +
    `- Subject semantic key: \`${plan.subject.payload.subject_semantic_key}\`\n` +
    `- Subject market applicability: \`null\`; Fact scope: \`{"market":"KR"}\`\n` +
    `- Binding: \`exact_subject_match / narrower\`\n` +
    `- Facts: **2**; expected Current: **23 → 25**; adopted products: **8 → 9**\n` +
    `- Plan content SHA-256: \`${plan.plan_content_sha256}\`\n\n` +
    `## Exact propositions\n\n` +
    plan.facts.map(row => `- \`${row.fact_key}=${JSON.stringify(row.typed_value)}\`: \`${row.proposition_key}\`; evidence \`${row.canonical_evidence_digest}\``).join('\n') +
    `\n\n## Controlled lifecycle\n\n` +
    plan.controlled_rpc_sequence.map((rpc, index) => `${index + 1}. \`${rpc}\``).join('\n') +
    `\n\nPreflight is zero-write. One stale-prestate negative must reject with SQLSTATE \`40001\`. Both confirmations must be retried idempotently, and final IDs must come from authoritative Hosted joins.\n\n` +
    `## Boundary\n\n` +
    `- No new source research, Registry publication, DDL, schema/migration/RLS change, direct Product Fact table write, or recommendation activation.\n` +
    `- M3, P1, and P2 remain excluded with zero Subject and Current rows.\n` +
    `- The existing 23 Current rows and legacy business tables must remain byte-equivalent under the same pre/post serialization.\n`;
}
