begin;

create table public.product_evidence_source_verification_profiles (
  profile_id uuid primary key default gen_random_uuid(),
  request_id text not null unique,
  source_id uuid not null references public.product_evidence_sources(source_id) on delete restrict,
  supersedes_profile_id uuid references public.product_evidence_source_verification_profiles(profile_id) on delete restrict,
  baseline_content_digest text not null,
  digest_basis text not null,
  adapter_key text not null,
  adapter_version text not null,
  comparability_state text not null,
  baseline_kind text not null,
  canonical_baseline jsonb not null default '{}'::jsonb,
  profile_metadata jsonb not null default '{}'::jsonb,
  profile_digest text not null,
  reviewed_by uuid not null,
  reviewed_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint source_verification_profiles_supersedes_unique unique (supersedes_profile_id),
  constraint source_verification_profiles_request_check
    check (char_length(btrim(request_id)) between 8 and 120),
  constraint source_verification_profiles_baseline_digest_check
    check (baseline_content_digest ~ '^[0-9a-f]{64}$'),
  constraint source_verification_profiles_digest_basis_check
    check (char_length(btrim(digest_basis)) between 1 and 160),
  constraint source_verification_profiles_adapter_key_check
    check (char_length(btrim(adapter_key)) between 1 and 120),
  constraint source_verification_profiles_adapter_version_check
    check (char_length(btrim(adapter_version)) between 1 and 80),
  constraint source_verification_profiles_comparability_check
    check (comparability_state in ('COMPARABLE', 'BASELINE_RECOVERY_REQUIRED', 'MANUAL_ONLY')),
  constraint source_verification_profiles_baseline_kind_check
    check (baseline_kind in ('historical_replay', 'fresh_recovery', 'legacy_unresolved', 'manual_only')),
  constraint source_verification_profiles_canonical_baseline_check
    check (
      jsonb_typeof(canonical_baseline) = 'object'
      and octet_length(canonical_baseline::text) <= 32768
    ),
  constraint source_verification_profiles_metadata_check
    check (
      jsonb_typeof(profile_metadata) = 'object'
      and octet_length(profile_metadata::text) <= 32768
    ),
  constraint source_verification_profiles_profile_digest_check
    check (profile_digest ~ '^[0-9a-f]{64}$')
);

create index source_verification_profiles_source_created_idx
  on public.product_evidence_source_verification_profiles (source_id, created_at desc, profile_id);

alter table public.product_evidence_source_verification_profiles enable row level security;

revoke all on table public.product_evidence_source_verification_profiles
  from public, anon, authenticated, service_role;
grant select on table public.product_evidence_source_verification_profiles to service_role;

create or replace function public.trust_phase8g_reject_profile_mutation_v1()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'product_evidence_source_verification_profile_immutable'
    using errcode = '55000';
end;
$$;

revoke all on function public.trust_phase8g_reject_profile_mutation_v1()
  from public, anon, authenticated, service_role;

create trigger product_evidence_source_verification_profiles_immutable
before update or delete on public.product_evidence_source_verification_profiles
for each row execute function public.trust_phase8g_reject_profile_mutation_v1();

