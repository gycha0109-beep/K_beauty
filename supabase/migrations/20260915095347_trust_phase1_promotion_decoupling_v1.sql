begin;

-- TRUST Phase 1 transaction boundary hardening.
-- Catalog promotion owns only the structural catalog write and durable intake
-- enqueue (via product_candidates promotion transition trigger). Required-Fact
-- task materialization is a separate service-role operation and may be retried
-- independently from the catalog transaction.

create or replace function public.promote_product_candidate(
  p_candidate_id uuid,
  p_actor text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return public.promote_product_candidate_structural_v1(p_candidate_id, p_actor);
end;
$$;

revoke all on function public.promote_product_candidate(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.promote_product_candidate(uuid, text)
  to service_role;

comment on function public.process_catalog_trust_product_v1(uuid) is
  'TRUST Phase 1 service-role processor. Runs outside catalog promotion transaction; retryable from durable catalog_trust_intake state.';

commit;
