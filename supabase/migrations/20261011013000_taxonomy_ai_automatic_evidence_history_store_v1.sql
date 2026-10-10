begin;
-- TAXONOMY-AI automatic evaluation history: append-only evidence ledger.
-- No recommendation, admission, rank, admin approval, or existing fact writes.
do $pre$ begin
  if to_regclass('public.products') is null or
     to_regclass('public.product_fact_subjects') is null then
    raise exception 'automatic_history_prerequisite_missing' using errcode='55000';
  end if;
end $pre$;

create table public.automatic_product_evidence_history_v1 (
  history_id bigint generated always as identity primary key,
  product_id uuid not null references public.products(id),
  subject_id uuid not null references public.product_fact_subjects(subject_id),
  evaluated_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  contract_version text not null check (contract_version = 'automatic-evidence-history-candidate-v1'),
  actor_type text not null check (actor_type = 'automatic_evidence_system'),
  versions jsonb not null check (jsonb_typeof(versions) = 'object'),
  source_digest text not null check (source_digest ~ '^[0-9a-f]{64}$'),
  decision_digest text not null check (decision_digest ~ '^[0-9a-f]{64}$'),
  idempotency_key text not null check (idempotency_key ~ '^[0-9a-f]{64}$'),
  source_evidence_digests jsonb not null check (jsonb_typeof(source_evidence_digests) = 'array'),
  fields jsonb not null check (jsonb_typeof(fields) = 'object'),
  evidence_ready boolean not null,
  research_needs jsonb not null check (jsonb_typeof(research_needs) = 'array'),
  exceptions jsonb not null check (jsonb_typeof(exceptions) = 'array'),
  context_cautions jsonb not null check (jsonb_typeof(context_cautions) = 'array'),
  event_kind text not null check (event_kind in (
    'first_observation', 'evidence_refresh', 'evaluation_version_change', 'assessment_changed'
  )),
  previous_history_id bigint references public.automatic_product_evidence_history_v1(history_id),
  changed_fields text[] not null default '{}'::text[],
  constraint automatic_product_evidence_history_unique_v1
    unique(product_id, subject_id, idempotency_key)
);
create index automatic_product_evidence_history_subject_time_v1
  on public.automatic_product_evidence_history_v1(product_id, subject_id, history_id desc);

alter table public.automatic_product_evidence_history_v1 enable row level security;
alter table public.automatic_product_evidence_history_v1 force row level security;
revoke all on public.automatic_product_evidence_history_v1
  from public, anon, authenticated, service_role;
grant select, insert on public.automatic_product_evidence_history_v1 to service_role;
grant usage, select on sequence public.automatic_product_evidence_history_v1_history_id_seq to service_role;
create policy automatic_product_evidence_history_read_service_v1
  on public.automatic_product_evidence_history_v1
  for select to service_role using (true);
create policy automatic_product_evidence_history_append_service_v1
  on public.automatic_product_evidence_history_v1
  for insert to service_role with check (true);