create or replace function public.admin_register_product_evidence_source_verification_profile_v1(
  p_actor_user_id uuid,
  p_request_id text,
  p_source_id uuid,
  p_supersedes_profile_id uuid,
  p_baseline_content_digest text,
  p_digest_basis text,
  p_adapter_key text,
  p_adapter_version text,
  p_baseline_kind text,
  p_canonical_baseline jsonb,
  p_profile_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_role text;
  v_request_id text := btrim(coalesce(p_request_id, ''));
  v_source public.product_evidence_sources%rowtype;
  v_current_profile public.product_evidence_source_verification_profiles%rowtype;
  v_comparability_state text;
  v_payload jsonb;
  v_profile_digest text;
  v_profile_id uuid;
  v_existing public.product_evidence_source_verification_profiles%rowtype;
  v_reviewed_at timestamptz := now();
begin
  v_actor_role := public.admin_require_product_review_actor(
    p_actor_user_id,
    'admin.products.review'
  );

  if char_length(v_request_id) not between 8 and 120
     or p_source_id is null
     or p_baseline_content_digest is null
     or lower(btrim(p_baseline_content_digest)) !~ '^[0-9a-f]{64}$'
     or char_length(btrim(coalesce(p_digest_basis, ''))) not between 1 and 160
     or char_length(btrim(coalesce(p_adapter_key, ''))) not between 1 and 120
     or char_length(btrim(coalesce(p_adapter_version, ''))) not between 1 and 80
     or p_baseline_kind not in ('historical_replay', 'fresh_recovery', 'legacy_unresolved', 'manual_only')
     or p_canonical_baseline is null
     or jsonb_typeof(p_canonical_baseline) <> 'object'
     or octet_length(p_canonical_baseline::text) > 32768
     or p_profile_metadata is null
     or jsonb_typeof(p_profile_metadata) <> 'object'
     or octet_length(p_profile_metadata::text) > 32768 then
    raise exception 'product_evidence_source_verification_profile_invalid'
      using errcode = '22023';
  end if;

  select *
    into v_source
    from public.product_evidence_sources
   where source_id = p_source_id;

  if not found then
    raise exception 'product_evidence_source_verification_profile_source_not_found'
      using errcode = 'P0002';
  end if;

  select p.*
    into v_current_profile
    from public.product_evidence_source_verification_profiles p
   where p.source_id = p_source_id
     and not exists (
       select 1
         from public.product_evidence_source_verification_profiles child
        where child.supersedes_profile_id = p.profile_id
     )
   order by p.created_at desc, p.profile_id desc
   limit 1;

  if found then
    if p_supersedes_profile_id is distinct from v_current_profile.profile_id then
      raise exception 'product_evidence_source_verification_profile_supersedes_current_required'
        using errcode = '40001';
    end if;
  elsif p_supersedes_profile_id is not null then
    raise exception 'product_evidence_source_verification_profile_supersedes_unexpected'
      using errcode = '40001';
  end if;

  if p_baseline_kind = 'historical_replay' then
    if lower(btrim(p_baseline_content_digest)) <> v_source.content_digest
       or coalesce((p_canonical_baseline ->> 'replay_verified')::boolean, false) is not true then
      raise exception 'product_evidence_source_verification_profile_historical_replay_unproven'
        using errcode = '23514';
    end if;
    v_comparability_state := 'COMPARABLE';
  elsif p_baseline_kind = 'fresh_recovery' then
    if btrim(p_digest_basis) <> 'live-page-bytes-v1'
       or btrim(p_adapter_key) <> 'live-page-bytes'
       or btrim(p_adapter_version) <> 'v1'
       or coalesce(p_canonical_baseline ->> 'final_url', '') !~ '^https://'
       or coalesce(p_canonical_baseline ->> 'content_type', '') = ''
       or coalesce(jsonb_typeof(p_canonical_baseline -> 'byte_length'), '') <> 'number'
       or coalesce(p_canonical_baseline ->> 'fetched_at', '') = '' then
      raise exception 'product_evidence_source_verification_profile_fresh_recovery_invalid'
        using errcode = '23514';
    end if;
    v_comparability_state := 'COMPARABLE';
  elsif p_baseline_kind = 'legacy_unresolved' then
    v_comparability_state := 'BASELINE_RECOVERY_REQUIRED';
  else
    v_comparability_state := 'MANUAL_ONLY';
  end if;

  v_payload := jsonb_build_object(
    'request_id', v_request_id,
    'source_id', p_source_id,
    'supersedes_profile_id', p_supersedes_profile_id,
    'baseline_content_digest', lower(btrim(p_baseline_content_digest)),
    'digest_basis', btrim(p_digest_basis),
    'adapter_key', btrim(p_adapter_key),
    'adapter_version', btrim(p_adapter_version),
    'comparability_state', v_comparability_state,
    'baseline_kind', p_baseline_kind,
    'canonical_baseline', p_canonical_baseline,
    'profile_metadata', p_profile_metadata,
    'reviewed_by', p_actor_user_id
  );
  v_profile_digest := public.product_fact_controlled_sha256_json_v1(v_payload);

  insert into public.product_evidence_source_verification_profiles (
    request_id,
    source_id,
    supersedes_profile_id,
    baseline_content_digest,
    digest_basis,
    adapter_key,
    adapter_version,
    comparability_state,
    baseline_kind,
    canonical_baseline,
    profile_metadata,
    profile_digest,
    reviewed_by,
    reviewed_at
  )
  values (
    v_request_id,
    p_source_id,
    p_supersedes_profile_id,
    lower(btrim(p_baseline_content_digest)),
    btrim(p_digest_basis),
    btrim(p_adapter_key),
    btrim(p_adapter_version),
    v_comparability_state,
    p_baseline_kind,
    p_canonical_baseline,
    p_profile_metadata,
    v_profile_digest,
    p_actor_user_id,
    v_reviewed_at
  )
  on conflict (request_id) do nothing
  returning profile_id into v_profile_id;

  if v_profile_id is null then
    select *
      into v_existing
      from public.product_evidence_source_verification_profiles
     where request_id = v_request_id;

    if not found
       or v_existing.reviewed_by <> p_actor_user_id
       or v_existing.profile_digest <> v_profile_digest then
      raise exception 'product_evidence_source_verification_profile_request_conflict'
        using errcode = '23505';
    end if;

    return jsonb_build_object(
      'profile_id', v_existing.profile_id,
      'source_id', v_existing.source_id,
      'comparability_state', v_existing.comparability_state,
      'baseline_kind', v_existing.baseline_kind,
      'baseline_content_digest', v_existing.baseline_content_digest,
      'digest_basis', v_existing.digest_basis,
      'adapter_key', v_existing.adapter_key,
      'adapter_version', v_existing.adapter_version,
      'profile_digest', v_existing.profile_digest,
      'actor_role', v_actor_role,
      'inserted', false,
      'idempotent', true,
      'automatic_fact_mutation', false,
      'automatic_confirmation', false
    );
  end if;

  return jsonb_build_object(
    'profile_id', v_profile_id,
    'source_id', p_source_id,
    'comparability_state', v_comparability_state,
    'baseline_kind', p_baseline_kind,
    'baseline_content_digest', lower(btrim(p_baseline_content_digest)),
    'digest_basis', btrim(p_digest_basis),
    'adapter_key', btrim(p_adapter_key),
    'adapter_version', btrim(p_adapter_version),
    'profile_digest', v_profile_digest,
    'actor_role', v_actor_role,
    'inserted', true,
    'idempotent', false,
    'automatic_fact_mutation', false,
    'automatic_confirmation', false
  );
end;
$$;

revoke all on function public.admin_register_product_evidence_source_verification_profile_v1(
  uuid, text, uuid, uuid, text, text, text, text, text, jsonb, jsonb
) from public, anon, authenticated, service_role;
grant execute on function public.admin_register_product_evidence_source_verification_profile_v1(
  uuid, text, uuid, uuid, text, text, text, text, text, jsonb, jsonb
) to service_role;

create or replace function public.get_product_evidence_source_verification_target_v1(
  p_source_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source public.product_evidence_sources%rowtype;
  v_profile public.product_evidence_source_verification_profiles%rowtype;
begin
  if p_source_id is null then
    raise exception 'product_evidence_source_verification_target_source_required'
      using errcode = '22023';
  end if;

  select *
    into v_source
    from public.product_evidence_sources
   where source_id = p_source_id;

  if not found then
    raise exception 'product_evidence_source_verification_target_source_not_found'
      using errcode = 'P0002';
  end if;

  select p.*
    into v_profile
    from public.product_evidence_source_verification_profiles p
   where p.source_id = p_source_id
     and not exists (
       select 1
         from public.product_evidence_source_verification_profiles child
        where child.supersedes_profile_id = p.profile_id
     )
   order by p.created_at desc, p.profile_id desc
   limit 1;

  return jsonb_build_object(
    'source_id', v_source.source_id,
    'canonical_locator', v_source.canonical_locator,
    'source_content_digest', v_source.content_digest,
    'source_kind', v_source.source_kind,
    'source_metadata', v_source.source_metadata,
    'verification_profile',
      case when v_profile.profile_id is null then null else jsonb_build_object(
        'profile_id', v_profile.profile_id,
        'baseline_content_digest', v_profile.baseline_content_digest,
        'digest_basis', v_profile.digest_basis,
        'adapter_key', v_profile.adapter_key,
        'adapter_version', v_profile.adapter_version,
        'comparability_state', v_profile.comparability_state,
        'baseline_kind', v_profile.baseline_kind,
        'profile_digest', v_profile.profile_digest
      ) end
  );
end;
$$;

revoke all on function public.get_product_evidence_source_verification_target_v1(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_product_evidence_source_verification_target_v1(uuid)
  to service_role;

alter table public.product_evidence_source_verifications
  add column verification_profile_id uuid
    references public.product_evidence_source_verification_profiles(profile_id) on delete restrict,
  add column observation_digest_basis text,
  add column adapter_version text,
  add column verification_profile_digest text;

alter table public.product_evidence_source_verifications
  add constraint source_verifications_profile_binding_check
    check (
      (
        verification_profile_id is null
        and observation_digest_basis is null
        and adapter_version is null
        and verification_profile_digest is null
      )
      or
      (
        verification_profile_id is not null
        and char_length(btrim(observation_digest_basis)) between 1 and 160
        and char_length(btrim(adapter_version)) between 1 and 80
        and verification_profile_digest ~ '^[0-9a-f]{64}$'
      )
    );

create index source_verifications_profile_checked_idx
  on public.product_evidence_source_verifications (
    verification_profile_id,
    checked_at desc,
    verification_id
  )
  where verification_profile_id is not null;

create or replace function public.record_product_evidence_source_verification_v2(
  p_request_id text,
  p_verification_profile_id uuid,
  p_observed_content_digest text,
  p_verification_result text,
  p_trigger_kind text,
  p_checked_at timestamptz,
  p_verification_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request_id text := btrim(coalesce(p_request_id, ''));
  v_profile public.product_evidence_source_verification_profiles%rowtype;
  v_payload jsonb;
  v_payload_digest text;
  v_verification_id uuid;
  v_existing public.product_evidence_source_verifications%rowtype;
begin
  if char_length(v_request_id) not between 1 and 256
     or p_verification_profile_id is null
     or p_verification_result not in ('unchanged', 'changed', 'unavailable', 'ambiguous')
     or p_trigger_kind not in (
       'scheduled',
       'manual',
       'new_evidence',
       'subject_or_formulation_changed',
       'registry_changed'
     )
     or p_checked_at is null
     or p_verification_metadata is null
     or jsonb_typeof(p_verification_metadata) <> 'object'
     or octet_length(p_verification_metadata::text) > 32768
     or (
       p_observed_content_digest is not null
       and lower(btrim(p_observed_content_digest)) !~ '^[0-9a-f]{64}$'
     ) then
    raise exception 'product_evidence_source_verification_v2_invalid'
      using errcode = '22023';
  end if;

  select *
    into v_profile
    from public.product_evidence_source_verification_profiles
   where profile_id = p_verification_profile_id;

  if not found then
    raise exception 'product_evidence_source_verification_profile_not_found'
      using errcode = 'P0002';
  end if;

  if v_profile.comparability_state <> 'COMPARABLE'
     or exists (
       select 1
         from public.product_evidence_source_verification_profiles child
        where child.supersedes_profile_id = v_profile.profile_id
     ) then
    raise exception 'product_evidence_source_verification_profile_not_comparable'
      using errcode = '23514';
  end if;

  if p_verification_result = 'unchanged'
     and lower(btrim(coalesce(p_observed_content_digest, ''))) <> v_profile.baseline_content_digest then
    raise exception 'product_evidence_source_verification_unchanged_digest_mismatch'
      using errcode = '22023';
  end if;

  if p_verification_result = 'changed'
     and (
       p_observed_content_digest is null
       or lower(btrim(p_observed_content_digest)) = v_profile.baseline_content_digest
     ) then
    raise exception 'product_evidence_source_verification_changed_digest_required'
      using errcode = '22023';
  end if;

  if p_verification_result = 'unavailable'
     and p_observed_content_digest is not null then
    raise exception 'product_evidence_source_verification_unavailable_digest_forbidden'
      using errcode = '22023';
  end if;

  v_payload := jsonb_build_object(
    'request_id', v_request_id,
    'verification_profile_id', v_profile.profile_id,
    'source_id', v_profile.source_id,
    'baseline_content_digest', v_profile.baseline_content_digest,
    'observed_content_digest',
      case when p_observed_content_digest is null then null else lower(btrim(p_observed_content_digest)) end,
    'verification_result', p_verification_result,
    'trigger_kind', p_trigger_kind,
    'checked_at', p_checked_at,
    'verification_metadata', p_verification_metadata,
    'observation_digest_basis', v_profile.digest_basis,
    'adapter_version', v_profile.adapter_version,
    'verification_profile_digest', v_profile.profile_digest
  );
  v_payload_digest := public.product_fact_controlled_sha256_json_v1(v_payload);

  insert into public.product_evidence_source_verifications (
    request_id,
    source_id,
    baseline_content_digest,
    observed_content_digest,
    verification_result,
    trigger_kind,
    checked_at,
    verification_metadata,
    payload_digest,
    verification_profile_id,
    observation_digest_basis,
    adapter_version,
    verification_profile_digest
  )
  values (
    v_request_id,
    v_profile.source_id,
    v_profile.baseline_content_digest,
    case when p_observed_content_digest is null then null else lower(btrim(p_observed_content_digest)) end,
    p_verification_result,
    p_trigger_kind,
    p_checked_at,
    p_verification_metadata,
    v_payload_digest,
    v_profile.profile_id,
    v_profile.digest_basis,
    v_profile.adapter_version,
    v_profile.profile_digest
  )
  on conflict (request_id) do nothing
  returning verification_id into v_verification_id;

  if v_verification_id is null then
    select *
      into v_existing
      from public.product_evidence_source_verifications
     where request_id = v_request_id;

    if not found or v_existing.payload_digest <> v_payload_digest then
      raise exception 'product_evidence_source_verification_request_conflict'
        using errcode = '23505';
    end if;

    return jsonb_build_object(
      'verification_id', v_existing.verification_id,
      'verification_profile_id', v_existing.verification_profile_id,
      'source_id', v_existing.source_id,
      'baseline_content_digest', v_existing.baseline_content_digest,
      'observed_content_digest', v_existing.observed_content_digest,
      'verification_result', v_existing.verification_result,
      'trigger_kind', v_existing.trigger_kind,
      'payload_digest', v_existing.payload_digest,
      'inserted', false,
      'idempotent', true,
      'automatic_fact_mutation', false,
      'automatic_confirmation', false
    );
  end if;

  return jsonb_build_object(
    'verification_id', v_verification_id,
    'verification_profile_id', v_profile.profile_id,
    'source_id', v_profile.source_id,
    'baseline_content_digest', v_profile.baseline_content_digest,
    'observed_content_digest',
      case when p_observed_content_digest is null then null else lower(btrim(p_observed_content_digest)) end,
    'verification_result', p_verification_result,
    'trigger_kind', p_trigger_kind,
    'payload_digest', v_payload_digest,
    'inserted', true,
    'idempotent', false,
    'automatic_fact_mutation', false,
    'automatic_confirmation', false
  );
end;
$$;

revoke all on function public.record_product_evidence_source_verification_v2(
  text, uuid, text, text, text, timestamptz, jsonb
) from public, anon, authenticated, service_role;
grant execute on function public.record_product_evidence_source_verification_v2(
  text, uuid, text, text, text, timestamptz, jsonb
) to service_role;

create or replace function public.trust_phase8g_assert_verification_comparable_v1(
  p_verification_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_verification public.product_evidence_source_verifications%rowtype;
  v_profile public.product_evidence_source_verification_profiles%rowtype;
begin
  select *
    into v_verification
    from public.product_evidence_source_verifications
   where verification_id = p_verification_id;

  if not found then
    raise exception 'product_fact_revalidation_verification_not_found'
      using errcode = 'P0002';
  end if;

  if v_verification.verification_profile_id is null then
    raise exception 'product_fact_revalidation_verification_not_comparable'
      using errcode = '23514';
  end if;

  select *
    into v_profile
    from public.product_evidence_source_verification_profiles
   where profile_id = v_verification.verification_profile_id;

  if not found
     or v_profile.comparability_state <> 'COMPARABLE'
     or v_profile.source_id <> v_verification.source_id
     or v_profile.baseline_content_digest <> v_verification.baseline_content_digest
     or v_profile.digest_basis is distinct from v_verification.observation_digest_basis
     or v_profile.adapter_version is distinct from v_verification.adapter_version
     or v_profile.profile_digest is distinct from v_verification.verification_profile_digest
     or exists (
       select 1
         from public.product_evidence_source_verification_profiles child
        where child.supersedes_profile_id = v_profile.profile_id
     ) then
    raise exception 'product_fact_revalidation_verification_not_comparable'
      using errcode = '23514';
  end if;
end;
$$;

revoke all on function public.trust_phase8g_assert_verification_comparable_v1(uuid)
  from public, anon, authenticated, service_role;

alter function public.admin_preflight_product_fact_revalidation_v1(uuid, uuid, uuid)
  rename to trust_phase8g_preflight_revalidation_legacy_v1;

revoke all on function public.trust_phase8g_preflight_revalidation_legacy_v1(uuid, uuid, uuid)
  from public, anon, authenticated, service_role;

create or replace function public.admin_preflight_product_fact_revalidation_v1(
  p_actor_user_id uuid,
  p_verification_id uuid,
  p_assignment_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.trust_phase8g_assert_verification_comparable_v1(p_verification_id);
  return public.trust_phase8g_preflight_revalidation_legacy_v1(
    p_actor_user_id,
    p_verification_id,
    p_assignment_id
  );
end;
$$;

revoke all on function public.admin_preflight_product_fact_revalidation_v1(uuid, uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.admin_preflight_product_fact_revalidation_v1(uuid, uuid, uuid)
  to service_role;

alter function public.admin_mark_product_fact_revalidation_v1(uuid, text, jsonb)
  rename to trust_phase8g_mark_revalidation_legacy_v1;

revoke all on function public.trust_phase8g_mark_revalidation_legacy_v1(uuid, text, jsonb)
  from public, anon, authenticated, service_role;

create or replace function public.admin_mark_product_fact_revalidation_v1(
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
  v_verification_id uuid;
begin
  begin
    v_verification_id := (p_payload ->> 'verification_id')::uuid;
  exception when invalid_text_representation or null_value_not_allowed then
    raise exception 'product_fact_revalidation_payload_invalid'
      using errcode = '22023';
  end;

  if v_verification_id is null then
    raise exception 'product_fact_revalidation_payload_invalid'
      using errcode = '22023';
  end if;

  perform public.trust_phase8g_assert_verification_comparable_v1(v_verification_id);

  return public.trust_phase8g_mark_revalidation_legacy_v1(
    p_actor_user_id,
    p_request_id,
    p_payload
  );
end;
$$;

revoke all on function public.admin_mark_product_fact_revalidation_v1(uuid, text, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.admin_mark_product_fact_revalidation_v1(uuid, text, jsonb)
  to service_role;

comment on table public.product_evidence_source_verification_profiles is
  'Immutable source-verification comparability profiles. A profile proves which baseline and adapter may be used for source revalidation; profile creation never changes Product Fact authority.';

comment on function public.record_product_evidence_source_verification_v2(
  text, uuid, text, text, text, timestamptz, jsonb
) is
  'Service-role-only source verification recorder bound to an immutable COMPARABLE profile. It never mutates Product Facts, Current pointers, confirmations, or Recommendation authority.';

comment on function public.admin_preflight_product_fact_revalidation_v1(uuid, uuid, uuid) is
  'Phase 8G guarded revalidation preflight. Actionable source verification must be bound to the current immutable COMPARABLE profile before Phase 8C may proceed.';

commit;
