create table public.trust_official_source_relocations (
  relocation_id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  subject_id uuid not null references public.product_fact_subjects(subject_id) on delete restrict,
  historical_source_id uuid not null references public.product_evidence_sources(source_id) on delete restrict,
  old_binding_id uuid not null references public.product_source_bindings(binding_id) on delete restrict,
  old_review_id uuid not null references public.trust_official_source_binding_reviews(review_id) on delete restrict,
  replacement_binding_id uuid not null references public.product_source_bindings(binding_id) on delete restrict,
  replacement_review_id uuid not null references public.trust_official_source_binding_reviews(review_id) on delete restrict,
  old_locator text not null,
  replacement_locator text not null,
  replacement_external_id text not null,
  qualification_contract text not null,
  qualification_digest text not null,
  prestate_snapshot jsonb not null,
  prestate_digest text not null,
  replacement_snapshot jsonb not null,
  relocation_plan_digest text not null,
  actor_user_id uuid not null,
  request_id text not null,
  relocation_version text not null,
  result text not null,
  created_at timestamptz not null default now(),
  constraint trust_official_source_relocations_old_binding_key unique (old_binding_id),
  constraint trust_official_source_relocations_plan_digest_key unique (relocation_plan_digest),
  constraint trust_official_source_relocations_locator_check check (
    old_locator ~ '^https://[^[:space:]#]+$'
    and replacement_locator ~ '^https://[^[:space:]#]+$'
    and old_locator <> replacement_locator
    and char_length(old_locator) <= 2048
    and char_length(replacement_locator) <= 2048
  ),
  constraint trust_official_source_relocations_external_id_check check (
    replacement_external_id ~ '^official-url-sha256:[0-9a-f]{64}$'
  ),
  constraint trust_official_source_relocations_qualification_contract_check check (
    qualification_contract = 'trust-phase8h-source-identity-qualification-v1'
  ),
  constraint trust_official_source_relocations_qualification_digest_check check (
    qualification_digest ~ '^[0-9a-f]{64}$'
  ),
  constraint trust_official_source_relocations_prestate_digest_check check (
    prestate_digest ~ '^[0-9a-f]{64}$'
  ),
  constraint trust_official_source_relocations_plan_digest_check check (
    relocation_plan_digest ~ '^[0-9a-f]{64}$'
  ),
  constraint trust_official_source_relocations_prestate_snapshot_check check (
    jsonb_typeof(prestate_snapshot) = 'object'
  ),
  constraint trust_official_source_relocations_replacement_snapshot_check check (
    jsonb_typeof(replacement_snapshot) = 'object'
  ),
  constraint trust_official_source_relocations_request_id_check check (
    request_id = btrim(request_id) and char_length(request_id) between 8 and 120
  ),
  constraint trust_official_source_relocations_version_check check (
    relocation_version = 'trust-official-source-relocation-v1'
  ),
  constraint trust_official_source_relocations_result_check check (result = 'confirmed')
);

create index trust_official_source_relocations_subject_created_idx
  on public.trust_official_source_relocations(subject_id, created_at desc);

create or replace function public.reject_trust_official_source_relocation_mutation_v1()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'trust_official_source_relocations_append_only' using errcode = '55000';
end;
$$;

revoke all on function public.reject_trust_official_source_relocation_mutation_v1()
  from public, anon, authenticated, service_role;

create trigger trust_official_source_relocations_immutable_v1
before update or delete on public.trust_official_source_relocations
for each row execute function public.reject_trust_official_source_relocation_mutation_v1();

alter table public.trust_official_source_relocations enable row level security;
revoke all on table public.trust_official_source_relocations
  from public, anon, authenticated, service_role;
grant select on table public.trust_official_source_relocations to service_role;

create or replace function public.trust_phase8h_canonical_json_text_v1(p_value jsonb)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select case jsonb_typeof(p_value)
    when 'object' then
      '{' || coalesce((
        select string_agg(
          to_jsonb(e.key)::text || ':' || public.trust_phase8h_canonical_json_text_v1(e.value),
          ',' order by e.key
        )
        from jsonb_each(p_value) as e(key, value)
      ), '') || '}'
    when 'array' then
      '[' || coalesce((
        select string_agg(
          public.trust_phase8h_canonical_json_text_v1(a.value),
          ',' order by a.ordinality
        )
        from jsonb_array_elements(p_value) with ordinality as a(value, ordinality)
      ), '') || ']'
    else p_value::text
  end;
