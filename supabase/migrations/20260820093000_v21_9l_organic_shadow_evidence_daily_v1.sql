begin;

create table public.recommendation_shadow_evidence_daily_v1 (
  bucket_date date not null,
  evidence_schema_version text not null,
  activation_version text not null,
  policy_contract_version text not null,
  runtime_version text not null,
  production_source text not null,
  context_bucket_version text not null,
  partition_key text not null,
  partition_value text not null,
  execution_count bigint not null default 0 check (execution_count >= 0),
  candidate_evaluation_count bigint not null default 0 check (candidate_evaluation_count >= 0),
  allow_count bigint not null default 0 check (allow_count >= 0),
  caution_count bigint not null default 0 check (caution_count >= 0),
  restrict_count bigint not null default 0 check (restrict_count >= 0),
  defer_count bigint not null default 0 check (defer_count >= 0),
  not_applicable_count bigint not null default 0 check (not_applicable_count >= 0),
  fallback_count bigint not null default 0 check (fallback_count >= 0),
  runtime_error_count bigint not null default 0 check (runtime_error_count >= 0),
  hypothetical_exclusion_count bigint not null default 0 check (hypothetical_exclusion_count >= 0),
  actual_exclusion_count bigint not null default 0 check (actual_exclusion_count = 0),
  stop_required_count bigint not null default 0 check (stop_required_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recommendation_shadow_evidence_daily_source_check
    check (production_source in (
      'ORGANIC_PRODUCTION',
      'CONTROLLED_PRODUCTION_PROBE',
      'UNKNOWN_PRODUCTION_SOURCE'
    )),
  constraint recommendation_shadow_evidence_daily_schema_check
    check (evidence_schema_version = 'exfoliation-normative-organic-shadow-evidence-daily-v1'),
  constraint recommendation_shadow_evidence_daily_context_version_check
    check (context_bucket_version = 'privacy-safe-recommendation-context-bucket-v1'),
  constraint recommendation_shadow_evidence_daily_partition_key_check
    check (partition_key in (
      'TOTAL',
      'PRIMARY_CONCERN_CLASS',
      'SENSITIVITY_RISK_CLASS',
      'CONCERN_STRUCTURE_CLASS',
      'SURVEY_COMPLETENESS_CLASS',
      'RECENT_INSTABILITY_CLASS',
      'STOP_REASON'
    )),
  constraint recommendation_shadow_evidence_daily_partition_value_check
    check (
      (partition_key = 'TOTAL' and partition_value = 'ALL')
      or (partition_key = 'PRIMARY_CONCERN_CLASS' and partition_value in (
        'barrier', 'dehydration', 'oiliness', 'redness', 'acne', 'pores', 'uneven_tone', 'uv', 'UNKNOWN'
      ))
      or (partition_key = 'SENSITIVITY_RISK_CLASS' and partition_value in (
        'LOW', 'MEDIUM', 'HIGH', 'UNKNOWN'
      ))
      or (partition_key = 'CONCERN_STRUCTURE_CLASS' and partition_value in (
        'NONE', 'SINGLE', 'MULTI'
      ))
      or (partition_key = 'SURVEY_COMPLETENESS_CLASS' and partition_value in (
        'COMPLETE', 'PARTIAL'
      ))
      or (partition_key = 'RECENT_INSTABILITY_CLASS' and partition_value in (
        'PRESENT', 'ABSENT', 'UNKNOWN'
      ))
      or (partition_key = 'STOP_REASON' and partition_value in (
        'activation_gate_rejected',
        'evaluator_error',
        'fallback_legacy_not_preserved',
        'invalid_policy_output',
        'invalid_telemetry',
        'kill_switch_execution_violation',
        'response_schema_changed',
        'shadow_canonical_eligibility_delta',
        'shadow_persistence_delta',
        'shadow_public_response_delta',
        'shadow_ranking_delta',
        'shadow_score_delta',
        'shadow_top1_top3_delta',
        'unexpected_db_mutation',
        'unexpected_storage_mutation',
        'unsupported_activation_scope',
        'version_mismatch'
      ))
    ),
  constraint recommendation_shadow_evidence_daily_versions_check
    check (
      char_length(activation_version) between 1 and 160
      and char_length(policy_contract_version) between 1 and 160
      and char_length(runtime_version) between 1 and 160
    ),
  primary key (
    bucket_date,
    evidence_schema_version,
    activation_version,
    policy_contract_version,
    runtime_version,
    production_source,
    context_bucket_version,
    partition_key,
    partition_value
  )
);

comment on table public.recommendation_shadow_evidence_daily_v1 is
  'V2.1-9L privacy-safe daily aggregate SHADOW governance evidence. Contains bounded marginal context counts only; no user/session/product identity or raw Recommendation payload.';

create index recommendation_shadow_evidence_daily_lookup_idx
  on public.recommendation_shadow_evidence_daily_v1 (
    bucket_date,
    production_source,
    partition_key,
    partition_value
  );

alter table public.recommendation_shadow_evidence_daily_v1 enable row level security;

revoke all on table public.recommendation_shadow_evidence_daily_v1
  from public, anon, authenticated, service_role;
grant select on table public.recommendation_shadow_evidence_daily_v1 to service_role;

create or replace function public.record_recommendation_shadow_evidence_daily_v1(
  p_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb;
  v_expected_keys text[] := array[
    'activation_version',
    'actual_exclusion_count',
    'allow_count',
    'bucket_date',
    'candidate_evaluation_count',
    'caution_count',
    'context_bucket_version',
    'defer_count',
    'evidence_schema_version',
    'execution_count',
    'fallback_count',
    'hypothetical_exclusion_count',
    'not_applicable_count',
    'partition_key',
    'partition_value',
    'policy_contract_version',
    'production_source',
    'restrict_count',
    'runtime_error_count',
    'runtime_version',
    'stop_required_count'
  ];
  v_actual_keys text[];
  v_written integer := 0;
  v_source text;
  v_partition_key text;
  v_partition_value text;
  v_execution_count bigint;
  v_candidate_evaluation_count bigint;
  v_allow_count bigint;
  v_caution_count bigint;
  v_restrict_count bigint;
  v_defer_count bigint;
  v_not_applicable_count bigint;
  v_fallback_count bigint;
  v_runtime_error_count bigint;
  v_hypothetical_exclusion_count bigint;
  v_actual_exclusion_count bigint;
  v_stop_required_count bigint;
begin
  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'V21_9L_ROWS_NOT_ARRAY';
  end if;

  if jsonb_array_length(p_rows) < 1 or jsonb_array_length(p_rows) > 32 then
    raise exception 'V21_9L_ROW_COUNT_INVALID';
  end if;

  for v_row in select value from jsonb_array_elements(p_rows)
  loop
    if jsonb_typeof(v_row) <> 'object' then
      raise exception 'V21_9L_ROW_NOT_OBJECT';
    end if;

    select array_agg(key order by key)
      into v_actual_keys
      from jsonb_object_keys(v_row) as key;

    if v_actual_keys is distinct from v_expected_keys then
      raise exception 'V21_9L_ROW_KEYS_INVALID';
    end if;

    if (v_row->>'evidence_schema_version') <> 'exfoliation-normative-organic-shadow-evidence-daily-v1' then
      raise exception 'V21_9L_SCHEMA_VERSION_INVALID';
    end if;

    if (v_row->>'context_bucket_version') <> 'privacy-safe-recommendation-context-bucket-v1' then
      raise exception 'V21_9L_CONTEXT_VERSION_INVALID';
    end if;

    if coalesce(char_length(v_row->>'activation_version'), 0) not between 1 and 160
       or coalesce(char_length(v_row->>'policy_contract_version'), 0) not between 1 and 160
       or coalesce(char_length(v_row->>'runtime_version'), 0) not between 1 and 160 then
      raise exception 'V21_9L_RUNTIME_VERSION_INVALID';
    end if;

    v_source := v_row->>'production_source';
    if v_source not in (
      'ORGANIC_PRODUCTION',
      'CONTROLLED_PRODUCTION_PROBE',
      'UNKNOWN_PRODUCTION_SOURCE'
    ) then
      raise exception 'V21_9L_SOURCE_INVALID';
    end if;

    v_partition_key := v_row->>'partition_key';
    v_partition_value := v_row->>'partition_value';

    if not (
      (v_partition_key = 'TOTAL' and v_partition_value = 'ALL')
      or (v_partition_key = 'PRIMARY_CONCERN_CLASS' and v_partition_value in (
        'barrier', 'dehydration', 'oiliness', 'redness', 'acne', 'pores', 'uneven_tone', 'uv', 'UNKNOWN'
      ))
      or (v_partition_key = 'SENSITIVITY_RISK_CLASS' and v_partition_value in (
        'LOW', 'MEDIUM', 'HIGH', 'UNKNOWN'
      ))
      or (v_partition_key = 'CONCERN_STRUCTURE_CLASS' and v_partition_value in (
        'NONE', 'SINGLE', 'MULTI'
      ))
      or (v_partition_key = 'SURVEY_COMPLETENESS_CLASS' and v_partition_value in (
        'COMPLETE', 'PARTIAL'
      ))
      or (v_partition_key = 'RECENT_INSTABILITY_CLASS' and v_partition_value in (
        'PRESENT', 'ABSENT', 'UNKNOWN'
      ))
      or (v_partition_key = 'STOP_REASON' and v_partition_value in (
        'activation_gate_rejected',
        'evaluator_error',
        'fallback_legacy_not_preserved',
        'invalid_policy_output',
        'invalid_telemetry',
        'kill_switch_execution_violation',
        'response_schema_changed',
        'shadow_canonical_eligibility_delta',
        'shadow_persistence_delta',
        'shadow_public_response_delta',
        'shadow_ranking_delta',
        'shadow_score_delta',
        'shadow_top1_top3_delta',
        'unexpected_db_mutation',
        'unexpected_storage_mutation',
        'unsupported_activation_scope',
        'version_mismatch'
      ))
    ) then
      raise exception 'V21_9L_PARTITION_INVALID';
    end if;

    begin
      v_execution_count := (v_row->>'execution_count')::bigint;
      v_candidate_evaluation_count := (v_row->>'candidate_evaluation_count')::bigint;
      v_allow_count := (v_row->>'allow_count')::bigint;
      v_caution_count := (v_row->>'caution_count')::bigint;
      v_restrict_count := (v_row->>'restrict_count')::bigint;
      v_defer_count := (v_row->>'defer_count')::bigint;
      v_not_applicable_count := (v_row->>'not_applicable_count')::bigint;
      v_fallback_count := (v_row->>'fallback_count')::bigint;
      v_runtime_error_count := (v_row->>'runtime_error_count')::bigint;
      v_hypothetical_exclusion_count := (v_row->>'hypothetical_exclusion_count')::bigint;
      v_actual_exclusion_count := (v_row->>'actual_exclusion_count')::bigint;
      v_stop_required_count := (v_row->>'stop_required_count')::bigint;
    exception when others then
      raise exception 'V21_9L_COUNTER_INVALID';
    end;

    if least(
      v_execution_count,
      v_candidate_evaluation_count,
      v_allow_count,
      v_caution_count,
      v_restrict_count,
      v_defer_count,
      v_not_applicable_count,
      v_fallback_count,
      v_runtime_error_count,
      v_hypothetical_exclusion_count,
      v_actual_exclusion_count,
      v_stop_required_count
    ) < 0 then
      raise exception 'V21_9L_COUNTER_NEGATIVE';
    end if;

    if v_actual_exclusion_count <> 0 then
      raise exception 'V21_9L_SHADOW_ACTUAL_EXCLUSION_NONZERO';
    end if;

    insert into public.recommendation_shadow_evidence_daily_v1 (
      bucket_date,
      evidence_schema_version,
      activation_version,
      policy_contract_version,
      runtime_version,
      production_source,
      context_bucket_version,
      partition_key,
      partition_value,
      execution_count,
      candidate_evaluation_count,
      allow_count,
      caution_count,
      restrict_count,
      defer_count,
      not_applicable_count,
      fallback_count,
      runtime_error_count,
      hypothetical_exclusion_count,
      actual_exclusion_count,
      stop_required_count
    ) values (
      (v_row->>'bucket_date')::date,
      v_row->>'evidence_schema_version',
      v_row->>'activation_version',
      v_row->>'policy_contract_version',
      v_row->>'runtime_version',
      v_source,
      v_row->>'context_bucket_version',
      v_partition_key,
      v_partition_value,
      v_execution_count,
      v_candidate_evaluation_count,
      v_allow_count,
      v_caution_count,
      v_restrict_count,
      v_defer_count,
      v_not_applicable_count,
      v_fallback_count,
      v_runtime_error_count,
      v_hypothetical_exclusion_count,
      v_actual_exclusion_count,
      v_stop_required_count
    )
    on conflict (
      bucket_date,
      evidence_schema_version,
      activation_version,
      policy_contract_version,
      runtime_version,
      production_source,
      context_bucket_version,
      partition_key,
      partition_value
    ) do update set
      execution_count = recommendation_shadow_evidence_daily_v1.execution_count + excluded.execution_count,
      candidate_evaluation_count = recommendation_shadow_evidence_daily_v1.candidate_evaluation_count + excluded.candidate_evaluation_count,
      allow_count = recommendation_shadow_evidence_daily_v1.allow_count + excluded.allow_count,
      caution_count = recommendation_shadow_evidence_daily_v1.caution_count + excluded.caution_count,
      restrict_count = recommendation_shadow_evidence_daily_v1.restrict_count + excluded.restrict_count,
      defer_count = recommendation_shadow_evidence_daily_v1.defer_count + excluded.defer_count,
      not_applicable_count = recommendation_shadow_evidence_daily_v1.not_applicable_count + excluded.not_applicable_count,
      fallback_count = recommendation_shadow_evidence_daily_v1.fallback_count + excluded.fallback_count,
      runtime_error_count = recommendation_shadow_evidence_daily_v1.runtime_error_count + excluded.runtime_error_count,
      hypothetical_exclusion_count = recommendation_shadow_evidence_daily_v1.hypothetical_exclusion_count + excluded.hypothetical_exclusion_count,
      actual_exclusion_count = recommendation_shadow_evidence_daily_v1.actual_exclusion_count + excluded.actual_exclusion_count,
      stop_required_count = recommendation_shadow_evidence_daily_v1.stop_required_count + excluded.stop_required_count,
      updated_at = now();

    v_written := v_written + 1;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'rows_written', v_written,
    'storage_schema_version', 'exfoliation-normative-organic-shadow-evidence-daily-v1'
  );
end;
$$;

revoke all on function public.record_recommendation_shadow_evidence_daily_v1(jsonb)
  from public, anon, authenticated;
grant execute on function public.record_recommendation_shadow_evidence_daily_v1(jsonb)
  to service_role;

commit;
