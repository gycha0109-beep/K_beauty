begin;

select plan(23);

select ok((select relrowsecurity from pg_class where oid = 'public.anonymous_write_grants'::regclass), 'PRIV_RLS grants RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.anonymous_write_grant_uses'::regclass), 'PRIV_RLS uses RLS enabled');
select ok(not has_table_privilege('anon', 'public.anonymous_write_grants', 'select'), 'PRIV_RLS anon cannot select grants');
select ok(not has_table_privilege('anon', 'public.anonymous_write_grants', 'insert'), 'PRIV_RLS anon cannot insert grants');
select ok(not has_table_privilege('anon', 'public.anonymous_write_grants', 'update'), 'PRIV_RLS anon cannot update grants');
select ok(not has_table_privilege('anon', 'public.anonymous_write_grants', 'delete'), 'PRIV_RLS anon cannot delete grants');
select ok(not has_table_privilege('authenticated', 'public.anonymous_write_grants', 'select'), 'PRIV_RLS authenticated cannot select grants');
select ok(not has_table_privilege('authenticated', 'public.anonymous_write_grants', 'insert'), 'PRIV_RLS authenticated cannot insert grants');
select ok(not has_table_privilege('authenticated', 'public.anonymous_write_grants', 'update'), 'PRIV_RLS authenticated cannot update grants');
select ok(not has_table_privilege('authenticated', 'public.anonymous_write_grants', 'delete'), 'PRIV_RLS authenticated cannot delete grants');
select ok(not has_table_privilege('anon', 'public.anonymous_write_grant_uses', 'select'), 'PRIV_RLS anon cannot select uses');
select ok(not has_table_privilege('authenticated', 'public.anonymous_write_grant_uses', 'insert'), 'PRIV_RLS authenticated cannot insert uses');
select ok(has_table_privilege('service_role', 'public.anonymous_write_grants', 'select,insert,update,delete'), 'PRIV_RLS service role has grant table access');
select ok(has_table_privilege('service_role', 'public.anonymous_write_grant_uses', 'select,insert,update,delete'), 'PRIV_RLS service role has use table access');
select ok(
  not exists (
    select 1
    from pg_catalog.pg_proc as p
    cross join lateral pg_catalog.aclexplode(
      coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))
    ) as acl_entry
    where p.oid = 'public.claim_anonymous_write_grant(text,text,text,text,text,text)'::regprocedure
      and acl_entry.grantee = 0
      and acl_entry.privilege_type = 'EXECUTE'
  ),
  'PRIV_RLS PUBLIC cannot execute claim RPC'
);
select ok(not has_function_privilege('anon', 'public.claim_anonymous_write_grant(text,text,text,text,text,text)', 'execute'), 'PRIV_RLS anon cannot execute claim RPC');
select ok(not has_function_privilege('authenticated', 'public.claim_anonymous_write_grant(text,text,text,text,text,text)', 'execute'), 'PRIV_RLS authenticated cannot execute claim RPC');
select ok(has_function_privilege('service_role', 'public.create_anonymous_write_grants(jsonb)', 'execute'), 'PRIV_RLS service role can create grants');
select ok(has_function_privilege('service_role', 'public.claim_anonymous_write_grant(text,text,text,text,text,text)', 'execute'), 'PRIV_RLS service role can claim grants');
select ok(has_function_privilege('service_role', 'public.complete_anonymous_write_grant(text,text,text,text,text,text,jsonb)', 'execute'), 'PRIV_RLS service role can complete grants');
select ok(has_function_privilege('service_role', 'public.fail_anonymous_write_grant(text,text,text,text,text,text)', 'execute'), 'PRIV_RLS service role can fail grants');
select ok(has_function_privilege('service_role', 'public.cleanup_anonymous_write_grants(timestamptz)', 'execute'), 'PRIV_RLS service role can clean grants');
select ok((select count(*) = 0 from pg_policies where schemaname = 'public' and tablename in ('anonymous_write_grants', 'anonymous_write_grant_uses')), 'PRIV_RLS grant tables have no broad policies');

select * from finish();
rollback;
