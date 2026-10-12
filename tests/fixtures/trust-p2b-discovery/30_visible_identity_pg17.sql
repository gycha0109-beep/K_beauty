begin;
insert into public.products(id) values('4608b3b4-8b51-4464-b46e-380b05c1a3d7');
insert into public.catalog_trust_intake(id,product_id) values(
'0b5963bb-67d6-4738-a620-32ec86c1e3d0',
'4608b3b4-8b51-4464-b46e-380b05c1a3d7');
set role service_role;
insert into public.trust_official_discovery_observations_v1(
 product_id,intake_id,observation_fingerprint,source_origin,candidate_locator,
 content_digest,observation_kind,disposition,identity_surface,contract_version
) values (
'4608b3b4-8b51-4464-b46e-380b05c1a3d7','0b5963bb-67d6-4738-a620-32ec86c1e3d0',
repeat('c',64),'https://brand.example.test','https://brand.example.test/goods/goods_view.php?goodsNo=15',
repeat('e',64),'page_candidate','SCOPED_HEADING_CANDIDATE','product_heading',
'trust-p2b-official-discovery-observation-v1'),
(
'4608b3b4-8b51-4464-b46e-380b05c1a3d7','0b5963bb-67d6-4738-a620-32ec86c1e3d0',
repeat('d',64),'https://brand.example.test','https://brand.example.test/goods/goods_view.php?goodsNo=16',
repeat('e',64),'page_candidate','BODY_NAME_MENTION_ONLY','visible_body_mention',
'trust-p2b-official-discovery-observation-v1');
do $test$ begin
  if (select count(*) from public.trust_official_discovery_observations_v1)<>2
    then raise exception 'TRUST_P2C_NEW_DISPOSITIONS_NOT_STORED';end if;
  begin
    insert into public.trust_official_discovery_observations_v1(
      product_id,intake_id,observation_fingerprint,source_origin,candidate_locator,
      observation_kind,disposition,identity_surface,contract_version
    )values(
      '4608b3b4-8b51-4464-b46e-380b05c1a3d7',
      '0b5963bb-67d6-4738-a620-32ec86c1e3d0',repeat('f',64),
      'https://brand.example.test','https://brand.example.test/goods/goods_view.php?goodsNo=17',
      'page_candidate','BODY_NAME_MENTION_ONLY','product_heading',
      'trust-p2b-official-discovery-observation-v1');
    raise exception 'TRUST_P2C_FALSE_SURFACE_ACCEPTED';
  exception when check_violation then null; end;
  begin
    update public.trust_official_discovery_observations_v1 set
      identity_surface='page_title';
    raise exception 'TRUST_P2C_UPDATE_GRANTED';
  exception when insufficient_privilege then null; end;
end $test$;
reset role;
rollback;
select case when
 (select count(*) from public.trust_official_discovery_observations_v1)=0
 then 'TRUST_P2C_VISIBLE_IDENTITY_PG17_ROLLBACK_PASS'
 else 'FAIL' end as result;
