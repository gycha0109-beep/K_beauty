begin;

do $$
begin
  if not exists (
    select 1 from pg_roles where rolname = 'recommendation_admission_runtime'
  ) then
    raise exception 'TRUST_P3_RUNTIME_ROLE_REQUIRED';
  end if;

  if not exists (
    select 1 from pg_roles where rolname = 'product_evidence_presentation_reader_owner'
  ) then
    create role product_evidence_presentation_reader_owner
      nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
  else
    alter role product_evidence_presentation_reader_owner
      nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
  end if;
end
$$;

grant usage on schema public to recommendation_admission_runtime;
grant usage on schema public to product_evidence_presentation_reader_owner;

revoke all privileges on public.products from recommendation_admission_runtime;
revoke all privileges on public.product_fact_subjects from recommendation_admission_runtime;
revoke all privileges on public.product_fact_current from recommendation_admission_runtime;
revoke all privileges on public.product_fact_instances from recommendation_admission_runtime;
revoke all privileges on public.product_fact_confirmations from recommendation_admission_runtime;
revoke all privileges on public.product_fact_evidence_links from recommendation_admission_runtime;
revoke all privileges on public.product_evidence_records from recommendation_admission_runtime;

revoke all privileges on public.products from product_evidence_presentation_reader_owner;
revoke all privileges on public.product_fact_subjects from product_evidence_presentation_reader_owner;
revoke all privileges on public.product_fact_current from product_evidence_presentation_reader_owner;
revoke all privileges on public.product_fact_instances from product_evidence_presentation_reader_owner;
revoke all privileges on public.product_fact_confirmations from product_evidence_presentation_reader_owner;
revoke all privileges on public.product_fact_evidence_links from product_evidence_presentation_reader_owner;
revoke all privileges on public.product_evidence_records from product_evidence_presentation_reader_owner;

grant select (id)
  on public.products
  to product_evidence_presentation_reader_owner;

grant select (
  subject_id,
  product_id,
  identity_status,
  current_state,
  valid_from,
  valid_to
) on public.product_fact_subjects
  to product_evidence_presentation_reader_owner;

grant select (
  proposition_key,
  fact_instance_id,
  subject_id,
  confirmation_id
) on public.product_fact_current
  to product_evidence_presentation_reader_owner;

grant select (
  fact_instance_id,
  subject_id,
  registry_version,
  fact_key,
  proposition_key,
  semantic_status,
  value_type,
  value_boolean,
  value_enum,
  value_number,
  value_unit,
  value_range_min,
  value_range_max,
  value_entity_identifier,
  authority_ceiling,
  valid_from,
  valid_to
) on public.product_fact_instances
  to product_evidence_presentation_reader_owner;

grant select (confirmation_id)
  on public.product_fact_confirmations
  to product_evidence_presentation_reader_owner;

grant select (
  fact_instance_id,
  evidence_id,
  subject_id,
  proposition_key,
  link_role
) on public.product_fact_evidence_links
  to product_evidence_presentation_reader_owner;

grant select (
  evidence_id,
  source_id,
  binding_id,
  subject_id,
  registry_version,
  fact_key,
  proposition_key,
  evidence_class,
  evidence_authority,
  support_direction,
  negative_admissibility,
  valid_from,
  valid_to
) on public.product_evidence_records
  to product_evidence_presentation_reader_owner;

drop policy if exists trust_p3_reader_products_select_v1 on public.products;
create policy trust_p3_reader_products_select_v1
  on public.products for select to product_evidence_presentation_reader_owner using (true);

drop policy if exists trust_p3_reader_subjects_select_v1 on public.product_fact_subjects;
create policy trust_p3_reader_subjects_select_v1
  on public.product_fact_subjects for select to product_evidence_presentation_reader_owner using (true);

drop policy if exists trust_p3_reader_current_select_v1 on public.product_fact_current;
create policy trust_p3_reader_current_select_v1
  on public.product_fact_current for select to product_evidence_presentation_reader_owner using (true);

drop policy if exists trust_p3_reader_instances_select_v1 on public.product_fact_instances;
create policy trust_p3_reader_instances_select_v1
  on public.product_fact_instances for select to product_evidence_presentation_reader_owner using (true);

drop policy if exists trust_p3_reader_confirmations_select_v1 on public.product_fact_confirmations;
create policy trust_p3_reader_confirmations_select_v1
  on public.product_fact_confirmations for select to product_evidence_presentation_reader_owner using (true);

drop policy if exists trust_p3_reader_links_select_v1 on public.product_fact_evidence_links;
create policy trust_p3_reader_links_select_v1
  on public.product_fact_evidence_links for select to product_evidence_presentation_reader_owner using (true);

drop policy if exists trust_p3_reader_evidence_select_v1 on public.product_evidence_records;
create policy trust_p3_reader_evidence_select_v1
  on public.product_evidence_records for select to product_evidence_presentation_reader_owner using (true);

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
      and i.fact_key in ('eye_sting', 'white_cast', 'pilling_risk', 'finish')
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
    and i.fact_key in ('eye_sting', 'white_cast', 'pilling_risk', 'finish');

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
  'TRUST-P3 product-scoped canonical current Fact and linked EvidenceRecord transport for explanation-only presentation. No source bodies, recommendation decision, score, or write authority.';

revoke all on function public.read_product_evidence_presentation_authority_v1(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.read_product_evidence_presentation_authority_v1(uuid)
  to recommendation_admission_runtime;

grant create on schema public to product_evidence_presentation_reader_owner;
grant product_evidence_presentation_reader_owner to postgres;
alter function public.read_product_evidence_presentation_authority_v1(uuid)
  owner to product_evidence_presentation_reader_owner;
revoke product_evidence_presentation_reader_owner from postgres;
revoke create on schema public from product_evidence_presentation_reader_owner;

do $$
begin
  if has_schema_privilege('product_evidence_presentation_reader_owner', 'public', 'CREATE') then
    raise exception 'TRUST_P3_OWNER_SCHEMA_CREATE_FORBIDDEN';
  end if;

  if has_table_privilege('recommendation_admission_runtime', 'public.product_fact_current', 'SELECT')
     or has_table_privilege('recommendation_admission_runtime', 'public.product_fact_instances', 'SELECT')
     or has_table_privilege('recommendation_admission_runtime', 'public.product_fact_evidence_links', 'SELECT')
     or has_table_privilege('recommendation_admission_runtime', 'public.product_evidence_records', 'SELECT') then
    raise exception 'TRUST_P3_RUNTIME_RAW_SELECT_FORBIDDEN';
  end if;

  if not has_function_privilege(
    'recommendation_admission_runtime',
    'public.read_product_evidence_presentation_authority_v1(uuid)',
    'EXECUTE'
  ) then
    raise exception 'TRUST_P3_RUNTIME_RPC_EXECUTE_REQUIRED';
  end if;
end
$$;

commit;