$$;

revoke all on function public.trust_phase8h_canonical_json_text_v1(jsonb)
  from public, anon, authenticated, service_role;

create or replace function public.admin_confirm_trust_official_source_relocation_v1(
  p_actor_user_id uuid,
  p_request_id text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_role text;
  v_request_id text := btrim(coalesce(p_request_id, ''));
  v_product_id uuid;
  v_subject_id uuid;
  v_historical_source_id uuid;
  v_old_binding_id uuid;
  v_old_review_id uuid;
  v_expected_prestate_digest text;
  v_plan_digest text;
  v_qualification_contract text;
  v_qualification_digest text;
  v_old_locator text;
  v_replacement jsonb;
  v_source_name text;
  v_source_kind text;
  v_external_id text;
  v_source_url text;
  v_market text;
  v_locale text;
  v_derived_external_id text;
  v_prestate jsonb;
  v_prestate_digest text;
  v_plan_preimage jsonb;
  v_derived_plan_digest text;
  v_historical_source public.product_evidence_sources%rowtype;
  v_historical_binding public.product_evidence_source_subject_bindings%rowtype;
  v_subject public.product_fact_subjects%rowtype;
  v_old_binding public.product_source_bindings%rowtype;
  v_old_review public.trust_official_source_binding_reviews%rowtype;
  v_new_binding public.product_source_bindings%rowtype;
  v_new_review public.trust_official_source_binding_reviews%rowtype;
  v_existing public.trust_official_source_relocations%rowtype;
  v_relocation public.trust_official_source_relocations%rowtype;
  v_replacement_snapshot jsonb;
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
      'contract','expected_prestate_digest','relocation_plan_digest',
      'qualification_contract','qualification_digest','historical_source_id',
      'product_id','subject_id','old_binding_id','old_review_id','old_locator',
      'replacement','authority','mutation_scope','forbidden_mutations'
    ])
    or (select count(*) from jsonb_object_keys(p_payload)) <> 15
    or p_payload->>'contract' <> 'trust-phase8h-governed-relocation-confirmation-request-v1'
    or p_payload->>'authority' <> 'ADMIN_CONFIRMATION_REQUEST_REQUIRES_DATABASE_PRESTATE_REVALIDATION'
    or p_payload->'mutation_scope' <> '[
      "CREATE_OR_REUSE_REPLACEMENT_PRODUCT_SOURCE_BINDING",
      "CREATE_OR_REUSE_REPLACEMENT_OFFICIAL_SOURCE_REVIEW",
      "RETIRE_OLD_REVIEWED_BINDING_IN_SAME_TRANSACTION",
      "APPEND_IMMUTABLE_RELOCATION_LEDGER"
    ]'::jsonb
    or p_payload->'forbidden_mutations' <> '[
      "PRODUCT_EVIDENCE_SOURCE_CANONICAL_LOCATOR",
      "PRODUCT_EVIDENCE_SOURCE_CONTENT_DIGEST",
      "PRODUCT_EVIDENCE_SOURCE_SUBJECT_BINDING",
      "PRODUCT_FACT",
      "PRODUCT_FACT_CURRENT",
      "PRODUCT_FACT_CONFIRMATION",
      "RECOMMENDATION_AUTHORITY",
      "RECOMMENDATION_LOG"
    ]'::jsonb
  then
    raise exception 'trust_official_source_relocation_payload_invalid' using errcode = '22023';
  end if;

  begin
    v_product_id := (p_payload->>'product_id')::uuid;
    v_subject_id := (p_payload->>'subject_id')::uuid;
    v_historical_source_id := (p_payload->>'historical_source_id')::uuid;
    v_old_binding_id := (p_payload->>'old_binding_id')::uuid;
    v_old_review_id := (p_payload->>'old_review_id')::uuid;
  exception when others then
    raise exception 'trust_official_source_relocation_identity_invalid' using errcode = '22023';
  end;

  v_expected_prestate_digest := btrim(coalesce(p_payload->>'expected_prestate_digest', ''));
  v_plan_digest := btrim(coalesce(p_payload->>'relocation_plan_digest', ''));
  v_qualification_contract := btrim(coalesce(p_payload->>'qualification_contract', ''));
  v_qualification_digest := btrim(coalesce(p_payload->>'qualification_digest', ''));
  v_old_locator := btrim(coalesce(p_payload->>'old_locator', ''));
  v_replacement := p_payload->'replacement';

  if v_expected_prestate_digest !~ '^[0-9a-f]{64}$'
    or v_plan_digest !~ '^[0-9a-f]{64}$'
    or v_qualification_contract <> 'trust-phase8h-source-identity-qualification-v1'
    or v_qualification_digest !~ '^[0-9a-f]{64}$'
    or v_old_locator !~ '^https://[^[:space:]#]+$'
    or jsonb_typeof(v_replacement) <> 'object'
    or not (v_replacement ?& array[
      'source_name','external_type','external_id','source_url','market_code','locale'
    ])
    or (select count(*) from jsonb_object_keys(v_replacement)) <> 6
  then
    raise exception 'trust_official_source_relocation_payload_invalid' using errcode = '22023';
  end if;

  v_source_name := lower(btrim(coalesce(v_replacement->>'source_name', '')));
  v_source_kind := btrim(coalesce(v_replacement->>'external_type', ''));
  v_external_id := btrim(coalesce(v_replacement->>'external_id', ''));
  v_source_url := btrim(coalesce(v_replacement->>'source_url', ''));
  v_market := nullif(btrim(coalesce(v_replacement->>'market_code', '')), '');
  v_locale := nullif(btrim(coalesce(v_replacement->>'locale', '')), '');

  if v_source_name !~ '^[a-z0-9][a-z0-9_-]{0,54}_official$'
    or v_source_kind not in (
      'brand_official_product_page','brand_official_faq',
      'brand_official_technical_document','manufacturer_official_document',
      'official_market_sales_page'
    )
    or v_external_id !~ '^official-url-sha256:[0-9a-f]{64}$'
    or v_source_url !~ '^https://[^[:space:]#]+$'
    or char_length(v_source_url) > 2048
    or v_source_url = v_old_locator
    or (v_market is not null and char_length(v_market) > 32)
    or (v_locale is not null and char_length(v_locale) > 32)
  then
    raise exception 'trust_official_source_relocation_replacement_invalid' using errcode = '23514';
  end if;

  v_derived_external_id := 'official-url-sha256:' ||
    encode(extensions.digest(convert_to(v_source_url, 'UTF8'), 'sha256'), 'hex');

  if v_derived_external_id <> v_external_id then
    raise exception 'trust_official_source_relocation_external_id_mismatch' using errcode = '23514';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('bejewely_trust_official_source_relocation:' || v_plan_digest, 0)
  );

  select * into v_existing
  from public.trust_official_source_relocations r
  where r.relocation_plan_digest = v_plan_digest;

  if found then
    if v_existing.product_id <> v_product_id
      or v_existing.subject_id <> v_subject_id
      or v_existing.historical_source_id <> v_historical_source_id
      or v_existing.old_binding_id <> v_old_binding_id
      or v_existing.old_review_id <> v_old_review_id
      or v_existing.old_locator <> v_old_locator
      or v_existing.replacement_locator <> v_source_url
      or v_existing.replacement_external_id <> v_external_id
      or v_existing.qualification_contract <> v_qualification_contract
      or v_existing.qualification_digest <> v_qualification_digest
      or v_existing.prestate_digest <> v_expected_prestate_digest
      or v_existing.actor_user_id <> p_actor_user_id
      or v_existing.request_id <> v_request_id
      or v_existing.relocation_version <> 'trust-official-source-relocation-v1'
      or v_existing.result <> 'confirmed'
    then
      raise exception 'trust_official_source_relocation_idempotency_conflict' using errcode = '23505';
    end if;

    return jsonb_build_object(
      'status','confirmed','idempotent',true,
      'relocation_id',v_existing.relocation_id,
      'old_binding_id',v_existing.old_binding_id,
      'old_review_id',v_existing.old_review_id,
      'replacement_binding_id',v_existing.replacement_binding_id,
      'replacement_review_id',v_existing.replacement_review_id,
      'product_id',v_existing.product_id,
      'subject_id',v_existing.subject_id
    );
  end if;

  if exists (
    select 1 from public.trust_official_source_relocations r
    where r.old_binding_id = v_old_binding_id
  ) then
    raise exception 'trust_official_source_relocation_old_binding_already_confirmed' using errcode = '23505';
  end if;

  select * into v_old_binding
  from public.product_source_bindings b
  where b.binding_id = v_old_binding_id
  for update;

  if not found
    or v_old_binding.product_id <> v_product_id
    or v_old_binding.source_url is distinct from v_old_locator
    or v_old_binding.binding_state <> 'resolved'
    or v_old_binding.binding_method <> 'trust_official_source_review_v1'
    or v_old_binding.product_scope_state <> 'product'
  then
    raise exception 'trust_official_source_relocation_old_binding_stale' using errcode = '23514';
  end if;

  select * into v_old_review
  from public.trust_official_source_binding_reviews r
  where r.review_id = v_old_review_id
    and r.binding_id = v_old_binding_id
    and r.product_id = v_product_id
    and r.subject_id = v_subject_id
    and r.review_version = 'trust-official-source-review-v1';

  if not found then
    raise exception 'trust_official_source_relocation_old_review_stale' using errcode = '23514';
  end if;

  select * into v_historical_source
  from public.product_evidence_sources s
  where s.source_id = v_historical_source_id;

  if not found or v_historical_source.canonical_locator <> v_old_locator then
    raise exception 'trust_official_source_relocation_historical_source_stale' using errcode = '23514';
  end if;

  begin
    select * into strict v_historical_binding
    from public.product_evidence_source_subject_bindings b
    where b.source_id = v_historical_source_id
      and b.product_id = v_product_id
      and b.subject_id = v_subject_id
      and b.binding_state = 'exact_subject_match'
      and b.scope_relation in ('equivalent','narrower');
  exception
    when no_data_found then
      raise exception 'trust_official_source_relocation_historical_subject_binding_missing' using errcode = '23514';
    when too_many_rows then
      raise exception 'trust_official_source_relocation_historical_subject_binding_ambiguous' using errcode = '23514';
  end;

  select * into v_subject
  from public.product_fact_subjects s
  where s.subject_id = v_subject_id
    and s.product_id = v_product_id
    and s.identity_status = 'resolved'
    and s.current_state = 'current';

  if not found or v_subject.formulation_revision_key is null then
    raise exception 'trust_official_source_relocation_governed_subject_stale' using errcode = '23514';
  end if;

  if v_old_review.subject_market is distinct from v_subject.market_applicability
    or v_old_review.source_market is distinct from v_old_binding.market_code
    or v_old_review.scope_relation not in ('equivalent','narrower')
    or v_old_review.variant_key is distinct from v_subject.variant_key
    or v_old_review.formulation_revision_key is distinct from v_subject.formulation_revision_key
    or v_old_review.source_kind <> v_old_binding.external_type
    or v_source_name <> v_old_binding.source_name
    or v_source_kind <> v_old_binding.external_type
    or v_market is distinct from v_old_binding.market_code
    or v_locale is distinct from v_old_binding.locale
  then
    raise exception 'trust_official_source_relocation_scope_or_identity_stale' using errcode = '23514';
  end if;

  v_prestate := jsonb_build_object(
    'qualification_digest', v_qualification_digest,
    'historical_source', jsonb_build_object(
      'source_id',v_historical_source.source_id,
      'canonical_locator',v_historical_source.canonical_locator,
      'publisher',v_historical_source.publisher,
      'source_kind',v_historical_source.source_kind,
      'market',v_historical_source.market,
      'locale',v_historical_source.locale,
      'content_digest',v_historical_source.content_digest
    ),
    'historical_subject_binding', jsonb_build_object(
      'binding_id',v_historical_binding.binding_id,
      'source_id',v_historical_binding.source_id,
      'product_id',v_historical_binding.product_id,
      'subject_id',v_historical_binding.subject_id,
      'binding_state',v_historical_binding.binding_state,
      'scope_relation',v_historical_binding.scope_relation
    ),
    'governed_subject', jsonb_build_object(
      'product_id',v_subject.product_id,
      'subject_id',v_subject.subject_id,
      'market_applicability',v_subject.market_applicability,
      'variant_key',v_subject.variant_key,
      'formulation_revision_key',v_subject.formulation_revision_key,
      'identity_status',v_subject.identity_status,
      'current_state',v_subject.current_state
    ),
    'current_reviewed_binding', jsonb_build_object(
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

  v_prestate_digest := encode(
    extensions.digest(
      convert_to(public.trust_phase8h_canonical_json_text_v1(v_prestate), 'UTF8'),
      'sha256'
    ),
    'hex'
  );

  if v_prestate_digest <> v_expected_prestate_digest then
    raise exception 'trust_official_source_relocation_prestate_stale' using errcode = '40001';
  end if;

  v_plan_preimage := jsonb_build_object(
    'contract','trust-phase8h-governed-relocation-preflight-v1',
    'status','READY_FOR_ADMIN_RELOCATION_CONFIRMATION',
    'blockers','[]'::jsonb,
    'historical_source_id',v_historical_source_id,
    'product_id',v_product_id,
    'subject_id',v_subject_id,
    'old_binding_id',v_old_binding_id,
    'old_review_id',v_old_review_id,
    'old_locator',v_old_locator,
    'replacement_locator',v_source_url,
    'replacement_external_id',v_external_id,
    'qualification_contract',v_qualification_contract,
    'qualification_digest',v_qualification_digest,
    'prestate_digest',v_prestate_digest,
    'mutation_policy','READ_ONLY_PREFLIGHT_NO_PRODUCTION_WRITE',
    'authority','PREFLIGHT_ONLY_REQUIRES_EXPLICIT_ADMIN_CONFIRMATION'
  );

  v_derived_plan_digest := encode(
    extensions.digest(
      convert_to(public.trust_phase8h_canonical_json_text_v1(v_plan_preimage), 'UTF8'),
      'sha256'
    ),
    'hex'
  );

  if v_derived_plan_digest <> v_plan_digest then
    raise exception 'trust_official_source_relocation_plan_digest_mismatch' using errcode = '23514';
  end if;

  select * into v_new_binding
  from public.product_source_bindings b
  where b.source_name = v_source_name
    and b.external_type = v_source_kind
    and b.external_id = v_external_id
  order by case when b.binding_state = 'resolved' then 0 else 1 end, b.created_at desc
  limit 1
  for update;

  if found then
    if v_new_binding.binding_state <> 'resolved'
      or v_new_binding.product_id <> v_product_id
      or v_new_binding.source_url is distinct from v_source_url
      or v_new_binding.market_code is distinct from v_market
      or v_new_binding.locale is distinct from v_locale
      or v_new_binding.binding_method <> 'trust_official_source_review_v1'
      or v_new_binding.product_scope_state <> 'product'
    then
      raise exception 'trust_official_source_relocation_replacement_binding_conflict' using errcode = '23505';
    end if;
  else
    insert into public.product_source_bindings(
      product_id,source_name,external_type,external_id,source_url,
      market_code,locale,binding_state,binding_method,product_scope_state,
      first_observed_at,last_observed_at,created_at,updated_at
    ) values (
      v_product_id,v_source_name,v_source_kind,v_external_id,v_source_url,
      v_market,v_locale,'resolved','trust_official_source_review_v1','product',
      now(),now(),now(),now()
    )
    returning * into v_new_binding;
  end if;

  select * into v_new_review
  from public.trust_official_source_binding_reviews r
  where r.binding_id = v_new_binding.binding_id
    and r.subject_id = v_subject_id
    and r.review_version = 'trust-official-source-review-v1';

  if found then
    if v_new_review.product_id <> v_product_id
      or v_new_review.subject_market is distinct from v_old_review.subject_market
      or v_new_review.source_market is distinct from v_market
      or v_new_review.scope_relation is distinct from v_old_review.scope_relation
      or v_new_review.variant_key is distinct from v_subject.variant_key
      or v_new_review.formulation_revision_key is distinct from v_subject.formulation_revision_key
      or v_new_review.source_kind <> v_source_kind
    then
      raise exception 'trust_official_source_relocation_replacement_review_conflict' using errcode = '23505';
    end if;
  else
    insert into public.trust_official_source_binding_reviews(
      binding_id,product_id,subject_id,subject_market,source_market,scope_relation,
      variant_key,formulation_revision_key,source_kind,actor_user_id,request_id,review_version
    ) values (
      v_new_binding.binding_id,v_product_id,v_subject_id,
      v_old_review.subject_market,v_market,v_old_review.scope_relation,
      v_subject.variant_key,v_subject.formulation_revision_key,v_source_kind,
      p_actor_user_id,v_request_id,'trust-official-source-review-v1'
    )
    returning * into v_new_review;
  end if;

  update public.product_source_bindings
  set binding_state = 'retired',
      updated_at = now()
  where binding_id = v_old_binding_id
    and binding_state = 'resolved';

  if not found then
    raise exception 'trust_official_source_relocation_old_binding_retire_failed' using errcode = '40001';
  end if;

  v_replacement_snapshot := jsonb_build_object(
    'binding_id',v_new_binding.binding_id,
    'review_id',v_new_review.review_id,
    'product_id',v_new_binding.product_id,
    'subject_id',v_new_review.subject_id,
    'source_name',v_new_binding.source_name,
    'external_type',v_new_binding.external_type,
    'external_id',v_new_binding.external_id,
    'source_url',v_new_binding.source_url,
    'market_code',v_new_binding.market_code,
    'locale',v_new_binding.locale,
    'binding_method',v_new_binding.binding_method,
    'product_scope_state',v_new_binding.product_scope_state,
    'subject_market',v_new_review.subject_market,
    'source_market',v_new_review.source_market,
    'scope_relation',v_new_review.scope_relation,
    'variant_key',v_new_review.variant_key,
    'formulation_revision_key',v_new_review.formulation_revision_key,
    'source_kind',v_new_review.source_kind,
    'review_version',v_new_review.review_version
  );

  insert into public.trust_official_source_relocations(
    product_id,subject_id,historical_source_id,
    old_binding_id,old_review_id,replacement_binding_id,replacement_review_id,
    old_locator,replacement_locator,replacement_external_id,
    qualification_contract,qualification_digest,
    prestate_snapshot,prestate_digest,replacement_snapshot,relocation_plan_digest,
    actor_user_id,request_id,relocation_version,result
  ) values (
    v_product_id,v_subject_id,v_historical_source_id,
    v_old_binding_id,v_old_review_id,v_new_binding.binding_id,v_new_review.review_id,
    v_old_locator,v_source_url,v_external_id,
    v_qualification_contract,v_qualification_digest,
    v_prestate,v_prestate_digest,v_replacement_snapshot,v_plan_digest,
    p_actor_user_id,v_request_id,'trust-official-source-relocation-v1','confirmed'
  )
  returning * into v_relocation;

  v_audit_id := public.record_admin_audit_event(
    p_actor_user_id,
    'admin.products.review',
    'admin.trust.official_source_relocation_confirmed',
    'trust_official_source_relocation',
    v_relocation.relocation_id::text,
    jsonb_build_object(
      'binding_id',v_old_binding_id,
      'review_id',v_old_review_id,
      'source_url',v_old_locator,
      'binding_state','resolved'
    ),
    jsonb_build_object(
      'binding_id',v_new_binding.binding_id,
      'review_id',v_new_review.review_id,
      'source_url',v_source_url,
      'old_binding_state','retired',
      'relocation_id',v_relocation.relocation_id
    ),
    'confirm governed official source relocation after Phase 8H exact identity qualification and read-only preflight',
    v_request_id,
    jsonb_build_object(
      'phase','8H-2B',
      'relocation_version','trust-official-source-relocation-v1',
      'qualification_digest',v_qualification_digest,
      'prestate_digest',v_prestate_digest,
      'relocation_plan_digest',v_plan_digest,
      'actor_role',v_actor_role
    )
  );

  return jsonb_build_object(
    'status','confirmed','idempotent',false,
    'relocation_id',v_relocation.relocation_id,
    'old_binding_id',v_old_binding_id,
    'old_review_id',v_old_review_id,
    'replacement_binding_id',v_new_binding.binding_id,
    'replacement_review_id',v_new_review.review_id,
    'product_id',v_product_id,
    'subject_id',v_subject_id,
    'audit_id',v_audit_id
  );
end;
$$;

revoke all on function public.admin_confirm_trust_official_source_relocation_v1(uuid, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.admin_confirm_trust_official_source_relocation_v1(uuid, text, jsonb)
  to service_role;

comment on table public.trust_official_source_relocations is
  'Immutable Phase 8H-2B ledger for governed official-source relocations without rewriting historical Evidence or Product Fact semantics.';

comment on function public.admin_confirm_trust_official_source_relocation_v1(uuid, text, jsonb) is
  'Phase 8H-2B Admin boundary: revalidates exact DB prestate, creates or reuses replacement official-source authority, retires the old binding, appends immutable relocation provenance, and does not mutate Product Fact truth.';
