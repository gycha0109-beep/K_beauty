begin;

create or replace function public.read_recommendation_shadow_evidence_v1(
  p_window_start date,
  p_window_end_exclusive date
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if p_window_start is null or p_window_end_exclusive is null then
    raise exception 'V21_9M_WINDOW_REQUIRED';
  end if;

  if p_window_start >= p_window_end_exclusive then
    raise exception 'V21_9M_WINDOW_INVALID';
  end if;

  if p_window_start < date '2026-08-20' then
    raise exception 'V21_9M_WINDOW_BEFORE_DURABLE_COLLECTION_START';
  end if;

  with base as (
    select *
    from public.recommendation_shadow_evidence_daily_v1
    where bucket_date >= p_window_start
      and bucket_date < p_window_end_exclusive
  ),
  source_vocab(production_source) as (
    values
      ('ORGANIC_PRODUCTION'::text),
      ('CONTROLLED_PRODUCTION_PROBE'::text),
      ('UNKNOWN_PRODUCTION_SOURCE'::text)
  ),
  total_rows as (
    select * from base
    where partition_key = 'TOTAL' and partition_value = 'ALL'
  ),
  source_agg as (
    select
      production_source,
      sum(execution_count)::bigint as execution_count,
      sum(candidate_evaluation_count)::bigint as candidate_evaluation_count,
      sum(allow_count)::bigint as allow_count,
      sum(caution_count)::bigint as caution_count,
      sum(restrict_count)::bigint as restrict_count,
      sum(defer_count)::bigint as defer_count,
      sum(not_applicable_count)::bigint as not_applicable_count,
      sum(fallback_count)::bigint as fallback_count,
      sum(runtime_error_count)::bigint as runtime_error_count,
      sum(hypothetical_exclusion_count)::bigint as hypothetical_exclusion_count,
      sum(actual_exclusion_count)::bigint as actual_exclusion_count,
      sum(stop_required_count)::bigint as stop_required_count
    from total_rows
    group by production_source
  ),
  source_objects as (
    select
      s.production_source,
      jsonb_build_object(
        'execution_count', coalesce(a.execution_count, 0),
        'candidate_evaluation_count', coalesce(a.candidate_evaluation_count, 0),
        'actions', jsonb_build_object(
          'ALLOW', coalesce(a.allow_count, 0),
          'CAUTION', coalesce(a.caution_count, 0),
          'RESTRICT', coalesce(a.restrict_count, 0),
          'DEFER', coalesce(a.defer_count, 0),
          'NOT_APPLICABLE', coalesce(a.not_applicable_count, 0)
        ),
        'fallback_count', coalesce(a.fallback_count, 0),
        'runtime_error_count', coalesce(a.runtime_error_count, 0),
        'hypothetical_exclusion_count', coalesce(a.hypothetical_exclusion_count, 0),
        'actual_exclusion_count', coalesce(a.actual_exclusion_count, 0),
        'stop_required_count', coalesce(a.stop_required_count, 0)
      ) as payload
    from source_vocab s
    left join source_agg a using (production_source)
  ),
  version_groups as (
    select distinct
      evidence_schema_version,
      activation_version,
      policy_contract_version,
      runtime_version,
      context_bucket_version
    from total_rows
  ),
  marginal_rows as (
    select
      production_source,
      partition_key,
      partition_value,
      sum(execution_count)::bigint as execution_count
    from base
    where partition_key not in ('TOTAL', 'STOP_REASON')
    group by production_source, partition_key, partition_value
  ),
  stop_rows as (
    select
      production_source,
      partition_value as stop_reason,
      sum(stop_required_count)::bigint as stop_required_count
    from base
    where partition_key = 'STOP_REASON'
    group by production_source, partition_value
  )
  select jsonb_build_object(
    'readback_schema_version', 'recommendation-shadow-evidence-readback-v1',
    'storage_schema_version', 'exfoliation-normative-organic-shadow-evidence-daily-v1',
    'context_bucket_version', 'privacy-safe-recommendation-context-bucket-v1',
    'window', jsonb_build_object(
      'start_inclusive', p_window_start,
      'end_exclusive', p_window_end_exclusive
    ),
    'observed_days', (select count(distinct bucket_date)::bigint from total_rows),
    'observed_day_min', (select min(bucket_date) from total_rows),
    'observed_day_max', (select max(bucket_date) from total_rows),
    'version_groups', coalesce((
      select jsonb_agg(to_jsonb(v) order by evidence_schema_version, activation_version, policy_contract_version, runtime_version, context_bucket_version)
      from version_groups v
    ), '[]'::jsonb),
    'sources', (select jsonb_object_agg(production_source, payload order by production_source) from source_objects),
    'context_marginals', coalesce((
      select jsonb_agg(to_jsonb(m) order by production_source, partition_key, partition_value)
      from marginal_rows m
    ), '[]'::jsonb),
    'stop_reason_distribution', coalesce((
      select jsonb_agg(to_jsonb(s) order by production_source, stop_reason)
      from stop_rows s
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

comment on function public.read_recommendation_shadow_evidence_v1(date, date) is
  'V2.1-9M aggregate-only readback for durable SHADOW evidence. Window is [start,end); no user, session, product identity, raw request, free text, or per-execution rows are returned.';

revoke all on function public.read_recommendation_shadow_evidence_v1(date, date)
  from public, anon, authenticated;
grant execute on function public.read_recommendation_shadow_evidence_v1(date, date)
  to service_role;

commit;
