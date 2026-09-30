-- TRUST Phase 8I-4G: service-role-only read boundary for scheduled first-real canary detection.
-- This function is read-only. It does not create, confirm, retire, relocate, adjudicate,
-- or otherwise mutate Product Fact, Evidence Source, Recommendation, or relocation authority.

create or replace function public.get_trust_phase8i4g_canary_snapshot_v1(
  p_limit integer default 1000
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 1000), 5000));
  v_evaluations jsonb;
  v_grouped_relocations jsonb;
  v_case_lineage jsonb;
  v_counts jsonb;
begin
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'evaluation_id', e.evaluation_id,
        'case_id', e.case_id,
        'request_id', e.request_id,
        'result_kind', e.result_kind,
        'candidate_locator', e.candidate_locator,
        'result_payload', e.result_payload,
        'created_at', e.created_at
      )
      order by e.created_at desc, e.evaluation_id desc
    ),
    '[]'::jsonb
  )
  into v_evaluations
  from (
    select
      evaluation_id,
      case_id,
      request_id,
      result_kind,
      candidate_locator,
      result_payload,
      created_at
    from public.trust_official_source_transport_drift_evaluations
    order by created_at desc, evaluation_id desc
    limit v_limit
  ) e;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'group_id', g.group_id,
        'case_id', g.case_id,
        'evaluation_id', g.evaluation_id,
        'relocation_id', g.relocation_id,
        'created_at', g.created_at
      )
      order by g.created_at, g.group_id
    ),
    '[]'::jsonb
  )
  into v_grouped_relocations
  from public.trust_official_source_relocation_groups g;

  select coalesce(
    jsonb_object_agg(
      c.case_id::text,
      jsonb_build_object(
        'product_id', c.product_id,
        'subject_id', c.subject_id,
        'source_ids', c.source_ids,
        'incident_ids', c.incident_ids
      )
    ),
    '{}'::jsonb
  )
  into v_case_lineage
  from (
    select
      dc.case_id,
      dc.product_id,
      dc.subject_id,
      coalesce(
        to_jsonb(
          array_agg(distinct l.source_id order by l.source_id)
            filter (where l.source_id is not null)
        ),
        '[]'::jsonb
      ) as source_ids,
      coalesce(
        to_jsonb(
          array_agg(distinct l.incident_id order by l.incident_id)
            filter (where l.incident_id is not null)
        ),
        '[]'::jsonb
      ) as incident_ids
    from public.trust_official_source_transport_drift_cases dc
    left join public.trust_official_source_transport_drift_case_incidents l
      on l.case_id = dc.case_id
    group by dc.case_id, dc.product_id, dc.subject_id
  ) c;

  v_counts := jsonb_build_object(
    'transport_incidents',
      (select count(*) from public.trust_official_source_transport_incidents),
    'drift_cases',
      (select count(*) from public.trust_official_source_transport_drift_cases),
    'drift_evaluations',
      (select count(*) from public.trust_official_source_transport_drift_evaluations),
    'grouped_relocations',
      (select count(*) from public.trust_official_source_relocation_groups),
    'grouped_sources',
      (select count(*) from public.trust_official_source_relocation_group_sources),
    'grouped_incidents',
      (select count(*) from public.trust_official_source_relocation_group_incidents),
    'relocations',
      (select count(*) from public.trust_official_source_relocations),
    'product_fact_instances',
      (select count(*) from public.product_fact_instances),
    'product_fact_current',
      (select count(*) from public.product_fact_current),
    'product_fact_confirmations',
      (select count(*) from public.product_fact_confirmations),
    'evidence_sources',
      (select count(*) from public.product_evidence_sources),
    'evidence_subject_bindings',
      (select count(*) from public.product_evidence_source_subject_bindings),
    'recommendation_logs',
      (select count(*) from public.recommendation_logs),
    'product_source_bindings',
      (select count(*) from public.product_source_bindings),
    'official_source_reviews',
      (select count(*) from public.trust_official_source_binding_reviews)
  );

  return jsonb_build_object(
    'contract', 'trust-phase8i4g-canary-read-model-v1',
    'phase', '8I-4G',
    'authority', 'READ_ONLY_SERVICE_ROLE_RPC_NO_AUTHORITY_MUTATION',
    'evaluations', v_evaluations,
    'grouped_relocations', v_grouped_relocations,
    'case_lineage', v_case_lineage,
    'counts', v_counts
  );
end;
$function$;

revoke all on function public.get_trust_phase8i4g_canary_snapshot_v1(integer)
  from public, anon, authenticated, service_role;
grant execute on function public.get_trust_phase8i4g_canary_snapshot_v1(integer)
  to service_role;

comment on function public.get_trust_phase8i4g_canary_snapshot_v1(integer) is
  'Service-role-only read boundary for Phase 8I-4G first-real canary detection. Reads governed operational and authority counts without granting direct table access or relocation authority.';