create function public.record_automatic_product_evidence_history_v1(p_candidate jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $history$
declare
  v_product uuid;
  v_subject uuid;
  v_key text;
  v_source text;
  v_decision text;
  v_subject_valid boolean;
  v_seen public.automatic_product_evidence_history_v1%rowtype;
  v_prior public.automatic_product_evidence_history_v1%rowtype;
  v_new_id bigint;
  v_kind text;
  v_changed text[];
begin
  if current_user <> 'service_role' then
    raise exception 'automatic_history_service_role_required' using errcode='42501';
  end if;
  if p_candidate is null or jsonb_typeof(p_candidate) <> 'object'
    or length(p_candidate::text) > 100000
    or p_candidate->>'contractVersion' <> 'automatic-evidence-history-candidate-v1'
    or p_candidate->>'writeState' <> 'NOT_SAVED'
    or p_candidate->>'actorType' <> 'automatic_evidence_system'
    or p_candidate->>'databaseWrites' <> '0'
    or p_candidate->>'adminReviewWrites' <> '0'
    or p_candidate->>'recommendationWrites' <> '0'
    or coalesce(jsonb_typeof(p_candidate->'versions'),'null') <> 'object'
    or coalesce(jsonb_typeof(p_candidate->'fields'),'null') <> 'object'
    or coalesce(jsonb_typeof(p_candidate->'sourceEvidenceDigests'),'null') <> 'array'
    or coalesce(jsonb_typeof(p_candidate->'researchNeeds'),'null') <> 'array'
    or coalesce(jsonb_typeof(p_candidate->'exceptions'),'null') <> 'array'
    or coalesce(jsonb_typeof(p_candidate->'contextCautions'),'null') <> 'array'
    or coalesce(jsonb_typeof(p_candidate->'evidenceReady'),'null') <> 'boolean'
    or (select count(*) from jsonb_object_keys(coalesce(p_candidate->'fields','{}'::jsonb))) <> 12
    or not (p_candidate->'fields' ?& array[
      'category_slot','skin_types','concerns','texture','finish','uv_filter_type',
      'sensitivity_safe','irritation_risk','tone_up','white_cast','eye_sting','pilling_risk'
    ])
  then raise exception 'automatic_history_invalid_candidate' using errcode='22023';
  end if;
  if (p_candidate->>'productId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or (p_candidate->>'subjectId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or (p_candidate->>'sourceDigest') !~ '^[0-9a-f]{64}$'
    or (p_candidate->>'decisionDigest') !~ '^[0-9a-f]{64}$'
    or (p_candidate->>'idempotencyKey') !~ '^[0-9a-f]{64}$'
    or (p_candidate->>'evaluatedAt') is null
  then raise exception 'automatic_history_invalid_identity_or_digest' using errcode='22023';
  end if;
  v_product := (p_candidate->>'productId')::uuid;
  v_subject := (p_candidate->>'subjectId')::uuid;
  v_key := p_candidate->>'idempotencyKey';
  v_source := p_candidate->>'sourceDigest';
  v_decision := p_candidate->>'decisionDigest';
  -- This lock serializes concurrent evaluations for the same immutable product/subject.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_product::text || ':' || v_subject::text, 0)
  );
  -- Read under SELECT-only authority; a row lock here would require UPDATE
  -- rights on product_fact_subjects and violate this writer's narrow boundary.
  select exists(
    select 1 from public.product_fact_subjects s
    where s.subject_id = v_subject and s.product_id = v_product
      and s.identity_status = 'resolved' and s.current_state = 'current'
  ) into v_subject_valid;
  if not v_subject_valid then
    raise exception 'automatic_history_subject_not_current' using errcode='55000';
  end if;
  select * into v_seen from public.automatic_product_evidence_history_v1
  where product_id=v_product and subject_id=v_subject and idempotency_key=v_key
  limit 1;
  if found then
    if v_seen.decision_digest is distinct from v_decision or
       v_seen.source_digest is distinct from v_source or
       v_seen.versions is distinct from p_candidate->'versions' or
       v_seen.fields is distinct from p_candidate->'fields' then
      raise exception 'automatic_history_key_payload_conflict' using errcode='23505';
    end if;
    return pg_catalog.jsonb_build_object(
      'status','duplicate','historyId',v_seen.history_id,
      'eventKind',v_seen.event_kind,'changedFields',v_seen.changed_fields
    );
  end if;
  select * into v_prior from public.automatic_product_evidence_history_v1
  where product_id=v_product and subject_id=v_subject
  order by history_id desc limit 1;
  if not found then
    v_kind := 'first_observation';
    v_changed := '{}'::text[];
  elsif v_prior.decision_digest = v_decision then
    if v_prior.source_digest = v_source then
      if v_prior.versions = p_candidate->'versions' then
        raise exception 'automatic_history_inconsistent_idempotency_key' using errcode='23505';
      end if;
      v_kind := 'evaluation_version_change';
    else
      v_kind := 'evidence_refresh';
    end if;
    v_changed := '{}'::text[];
  else
    v_kind := 'assessment_changed';
    select coalesce(array_agg(k order by k), '{}'::text[]) into v_changed
    from pg_catalog.jsonb_object_keys(p_candidate->'fields') k
    where v_prior.fields->k is distinct from p_candidate->'fields'->k;
  end if;
  insert into public.automatic_product_evidence_history_v1(
    product_id, subject_id, evaluated_at, contract_version, actor_type, versions,
    source_digest, decision_digest, idempotency_key, source_evidence_digests,
    fields, evidence_ready, research_needs, exceptions, context_cautions,
    event_kind, previous_history_id, changed_fields
  ) values (
    v_product, v_subject, (p_candidate->>'evaluatedAt')::timestamptz,
    p_candidate->>'contractVersion', p_candidate->>'actorType',
    p_candidate->'versions', v_source, v_decision, v_key,
    p_candidate->'sourceEvidenceDigests', p_candidate->'fields',
    (p_candidate->>'evidenceReady')::boolean, p_candidate->'researchNeeds',
    p_candidate->'exceptions', p_candidate->'contextCautions',
    v_kind, v_prior.history_id, v_changed
  ) returning history_id into v_new_id;
  return pg_catalog.jsonb_build_object(
    'status','inserted','historyId',v_new_id,
    'eventKind',v_kind,'changedFields',v_changed
  );
end
$history$;

revoke all on function public.record_automatic_product_evidence_history_v1(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.record_automatic_product_evidence_history_v1(jsonb)
  to service_role;

do $acl$ begin
  if has_table_privilege('anon','public.automatic_product_evidence_history_v1','SELECT')
    or has_table_privilege('authenticated','public.automatic_product_evidence_history_v1','INSERT')
    or has_table_privilege('service_role','public.automatic_product_evidence_history_v1','UPDATE')
    or has_table_privilege('service_role','public.automatic_product_evidence_history_v1','DELETE')
    or has_function_privilege('anon','public.record_automatic_product_evidence_history_v1(jsonb)','EXECUTE')
    or has_function_privilege('authenticated','public.record_automatic_product_evidence_history_v1(jsonb)','EXECUTE')
    or not has_function_privilege('service_role','public.record_automatic_product_evidence_history_v1(jsonb)','EXECUTE')
  then raise exception 'automatic_history_privilege_boundary_invalid' using errcode='55000';end if;
end $acl$;
commit;
