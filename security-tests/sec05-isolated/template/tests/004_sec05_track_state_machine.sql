begin;

select plan(13);

create function pg_temp.make_track_pair(
  p_resource_id text,
  p_result_jti text,
  p_track_jti text,
  p_principal_hash text,
  p_result_fingerprint text,
  p_max_uses integer default 24,
  p_issued_at timestamptz default now(),
  p_expires_at timestamptz default now() + interval '1 hour'
) returns void language plpgsql as $$
begin
  insert into public.anonymous_write_grants (
    jti_hash, version, purpose, resource_type, resource_id, operation,
    principal_hash, expected_fingerprint_hash, max_uses, issued_at, expires_at
  ) values
    (p_result_jti, 2, 'anonymous-analysis-write', 'analysis-run', p_resource_id,
     'result:create', p_principal_hash, p_result_fingerprint, 1, p_issued_at, p_expires_at),
    (p_track_jti, 2, 'anonymous-analysis-write', 'analysis-run', p_resource_id,
     'track:create', p_principal_hash, null, p_max_uses, p_issued_at, p_expires_at);
end;
$$;

create function pg_temp.raises_sqlstate(p_sql text, p_expected text)
returns boolean language plpgsql as $$
begin
  execute p_sql;
  return false;
exception when others then
  return sqlstate = p_expected;
end;
$$;

do $$ begin perform pg_temp.make_track_pair('sec05-t01-analysis-run-000001', repeat('a', 63) || '3', repeat('b', 63) || '3', repeat('c', 63) || '3', repeat('d', 63) || '3'); end; $$;
select is(
  public.claim_anonymous_write_grant(repeat('b', 63) || '3', repeat('c', 63) || '3', 'analysis-run', 'sec05-t01-analysis-run-000001', 'track:create', repeat('e', 64))->>'state',
  'claimed',
  'T01 valid track event claim succeeds'
);
do $$ begin
  perform public.complete_anonymous_write_grant(repeat('b', 63) || '3', repeat('c', 63) || '3', 'analysis-run', 'sec05-t01-analysis-run-000001', 'track:create', repeat('e', 64), jsonb_build_object('kind', 'track'));
end; $$;
select is(
  public.claim_anonymous_write_grant(repeat('b', 63) || '3', repeat('c', 63) || '3', 'analysis-run', 'sec05-t01-analysis-run-000001', 'track:create', repeat('e', 64))->>'state',
  'completed',
  'T02 duplicate track event replays completion without a new claim'
);
select ok(
  (select used_count = 1 from public.anonymous_write_grants where jti_hash = repeat('b', 63) || '3'),
  'T03 replayed event does not consume another use'
);

do $$ begin perform pg_temp.make_track_pair('sec05-t04-analysis-run-000004', repeat('f', 63) || '3', repeat('0', 63) || '3', repeat('1', 63) || '3', repeat('2', 63) || '3'); end; $$;
select ok((
  select count(*) = 24 from generate_series(1, 24) as i
  where (public.claim_anonymous_write_grant(
    repeat('0', 63) || '3', repeat('1', 63) || '3', 'analysis-run', 'sec05-t04-analysis-run-000004', 'track:create', lpad(to_hex(i), 64, 'a')
  )->>'state') = 'claimed'
), 'T04 24 distinct track events are accepted');
select is(
  public.claim_anonymous_write_grant(repeat('0', 63) || '3', repeat('1', 63) || '3', 'analysis-run', 'sec05-t04-analysis-run-000004', 'track:create', lpad(to_hex(25), 64, 'a'))->>'state',
  'max_uses',
  'T05 25th distinct track event is denied'
);
select is(
  public.claim_anonymous_write_grant(repeat('b', 63) || '3', repeat('c', 63) || '3', 'analysis-run', 'sec05-t06-analysis-run-000006', 'track:create', repeat('f', 64))->>'state',
  'resource_mismatch',
  'T06 different track resource is denied'
);
select is(
  public.claim_anonymous_write_grant(repeat('b', 63) || '3', repeat('f', 64), 'analysis-run', 'sec05-t01-analysis-run-000001', 'track:create', repeat('f', 64))->>'state',
  'principal_mismatch',
  'T07 different track principal is denied'
);
select is(
  public.claim_anonymous_write_grant(repeat('a', 63) || '3', repeat('c', 63) || '3', 'analysis-run', 'sec05-t01-analysis-run-000001', 'track:create', repeat('f', 64))->>'state',
  'operation_mismatch',
  'T08 result grant cannot claim a track event'
);

do $$ begin perform pg_temp.make_track_pair('sec05-t09-analysis-run-000009', repeat('3', 63) || '3', repeat('4', 63) || '3', repeat('5', 63) || '3', repeat('6', 63) || '3', 24, now() - interval '2 hours', now() - interval '1 hour'); end; $$;
select is(
  public.claim_anonymous_write_grant(repeat('4', 63) || '3', repeat('5', 63) || '3', 'analysis-run', 'sec05-t09-analysis-run-000009', 'track:create', repeat('7', 64))->>'state',
  'expired',
  'T09 expired track grant is denied'
);

