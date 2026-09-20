begin;

-- TRUST Phase 7-C / Legacy research readiness and controlled official-source gating.
-- This phase changes operational research readiness only. It never creates Product
-- Fact Subjects, adopts Evidence, confirms facts, mutates Current, or writes
-- Recommendation authority.

create table public.trust_official_source_binding_reviews (
  review_id uuid primary key default gen_random_uuid(),
  binding_id uuid not null references public.product_source_bindings(binding_id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  subject_id uuid not null references public.product_fact_subjects(subject_id) on delete restrict,
  subject_market text,
  source_market text,
  scope_relation text not null check (scope_relation in ('equivalent','narrower')),
  variant_key text,
  formulation_revision_key text not null,
  source_kind text not null check (source_kind in (
    'brand_official_product_page',
    'brand_official_faq',
    'brand_official_technical_document',
    'manufacturer_official_document',
    'official_market_sales_page'
  )),
  actor_user_id uuid not null,
  request_id text not null check (char_length(btrim(request_id)) between 8 and 120),
  review_version text not null check (review_version='trust-official-source-review-v1'),
  created_at timestamptz not null default now(),
  unique(product_id,subject_id,binding_id,review_version)
);

create index trust_official_source_binding_reviews_subject_idx
  on public.trust_official_source_binding_reviews(subject_id,created_at desc);

alter table public.trust_official_source_binding_reviews enable row level security;
revoke all on table public.trust_official_source_binding_reviews
  from public, anon, authenticated, service_role;

create or replace function public.trust_phase7c_legacy_subject_scope_ready_v1(
  p_task_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.product_fact_research_tasks rt
    join public.catalog_trust_intake i on i.id=rt.intake_id
    join public.product_fact_subjects s on s.subject_id=rt.subject_id
    where rt.id=p_task_id
      and i.catalog_revision like 'legacy-backfill-v1:%'
      and i.identity_state='EXACT_SUBJECT_FOUND'
      and i.subject_id=rt.subject_id
      and s.product_id=rt.product_id
      and s.identity_status='resolved'
      and s.current_state='current'
      and s.market_applicability is not distinct from i.market
      and i.identity_resolution_detail->>'materializer_version'='trust-phase7b-legacy-materialization-v1'
      and i.identity_resolution_detail->>'projected_identity_state'='EXISTING_GOVERNED_SUBJECT'
      and i.identity_resolution_detail->>'subject_id'=rt.subject_id::text
      and s.variant_key is not distinct from nullif(i.identity_resolution_detail->>'variant_key','')
      and s.formulation_revision_key is not distinct from nullif(i.identity_resolution_detail->>'formulation_revision_key','')
      and coalesce((i.identity_resolution_detail->>'market_inferred')::boolean,true)=false
  );
$$;

create or replace function public.trust_phase7c_has_controlled_official_source_v1(
  p_task_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.product_fact_research_tasks rt
    join public.catalog_trust_intake i on i.id=rt.intake_id
    join public.product_fact_subjects s on s.subject_id=rt.subject_id
    join public.product_source_bindings psb
      on psb.product_id=rt.product_id
     and psb.binding_state='resolved'
     and psb.source_name ~ '_official$'
     and psb.source_url ~ '^https://'
     and psb.binding_method='trust_official_source_review_v1'
     and psb.product_scope_state='product'
    join public.trust_official_source_binding_reviews osr
      on osr.binding_id=psb.binding_id
     and psb.market_code is not distinct from osr.source_market
     and osr.product_id=rt.product_id
     and osr.subject_id=rt.subject_id
     and osr.subject_market is not distinct from i.market
     and osr.variant_key is not distinct from s.variant_key
     and osr.formulation_revision_key is not distinct from s.formulation_revision_key
     and osr.review_version='trust-official-source-review-v1'
    where rt.id=p_task_id
      and public.trust_phase7c_legacy_subject_scope_ready_v1(rt.id)
  );
$$;

revoke all on function public.trust_phase7c_legacy_subject_scope_ready_v1(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.trust_phase7c_has_controlled_official_source_v1(uuid)
  from public, anon, authenticated, service_role;

create or replace function public.admin_register_trust_official_source_binding_v1(
  p_actor_user_id uuid,
  p_request_id text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_actor_role text;
  v_request_id text := btrim(coalesce(p_request_id,''));
  v_product_id uuid;
  v_subject_id uuid;
  v_source_name text;
  v_source_kind text;
  v_source_url text;
  v_subject_market text;
  v_source_market text;
  v_scope_relation text;
  v_locale text;
  v_external_id text;
  v_intake public.catalog_trust_intake%rowtype;
  v_subject public.product_fact_subjects%rowtype;
  v_binding public.product_source_bindings%rowtype;
  v_review public.trust_official_source_binding_reviews%rowtype;
  v_audit_id uuid;
begin
  v_actor_role := public.admin_require_product_review_actor(
    p_actor_user_id,
    'admin.products.review'
  );

  if char_length(v_request_id) not between 8 and 120
    or p_payload is null
    or jsonb_typeof(p_payload) <> 'object'
    or not (p_payload ?& array[
      'product_id','subject_id','source_name','source_kind','source_url','market_code','locale'
    ])
    or (select count(*) from jsonb_object_keys(p_payload)) <> 7
  then
    raise exception 'trust_official_source_payload_invalid' using errcode='22023';
  end if;

  begin
    v_product_id := (p_payload->>'product_id')::uuid;
    v_subject_id := (p_payload->>'subject_id')::uuid;
  exception when others then
    raise exception 'trust_official_source_identity_invalid' using errcode='22023';
  end;

  v_source_name := lower(btrim(coalesce(p_payload->>'source_name','')));
  v_source_kind := btrim(coalesce(p_payload->>'source_kind',''));
  v_source_url := btrim(coalesce(p_payload->>'source_url',''));
  v_source_market := nullif(btrim(coalesce(p_payload->>'market_code','')),'');
  v_locale := nullif(btrim(coalesce(p_payload->>'locale','')),'');

  if v_source_name !~ '^[a-z0-9][a-z0-9_-]{0,54}_official$'
    or v_source_kind not in (
      'brand_official_product_page',
      'brand_official_faq',
      'brand_official_technical_document',
      'manufacturer_official_document',
      'official_market_sales_page'
    )
    or v_source_url !~ '^https://'
    or char_length(v_source_url) > 2048
    or (v_source_market is not null and char_length(v_source_market) > 32)
    or (v_locale is not null and char_length(v_locale) > 32)
  then
    raise exception 'trust_official_source_payload_invalid' using errcode='23514';
  end if;

  select * into v_intake
  from public.catalog_trust_intake i
  where i.product_id=v_product_id
    and i.subject_id=v_subject_id
    and i.catalog_revision like 'legacy-backfill-v1:%'
    and i.identity_state='EXACT_SUBJECT_FOUND'
  order by i.created_at desc,i.id desc
  limit 1;

  if not found then
    raise exception 'trust_official_source_legacy_intake_not_found' using errcode='P0002';
  end if;

  select * into v_subject
  from public.product_fact_subjects s
  where s.subject_id=v_subject_id
    and s.product_id=v_product_id
    and s.identity_status='resolved'
    and s.current_state='current';

  if not found
    or v_subject.market_applicability is distinct from v_intake.market
    or v_subject.variant_key is distinct from nullif(v_intake.identity_resolution_detail->>'variant_key','')
    or v_subject.formulation_revision_key is distinct from nullif(v_intake.identity_resolution_detail->>'formulation_revision_key','')
    or v_intake.identity_resolution_detail->>'materializer_version' <> 'trust-phase7b-legacy-materialization-v1'
    or v_intake.identity_resolution_detail->>'projected_identity_state' <> 'EXISTING_GOVERNED_SUBJECT'
    or v_intake.identity_resolution_detail->>'subject_id' <> v_subject_id::text
    or coalesce((v_intake.identity_resolution_detail->>'market_inferred')::boolean,true)
  then
    raise exception 'trust_official_source_subject_scope_mismatch' using errcode='23514';
  end if;

  v_subject_market := v_intake.market;

  if v_subject_market is not null then
    if v_source_market is distinct from v_subject_market then
      raise exception 'trust_official_source_market_scope_mismatch' using errcode='23514';
    end if;
    v_scope_relation := 'equivalent';
  elsif v_source_market is null then
    v_scope_relation := 'equivalent';
  else
    -- A narrower market source may support a NULL/global Subject only when the
    -- governed Evidence graph has already bound this exact official locator to
    -- this exact Subject. Phase 7-C reuses that authority; it does not infer it.
    select eb.scope_relation into v_scope_relation
    from public.product_evidence_sources es
    join public.product_evidence_source_subject_bindings eb
      on eb.source_id=es.source_id
    where eb.product_id=v_product_id
      and eb.subject_id=v_subject_id
      and eb.binding_state='exact_subject_match'
      and eb.scope_relation in ('equivalent','narrower')
      and es.canonical_locator=v_source_url
      and es.market is not distinct from v_source_market
      and es.source_kind like 'official%'
    order by eb.reviewed_at desc nulls last,eb.created_at desc
    limit 1;

    if v_scope_relation is null then
      raise exception 'trust_official_source_narrower_scope_not_governed' using errcode='23514';
    end if;
  end if;

  v_external_id := 'official-url-sha256:' ||
    encode(extensions.digest(convert_to(v_source_url,'UTF8'),'sha256'),'hex');

  perform pg_advisory_xact_lock(
    hashtextextended('bejewely_trust_official_source:' || v_external_id,0)
  );

  select * into v_binding
  from public.product_source_bindings
  where source_name=v_source_name
    and external_type=v_source_kind
    and external_id=v_external_id
    and binding_state='resolved';

  if found then
    if v_binding.product_id <> v_product_id
      or v_binding.source_url is distinct from v_source_url
      or v_binding.market_code is distinct from v_source_market
      or v_binding.locale is distinct from v_locale
      or v_binding.binding_method <> 'trust_official_source_review_v1'
      or v_binding.product_scope_state <> 'product'
    then
      raise exception 'trust_official_source_identity_conflict' using errcode='23505';
    end if;
  else
    insert into public.product_source_bindings(
      product_id,source_name,external_type,external_id,source_url,
      market_code,locale,binding_state,binding_method,product_scope_state,
      first_observed_at,last_observed_at,created_at,updated_at
    ) values (
      v_product_id,v_source_name,v_source_kind,v_external_id,v_source_url,
      v_source_market,v_locale,'resolved','trust_official_source_review_v1','product',
      now(),now(),now(),now()
    )
    returning * into v_binding;
  end if;

  select * into v_review
  from public.trust_official_source_binding_reviews
  where binding_id=v_binding.binding_id
    and subject_id=v_subject_id
    and review_version='trust-official-source-review-v1';

  if found then
    if v_review.product_id <> v_product_id
      or v_review.subject_id <> v_subject_id
      or v_review.subject_market is distinct from v_subject_market
      or v_review.source_market is distinct from v_source_market
      or v_review.scope_relation is distinct from v_scope_relation
      or v_review.variant_key is distinct from v_subject.variant_key
      or v_review.formulation_revision_key is distinct from v_subject.formulation_revision_key
      or v_review.source_kind <> v_source_kind
    then
      raise exception 'trust_official_source_review_conflict' using errcode='23505';
    end if;

    return jsonb_build_object(
      'status','registered',
      'idempotent',true,
      'binding_id',v_binding.binding_id,
      'review_id',v_review.review_id,
      'product_id',v_product_id,
      'subject_id',v_subject_id
    );
  end if;

  insert into public.trust_official_source_binding_reviews(
    binding_id,product_id,subject_id,subject_market,source_market,scope_relation,
    variant_key,formulation_revision_key,source_kind,actor_user_id,request_id,review_version
  ) values (
    v_binding.binding_id,v_product_id,v_subject_id,v_subject_market,v_source_market,v_scope_relation,
    v_subject.variant_key,v_subject.formulation_revision_key,v_source_kind,p_actor_user_id,v_request_id,
    'trust-official-source-review-v1'
  )
  returning * into v_review;

  v_audit_id := public.record_admin_audit_event(
    p_actor_user_id,
    'admin.products.review',
    'admin.trust.official_source_registered',
    'product_source_binding',
    v_binding.binding_id::text,
    null,
    jsonb_build_object(
      'product_id',v_product_id,
      'subject_id',v_subject_id,
      'source_name',v_source_name,
      'source_kind',v_source_kind,
      'source_url',v_source_url,
      'subject_market',v_subject_market,
      'source_market',v_source_market,
      'scope_relation',v_scope_relation,
      'locale',v_locale,
      'binding_method','trust_official_source_review_v1',
      'product_scope_state','product'
    ),
    'register reviewed official source for exact legacy Product Fact subject',
    v_request_id,
    jsonb_build_object(
      'phase','7-C',
      'review_version','trust-official-source-review-v1',
      'actor_role',v_actor_role
    )
  );

  return jsonb_build_object(
    'status','registered',
    'idempotent',false,
    'binding_id',v_binding.binding_id,
    'review_id',v_review.review_id,
    'product_id',v_product_id,
    'subject_id',v_subject_id,
    'audit_id',v_audit_id
  );
end;
$$;

revoke all on function public.admin_register_trust_official_source_binding_v1(uuid,text,jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.admin_register_trust_official_source_binding_v1(uuid,text,jsonb)
  to service_role;

create or replace function public.preflight_trust_legacy_research_readiness_v1(
  p_limit integer default 200,
  p_after_task_id uuid default null
)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with scoped as (
    select
      rt.id task_id,
      rt.product_id,
      p.brand,
      p.name product_name,
      rt.subject_id,
      rt.fact_key,
      rt.state task_state,
      i.market,
      s.variant_key,
      s.formulation_revision_key,
      case
        when i.identity_state <> 'EXACT_SUBJECT_FOUND' or rt.subject_id is null
          then 'IDENTITY_REVIEW_REQUIRED'
        when not public.trust_phase7c_legacy_subject_scope_ready_v1(rt.id)
          then 'SUBJECT_SCOPE_BLOCKED'
        when not public.trust_phase7c_has_controlled_official_source_v1(rt.id)
          then 'OFFICIAL_SOURCE_REQUIRED'
        else 'READY'
      end readiness,
      (
        select count(*)
        from public.product_source_bindings psb
        join public.trust_official_source_binding_reviews osr
          on osr.binding_id=psb.binding_id
        where psb.product_id=rt.product_id
          and osr.subject_id=rt.subject_id
          and osr.subject_market is not distinct from i.market
          and osr.variant_key is not distinct from s.variant_key
          and osr.formulation_revision_key is not distinct from s.formulation_revision_key
          and psb.market_code is not distinct from osr.source_market
          and psb.binding_state='resolved'
          and psb.binding_method='trust_official_source_review_v1'
          and psb.product_scope_state='product'
          and psb.source_name ~ '_official$'
          and psb.source_url ~ '^https://'
          and psb.market_code is not distinct from i.market
      ) official_source_count
    from public.product_fact_research_tasks rt
    join public.catalog_trust_intake i on i.id=rt.intake_id
    join public.products p on p.id=rt.product_id
    left join public.product_fact_subjects s on s.subject_id=rt.subject_id
    where i.catalog_revision like 'legacy-backfill-v1:%'
      and rt.state='RESEARCH_PENDING'
      and (p_after_task_id is null or rt.id > p_after_task_id)
    order by rt.id
    limit greatest(1,least(coalesce(p_limit,200),500))
  )
  select jsonb_build_object(
    'phase','7-C',
    'status','preflight',
    'contract_version','trust-phase7c-legacy-research-readiness-v1',
    'count',count(*),
    'ready',count(*) filter(where readiness='READY'),
    'official_source_required',count(*) filter(where readiness='OFFICIAL_SOURCE_REQUIRED'),
    'subject_scope_blocked',count(*) filter(where readiness='SUBJECT_SCOPE_BLOCKED'),
    'identity_review_required',count(*) filter(where readiness='IDENTITY_REVIEW_REQUIRED'),
    'next_after_task_id',(array_agg(task_id order by task_id desc))[1],
    'rows',coalesce(jsonb_agg(jsonb_build_object(
      'task_id',task_id,
      'product_id',product_id,
      'brand',brand,
      'product_name',product_name,
      'subject_id',subject_id,
      'fact_key',fact_key,
      'task_state',task_state,
      'market',market,
      'variant_key',variant_key,
      'formulation_revision_key',formulation_revision_key,
      'readiness',readiness,
      'official_source_count',official_source_count
    ) order by task_id),'[]'::jsonb),
    'writes_performed',false,
    'authority_mutation',false
  )
  from scoped;
$$;

revoke all on function public.preflight_trust_legacy_research_readiness_v1(integer,uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.preflight_trust_legacy_research_readiness_v1(integer,uuid)
  to service_role;

create or replace function public.claim_trust_research_tasks_v1(
  p_limit integer default 5,
  p_lease_seconds integer default 300
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
begin
  if p_limit is null or p_limit < 1 or p_limit > 25 then
    raise exception 'trust_research_claim_limit_invalid';
  end if;
  if p_lease_seconds is null or p_lease_seconds < 30 or p_lease_seconds > 1800 then
    raise exception 'trust_research_lease_invalid';
  end if;

  update public.product_fact_research_tasks
  set state = 'RESEARCH_PENDING',
      next_retry_at = now(),
      blocker_code = 'WORKER_LEASE_EXPIRED',
      blocker_detail = 'Previous RESEARCHING lease expired before a result was recorded.',
      updated_at = now()
  where state = 'RESEARCHING'
    and last_research_at is not null
    and last_research_at < now() - make_interval(secs => p_lease_seconds);

  with eligible as (
    select rt.id
    from public.product_fact_research_tasks rt
    join public.catalog_trust_intake i on i.id = rt.intake_id
    join public.product_fact_subjects s on s.subject_id = rt.subject_id
    where rt.state = 'RESEARCH_PENDING'
      and rt.subject_id is not null
      and (rt.next_retry_at is null or rt.next_retry_at <= now())
      and i.identity_state = 'EXACT_SUBJECT_FOUND'
      and i.subject_id = rt.subject_id
      and s.product_id = rt.product_id
      and s.identity_status = 'resolved'
      and s.current_state = 'current'
      and s.market_applicability is not distinct from i.market
      and (
        (
          i.catalog_revision like 'legacy-backfill-v1:%'
          and public.trust_phase7c_legacy_subject_scope_ready_v1(rt.id)
          and public.trust_phase7c_has_controlled_official_source_v1(rt.id)
        )
        or
        (
          i.catalog_revision not like 'legacy-backfill-v1:%'
          and s.variant_key is null
        )
      )
    order by rt.priority desc, rt.created_at, rt.id
    for update of rt skip locked
    limit p_limit
  ), claimed as (
    update public.product_fact_research_tasks rt
    set state = 'RESEARCHING',
        attempt_count = rt.attempt_count + 1,
        next_retry_at = null,
        blocker_code = null,
        blocker_detail = null,
        last_research_at = now(),
        updated_at = now()
    from eligible e
    where rt.id = e.id
    returning rt.*
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'task_id', c.id,
      'product_id', c.product_id,
      'subject_id', c.subject_id,
      'fact_key', c.fact_key,
      'registry_version', c.registry_version,
      'research_policy_version', c.research_policy_version,
      'attempt_count', c.attempt_count,
      'official_source_seeds', coalesce((
        select jsonb_agg(jsonb_build_object(
          'source_binding_id', psb.binding_id,
          'source_name', psb.source_name,
          'external_type', psb.external_type,
          'binding_method', psb.binding_method,
          'product_scope_state', psb.product_scope_state,
          'canonical_locator', psb.source_url,
          'market', psb.market_code,
          'locale', psb.locale
        ) order by psb.created_at, psb.binding_id)
        from public.product_source_bindings psb
        join public.catalog_trust_intake i2 on i2.id = c.intake_id
        where psb.product_id = c.product_id
          and psb.binding_state = 'resolved'
          and psb.source_name ~ '_official$'
          and psb.source_url ~ '^https://'
          and (
            (
              i2.catalog_revision not like 'legacy-backfill-v1:%'
              and psb.market_code is not distinct from i2.market
            )
            or exists (
              select 1
              from public.trust_official_source_binding_reviews osr
              join public.product_fact_subjects s2 on s2.subject_id = osr.subject_id
              where i2.catalog_revision like 'legacy-backfill-v1:%'
                and osr.binding_id = psb.binding_id
                and osr.product_id = c.product_id
                and osr.subject_id = c.subject_id
                and osr.subject_market is not distinct from i2.market
                and psb.market_code is not distinct from osr.source_market
                and osr.variant_key is not distinct from s2.variant_key
                and osr.formulation_revision_key is not distinct from s2.formulation_revision_key
                and osr.review_version = 'trust-official-source-review-v1'
                and psb.binding_method = 'trust_official_source_review_v1'
                and psb.product_scope_state = 'product'
            )
          )
      ), '[]'::jsonb)
    )
    order by c.priority desc, c.created_at, c.id
  ), '[]'::jsonb)
  into v_result
  from claimed c;

  return v_result;
end;
$$;

create or replace function public.record_trust_research_result_v1(
  p_task_id uuid,
  p_result jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_task public.product_fact_research_tasks%rowtype;
  v_intake public.catalog_trust_intake%rowtype;
  v_subject public.product_fact_subjects%rowtype;
  v_binding public.product_source_bindings%rowtype;
  v_definition jsonb;
  v_outcome text;
  v_blocker text;
  v_detail text;
  v_retry_seconds integer;
  v_source jsonb;
  v_candidate jsonb;
  v_digest_basis text;
  v_page_digest text;
  v_observation_digest text;
  v_observation_id uuid;
  v_candidate_id uuid;
  v_evidence_digest text;
  v_evidence_class text;
  v_support_direction text;
  v_negative_admissibility text;
  v_confidence text;
  v_normalized_value jsonb;
  v_allowed_values jsonb;
  v_expected_type text;
  v_existing_current boolean;
begin
  if p_result is null or jsonb_typeof(p_result) <> 'object' then
    raise exception 'trust_research_result_invalid';
  end if;
  v_outcome := upper(coalesce(p_result ->> 'outcome',''));

  select * into v_task
  from public.product_fact_research_tasks
  where id = p_task_id
  for update;
  if not found then
    raise exception 'trust_research_task_not_found';
  end if;

  if v_task.state = 'EVIDENCE_CANDIDATE'
    and v_outcome = 'EVIDENCE_CANDIDATE'
    and v_task.evidence_candidate_id is not null
    and lower(coalesce(p_result #>> '{source,source_content_digest}','')) = coalesce(v_task.source_content_digest,'') then
    return jsonb_build_object(
      'task_id', p_task_id,
      'outcome', 'EVIDENCE_CANDIDATE',
      'source_observation_id', v_task.source_observation_id,
      'evidence_candidate_id', v_task.evidence_candidate_id,
      'idempotent_replay', true
    );
  end if;

  if v_task.state <> 'RESEARCHING' then
    raise exception 'trust_research_task_not_claimed:%', v_task.state;
  end if;

  select * into v_intake from public.catalog_trust_intake where id = v_task.intake_id;
  select * into v_subject from public.product_fact_subjects where subject_id = v_task.subject_id;

  if v_task.subject_id is null
    or v_intake.identity_state <> 'EXACT_SUBJECT_FOUND'
    or v_intake.subject_id is distinct from v_task.subject_id
    or v_subject.identity_status <> 'resolved'
    or v_subject.current_state <> 'current'
    or v_subject.product_id <> v_task.product_id
    or v_subject.market_applicability is distinct from v_intake.market then
    update public.product_fact_research_tasks
    set state = 'BLOCKED', blocker_code = 'IDENTITY_BLOCKED',
        blocker_detail = 'Phase 3 requires the exact resolved/current Subject selected by Phase 2.',
        last_research_at = now(), updated_at = now()
    where id = p_task_id;
    return jsonb_build_object('task_id',p_task_id,'outcome','IDENTITY_BLOCKED');
  end if;

  if v_intake.catalog_revision like 'legacy-backfill-v1:%' then
    if not public.trust_phase7c_legacy_subject_scope_ready_v1(p_task_id) then
      update public.product_fact_research_tasks
      set state = 'BLOCKED', blocker_code = 'LEGACY_SUBJECT_SCOPE_BLOCKED',
          blocker_detail = 'Phase 7-C legacy task no longer matches its frozen Phase 7-B Subject scope.',
          last_research_at = now(), updated_at = now()
      where id = p_task_id;
      return jsonb_build_object('task_id',p_task_id,'outcome','LEGACY_SUBJECT_SCOPE_BLOCKED');
    end if;
  elsif v_subject.variant_key is not null then
    update public.product_fact_research_tasks
    set state = 'REVIEW_REQUIRED', blocker_code = 'VARIANT_CONFLICT',
        blocker_detail = 'Variant-scoped Subject requires separately governed presentation equivalence.',
        last_research_at = now(), updated_at = now()
    where id = p_task_id;
    return jsonb_build_object('task_id',p_task_id,'outcome','VARIANT_CONFLICT');
  end if;

  select definition into v_definition
  from public.product_fact_definition_snapshots
  where registry_version = v_task.registry_version
    and fact_key = v_task.fact_key
    and deprecated = false;
  if v_definition is null then
    update public.product_fact_research_tasks
    set state = 'BLOCKED', blocker_code = 'REGISTRY_GAP',
        blocker_detail = 'No active Registry definition exists for the task fact.',
        last_research_at = now(), updated_at = now()
    where id = p_task_id;
    return jsonb_build_object('task_id',p_task_id,'outcome','REGISTRY_GAP');
  end if;

  select exists (
    select 1
    from public.product_fact_current c
    where c.subject_id = v_task.subject_id
      and exists (
        select 1 from public.product_fact_instances fi
        where fi.fact_instance_id = c.fact_instance_id
          and fi.registry_version = v_task.registry_version
          and fi.fact_key = v_task.fact_key
      )
  ) into v_existing_current;
  if v_existing_current then
    update public.product_fact_research_tasks
    set state = 'ALREADY_COVERED', blocker_code = null, blocker_detail = null,
        next_retry_at = null, last_research_at = now(), updated_at = now()
    where id = p_task_id;
    return jsonb_build_object('task_id',p_task_id,'outcome','ALREADY_COVERED');
  end if;

  v_detail := nullif(btrim(p_result ->> 'detail'),'');

  if v_outcome = 'TRANSIENT_FAILURE' then
    v_retry_seconds := greatest(60, least(3600, coalesce((p_result ->> 'retry_after_seconds')::integer, 300)));
    update public.product_fact_research_tasks
    set state = 'RESEARCH_PENDING', blocker_code = 'SOURCE_TRANSIENT_FAILURE',
        blocker_detail = coalesce(v_detail,'Transient official-source fetch failure.'),
        next_retry_at = now() + make_interval(secs => v_retry_seconds),
        last_research_at = now(), updated_at = now()
    where id = p_task_id;
    return jsonb_build_object('task_id',p_task_id,'outcome','TRANSIENT_FAILURE','retry_after_seconds',v_retry_seconds);
  end if;

  if v_outcome in ('EVIDENCE_INSUFFICIENT','SOURCE_BLOCKED','OUT_OF_SCOPE') then
    update public.product_fact_research_tasks
    set state = 'BLOCKED', blocker_code = v_outcome,
        blocker_detail = coalesce(v_detail, lower(v_outcome)),
        next_retry_at = null, last_research_at = now(), updated_at = now()
    where id = p_task_id;
    return jsonb_build_object('task_id',p_task_id,'outcome',v_outcome);
  end if;

  if v_outcome in ('REVIEW_REQUIRED','FORMULATION_CONFLICT','MARKET_CONFLICT') then
    v_blocker := case when v_outcome = 'REVIEW_REQUIRED'
      then coalesce(nullif(upper(p_result ->> 'blocker_code'),''),'REVIEW_REQUIRED')
      else v_outcome end;
    update public.product_fact_research_tasks
    set state = 'REVIEW_REQUIRED', blocker_code = v_blocker,
        blocker_detail = coalesce(v_detail, lower(v_blocker)),
        next_retry_at = null, last_research_at = now(), updated_at = now()
    where id = p_task_id;
    return jsonb_build_object('task_id',p_task_id,'outcome',v_outcome,'blocker_code',v_blocker);
  end if;

  if v_outcome <> 'EVIDENCE_CANDIDATE' then
    raise exception 'trust_research_outcome_not_supported:%', v_outcome;
  end if;

  v_source := p_result -> 'source';
  v_candidate := p_result -> 'candidate';
  if jsonb_typeof(v_source) <> 'object' or jsonb_typeof(v_candidate) <> 'object' then
    raise exception 'trust_research_candidate_payload_invalid';
  end if;

  select * into v_binding
  from public.product_source_bindings psb
  where psb.binding_id = nullif(v_source ->> 'source_binding_id','')::uuid
    and psb.product_id = v_task.product_id
    and psb.binding_state = 'resolved'
    and psb.source_name ~ '_official$'
    and psb.source_url ~ '^https://'
    and (
      (
        v_intake.catalog_revision not like 'legacy-backfill-v1:%'
        and psb.market_code is not distinct from v_intake.market
      )
      or exists (
        select 1
        from public.trust_official_source_binding_reviews osr
        where v_intake.catalog_revision like 'legacy-backfill-v1:%'
          and osr.binding_id = psb.binding_id
          and osr.product_id = v_task.product_id
          and osr.subject_id = v_task.subject_id
          and osr.subject_market is not distinct from v_intake.market
          and psb.market_code is not distinct from osr.source_market
          and osr.variant_key is not distinct from v_subject.variant_key
          and osr.formulation_revision_key is not distinct from v_subject.formulation_revision_key
          and osr.source_kind = v_source ->> 'source_kind'
          and osr.review_version = 'trust-official-source-review-v1'
          and psb.binding_method = 'trust_official_source_review_v1'
          and psb.product_scope_state = 'product'
      )
    );
  if not found then
    update public.product_fact_research_tasks
    set state = 'BLOCKED', blocker_code = 'SOURCE_BLOCKED',
        blocker_detail = 'Evidence candidate source is not an exact-market resolved official source binding.',
        last_research_at = now(), updated_at = now()
    where id = p_task_id;
    return jsonb_build_object('task_id',p_task_id,'outcome','SOURCE_BLOCKED');
  end if;

  v_digest_basis := v_source ->> 'digest_basis';
  v_page_digest := lower(coalesce(v_source ->> 'source_content_digest',''));
  if v_digest_basis not in ('live-page-bytes-v1','frozen-first-party-observation-v1-not-live-page-bytes') then
    raise exception 'trust_research_digest_basis_invalid';
  end if;
  if v_page_digest !~ '^[0-9a-f]{64}$' then
    raise exception 'trust_research_source_digest_invalid';
  end if;
  if nullif(btrim(v_source ->> 'source_kind'),'') is null
    or (v_source ->> 'source_kind') not in (
      'brand_official_product_page','brand_official_faq','brand_official_technical_document',
      'manufacturer_official_document','official_market_sales_page'
    ) then
    raise exception 'trust_research_source_kind_invalid';
  end if;
  if jsonb_typeof(v_source -> 'observed_claim') <> 'object'
    or jsonb_typeof(v_source -> 'product_identity_observation') <> 'object'
    or nullif(btrim(v_source ->> 'observation_version'),'') is null then
    raise exception 'trust_research_observation_invalid';
  end if;

  if v_digest_basis = 'frozen-first-party-observation-v1-not-live-page-bytes' then
    v_observation_digest := encode(extensions.digest(convert_to(jsonb_build_object(
      'source_binding_id', v_binding.binding_id,
      'canonical_locator', v_binding.source_url,
      'publisher', v_binding.source_name,
      'source_kind', v_source ->> 'source_kind',
      'market', v_binding.market_code,
      'locale', v_binding.locale,
      'observed_claim', v_source -> 'observed_claim',
      'product_identity_observation', v_source -> 'product_identity_observation',
      'observation_version', v_source ->> 'observation_version'
    )::text,'UTF8'),'sha256'),'hex');
    if v_page_digest <> v_observation_digest then
      raise exception 'trust_research_frozen_observation_digest_mismatch';
    end if;
  end if;

  v_evidence_class := v_candidate ->> 'evidence_class';
  if v_evidence_class is null
    or not (coalesce(v_definition -> 'permitted_evidence_classes','[]'::jsonb) ? v_evidence_class) then
    update public.product_fact_research_tasks
    set state = 'BLOCKED', blocker_code = 'OUT_OF_SCOPE',
        blocker_detail = 'Evidence class is not permitted by the active Registry definition.',
        last_research_at = now(), updated_at = now()
    where id = p_task_id;
    return jsonb_build_object('task_id',p_task_id,'outcome','OUT_OF_SCOPE');
  end if;

  v_normalized_value := v_candidate -> 'normalized_value';
  v_expected_type := v_definition ->> 'value_type';
  v_allowed_values := v_definition -> 'allowed_values';
  if v_normalized_value is null then
    raise exception 'trust_research_normalized_value_missing';
  end if;
  if v_expected_type = 'number' and jsonb_typeof(v_normalized_value) <> 'number' then
    raise exception 'trust_research_normalized_value_type_invalid:number';
  elsif v_expected_type = 'boolean' and jsonb_typeof(v_normalized_value) <> 'boolean' then
    raise exception 'trust_research_normalized_value_type_invalid:boolean';
  elsif v_expected_type in ('enum','entity_identifier') and jsonb_typeof(v_normalized_value) <> 'string' then
    raise exception 'trust_research_normalized_value_type_invalid:%', v_expected_type;
  elsif v_expected_type in ('number_unit','range_unit') and jsonb_typeof(v_normalized_value) <> 'object' then
    raise exception 'trust_research_normalized_value_type_invalid:%', v_expected_type;
  end if;
  if v_expected_type = 'enum'
    and jsonb_typeof(v_allowed_values) = 'array'
    and not (v_allowed_values ? trim(both '"' from v_normalized_value::text)) then
    raise exception 'trust_research_enum_value_invalid';
  end if;

  v_support_direction := coalesce(v_candidate ->> 'support_direction','supports');
  v_negative_admissibility := coalesce(v_candidate ->> 'negative_admissibility','not_applicable');
  if v_support_direction not in ('supports','opposes') then
    raise exception 'trust_research_support_direction_invalid';
  end if;
  if v_support_direction = 'opposes'
    and v_negative_admissibility not in ('explicit_negative','conflict_opposition') then
    raise exception 'trust_research_negative_semantics_invalid';
  end if;
  if v_support_direction = 'supports' and v_negative_admissibility <> 'not_applicable' then
    raise exception 'trust_research_positive_negative_semantics_invalid';
  end if;

  v_confidence := coalesce(v_candidate ->> 'confidence','high');
  if v_confidence not in ('high','medium','low') then
    raise exception 'trust_research_confidence_invalid';
  end if;

  insert into public.trust_source_observations (
    research_task_id, product_id, subject_id, source_binding_id,
    canonical_locator, publisher, source_kind, market, region, locale,
    observed_claim, product_identity_observation, observation_version,
    digest_basis, source_content_digest, observed_at, fetched_at
  ) values (
    v_task.id, v_task.product_id, v_task.subject_id, v_binding.binding_id,
    v_binding.source_url, v_binding.source_name, v_source ->> 'source_kind',
    v_binding.market_code, nullif(v_source ->> 'region',''), v_binding.locale,
    v_source -> 'observed_claim', v_source -> 'product_identity_observation',
    v_source ->> 'observation_version', v_digest_basis, v_page_digest,
    coalesce(nullif(v_source ->> 'observed_at','')::timestamptz, now()),
    nullif(v_source ->> 'fetched_at','')::timestamptz
  )
  on conflict (research_task_id, canonical_locator, observation_version, source_content_digest)
  do nothing
  returning observation_id into v_observation_id;

  if v_observation_id is null then
    select observation_id into v_observation_id
    from public.trust_source_observations
    where research_task_id = v_task.id
      and canonical_locator = v_binding.source_url
      and observation_version = v_source ->> 'observation_version'
      and source_content_digest = v_page_digest;
  end if;

  v_evidence_digest := encode(extensions.digest(convert_to(jsonb_build_object(
    'subject_id', v_task.subject_id,
    'registry_version', v_task.registry_version,
    'fact_key', v_task.fact_key,
    'normalized_value', v_normalized_value,
    'evidence_class', v_evidence_class,
    'support_direction', v_support_direction,
    'negative_admissibility', v_negative_admissibility,
    'market', v_intake.market,
    'region', nullif(v_candidate ->> 'region',''),
    'locale', v_binding.locale,
    'qualifier', coalesce(v_candidate -> 'qualifier','{}'::jsonb),
    'source_content_digest', v_page_digest
  )::text,'UTF8'),'sha256'),'hex');

  insert into public.trust_evidence_candidates (
    research_task_id, observation_id, product_id, subject_id,
    registry_version, fact_key, normalized_value, evidence_class,
    evidence_authority, confidence, support_direction, negative_admissibility,
    market, region, locale, qualifier, candidate_state, canonical_evidence_digest
  ) values (
    v_task.id, v_observation_id, v_task.product_id, v_task.subject_id,
    v_task.registry_version, v_task.fact_key, v_normalized_value, v_evidence_class,
    'product_specific_primary', v_confidence, v_support_direction, v_negative_admissibility,
    v_intake.market, nullif(v_candidate ->> 'region',''), v_binding.locale,
    coalesce(v_candidate -> 'qualifier','{}'::jsonb), 'READY', v_evidence_digest
  )
  on conflict (canonical_evidence_digest)
  do nothing
  returning candidate_id into v_candidate_id;

  if v_candidate_id is null then
    select candidate_id into v_candidate_id
    from public.trust_evidence_candidates
    where canonical_evidence_digest = v_evidence_digest;
  end if;

  update public.product_fact_research_tasks
  set state = 'EVIDENCE_CANDIDATE',
      source_locator = v_binding.source_url,
      source_content_digest = v_page_digest,
      source_observation_id = v_observation_id,
      evidence_candidate_id = v_candidate_id,
      blocker_code = null,
      blocker_detail = null,
      next_retry_at = null,
      last_research_at = now(),
      updated_at = now()
  where id = p_task_id;

  return jsonb_build_object(
    'task_id', p_task_id,
    'outcome', 'EVIDENCE_CANDIDATE',
    'source_observation_id', v_observation_id,
    'evidence_candidate_id', v_candidate_id,
    'canonical_evidence_digest', v_evidence_digest
  );
end;
$$;

create or replace function public.process_trust_reentry_event_v1(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event public.trust_reentry_events%rowtype;
  v_task public.product_fact_research_tasks%rowtype;
  v_intake public.catalog_trust_intake%rowtype;
  v_disposition text;
  v_reason text;
begin
  select * into v_event
  from public.trust_reentry_events
  where event_id=p_event_id
  for update;

  if not found then
    raise exception 'trust_reentry_event_not_found' using errcode='P0002';
  end if;

  if v_event.disposition <> 'PENDING' then
    return jsonb_build_object(
      'status','processed',
      'idempotent',true,
      'event_id',v_event.event_id,
      'event_type',v_event.event_type,
      'disposition',v_event.disposition,
      'detail',v_event.disposition_detail
    );
  end if;

  if v_event.event_type in ('SOURCE_CHANGED','FORMULATION_CHANGED','POLICY_CHANGED','REGISTRY_CHANGED') then
    v_disposition := 'REVIEW_REQUIRED';
    v_reason := case v_event.event_type
      when 'SOURCE_CHANGED' then 'SOURCE_CHANGED_REVIEW_REQUIRED'
      when 'FORMULATION_CHANGED' then 'FORMULATION_CHANGED_REVIEW_REQUIRED'
      when 'POLICY_CHANGED' then 'POLICY_CHANGED_REVALIDATION_REQUIRED'
      else 'REGISTRY_CHANGED_REVALIDATION_REQUIRED'
    end;

    update public.trust_reentry_events
    set disposition=v_disposition,
        disposition_detail=jsonb_build_object(
          'reason_code',v_reason,
          'authority_mutation',false,
          'current_invalidated',false,
          'phase','6-A'
        ),
        processed_at=now()
    where event_id=v_event.event_id;

    return jsonb_build_object(
      'status','processed',
      'idempotent',false,
      'event_id',v_event.event_id,
      'event_type',v_event.event_type,
      'disposition',v_disposition,
      'reason_code',v_reason,
      'authority_mutation',false,
      'current_invalidated',false
    );
  end if;

  -- MANUAL_RETRY is a revalidation request, never a force-reset.
  -- Phase 7-B legacy materializations preserve their frozen exact Subject scope
  -- and must never be routed back through the generic Phase 2 resolver.
  if v_event.research_task_id is not null then
    select * into v_task
    from public.product_fact_research_tasks
    where id=v_event.research_task_id
    for update;

    if found then
      select * into v_intake
      from public.catalog_trust_intake
      where id=v_task.intake_id;
    end if;
  elsif v_event.intake_id is not null then
    select * into v_intake
    from public.catalog_trust_intake
    where id=v_event.intake_id;
  else
    -- Product-level legacy retries are also snapshot-preserving. Prefer the
    -- materialized legacy intake over generic re-resolution when one exists.
    select * into v_intake
    from public.catalog_trust_intake
    where product_id=v_event.product_id
      and catalog_revision like 'legacy-backfill-v1:%'
    order by created_at desc,id desc
    limit 1;
  end if;

  if v_intake.id is not null
    and v_intake.catalog_revision like 'legacy-backfill-v1:%'
  then
    if v_event.research_task_id is null then
      v_disposition := 'NOOP';
      v_reason := 'LEGACY_IDENTITY_SNAPSHOT_PRESERVED';
    elsif v_task.id is null then
      v_disposition := 'BLOCKED';
      v_reason := 'RESEARCH_TASK_NOT_FOUND';
    elsif v_task.state in ('EVIDENCE_CANDIDATE','PREFLIGHT_READY','CONFIRMED','ALREADY_COVERED') then
      v_disposition := 'NOOP';
      v_reason := 'GOVERNED_OR_COVERED_STATE_PRESERVED';
    elsif v_intake.identity_state <> 'EXACT_SUBJECT_FOUND' or v_task.subject_id is null then
      v_disposition := case when v_intake.trust_state='BLOCKED' then 'BLOCKED' else 'REVIEW_REQUIRED' end;
      v_reason := coalesce(v_task.blocker_code,v_intake.identity_state,'IDENTITY_REVALIDATION_REQUIRED');
    elsif v_task.state in ('BLOCKED','REVIEW_REQUIRED')
      and v_task.blocker_code in ('SOURCE_BLOCKED','EVIDENCE_INSUFFICIENT')
    then
      if not public.trust_phase7c_legacy_subject_scope_ready_v1(v_task.id) then
        v_disposition := 'REVIEW_REQUIRED';
        v_reason := 'LEGACY_SUBJECT_SCOPE_BLOCKED';
      elsif not public.trust_phase7c_has_controlled_official_source_v1(v_task.id) then
        v_disposition := 'REVIEW_REQUIRED';
        v_reason := 'OFFICIAL_SOURCE_REQUIRED';
      else
        update public.product_fact_research_tasks
        set state='RESEARCH_PENDING',
            blocker_code=null,
            blocker_detail=null,
            next_retry_at=now(),
            completed_at=null,
            updated_at=now()
        where id=v_task.id;

        v_disposition := 'RESEARCH_REQUEUED';
        v_reason := 'LEGACY_MANUAL_RETRY_READY';
      end if;
    else
      v_disposition := 'NOOP';
      v_reason := 'MANUAL_RETRY_NOT_ELIGIBLE_FOR_FORCE_RESET';
    end if;
  else
    perform public.process_catalog_trust_product_v1(v_event.product_id);

    if v_event.research_task_id is null then
      v_disposition := 'NOOP';
      v_reason := 'MANUAL_REVALIDATION_PRODUCT_REFRESHED';
    else
      if v_task.id is null then
        select * into v_task
        from public.product_fact_research_tasks
        where id=v_event.research_task_id
        for update;
      end if;

      if v_task.id is null then
        v_disposition := 'BLOCKED';
        v_reason := 'RESEARCH_TASK_NOT_FOUND';
      else
        if v_intake.id is null then
          select * into v_intake
          from public.catalog_trust_intake
          where id=v_task.intake_id;
        end if;

        if v_task.state in ('EVIDENCE_CANDIDATE','PREFLIGHT_READY','CONFIRMED','ALREADY_COVERED') then
          v_disposition := 'NOOP';
          v_reason := 'GOVERNED_OR_COVERED_STATE_PRESERVED';
        elsif v_intake.identity_state <> 'EXACT_SUBJECT_FOUND' or v_task.subject_id is null then
          v_disposition := case when v_intake.trust_state='BLOCKED' then 'BLOCKED' else 'REVIEW_REQUIRED' end;
          v_reason := coalesce(v_task.blocker_code,v_intake.identity_state,'IDENTITY_REVALIDATION_REQUIRED');
        elsif v_task.state in ('BLOCKED','REVIEW_REQUIRED')
          and v_task.blocker_code in ('SOURCE_BLOCKED','EVIDENCE_INSUFFICIENT')
        then
          update public.product_fact_research_tasks
          set state='RESEARCH_PENDING',
              blocker_code=null,
              blocker_detail=null,
              next_retry_at=now(),
              completed_at=null,
              updated_at=now()
          where id=v_task.id;

          perform public.process_catalog_trust_product_v1(v_event.product_id);
          v_disposition := 'RESEARCH_REQUEUED';
          v_reason := 'MANUAL_RETRY_ELIGIBLE_RESEARCH_BLOCKER';
        else
          v_disposition := 'NOOP';
          v_reason := 'MANUAL_RETRY_NOT_ELIGIBLE_FOR_FORCE_RESET';
        end if;
      end if;
    end if;
  end if;

  update public.trust_reentry_events
  set disposition=v_disposition,
      disposition_detail=jsonb_build_object(
        'reason_code',v_reason,
        'authority_mutation',false,
        'current_invalidated',false,
        'phase','6-A'
      ),
      processed_at=now()
  where event_id=v_event.event_id;

  return jsonb_build_object(
    'status','processed',
    'idempotent',false,
    'event_id',v_event.event_id,
    'event_type',v_event.event_type,
    'disposition',v_disposition,
    'reason_code',v_reason,
    'authority_mutation',false,
    'current_invalidated',false
  );
end;
$$;

revoke all on function public.claim_trust_research_tasks_v1(integer,integer)
  from public, anon, authenticated, service_role;
grant execute on function public.claim_trust_research_tasks_v1(integer,integer)
  to service_role;

revoke all on function public.record_trust_research_result_v1(uuid,jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.record_trust_research_result_v1(uuid,jsonb)
  to service_role;

revoke all on function public.process_trust_reentry_event_v1(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.process_trust_reentry_event_v1(uuid)
  to service_role;

comment on table public.trust_official_source_binding_reviews is
  'Phase 7-C reviewed bridge from an operational official source binding to one exact legacy governed Product Fact Subject scope.';
comment on function public.admin_register_trust_official_source_binding_v1(uuid,text,jsonb) is
  'Admin-review-only admission boundary for exact legacy official-source bindings; never Product Fact or Recommendation authority.';
comment on function public.preflight_trust_legacy_research_readiness_v1(integer,uuid) is
  'Read-only Phase 7-C readiness diagnostic for legacy RESEARCH_PENDING tasks.';
comment on function public.claim_trust_research_tasks_v1(integer,integer) is
  'Phase 3 claim boundary with Phase 7-C legacy exact-Subject compatibility and controlled official-source gating; non-legacy behavior preserved.';
comment on function public.process_trust_reentry_event_v1(uuid) is
  'Phase 6-A re-entry processor hardened for Phase 7-B legacy identity snapshots; legacy manual retry never invokes the generic resolver.';

commit;
