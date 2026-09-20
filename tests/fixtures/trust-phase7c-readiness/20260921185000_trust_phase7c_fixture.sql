-- TRUST Phase 7-C isolated fixture extension.
-- Converts the existing Phase 3 product into a Phase 7-B-shaped legacy variant
-- and adds one NULL-market legacy Subject. No governed Product Fact values are
-- created by this fixture.

create or replace function public.admin_require_product_review_actor(
  p_actor_user_id uuid,
  p_required_capability text default 'admin.products.review'
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_role text;
begin
  select role into v_actor_role
  from public.admin_memberships
  where user_id=p_actor_user_id and is_active=true
  limit 1;

  if v_actor_role is null then
    raise exception 'admin_product_review_access_required' using errcode='42501';
  end if;
  if not (btrim(coalesce(p_required_capability,'')) = any(public.admin_role_capabilities(v_actor_role))) then
    raise exception 'admin_product_review_capability_required' using errcode='42501';
  end if;
  return v_actor_role;
end;
$$;

revoke all on function public.admin_require_product_review_actor(uuid,text)
  from public, anon, authenticated;
grant execute on function public.admin_require_product_review_actor(uuid,text)
  to service_role;

insert into auth.users (
  id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,is_sso_user,is_anonymous
) values (
  'a7000000-0000-4000-8000-000000000001',
  'authenticated','authenticated','phase7c-owner@example.test',
  '{}'::jsonb,'{}'::jsonb,now(),now(),false,false
);

select public.bootstrap_first_admin_owner('a7000000-0000-4000-8000-000000000001'::uuid);

-- Existing Phase 3 product becomes a legacy exact variant-scoped Subject.
update public.product_fact_subjects
set variant_key='fixture-legacy-variant',
    formulation_revision_key='fixture-legacy-formulation-v1'
where subject_id='30000000-0000-4000-8000-000000000009';

update public.catalog_trust_intake
set catalog_revision='legacy-backfill-v1:' || repeat('9',64),
    identity_state='EXACT_SUBJECT_FOUND',
    trust_state='RESEARCH_PENDING',
    subject_id='30000000-0000-4000-8000-000000000009',
    market='KR',
    identity_resolution_version='trust-phase7b-legacy-materialization-v1',
    identity_resolution_detail=jsonb_build_object(
      'materializer_version','trust-phase7b-legacy-materialization-v1',
      'projected_identity_state','EXISTING_GOVERNED_SUBJECT',
      'subject_id','30000000-0000-4000-8000-000000000009',
      'market','KR',
      'variant_key','fixture-legacy-variant',
      'formulation_revision_key','fixture-legacy-formulation-v1',
      'market_inferred',false
    ),
    updated_at=now()
where product_id='10000000-0000-4000-8000-000000000009';

-- Keep one research task pending; mark the other two covered so claim assertions
-- are single-task and deterministic.
with ranked as (
  select id,row_number() over(order by fact_key) rn
  from public.product_fact_research_tasks
  where product_id='10000000-0000-4000-8000-000000000009'
)
update public.product_fact_research_tasks t
set state=case when r.rn=1 then 'RESEARCH_PENDING' else 'ALREADY_COVERED' end,
    blocker_code=null,blocker_detail=null,next_retry_at=null,updated_at=now()
from ranked r
where t.id=r.id;

-- Add a third-party binding. The old fixture_official binding remains present
-- too, but neither has a Phase 7-C reviewed bridge and therefore neither may
-- make the legacy task READY.
insert into public.product_source_bindings(
  binding_id,product_id,source_name,external_type,external_id,source_url,
  market_code,locale,binding_state,binding_method,product_scope_state
) values (
  '7c000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000009',
  'hwahae','goods','phase7c-hwahae-9',
  'https://third-party.example.test/phase7c/product-9','KR','ko-KR',
  'resolved','manual_fixture','product'
);

-- NULL-market exact legacy Subject.
insert into public.products(id,name,brand,category) values (
  '1c000000-0000-4000-8000-000000000010',
  'Phase7C Null Market Sunscreen','Fixture','sunscreen'
);
insert into public.product_fact_subjects(
  subject_id,product_id,identity_status,current_state,market_applicability,
  variant_key,formulation_revision_key
) values (
  '3c000000-0000-4000-8000-000000000010',
  '1c000000-0000-4000-8000-000000000010',
  'resolved','current',null,'fixture-global-variant','fixture-global-formulation-v1'
);
insert into public.catalog_trust_intake(
  id,product_id,source_candidate_id,catalog_revision,category,market,subject_id,
  identity_state,trust_state,required_fact_policy_version,identity_resolution_version,
  identity_resolution_detail,created_at,started_at,last_checked_at,updated_at
) values (
  '4c000000-0000-4000-8000-000000000010',
  '1c000000-0000-4000-8000-000000000010',
  null,'legacy-backfill-v1:' || repeat('a',64),'sunscreen',null,
  '3c000000-0000-4000-8000-000000000010',
  'EXACT_SUBJECT_FOUND','RESEARCH_PENDING','product-fact-required-policy-v1',
  'trust-phase7b-legacy-materialization-v1',
  jsonb_build_object(
    'materializer_version','trust-phase7b-legacy-materialization-v1',
    'projected_identity_state','EXISTING_GOVERNED_SUBJECT',
    'subject_id','3c000000-0000-4000-8000-000000000010',
    'market',null,
    'variant_key','fixture-global-variant',
    'formulation_revision_key','fixture-global-formulation-v1',
    'market_inferred',false
  ),
  now(),now(),now(),now()
);
insert into public.product_fact_research_tasks(
  id,intake_id,product_id,subject_id,fact_key,registry_version,research_policy_version,
  state,priority,attempt_count,created_at,updated_at
) values (
  '5c000000-0000-4000-8000-000000000010',
  '4c000000-0000-4000-8000-000000000010',
  '1c000000-0000-4000-8000-000000000010',
  '3c000000-0000-4000-8000-000000000010',
  'uv_filter_type','product-fact-registry-cross-category-v1',
  'product-fact-required-policy-v1','RESEARCH_PENDING',110,0,now(),now()
);

-- Non-legacy variant task proves Phase 3 behavior remains unchanged.
insert into public.products(id,name,brand,category) values (
  '1c000000-0000-4000-8000-000000000011',
  'Phase7C Nonlegacy Variant Sunscreen','Fixture','sunscreen'
);
insert into public.product_fact_subjects(
  subject_id,product_id,identity_status,current_state,market_applicability,
  variant_key,formulation_revision_key
) values (
  '3c000000-0000-4000-8000-000000000011',
  '1c000000-0000-4000-8000-000000000011',
  'resolved','current','KR','nonlegacy-variant','nonlegacy-formulation-v1'
);
insert into public.catalog_trust_intake(
  id,product_id,catalog_revision,category,market,subject_id,identity_state,trust_state,
  required_fact_policy_version,identity_resolution_version,identity_resolution_detail,
  created_at,started_at,last_checked_at,updated_at
) values (
  '4c000000-0000-4000-8000-000000000011',
  '1c000000-0000-4000-8000-000000000011',
  'phase7c-nonlegacy-fixture-v1','sunscreen','KR',
  '3c000000-0000-4000-8000-000000000011',
  'EXACT_SUBJECT_FOUND','RESEARCH_PENDING','product-fact-required-policy-v1',
  'trust-subject-resolution-v1','{}'::jsonb,now(),now(),now(),now()
);
insert into public.product_fact_research_tasks(
  id,intake_id,product_id,subject_id,fact_key,registry_version,research_policy_version,
  state,priority,attempt_count,created_at,updated_at
) values (
  '5c000000-0000-4000-8000-000000000011',
  '4c000000-0000-4000-8000-000000000011',
  '1c000000-0000-4000-8000-000000000011',
  '3c000000-0000-4000-8000-000000000011',
  'uv_filter_type','product-fact-registry-cross-category-v1',
  'product-fact-required-policy-v1','RESEARCH_PENDING',110,0,now(),now()
);
insert into public.product_source_bindings(
  binding_id,product_id,source_name,external_type,external_id,source_url,
  market_code,locale,binding_state,binding_method,product_scope_state
) values (
  '7c000000-0000-4000-8000-000000000011',
  '1c000000-0000-4000-8000-000000000011',
  'nonlegacy_official','official_product','nonlegacy-11',
  'https://official.example.test/nonlegacy/11','KR','ko-KR',
  'resolved','manual_fixture','product'
);
