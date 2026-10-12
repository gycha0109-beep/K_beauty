begin;

-- An UNVERIFIED discovery ledger. Never functions as a Product Fact or TRUST
-- governed source binding. A digest identifies the same immutable observation.
create table public.trust_official_discovery_observations_v1 (
  observation_id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  intake_id uuid not null references public.catalog_trust_intake(id) on delete restrict,
  observation_fingerprint text not null unique
    check (observation_fingerprint ~ '^[0-9a-f]{64}$'),
  source_origin text not null
    check (source_origin ~ '^https://[A-Za-z0-9.-]+(:443)?$'
      and length(source_origin) between 12 and 255),
  candidate_locator text
    check (candidate_locator is null or
      (candidate_locator like 'https://%' and length(candidate_locator) between 12 and 2048)),
  content_digest text
    check (content_digest is null or content_digest ~ '^[0-9a-f]{64}$'),
  observation_kind text not null
    check (observation_kind in ('site_disposition','page_candidate')),
  disposition text not null check (disposition in (
    'ROBOTS_UNAVAILABLE','ROBOTS_DISALLOWED','CRAWL_DELAY_NOT_SUPPORTED',
    'SOURCE_BLOCKED','TRANSIENT_FAILURE','NO_SAFE_CANDIDATE',
    'CANDIDATES_DISCOVERED','STRUCTURED_NAME_CANDIDATE',
    'TITLE_NAME_CANDIDATE','IDENTITY_UNRESOLVED'
  )),
  identity_surface text check (identity_surface in
    ('product_jsonld_name','page_title')),
  observed_at timestamptz not null default now(),
  contract_version text not null
    check (contract_version='trust-p2b-official-discovery-observation-v1'),
  constraint trust_discovery_v1_kind_consistent check (
    (observation_kind='page_candidate'
      and candidate_locator is not null
      and disposition in ('STRUCTURED_NAME_CANDIDATE',
        'TITLE_NAME_CANDIDATE','IDENTITY_UNRESOLVED','SOURCE_BLOCKED','TRANSIENT_FAILURE'))
    or
    (observation_kind='site_disposition'
      and candidate_locator is null and identity_surface is null
      and content_digest is null
      and disposition in ('ROBOTS_UNAVAILABLE','ROBOTS_DISALLOWED',
        'CRAWL_DELAY_NOT_SUPPORTED','SOURCE_BLOCKED','TRANSIENT_FAILURE',
        'NO_SAFE_CANDIDATE','CANDIDATES_DISCOVERED'))
  )
);
create index trust_discovery_observations_product_recent_v1
  on public.trust_official_discovery_observations_v1
  (product_id,observed_at desc);
alter table public.trust_official_discovery_observations_v1 enable row level security;
alter table public.trust_official_discovery_observations_v1 force row level security;
revoke all on public.trust_official_discovery_observations_v1
  from public,anon,authenticated,service_role;
grant select,insert on public.trust_official_discovery_observations_v1
  to service_role;
create policy trust_discovery_observations_service_read_v1
  on public.trust_official_discovery_observations_v1
  for select to service_role using (true);
create policy trust_discovery_observations_service_insert_v1
  on public.trust_official_discovery_observations_v1
  for insert to service_role with check (true);

do $check$ begin
 if not (select relrowsecurity and relforcerowsecurity from pg_class
    where oid='public.trust_official_discovery_observations_v1'::regclass)
 or has_table_privilege('anon','public.trust_official_discovery_observations_v1','SELECT')
 or has_table_privilege('authenticated','public.trust_official_discovery_observations_v1','INSERT')
 or has_table_privilege('service_role','public.trust_official_discovery_observations_v1','UPDATE')
 or has_table_privilege('service_role','public.trust_official_discovery_observations_v1','DELETE')
 or not has_table_privilege('service_role','public.trust_official_discovery_observations_v1','INSERT')
 then raise exception 'TRUST_DISCOVERY_OBSERVATION_ACL_INVALID';end if;
end $check$;
commit;
