create or replace function public.get_official_source_relocation_verification_target_v1(
  p_relocation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_relocation public.trust_official_source_relocations%rowtype;
  v_historical_source public.product_evidence_sources%rowtype;
  v_old_binding public.product_source_bindings%rowtype;
  v_replacement_binding public.product_source_bindings%rowtype;
  v_replacement_review public.trust_official_source_binding_reviews%rowtype;
  v_subject public.product_fact_subjects%rowtype;
  v_profile public.product_evidence_source_verification_profiles%rowtype;
begin
  if p_relocation_id is null then
    raise exception 'official_source_relocation_verification_target_relocation_required'
      using errcode = '22023';
  end if;

  select *
    into v_relocation
    from public.trust_official_source_relocations
   where relocation_id = p_relocation_id;

  if not found or v_relocation.result <> 'confirmed' then
    raise exception 'official_source_relocation_verification_target_not_confirmed'
      using errcode = '55000';
  end if;

  select *
    into v_historical_source
    from public.product_evidence_sources
   where source_id = v_relocation.historical_source_id;

  select *
    into v_old_binding
    from public.product_source_bindings
   where binding_id = v_relocation.old_binding_id;

  select *
    into v_replacement_binding
    from public.product_source_bindings
   where binding_id = v_relocation.replacement_binding_id;

  select *
    into v_replacement_review
    from public.trust_official_source_binding_reviews
   where review_id = v_relocation.replacement_review_id;

  select *
    into v_subject
    from public.product_fact_subjects
   where subject_id = v_relocation.subject_id;

  if v_historical_source.source_id is null
     or v_historical_source.canonical_locator is distinct from v_relocation.old_locator
     or v_historical_source.source_kind <> 'official_product_page'
     or v_old_binding.binding_id is null
     or v_old_binding.product_id <> v_relocation.product_id
     or v_old_binding.source_url is distinct from v_relocation.old_locator
     or v_old_binding.binding_state <> 'retired'
     or v_old_binding.binding_method <> 'trust_official_source_review_v1'
     or v_old_binding.product_scope_state <> 'product'
     or v_replacement_binding.binding_id is null
     or v_replacement_binding.product_id <> v_relocation.product_id
     or v_replacement_binding.source_url is distinct from v_relocation.replacement_locator
     or v_replacement_binding.binding_state <> 'resolved'
     or v_replacement_binding.binding_method <> 'trust_official_source_review_v1'
     or v_replacement_binding.product_scope_state <> 'product'
     or v_replacement_binding.external_id is distinct from v_relocation.replacement_external_id
     or v_replacement_review.review_id is null
     or v_replacement_review.binding_id <> v_relocation.replacement_binding_id
     or v_replacement_review.product_id <> v_relocation.product_id
     or v_replacement_review.subject_id <> v_relocation.subject_id
     or v_replacement_review.review_version <> 'trust-official-source-review-v1'
     or v_replacement_review.scope_relation <> 'equivalent'
     or v_subject.subject_id is null
     or v_subject.product_id <> v_relocation.product_id
     or v_subject.identity_status <> 'resolved'
     or v_subject.current_state <> 'current'
     or v_replacement_review.variant_key is distinct from v_subject.variant_key
     or v_replacement_review.formulation_revision_key is distinct from v_subject.formulation_revision_key
     or v_relocation.replacement_locator !~ '^https://[^[:space:]#]+$'
     or not exists (
       select 1
         from public.product_evidence_source_subject_bindings b
        where b.source_id = v_relocation.historical_source_id
          and b.product_id = v_relocation.product_id
          and b.subject_id = v_relocation.subject_id
          and b.binding_state = 'exact_subject_match'
          and b.scope_relation in ('equivalent', 'narrower')
     ) then
    raise exception 'official_source_relocation_verification_target_stale'
      using errcode = '40001';
  end if;

  select p.*
    into v_profile
    from public.product_evidence_source_verification_profiles p
   where p.source_id = v_relocation.historical_source_id
     and not exists (
       select 1
         from public.product_evidence_source_verification_profiles child
        where child.supersedes_profile_id = p.profile_id
     )
   order by p.created_at desc, p.profile_id desc
   limit 1;

  return jsonb_build_object(
    'relocation_id', v_relocation.relocation_id,
    'product_id', v_relocation.product_id,
    'subject_id', v_relocation.subject_id,
    'historical_source_id', v_relocation.historical_source_id,
    'historical_canonical_locator', v_historical_source.canonical_locator,
    'historical_content_digest', v_historical_source.content_digest,
    'source_kind', v_historical_source.source_kind,
    'source_metadata', v_historical_source.source_metadata,
    'old_binding_id', v_relocation.old_binding_id,
    'replacement_binding_id', v_relocation.replacement_binding_id,
    'replacement_review_id', v_relocation.replacement_review_id,
    'replacement_locator', v_relocation.replacement_locator,
    'relocation_plan_digest', v_relocation.relocation_plan_digest,
    'verification_profile',
      case when v_profile.profile_id is null then null else jsonb_build_object(
        'profile_id', v_profile.profile_id,
        'baseline_content_digest', v_profile.baseline_content_digest,
        'digest_basis', v_profile.digest_basis,
        'adapter_key', v_profile.adapter_key,
        'adapter_version', v_profile.adapter_version,
        'comparability_state', v_profile.comparability_state,
        'baseline_kind', v_profile.baseline_kind,
        'canonical_baseline', v_profile.canonical_baseline,
        'profile_metadata', v_profile.profile_metadata,
        'profile_digest', v_profile.profile_digest
      ) end
  );
end;
$$;

revoke all on function public.get_official_source_relocation_verification_target_v1(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_official_source_relocation_verification_target_v1(uuid)
  to service_role;
