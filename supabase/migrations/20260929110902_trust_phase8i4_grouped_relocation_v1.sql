-- TRUST Phase 8I-4E grouped official-source relocation DB foundation v1
-- Production migration registered by Supabase as version 20260929110902 after rollback validation.
-- Production confirmation remains gated on a current READY_FOR_8I4 evaluation.

create table public.trust_official_source_relocation_groups (
  group_id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.trust_official_source_transport_drift_cases(case_id) on delete restrict,
  evaluation_id uuid not null references public.trust_official_source_transport_drift_evaluations(evaluation_id) on delete restrict,
  qualified_historical_source_id uuid not null references public.product_evidence_sources(source_id) on delete restrict,
  relocation_id uuid not null references public.trust_official_source_relocations(relocation_id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  subject_id uuid not null references public.product_fact_subjects(subject_id) on delete restrict,
  old_binding_id uuid not null references public.product_source_bindings(binding_id) on delete restrict,
  old_review_id uuid not null references public.trust_official_source_binding_reviews(review_id) on delete restrict,
  replacement_binding_id uuid not null references public.product_source_bindings(binding_id) on delete restrict,
  replacement_review_id uuid not null references public.trust_official_source_binding_reviews(review_id) on delete restrict,
  qualification_digest text not null,
  group_prestate_digest text not null,
  group_plan_digest text not null,
  phase8h_anchor_prestate_digest text not null,
  phase8h_anchor_relocation_plan_digest text not null,
  authority text not null,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  request_id text not null,
  group_version text not null,
  result text not null,
  created_at timestamptz not null default now(),
  constraint trust_official_source_relocation_groups_case_key unique (case_id),
  constraint trust_official_source_relocation_groups_evaluation_key unique (evaluation_id),
  constraint trust_official_source_relocation_groups_relocation_key unique (relocation_id),
  constraint trust_official_source_relocation_groups_plan_key unique (group_plan_digest),
  constraint trust_official_source_relocation_groups_qualification_digest_check
    check (qualification_digest ~ '^[0-9a-f]{64}$'),
  constraint trust_official_source_relocation_groups_prestate_digest_check
    check (group_prestate_digest ~ '^[0-9a-f]{64}$'),
  constraint trust_official_source_relocation_groups_plan_digest_check
    check (group_plan_digest ~ '^[0-9a-f]{64}$'),
  constraint trust_official_source_relocation_groups_phase8h_prestate_digest_check
    check (phase8h_anchor_prestate_digest ~ '^[0-9a-f]{64}$'),
  constraint trust_official_source_relocation_groups_phase8h_plan_digest_check
    check (phase8h_anchor_relocation_plan_digest ~ '^[0-9a-f]{64}$'),
  constraint trust_official_source_relocation_groups_authority_check
    check (authority = 'EXPLICIT_ADMIN_GROUPED_RELOCATION_CONFIRMATION'),
  constraint trust_official_source_relocation_groups_request_id_check
    check (request_id=btrim(request_id) and char_length(request_id) between 8 and 120),
  constraint trust_official_source_relocation_groups_version_check
    check (group_version='trust-official-source-grouped-relocation-v1'),
  constraint trust_official_source_relocation_groups_result_check
    check (result='confirmed')
);

create table public.trust_official_source_relocation_group_sources (
  group_id uuid not null references public.trust_official_source_relocation_groups(group_id) on delete restrict,
  source_id uuid not null references public.product_evidence_sources(source_id) on delete restrict,
  source_subject_binding_id uuid not null references public.product_evidence_source_subject_bindings(binding_id) on delete restrict,
  canonical_locator text not null,
  content_digest text not null,
  source_snapshot jsonb not null,
  subject_binding_snapshot jsonb not null,
  created_at timestamptz not null default now(),
  primary key (group_id, source_id),
  constraint trust_official_source_relocation_group_sources_binding_key
    unique (group_id, source_subject_binding_id),
  constraint trust_official_source_relocation_group_sources_locator_check
    check (canonical_locator ~ '^https://[^[:space:]#]+$'),
  constraint trust_official_source_relocation_group_sources_digest_check
    check (content_digest ~ '^[0-9a-f]{64}$'),
  constraint trust_official_source_relocation_group_sources_source_snapshot_check
    check (jsonb_typeof(source_snapshot)='object'),
  constraint trust_official_source_relocation_group_sources_binding_snapshot_check
    check (jsonb_typeof(subject_binding_snapshot)='object')
);

create table public.trust_official_source_relocation_group_incidents (
  group_id uuid not null,
  incident_id uuid not null references public.trust_official_source_transport_incidents(incident_id) on delete restrict,
  source_id uuid not null references public.product_evidence_sources(source_id) on delete restrict,
  incident_digest text not null,
  incident_snapshot jsonb not null,
  created_at timestamptz not null default now(),
  primary key (group_id, incident_id),
  constraint trust_official_source_relocation_group_incidents_source_fk
    foreign key (group_id, source_id)
    references public.trust_official_source_relocation_group_sources(group_id, source_id)
    on delete restrict,
  constraint trust_official_source_relocation_group_incidents_digest_check
    check (incident_digest ~ '^[0-9a-f]{64}$'),
  constraint trust_official_source_relocation_group_incidents_snapshot_check
    check (jsonb_typeof(incident_snapshot)='object')
);

create index trust_official_source_relocation_groups_subject_created_idx
  on public.trust_official_source_relocation_groups(subject_id,created_at desc);
create index trust_official_source_relocation_group_sources_source_idx
  on public.trust_official_source_relocation_group_sources(source_id,group_id);
create index trust_official_source_relocation_group_incidents_source_idx
  on public.trust_official_source_relocation_group_incidents(source_id,group_id);

alter table public.trust_official_source_relocation_groups enable row level security;
alter table public.trust_official_source_relocation_group_sources enable row level security;
alter table public.trust_official_source_relocation_group_incidents enable row level security;

revoke all on table
  public.trust_official_source_relocation_groups,
  public.trust_official_source_relocation_group_sources,
  public.trust_official_source_relocation_group_incidents
from public, anon, authenticated, service_role;

grant select on table
  public.trust_official_source_relocation_groups,
  public.trust_official_source_relocation_group_sources,
  public.trust_official_source_relocation_group_incidents
to service_role;

create or replace function public.reject_trust_phase8i4_grouped_relocation_mutation_v1()
returns trigger
language plpgsql
set search_path=''
as $function$
begin
  raise exception 'trust_phase8i4_grouped_relocation_append_only' using errcode='55000';
end;
$function$;

revoke all on function public.reject_trust_phase8i4_grouped_relocation_mutation_v1()
  from public, anon, authenticated, service_role;

create trigger trust_official_source_relocation_groups_immutable_v1
before update or delete on public.trust_official_source_relocation_groups
for each row execute function public.reject_trust_phase8i4_grouped_relocation_mutation_v1();

create trigger trust_official_source_relocation_group_sources_immutable_v1
before update or delete on public.trust_official_source_relocation_group_sources
for each row execute function public.reject_trust_phase8i4_grouped_relocation_mutation_v1();

create trigger trust_official_source_relocation_group_incidents_immutable_v1
before update or delete on public.trust_official_source_relocation_group_incidents
for each row execute function public.reject_trust_phase8i4_grouped_relocation_mutation_v1();

create or replace function public.admin_preflight_trust_official_source_grouped_relocation_v1(
  p_actor_user_id uuid,
  p_case_id uuid,
  p_evaluation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_actor_role text;
  v_case public.trust_official_source_transport_drift_cases%rowtype;
  v_eval public.trust_official_source_transport_drift_evaluations%rowtype;
  v_latest_evaluation_id uuid;
  v_subject public.product_fact_subjects%rowtype;
  v_old_binding public.product_source_bindings%rowtype;
  v_old_review public.trust_official_source_binding_reviews%rowtype;
  v_anchor_source public.product_evidence_sources%rowtype;
  v_anchor_binding public.product_evidence_source_subject_bindings%rowtype;
  v_exact jsonb;
  v_anchor_id uuid;
  v_source_ids uuid[];
  v_incident_ids uuid[];
  v_source_count integer;
  v_incident_count integer;
  v_match_count integer;
  v_bad_count integer;
  v_historical_sources jsonb;
  v_case_json jsonb;
  v_eval_json jsonb;
  v_subject_json jsonb;
  v_reviewed_json jsonb;
  v_prestate jsonb;
  v_prestate_digest text;
  v_replacement_external_id text;
  v_result jsonb;
  v_plan_digest text;
  v_phase8h_prestate jsonb;
  v_phase8h_prestate_digest text;
  v_phase8h_plan jsonb;
  v_phase8h_plan_digest text;
  v_blockers text[] := array[]::text[];
begin
  v_actor_role := public.admin_require_product_review_actor(
    p_actor_user_id,
    'admin.products.review'
  );

  if p_case_id is null or p_evaluation_id is null then
    raise exception 'trust_phase8i4_grouped_preflight_identity_required' using errcode='22004';
  end if;

  select * into v_case
  from public.trust_official_source_transport_drift_cases c
  where c.case_id=p_case_id;

  if not found then
    raise exception 'trust_phase8i4_grouped_preflight_case_not_found' using errcode='23503';
  end if;

  select * into v_eval
  from public.trust_official_source_transport_drift_evaluations e
  where e.evaluation_id=p_evaluation_id
    and e.case_id=p_case_id;

  if not found then
    raise exception 'trust_phase8i4_grouped_preflight_evaluation_not_found' using errcode='23503';
  end if;

  select e.evaluation_id into v_latest_evaluation_id
  from public.trust_official_source_transport_drift_evaluations e
  where e.case_id=p_case_id
  order by e.created_at desc,e.evaluation_id desc
  limit 1;

  if v_latest_evaluation_id is distinct from p_evaluation_id then
    v_blockers := array_append(v_blockers,'EVALUATION_NOT_LATEST');
  end if;
  if v_eval.result_kind <> 'READY_FOR_8I4' then
    v_blockers := array_append(v_blockers,'EVALUATION_NOT_READY_FOR_8I4');
  end if;
  if v_eval.candidate_locator is null
    or v_eval.candidate_locator !~ '^https://[^[:space:]#]+$'
  then
    v_blockers := array_append(v_blockers,'CANDIDATE_LOCATOR_INVALID');
  end if;
  if v_eval.qualification_digest is null
    or v_eval.qualification_digest !~ '^[0-9a-f]{64}$'
  then
    v_blockers := array_append(v_blockers,'QUALIFICATION_DIGEST_INVALID');
  end if;
  if v_eval.input_digest !~ '^[0-9a-f]{64}$'
    or v_eval.result_digest !~ '^[0-9a-f]{64}$'
  then
    v_blockers := array_append(v_blockers,'EVALUATION_DIGEST_INVALID');
  end if;
  if v_eval.result_payload->>'contract' <> 'trust-phase8i3-transport-drift-evaluation-v1'
    or v_eval.result_payload->>'case_id' is distinct from v_case.case_id::text
    or v_eval.result_payload->>'product_id' is distinct from v_case.product_id::text
    or v_eval.result_payload->>'subject_id' is distinct from v_case.subject_id::text
    or v_eval.result_payload->>'candidate_locator' is distinct from v_eval.candidate_locator
    or v_eval.result_payload->>'qualification_digest' is distinct from v_eval.qualification_digest
  then
    v_blockers := array_append(v_blockers,'EVALUATION_PAYLOAD_MISMATCH');
  end if;

  v_exact := v_eval.result_payload->'qualified_exact';
  if v_exact is null or jsonb_typeof(v_exact) <> 'object' then
    v_blockers := array_append(v_blockers,'QUALIFIED_EXACT_PAYLOAD_REQUIRED');
  else
    begin
      v_anchor_id := (v_eval.result_payload->>'qualified_historical_source_id')::uuid;
    exception when others then
      v_anchor_id := null;
    end;

    if v_anchor_id is null then
      v_blockers := array_append(v_blockers,'QUALIFIED_HISTORICAL_SOURCE_ID_REQUIRED');
    end if;
    if v_exact->>'contract' <> 'trust-phase8h-source-identity-qualification-v1'
      or v_exact->>'disposition' <> 'QUALIFIED_EXACT'
      or v_exact->>'authority' <> 'QUALIFICATION_EVIDENCE_ONLY_REQUIRES_GOVERNED_RELOCATION'
      or v_exact->>'mutation_policy' <> 'READ_ONLY_NO_PRODUCTION_WRITE'
      or v_exact->>'historical_source_id' is distinct from v_anchor_id::text
      or v_exact->>'historical_locator' is distinct from v_case.effective_locator
      or v_exact->>'product_id' is distinct from v_case.product_id::text
      or v_exact->>'subject_id' is distinct from v_case.subject_id::text
      or v_exact->>'candidate_locator' is distinct from v_eval.candidate_locator
      or v_exact->>'qualification_digest' is distinct from v_eval.qualification_digest
    then
      v_blockers := array_append(v_blockers,'QUALIFIED_EXACT_PAYLOAD_MISMATCH');
    end if;
  end if;

  select
    coalesce(array_agg(distinct l.source_id order by l.source_id),array[]::uuid[]),
    coalesce(array_agg(distinct l.incident_id order by l.incident_id),array[]::uuid[])
  into v_source_ids,v_incident_ids
  from public.trust_official_source_transport_drift_case_incidents l
  where l.case_id=p_case_id;

  v_source_count := coalesce(array_length(v_source_ids,1),0);
  v_incident_count := coalesce(array_length(v_incident_ids,1),0);

  if v_source_count < 2 then
    v_blockers := array_append(v_blockers,'GROUPED_SOURCE_COUNT_REQUIRES_MULTIPLE');
  end if;
  if v_incident_count < 1 then
    v_blockers := array_append(v_blockers,'CASE_INCIDENT_IDS_REQUIRED');
  end if;
  if v_anchor_id is not null and not (v_anchor_id=any(v_source_ids)) then
    v_blockers := array_append(v_blockers,'QUALIFIED_HISTORICAL_SOURCE_NOT_IN_CASE');
  end if;

  select count(*) into v_bad_count
  from public.trust_official_source_transport_drift_case_incidents l
  join public.trust_official_source_transport_incidents i
    on i.incident_id=l.incident_id
  where l.case_id=p_case_id
    and i.source_id<>l.source_id;

  if v_bad_count<>0 then
    v_blockers := array_append(v_blockers,'CASE_INCIDENT_SOURCE_MISMATCH');
  end if;

  select * into v_subject
  from public.product_fact_subjects s
  where s.subject_id=v_case.subject_id
    and s.product_id=v_case.product_id;

  if not found
    or v_subject.identity_status<>'resolved'
    or v_subject.current_state<>'current'
    or v_subject.formulation_revision_key is null
  then
    v_blockers := array_append(v_blockers,'GOVERNED_SUBJECT_STALE');
  end if;

  select count(*) into v_match_count
  from public.product_source_bindings b
  where b.product_id=v_case.product_id
    and b.source_url=v_case.effective_locator
    and b.binding_state='resolved'
    and b.binding_method='trust_official_source_review_v1'
    and b.product_scope_state='product';

  if v_match_count<>1 then
    v_blockers := array_append(v_blockers,'REVIEWED_OLD_BINDING_NOT_UNIQUE');
  else
    select * into v_old_binding
    from public.product_source_bindings b
    where b.product_id=v_case.product_id
      and b.source_url=v_case.effective_locator
      and b.binding_state='resolved'
      and b.binding_method='trust_official_source_review_v1'
      and b.product_scope_state='product';
  end if;

  if v_match_count=1 then
    select count(*) into v_match_count
    from public.trust_official_source_binding_reviews r
    where r.binding_id=v_old_binding.binding_id
      and r.product_id=v_case.product_id
      and r.subject_id=v_case.subject_id
      and r.review_version='trust-official-source-review-v1';

    if v_match_count<>1 then
      v_blockers := array_append(v_blockers,'REVIEWED_OLD_REVIEW_NOT_UNIQUE');
    else
      select * into v_old_review
      from public.trust_official_source_binding_reviews r
      where r.binding_id=v_old_binding.binding_id
        and r.product_id=v_case.product_id
        and r.subject_id=v_case.subject_id
        and r.review_version='trust-official-source-review-v1';
    end if;
  end if;

  if v_old_binding.binding_id is not null and v_subject.subject_id is not null then
    if v_old_binding.source_name !~ '^[a-z0-9][a-z0-9_-]{0,54}_official$'
      or v_old_review.subject_market is distinct from v_subject.market_applicability
      or v_old_review.source_market is distinct from v_old_binding.market_code
      or v_old_review.scope_relation not in ('equivalent','narrower')
      or v_old_review.variant_key is distinct from v_subject.variant_key
      or v_old_review.formulation_revision_key is distinct from v_subject.formulation_revision_key
      or v_old_review.source_kind<>v_old_binding.external_type
    then
      v_blockers := array_append(v_blockers,'REVIEWED_OLD_SCOPE_OR_IDENTITY_STALE');
    end if;
    if v_exact is not null
      and v_exact->>'candidate_source_kind' is distinct from v_old_binding.external_type
    then
      v_blockers := array_append(v_blockers,'QUALIFIED_EXACT_SOURCE_KIND_MISMATCH');
    end if;
  end if;

  if v_eval.candidate_locator is not null
    and v_eval.candidate_locator=v_case.effective_locator
  then
    v_blockers := array_append(v_blockers,'REPLACEMENT_LOCATOR_UNCHANGED');
  end if;

  select count(*) into v_bad_count
  from unnest(v_source_ids) as src(source_id)
  where (
    select count(*)
    from public.product_evidence_source_subject_bindings b
    where b.source_id=src.source_id
      and b.product_id=v_case.product_id
      and b.subject_id=v_case.subject_id
      and b.binding_state='exact_subject_match'
      and b.scope_relation in ('equivalent','narrower')
  )<>1;

  if v_bad_count<>0 then
    v_blockers := array_append(v_blockers,'HISTORICAL_SOURCE_SUBJECT_BINDING_NOT_UNIQUE');
  end if;

  select count(*) into v_bad_count
  from unnest(v_source_ids) as src(source_id)
  join public.product_evidence_sources s on s.source_id=src.source_id
  where s.canonical_locator<>v_case.effective_locator
    or btrim(s.publisher)=''
    or btrim(s.source_kind)=''
    or s.content_digest !~ '^[0-9a-f]{64}$';

  if v_bad_count<>0 then
    v_blockers := array_append(v_blockers,'HISTORICAL_SOURCE_LINEAGE_STALE');
  end if;

  if coalesce(array_length(v_blockers,1),0)>0 then
    return jsonb_build_object(
      'contract','trust-phase8i4-grouped-relocation-db-preflight-v1',
      'status','HOLD',
      'blockers',to_jsonb(v_blockers),
      'case_id',v_case.case_id,
      'evaluation_id',v_eval.evaluation_id,
      'product_id',v_case.product_id,
      'subject_id',v_case.subject_id,
      'historical_source_ids',to_jsonb(v_source_ids),
      'incident_ids',to_jsonb(v_incident_ids),
      'qualified_historical_source_id',v_anchor_id,
      'mutation_policy','READ_ONLY_GROUPED_PREFLIGHT_NO_PRODUCTION_WRITE',
      'authority','NON_AUTHORITATIVE_HOLD'
    );
  end if;

  select * into v_anchor_source
  from public.product_evidence_sources s
  where s.source_id=v_anchor_id;

  select * into strict v_anchor_binding
  from public.product_evidence_source_subject_bindings b
  where b.source_id=v_anchor_id
    and b.product_id=v_case.product_id
    and b.subject_id=v_case.subject_id
    and b.binding_state='exact_subject_match'
    and b.scope_relation in ('equivalent','narrower');

  select jsonb_agg(
    jsonb_build_object(
      'source_id',s.source_id,
      'canonical_locator',s.canonical_locator,
      'publisher',s.publisher,
      'source_kind',s.source_kind,
      'market',s.market,
      'locale',s.locale,
      'content_digest',s.content_digest,
      'product_id',b.product_id,
      'subject_id',b.subject_id,
      'source_subject_binding_id',b.binding_id,
      'binding_state',b.binding_state,
      'scope_relation',b.scope_relation,
      'reviewed_binding_id',v_old_binding.binding_id,
      'reviewed_review_id',v_old_review.review_id
    )
    order by s.source_id::text
  )
  into v_historical_sources
  from unnest(v_source_ids) as src(source_id)
  join public.product_evidence_sources s on s.source_id=src.source_id
  join public.product_evidence_source_subject_bindings b
    on b.source_id=s.source_id
   and b.product_id=v_case.product_id
   and b.subject_id=v_case.subject_id
   and b.binding_state='exact_subject_match'
   and b.scope_relation in ('equivalent','narrower');

  v_case_json := jsonb_build_object(
    'case_id',v_case.case_id,
    'product_id',v_case.product_id,
    'subject_id',v_case.subject_id,
    'case_digest',v_case.case_digest,
    'historical_source_ids',to_jsonb(v_source_ids),
    'incident_ids',to_jsonb(v_incident_ids)
  );

  v_eval_json := jsonb_build_object(
    'evaluation_id',v_eval.evaluation_id,
    'case_id',v_eval.case_id,
    'policy_version',v_eval.policy_version,
    'result_kind',v_eval.result_kind,
    'candidate_locator',v_eval.candidate_locator,
    'qualified_historical_source_id',v_anchor_id,
    'qualified_exact',jsonb_build_object(
      'contract',v_exact->>'contract',
      'historical_source_id',v_exact->>'historical_source_id',
      'historical_locator',v_exact->>'historical_locator',
      'historical_publisher',v_exact->>'historical_publisher',
      'historical_source_kind',v_exact->>'historical_source_kind',
      'product_id',v_exact->>'product_id',
      'subject_id',v_exact->>'subject_id',
      'candidate_locator',v_exact->>'candidate_locator',
      'candidate_publisher',v_exact->>'candidate_publisher',
      'candidate_source_kind',v_exact->>'candidate_source_kind',
      'discovery_method',v_exact->>'discovery_method',
      'disposition',v_exact->>'disposition',
      'reason',v_exact->>'reason',
      'qualification_digest',v_exact->>'qualification_digest',
      'mutation_policy',v_exact->>'mutation_policy',
      'authority',v_exact->>'authority'
    ),
    'qualification_contract',v_exact->>'contract',
    'qualification_digest',v_eval.qualification_digest,
    'input_digest',v_eval.input_digest,
    'result_digest',v_eval.result_digest
  );

  v_subject_json := jsonb_build_object(
    'product_id',v_subject.product_id,
    'subject_id',v_subject.subject_id,
    'market_applicability',v_subject.market_applicability,
    'variant_key',v_subject.variant_key,
    'formulation_revision_key',v_subject.formulation_revision_key,
    'identity_status',v_subject.identity_status,
    'current_state',v_subject.current_state
  );

  v_reviewed_json := jsonb_build_object(
    'binding_id',v_old_binding.binding_id,
    'review_id',v_old_review.review_id,
    'product_id',v_old_binding.product_id,
    'subject_id',v_old_review.subject_id,
    'source_name',v_old_binding.source_name,
    'external_type',v_old_binding.external_type,
    'source_url',v_old_binding.source_url,
    'market_code',v_old_binding.market_code,
    'locale',v_old_binding.locale,
    'binding_state',v_old_binding.binding_state,
    'binding_method',v_old_binding.binding_method,
    'product_scope_state',v_old_binding.product_scope_state,
    'review_version',v_old_review.review_version,
    'review_subject_market',v_old_review.subject_market,
    'review_source_market',v_old_review.source_market,
    'review_scope_relation',v_old_review.scope_relation,
    'review_variant_key',v_old_review.variant_key,
    'review_formulation_revision_key',v_old_review.formulation_revision_key,
    'review_source_kind',v_old_review.source_kind
  );

  v_prestate := jsonb_build_object(
    'case',v_case_json,
    'evaluation',v_eval_json,
    'governed_subject',v_subject_json,
    'current_reviewed_binding',v_reviewed_json,
    'historical_sources',v_historical_sources
  );

  v_prestate_digest := encode(
    extensions.digest(
      convert_to(public.trust_phase8h_canonical_json_text_v1(v_prestate),'UTF8'),
      'sha256'
    ),
    'hex'
  );

  v_replacement_external_id := 'official-url-sha256:' ||
    encode(
      extensions.digest(convert_to(v_eval.candidate_locator,'UTF8'),'sha256'),
      'hex'
    );

  v_result := jsonb_build_object(
    'contract','trust-phase8i4-grouped-relocation-preflight-v1',
    'status','READY_FOR_ADMIN_GROUPED_RELOCATION_CONFIRMATION',
    'blockers','[]'::jsonb,
    'case_id',v_case.case_id,
    'evaluation_id',v_eval.evaluation_id,
    'product_id',v_case.product_id,
    'subject_id',v_case.subject_id,
    'historical_source_ids',to_jsonb(v_source_ids),
    'incident_ids',to_jsonb(v_incident_ids),
    'qualified_historical_source_id',v_anchor_id,
    'old_binding_id',v_old_binding.binding_id,
    'old_review_id',v_old_review.review_id,
    'old_locator',v_old_binding.source_url,
    'replacement_locator',v_eval.candidate_locator,
    'replacement_external_id',v_replacement_external_id,
    'qualification_contract',v_exact->>'contract',
    'qualification_digest',v_eval.qualification_digest,
    'group_prestate_digest',v_prestate_digest,
    'mutation_policy','READ_ONLY_GROUPED_PREFLIGHT_NO_PRODUCTION_WRITE',
    'authority','PREFLIGHT_ONLY_REQUIRES_EXPLICIT_ADMIN_GROUPED_CONFIRMATION'
  );

  v_plan_digest := encode(
    extensions.digest(
      convert_to(public.trust_phase8h_canonical_json_text_v1(v_result),'UTF8'),
      'sha256'
    ),
    'hex'
  );

  v_phase8h_prestate := jsonb_build_object(
    'qualification_digest',v_eval.qualification_digest,
    'historical_source',jsonb_build_object(
      'source_id',v_anchor_source.source_id,
      'canonical_locator',v_anchor_source.canonical_locator,
      'publisher',v_anchor_source.publisher,
      'source_kind',v_anchor_source.source_kind,
      'market',v_anchor_source.market,
      'locale',v_anchor_source.locale,
      'content_digest',v_anchor_source.content_digest
    ),
    'historical_subject_binding',jsonb_build_object(
      'binding_id',v_anchor_binding.binding_id,
      'source_id',v_anchor_binding.source_id,
      'product_id',v_anchor_binding.product_id,
      'subject_id',v_anchor_binding.subject_id,
      'binding_state',v_anchor_binding.binding_state,
      'scope_relation',v_anchor_binding.scope_relation
    ),
    'governed_subject',v_subject_json,
    'current_reviewed_binding',jsonb_build_object(
      'binding_id',v_old_binding.binding_id,
      'review_id',v_old_review.review_id,
      'product_id',v_old_binding.product_id,
      'source_name',v_old_binding.source_name,
      'external_type',v_old_binding.external_type,
      'source_url',v_old_binding.source_url,
      'market_code',v_old_binding.market_code,
      'locale',v_old_binding.locale,
      'binding_state',v_old_binding.binding_state,
      'binding_method',v_old_binding.binding_method,
      'product_scope_state',v_old_binding.product_scope_state,
      'review_subject_id',v_old_review.subject_id,
      'review_subject_market',v_old_review.subject_market,
      'review_source_market',v_old_review.source_market,
      'review_scope_relation',v_old_review.scope_relation,
      'review_variant_key',v_old_review.variant_key,
      'review_formulation_revision_key',v_old_review.formulation_revision_key,
      'review_source_kind',v_old_review.source_kind,
      'review_version',v_old_review.review_version
    )
  );

  v_phase8h_prestate_digest := encode(
    extensions.digest(
      convert_to(public.trust_phase8h_canonical_json_text_v1(v_phase8h_prestate),'UTF8'),
      'sha256'
    ),
    'hex'
  );

  v_phase8h_plan := jsonb_build_object(
    'contract','trust-phase8h-governed-relocation-preflight-v1',
    'status','READY_FOR_ADMIN_RELOCATION_CONFIRMATION',
    'blockers','[]'::jsonb,
    'historical_source_id',v_anchor_id,
    'product_id',v_case.product_id,
    'subject_id',v_case.subject_id,
    'old_binding_id',v_old_binding.binding_id,
    'old_review_id',v_old_review.review_id,
    'old_locator',v_old_binding.source_url,
    'replacement_locator',v_eval.candidate_locator,
    'replacement_external_id',v_replacement_external_id,
    'qualification_contract',v_exact->>'contract',
    'qualification_digest',v_eval.qualification_digest,
    'prestate_digest',v_phase8h_prestate_digest,
    'mutation_policy','READ_ONLY_PREFLIGHT_NO_PRODUCTION_WRITE',
    'authority','PREFLIGHT_ONLY_REQUIRES_EXPLICIT_ADMIN_CONFIRMATION'
  );

  v_phase8h_plan_digest := encode(
    extensions.digest(
      convert_to(public.trust_phase8h_canonical_json_text_v1(v_phase8h_plan),'UTF8'),
      'sha256'
    ),
    'hex'
  );

  return v_result || jsonb_build_object(
    'group_plan_digest',v_plan_digest,
    'phase8h_anchor_prestate_digest',v_phase8h_prestate_digest,
    'phase8h_anchor_relocation_plan_digest',v_phase8h_plan_digest,
    'actor_role',v_actor_role
  );
end;
$function$;

revoke all on function public.admin_preflight_trust_official_source_grouped_relocation_v1(uuid,uuid,uuid)
  from public, anon, authenticated;
grant execute on function public.admin_preflight_trust_official_source_grouped_relocation_v1(uuid,uuid,uuid)
  to service_role;

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

create or replace function public.get_trust_official_source_grouped_relocation_lineage_v1(
  p_group_id uuid default null,
  p_relocation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_group public.trust_official_source_relocation_groups%rowtype;
begin
  if (p_group_id is null)=(p_relocation_id is null) then
    raise exception 'trust_phase8i4_grouped_lineage_exactly_one_identity_required' using errcode='22023';
  end if;

  if p_group_id is not null then
    select * into v_group
    from public.trust_official_source_relocation_groups g
    where g.group_id=p_group_id;
  else
    select * into v_group
    from public.trust_official_source_relocation_groups g
    where g.relocation_id=p_relocation_id;
  end if;

  if not found then
    return jsonb_build_object(
      'contract','trust-phase8i4-grouped-relocation-lineage-v1',
      'found',false
    );
  end if;

  return jsonb_build_object(
    'contract','trust-phase8i4-grouped-relocation-lineage-v1',
    'found',true,
    'group',to_jsonb(v_group),
    'sources',coalesce((
      select jsonb_agg(to_jsonb(s) order by s.source_id::text)
      from public.trust_official_source_relocation_group_sources s
      where s.group_id=v_group.group_id
    ),'[]'::jsonb),
    'incidents',coalesce((
      select jsonb_agg(to_jsonb(i) order by i.incident_id::text)
      from public.trust_official_source_relocation_group_incidents i
      where i.group_id=v_group.group_id
    ),'[]'::jsonb),
    'authority','READ_ONLY_GROUPED_RELOCATION_LINEAGE'
  );
end;
$function$;

revoke all on function public.get_trust_official_source_grouped_relocation_lineage_v1(uuid,uuid)
  from public, anon, authenticated;
grant execute on function public.get_trust_official_source_grouped_relocation_lineage_v1(uuid,uuid)
  to service_role;

comment on table public.trust_official_source_relocation_groups is
  'Phase 8I-4 immutable grouped lineage header for one governed Phase 8H relocation authority row.';
comment on table public.trust_official_source_relocation_group_sources is
  'Phase 8I-4 immutable complete historical Evidence Source membership for a grouped official-source relocation.';
comment on table public.trust_official_source_relocation_group_incidents is
  'Phase 8I-4 immutable complete transport-incident membership for a grouped official-source relocation.';
comment on function public.admin_preflight_trust_official_source_grouped_relocation_v1(uuid,uuid,uuid) is
  'Phase 8I-4 read-only Admin preflight: requires latest READY_FOR_8I4, reconstructs complete grouped lineage, and returns deterministic grouped and Phase 8H anchor digests without mutation.';
comment on function public.admin_confirm_trust_official_source_grouped_relocation_v1(uuid,text,jsonb) is
  'Phase 8I-4 explicit Admin confirmation: revalidates grouped prestate, reuses the existing Phase 8H relocation mutation primitive in the same transaction, and appends immutable grouped source/incident lineage without Product Fact or Evidence Source mutation.';
comment on function public.get_trust_official_source_grouped_relocation_lineage_v1(uuid,uuid) is
  'Phase 8I-4 service-role read resolver for grouped relocation header, historical source lineage, and incident lineage.';
