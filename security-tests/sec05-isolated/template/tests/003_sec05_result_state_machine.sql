begin;

select plan(23);

create function pg_temp.make_pair(
  p_resource_id text,
  p_result_jti text,
  p_track_jti text,
  p_principal_hash text,
  p_result_fingerprint text,
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
     'track:create', p_principal_hash, null, 24, p_issued_at, p_expires_at);
end;
$$;

create function pg_temp.raises_contract(p_sql text, p_expected_sqlstate text, p_expected_message text)
returns boolean language plpgsql as $$
begin
  execute p_sql;
  return false;
exception when others then
  return sqlstate = p_expected_sqlstate and sqlerrm = p_expected_message;
end;
$$;

do $$
begin
  perform public.create_anonymous_write_grants(jsonb_build_array(
    jsonb_build_object(
      'jti_hash', repeat('a', 64), 'version', 2, 'purpose', 'anonymous-analysis-write',
      'resource_type', 'analysis-run', 'resource_id', 'sec05-r01-analysis-run-000001',
      'operation', 'result:create', 'principal_hash', repeat('b', 64),
      'expected_fingerprint_hash', repeat('c', 64), 'max_uses', 1,
      'issued_at', now(), 'expires_at', now() + interval '1 hour'
    ),
    jsonb_build_object(
      'jti_hash', repeat('d', 64), 'version', 2, 'purpose', 'anonymous-analysis-write',
      'resource_type', 'analysis-run', 'resource_id', 'sec05-r01-analysis-run-000001',
      'operation', 'track:create', 'principal_hash', repeat('b', 64),
      'expected_fingerprint_hash', null, 'max_uses', 24,
      'issued_at', now(), 'expires_at', now() + interval '1 hour'
    )
  ));
end;
$$;

select is(
  public.claim_anonymous_write_grant(repeat('a', 64), repeat('b', 64), 'analysis-run', 'sec05-r01-analysis-run-000001', 'result:create', repeat('c', 64))->>'state',
  'claimed',
  'R01 valid result pair creation and first claim succeed'
);
select is(
  public.claim_anonymous_write_grant(repeat('a', 64), repeat('b', 64), 'analysis-run', 'sec05-r01-analysis-run-000001', 'result:create', repeat('c', 64))->>'state',
  'in_progress',
  'R02 second result claim is denied while in progress'
);
select is(
  public.claim_anonymous_write_grant(repeat('a', 64), repeat('e', 64), 'analysis-run', 'sec05-r01-analysis-run-000001', 'result:create', repeat('c', 64))->>'state',
  'principal_mismatch',
  'R03 different principal is denied'
);
select is(
  public.claim_anonymous_write_grant(repeat('a', 64), repeat('b', 64), 'analysis-run', 'sec05-r04-analysis-run-000004', 'result:create', repeat('c', 64))->>'state',
  'resource_mismatch',
  'R04 different resource is denied'
);
select is(
  public.claim_anonymous_write_grant(repeat('a', 64), repeat('b', 64), 'analysis-run', 'sec05-r01-analysis-run-000001', 'track:create', repeat('c', 64))->>'state',
  'operation_mismatch',
  'R05 track operation cannot claim result grant'
);
select ok(
  not coalesce((public.complete_anonymous_write_grant(repeat('a', 64), repeat('b', 64), 'analysis-run', 'sec05-r01-analysis-run-000001', 'result:create', repeat('f', 64))->>'updated')::boolean, false),
  'R06 complete before a matching claim is denied'
);
select ok(
  coalesce((public.complete_anonymous_write_grant(repeat('a', 64), repeat('b', 64), 'analysis-run', 'sec05-r01-analysis-run-000001', 'result:create', repeat('c', 64), jsonb_build_object('kind', 'result'))->>'updated')::boolean, false),
  'R07 claimed result completes'
);
select is(
  public.claim_anonymous_write_grant(repeat('a', 64), repeat('b', 64), 'analysis-run', 'sec05-r01-analysis-run-000001', 'result:create', repeat('c', 64))->>'state',
  'completed',
  'R08 completed result replays canonical state without a new claim'
);
select ok(
  coalesce((public.complete_anonymous_write_grant(repeat('a', 64), repeat('b', 64), 'analysis-run', 'sec05-r01-analysis-run-000001', 'result:create', repeat('c', 64))->>'already_completed')::boolean, false),
  'R09 complete is idempotent after completion'
);

