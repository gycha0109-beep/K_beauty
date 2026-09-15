begin;

-- TRUST Phase 2 authority hardening.
-- A catalog Product + market match is not sufficient to prove an exact Product
-- Fact Subject when that Subject carries a variant/presentation scope. Until a
-- governed presentation-equivalence key exists on TRUST intake, variant-scoped
-- Subjects remain review candidates and are never auto-linked.

create or replace function public.resolve_catalog_trust_subject_v1(p_intake_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_intake public.catalog_trust_intake%rowtype;
  v_source_identity_state text;
  v_source_identity_version text;
  v_total_subject_count integer := 0;
  v_exact_current_count integer := 0;
  v_exact_market_count integer := 0;
  v_other_market_count integer := 0;
  v_formulation_count integer := 0;
  v_variant_count integer := 0;
  v_subject_id uuid;
  v_candidate_subject_id uuid;
  v_exact_current_variant_key text;
  v_subject_ids jsonb := '[]'::jsonb;
  v_identity_state text;
  v_trust_state text;
  v_reason_code text;
  v_detail jsonb;
begin
  select * into v_intake
  from public.catalog_trust_intake
  where id = p_intake_id
  for update;

  if not found then
    raise exception 'catalog_trust_intake_not_found' using errcode = 'P0002';
  end if;

  v_detail := jsonb_build_object(
    'resolver_version', 'product-fact-subject-resolution-v1',
    'product_id', v_intake.product_id,
    'market', v_intake.market,
    'source_candidate_id', v_intake.source_candidate_id
  );

  if v_intake.source_candidate_id is not null then
    select pc.identity_resolution_state, pc.identity_resolution_version
      into v_source_identity_state, v_source_identity_version
    from public.product_candidates pc
    where pc.id = v_intake.source_candidate_id;

    if not found then
      v_identity_state := 'IDENTITY_BLOCKED';
      v_reason_code := 'source_candidate_missing';
    elsif v_source_identity_state = 'variant_scope_conflict' then
      v_identity_state := 'VARIANT_CONFLICT';
      v_reason_code := 'catalog_variant_scope_conflict';
    elsif v_source_identity_state = 'formulation_conflict' then
      v_identity_state := 'FORMULATION_CONFLICT';
      v_reason_code := 'catalog_formulation_conflict';
    elsif v_source_identity_state = 'market_conflict' then
      v_identity_state := 'MARKET_CONFLICT';
      v_reason_code := 'catalog_market_conflict';
    elsif v_source_identity_state <> 'resolved' then
      v_identity_state := 'IDENTITY_BLOCKED';
      v_reason_code := 'catalog_identity_not_resolved';
    end if;

    v_detail := v_detail || jsonb_build_object(
      'catalog_identity_state', v_source_identity_state,
      'catalog_identity_version', v_source_identity_version
    );
  end if;

  if v_identity_state is null and v_intake.market is null then
    v_identity_state := 'IDENTITY_BLOCKED';
    v_reason_code := 'intake_market_unresolved';
  end if;

  if v_identity_state is null then
    select count(*)::integer
      into v_total_subject_count
    from public.product_fact_subjects s
    where s.product_id = v_intake.product_id;

    select
      count(*)::integer,
      min(s.subject_id::text)::uuid,
      count(distinct coalesce(s.formulation_revision_key, '<null>'))::integer,
      count(distinct coalesce(s.variant_key, '<null>'))::integer,
      max(s.variant_key),
      coalesce(jsonb_agg(s.subject_id order by s.subject_id), '[]'::jsonb)
      into v_exact_current_count, v_subject_id, v_formulation_count, v_variant_count,
           v_exact_current_variant_key, v_subject_ids
    from public.product_fact_subjects s
    where s.product_id = v_intake.product_id
      and s.identity_status = 'resolved'
      and s.current_state = 'current'
      and s.market_applicability = v_intake.market;

    if v_exact_current_count = 1 then
      if v_exact_current_variant_key is null then
        v_identity_state := 'EXACT_SUBJECT_FOUND';
        v_reason_code := 'single_product_scoped_current_subject_exact_market';
      else
        v_candidate_subject_id := v_subject_id;
        v_subject_id := null;
        v_identity_state := 'SUBJECT_CANDIDATE_FOUND';
        v_reason_code := 'presentation_relation_not_proven_for_variant_scoped_subject';
      end if;
    elsif v_exact_current_count > 1 then
      v_subject_id := null;
      if v_formulation_count > 1 then
        v_identity_state := 'FORMULATION_CONFLICT';
        v_reason_code := 'multiple_current_formulations_exact_market';
      elsif v_variant_count > 1 then
        v_identity_state := 'VARIANT_CONFLICT';
        v_reason_code := 'multiple_current_variants_exact_market';
      else
        v_identity_state := 'IDENTITY_BLOCKED';
        v_reason_code := 'multiple_current_subjects_exact_market';
      end if;
    else
      select
        count(*)::integer,
        min(s.subject_id::text)::uuid,
        count(distinct coalesce(s.formulation_revision_key, '<null>'))::integer,
        count(distinct coalesce(s.variant_key, '<null>'))::integer,
        coalesce(jsonb_agg(s.subject_id order by s.subject_id), '[]'::jsonb)
        into v_exact_market_count, v_candidate_subject_id, v_formulation_count, v_variant_count, v_subject_ids
      from public.product_fact_subjects s
      where s.product_id = v_intake.product_id
        and s.market_applicability = v_intake.market;

      if v_exact_market_count = 1 then
        v_identity_state := 'SUBJECT_CANDIDATE_FOUND';
        v_reason_code := 'single_noncurrent_or_nonresolved_exact_market_subject';
      elsif v_exact_market_count > 1 then
        if v_formulation_count > 1 then
          v_identity_state := 'FORMULATION_CONFLICT';
          v_reason_code := 'multiple_candidate_formulations_exact_market';
        elsif v_variant_count > 1 then
          v_identity_state := 'VARIANT_CONFLICT';
          v_reason_code := 'multiple_candidate_variants_exact_market';
        else
          v_identity_state := 'IDENTITY_BLOCKED';
          v_reason_code := 'multiple_candidate_subjects_exact_market';
        end if;
      else
        select count(*)::integer into v_other_market_count
        from public.product_fact_subjects s
        where s.product_id = v_intake.product_id
          and s.market_applicability is distinct from v_intake.market;

        if v_other_market_count > 0 then
          v_identity_state := 'MARKET_CONFLICT';
          v_reason_code := 'subjects_exist_only_outside_exact_market';
        elsif v_total_subject_count = 0 then
          v_identity_state := 'SUBJECT_CREATION_REQUIRED';
          v_reason_code := 'no_product_fact_subject_exists';
        else
          v_identity_state := 'IDENTITY_BLOCKED';
          v_reason_code := 'subject_identity_unclassifiable';
        end if;
      end if;
    end if;
  end if;

  if v_identity_state = 'EXACT_SUBJECT_FOUND' then
    v_trust_state := case
      when v_intake.trust_state = 'COMPLETED' then 'COMPLETED'
      else 'RESEARCH_PENDING'
    end;
  elsif v_identity_state in ('SUBJECT_CANDIDATE_FOUND', 'SUBJECT_CREATION_REQUIRED') then
    v_trust_state := 'REVIEW_REQUIRED';
  else
    v_trust_state := 'BLOCKED';
  end if;

  v_detail := v_detail || jsonb_build_object(
    'reason_code', v_reason_code,
    'total_subject_count', v_total_subject_count,
    'exact_current_count', v_exact_current_count,
    'exact_market_count', v_exact_market_count,
    'other_market_count', v_other_market_count,
    'exact_current_variant_key', v_exact_current_variant_key,
    'presentation_relation_proven', v_identity_state = 'EXACT_SUBJECT_FOUND',
    'candidate_subject_id', v_candidate_subject_id,
    'subject_ids', v_subject_ids
  );

  update public.catalog_trust_intake
  set subject_id = case when v_identity_state = 'EXACT_SUBJECT_FOUND' then v_subject_id else null end,
      identity_state = v_identity_state,
      identity_resolution_version = 'product-fact-subject-resolution-v1',
      identity_resolution_detail = v_detail,
      trust_state = v_trust_state,
      started_at = coalesce(started_at, now()),
      completed_at = case when v_trust_state = 'COMPLETED' then completed_at else null end,
      last_checked_at = now(),
      updated_at = now()
  where id = v_intake.id;

  return jsonb_build_object(
    'status', 'resolved',
    'intake_id', v_intake.id,
    'product_id', v_intake.product_id,
    'identity_state', v_identity_state,
    'subject_id', case when v_identity_state = 'EXACT_SUBJECT_FOUND' then v_subject_id else null end,
    'trust_state', v_trust_state,
    'detail', v_detail
  );
end;
$$;

revoke all on function public.resolve_catalog_trust_subject_v1(uuid)
  from public, anon, authenticated;
grant execute on function public.resolve_catalog_trust_subject_v1(uuid)
  to service_role;

comment on function public.resolve_catalog_trust_subject_v1(uuid) is
  'TRUST Phase 2 service-role Subject resolver. Variant-scoped Subjects require separately governed presentation equivalence and remain review candidates until then.';

commit;
