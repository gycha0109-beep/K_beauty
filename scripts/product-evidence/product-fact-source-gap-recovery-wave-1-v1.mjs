import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const BASE = '118152c40d76d2956d85c5bbc56ecdbe725b5ee7';
export const REGISTRY = 'product-fact-registry-cross-category-v1';
export const SUBJECT_SERIALIZER = 'product-fact-subject-identity-v1';
export const SERIALIZER = 'product-fact-proposition-pilot-v1';
export const FUSION = 'v2.1-4-product-fact-evidence-fusion-v1';
export const FUSION_HASH = 'c62005755697758213d62288720fcd30e2dae7c0afc407d4d6bf23246abe69c9';
export const FROZEN = Object.freeze({
  materialization: 'b2f19878f00f53d9a60dad0b1515fff1f566449e6a531825e712dfa2e3f19bb2',
  corpus: '47457c0242451a35305fd8eceba0ebb7e210eb9ee2e73134ccf41696d18e517d',
  mapping: 'c746c5d02f654ed7f0a8e8385611ac65ca30b9c4648fa4c6454ac863e7c9314f',
  gap: '5a4580d76cca62d90a3ac306744054c507a6d5e45b0b91a41dffb3b754980215'
});
export const IDS = Object.freeze({
  M1: '4aa41038-de5b-4125-97b0-a50e7575cc00',
  M3: '4cbd41f3-1357-42c6-a6c7-6df0e90d54a7',
  P1: 'd9e40ddb-b1e2-46e4-92db-82744227dfe3',
  P2: '38dc094e-4148-4566-a743-a09815265f44'
});

const P = Object.freeze({
  materialization: path.join(ROOT, 'evidence/product-fact-materialization-v1/cross-category-pilot-materialization-dry-run-v1.json'),
  corpus: path.join(ROOT, 'evidence/product-evidence-decision-axis-v1/cross-category-real-evidence-pilot-v1.json'),
  mapping: path.join(ROOT, 'evidence/product-evidence-decision-axis-v1/cross-category-real-fact-mapping-pilot-v1.json'),
  gap: path.join(ROOT, 'evidence/product-evidence-decision-axis-v1/cross-category-real-pilot-gap-report-v1.json'),
  registry: path.join(ROOT, 'evidence/product-evidence-decision-axis-v1/cross-category-registry-v1.json'),
  controlled: path.join(ROOT, 'supabase/migrations/20260810174400_product_fact_controlled_write_v1.sql')
});

export const stable = v => Array.isArray(v)
  ? v.map(stable)
  : v && typeof v === 'object'
    ? Object.fromEntries(Object.keys(v).sort((a, b) => a.localeCompare(b, 'en')).map(k => [k, stable(v[k])]))
    : v;
export const canonical = v => JSON.stringify(stable(v));
export const sha = v => crypto.createHash('sha256').update(Buffer.isBuffer(v) ? v : typeof v === 'string' ? v : canonical(v)).digest('hex');
export const pretty = v => `${JSON.stringify(v, null, 2)}\n`;
const J = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const fileSha = p => sha(fs.readFileSync(p));
const sorted = a => [...a].sort((x, y) => String(x).localeCompare(String(y), 'en'));
const uniq = a => [...new Set(a)];

