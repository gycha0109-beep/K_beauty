begin;

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

  if p_baseline_kind = 'historical_replay' then
    if lower(btrim(p_baseline_content_digest)) <> v_source.content_digest
       or coalesce((p_canonical_baseline ->> 'replay_verified')::boolean, false) is not true then
      raise exception 'product_evidence_source_verification_profile_historical_replay_unproven'
        using errcode = '23514';
    end if;
    v_comparability_state := 'COMPARABLE';
  elsif p_baseline_kind = 'fresh_recovery' then
    if not (
         (
           btrim(p_digest_basis) = 'live-page-bytes-v1'
           and btrim(p_adapter_key) = 'live-page-bytes'
           and btrim(p_adapter_version) = 'v1'
         )
         or
         (
           btrim(p_digest_basis) = 'canonical-official-product-semantics-v1'
           and btrim(p_adapter_key) = 'official-product-semantic'
           and btrim(p_adapter_version) = 'v1'
           and coalesce(jsonb_typeof(p_canonical_baseline -> 'canonical_length'), '') = 'number'
         )
         or
         (
           btrim(p_digest_basis) = 'official-claim-asset-bytes-v1'
           and btrim(p_adapter_key) = 'official-claim-asset'
           and btrim(p_adapter_version) = 'v1'
           and coalesce(jsonb_typeof(p_canonical_baseline -> 'canonical_length'), '') = 'number'
           and coalesce(p_canonical_baseline ->> 'asset_url', '') ~ '^https://'
           and coalesce(p_canonical_baseline ->> 'asset_final_url', '') ~ '^https://'
           and coalesce(p_canonical_baseline ->> 'asset_content_type', '') like 'image/%'
           and coalesce(jsonb_typeof(p_canonical_baseline -> 'asset_byte_length'), '') = 'number'
           and coalesce(v_source.source_metadata ->> 'direct_claim_asset_url', '') =
               coalesce(p_canonical_baseline ->> 'asset_url', '')
         )
       )
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

  select *
    into v_existing
    from public.product_evidence_source_verification_profiles
   where request_id = v_request_id;

  if found then
    if v_existing.reviewed_by <> p_actor_user_id
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

commit;
