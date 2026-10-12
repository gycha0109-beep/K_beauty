begin;
-- Append-only cron execution observations; this is separate from product fact/history authority.
create table public.automatic_product_evidence_run_events_v1 (
  event_id bigint generated always as identity primary key,
  run_id uuid not null,
  event_kind text not null check (event_kind in ('started','success','failure')),
  contract_version text not null check (contract_version = 'automatic-evidence-run-health-v1'),
  recorded_at timestamptz not null default now(),
  checked_count integer not null default 0 check (checked_count between 0 and 1),
  inserted_count integer not null default 0 check (inserted_count between 0 and 1),
  duplicate_count integer not null default 0 check (duplicate_count between 0 and 1),
  exception_count integer not null default 0 check (exception_count between 0 and 1),
  failed_count integer not null default 0 check (failed_count between 0 and 1),
  error_code text check (error_code in (
    'AUTO_EVIDENCE_EVALUATION_FAILED','AUTO_EVIDENCE_UNHANDLED'
  )),
  constraint automatic_evidence_run_unique_event_v1 unique (run_id,event_kind),
  constraint automatic_evidence_run_counts_v1 check (
    (
      event_kind='started' and checked_count=0 and inserted_count=0
      and duplicate_count=0 and exception_count=0 and failed_count=0
      and error_code is null
    ) or (
      event_kind='success' and checked_count=1 and failed_count=0
      and inserted_count + duplicate_count=checked_count
      and error_code is null
    ) or (
      event_kind='failure' and
      ((checked_count=1 and failed_count=1 and
        inserted_count+duplicate_count=0) or
       (checked_count=0 and failed_count=0 and
        inserted_count=0 and duplicate_count=0 and exception_count=0))
      and error_code is not null
    )
  )
);
create unique index automatic_evidence_run_single_completion_v1
  on public.automatic_product_evidence_run_events_v1(run_id)
  where event_kind in ('success','failure');
create index automatic_evidence_run_events_recent_v1
  on public.automatic_product_evidence_run_events_v1(event_id desc);

alter table public.automatic_product_evidence_run_events_v1 enable row level security;
alter table public.automatic_product_evidence_run_events_v1 force row level security;
revoke all on public.automatic_product_evidence_run_events_v1
  from public, anon, authenticated, service_role;
grant select, insert on public.automatic_product_evidence_run_events_v1 to service_role;
grant usage, select on sequence public.automatic_product_evidence_run_events_v1_event_id_seq
  to service_role;
create policy automatic_evidence_run_service_read_v1
  on public.automatic_product_evidence_run_events_v1
  for select to service_role using (true);
create policy automatic_evidence_run_service_append_v1
  on public.automatic_product_evidence_run_events_v1
  for insert to service_role with check (true);

do $acl$ begin
  if has_table_privilege('anon','public.automatic_product_evidence_run_events_v1','SELECT')
    or has_table_privilege('authenticated','public.automatic_product_evidence_run_events_v1','INSERT')
    or has_table_privilege('service_role','public.automatic_product_evidence_run_events_v1','UPDATE')
    or has_table_privilege('service_role','public.automatic_product_evidence_run_events_v1','DELETE')
    or not has_table_privilege('service_role','public.automatic_product_evidence_run_events_v1','SELECT')
    or not has_table_privilege('service_role','public.automatic_product_evidence_run_events_v1','INSERT')
  then raise exception 'automatic_evidence_run_events_acl_invalid' using errcode='55000';end if;
end $acl$;
commit;
