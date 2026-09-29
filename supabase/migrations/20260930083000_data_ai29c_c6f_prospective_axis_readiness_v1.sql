begin;

create or replace function public.read_data_ai29c_prospective_protection_axis_readiness_v1()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
with source_audit as (
  select public.read_data_ai29c_protection_expansion_audit_v1() as audit
),
summary as (
  select audit, audit -> 'summary' as s
  from source_audit
),
axis_state as (
  select
    audit,
    s,
    coalesce((s ->> 'spfGatePass')::boolean, false) as spf_ready,
    coalesce((s ->> 'uvaGatePass')::boolean, false) as uva_ready,
    coalesce((s ->> 'waterGatePass')::boolean, false) as water_ready,
    coalesce((s ->> 'ambiguousOrMissingSubjectCount')::integer, 0) as subject_gap_count
  from summary
),
ready as (
  select
    audit,
    s,
    spf_ready,
    uva_ready,
    water_ready,
    subject_gap_count,
    array_remove(array[
      case when spf_ready then 'spf' end,
      case when uva_ready then 'uva' end,
      case when water_ready then 'waterResistance' end
    ]::text[], null) as ready_axes
  from axis_state
)
select jsonb_build_object(
  'contractVersion', 'data-ai29c-c6f-prospective-protection-axis-readiness-v1',
  'sourceAuditContractVersion', audit ->> 'contractVersion',
  'sourceAuditDecision', audit ->> 'decision',
  'prospectiveCorpus', true,
  'includesCatalogTaxonomyShadow', true,
  'sunscreenCount', (s ->> 'sunscreenCount')::integer,
  'legacyCategoryCount', (s ->> 'legacyCategoryCount')::integer,
  'catalogTaxonomyShadowCount', (s ->> 'catalogTaxonomyShadowCount')::integer,
  'exactCurrentSubjectCount', (s ->> 'exactCurrentSubjectCount')::integer,
  'ambiguousOrMissingSubjectCount', subject_gap_count,
  'axes', jsonb_build_object(
    'spf', jsonb_build_object(
      'eligibleCount', (s ->> 'spfEligibleCount')::integer,
      'eligibleCoverage', (s ->> 'spfCoverage')::numeric,
      'distinctScoringBuckets', (s ->> 'spfDistinctScoringBuckets')::integer,
      'minimumEligibleCoverage', 0.90,
      'minimumDistinctScoringBuckets', 2,
      'rankingUseful', spf_ready,
      'decision', case when spf_ready then 'READY_FOR_SHADOW_SCORING' else 'HOLD' end
    ),
    'uva', jsonb_build_object(
      'eligibleCount', (s ->> 'uvaEligibleCount')::integer,
      'eligibleCoverage', (s ->> 'uvaCoverage')::numeric,
      'distinctScoringBuckets', (s ->> 'uvaDistinctScoringBuckets')::integer,
      'minimumEligibleCoverage', 0.80,
      'minimumDistinctScoringBuckets', 2,
      'rankingUseful', uva_ready,
      'decision', case when uva_ready then 'READY_FOR_SHADOW_SCORING' else 'HOLD' end
    ),
    'waterResistance', jsonb_build_object(
      'eligibleCount', (s ->> 'waterEligibleCount')::integer,
      'eligibleCoverage', (s ->> 'waterCoverage')::numeric,
      'distinctScoringBuckets', (s ->> 'waterDistinctScoringBuckets')::integer,
      'minimumEligibleCoverage', 0.50,
      'minimumDistinctScoringBuckets', 2,
      'rankingUseful', water_ready,
      'decision', case when water_ready then 'READY_FOR_SHADOW_SCORING' else 'HOLD' end
    )
  ),
  'readyAxes', to_jsonb(ready_axes),
  'overallDecision', case
    when subject_gap_count > 0 then 'HOLD_INVALID_SUBJECT_COVERAGE'
    when cardinality(ready_axes) > 0 then 'SHADOW_SCORING_PARTIALLY_READY'
    else 'HOLD_NO_DISCRIMINATING_AXIS'
  end,
  'limits', jsonb_build_object(
    'productionRankingChanged', false,
    'productionCutoverAuthorized', false,
    'outdoorRankableSignalAuthorized', false,
    'recommendationAdmissionMutated', false,
    'publicActivation', false,
    'persistence', false
  )
)
from ready;
$$;

comment on function public.read_data_ai29c_prospective_protection_axis_readiness_v1() is
  'DATA-AI29C-C6F read-only prospective axis readiness over the expanded canonical sunscreen corpus. It may mark governed axes ready for shadow scoring only; it never changes Recommendation admission, production ranking, outdoor rankability, or public cutover.';

revoke all on function public.read_data_ai29c_prospective_protection_axis_readiness_v1()
  from public, anon, authenticated, service_role;
grant execute on function public.read_data_ai29c_prospective_protection_axis_readiness_v1()
  to service_role;

commit;
