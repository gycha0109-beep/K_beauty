begin;
-- New signals are UNVERIFIED: scoped heading is an identity CANDIDATE,
-- unscoped body mention is diagnostic-only, never Product Fact authority.
alter table public.trust_official_discovery_observations_v1
  drop constraint trust_official_discovery_observations_v1_disposition_check,
  drop constraint trust_official_discovery_observations_v1_identity_surface_check,
  drop constraint trust_discovery_v1_kind_consistent;
alter table public.trust_official_discovery_observations_v1
  add constraint trust_official_discovery_observations_v1_disposition_check
  check(disposition in (
    'ROBOTS_UNAVAILABLE','ROBOTS_DISALLOWED','CRAWL_DELAY_NOT_SUPPORTED',
    'SOURCE_BLOCKED','TRANSIENT_FAILURE','NO_SAFE_CANDIDATE',
    'CANDIDATES_DISCOVERED','STRUCTURED_NAME_CANDIDATE',
    'TITLE_NAME_CANDIDATE','SCOPED_HEADING_CANDIDATE',
    'BODY_NAME_MENTION_ONLY','IDENTITY_UNRESOLVED'
  )),
  add constraint trust_official_discovery_observations_v1_identity_surface_check
  check(identity_surface in (
    'product_jsonld_name','page_title','product_heading','visible_body_mention'
  )),
  add constraint trust_discovery_v1_kind_consistent check (
    (
      observation_kind='site_disposition' and candidate_locator is null
      and identity_surface is null and content_digest is null
      and disposition in (
        'ROBOTS_UNAVAILABLE','ROBOTS_DISALLOWED','CRAWL_DELAY_NOT_SUPPORTED',
        'SOURCE_BLOCKED','TRANSIENT_FAILURE','NO_SAFE_CANDIDATE',
        'CANDIDATES_DISCOVERED'
      )
    ) or (
      observation_kind='page_candidate' and candidate_locator is not null
      and (
        (disposition='STRUCTURED_NAME_CANDIDATE' and identity_surface='product_jsonld_name')
        or (disposition='TITLE_NAME_CANDIDATE' and identity_surface='page_title')
        or (disposition='SCOPED_HEADING_CANDIDATE' and identity_surface='product_heading')
        or (disposition='BODY_NAME_MENTION_ONLY' and identity_surface='visible_body_mention')
        or (disposition in ('IDENTITY_UNRESOLVED','SOURCE_BLOCKED','TRANSIENT_FAILURE')
          and identity_surface is null)
      )
    )
  );
-- Confirm existing canonical grants remain unchanged.
do $acl$ begin
  if has_table_privilege('anon','public.trust_official_discovery_observations_v1','SELECT')
     or has_table_privilege('authenticated','public.trust_official_discovery_observations_v1','INSERT')
     or has_table_privilege('service_role','public.trust_official_discovery_observations_v1','UPDATE')
     or has_table_privilege('service_role','public.trust_official_discovery_observations_v1','DELETE')
     or not (select relrowsecurity and relforcerowsecurity
       from pg_class where oid='public.trust_official_discovery_observations_v1'::regclass)
    then raise exception 'TRUST_P2C_VISIBLE_IDENTITY_LEDGER_ACL_CHANGED'; end if;
end $acl$;
commit;