do $$ begin perform pg_temp.make_pair('sec05-r10-analysis-run-000010', repeat('1', 64), repeat('2', 64), repeat('3', 64), repeat('4', 64)); end; $$;
with claimed as (
  select public.claim_anonymous_write_grant(repeat('1', 64), repeat('3', 64), 'analysis-run', 'sec05-r10-analysis-run-000010', 'result:create', repeat('4', 64)) as payload
), failed as (
  select public.fail_anonymous_write_grant(repeat('1', 64), repeat('3', 64), 'analysis-run', 'sec05-r10-analysis-run-000010', 'result:create', repeat('4', 64)) as payload from claimed
), replay as (
  select public.claim_anonymous_write_grant(repeat('1', 64), repeat('3', 64), 'analysis-run', 'sec05-r10-analysis-run-000010', 'result:create', repeat('4', 64)) as payload from failed
)
select ok(
  (select payload->>'state' = 'claimed' from claimed)
  and (select coalesce((payload->>'updated')::boolean, false) from failed)
  and (select payload->>'state' = 'failed' from replay),
  'R10 failed result claim becomes terminal and cannot retry'
);
select ok(
  not coalesce((public.fail_anonymous_write_grant(repeat('a', 64), repeat('b', 64), 'analysis-run', 'sec05-r01-analysis-run-000001', 'result:create', repeat('c', 64))->>'updated')::boolean, false),
  'R11 terminal completed result cannot transition to failed'
);

do $$ begin perform pg_temp.make_pair('sec05-r12-analysis-run-000012', repeat('5', 64), repeat('6', 64), repeat('7', 64), repeat('8', 64), now() - interval '2 hours', now() - interval '1 hour'); end; $$;
select is(
  public.claim_anonymous_write_grant(repeat('5', 64), repeat('7', 64), 'analysis-run', 'sec05-r12-analysis-run-000012', 'result:create', repeat('8', 64))->>'state',
  'expired',
  'R12 expired result grant is denied'
);

do $$ begin perform pg_temp.make_pair('sec05-r13-analysis-run-000013', repeat('9', 64), repeat('a', 63) || '1', repeat('b', 63) || '1', repeat('c', 63) || '1'); end; $$;
with claim as (
  select public.claim_anonymous_write_grant(repeat('9', 64), repeat('b', 63) || '1', 'analysis-run', 'sec05-r13-analysis-run-000013', 'result:create', repeat('c', 63) || '1') as payload
), request_one as (
  insert into public.analysis_requests (session_id) values ('sec05-r13-one') returning id
), first_insert as (
  insert into public.analysis_results (request_id, anonymous_write_grant_use_id)
  select request_one.id, (claim.payload->>'use_id')::uuid from request_one cross join claim returning id
), request_two as (
  insert into public.analysis_requests (session_id) values ('sec05-r13-two') returning id
), second_insert as (
  insert into public.analysis_results (request_id, anonymous_write_grant_use_id)
  select request_two.id, (claim.payload->>'use_id')::uuid from request_two cross join claim
  on conflict (anonymous_write_grant_use_id) where anonymous_write_grant_use_id is not null do nothing
  returning 1
)
select ok((select count(*) from first_insert) = 1 and (select count(*) from second_insert) = 0, 'R13 result linkage unique index prevents a second insert');

do $$ begin perform pg_temp.make_pair('sec05-r14-analysis-run-000014', repeat('d', 63) || '1', repeat('e', 63) || '1', repeat('f', 64), repeat('0', 64)); end; $$;
select is(
  public.claim_anonymous_write_grant(repeat('d', 63) || '1', repeat('f', 64), 'analysis-run', 'sec05-r14-analysis-run-000014', 'result:create', repeat('0', 64))->>'state',
  'claimed',
  'R14 a different valid result grant can claim independently'
);
select ok(
  pg_temp.raises_contract($$select public.claim_anonymous_write_grant(null, repeat('b', 64), 'analysis-run', 'sec05-r01-analysis-run-000001', 'result:create', repeat('c', 64))$$, '22023', 'anonymous_write_grant_claim_invalid'),
  'R15 malformed identifier fails closed with the contract SQLSTATE and message'
);

