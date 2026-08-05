begin;

-- Cleanser Metadata Admin Contract v2.
-- No existing products are backfilled and no recommendation policy is activated.

do $$
begin
  if to_regclass('public.products') is null
    or to_regclass('public.product_candidates') is null
    or to_regclass('public.candidate_promotion_reviews') is null
    or to_regprocedure('public.admin_confirm_product_review_import_batch(uuid,text,jsonb,text)') is null
    or to_regprocedure('public.admin_require_product_review_actor(uuid,text)') is null
    or to_regprocedure('public.record_admin_audit_event(uuid,text,text,text,text,jsonb,jsonb,text,text,jsonb)') is null
    or to_regprocedure('public.admin_product_review_sha256_json(jsonb)') is null
  then
    raise exception 'admin_v2_storage_prerequisite_missing';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'products'
      and column_name = 'cleansing_profile'
  ) then
    raise exception 'admin_v2_products_cleansing_profile_missing';
  end if;
end $$;

create table public.product_metadata_field_reviews (
  product_id uuid not null references public.products(id) on delete cascade,
  field_name text not null,
  candidate_id uuid references public.product_candidates(id) on delete restrict,
  review_state text not null,
  field_value text,
  confidence text not null,
  evidence_refs jsonb not null,
  evidence_records jsonb not null,
  evidence_digest text,
  review_contract_version text not null,
  metadata_schema_version text not null,
  review_policy_version text not null,
  evidence_schema_version text not null,
  export_batch_id uuid not null,
  request_id text not null,
  canonical_payload_digest text not null,
  reviewed_by uuid not null references auth.users(id) on delete restrict,
  reviewed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (product_id, field_name),
  constraint product_metadata_field_reviews_field_check
    check (field_name = 'cleansing_profile'),
  constraint product_metadata_field_reviews_state_check
    check (review_state in (
      'reviewed_valid', 'reviewed_unknown', 'reviewed_conflict', 'not_applicable'
    )),
  constraint product_metadata_field_reviews_value_check
    check (field_value is null or field_value in ('low_ph', 'balanced', 'deep_clean')),
  constraint product_metadata_field_reviews_confidence_check
    check (confidence in ('high', 'medium', 'low', 'unknown')),
  constraint product_metadata_field_reviews_evidence_refs_array
    check (jsonb_typeof(evidence_refs) = 'array'),
  constraint product_metadata_field_reviews_evidence_records_array
    check (jsonb_typeof(evidence_records) = 'array'),
  constraint product_metadata_field_reviews_evidence_digest_check
    check (evidence_digest is null or evidence_digest ~ '^[0-9a-f]{64}$'),
  constraint product_metadata_field_reviews_contract_check
    check (review_contract_version = 'admin-product-review-v2'),
  constraint product_metadata_field_reviews_schema_check
    check (metadata_schema_version = 'cleanser-metadata-v1'),
  constraint product_metadata_field_reviews_policy_check
    check (review_policy_version = 'cleanser-metadata-review-policy-v1'),
  constraint product_metadata_field_reviews_evidence_schema_check
    check (evidence_schema_version = 'product-review-field-evidence-v1'),
  constraint product_metadata_field_reviews_payload_digest_check
    check (canonical_payload_digest ~ '^[0-9a-f]{64}$'),
  constraint product_metadata_field_reviews_request_check
    check (char_length(btrim(request_id)) between 8 and 120),
  constraint product_metadata_field_reviews_state_value_check
    check (
      (review_state = 'reviewed_valid'
        and field_value is not null
        and confidence in ('high', 'medium', 'low')
        and jsonb_array_length(evidence_refs) > 0
        and jsonb_array_length(evidence_records) > 0
        and evidence_digest is not null)
      or
      (review_state in ('reviewed_unknown', 'reviewed_conflict')
        and field_value is null
        and confidence = 'unknown'
        and jsonb_array_length(evidence_refs) > 0
        and jsonb_array_length(evidence_records) > 0
        and evidence_digest is not null)
      or
      (review_state = 'not_applicable'
        and field_value is null
        and confidence = 'unknown'
        and jsonb_array_length(evidence_refs) = 0
        and jsonb_array_length(evidence_records) = 0
        and evidence_digest is null)
    )
);

create index product_metadata_field_reviews_candidate_idx
  on public.product_metadata_field_reviews (candidate_id, updated_at desc);
create index product_metadata_field_reviews_state_idx
  on public.product_metadata_field_reviews (field_name, review_state, updated_at desc);

alter table public.product_metadata_field_reviews enable row level security;
revoke all on table public.product_metadata_field_reviews
  from public, anon, authenticated, service_role;
grant select on table public.product_metadata_field_reviews to service_role;

