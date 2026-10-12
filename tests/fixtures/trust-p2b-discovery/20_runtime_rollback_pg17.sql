begin;
insert into public.products(id) values('4608b3b4-8b51-4464-b46e-380b05c1a3d7');
insert into public.catalog_trust_intake(id,product_id) values(
'0b5963bb-67d6-4738-a620-32ec86c1e3d0',
'4608b3b4-8b51-4464-b46e-380b05c1a3d7');
do $rights$ begin
 if has_table_privilege('anon','public.trust_official_discovery_observations_v1','SELECT')
 or has_table_privilege('authenticated','public.trust_official_discovery_observations_v1','INSERT')
 or has_table_privilege('service_role','public.trust_official_discovery_observations_v1','UPDATE')
 or has_table_privilege('service_role','public.trust_official_discovery_observations_v1','DELETE')
 or not has_table_privilege('service_role','public.trust_official_discovery_observations_v1','SELECT')
 or not has_table_privilege('service_role','public.trust_official_discovery_observations_v1','INSERT')
 then raise exception 'TRUST_P2B_ACL_TEST_FAIL';end if;
end $rights$;
set role service_role;
insert into public.trust_official_discovery_observations_v1(
 product_id,intake_id,observation_fingerprint,source_origin,
 observation_kind,disposition,contract_version)
values('4608b3b4-8b51-4464-b46e-380b05c1a3d7',
'0b5963bb-67d6-4738-a620-32ec86c1e3d0',repeat('a',64),
'https://brand.example.test','site_disposition','ROBOTS_UNAVAILABLE',
'trust-p2b-official-discovery-observation-v1');
do $test$ begin
 begin
  insert into public.trust_official_discovery_observations_v1(
    product_id,intake_id,observation_fingerprint,source_origin,
    observation_kind,disposition,contract_version)
  values('4608b3b4-8b51-4464-b46e-380b05c1a3d7',
    '0b5963bb-67d6-4738-a620-32ec86c1e3d0',
    repeat('a',64),'https://brand.example.test','site_disposition',
    'ROBOTS_UNAVAILABLE','trust-p2b-official-discovery-observation-v1');
  raise exception 'TRUST_P2B_DUPLICATE_ACCEPTED';
 exception when unique_violation then null;
 end;
 begin
  update public.trust_official_discovery_observations_v1
    set disposition='NO_SAFE_CANDIDATE';
  raise exception 'TRUST_P2B_UPDATE_ACCEPTED';
 exception when insufficient_privilege then null;
 end;
 begin
  delete from public.trust_official_discovery_observations_v1;
  raise exception 'TRUST_P2B_DELETE_ACCEPTED';
 exception when insufficient_privilege then null;
 end;
 begin
  insert into public.trust_official_discovery_observations_v1(
    product_id,intake_id,observation_fingerprint,source_origin,
    observation_kind,disposition,contract_version)
  values('4608b3b4-8b51-4464-b46e-380b05c1a3d7',
    '0b5963bb-67d6-4738-a620-32ec86c1e3d0',repeat('b',64),
    'https://brand.example.test','site_disposition',
    'STRUCTURED_NAME_CANDIDATE','trust-p2b-official-discovery-observation-v1');
  raise exception 'TRUST_P2B_SITE_ROLE_MISMATCH_ACCEPTED';
 exception when check_violation then null;
 end;
 if (select count(*) from public.trust_official_discovery_observations_v1)<>1
 then raise exception 'TRUST_P2B_COUNT_INCORRECT';end if;
end $test$;
reset role;
rollback;
select case when
 (select count(*) from public.trust_official_discovery_observations_v1)=0
 then 'TRUST_P2B_OBSERVATIONS_PG17_ROLLBACK_PASS'
 else 'FAIL' end as result;
