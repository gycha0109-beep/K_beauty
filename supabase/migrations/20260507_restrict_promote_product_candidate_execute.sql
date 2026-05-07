begin;

revoke all on function public.promote_product_candidate(uuid, text) from public;
revoke execute on function public.promote_product_candidate(uuid, text) from anon;
revoke execute on function public.promote_product_candidate(uuid, text) from authenticated;
grant execute on function public.promote_product_candidate(uuid, text) to service_role;

commit;
