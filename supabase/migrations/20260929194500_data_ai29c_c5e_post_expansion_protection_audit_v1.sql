begin;

create or replace function public.read_data_ai29c_protection_expansion_audit_v1()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
with eligible_products as (
  select
    p.id as product_id,
    p.brand,
    p.name,
    case
      when p.category = 'sunscreen' then 'legacy_category'
      else 'catalog_taxonomy_shadow'
    end as inclusion_path
  from public.products p
  where p.category = 'sunscreen'
     or exists (
       select 1
       from public.product_catalog_taxonomy_assignments a
       where a.product_id = p.id
         and a.taxonomy_version = 'catalog-taxonomy-v1'
         and a.category_term_id = 'catalog-taxonomy-v1:category:sunscreen'
         and a.assignment_state = 'shadow'
     )
),
subject_rollup as (
  select
    ep.product_id,
    ep.brand,
    ep.name,
    ep.inclusion_path,
    count(s.subject_id)::integer as current_subject_count,
    min(s.subject_id::text)::uuid as subject_id,
    min(s.market_applicability) as market
  from eligible_products ep
  left join public.product_fact_subjects s
    on s.product_id = ep.product_id
   and s.identity_status = 'resolved'
   and s.current_state = 'current'
   and (s.valid_to is null or s.valid_to > current_date)
  group by ep.product_id, ep.brand, ep.name, ep.inclusion_path
),
fact_rollup as (
  select
    sr.product_id,
    sr.brand,
    sr.name,
    sr.inclusion_path,
    sr.current_subject_count,
    case when sr.current_subject_count = 1 then sr.subject_id else null end as subject_id,
    case when sr.current_subject_count = 1 then sr.market else null end as market,
    max(fi.value_number) filter (
      where sr.current_subject_count = 1
        and fi.fact_key = 'spf_value'
        and fi.semantic_status = 'supported'
        and fi.authority_ceiling = 'product_specific_primary'
        and fi.fused_confidence in ('high','medium')
        and (fi.valid_to is null or fi.valid_to > current_date)
    ) as spf_value,
    max(fi.value_enum) filter (
      where sr.current_subject_count = 1
        and fi.fact_key = 'uva_label'
        and fi.semantic_status = 'supported'
        and fi.authority_ceiling = 'product_specific_primary'
        and fi.fused_confidence in ('high','medium')
        and (fi.valid_to is null or fi.valid_to > current_date)
    ) as uva_label,
    max(fi.value_number) filter (
      where sr.current_subject_count = 1
        and fi.fact_key = 'water_resistance_duration'
        and fi.semantic_status = 'supported'
        and fi.authority_ceiling = 'product_specific_primary'
        and fi.fused_confidence in ('high','medium')
        and (fi.valid_to is null or fi.valid_to > current_date)
    ) as water_duration,
    max(fi.value_unit) filter (
      where sr.current_subject_count = 1
        and fi.fact_key = 'water_resistance_duration'
        and fi.semantic_status = 'supported'
        and fi.authority_ceiling = 'product_specific_primary'
        and fi.fused_confidence in ('high','medium')
        and (fi.valid_to is null or fi.valid_to > current_date)
    ) as water_unit
  from subject_rollup sr
  left join public.product_fact_current c
    on c.subject_id = case when sr.current_subject_count = 1 then sr.subject_id else null end
  left join public.product_fact_instances fi
    on fi.fact_instance_id = c.fact_instance_id
  group by
    sr.product_id, sr.brand, sr.name, sr.inclusion_path,
    sr.current_subject_count, sr.subject_id, sr.market
),
scored as (
  select
    fr.*,
    case
      when fr.spf_value >= 50 then 'spf_50_plus'
      when fr.spf_value >= 30 then 'spf_30_49'
      when fr.spf_value >= 15 then 'spf_15_29'
      when fr.spf_value is not null then 'spf_under_15'
      else null
    end as spf_bucket,
    case
      when fr.uva_label = 'PA++++' then 'uva_pa4'
      when fr.uva_label in ('PA+++','UVA-PF-declared') then 'uva_pa3'
      when fr.uva_label = 'PA++' then 'uva_pa2'
      when fr.uva_label = 'PA+' then 'uva_pa1'
      else null
    end as uva_bucket,
    case
      when fr.water_duration >= 80 then 'water_80_plus'
      when fr.water_duration >= 40 then 'water_40_79'
      when fr.water_duration > 0 then 'water_positive_under_40'
      else null
    end as water_bucket
  from fact_rollup fr
),
summary as (
  select
    count(*)::integer as sunscreen_count,
    count(*) filter (where inclusion_path = 'legacy_category')::integer as legacy_category_count,
    count(*) filter (where inclusion_path = 'catalog_taxonomy_shadow')::integer as catalog_taxonomy_shadow_count,
    count(*) filter (where current_subject_count = 1)::integer as exact_current_subject_count,
    count(*) filter (where current_subject_count <> 1)::integer as ambiguous_or_missing_subject_count,
    count(*) filter (where spf_value is not null)::integer as spf_eligible_count,
    count(*) filter (where uva_label is not null)::integer as uva_eligible_count,
    count(*) filter (where water_duration is not null)::integer as water_eligible_count,
    count(distinct spf_bucket) filter (where spf_bucket is not null)::integer as spf_distinct_scoring_buckets,
    count(distinct uva_bucket) filter (where uva_bucket is not null)::integer as uva_distinct_scoring_buckets,
    count(distinct water_bucket) filter (where water_bucket is not null)::integer as water_distinct_scoring_buckets
  from scored
),
gates as (
  select
    s.*,
    round(s.spf_eligible_count::numeric / nullif(s.sunscreen_count, 0), 4) as spf_coverage,
    round(s.uva_eligible_count::numeric / nullif(s.sunscreen_count, 0), 4) as uva_coverage,
    round(s.water_eligible_count::numeric / nullif(s.sunscreen_count, 0), 4) as water_coverage,
    (
      s.spf_eligible_count::numeric / nullif(s.sunscreen_count, 0) >= 0.90
      and s.spf_distinct_scoring_buckets >= 2
      and s.ambiguous_or_missing_subject_count = 0
    ) as spf_gate_pass,
    (
      s.uva_eligible_count::numeric / nullif(s.sunscreen_count, 0) >= 0.80
      and s.uva_distinct_scoring_buckets >= 2
      and s.ambiguous_or_missing_subject_count = 0
    ) as uva_gate_pass,
    (
      s.water_eligible_count::numeric / nullif(s.sunscreen_count, 0) >= 0.50
      and s.water_distinct_scoring_buckets >= 2
      and s.ambiguous_or_missing_subject_count = 0
    ) as water_gate_pass
  from summary s
)
select jsonb_build_object(
  'contractVersion', 'data-ai29c-c5-post-expansion-protection-audit-v1',
  'corpusDefinition', jsonb_build_object(
    'legacyCategory', 'products.category=sunscreen',
    'catalogTaxonomyVersion', 'catalog-taxonomy-v1',
    'catalogTaxonomyCategoryTermId', 'catalog-taxonomy-v1:category:sunscreen',
    'catalogTaxonomyAssignmentState', 'shadow'
  ),
  'summary', (
    select jsonb_build_object(
      'sunscreenCount', sunscreen_count,
      'legacyCategoryCount', legacy_category_count,
      'catalogTaxonomyShadowCount', catalog_taxonomy_shadow_count,
      'exactCurrentSubjectCount', exact_current_subject_count,
      'ambiguousOrMissingSubjectCount', ambiguous_or_missing_subject_count,
      'spfEligibleCount', spf_eligible_count,
      'uvaEligibleCount', uva_eligible_count,
      'waterEligibleCount', water_eligible_count,
      'spfCoverage', spf_coverage,
      'uvaCoverage', uva_coverage,
      'waterCoverage', water_coverage,
      'spfDistinctScoringBuckets', spf_distinct_scoring_buckets,
      'uvaDistinctScoringBuckets', uva_distinct_scoring_buckets,
      'waterDistinctScoringBuckets', water_distinct_scoring_buckets,
      'spfGatePass', spf_gate_pass,
      'uvaGatePass', uva_gate_pass,
      'waterGatePass', water_gate_pass,
      'allProtectionGatesPass', spf_gate_pass and uva_gate_pass and water_gate_pass
    )
    from gates
  ),
  'rows', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'productId', product_id,
      'brand', brand,
      'name', name,
      'inclusionPath', inclusion_path,
      'currentSubjectCount', current_subject_count,
      'subjectId', subject_id,
      'market', market,
      'spf', jsonb_build_object(
        'state', case when spf_value is null then 'missing' else 'resolved' end,
        'value', spf_value,
        'scoringBucket', spf_bucket
      ),
      'uva', jsonb_build_object(
        'state', case when uva_label is null then 'missing' else 'resolved' end,
        'value', uva_label,
        'scoringBucket', uva_bucket
      ),
      'waterResistance', jsonb_build_object(
        'state', case when water_duration is null then 'missing' else 'resolved' end,
        'duration', water_duration,
        'unit', water_unit,
        'scoringBucket', water_bucket
      )
    ) order by inclusion_path, brand, name, product_id), '[]'::jsonb)
    from scored
  ),
  'gatePolicy', jsonb_build_object(
    'spfMinimumCoverage', 0.90,
    'uvaMinimumCoverage', 0.80,
    'waterMinimumCoverage', 0.50,
    'minimumDistinctScoringBuckets', 2,
    'requiresZeroAmbiguousOrMissingSubjects', true
  ),
  'decision', (
    select case
      when spf_gate_pass and uva_gate_pass and water_gate_pass
        then 'PROTECTION_AXIS_GATES_PASS_REVIEW_ONLY'
      else 'HOLD_NO_DISCRIMINATING_AXIS'
    end
    from gates
  ),
  'productionCutoverAuthorized', false,
  'outdoorRankableSignalAuthorized', false,
  'recommendationAuthorityMutated', false
);
$$;

comment on function public.read_data_ai29c_protection_expansion_audit_v1() is
  'DATA-AI29C-C5 read-only post-expansion sunscreen protection corpus audit. Includes legacy sunscreen Products and canonical catalog taxonomy shadow sunscreen Products; never authorizes Production cutover or Recommendation authority.';

revoke all on function public.read_data_ai29c_protection_expansion_audit_v1()
  from public, anon, authenticated, service_role;
grant execute on function public.read_data_ai29c_protection_expansion_audit_v1()
  to service_role;

commit;
