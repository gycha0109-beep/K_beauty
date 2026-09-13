create schema if not exists recommendation_shadow;

revoke all on schema recommendation_shadow from public;
revoke all on schema recommendation_shadow from anon;
revoke all on schema recommendation_shadow from authenticated;
revoke all on schema recommendation_shadow from service_role;

grant usage on schema recommendation_shadow to recommendation_admission_runtime;

create or replace function recommendation_shadow.read_catalog_taxonomy_recommendation_overlay_v1()
returns table (
  product_id uuid,
  taxonomy_version text,
  legacy_category text,
  legacy_product_form text,
  projected_legacy_category text,
  projected_legacy_product_form text,
  taxonomy_lifecycle_state text,
  taxonomy_authority_mode text,
  exact_equivalent boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    e.product_id,
    e.taxonomy_version,
    e.legacy_category,
    e.legacy_product_form,
    e.projected_legacy_category,
    e.projected_legacy_product_form,
    e.taxonomy_lifecycle_state,
    e.taxonomy_authority_mode,
    e.exact_equivalent
  from public.catalog_taxonomy_product_exact_equivalence_v1 as e
  where e.taxonomy_version = 'catalog-taxonomy-v1'
  order by e.product_id;
$$;

revoke all on function recommendation_shadow.read_catalog_taxonomy_recommendation_overlay_v1() from public;
revoke all on function recommendation_shadow.read_catalog_taxonomy_recommendation_overlay_v1() from anon;
revoke all on function recommendation_shadow.read_catalog_taxonomy_recommendation_overlay_v1() from authenticated;
revoke all on function recommendation_shadow.read_catalog_taxonomy_recommendation_overlay_v1() from service_role;
grant execute on function recommendation_shadow.read_catalog_taxonomy_recommendation_overlay_v1() to recommendation_admission_runtime;

comment on schema recommendation_shadow is 'Non-exposed controlled Recommendation shadow diagnostics; no runtime authority.';
comment on function recommendation_shadow.read_catalog_taxonomy_recommendation_overlay_v1() is 'DATA-TAXONOMY5 read-only overlay for actual Recommendation parity diagnostics. Does not authorize runtime cutover.';
