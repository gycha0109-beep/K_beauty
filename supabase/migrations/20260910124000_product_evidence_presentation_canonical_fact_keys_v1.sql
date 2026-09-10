begin;

do $$
begin
  if not exists (
    select 1 from pg_roles where rolname = 'recommendation_admission_runtime'
  ) then
    raise exception 'TRUST_P31_RUNTIME_ROLE_REQUIRED';
  end if;

  if not exists (
    select 1 from pg_roles where rolname = 'product_evidence_presentation_reader_owner'
  ) then
    raise exception 'TRUST_P31_READER_OWNER_REQUIRED';
  end if;
end
$$;

grant create on schema public to product_evidence_presentation_reader_owner;
grant product_evidence_presentation_reader_owner to postgres;
set role product_evidence_presentation_reader_owner;

create or replace function public.read_product_evidence_presentation_authority_v1(
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
  v_subject_count integer;
  v_subject_id uuid;
  v_subject jsonb;
  v_facts jsonb;
begin
  if p_product_id is null then
    return jsonb_build_object(
      'read_contract_version', 'product-evidence-presentation-authority-read-v1',
      'status', 'NO_AUTHORITY',
      'reason', 'PRODUCT_ID_REQUIRED'
    );
  end if;

  select count(*)::integer
    into v_product_count
  from public.products p
  where p.id = p_product_id;

  if v_product_count <> 1 then
    return jsonb_build_object(
      'read_contract_version', 'product-evidence-presentation-authority-read-v1',
      'status', 'NO_AUTHORITY',
      'reason', 'CANONICAL_PRODUCT_NOT_FOUND'
    );
  end if;

  select count(*)::integer
    into v_subject_count
  from public.product_fact_subjects s
  where s.product_id = p_product_id
    and s.current_state = 'current';

  if v_subject_count <> 1 then
    return jsonb_build_object(
      'read_contract_version', 'product-evidence-presentation-authority-read-v1',
      'status', 'NO_AUTHORITY',
      'reason', case
        when v_subject_count = 0 then 'CURRENT_SUBJECT_MISSING'
        else 'CURRENT_SUBJECT_AMBIGUOUS'
      end
    );
  end if;

  select s.subject_id,
         jsonb_build_object(
           'subject_id', s.subject_id,
           'product_id', s.product_id,
           'identity_status', s.identity_status,
           'current_state', s.current_state,
           'valid_from', s.valid_from,
           'valid_to', s.valid_to
         )
    into v_subject_id, v_subject
  from public.product_fact_subjects s
  where s.product_id = p_product_id
    and s.current_state = 'current';

  if coalesce(v_subject ->> 'identity_status', '') <> 'resolved'
     or ((v_subject ->> 'valid_from') is not null and (v_subject ->> 'valid_from')::date > current_date)
     or ((v_subject ->> 'valid_to') is not null and (v_subject ->> 'valid_to')::date <= current_date) then
    return jsonb_build_object(
      'read_contract_version', 'product-evidence-presentation-authority-read-v1',
      'status', 'NO_AUTHORITY',
      'reason', 'CURRENT_SUBJECT_NOT_USABLE'
    );
  end if;

  if exists (
    select 1
    from public.product_fact_current c
    join public.product_fact_instances i
      on i.fact_instance_id = c.fact_instance_id
     and i.proposition_key = c.proposition_key
     and i.subject_id = c.subject_id
    join public.product_fact_confirmations cf
      on cf.confirmation_id = c.confirmation_id
    where c.subject_id = v_subject_id
      and i.fact_key in ('eye_sting_observed', 'white_cast_observed')
      and (
        (i.valid_from is not null and i.valid_from > current_date)
        or (i.valid_to is not null and i.valid_to <= current_date)
      )
  ) then
    return jsonb_build_object(
      'read_contract_version', 'product-evidence-presentation-authority-read-v1',
      'status', 'NO_AUTHORITY',
      'reason', 'TARGET_CURRENT_FACT_STALE_OR_NOT_YET_VALID'
    );
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'fact_instance_id', i.fact_instance_id,
        'subject_id', i.subject_id,
        'registry_version', i.registry_version,
        'fact_key', i.fact_key,
        'proposition_key', i.proposition_key,
        'confirmation_id', c.confirmation_id,
        'semantic_status', i.semantic_status,
        'value_type', i.value_type,
        'value_boolean', i.value_boolean,
        'value_enum', i.value_enum,
        'value_number', i.value_number,
        'value_unit', i.value_unit,
        'value_range_min', i.value_range_min,
        'value_range_max', i.value_range_max,
        'value_entity_identifier', i.value_entity_identifier,
        'authority_ceiling', i.authority_ceiling,
        'evidence', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'evidence_id', e.evidence_id,
              'source_id', e.source_id,
              'binding_id', e.binding_id,
              'link_role', l.link_role,
              'evidence_class', e.evidence_class,
              'evidence_authority', e.evidence_authority,
              'support_direction', e.support_direction,
              'negative_admissibility', e.negative_admissibility,
              'valid_from', e.valid_from,
              'valid_to', e.valid_to
            )
            order by e.evidence_id
          )
          from public.product_fact_evidence_links l
          join public.product_evidence_records e
            on e.evidence_id = l.evidence_id
           and e.proposition_key = l.proposition_key
           and e.subject_id = l.subject_id
          where l.fact_instance_id = i.fact_instance_id
            and l.proposition_key = i.proposition_key
            and l.subject_id = i.subject_id
        ), '[]'::jsonb)
      )
      order by i.fact_key, i.proposition_key, i.fact_instance_id
    ),
    '[]'::jsonb
  )
    into v_facts
  from public.product_fact_current c
  join public.product_fact_instances i
    on i.fact_instance_id = c.fact_instance_id
   and i.proposition_key = c.proposition_key
   and i.subject_id = c.subject_id
  join public.product_fact_confirmations cf
    on cf.confirmation_id = c.confirmation_id
  where c.subject_id = v_subject_id
    and i.fact_key in ('eye_sting_observed', 'white_cast_observed');

  return jsonb_build_object(
    'read_contract_version', 'product-evidence-presentation-authority-read-v1',
    'status', 'AUTHORITY_RESOLVED',
    'product_id', p_product_id,
    'subject', v_subject,
    'current_facts', v_facts
  );
