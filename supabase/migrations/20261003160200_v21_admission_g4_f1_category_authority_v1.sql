begin;

-- V2.1-ADMISSION-G4-F1
-- Durable Recommendation category-authority infrastructure only.
-- This migration creates no reviewed category grant and performs no Recommendation cutover.

do $$
declare
  v_product_count integer;
  v_assignment_count integer;
  v_digest text;
  v_lifecycle text;
  v_authority text;
begin
  select count(*)::integer
    into v_product_count
  from public.products p
  where p.id = 'da5df70c-8cdd-4eb2-93b6-ede46c2f171d'::uuid
    and p.category is null;

  if v_product_count <> 1 then
    raise exception 'G4_F1_FATION_PRODUCT_PRESTATE_DRIFT';
  end if;

  select count(*)::integer
    into v_assignment_count
  from public.product_catalog_taxonomy_assignments a
  where a.product_id = 'da5df70c-8cdd-4eb2-93b6-ede46c2f171d'::uuid
    and a.taxonomy_version = 'catalog-taxonomy-v1'
    and a.entity_kind_term_id = 'catalog-taxonomy-v1:entity_kind:cosmetic'
    and a.domain_term_id = 'catalog-taxonomy-v1:domain:skincare'
    and a.recommendation_family_term_id =
      'catalog-taxonomy-v1:recommendation_family:treatment'
    and a.category_term_id = 'catalog-taxonomy-v1:category:treatment'
    and a.assignment_state = 'shadow'
    and a.assignment_method = 'source_classification'
    and a.legacy_projection_key is null
    and a.source_snapshot ->> 'candidate_id' =
      '6a9627b6-a5da-458f-84f7-3a40f91453be'
    and a.source_snapshot ->> 'source_rule_key' =
      'catalog-taxonomy-v1:source:hwahae:treatment';

  if v_assignment_count <> 1 then
    raise exception 'G4_F1_FATION_TAXONOMY_PRESTATE_DRIFT';
  end if;

  select
    public.admin_product_review_sha256_json(
      jsonb_build_object(
        'product_id', a.product_id,
        'taxonomy_version', a.taxonomy_version,
        'assignment_state', a.assignment_state,
        'assignment_method', a.assignment_method,
        'category_term_id', a.category_term_id,
        'recommendation_family_term_id', a.recommendation_family_term_id,
        'legacy_projection_key', a.legacy_projection_key,
        'source_snapshot', a.source_snapshot
      )
    )
    into v_digest
  from public.product_catalog_taxonomy_assignments a
  where a.product_id = 'da5df70c-8cdd-4eb2-93b6-ede46c2f171d'::uuid
    and a.taxonomy_version = 'catalog-taxonomy-v1';

  if v_digest <> 'eaed6cb9dd58b0f1e08bc5b35da817a72887b81ee497e0d144fcb5018b108d39' then
    raise exception 'G4_F1_FATION_ASSIGNMENT_DIGEST_DRIFT';
  end if;

  select v.lifecycle_state, v.authority_mode
    into v_lifecycle, v_authority
  from public.catalog_taxonomy_versions v
  where v.version = 'catalog-taxonomy-v1';

  if v_lifecycle is distinct from 'shadow'
     or v_authority is distinct from 'shadow_only' then
    raise exception 'G4_F1_TAXONOMY_GLOBAL_AUTHORITY_DRIFT';
  end if;
end
$$;

create table public.recommendation_category_authority_reviews (
  review_id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  taxonomy_version text not null,
  entity_kind_term_id text not null,
  domain_term_id text not null,
  recommendation_family_term_id text not null,
  category_term_id text not null,
  assignment_state_snapshot text not null,
  assignment_method_snapshot text not null,
  legacy_projection_key_snapshot text,
  source_snapshot jsonb not null,
  assignment_snapshot_digest text not null,
  candidate_id uuid not null
    references public.product_candidates(id) on delete restrict,
  source_rule_key text not null,
  review_state text not null,
  review_policy_version text not null,
  request_id text not null unique,
  supersedes_review_id uuid
    references public.recommendation_category_authority_reviews(review_id)
    on delete restrict,
  payload_digest text not null,
  is_current boolean not null default true,
  reviewed_by uuid not null references auth.users(id) on delete restrict,
  reviewed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint recommendation_category_authority_taxonomy_version_check
    check (taxonomy_version = 'catalog-taxonomy-v1'),
  constraint recommendation_category_authority_assignment_state_check
    check (assignment_state_snapshot = 'shadow'),
  constraint recommendation_category_authority_assignment_method_check
    check (assignment_method_snapshot = 'source_classification'),
  constraint recommendation_category_authority_source_snapshot_check
    check (
      jsonb_typeof(source_snapshot) = 'object'
      and octet_length(source_snapshot::text) <= 16384
    ),
  constraint recommendation_category_authority_assignment_digest_check
    check (assignment_snapshot_digest ~ '^[0-9a-f]{64}$'),
  constraint recommendation_category_authority_review_state_check
    check (review_state in ('established','revoked')),
  constraint recommendation_category_authority_review_policy_check
    check (
      review_policy_version =
        'recommendation-category-authority-review-policy-v1'
    ),
  constraint recommendation_category_authority_request_id_check
    check (char_length(btrim(request_id)) between 8 and 120),
  constraint recommendation_category_authority_payload_digest_check
    check (payload_digest ~ '^[0-9a-f]{64}$')
);

