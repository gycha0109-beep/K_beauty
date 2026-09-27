-- TRUST Phase 8H-3 / Phase 8E relationship scope hardening.
-- Source/evidence locale is provenance. It is not Product Fact semantic applicability.
-- Keep market, explicit candidate region, qualifier and validity checks fail-closed,
-- while excluding source binding locale from SAME/CHANGED relationship comparison.
create or replace function public.trust_phase8e_build_revalidation_plan_v1(
  p_actor_user_id uuid,
  p_transition_id uuid,
  p_candidate_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan jsonb;
  v_candidate public.trust_evidence_candidates%rowtype;
  v_current_fact public.product_fact_instances%rowtype;
  v_definition public.product_fact_definition_snapshots%rowtype;
  v_parent_required boolean;
  v_current_value jsonb;
  v_candidate_value jsonb;
  v_relation text;
  v_evidence_payload jsonb;
  v_prestate_digest text;
begin
  perform public.admin_require_product_review_actor(
    p_actor_user_id,
    'admin.products.review'
  );

  v_plan := public.trust_phase8e_build_revalidation_plan_legacy_v1(
    p_actor_user_id,
    p_transition_id,
    p_candidate_id
  );

  select *
    into v_candidate
    from public.trust_evidence_candidates
   where candidate_id = p_candidate_id;

  select *
    into v_current_fact
    from public.product_fact_instances
   where fact_instance_id = (v_plan ->> 'current_fact_instance_id')::uuid;

  select *
    into v_definition
    from public.product_fact_definition_snapshots
   where registry_version = v_candidate.registry_version
     and fact_key = v_candidate.fact_key
     and deprecated = false;

  if not found then
    raise exception 'product_fact_revalidation_resolution_definition_missing'
      using errcode = '55000';
  end if;

  v_parent_required := coalesce(
    (v_definition.definition #>> '{relationship_schema,subject_ref_required}')::boolean,
    false
  );

  if not v_parent_required then
    return v_plan;
  end if;

  if v_candidate.fact_key <> 'active_concentration'
     or v_definition.value_type <> 'number_unit' then
    raise exception 'product_fact_revalidation_relationship_comparator_unsupported'
      using errcode = '55000';
  end if;

  if v_current_fact.parent_fact_instance_id is null
     or v_current_fact.parent_proposition_key is null
     or v_candidate.parent_proposition_key is null
     or v_candidate.parent_proposition_key <> v_current_fact.parent_proposition_key then
    raise exception 'product_fact_revalidation_parent_proposition_mismatch'
      using errcode = '55000';
  end if;

  if v_candidate.market is distinct from v_current_fact.market
     or v_candidate.region is distinct from v_current_fact.region
     or v_candidate.qualifier is distinct from v_current_fact.qualifier
     or v_current_fact.valid_from is not null
     or v_current_fact.valid_to is not null then
    raise exception 'product_fact_revalidation_relationship_scope_mismatch'
      using errcode = '55000';
  end if;

  if jsonb_typeof(v_candidate.normalized_value) <> 'object'
     or not (v_candidate.normalized_value ?& array['amount','unit'])
     or (select count(*) from jsonb_object_keys(v_candidate.normalized_value)) <> 2
     or jsonb_typeof(v_candidate.normalized_value -> 'amount') <> 'number'
     or jsonb_typeof(v_candidate.normalized_value -> 'unit') <> 'string' then
    raise exception 'product_fact_revalidation_relationship_value_invalid'
      using errcode = '22023';
  end if;

  v_current_value := jsonb_build_object(
    'amount', v_current_fact.value_number,
    'unit', v_current_fact.value_unit
  );
  v_candidate_value := v_candidate.normalized_value;

  v_relation := case
    when v_candidate_value = v_current_value then 'SAME_SEMANTIC'
    else 'SEMANTIC_CHANGE'
  end;

  v_evidence_payload := v_plan -> 'evidence_payload';
  v_evidence_payload := jsonb_set(
    v_evidence_payload,
    '{proposition_key}',
    to_jsonb(v_plan ->> 'current_proposition_key'),
    false
  );
  v_evidence_payload := jsonb_set(
    v_evidence_payload,
    '{proposition_value_identity}',
    'null'::jsonb,
    false
  );
  v_evidence_payload := jsonb_set(
    v_evidence_payload,
    '{parent_proposition_key}',
    to_jsonb(v_current_fact.parent_proposition_key),
    false
  );

  v_prestate_digest := public.product_fact_controlled_sha256_json_v1(
    jsonb_build_object(
      'legacy_prestate_digest', v_plan ->> 'prestate_digest',
      'comparison_contract', 'relationship-aware-value-v1',
      'current_proposition_key', v_plan ->> 'current_proposition_key',
      'current_parent_proposition_key', v_current_fact.parent_proposition_key,
      'current_parent_fact_instance_id', v_current_fact.parent_fact_instance_id,
      'current_value', v_current_value,
      'candidate_value', v_candidate_value
    )
  );

  return v_plan || jsonb_build_object(
    'candidate_proposition_key', v_plan ->> 'current_proposition_key',
    'semantic_relation', v_relation,
    'prestate_digest', v_prestate_digest,
    'evidence_payload', v_evidence_payload,
    'semantic_comparison_contract', 'relationship-aware-value-v1',
    'current_parent_fact_instance_id', v_current_fact.parent_fact_instance_id,
    'current_parent_proposition_key', v_current_fact.parent_proposition_key,
    'candidate_parent_proposition_key', v_candidate.parent_proposition_key,
    'current_typed_value', v_current_value,
    'candidate_typed_value', v_candidate_value
  );
end;
$$;

revoke all on function public.trust_phase8e_build_revalidation_plan_v1(
  uuid, uuid, uuid
) from public, anon, authenticated, service_role;
grant execute on function public.trust_phase8e_build_revalidation_plan_v1(
  uuid, uuid, uuid
) to service_role;
