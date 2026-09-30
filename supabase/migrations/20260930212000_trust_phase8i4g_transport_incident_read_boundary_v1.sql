-- TRUST Phase 8I-4G: case-scoped service-role read boundary for transport incidents.
-- The Admin grouped-relocation service needs incident detail for a READY drift case,
-- while direct SELECT on transport incident authority tables remains intentionally revoked.
-- This function exposes only incidents already linked to the requested drift case and
-- grants no mutation, confirmation, semantic, Product Fact, or Recommendation authority.

create or replace function public.get_trust_official_source_transport_drift_case_incidents_v1(
  p_case_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select jsonb_build_object(
    'contract','trust-phase8i4g-drift-case-incidents-v1',
    'case_id',p_case_id,
    'found',exists(
      select 1
      from public.trust_official_source_transport_drift_cases c
      where c.case_id=p_case_id
    ),
    'incident_count',(
      select count(*)
      from public.trust_official_source_transport_drift_case_incidents l
      join public.trust_official_source_transport_incidents i
        on i.incident_id=l.incident_id
       and i.source_id=l.source_id
      where l.case_id=p_case_id
    ),
    'incidents',coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'incident_id',i.incident_id,
          'source_id',i.source_id,
          'target_key',i.target_key,
          'incident_kind',i.incident_kind,
          'effective_locator',i.effective_locator,
          'confirmed_final_locator',i.confirmed_final_locator,
          'episode_started_at',i.episode_started_at,
          'confirmed_at',i.confirmed_at,
          'incident_digest',i.incident_digest,
          'created_at',i.created_at
        )
        order by i.incident_id
      )
      from public.trust_official_source_transport_drift_case_incidents l
      join public.trust_official_source_transport_incidents i
        on i.incident_id=l.incident_id
       and i.source_id=l.source_id
      where l.case_id=p_case_id
    ),'[]'::jsonb),
    'authority','READ_ONLY_CASE_SCOPED_TRANSPORT_INCIDENT_VIEW_NO_AUTHORITY_MUTATION'
  );
$function$;

revoke all on function public.get_trust_official_source_transport_drift_case_incidents_v1(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_trust_official_source_transport_drift_case_incidents_v1(uuid)
  to service_role;

comment on function public.get_trust_official_source_transport_drift_case_incidents_v1(uuid) is
  'TRUST Phase 8I-4G governed case-scoped transport incident read for Admin grouped-relocation preflight; read-only and service-role-only.';