end;
$$;

comment on function public.read_product_evidence_presentation_authority_v1(uuid) is
  'TRUST-P3.1 product-scoped canonical current observed eye-sting/white-cast Facts and linked EvidenceRecords for explanation-only presentation. Registry-unsupported pilling_risk/finish remain unavailable.';

revoke all on function public.read_product_evidence_presentation_authority_v1(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.read_product_evidence_presentation_authority_v1(uuid)
  to recommendation_admission_runtime;

reset role;
revoke product_evidence_presentation_reader_owner from postgres;
revoke create on schema public from product_evidence_presentation_reader_owner;

do $$
begin
  if has_schema_privilege('product_evidence_presentation_reader_owner', 'public', 'CREATE') then
    raise exception 'TRUST_P31_OWNER_SCHEMA_CREATE_FORBIDDEN';
  end if;

  if has_table_privilege('recommendation_admission_runtime', 'public.product_fact_current', 'SELECT')
     or has_table_privilege('recommendation_admission_runtime', 'public.product_fact_instances', 'SELECT')
     or has_table_privilege('recommendation_admission_runtime', 'public.product_fact_evidence_links', 'SELECT')
     or has_table_privilege('recommendation_admission_runtime', 'public.product_evidence_records', 'SELECT') then
    raise exception 'TRUST_P31_RUNTIME_RAW_SELECT_FORBIDDEN';
  end if;

  if not has_function_privilege(
    'recommendation_admission_runtime',
    'public.read_product_evidence_presentation_authority_v1(uuid)',
    'EXECUTE'
  ) then
    raise exception 'TRUST_P31_RUNTIME_RPC_EXECUTE_REQUIRED';
  end if;
end
$$;

commit;