create table public.admin_product_review_import_v2_confirmations (
  request_id text primary key,
  export_batch_id uuid not null unique,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  payload_hash text not null,
  reviewed_file_sha256 text not null,
  canonical_payload_digest text not null,
  result jsonb not null,
  confirmed_at timestamptz not null default now(),
  constraint admin_product_review_import_v2_request_check
    check (char_length(btrim(request_id)) between 8 and 120),
  constraint admin_product_review_import_v2_payload_hash_check
    check (payload_hash ~ '^[0-9a-f]{64}$'),
  constraint admin_product_review_import_v2_file_hash_check
    check (reviewed_file_sha256 ~ '^[0-9a-f]{64}$'),
  constraint admin_product_review_import_v2_canonical_hash_check
    check (canonical_payload_digest ~ '^[0-9a-f]{64}$'),
  constraint admin_product_review_import_v2_result_check
    check (jsonb_typeof(result) = 'object' and octet_length(result::text) <= 1048576)
);

alter table public.admin_product_review_import_v2_confirmations enable row level security;
revoke all on table public.admin_product_review_import_v2_confirmations
  from public, anon, authenticated, service_role;

create or replace view public.product_metadata_review_completeness_v1
with (security_invoker = true)
as
select
  product.id as product_id,
  review.field_name,
  (
    product.category::text = 'cleanser'
    and review.review_state = 'reviewed_valid'
    and review.field_value in ('low_ph', 'balanced', 'deep_clean')
    and review.evidence_digest ~ '^[0-9a-f]{64}$'
    and review.metadata_schema_version = 'cleanser-metadata-v1'
    and review.review_policy_version = 'cleanser-metadata-review-policy-v1'
    and review.evidence_schema_version = 'product-review-field-evidence-v1'
  ) as structured_metadata_review_complete,
  review.metadata_schema_version,
  review.review_policy_version,
  review.updated_at
from public.products as product
join public.product_metadata_field_reviews as review
  on review.product_id = product.id
 and review.field_name = 'cleansing_profile';

revoke all on table public.product_metadata_review_completeness_v1
  from public, anon, authenticated, service_role;
grant select on table public.product_metadata_review_completeness_v1 to service_role;

create or replace function public.admin_set_product_cleansing_profile_v2(
  p_product_id uuid,
  p_value text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_type text;
  v_row_count integer;
begin
  if p_product_id is null
    or (p_value is not null and p_value not in ('low_ph', 'balanced', 'deep_clean'))
  then
    raise exception 'review_v2_cleansing_profile_invalid' using errcode = '22023';
  end if;

  select format('%I.%I', namespace.nspname, type.typname)
  into v_type
  from pg_attribute as attribute
  join pg_class as relation on relation.oid = attribute.attrelid
  join pg_namespace as relation_namespace on relation_namespace.oid = relation.relnamespace
  join pg_type as type on type.oid = attribute.atttypid
  join pg_namespace as namespace on namespace.oid = type.typnamespace
  where relation_namespace.nspname = 'public'
    and relation.relname = 'products'
    and attribute.attname = 'cleansing_profile'
    and attribute.attnum > 0
    and not attribute.attisdropped;

  if v_type is null then
    raise exception 'admin_v2_products_cleansing_profile_missing';
  end if;

  execute format(
    'update public.products set cleansing_profile = case when $1 is null then null else $1::%s end, updated_at = now() where id = $2',
    v_type
  ) using p_value, p_product_id;
  get diagnostics v_row_count = row_count;

  if v_row_count <> 1 then
    raise exception 'review_import_existing_product_not_found' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.admin_get_product_review_import_v2_confirmation(
  p_actor_user_id uuid,
  p_request_id text,
  p_export_batch_id uuid,
  p_payload_hash text
)
returns jsonb
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_request_id text := btrim(coalesce(p_request_id, ''));
  v_payload_hash text := lower(btrim(coalesce(p_payload_hash, '')));
  v_existing public.admin_product_review_import_v2_confirmations%rowtype;
begin
  perform public.admin_require_product_review_actor(
    p_actor_user_id,
    'admin.products.review'
  );

  if char_length(v_request_id) not between 8 and 120
    or p_export_batch_id is null
    or v_payload_hash !~ '^[0-9a-f]{64}$'
  then
    raise exception 'review_v2_request_id_invalid' using errcode = '22023';
  end if;

  select * into v_existing
  from public.admin_product_review_import_v2_confirmations
  where request_id = v_request_id;

  if not found then
    return null;
  end if;

  if v_existing.actor_user_id <> p_actor_user_id
    or v_existing.export_batch_id <> p_export_batch_id
    or v_existing.payload_hash <> v_payload_hash
  then
    raise exception 'review_v2_request_id_conflict' using errcode = '23505';
  end if;

  return v_existing.result;
end;
$$;

revoke all on function public.admin_set_product_cleansing_profile_v2(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.admin_get_product_review_import_v2_confirmation(
  uuid, text, uuid, text
) from public, anon, authenticated;
grant execute on function public.admin_get_product_review_import_v2_confirmation(
  uuid, text, uuid, text
) to service_role;

comment on table public.product_metadata_field_reviews is
  'Versioned field-level review envelope for cleanser metadata. Reviewer identity is server-derived and not public.';
comment on view public.product_metadata_review_completeness_v1 is
  'Service-role-only metadata review completeness projection. It does not approve recommendation activation.';

commit;