create unique index
  recommendation_category_authority_current_product_uidx
  on public.recommendation_category_authority_reviews(product_id)
  where is_current;

create index
  recommendation_category_authority_state_idx
  on public.recommendation_category_authority_reviews(
    review_state,
    reviewed_at desc
  );

create index
  recommendation_category_authority_product_idx
  on public.recommendation_category_authority_reviews(product_id);

create index
  recommendation_category_authority_candidate_idx
  on public.recommendation_category_authority_reviews(candidate_id);

create index
  recommendation_category_authority_supersedes_idx
  on public.recommendation_category_authority_reviews(supersedes_review_id);

create index
  recommendation_category_authority_reviewer_idx
  on public.recommendation_category_authority_reviews(reviewed_by);

alter table public.recommendation_category_authority_reviews
  enable row level security;

revoke all privileges on public.recommendation_category_authority_reviews
  from public, anon, authenticated, service_role,
       recommendation_admission_runtime,
       recommendation_admission_reader_owner;

grant select (
  review_id,
  product_id,
  taxonomy_version,
  entity_kind_term_id,
  domain_term_id,
  recommendation_family_term_id,
  category_term_id,
  assignment_state_snapshot,
  assignment_method_snapshot,
  legacy_projection_key_snapshot,
  source_snapshot,
  assignment_snapshot_digest,
  candidate_id,
  source_rule_key,
  review_state,
  review_policy_version,
  is_current
) on public.recommendation_category_authority_reviews
  to recommendation_admission_reader_owner;

drop policy if exists
  g4_f1_admission_reader_category_review_select_v1
  on public.recommendation_category_authority_reviews;
create policy g4_f1_admission_reader_category_review_select_v1
  on public.recommendation_category_authority_reviews
  for select
  to recommendation_admission_reader_owner
  using (
    product_id = 'da5df70c-8cdd-4eb2-93b6-ede46c2f171d'::uuid
  );

-- Preserve D5C semantics while extending the exact bounded reader set
-- from three sunscreen canaries to those same three IDs plus FATION.
-- Keep one permissive SELECT policy for this role/action.
revoke all privileges on public.product_catalog_taxonomy_assignments
  from recommendation_admission_runtime;

grant select (
  assignment_method,
  legacy_projection_key,
  source_snapshot
) on public.product_catalog_taxonomy_assignments
  to recommendation_admission_reader_owner;

drop policy if exists
  data_ai29c_d5c_admission_reader_taxonomy_select_v1
  on public.product_catalog_taxonomy_assignments;
create policy data_ai29c_d5c_admission_reader_taxonomy_select_v1
  on public.product_catalog_taxonomy_assignments
  for select
  to recommendation_admission_reader_owner
  using (
    product_id in (
      'a6994fcd-302f-4e63-acbe-91a3f17a5a65'::uuid,
      'b90bf992-07ae-4f49-a3a4-d90ea6d4a858'::uuid,
      '7fc45e7c-38aa-41a1-b1a1-c0e09fcd8c17'::uuid,
      'da5df70c-8cdd-4eb2-93b6-ede46c2f171d'::uuid
    )
  );

revoke all privileges on public.catalog_taxonomy_versions
  from recommendation_admission_runtime;

grant select (
  version,
  lifecycle_state,
  authority_mode
) on public.catalog_taxonomy_versions
  to recommendation_admission_reader_owner;

drop policy if exists
  g4_f1_admission_reader_taxonomy_version_select_v1
  on public.catalog_taxonomy_versions;
create policy g4_f1_admission_reader_taxonomy_version_select_v1
  on public.catalog_taxonomy_versions
  for select
  to recommendation_admission_reader_owner
  using (version = 'catalog-taxonomy-v1');

