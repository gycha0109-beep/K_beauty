-- TRUST Phase 8H-3 / Phase 8E executable-wrapper security hardening.
-- The existing function bodies already schema-qualify governed relations/functions.
-- Pin the SECURITY DEFINER search path to empty and preserve service_role-only execution.

alter function public.admin_preflight_product_fact_revalidation_resolution_v1(
  uuid, text, uuid, uuid
) set search_path = '';

alter function public.admin_reaffirm_product_fact_revalidation_v1(
  uuid, text, uuid, uuid, text, text
) set search_path = '';

revoke all on function public.admin_preflight_product_fact_revalidation_resolution_v1(
  uuid, text, uuid, uuid
) from public, anon, authenticated, service_role;
grant execute on function public.admin_preflight_product_fact_revalidation_resolution_v1(
  uuid, text, uuid, uuid
) to service_role;

revoke all on function public.admin_reaffirm_product_fact_revalidation_v1(
  uuid, text, uuid, uuid, text, text
) from public, anon, authenticated, service_role;
grant execute on function public.admin_reaffirm_product_fact_revalidation_v1(
  uuid, text, uuid, uuid, text, text
) to service_role;