do $$ begin
  perform pg_temp.make_pair('sec05-r16-analysis-run-000016', repeat('a', 63) || '2', repeat('b', 63) || '2', repeat('c', 63) || '2', repeat('d', 63) || '2');
  perform public.claim_anonymous_write_grant(repeat('a', 63) || '2', repeat('c', 63) || '2', 'analysis-run', 'sec05-r16-analysis-run-000016', 'result:create', repeat('d', 63) || '2');
end;
$$;
update public.anonymous_write_grant_uses
set in_progress_until = now() - interval '1 hour'
where grant_id = (select id from public.anonymous_write_grants where jti_hash = repeat('a', 63) || '2');
select is(
  public.claim_anonymous_write_grant(repeat('a', 63) || '2', repeat('c', 63) || '2', 'analysis-run', 'sec05-r16-analysis-run-000016', 'result:create', repeat('d', 63) || '2')->>'state',
  'in_progress',
  'R16 stale result lease cannot be reclaimed'
);
select ok(
  not coalesce((public.complete_anonymous_write_grant(repeat('a', 63) || '2', repeat('e', 63) || '2', 'analysis-run', 'sec05-r16-analysis-run-000016', 'result:create', repeat('d', 63) || '2')->>'updated')::boolean, false),
  'R17 another worker cannot complete the result claim'
);

do $$ begin
  perform pg_temp.make_pair('sec05-r18-analysis-run-000018', repeat('1', 63) || '8', repeat('2', 63) || '8', repeat('3', 63) || '8', repeat('4', 63) || '8');
  perform public.claim_anonymous_write_grant(repeat('1', 63) || '8', repeat('3', 63) || '8', 'analysis-run', 'sec05-r18-analysis-run-000018', 'result:create', repeat('4', 63) || '8');
end $$;
select ok(
  pg_temp.raises_contract($$select public.complete_anonymous_write_grant(repeat('1', 63) || '8', null, 'analysis-run', 'sec05-r18-analysis-run-000018', 'result:create', repeat('4', 63) || '8')$$, '22023', 'anonymous_write_grant_claim_invalid')
  and exists (select 1 from public.anonymous_write_grant_uses as grant_use join public.anonymous_write_grants as grant_row on grant_row.id = grant_use.grant_id where grant_row.jti_hash = repeat('1', 63) || '8' and grant_use.status = 'in_progress'),
  'R18 complete NULL principal fails closed without a state transition'
);

do $$ begin
  perform pg_temp.make_pair('sec05-r19-analysis-run-000019', repeat('5', 63) || '8', repeat('6', 63) || '8', repeat('7', 63) || '8', repeat('8', 63) || '8');
  perform public.claim_anonymous_write_grant(repeat('5', 63) || '8', repeat('7', 63) || '8', 'analysis-run', 'sec05-r19-analysis-run-000019', 'result:create', repeat('8', 63) || '8');
end $$;
select ok(
  pg_temp.raises_contract($$select public.complete_anonymous_write_grant(repeat('5', 63) || '8', repeat('7', 63) || '8', null, 'sec05-r19-analysis-run-000019', 'result:create', repeat('8', 63) || '8')$$, '22023', 'anonymous_write_grant_claim_invalid')
  and pg_temp.raises_contract($$select public.complete_anonymous_write_grant(repeat('5', 63) || '8', repeat('7', 63) || '8', 'analysis-run', null, 'result:create', repeat('8', 63) || '8')$$, '22023', 'anonymous_write_grant_claim_invalid')
  and exists (select 1 from public.anonymous_write_grant_uses as grant_use join public.anonymous_write_grants as grant_row on grant_row.id = grant_use.grant_id where grant_row.jti_hash = repeat('5', 63) || '8' and grant_use.status = 'in_progress'),
  'R19 complete NULL resource fields fail closed without a state transition'
);

do $$ begin
  perform pg_temp.make_pair('sec05-r20-analysis-run-000020', repeat('9', 63) || '8', repeat('a', 63) || '8', repeat('b', 63) || '8', repeat('c', 63) || '8');
  perform public.claim_anonymous_write_grant(repeat('9', 63) || '8', repeat('b', 63) || '8', 'analysis-run', 'sec05-r20-analysis-run-000020', 'result:create', repeat('c', 63) || '8');
