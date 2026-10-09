\set ON_ERROR_STOP on
-- Each invocation runs in a separate psql connection.
-- The first connection deliberately keeps its transaction advisory lock
-- until it has committed its confirmation; the second must wait and replay.
\if :primary
begin;
select pg_advisory_xact_lock(
  hashtextextended('bejewely_bushman_authority:0b5963bb-67d6-4738-a620-32ec86c1e3d0',0));
select pg_sleep(2);
\endif
select (public.admin_confirm_bushman_identity_auth_v1(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
  'r3-concurrent-request-001',
  p.value->'payload',
  p.value->>'payload_digest',
  p.value->>'prestate_digest'
))->>'idempotent' from test_r3_concurrency.plan p;
\if :primary
commit;
\endif