export function deriveHistoricalM1() {
  assert.equal(fileSha(P.materialization), FROZEN.materialization, 'V2.1-2 materialization drift');
  assert.equal(fileSha(P.corpus), FROZEN.corpus, 'frozen corpus drift');
  assert.equal(fileSha(P.mapping), FROZEN.mapping, 'frozen mapping drift');
  assert.equal(fileSha(P.gap), FROZEN.gap, 'frozen gap drift');
  const corpus = J(P.corpus);
  const mapping = J(P.mapping);
  const historical = J(P.materialization);
  const product = corpus.products.find(x => x.pilot_id === 'M1');
  const mp = mapping.products.find(x => x.pilot_id === 'M1');
  const frozenSubject = historical.subjects.find(x => x.pilot_id === 'M1');
  assert.ok(product && mp && frozenSubject, 'M1 immutable authority missing');
  const variants = uniq(mp.mapped_facts.map(f => f.scope?.variant).filter(Boolean));
  const markets = uniq(mp.mapped_facts.map(f => f.scope?.market).filter(Boolean));
  const marketApplicability = product.identity_status === 'resolved' && markets.length === 1 && markets[0] !== 'GLOBAL' && markets[0] === product.selected_market ? markets[0] : null;
  const identityToken = {
    pilot_id: product.pilot_id,
    catalog_product_id: product.catalog_product_id,
    canonical_brand: product.canonical_brand,
    canonical_product_name: product.canonical_product_name,
    identity_evidence_refs: sorted(product.identity_evidence_refs),
    identity_status: product.identity_status,
    selected_market: product.selected_market
  };
  const identityDigest = sha(identityToken);
  const formulationRevisionKey = `pilot-freeze-${identityDigest.slice(0, 32)}`;
  const variantKey = variants.length === 1 ? variants[0] : null;
  const semanticIdentity = {
    product_id: product.catalog_product_id,
    variant_key: variantKey,
    formulation_revision_key: formulationRevisionKey,
    market_applicability: marketApplicability,
    region_applicability: null,
    valid_from: null,
    valid_to: null
  };
  const subjectSemanticKey = sha(semanticIdentity);
  const actual = {
    identity_token: stable(identityToken),
    identity_digest: identityDigest,
    product_id: product.catalog_product_id,
    subject_semantic_key: subjectSemanticKey,
    subject_identity_serializer_version: SUBJECT_SERIALIZER,
    variant_key: variantKey,
    formulation_revision_key: formulationRevisionKey,
    selected_market: product.selected_market,
    market_applicability: marketApplicability,
    region_applicability: null,
    current_state: 'current'
  };
  const expected = frozenSubject.proposed_subject_identity;
  assert.equal(actual.product_id, expected.product_id);
  assert.equal(actual.subject_semantic_key, expected.subject_semantic_key);
  assert.equal(actual.formulation_revision_key, expected.formulation_revision_key);
  assert.equal(actual.variant_key, expected.variant_key);
  assert.equal(actual.market_applicability, expected.market_applicability);
  assert.equal(actual.region_applicability, expected.region_applicability);
  assert.equal(product.selected_market, frozenSubject.product_identity_input.selected_market);
  return actual;
}

export function adjudicateScopeContract() {
  const sql = fs.readFileSync(P.controlled, 'utf8');
  assert.match(sql, /v_subject\.market_applicability is not null/i, 'subject market guard missing');
  assert.match(sql, /v_binding_state not in \('exact_subject_match', 'equivalent_presentation_match'\)/i, 'resolved binding-state gate missing');
  assert.match(sql, /v_scope_relation not in \('equivalent', 'narrower'\)/i, 'resolved narrower binding gate missing');
  return {
    contract: 'product_fact_controlled_write_v1',
    result: 'VALID_NARROWER_FACT_SCOPE',
    subject_market_applicability: null,
    evidence_market: 'KR',
    fact_scope: {market: 'KR'},
    binding_state: 'exact_subject_match',
    binding_scope_relation: 'narrower',
    subject_identity_change_required: false,
    current_scope_preservation: 'fact_instance_scope_preserved_through_product_fact_current_pointer'
  };
}

export function proposition(factKey, valueIdentity, subjectSemanticKey, scope = {market: 'KR'}) {
  const identity = {
    subject_semantic_key: subjectSemanticKey,
    registry_version: REGISTRY,
    fact_key: factKey,
    value_identity: valueIdentity,
    scope: stable(scope),
    qualifier: {},
    parent_proposition_key: null,
    serializer_version: SERIALIZER
  };
  return {identity: stable(identity), proposition_key: sha(identity)};
}

const M1_SOURCE = Object.freeze({
  pilot_id: 'M1',
  source_ref: 'source:wave1:M1:amorepacific',
  canonical_locator: 'https://www.apgroup.com/int/ko/news/2026-03-27-2.html',
  observed_locator: 'https://www.apgroup.com/int/ko/news/2026-03-27-2.html?utm_source=chatgpt.com',
  publisher: 'Amorepacific',
  source_kind: 'official_manufacturer_product_news',
  page_identity: "일리윤, '몬치치' 협업 기획세트 출시",
  market: 'KR',
  locale: 'ko-KR',
  accessed_at: '2026-08-14',
  exact_product_identity_match: true,
  size_match: true,
  variant_assessment: 'compatible_exact_named_product',
  formulation_assessment: 'compatible_for_exact_named_150ml_product',
  authority: 'product_specific_primary',
  confidence: 'high',
  normalized_observations: [
    'exact Ceramide Ato Concentrate Cream 150mL two-unit configuration',
    'body moisturization plus facial barrier-cream usage context',
    'explicit positive skin-barrier improvement claim'
  ]
});