end $$;
select ok(
  pg_temp.raises_contract($$select public.complete_anonymous_write_grant(repeat('9', 63) || '8', repeat('b', 63) || '8', 'analysis-run', 'sec05-r20-analysis-run-000020', null, repeat('c', 63) || '8')$$, '22023', 'anonymous_write_grant_claim_invalid')
  and exists (select 1 from public.anonymous_write_grant_uses as grant_use join public.anonymous_write_grants as grant_row on grant_row.id = grant_use.grant_id where grant_row.jti_hash = repeat('9', 63) || '8' and grant_use.status = 'in_progress'),
  'R20 complete NULL operation fails closed without a state transition'
);

do $$ begin
  perform pg_temp.make_pair('sec05-r21-analysis-run-000021', repeat('d', 63) || '8', repeat('e', 63) || '8', repeat('f', 63) || '8', repeat('0', 63) || '8');
  perform public.claim_anonymous_write_grant(repeat('d', 63) || '8', repeat('f', 63) || '8', 'analysis-run', 'sec05-r21-analysis-run-000021', 'result:create', repeat('0', 63) || '8');
end $$;
select ok(
  pg_temp.raises_contract($$select public.fail_anonymous_write_grant(repeat('d', 63) || '8', null, 'analysis-run', 'sec05-r21-analysis-run-000021', 'result:create', repeat('0', 63) || '8')$$, '22023', 'anonymous_write_grant_claim_invalid')
  and exists (select 1 from public.anonymous_write_grant_uses as grant_use join public.anonymous_write_grants as grant_row on grant_row.id = grant_use.grant_id where grant_row.jti_hash = repeat('d', 63) || '8' and grant_use.status = 'in_progress'),
  'R21 fail NULL principal fails closed without a state transition'
);

do $$ begin
  perform pg_temp.make_pair('sec05-r22-analysis-run-000022', repeat('1', 63) || '9', repeat('2', 63) || '9', repeat('3', 63) || '9', repeat('4', 63) || '9');
  perform public.claim_anonymous_write_grant(repeat('1', 63) || '9', repeat('3', 63) || '9', 'analysis-run', 'sec05-r22-analysis-run-000022', 'result:create', repeat('4', 63) || '9');
end $$;
select ok(
  pg_temp.raises_contract($$select public.fail_anonymous_write_grant(repeat('1', 63) || '9', repeat('3', 63) || '9', null, 'sec05-r22-analysis-run-000022', 'result:create', repeat('4', 63) || '9')$$, '22023', 'anonymous_write_grant_claim_invalid')
  and pg_temp.raises_contract($$select public.fail_anonymous_write_grant(repeat('1', 63) || '9', repeat('3', 63) || '9', 'analysis-run', null, 'result:create', repeat('4', 63) || '9')$$, '22023', 'anonymous_write_grant_claim_invalid')
  and exists (select 1 from public.anonymous_write_grant_uses as grant_use join public.anonymous_write_grants as grant_row on grant_row.id = grant_use.grant_id where grant_row.jti_hash = repeat('1', 63) || '9' and grant_use.status = 'in_progress'),
  'R22 fail NULL resource fields fail closed without a state transition'
);

do $$ begin
  perform pg_temp.make_pair('sec05-r23-analysis-run-000023', repeat('5', 63) || '9', repeat('6', 63) || '9', repeat('7', 63) || '9', repeat('8', 63) || '9');
  perform public.claim_anonymous_write_grant(repeat('5', 63) || '9', repeat('7', 63) || '9', 'analysis-run', 'sec05-r23-analysis-run-000023', 'result:create', repeat('8', 63) || '9');
end $$;
select ok(
  pg_temp.raises_contract($$select public.fail_anonymous_write_grant(repeat('5', 63) || '9', repeat('7', 63) || '9', 'analysis-run', 'sec05-r23-analysis-run-000023', null, repeat('8', 63) || '9')$$, '22023', 'anonymous_write_grant_claim_invalid')
  and exists (select 1 from public.anonymous_write_grant_uses as grant_use join public.anonymous_write_grants as grant_row on grant_row.id = grant_use.grant_id where grant_row.jti_hash = repeat('5', 63) || '9' and grant_use.status = 'in_progress'),
  'R23 fail NULL operation fails closed without a state transition'
);

select * from finish();
rollback;
