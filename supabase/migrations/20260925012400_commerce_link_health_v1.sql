begin;

alter table public.product_offers
  add column if not exists link_health_state text not null default 'unchecked',
  add column if not exists link_health_checked_at timestamptz,
  add column if not exists link_health_failure_streak integer not null default 0,
  add column if not exists link_health_reason text,
  add column if not exists link_health_last_check_id uuid;

alter table public.product_offers
  drop constraint if exists product_offers_link_health_state_check,
  add constraint product_offers_link_health_state_check
    check (link_health_state in ('unchecked', 'healthy', 'unknown', 'suspect', 'broken')),
  drop constraint if exists product_offers_link_health_failure_streak_check,
  add constraint product_offers_link_health_failure_streak_check
    check (link_health_failure_streak >= 0);

create table if not exists public.product_offer_link_checks (
  check_id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.product_offers(offer_id) on delete restrict,
  request_id text not null unique,
  checked_at timestamptz not null,
  requested_url text not null,
  final_url text,
  http_status integer,
  result_class text not null,
  observed_health_state text not null,
  redirect_count integer not null default 0,
  content_type text,
  reason text not null,
  body_bytes integer not null default 0,
  checker_version text not null,
  created_at timestamptz not null default now(),
  constraint product_offer_link_checks_request_id_check
    check (char_length(btrim(request_id)) between 1 and 160),
  constraint product_offer_link_checks_requested_url_check
    check (char_length(btrim(requested_url)) between 1 and 2048),
  constraint product_offer_link_checks_final_url_check
    check (final_url is null or char_length(btrim(final_url)) between 1 and 2048),
  constraint product_offer_link_checks_http_status_check
    check (http_status is null or http_status between 100 and 599),
  constraint product_offer_link_checks_result_class_check
    check (result_class in (
      'healthy',
      'redirected_same_listing',
      'hard_not_found',
      'soft_not_found',
      'identity_drift',
      'unsafe_redirect',
      'unsafe_url',
      'forbidden',
      'rate_limited',
      'network_error',
      'unexpected_http',
      'unsupported_content',
      'unsupported_response',
      'ambiguous_200'
    )),
  constraint product_offer_link_checks_observed_health_state_check
    check (observed_health_state in ('healthy', 'unknown', 'suspect')),
  constraint product_offer_link_checks_redirect_count_check
    check (redirect_count between 0 and 3),
  constraint product_offer_link_checks_content_type_check
    check (content_type is null or char_length(btrim(content_type)) <= 160),
  constraint product_offer_link_checks_reason_check
    check (char_length(btrim(reason)) between 1 and 160),
  constraint product_offer_link_checks_body_bytes_check
    check (body_bytes between 0 and 1048576),
  constraint product_offer_link_checks_checker_version_check
    check (char_length(btrim(checker_version)) between 1 and 80)
);

create index if not exists product_offer_link_checks_offer_checked_idx
  on public.product_offer_link_checks(offer_id, checked_at desc, check_id);

alter table public.product_offers
  drop constraint if exists product_offers_link_health_last_check_fk,
  add constraint product_offers_link_health_last_check_fk
    foreign key (link_health_last_check_id)
    references public.product_offer_link_checks(check_id)
    on delete restrict;

alter table public.product_offer_link_checks enable row level security;

revoke all on table public.product_offer_link_checks
  from public, anon, authenticated, service_role;

create schema if not exists private;

do $$
begin
  if not exists (
    select 1 from pg_roles where rolname = 'product_offer_link_health_recorder_owner'
  ) then
    create role product_offer_link_health_recorder_owner
      nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
  else
    alter role product_offer_link_health_recorder_owner
      nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
  end if;
end
$$;

grant usage on schema public to product_offer_link_health_recorder_owner;
grant usage on schema private to product_offer_link_health_recorder_owner;
grant select (
  offer_id,
  listing_url,
  link_health_state,
  link_health_failure_streak
) on public.product_offers
  to product_offer_link_health_recorder_owner;
grant update (
  link_health_state,
  link_health_checked_at,
  link_health_failure_streak,
  link_health_reason,
  link_health_last_check_id
) on public.product_offers
  to product_offer_link_health_recorder_owner;
grant select, insert on public.product_offer_link_checks
  to product_offer_link_health_recorder_owner;

drop policy if exists commerce_link_health_recorder_offer_select_v1
  on public.product_offers;
create policy commerce_link_health_recorder_offer_select_v1
  on public.product_offers
  for select
  to product_offer_link_health_recorder_owner
  using (true);

drop policy if exists commerce_link_health_recorder_offer_update_v1
  on public.product_offers;