function freezeSource(source) {
  return {
    ...source,
    content_digest: sha({
      digest_basis: 'normalized-source-observation-v1-not-live-page-bytes',
      canonical_locator: source.canonical_locator,
      publisher: source.publisher,
      page_identity: source.page_identity,
      normalized_observations: source.normalized_observations
    })
  };
}

function makeM1Fact(historical, factKey, typedValue, evidenceClass) {
  const prop = proposition(factKey, typedValue, historical.subject_semantic_key, {market: 'KR'});
  const evidenceRef = `evidence:wave1:M1:${factKey}`;
  const evidence = {
    evidence_ref: evidenceRef,
    source_ref: M1_SOURCE.source_ref,
    product_id: IDS.M1,
    fact_key: factKey,
    typed_value: typedValue,
    evidence_class: evidenceClass,
    evidence_authority: 'product_specific_primary',
    confidence: 'high',
    support_direction: 'supports',
    scope: {market: 'KR'},
    qualifier_context: {},
    proposition_serializer_version: SERIALIZER,
    proposition_identity: prop.identity,
    proposition_key: prop.proposition_key
  };
  evidence.canonical_evidence_digest = sha(evidence);
  const fact = {
    product_id: IDS.M1,
    fact_key: factKey,
    typed_value: typedValue,
    proposition_serializer_version: SERIALIZER,
    proposition_identity: prop.identity,
    proposition_key: prop.proposition_key,
    parent_proposition_key: null,
    semantic_status: 'supported',
    authority_ceiling: 'product_specific_primary',
    fused_confidence: 'high',
    support_direction: 'supports',
    supporting_evidence_refs: [evidenceRef],
    opposing_evidence_refs: [],
    scope: {market: 'KR'},
    qualifier_context: {},
    fusion_policy_version: FUSION,
    fusion_policy_hash: FUSION_HASH
  };
  fact.fusion_input_digest = sha(fact);
  return {evidence, fact};
}

