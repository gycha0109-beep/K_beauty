begin;

create or replace view public.catalog_taxonomy_product_exact_equivalence_v1
with (security_invoker = true)
as
select
  p.id as product_id,
  a.taxonomy_version,
  p.category::text as legacy_category,
  p.product_form::text as legacy_product_form,
  a.assignment_state,
  a.assignment_method,
  a.legacy_projection_key,
  lp.projection_key,
  lp.legacy_category::text as projected_legacy_category,
  lp.legacy_product_form::text as projected_legacy_product_form,
  v.lifecycle_state as taxonomy_lifecycle_state,
  v.authority_mode as taxonomy_authority_mode,
  (lp.projection_key is not null) as projection_present,
  (p.category::text = lp.legacy_category::text) as category_equivalent,
  (coalesce(p.product_form::text, '') = coalesce(lp.legacy_product_form::text, '')) as form_equivalent,
  (
    a.taxonomy_version = 'catalog-taxonomy-v1'
    and a.assignment_state = 'shadow'
    and lp.projection_key is not null
    and a.legacy_projection_key = lp.projection_key
    and p.category::text = lp.legacy_category::text
    and coalesce(p.product_form::text, '') = coalesce(lp.legacy_product_form::text, '')
    and v.lifecycle_state = 'shadow'
    and v.authority_mode = 'shadow_only'
  ) as exact_equivalent
from public.products p
left join public.product_catalog_taxonomy_assignments a
  on a.product_id = p.id
 and a.taxonomy_version = 'catalog-taxonomy-v1'
left join public.catalog_taxonomy_legacy_projections lp
  on lp.taxonomy_version = a.taxonomy_version
 and lp.projection_key = a.legacy_projection_key
 and lp.lifecycle_state = 'active'
left join public.catalog_taxonomy_versions v
  on v.version = a.taxonomy_version;

revoke all on table public.catalog_taxonomy_product_exact_equivalence_v1
from public, anon, authenticated, service_role;

grant select on table public.catalog_taxonomy_product_exact_equivalence_v1
to service_role;

commit;