create policy commerce_link_health_recorder_offer_update_v1
  on public.product_offers
  for update
  to product_offer_link_health_recorder_owner
  using (true)
  with check (true);

drop policy if exists commerce_link_health_recorder_check_select_v1
  on public.product_offer_link_checks;
create policy commerce_link_health_recorder_check_select_v1
  on public.product_offer_link_checks
  for select
  to product_offer_link_health_recorder_owner
  using (true);

drop policy if exists commerce_link_health_recorder_check_insert_v1
  on public.product_offer_link_checks;
create policy commerce_link_health_recorder_check_insert_v1
  on public.product_offer_link_checks
  for insert
  to product_offer_link_health_recorder_owner
  with check (true);

create or replace function private.record_product_offer_link_check_v1(
  p_offer_id uuid,
  p_request_id text,
  p_checked_at timestamptz,
  p_requested_url text,
  p_final_url text,
  p_http_status integer,
  p_result_class text,
  p_redirect_count integer,
  p_content_type text,
  p_reason text,
  p_body_bytes integer,
  p_checker_version text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_offer public.product_offers%rowtype;
  v_existing public.product_offer_link_checks%rowtype;
  v_check_id uuid;
  v_observed_health_state text;
  v_next_state text;
  v_next_streak integer;
  v_hard_failure boolean;
  v_healthy boolean;
begin
  if p_offer_id is null then
    raise exception 'COMMERCE_LINK_HEALTH_OFFER_REQUIRED';
  end if;
  if p_request_id is null or char_length(btrim(p_request_id)) not between 1 and 160 then
    raise exception 'COMMERCE_LINK_HEALTH_REQUEST_ID_INVALID';
  end if;
  if p_checked_at is null or p_checked_at > now() + interval '5 minutes' then
    raise exception 'COMMERCE_LINK_HEALTH_CHECKED_AT_INVALID';
  end if;
  if p_requested_url is null or char_length(btrim(p_requested_url)) not between 1 and 2048 then
    raise exception 'COMMERCE_LINK_HEALTH_REQUESTED_URL_INVALID';
  end if;
  if p_final_url is not null and char_length(btrim(p_final_url)) not between 1 and 2048 then
    raise exception 'COMMERCE_LINK_HEALTH_FINAL_URL_INVALID';
  end if;
  if p_http_status is not null and (p_http_status < 100 or p_http_status > 599) then
    raise exception 'COMMERCE_LINK_HEALTH_HTTP_STATUS_INVALID';
  end if;
  if p_redirect_count is null or p_redirect_count < 0 or p_redirect_count > 3 then
    raise exception 'COMMERCE_LINK_HEALTH_REDIRECT_COUNT_INVALID';
  end if;
  if p_body_bytes is null or p_body_bytes < 0 or p_body_bytes > 1048576 then
    raise exception 'COMMERCE_LINK_HEALTH_BODY_BYTES_INVALID';
  end if;
  if p_reason is null or char_length(btrim(p_reason)) not between 1 and 160 then
    raise exception 'COMMERCE_LINK_HEALTH_REASON_INVALID';
  end if;
  if p_checker_version <> 'commerce-link-health-checker-v1' then
    raise exception 'COMMERCE_LINK_HEALTH_CHECKER_VERSION_INVALID';
  end if;

  v_healthy := p_result_class in ('healthy', 'redirected_same_listing');
  v_hard_failure := p_result_class in (
    'hard_not_found',
    'soft_not_found',
    'identity_drift',
    'unsafe_redirect',
    'unsafe_url'
  );

  if not v_healthy
     and not v_hard_failure
     and p_result_class not in (
       'forbidden',
       'rate_limited',
       'network_error',
       'unexpected_http',
       'unsupported_content',
       'unsupported_response',
       'ambiguous_200'
     ) then
    raise exception 'COMMERCE_LINK_HEALTH_RESULT_CLASS_INVALID';
  end if;

  if v_healthy then
    v_observed_health_state := 'healthy';
  elsif v_hard_failure then
    v_observed_health_state := 'suspect';
  else
    v_observed_health_state := 'unknown';
  end if;

  select *
    into v_existing
  from public.product_offer_link_checks
  where request_id = btrim(p_request_id);

  if found then
    if v_existing.offer_id is distinct from p_offer_id
       or v_existing.checked_at is distinct from p_checked_at
       or v_existing.requested_url is distinct from btrim(p_requested_url)
       or v_existing.final_url is distinct from nullif(btrim(coalesce(p_final_url, '')), '')
       or v_existing.http_status is distinct from p_http_status
       or v_existing.result_class is distinct from p_result_class
       or v_existing.redirect_count is distinct from p_redirect_count
       or v_existing.content_type is distinct from nullif(btrim(coalesce(p_content_type, '')), '')
       or v_existing.reason is distinct from btrim(p_reason)
       or v_existing.body_bytes is distinct from p_body_bytes
       or v_existing.checker_version is distinct from p_checker_version then
      raise exception 'COMMERCE_LINK_HEALTH_REQUEST_ID_CONFLICT';
    end if;

    select *
      into v_offer
    from public.product_offers
    where offer_id = p_offer_id;

    return jsonb_build_object(
      'contract_version', 'product-offer-link-health-record-v1',
      'inserted', false,
      'check_id', v_existing.check_id,
      'offer_id', p_offer_id,
      'link_health_state', v_offer.link_health_state,
      'link_health_failure_streak', v_offer.link_health_failure_streak
    );
  end if;

  select *
    into v_offer
  from public.product_offers
  where offer_id = p_offer_id
  for update;

  if not found then
    raise exception 'COMMERCE_LINK_HEALTH_OFFER_NOT_FOUND';
  end if;

  if v_offer.listing_url <> btrim(p_requested_url) then
    raise exception 'COMMERCE_LINK_HEALTH_STALE_CHECK';
  end if;

  if v_healthy then
    v_next_state := 'healthy';
    v_next_streak := 0;
  elsif v_hard_failure then
    v_next_streak := v_offer.link_health_failure_streak + 1;
    v_next_state := case when v_next_streak >= 2 then 'broken' else 'suspect' end;
  else
    v_next_streak := v_offer.link_health_failure_streak;
    v_next_state := case
      when v_offer.link_health_state in ('suspect', 'broken') then v_offer.link_health_state
      else 'unknown'
    end;
  end if;

  insert into public.product_offer_link_checks (
    offer_id,
    request_id,
    checked_at,
    requested_url,
    final_url,
    http_status,
    result_class,
    observed_health_state,
    redirect_count,
    content_type,
    reason,
    body_bytes,
    checker_version
  )
  values (
    p_offer_id,
    btrim(p_request_id),
    p_checked_at,
    btrim(p_requested_url),
    nullif(btrim(coalesce(p_final_url, '')), ''),
    p_http_status,
    p_result_class,
    v_observed_health_state,
    p_redirect_count,
    nullif(btrim(coalesce(p_content_type, '')), ''),
    btrim(p_reason),
    p_body_bytes,
    p_checker_version
  )
  returning check_id into v_check_id;

  update public.product_offers
  set link_health_state = v_next_state,
      link_health_checked_at = p_checked_at,
      link_health_failure_streak = v_next_streak,
      link_health_reason = btrim(p_reason),
      link_health_last_check_id = v_check_id
  where offer_id = p_offer_id;

  return jsonb_build_object(
    'contract_version', 'product-offer-link-health-record-v1',
    'inserted', true,
    'check_id', v_check_id,
    'offer_id', p_offer_id,
    'observed_health_state', v_observed_health_state,
    'link_health_state', v_next_state,
    'link_health_failure_streak', v_next_streak
  );
end;
$$;

revoke all on function private.record_product_offer_link_check_v1(
  uuid, text, timestamptz, text, text, integer, text, integer, text, text, integer, text
) from public, anon, authenticated, service_role;

comment on function private.record_product_offer_link_check_v1(
  uuid, text, timestamptz, text, text, integer, text, integer, text, text, integer, text
) is
  'Records one idempotent commerce link observation and updates only the current link-health projection. It rejects stale listing URLs and does not mutate Product Fact or recommendation authority.';

grant create on schema private to product_offer_link_health_recorder_owner;
grant product_offer_link_health_recorder_owner to postgres;
alter function private.record_product_offer_link_check_v1(
  uuid, text, timestamptz, text, text, integer, text, integer, text, text, integer, text
) owner to product_offer_link_health_recorder_owner;
revoke create on schema private from product_offer_link_health_recorder_owner;

grant usage on schema private to service_role;
grant execute on function private.record_product_offer_link_check_v1(
  uuid, text, timestamptz, text, text, integer, text, integer, text, text, integer, text
) to service_role;
revoke product_offer_link_health_recorder_owner from postgres;

comment on table public.product_offer_link_checks is
  'Append-only controlled observations of seller listing URL health. These observations do not establish Product Fact, recommendation, price, inventory, or Product identity authority.';
comment on column public.product_offers.link_health_state is
  'Current commerce-link presentation health projection. unknown is not broken; broken requires repeated hard failure.';
commit;
