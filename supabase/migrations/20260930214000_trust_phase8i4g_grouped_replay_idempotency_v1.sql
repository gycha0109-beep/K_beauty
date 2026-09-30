-- TRUST Phase 8I-4G: make grouped relocation confirmation exactly idempotent after first mutation.
-- The original Phase 8I-4E function revalidated mutable prestate before checking the
-- persisted group. After a successful first confirmation the old binding is retired,
-- so an exact replay incorrectly failed stale-prestate before reaching its idempotent branch.
--
-- This replacement preserves all payload/identity/digest validation, authority checks,
-- explicit-admin confirmation, advisory locking and mutation boundaries. It only moves
-- the persisted-group replay check ahead of mutable preflight revalidation. New requests
-- still execute the full current preflight and Phase 8H confirmation path.

create or replace function public.admin_confirm_trust_official_source_grouped_relocation_v1(
  p_actor_user_id uuid,
  p_request_id text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_actor_role text;
  v_request_id text := btrim(coalesce(p_request_id,''));
  v_case_id uuid;
  v_evaluation_id uuid;
  v_product_id uuid;
  v_subject_id uuid;
  v_anchor_id uuid;
  v_old_binding_id uuid;
  v_old_review_id uuid;
  v_preflight jsonb;
  v_nested jsonb;
  v_phase8h_result jsonb;
  v_existing public.trust_official_source_relocation_groups%rowtype;
  v_group public.trust_official_source_relocation_groups%rowtype;
  v_relocation_id uuid;
  v_replacement_binding_id uuid;
  v_replacement_review_id uuid;
  v_audit_id uuid;
begin
  v_actor_role := public.admin_require_product_review_actor(
    p_actor_user_id,
    'admin.products.review'
  );

  if char_length(v_request_id) not between 8 and 120
    or p_payload is null
    or jsonb_typeof(p_payload)<>'object'
    or not (p_payload ?& array[
      'contract','case_id','evaluation_id','product_id','subject_id',
      'qualified_historical_source_id','historical_source_ids','incident_ids',
      'expected_group_prestate_digest','group_plan_digest',
      'qualification_contract','qualification_digest',
      'old_binding_id','old_review_id','old_locator','replacement',
      'preflight_contract','preflight_authority',
      'phase8h_anchor_prestate_digest',
      'phase8h_anchor_relocation_plan_digest',
      'phase8h_anchor_confirmation_request',
      'authority','mutation_scope','forbidden_mutations'
    ])
    or (select count(*) from jsonb_object_keys(p_payload))<>24
    or p_payload->>'contract'<>'trust-phase8i4-grouped-relocation-confirmation-request-v1'
    or p_payload->>'authority'<>'ADMIN_GROUPED_CONFIRMATION_REQUEST_REQUIRES_DATABASE_REVALIDATION'
    or p_payload->>'preflight_contract'<>'trust-phase8i4-grouped-relocation-preflight-v1'
    or p_payload->>'preflight_authority'<>'PREFLIGHT_ONLY_REQUIRES_EXPLICIT_ADMIN_GROUPED_CONFIRMATION'
    or p_payload->'mutation_scope'<>'[
      "CREATE_OR_REUSE_REPLACEMENT_PRODUCT_SOURCE_BINDING",
      "CREATE_OR_REUSE_REPLACEMENT_OFFICIAL_SOURCE_REVIEW",
      "RETIRE_OLD_REVIEWED_BINDING_ONCE",
      "APPEND_SINGLE_RELOCATION_AUTHORITY_ROW",
      "APPEND_GROUPED_RELOCATION_HEADER",
      "APPEND_COMPLETE_GROUPED_SOURCE_LINEAGE",
      "APPEND_COMPLETE_GROUPED_INCIDENT_LINEAGE",
      "APPEND_ADMIN_AUDIT_EVENT"
    ]'::jsonb
    or p_payload->'forbidden_mutations'<>'[
      "PRODUCT_EVIDENCE_SOURCE_CANONICAL_LOCATOR",
      "PRODUCT_EVIDENCE_SOURCE_CONTENT_DIGEST",
      "PRODUCT_EVIDENCE_SOURCE_SUBJECT_BINDING",
      "PRODUCT_FACT_INSTANCE",
      "PRODUCT_FACT_CURRENT",
      "PRODUCT_FACT_CONFIRMATION",
      "RECOMMENDATION_AUTHORITY",
      "RECOMMENDATION_LOG",
      "SEMANTIC_SAME_CHANGED_RESOLUTION"
    ]'::jsonb
  then
    raise exception 'trust_phase8i4_grouped_confirmation_payload_invalid' using errcode='22023';
  end if;

  begin
    v_case_id := (p_payload->>'case_id')::uuid;
    v_evaluation_id := (p_payload->>'evaluation_id')::uuid;
    v_product_id := (p_payload->>'product_id')::uuid;
    v_subject_id := (p_payload->>'subject_id')::uuid;
    v_anchor_id := (p_payload->>'qualified_historical_source_id')::uuid;
    v_old_binding_id := (p_payload->>'old_binding_id')::uuid;
    v_old_review_id := (p_payload->>'old_review_id')::uuid;
  exception when others then
    raise exception 'trust_phase8i4_grouped_confirmation_identity_invalid' using errcode='22023';
  end;

  if p_payload->>'expected_group_prestate_digest' !~ '^[0-9a-f]{64}$'
    or p_payload->>'group_plan_digest' !~ '^[0-9a-f]{64}$'
    or p_payload->>'phase8h_anchor_prestate_digest' !~ '^[0-9a-f]{64}$'
    or p_payload->>'phase8h_anchor_relocation_plan_digest' !~ '^[0-9a-f]{64}$'
    or p_payload->>'qualification_contract'<>'trust-phase8h-source-identity-qualification-v1'
    or p_payload->>'qualification_digest' !~ '^[0-9a-f]{64}$'
    or jsonb_typeof(p_payload->'historical_source_ids')<>'array'
    or jsonb_typeof(p_payload->'incident_ids')<>'array'
    or jsonb_typeof(p_payload->'replacement')<>'object'
    or jsonb_typeof(p_payload->'phase8h_anchor_confirmation_request')<>'object'
  then
    raise exception 'trust_phase8i4_grouped_confirmation_payload_invalid' using errcode='22023';
  end if;

  if p_payload->'replacement'->>'source_name' is distinct from (
      select b.source_name from public.product_source_bindings b where b.binding_id=v_old_binding_id
    )
    or p_payload->'replacement'->>'external_type' is distinct from (
      select b.external_type from public.product_source_bindings b where b.binding_id=v_old_binding_id
    )
    or nullif(p_payload->'replacement'->>'market_code','') is distinct from (
      select b.market_code from public.product_source_bindings b where b.binding_id=v_old_binding_id
    )
    or nullif(p_payload->'replacement'->>'locale','') is distinct from (
      select b.locale from public.product_source_bindings b where b.binding_id=v_old_binding_id
    )
  then
    raise exception 'trust_phase8i4_grouped_confirmation_replacement_scope_mismatch' using errcode='23514';
  end if;

  v_nested := p_payload->'phase8h_anchor_confirmation_request';

  if v_nested->>'contract'<>'trust-phase8h-governed-relocation-confirmation-request-v1'
    or v_nested->>'historical_source_id' is distinct from v_anchor_id::text
    or v_nested->>'product_id' is distinct from v_product_id::text
    or v_nested->>'subject_id' is distinct from v_subject_id::text
    or v_nested->>'old_binding_id' is distinct from v_old_binding_id::text
    or v_nested->>'old_review_id' is distinct from v_old_review_id::text
    or v_nested->>'old_locator' is distinct from p_payload->>'old_locator'
    or v_nested->>'expected_prestate_digest' is distinct from p_payload->>'phase8h_anchor_prestate_digest'
    or v_nested->>'relocation_plan_digest' is distinct from p_payload->>'phase8h_anchor_relocation_plan_digest'
    or v_nested->>'qualification_contract' is distinct from p_payload->>'qualification_contract'
    or v_nested->>'qualification_digest' is distinct from p_payload->>'qualification_digest'
    or v_nested->'replacement'<>p_payload->'replacement'
  then
    raise exception 'trust_phase8i4_grouped_confirmation_phase8h_bridge_mismatch' using errcode='23514';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'bejewely_trust_official_source_grouped_relocation:' ||
      (p_payload->>'group_plan_digest'),
      0
    )
  );

  select * into v_existing
  from public.trust_official_source_relocation_groups g
  where g.group_plan_digest=p_payload->>'group_plan_digest';

  if found then
    if v_existing.case_id<>v_case_id
      or v_existing.evaluation_id<>v_evaluation_id
      or v_existing.qualified_historical_source_id<>v_anchor_id
      or v_existing.product_id<>v_product_id
      or v_existing.subject_id<>v_subject_id
      or v_existing.old_binding_id<>v_old_binding_id
      or v_existing.old_review_id<>v_old_review_id
      or v_existing.qualification_digest<>p_payload->>'qualification_digest'
      or v_existing.group_prestate_digest<>p_payload->>'expected_group_prestate_digest'
      or v_existing.phase8h_anchor_prestate_digest<>p_payload->>'phase8h_anchor_prestate_digest'
      or v_existing.phase8h_anchor_relocation_plan_digest<>p_payload->>'phase8h_anchor_relocation_plan_digest'
      or v_existing.actor_user_id<>p_actor_user_id
      or v_existing.request_id<>v_request_id
      or v_existing.group_version<>'trust-official-source-grouped-relocation-v1'
      or v_existing.result<>'confirmed'
    then
      raise exception 'trust_phase8i4_grouped_confirmation_idempotency_conflict' using errcode='23505';
    end if;

    return jsonb_build_object(
      'status','confirmed',
      'idempotent',true,
      'group_id',v_existing.group_id,
      'relocation_id',v_existing.relocation_id,
      'replacement_binding_id',v_existing.replacement_binding_id,
      'replacement_review_id',v_existing.replacement_review_id,
      'case_id',v_existing.case_id,
      'evaluation_id',v_existing.evaluation_id,
      'product_id',v_existing.product_id,
      'subject_id',v_existing.subject_id
    );
  end if;

  v_preflight := public.admin_preflight_trust_official_source_grouped_relocation_v1(
    p_actor_user_id,
    v_case_id,
    v_evaluation_id
  );

  if v_preflight->>'status'<>'READY_FOR_ADMIN_GROUPED_RELOCATION_CONFIRMATION'
    or v_preflight->>'authority'<>'PREFLIGHT_ONLY_REQUIRES_EXPLICIT_ADMIN_GROUPED_CONFIRMATION'
    or v_preflight->>'case_id' is distinct from v_case_id::text
    or v_preflight->>'evaluation_id' is distinct from v_evaluation_id::text
    or v_preflight->>'product_id' is distinct from v_product_id::text
    or v_preflight->>'subject_id' is distinct from v_subject_id::text
    or v_preflight->>'qualified_historical_source_id' is distinct from v_anchor_id::text
    or v_preflight->>'old_binding_id' is distinct from v_old_binding_id::text
    or v_preflight->>'old_review_id' is distinct from v_old_review_id::text
    or v_preflight->>'old_locator' is distinct from p_payload->>'old_locator'
    or v_preflight->>'replacement_locator' is distinct from p_payload->'replacement'->>'source_url'
    or v_preflight->>'replacement_external_id' is distinct from p_payload->'replacement'->>'external_id'
    or v_preflight->>'qualification_contract' is distinct from p_payload->>'qualification_contract'
    or v_preflight->>'qualification_digest' is distinct from p_payload->>'qualification_digest'
    or v_preflight->>'group_prestate_digest' is distinct from p_payload->>'expected_group_prestate_digest'
    or v_preflight->>'group_plan_digest' is distinct from p_payload->>'group_plan_digest'
    or v_preflight->>'phase8h_anchor_prestate_digest' is distinct from p_payload->>'phase8h_anchor_prestate_digest'
    or v_preflight->>'phase8h_anchor_relocation_plan_digest' is distinct from p_payload->>'phase8h_anchor_relocation_plan_digest'
    or v_preflight->'historical_source_ids'<>p_payload->'historical_source_ids'
    or v_preflight->'incident_ids'<>p_payload->'incident_ids'
  then
    raise exception 'trust_phase8i4_grouped_confirmation_prestate_stale' using errcode='40001';
  end if;

  v_phase8h_result := public.admin_confirm_trust_official_source_relocation_v1(
    p_actor_user_id,
    v_request_id,
    v_nested
  );

  if v_phase8h_result->>'status'<>'confirmed' then
    raise exception 'trust_phase8i4_grouped_confirmation_phase8h_not_confirmed' using errcode='40001';
  end if;

  begin
    v_relocation_id := (v_phase8h_result->>'relocation_id')::uuid;
    v_replacement_binding_id := (v_phase8h_result->>'replacement_binding_id')::uuid;
    v_replacement_review_id := (v_phase8h_result->>'replacement_review_id')::uuid;
  exception when others then
    raise exception 'trust_phase8i4_grouped_confirmation_phase8h_result_invalid' using errcode='40001';
  end;

  insert into public.trust_official_source_relocation_groups(
    case_id,evaluation_id,qualified_historical_source_id,relocation_id,
    product_id,subject_id,old_binding_id,old_review_id,
    replacement_binding_id,replacement_review_id,
    qualification_digest,group_prestate_digest,group_plan_digest,
    phase8h_anchor_prestate_digest,phase8h_anchor_relocation_plan_digest,
    authority,actor_user_id,request_id,group_version,result
  ) values (
    v_case_id,v_evaluation_id,v_anchor_id,v_relocation_id,
    v_product_id,v_subject_id,v_old_binding_id,v_old_review_id,
    v_replacement_binding_id,v_replacement_review_id,
    p_payload->>'qualification_digest',
    p_payload->>'expected_group_prestate_digest',
    p_payload->>'group_plan_digest',
    p_payload->>'phase8h_anchor_prestate_digest',
    p_payload->>'phase8h_anchor_relocation_plan_digest',
    'EXPLICIT_ADMIN_GROUPED_RELOCATION_CONFIRMATION',
    p_actor_user_id,v_request_id,
    'trust-official-source-grouped-relocation-v1','confirmed'
  )
  returning * into v_group;

  insert into public.trust_official_source_relocation_group_sources(
    group_id,source_id,source_subject_binding_id,
    canonical_locator,content_digest,
    source_snapshot,subject_binding_snapshot
  )
  select
    v_group.group_id,
    s.source_id,
    b.binding_id,
    s.canonical_locator,
    s.content_digest,
    jsonb_build_object(
      'source_id',s.source_id,
      'canonical_locator',s.canonical_locator,
      'publisher',s.publisher,
      'source_kind',s.source_kind,
      'market',s.market,
      'region',s.region,
      'locale',s.locale,
      'content_digest',s.content_digest,
      'external_snapshot_reference',s.external_snapshot_reference,
      'published_at',s.published_at,
      'accessed_at',s.accessed_at,
      'observed_at',s.observed_at,
      'created_at',s.created_at
    ),
    jsonb_build_object(
      'binding_id',b.binding_id,
      'source_id',b.source_id,
      'product_id',b.product_id,
      'subject_id',b.subject_id,
      'binding_state',b.binding_state,
      'scope_relation',b.scope_relation,
      'identity_resolution_version',b.identity_resolution_version,
      'reviewed_by',b.reviewed_by,
      'reviewed_at',b.reviewed_at,
      'created_at',b.created_at
    )
  from (
    select distinct l.source_id
    from public.trust_official_source_transport_drift_case_incidents l
    where l.case_id=v_case_id
  ) src
  join public.product_evidence_sources s on s.source_id=src.source_id
  join public.product_evidence_source_subject_bindings b
    on b.source_id=s.source_id
   and b.product_id=v_product_id
   and b.subject_id=v_subject_id
   and b.binding_state='exact_subject_match'
   and b.scope_relation in ('equivalent','narrower')
  order by s.source_id;

  if (select count(*) from public.trust_official_source_relocation_group_sources s where s.group_id=v_group.group_id)
    <> jsonb_array_length(p_payload->'historical_source_ids')
  then
    raise exception 'trust_phase8i4_grouped_confirmation_source_lineage_incomplete' using errcode='40001';
  end if;

  insert into public.trust_official_source_relocation_group_incidents(
    group_id,incident_id,source_id,incident_digest,incident_snapshot
  )
  select
    v_group.group_id,
    i.incident_id,
    i.source_id,
    i.incident_digest,
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
  from public.trust_official_source_transport_drift_case_incidents l
  join public.trust_official_source_transport_incidents i
    on i.incident_id=l.incident_id
   and i.source_id=l.source_id
  where l.case_id=v_case_id
  order by i.incident_id;

  if (select count(*) from public.trust_official_source_relocation_group_incidents i where i.group_id=v_group.group_id)
    <> jsonb_array_length(p_payload->'incident_ids')
  then
    raise exception 'trust_phase8i4_grouped_confirmation_incident_lineage_incomplete' using errcode='40001';
  end if;

  v_audit_id := public.record_admin_audit_event(
    p_actor_user_id,
    'admin.products.review',
    'admin.trust.official_source_grouped_relocation_confirmed',
    'trust_official_source_relocation_group',
    v_group.group_id::text,
    jsonb_build_object(
      'case_id',v_case_id,
      'evaluation_id',v_evaluation_id,
      'old_binding_id',v_old_binding_id,
      'historical_source_ids',p_payload->'historical_source_ids',
      'incident_ids',p_payload->'incident_ids'
    ),
    jsonb_build_object(
      'group_id',v_group.group_id,
      'relocation_id',v_relocation_id,
      'replacement_binding_id',v_replacement_binding_id,
      'replacement_review_id',v_replacement_review_id,
      'group_plan_digest',p_payload->>'group_plan_digest'
    ),
    'confirm grouped official-source relocation after READY_FOR_8I4 and grouped read-only preflight',
    v_request_id,
    jsonb_build_object(
      'phase','8I-4E',
      'group_version','trust-official-source-grouped-relocation-v1',
      'actor_role',v_actor_role,
      'qualification_digest',p_payload->>'qualification_digest',
      'group_prestate_digest',p_payload->>'expected_group_prestate_digest',
      'group_plan_digest',p_payload->>'group_plan_digest',
      'phase8h_anchor_prestate_digest',p_payload->>'phase8h_anchor_prestate_digest',
      'phase8h_anchor_relocation_plan_digest',p_payload->>'phase8h_anchor_relocation_plan_digest'
    )
  );

  return jsonb_build_object(
    'status','confirmed',
    'idempotent',false,
    'group_id',v_group.group_id,
    'relocation_id',v_relocation_id,
    'replacement_binding_id',v_replacement_binding_id,
    'replacement_review_id',v_replacement_review_id,
    'case_id',v_case_id,
    'evaluation_id',v_evaluation_id,
    'product_id',v_product_id,
    'subject_id',v_subject_id,
    'historical_source_count',jsonb_array_length(p_payload->'historical_source_ids'),
    'incident_count',jsonb_array_length(p_payload->'incident_ids'),
    'audit_id',v_audit_id
  );
end;
$function$;

revoke all on function public.admin_confirm_trust_official_source_grouped_relocation_v1(uuid,text,jsonb)
  from public, anon, authenticated;
grant execute on function public.admin_confirm_trust_official_source_grouped_relocation_v1(uuid,text,jsonb)
  to service_role;

comment on function public.admin_confirm_trust_official_source_grouped_relocation_v1(uuid,text,jsonb) is
  'TRUST Phase 8I-4G explicit Admin grouped relocation confirmation with persisted-plan idempotent replay checked before mutable preflight revalidation.';