export function buildAuthority() {
  const historical = deriveHistoricalM1();
  const scope = adjudicateScopeContract();
  const registry = J(P.registry);
  assert.equal(registry.registry_version, REGISTRY);
  const primaryDef = registry.facts.find(x => x.fact_key === 'primary_use_role');
  const barrierDef = registry.facts.find(x => x.fact_key === 'barrier_support_claim');
  assert.ok(primaryDef && barrierDef, 'M1 registry definitions missing');
  assert.ok(JSON.stringify(primaryDef).includes('multi_area'), 'multi_area absent from governed primary_use_role definition');
  assert.equal(barrierDef.value_type, 'boolean', 'barrier_support_claim must remain boolean');

  const r = makeM1Fact(historical, 'primary_use_role', 'multi_area', 'role_declaration');
  const b = makeM1Fact(historical, 'barrier_support_claim', true, 'product_claim');
  const facts = [r.fact, b.fact].sort((a, z) => a.fact_key.localeCompare(z.fact_key, 'en'));
  const evidence = [r.evidence, b.evidence].sort((a, z) => a.fact_key.localeCompare(z.fact_key, 'en'));
  assert.equal(new Set(facts.map(x => x.proposition_key)).size, 2, 'proposition collision');

  const outcomes = [
    ['M1', 'primary_use_role', 'RECOVERED_SUPPORTED', r.fact.proposition_key],
    ['M1', 'barrier_support_claim', 'RECOVERED_SUPPORTED', b.fact.proposition_key],
    ['M3', 'primary_use_role', 'VARIANT_SCOPE_CONFLICT', null],
    ['M3', 'barrier_support_claim', 'VARIANT_SCOPE_CONFLICT', null],
    ['P1', 'product_format', 'FORMULATION_SCOPE_CONFLICT', null],
    ['P1', 'contains_active', 'FORMULATION_SCOPE_CONFLICT', null]
  ].map(([pilot_id, fact_key, outcome, proposition_key]) => ({
    pilot_id,
    product_id: IDS[pilot_id],
    fact_key,
    historical_state: 'source_blocked',
    outcome,
    proposition_key
  }));

  const m1Source = freezeSource(M1_SOURCE);
  const overlay = {
    version: 'source-gap-recovery-wave-1-v1',
    stage: 'V2.1-8D',
    authority: {
      source_main_sha: process.env.V21_8D_BASE_MAIN_SHA || BASE,
      registry_version: REGISTRY,
      subject_identity_serializer_version: SUBJECT_SERIALIZER,
      proposition_serializer_version: SERIALIZER,
      fusion_policy_version: FUSION,
      fusion_policy_hash: FUSION_HASH,
      hosted_product_fact_writes: 0
    },
    frozen_authority: {
      materialization_sha256: FROZEN.materialization,
      corpus_sha256: FROZEN.corpus,
      mapping_sha256: FROZEN.mapping,
      gap_sha256: FROZEN.gap,
      supported_confirmation_eligible_total: 23,
      hosted_adopted_supported_total: 23
    },
    historical_m1_subject: historical,
    r1_prompt_authority_disposition: {
      status: 'RESOLVED_AS_PROMPT_AUTHORITY_ERROR',
      historical_repository_authority_changed: false
    },
    m1_scope_adjudication: scope,
    research_scope: {
      target_pilots: ['M1', 'M3', 'P1'],
      excluded_pilots: ['P2'],
      targeted_source_gap_fact_slots: 6
    },
    research_decision: {
      recovered_supported_propositions: 2,
      recovered_product_count: 1,
      per_target_fact_slot: {
        RECOVERED_SUPPORTED: 2,
        VARIANT_SCOPE_CONFLICT: 2,
        FORMULATION_SCOPE_CONFLICT: 2,
        REMAINS_SOURCE_BLOCKED: 0
      },
      product_status: {
        M1: 'RECOVERED_SUPPORTED',
        M3: 'VARIANT_SCOPE_CONFLICT',
        P1: 'FORMULATION_SCOPE_CONFLICT'
      }
    },
    accepted_sources: [m1Source],
    rejected_or_blocked_sources: [
      {
        pilot_id: 'M3',
        source_ref: 'source:wave1:M3:drg-9826',
        canonical_locator: 'https://www.dr-g.co.kr/item/9826',
        publisher: 'Dr.G',
        source_kind: 'official_product_page',
        market: 'KR',
        locale: 'ko-KR',
        accessed_at: '2026-08-14',
        direct_fetch_status: 'TIMEOUT',
        prior_observed_page_identity: '레드 블레미쉬 클리어 수딩 크림 70mL',
        frozen_identity: 'R.E.D BLEMISH Clear Soothing Cream EX / 레드 블레미쉬 클리어 수딩 크림 EX',
        exact_ex_official_domain_search: {
          domain: 'dr-g.co.kr',
          queries: ['레드 블레미쉬 클리어 수딩 크림 EX', 'R.E.D BLEMISH Clear Soothing Cream EX'],
          verified_exact_ex_results: 0
        },
        identity_assessment: 'exact_frozen_EX_identity_not_established_by_current_official_authority',
        formulation_assessment: 'not_established',
        authority_ceiling_for_target_facts: 'none',
        outcome: 'VARIANT_SCOPE_CONFLICT',
        rejection_reason: 'official_non_EX_or_unavailable_cannot_establish_frozen_EX_equivalence',
        proposition_serialized: false
      },
      {
        pilot_id: 'P1',
        source_ref: 'source:wave1:P1:anua-496',
        canonical_locator: 'https://m.anua.kr/product/detail.html?product_no=496',
        publisher: 'Anua',
        source_kind: 'official_product_page',
        page_identity: '[NEW/리뉴얼] 어성초 77 히알루론산 수분 진정 토너 250ml',
        market: 'KR',
        locale: 'ko-KR',
        accessed_at: '2026-08-14',
        frozen_identity: '어성초 77 히알루론산 수분 진정 토너 350ml',
        size_assessment: 'conflict_250ml_vs_frozen_350ml',
        formulation_assessment: 'not_established',
        authority_ceiling_for_target_facts: 'none',
        outcome: 'FORMULATION_SCOPE_CONFLICT',
        rejection_reason: 'renewed_250ml_does_not_establish_frozen_350ml_formulation_equivalence',
        proposition_serialized: false
      }
    ],
    evidence_records: evidence,
    fact_proposals: facts,
    recovery_outcomes: outcomes,
    registry_gaps: [{
      pilot_id: 'M3',
      concept: 'subjective_soothing_observation',
      outcome: 'REGISTRY_GAP',
      registry_mutation: false
    }],
    invariants: {
      registry_expansion: false,
      missing_as_false: false,
      scope_conflict_promoted_to_supported: false,
      authority_inflation: false,
      p2_identity_resolution: false,
      production_consumption: false,
      recommendation_scorer_changed: false,
      recommendation_activated: false
    },
    hosted_write_intent: {
      register_subject: 0,
      ingest_evidence: 0,
      prepare_review: 0,
      preflight: 0,
      confirm: 0,
      direct_table_writes: 0,
      hosted_product_fact_writes: 0
    }
  };

  const overlayText = pretty(overlay);
  const materialization = {
    version: 'source-gap-recovery-wave-1-materialization-v1',
    stage: 'V2.1-8D',
    authority: {
      source_main_sha: overlay.authority.source_main_sha,
      evidence_overlay_sha256: sha(overlayText),
      hosted_product_fact_writes_v21_8d: 0
    },
    hosted_prestate: {
      subjects: 8,
      evidence: 23,
      fact_instances: 23,
      confirmations: 23,
      current: 23,
      adopted_unique_products: 8
    },
    summary: {
      future_candidate_products: 1,
      future_candidate_propositions: 2,
      future_new_subjects: 1,
      future_new_sources: 1,
      future_new_bindings: 1,
      future_new_evidence: 2,
      future_new_fact_instances: 2,
      future_new_evidence_links: 2,
      future_new_review_assignments: 2,
      future_new_confirmations: 2,
      future_new_current: 2,
      projected_after_8e: {products: 9, current: 25},
      actual_v21_8d: {products: 8, current: 23}
    },
    source_reuse_assessment: {
      canonical_locator: m1Source.canonical_locator,
      exact_source_already_hosted_at_r2_precheck: false,
      projected_source_insert_if_prestate_unchanged: 1
    },
    candidate: {
      pilot_id: 'M1',
      product_id: IDS.M1,
      future_subject_registration_required: true,
      historical_subject_identity: {
        subject_semantic_key: historical.subject_semantic_key,
        formulation_revision_key: historical.formulation_revision_key,
        variant_key: historical.variant_key,
        selected_market: historical.selected_market,
        market_applicability: historical.market_applicability,
        region_applicability: historical.region_applicability
      },
      source_binding_plan: {
        source_ref: m1Source.source_ref,
        binding_state: scope.binding_state,
        scope_relation: scope.binding_scope_relation,
        subject_identity_change_required: false
      },
      evidence_plan_count: 2,
      fact_plan_count: 2,
      review_plan: {
        assignments: 2,
        review_events: 'derive_from_controlled_lifecycle_at_future_execution',
        executed_calls_v21_8d: 0
      },
      confirmation_eligible_fact_count: 2,
      current_eligible_fact_count: 2,
      facts: facts.map(f => ({
        fact_key: f.fact_key,
        typed_value: f.typed_value,
        scope: f.scope,
        proposition_key: f.proposition_key,
        evidence_refs: f.supporting_evidence_refs,
        source_authority: f.authority_ceiling,
        confidence: f.fused_confidence,
        parent_dependency: null
      }))
    },
    non_candidates: [
      {pilot_id: 'M3', future_subject_registration_required: false, future_current: 0},
      {pilot_id: 'P1', future_subject_registration_required: false, future_current: 0},
      {pilot_id: 'P2', future_subject_registration_required: false, future_current: 0}
    ],
    hosted_write_intent: 0,
    production_consumption: false,
    recommendation_activation: false
  };
  return {overlay, materialization};
}