create or replace function public.admin_register_recommendation_category_authority_review_v1(
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
  v_expected_category_term_id text;
  v_expected_assignment_digest text;
  v_review_state text;
  v_supersedes uuid;
  v_payload_digest text;
  v_assignment public.product_catalog_taxonomy_assignments%rowtype;
  v_current public.recommendation_category_authority_reviews%rowtype;
  v_existing public.recommendation_category_authority_reviews%rowtype;
  v_current_found boolean := false;
  v_review_id uuid;
  v_audit_id uuid;
  v_assignment_digest text;
  v_taxonomy_lifecycle text;
  v_taxonomy_authority text;
  v_category_value text;
  v_allowed_keys text[] := array[
    'product_id',
    'expected_category_term_id',
    'expected_assignment_snapshot_digest',
    'review_state',
    'supersedes_review_id'
  ];
  v_target_product constant uuid :=
    'da5df70c-8cdd-4eb2-93b6-ede46c2f171d'::uuid;
  v_target_candidate constant uuid :=
    '6a9627b6-a5da-458f-84f7-3a40f91453be'::uuid;
  v_target_category constant text :=
    'catalog-taxonomy-v1:category:treatment';
  v_target_family constant text :=
    'catalog-taxonomy-v1:recommendation_family:treatment';
  v_target_source_rule constant text :=
    'catalog-taxonomy-v1:source:hwahae:treatment';
begin
  v_actor_role := public.admin_require_product_review_actor(
    p_actor_user_id,
    'admin.products.review'
  );

  if char_length(v_request_id) not between 8 and 120
     or p_payload is null
     or jsonb_typeof(p_payload) <> 'object'
     or octet_length(p_payload::text) > 16384
     or not (p_payload ?& v_allowed_keys)
     or exists (
       select 1
       from jsonb_object_keys(p_payload) as k(key)
       where not (k.key = any(v_allowed_keys))
     )
  then
    raise exception 'recommendation_category_authority_payload_invalid'
      using errcode = '22023';
  end if;

  begin
    v_product_id := (p_payload ->> 'product_id')::uuid;
    v_supersedes :=
      nullif(p_payload ->> 'supersedes_review_id', '')::uuid;
  exception when invalid_text_representation then
    raise exception 'recommendation_category_authority_identity_invalid'
      using errcode = '22023';
  end;

  v_expected_category_term_id :=
    btrim(coalesce(p_payload ->> 'expected_category_term_id', ''));
  v_expected_assignment_digest :=
    lower(btrim(coalesce(
      p_payload ->> 'expected_assignment_snapshot_digest',
      ''
    )));
  v_review_state :=
    btrim(coalesce(p_payload ->> 'review_state', ''));

  if v_product_id <> v_target_product then
    raise exception 'recommendation_category_authority_product_not_allowed'
      using errcode = '42501';
  end if;

  if v_review_state not in ('established','revoked')
     or v_expected_category_term_id = ''
     or v_expected_assignment_digest !~ '^[0-9a-f]{64}$'
  then
    raise exception 'recommendation_category_authority_fields_invalid'
      using errcode = '22023';
  end if;

  v_payload_digest := public.admin_product_review_sha256_json(
    jsonb_build_object(
      'product_id', v_product_id,
      'expected_category_term_id', v_expected_category_term_id,
      'expected_assignment_snapshot_digest',
        v_expected_assignment_digest,
      'review_state', v_review_state,
      'supersedes_review_id', v_supersedes,
      'review_policy_version',
        'recommendation-category-authority-review-policy-v1'
    )
  );

  select *
    into v_existing
  from public.recommendation_category_authority_reviews r
  where r.request_id = v_request_id;

  if found then
    if v_existing.reviewed_by <> p_actor_user_id
       or v_existing.payload_digest <> v_payload_digest then
      raise exception 'recommendation_category_authority_request_conflict'
        using errcode = '23505';
    end if;

    return jsonb_build_object(
      'status', 'reviewed',
      'review_id', v_existing.review_id,
      'product_id', v_existing.product_id,
      'review_state', v_existing.review_state,
      'category_term_id', v_existing.category_term_id,
      'assignment_snapshot_digest',
        v_existing.assignment_snapshot_digest,
      'is_current', v_existing.is_current,
      'inserted', false,
      'idempotent', true,
      'product_row_mutated', false,
      'taxonomy_assignment_mutated', false,
      'recommendation_admission_mutated', false,
      'production_cutover_authorized', false
    );
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'recommendation-category-authority:' || v_product_id::text,
      0
    )
  );

  select *
    into v_current
  from public.recommendation_category_authority_reviews r
  where r.product_id = v_product_id
    and r.is_current
  for update;

  v_current_found := found;

  if v_review_state = 'established' then
    if v_current_found then
      if v_supersedes is distinct from v_current.review_id then
        raise exception
          'recommendation_category_authority_supersedes_current_required'
          using errcode = '40001';
      end if;
    elsif v_supersedes is not null then
      raise exception
        'recommendation_category_authority_supersedes_unexpected'
        using errcode = '40001';
    end if;

    if not exists (
      select 1
      from public.products p
      where p.id = v_product_id
        and p.category is null
    ) then
      raise exception 'recommendation_category_authority_legacy_category_present'
        using errcode = '23514';
    end if;

    select *
      into v_assignment
    from public.product_catalog_taxonomy_assignments a
    where a.product_id = v_product_id
      and a.taxonomy_version = 'catalog-taxonomy-v1';

    if not found then
      raise exception
        'recommendation_category_authority_assignment_missing'
        using errcode = '23514';
    end if;

    if v_assignment.entity_kind_term_id <>
         'catalog-taxonomy-v1:entity_kind:cosmetic'
       or v_assignment.domain_term_id <>
         'catalog-taxonomy-v1:domain:skincare'
       or v_assignment.recommendation_family_term_id <>
         v_target_family
       or v_assignment.category_term_id <> v_target_category
       or v_assignment.assignment_state <> 'shadow'
       or v_assignment.assignment_method <> 'source_classification'
       or v_assignment.legacy_projection_key is not null
       or v_assignment.source_snapshot ->> 'candidate_id' <>
         v_target_candidate::text
       or v_assignment.source_snapshot ->> 'source_rule_key' <>
         v_target_source_rule
    then
      raise exception
        'recommendation_category_authority_assignment_not_eligible'
        using errcode = '23514';
    end if;

    select v.lifecycle_state, v.authority_mode
      into v_taxonomy_lifecycle, v_taxonomy_authority
    from public.catalog_taxonomy_versions v
    where v.version = 'catalog-taxonomy-v1';

    if v_taxonomy_lifecycle is distinct from 'shadow'
       or v_taxonomy_authority is distinct from 'shadow_only' then
      raise exception
        'recommendation_category_authority_global_taxonomy_drift'
        using errcode = '23514';
    end if;

    v_assignment_digest := public.admin_product_review_sha256_json(
      jsonb_build_object(
        'product_id', v_assignment.product_id,
        'taxonomy_version', v_assignment.taxonomy_version,
        'assignment_state', v_assignment.assignment_state,
        'assignment_method', v_assignment.assignment_method,
        'category_term_id', v_assignment.category_term_id,
        'recommendation_family_term_id',
          v_assignment.recommendation_family_term_id,
        'legacy_projection_key', v_assignment.legacy_projection_key,
        'source_snapshot', v_assignment.source_snapshot
      )
    );

    if v_expected_category_term_id <> v_assignment.category_term_id
       or v_expected_assignment_digest <> v_assignment_digest then
      raise exception
        'recommendation_category_authority_optimistic_lock_mismatch'
        using errcode = '40001';
    end if;

    v_category_value := 'treatment';

  else
    if not v_current_found
       or v_current.review_state <> 'established'
       or v_supersedes is distinct from v_current.review_id then
      raise exception
        'recommendation_category_authority_revoke_current_required'
        using errcode = '40001';
    end if;

    if v_expected_category_term_id <> v_current.category_term_id
       or v_expected_assignment_digest <>
         v_current.assignment_snapshot_digest then
      raise exception
        'recommendation_category_authority_revoke_lock_mismatch'
        using errcode = '40001';
    end if;

    v_assignment.product_id := v_current.product_id;
    v_assignment.taxonomy_version := v_current.taxonomy_version;
    v_assignment.entity_kind_term_id := v_current.entity_kind_term_id;
    v_assignment.domain_term_id := v_current.domain_term_id;
    v_assignment.recommendation_family_term_id :=
      v_current.recommendation_family_term_id;
    v_assignment.category_term_id := v_current.category_term_id;
    v_assignment.assignment_state := v_current.assignment_state_snapshot;
    v_assignment.assignment_method := v_current.assignment_method_snapshot;
    v_assignment.legacy_projection_key :=
      v_current.legacy_projection_key_snapshot;
    v_assignment.source_snapshot := v_current.source_snapshot;
    v_assignment_digest := v_current.assignment_snapshot_digest;
    v_category_value := 'treatment';
  end if;

  if v_current_found then
    update public.recommendation_category_authority_reviews
       set is_current = false
     where review_id = v_current.review_id;
  end if;

  insert into public.recommendation_category_authority_reviews (
    product_id,
    taxonomy_version,
    entity_kind_term_id,
    domain_term_id,
    recommendation_family_term_id,
    category_term_id,
    assignment_state_snapshot,
    assignment_method_snapshot,
    legacy_projection_key_snapshot,
    source_snapshot,
    assignment_snapshot_digest,
    candidate_id,
    source_rule_key,
    review_state,
    review_policy_version,
    request_id,
    supersedes_review_id,
    payload_digest,
    is_current,
    reviewed_by,
    reviewed_at
  )
  values (
    v_product_id,
    v_assignment.taxonomy_version,
    v_assignment.entity_kind_term_id,
    v_assignment.domain_term_id,
    v_assignment.recommendation_family_term_id,
    v_assignment.category_term_id,
    v_assignment.assignment_state,
    v_assignment.assignment_method,
    v_assignment.legacy_projection_key,
    v_assignment.source_snapshot,
    v_assignment_digest,
    v_target_candidate,
    v_target_source_rule,
    v_review_state,
    'recommendation-category-authority-review-policy-v1',
    v_request_id,
    v_supersedes,
    v_payload_digest,
    true,
    p_actor_user_id,
    now()
  )
  returning review_id into v_review_id;

  v_audit_id := public.record_admin_audit_event(
    p_actor_user_id,
    'admin.products.review',
    'admin.recommendation_category_authority_reviewed',
    'recommendation_category_authority_review',
    v_review_id::text,
    null,
    jsonb_build_object(
      'product_id', v_product_id,
      'review_state', v_review_state,
      'category', v_category_value,
      'category_term_id', v_assignment.category_term_id,
      'assignment_snapshot_digest', v_assignment_digest,
      'supersedes_review_id', v_supersedes
    ),
    'review Recommendation category authority without mutating Product, taxonomy assignment, or Recommendation admission',
    v_request_id,
    jsonb_build_object(
      'contract_version', 'recommendation-category-authority-read-v1',
      'review_policy_version',
        'recommendation-category-authority-review-policy-v1',
      'actor_role', v_actor_role,
      'product_row_mutated', false,
      'taxonomy_assignment_mutated', false,
      'recommendation_admission_mutated', false,
      'production_cutover_authorized', false
    )
  );

  return jsonb_build_object(
    'status', 'reviewed',
    'review_id', v_review_id,
    'audit_id', v_audit_id,
    'product_id', v_product_id,
    'review_state', v_review_state,
    'category', v_category_value,
    'category_term_id', v_assignment.category_term_id,
    'assignment_snapshot_digest', v_assignment_digest,
    'inserted', true,
    'idempotent', false,
    'product_row_mutated', false,
    'taxonomy_assignment_mutated', false,
    'recommendation_admission_mutated', false,
    'production_cutover_authorized', false
  );