do $$ begin perform pg_temp.make_track_pair('sec05-t10-analysis-run-000010', repeat('8', 63) || '3', repeat('9', 63) || '3', repeat('a', 63) || '4', repeat('b', 63) || '4'); end; $$;
with claim as (
  select public.claim_anonymous_write_grant(repeat('9', 63) || '3', repeat('a', 63) || '4', 'analysis-run', 'sec05-t10-analysis-run-000010', 'track:create', repeat('c', 63) || '4') as payload
), first_insert as (
  insert into public.recommendation_logs (event_name, session_id, anonymous_write_grant_use_id)
  select 'sec05-t10', 'sec05-t10', (payload->>'use_id')::uuid from claim returning id
), second_insert as (
  insert into public.recommendation_logs (event_name, session_id, anonymous_write_grant_use_id)
  select 'sec05-t10', 'sec05-t10', (payload->>'use_id')::uuid from claim
  on conflict (anonymous_write_grant_use_id) where anonymous_write_grant_use_id is not null do nothing
  returning 1
)
select ok((select count(*) from first_insert) = 1 and (select count(*) from second_insert) = 0, 'T10 recommendation linkage unique index prevents duplicate log');

do $$ begin perform pg_temp.make_track_pair('sec05-t13-analysis-run-000013', repeat('d', 63) || '4', repeat('e', 63) || '4', repeat('f', 63) || '4', repeat('0', 63) || '4'); end; $$;
with claimed as (
  select public.claim_anonymous_write_grant(repeat('e', 63) || '4', repeat('f', 63) || '4', 'analysis-run', 'sec05-t13-analysis-run-000013', 'track:create', repeat('1', 63) || '4') as payload
), failed as (
  select public.fail_anonymous_write_grant(repeat('e', 63) || '4', repeat('f', 63) || '4', 'analysis-run', 'sec05-t13-analysis-run-000013', 'track:create', repeat('1', 63) || '4') as payload from claimed
), retried as (
  select public.claim_anonymous_write_grant(repeat('e', 63) || '4', repeat('f', 63) || '4', 'analysis-run', 'sec05-t13-analysis-run-000013', 'track:create', repeat('1', 63) || '4') as payload from failed
), completed as (
  select public.complete_anonymous_write_grant(repeat('e', 63) || '4', repeat('f', 63) || '4', 'analysis-run', 'sec05-t13-analysis-run-000013', 'track:create', repeat('1', 63) || '4') as payload from retried
), terminal_fail as (
  select public.fail_anonymous_write_grant(repeat('e', 63) || '4', repeat('f', 63) || '4', 'analysis-run', 'sec05-t13-analysis-run-000013', 'track:create', repeat('1', 63) || '4') as payload from completed
)
select ok(
  (select payload->>'state' = 'claimed' from claimed)
  and (select coalesce((payload->>'updated')::boolean, false) from failed)
  and (select payload->>'state' = 'claimed' from retried)
  and (select coalesce((payload->>'updated')::boolean, false) from completed)
  and not (select coalesce((payload->>'updated')::boolean, false) from terminal_fail),
  'T13 failed track retry is bounded and completed state is terminal'
);
select ok(
  pg_temp.raises_sqlstate($$select public.claim_anonymous_write_grant(repeat('e', 63) || '4', repeat('f', 63) || '4', 'analysis-run', 'sec05-t13-analysis-run-000013', 'track:create', 'not-a-hash')$$, '22023'),
  'T14 malformed fingerprint fails closed with the contract SQLSTATE'
);

do $$ begin
  perform pg_temp.make_track_pair('sec05-v05-analysis-run-000005', repeat('2', 63) || '4', repeat('3', 63) || '4', repeat('4', 63) || '4', repeat('5', 63) || '4');
  perform public.claim_anonymous_write_grant(repeat('2', 63) || '4', repeat('4', 63) || '4', 'analysis-run', 'sec05-v05-analysis-run-000005', 'result:create', repeat('5', 63) || '4');
end;
$$;
update public.anonymous_write_grants
set issued_at = now() - interval '2 hours',
    expires_at = now() - interval '1 hour'
where jti_hash = repeat('2', 63) || '4';
create temporary table v05_target_use (
  id uuid primary key
) on commit drop;
insert into v05_target_use (id)
select grant_use.id
from public.anonymous_write_grant_uses as grant_use
join public.anonymous_write_grants as grant_row on grant_row.id = grant_use.grant_id
where grant_row.jti_hash = repeat('2', 63) || '4';
do $$
begin
  perform public.cleanup_anonymous_write_grants(now());
end;
$$;
select ok(
  (select count(*) from v05_target_use) = 1
  and not exists (select 1 from public.anonymous_write_grants where jti_hash = repeat('2', 63) || '4')
  and not exists (select 1 from public.anonymous_write_grant_uses where id = (select id from v05_target_use)),
  'V05 expired in-progress grant and its use are deleted by current cleanup contract'
);

select * from finish();
rollback;
