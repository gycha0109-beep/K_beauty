begin;

-- V2.1-8H-R11B repair: preserve nested admin identity authority across
-- process_catalog_trust_product_v3 reconciliation and restore the two READY3
-- registrations affected before this fix. Product Fact / Recommendation state
-- is intentionally untouched.

do $$
begin
  if to_regprocedure('public.process_catalog_trust_product_v2(uuid,text)') is null
    or to_regclass('public.catalog_trust_intake') is null
    or to_regclass('public.product_fact_subjects') is null
  then
    raise exception 'v21_8h_r11b_identity_authority_preservation_prerequisite_missing';
  end if;
end $$;

create or replace function public.process_catalog_trust_product_v3(
  p_product_id uuid,
  p_registry_version text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
  v_row record;
  v_preserved integer := 0;
begin
  create temporary table if not exists pg_temp.v21_8g1_identity_authority_snapshot (
    intake_id uuid primary key,
    authority jsonb not null
  ) on commit drop;

  truncate table pg_temp.v21_8g1_identity_authority_snapshot;

  insert into pg_temp.v21_8g1_identity_authority_snapshot(intake_id, authority)
  with authority_candidates as (
    select
      i.id as intake_id,
      i.market as intake_market,
      case
        when jsonb_typeof(i.identity_resolution_detail -> 'identity_authority') = 'object'
          then i.identity_resolution_detail -> 'identity_authority'
        when i.identity_resolution_detail ->> 'authority_kind' = 'admin_identity_authority'
          then jsonb_strip_nulls(
            jsonb_build_object(
              'authority_kind', i.identity_resolution_detail ->> 'authority_kind',
              'official_source_locator', i.identity_resolution_detail ->> 'official_source_locator',
              'source_content_digest', i.identity_resolution_detail ->> 'source_content_digest',
              'resolution_reason', i.identity_resolution_detail ->> 'resolution_reason',
              'market', i.identity_resolution_detail ->> 'market',
              'authority_resolution_version',
                coalesce(
                  i.identity_resolution_detail ->> 'authority_resolution_version',
                  i.identity_resolution_version
                )
            )
          )
        else null
      end as authority
    from public.catalog_trust_intake i
    where i.product_id = p_product_id
  )
  select
    c.intake_id,
    c.authority
  from authority_candidates c
  where c.authority is not null
    and c.authority ->> 'authority_kind' = 'admin_identity_authority'
    and coalesce(c.authority ->> 'market','') = coalesce(c.intake_market,'')
    and coalesce(c.authority ->> 'official_source_locator','') ~ '^https://'
    and coalesce(c.authority ->> 'source_content_digest','') ~ '^[0-9a-f]{64}$'
    and coalesce(c.authority ->> 'authority_resolution_version','') <> '';

  v_result := public.process_catalog_trust_product_v2(
    p_product_id,
    p_registry_version
  );

  for v_row in
    select * from pg_temp.v21_8g1_identity_authority_snapshot
  loop
    update public.catalog_trust_intake
    set identity_resolution_detail =
          coalesce(identity_resolution_detail,'{}'::jsonb)
          || jsonb_build_object('identity_authority', v_row.authority),
        updated_at = now()
    where id = v_row.intake_id;

    if found then
      v_preserved := v_preserved + 1;
    end if;
  end loop;

  return v_result || jsonb_build_object(
    'orchestrator_version','v21-8g1-identity-authority-preserving-v1',
    'identity_authority_preserved',v_preserved
  );
end;
$$;

revoke all on function public.process_catalog_trust_product_v3(uuid,text)
  from public, anon, authenticated, service_role;
grant execute on function public.process_catalog_trust_product_v3(uuid,text)
  to service_role;

comment on function public.process_catalog_trust_product_v3(uuid,text) is
  'V2.1-8H-R11B fixed service-role wrapper around explicit-registry process_catalog_trust_product_v2. Preserves nested admin identity_authority and legacy root authority after Subject reconciliation.';

-- Recover only the two READY3 intakes that were registered before the nested
-- authority preservation fix. Each row is guarded by the frozen R10 Subject
-- semantic/formulation identity so unrelated Production rows cannot match.
with repair(
  intake_id,
  product_id,
  subject_semantic_key,
  formulation_revision_key,
  official_source_locator,
  source_content_digest
) as (
  values
    (
      '18d3e025-7325-4a53-b8ab-6f0c88b86e6c'::uuid,
      '06d1ad4b-2291-4b73-8bf4-f1f3c0226fea'::uuid,
      '9d756f9088eae3572db9d75eb3f654424db7ac01cbb0b6b4d3ada389dc3bf9d6',
      'v21-8h-r10:e769b508ecdcf0f6f652a00da3434867364ef5d04cc627c9bec65163b641e4de',
      'https://www.theharnay.com/',
      'e769b508ecdcf0f6f652a00da3434867364ef5d04cc627c9bec65163b641e4de'
    ),
    (
      'a35898bb-832e-4444-b4f7-98de3f9c78bc'::uuid,
      'b1f6b527-679f-48f3-9b58-5d28ec095f2f'::uuid,
      '028945101121562f1f5470a44fd1a7974477a7c8a50cd6954102993fb087650d',
      'v21-8h-r10:a8a01568cf96737549c033542599a2d94e843367d0c876774262f0b409125327',
      'https://www.amoremall.com/kr/ko/product/detail?onlineProdCode=110090000335&onlineProdSn=60162',
      'a8a01568cf96737549c033542599a2d94e843367d0c876774262f0b409125327'
    )
)
update public.catalog_trust_intake i
set identity_resolution_detail =
      coalesce(i.identity_resolution_detail,'{}'::jsonb)
      || jsonb_build_object(
        'identity_authority',
        jsonb_build_object(
          'authority_kind','admin_identity_authority',
          'market','KR',
          'official_source_locator',r.official_source_locator,
          'source_content_digest',r.source_content_digest,
          'authority_resolution_version','v21-8h-r10-official-identity-v1',
          'resolution_reason','R11 controlled registration from frozen R10 READY3 identity authority'
        )
      ),
    updated_at = now()
from repair r
where i.id = r.intake_id
  and i.product_id = r.product_id
  and i.source_candidate_id is null
  and i.market = 'KR'
  and i.subject_id is not null
  and i.identity_state = 'EXACT_SUBJECT_FOUND'
  and not (
    coalesce(i.identity_resolution_detail,'{}'::jsonb)
    ? 'identity_authority'
  )
  and exists (
    select 1
    from public.product_fact_subjects s
    where s.subject_id = i.subject_id
      and s.product_id = r.product_id
      and s.subject_semantic_key = r.subject_semantic_key
      and s.formulation_revision_key = r.formulation_revision_key
      and s.variant_key is null
      and s.market_applicability = 'KR'
      and s.identity_status = 'resolved'
      and s.current_state = 'current'
  );

do $$
declare
  v_def text;
begin
  if has_function_privilege(
      'anon',
      'public.process_catalog_trust_product_v3(uuid,text)',
      'EXECUTE'
    )
    or has_function_privilege(
      'authenticated',
      'public.process_catalog_trust_product_v3(uuid,text)',
      'EXECUTE'
    )
    or not has_function_privilege(
      'service_role',
      'public.process_catalog_trust_product_v3(uuid,text)',
      'EXECUTE'
    )
  then
    raise exception 'v21_8h_r11b_process_v3_privilege_invalid';
  end if;

  select pg_get_functiondef(
    'public.process_catalog_trust_product_v3(uuid,text)'::regprocedure
  ) into v_def;

  if position('identity_resolution_detail -> ''identity_authority''' in v_def) = 0
    or position('authority_kind' in v_def) = 0
    or position('official_source_locator' in v_def) = 0
    or position('source_content_digest' in v_def) = 0
    or position('authority_resolution_version' in v_def) = 0
    or position('process_catalog_trust_product_v2' in v_def) = 0
  then
    raise exception 'v21_8h_r11b_process_v3_contract_invalid';
  end if;
end $$;

commit;