end;
$$;

comment on table public.recommendation_category_authority_reviews is
  'G4-F1 reviewed Product-level Recommendation category authority ledger. Initial writer/reader scope is FATION only; no Product, taxonomy assignment, Product Fact, or Recommendation admission mutation.';

comment on function public.admin_register_recommendation_category_authority_review_v1(uuid,text,jsonb) is
  'G4-F1 Admin-only reviewed category-authority writer. Recomputes exact FATION taxonomy assignment binding for establishment; revocation remains possible after assignment drift.';

revoke all on function
  public.admin_register_recommendation_category_authority_review_v1(
    uuid,text,jsonb
  )
  from public, anon, authenticated,
       recommendation_admission_runtime,
       recommendation_admission_reader_owner,
       service_role;
grant execute on function
  public.admin_register_recommendation_category_authority_review_v1(
    uuid,text,jsonb
  )
  to service_role;

create or replace function public.read_recommendation_category_authority_v1(
  p_product_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_product_count integer;
  v_review_count integer;
  v_assignment_count integer;
  v_category text;
  v_review record;
  v_assignment record;
  v_taxonomy_lifecycle text;
  v_taxonomy_authority text;
begin
  if p_product_id is null then
    return jsonb_build_object(
      'read_contract_version',
        'recommendation-category-authority-read-v1',
      'status', 'NO_AUTHORITY',
      'reason', 'PRODUCT_ID_REQUIRED'
    );
  end if;

  if p_product_id <>
       'da5df70c-8cdd-4eb2-93b6-ede46c2f171d'::uuid then
    return jsonb_build_object(
      'read_contract_version',
        'recommendation-category-authority-read-v1',
      'status', 'NO_AUTHORITY',
      'reason', 'PRODUCT_NOT_G4_F1_TARGET'
    );
  end if;

  select count(p.id)::integer
    into v_product_count
  from public.products p
  where p.id = p_product_id;

  if v_product_count <> 1 then
    return jsonb_build_object(
      'read_contract_version',
        'recommendation-category-authority-read-v1',
      'status', 'NO_AUTHORITY',
      'reason', 'CANONICAL_PRODUCT_NOT_FOUND'
    );
  end if;

  if exists (
    select 1
    from public.products p
    where p.id = p_product_id
      and p.category is not null
  ) then
    return jsonb_build_object(
      'read_contract_version',
        'recommendation-category-authority-read-v1',
      'status', 'NO_AUTHORITY',
      'reason', 'LEGACY_CATEGORY_PRESENT'
    );
  end if;

  select count(r.review_id)::integer
    into v_review_count
  from public.recommendation_category_authority_reviews r
  where r.product_id = p_product_id
    and r.is_current;

  if v_review_count <> 1 then
    return jsonb_build_object(
      'read_contract_version',
        'recommendation-category-authority-read-v1',
      'status', 'NO_AUTHORITY',
      'reason', case
        when v_review_count = 0
          then 'CURRENT_CATEGORY_REVIEW_MISSING'
        else 'CURRENT_CATEGORY_REVIEW_AMBIGUOUS'
      end
    );
  end if;

  select
    r.review_id,
    r.product_id,
    r.taxonomy_version,
    r.entity_kind_term_id,
    r.domain_term_id,
    r.recommendation_family_term_id,
    r.category_term_id,
    r.assignment_state_snapshot,
    r.assignment_method_snapshot,
    r.legacy_projection_key_snapshot,
    r.source_snapshot,
    r.assignment_snapshot_digest,
    r.candidate_id,
    r.source_rule_key,
    r.review_state,
    r.review_policy_version,
    r.is_current
    into v_review
  from public.recommendation_category_authority_reviews r
  where r.product_id = p_product_id
    and r.is_current;

  if v_review.review_state <> 'established' then
    return jsonb_build_object(
      'read_contract_version',
        'recommendation-category-authority-read-v1',
      'status', 'NO_AUTHORITY',
      'reason', 'CURRENT_CATEGORY_REVIEW_NOT_ESTABLISHED'
    );
  end if;

  select count(a.product_id)::integer
    into v_assignment_count
  from public.product_catalog_taxonomy_assignments a
  where a.product_id = p_product_id
    and a.taxonomy_version = v_review.taxonomy_version;

  if v_assignment_count <> 1 then
    return jsonb_build_object(
      'read_contract_version',
        'recommendation-category-authority-read-v1',
      'status', 'NO_AUTHORITY',
      'reason', case
        when v_assignment_count = 0
          then 'CANONICAL_TAXONOMY_ASSIGNMENT_MISSING'
        else 'CANONICAL_TAXONOMY_ASSIGNMENT_AMBIGUOUS'
      end
    );
  end if;

  select
    a.product_id,
    a.taxonomy_version,
    a.entity_kind_term_id,
    a.domain_term_id,
    a.recommendation_family_term_id,
    a.category_term_id,
    a.legacy_projection_key,
    a.assignment_state,
    a.assignment_method,
    a.source_snapshot
    into v_assignment
  from public.product_catalog_taxonomy_assignments a
  where a.product_id = p_product_id
    and a.taxonomy_version = v_review.taxonomy_version;

  if v_assignment.assignment_state <> 'shadow'
     or v_assignment.assignment_method <> 'source_classification'
     or v_assignment.legacy_projection_key is not null then
    return jsonb_build_object(
      'read_contract_version',
        'recommendation-category-authority-read-v1',
      'status', 'NO_AUTHORITY',
      'reason', 'ASSIGNMENT_STATE_NOT_ELIGIBLE'
    );
  end if;

  select v.lifecycle_state, v.authority_mode
    into v_taxonomy_lifecycle, v_taxonomy_authority
  from public.catalog_taxonomy_versions v
  where v.version = v_assignment.taxonomy_version;

  if v_taxonomy_lifecycle is distinct from 'shadow'
     or v_taxonomy_authority is distinct from 'shadow_only' then
    return jsonb_build_object(
      'read_contract_version',
        'recommendation-category-authority-read-v1',
      'status', 'NO_AUTHORITY',
      'reason', 'TAXONOMY_GLOBAL_AUTHORITY_DRIFT'
    );
  end if;

  if v_assignment.category_term_id =
       'catalog-taxonomy-v1:category:treatment' then
    v_category := 'treatment';
  elsif v_assignment.category_term_id =
       'catalog-taxonomy-v1:category:toner_essence' then
    v_category := 'toner_essence';
  elsif v_assignment.category_term_id =
       'catalog-taxonomy-v1:category:toner_pad' then
    v_category := 'toner_pad';
  else
    return jsonb_build_object(
      'read_contract_version',
        'recommendation-category-authority-read-v1',
      'status', 'NO_AUTHORITY',
      'reason', 'CATEGORY_UNSUPPORTED'
    );
  end if;

  if v_assignment.entity_kind_term_id is distinct from
       v_review.entity_kind_term_id
     or v_assignment.domain_term_id is distinct from
       v_review.domain_term_id
     or v_assignment.recommendation_family_term_id is distinct from
       v_review.recommendation_family_term_id
     or v_assignment.category_term_id is distinct from
       v_review.category_term_id
     or v_assignment.assignment_state is distinct from
       v_review.assignment_state_snapshot
     or v_assignment.assignment_method is distinct from
       v_review.assignment_method_snapshot
     or v_assignment.legacy_projection_key is distinct from
       v_review.legacy_projection_key_snapshot
     or v_assignment.source_snapshot is distinct from
       v_review.source_snapshot then
    return jsonb_build_object(
      'read_contract_version',
        'recommendation-category-authority-read-v1',
      'status', 'NO_AUTHORITY',
      'reason', 'ASSIGNMENT_SNAPSHOT_DRIFT'
    );
  end if;

  if v_assignment.source_snapshot ->> 'candidate_id' is distinct from
       v_review.candidate_id::text then
    return jsonb_build_object(
      'read_contract_version',
        'recommendation-category-authority-read-v1',
      'status', 'NO_AUTHORITY',
      'reason', 'CANDIDATE_BINDING_DRIFT'
    );
  end if;

  if v_assignment.source_snapshot ->> 'source_rule_key' is distinct from
       v_review.source_rule_key then
    return jsonb_build_object(
      'read_contract_version',
        'recommendation-category-authority-read-v1',
      'status', 'NO_AUTHORITY',
      'reason', 'SOURCE_RULE_BINDING_DRIFT'
    );
  end if;

  return jsonb_build_object(
    'read_contract_version',
      'recommendation-category-authority-read-v1',
    'status', 'CATEGORY_AUTHORITY_RESOLVED',
    'authority', jsonb_build_object(
      'product_id', p_product_id,
      'category', v_category,
      'taxonomy_version', v_review.taxonomy_version,
      'entity_kind_term_id', v_review.entity_kind_term_id,
      'domain_term_id', v_review.domain_term_id,
      'recommendation_family_term_id',
        v_review.recommendation_family_term_id,
      'category_term_id', v_review.category_term_id,
      'assignment_snapshot_digest',
        v_review.assignment_snapshot_digest,
      'candidate_id', v_review.candidate_id,
      'source_rule_key', v_review.source_rule_key,
      'review_id', v_review.review_id,
      'review_policy_version', v_review.review_policy_version
    ),
    'recommendation_admission_mutated', false,
    'production_cutover_authorized', false
  );
end;
$$;

comment on function public.read_recommendation_category_authority_v1(uuid) is
  'G4-F1 protected Product-level category-authority reader. Initial scope is FATION only. No Product Fact Subject dependency, reviewer metadata, source body, admission decision, or writes.';

revoke all on function
  public.read_recommendation_category_authority_v1(uuid)
  from public, anon, authenticated, service_role;

grant execute on function
  public.read_recommendation_category_authority_v1(uuid)
  to recommendation_admission_runtime;

-- Transfer only the reader to the existing narrow NOLOGIN reader owner.
-- Production already grants postgres membership in this owner role. Preserve it.
do $g4_f1_membership$
begin
  if not pg_has_role(
    'postgres',
    'recommendation_admission_reader_owner',
    'MEMBER'
  ) then
    raise exception 'G4_F1_POSTGRES_READER_OWNER_MEMBERSHIP_REQUIRED';
  end if;
end
$g4_f1_membership$;

grant create on schema public to recommendation_admission_reader_owner;
alter function public.read_recommendation_category_authority_v1(uuid)
  owner to recommendation_admission_reader_owner;
revoke create on schema public from recommendation_admission_reader_owner;

do $$
begin
  if has_schema_privilege(
    'recommendation_admission_reader_owner',
    'public',
    'CREATE'
  ) then
    raise exception 'G4_F1_READER_OWNER_SCHEMA_CREATE_FORBIDDEN';
  end if;

  if not pg_has_role(
    'postgres',
    'recommendation_admission_reader_owner',
    'MEMBER'
  ) then
    raise exception 'G4_F1_POSTGRES_READER_OWNER_MEMBERSHIP_MUST_PERSIST';
  end if;

  if has_table_privilege(
       'recommendation_admission_runtime',
       'public.recommendation_category_authority_reviews',
       'SELECT'
     )
     or has_table_privilege(
       'recommendation_admission_runtime',
       'public.product_catalog_taxonomy_assignments',
       'SELECT'
     )
     or has_table_privilege(
       'recommendation_admission_runtime',
       'public.catalog_taxonomy_versions',
       'SELECT'
     ) then
    raise exception 'G4_F1_RUNTIME_RAW_SELECT_FORBIDDEN';
  end if;

  if has_table_privilege(
    'service_role',
    'public.recommendation_category_authority_reviews',
    'SELECT'
  ) or has_table_privilege(
    'service_role',
    'public.recommendation_category_authority_reviews',
    'INSERT'
  ) or has_table_privilege(
    'service_role',
    'public.recommendation_category_authority_reviews',
    'UPDATE'
  ) or has_table_privilege(
    'service_role',
    'public.recommendation_category_authority_reviews',
    'DELETE'
  ) then
    raise exception 'G4_F1_SERVICE_ROLE_DIRECT_LEDGER_ACCESS_FORBIDDEN';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.admin_register_recommendation_category_authority_review_v1(uuid,text,jsonb)',
    'EXECUTE'
  ) then
    raise exception 'G4_F1_SERVICE_ROLE_WRITER_EXECUTE_REQUIRED';
  end if;

  if has_function_privilege(
    'recommendation_admission_runtime',
    'public.admin_register_recommendation_category_authority_review_v1(uuid,text,jsonb)',
    'EXECUTE'
  ) then
    raise exception 'G4_F1_RUNTIME_WRITER_EXECUTE_FORBIDDEN';
  end if;

  if not has_function_privilege(
    'recommendation_admission_runtime',
    'public.read_recommendation_category_authority_v1(uuid)',
    'EXECUTE'
  ) then
    raise exception 'G4_F1_RUNTIME_READER_EXECUTE_REQUIRED';
  end if;

  if has_function_privilege(
    'service_role',
    'public.read_recommendation_category_authority_v1(uuid)',
    'EXECUTE'
  ) then
    raise exception 'G4_F1_SERVICE_ROLE_READER_EXECUTE_FORBIDDEN';
  end if;

  if not exists (
    select 1
    from pg_policies p
    where p.schemaname = 'public'
      and p.tablename = 'product_catalog_taxonomy_assignments'
      and p.policyname =
        'data_ai29c_d5c_admission_reader_taxonomy_select_v1'
      and p.roles = array['recommendation_admission_reader_owner']::name[]
      and p.cmd = 'SELECT'
      and p.qual like '%a6994fcd-302f-4e63-acbe-91a3f17a5a65%'
      and p.qual like '%b90bf992-07ae-4f49-a3a4-d90ea6d4a858%'
      and p.qual like '%7fc45e7c-38aa-41a1-b1a1-c0e09fcd8c17%'
      and p.qual like '%da5df70c-8cdd-4eb2-93b6-ede46c2f171d%'
  ) then
    raise exception 'G4_F1_BOUNDED_FOUR_PRODUCT_TAXONOMY_POLICY_INVALID';
  end if;

  if (
    select count(*)::integer
    from pg_policies p
    where p.schemaname = 'public'
      and p.tablename = 'product_catalog_taxonomy_assignments'
      and p.roles = array['recommendation_admission_reader_owner']::name[]
      and p.cmd = 'SELECT'
  ) <> 1 then
    raise exception 'G4_F1_TAXONOMY_READER_POLICY_CARDINALITY_INVALID';
  end if;

  if (select count(*)::integer
      from public.recommendation_category_authority_reviews) <> 0 then
    raise exception 'G4_F1_MIGRATION_MUST_NOT_CREATE_REVIEW_ROWS';
  end if;

  if exists (
    select 1
    from public.products p
    where p.id = 'da5df70c-8cdd-4eb2-93b6-ede46c2f171d'::uuid
      and p.category is not null
  ) then
    raise exception 'G4_F1_PRODUCTS_CATEGORY_MUTATION_FORBIDDEN';
  end if;

  if exists (
    select 1
    from public.catalog_taxonomy_versions v
    where v.version = 'catalog-taxonomy-v1'
      and (
        v.lifecycle_state <> 'shadow'
        or v.authority_mode <> 'shadow_only'
      )
  ) then
    raise exception 'G4_F1_GLOBAL_TAXONOMY_ACTIVATION_FORBIDDEN';
  end if;
end
$$;

commit;
