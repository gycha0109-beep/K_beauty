begin;

create or replace function recommendation_shadow.read_catalog_taxonomy_recommendation_overlay_v2()
returns table (
  product_id uuid,
  taxonomy_version text,
  legacy_category text,
  legacy_product_form text,
  assignment_state text,
  assignment_method text,
  legacy_projection_key text,
  projection_present boolean,
  projected_legacy_category text,
  projected_legacy_product_form text,
  taxonomy_lifecycle_state text,
  taxonomy_authority_mode text,
  exact_equivalent boolean,
  catalog_only_shadow_valid boolean
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
    e.assignment_state,
    e.assignment_method,
    e.legacy_projection_key,
    e.projection_present,
    e.projected_legacy_category,
    e.projected_legacy_product_form,
    e.taxonomy_lifecycle_state,
    e.taxonomy_authority_mode,
    e.exact_equivalent,
    (
      e.taxonomy_version = 'catalog-taxonomy-v1'
      and e.assignment_state = 'shadow'
      and e.assignment_method = 'source_classification'
      and e.legacy_projection_key is null
      and e.projection_present is false
      and e.legacy_category is null
      and e.legacy_product_form is null
      and e.projected_legacy_category is null
      and e.projected_legacy_product_form is null
      and e.taxonomy_lifecycle_state = 'shadow'
      and e.taxonomy_authority_mode = 'shadow_only'
    ) as catalog_only_shadow_valid
  from public.catalog_taxonomy_product_exact_equivalence_v1 as e
  where e.taxonomy_version = 'catalog-taxonomy-v1'
  order by e.product_id;
$$;

revoke all on function recommendation_shadow.read_catalog_taxonomy_recommendation_overlay_v2() from public;
revoke all on function recommendation_shadow.read_catalog_taxonomy_recommendation_overlay_v2() from anon;
revoke all on function recommendation_shadow.read_catalog_taxonomy_recommendation_overlay_v2() from authenticated;
revoke all on function recommendation_shadow.read_catalog_taxonomy_recommendation_overlay_v2() from service_role;
grant execute on function recommendation_shadow.read_catalog_taxonomy_recommendation_overlay_v2() to recommendation_admission_runtime;

comment on function recommendation_shadow.read_catalog_taxonomy_recommendation_overlay_v2() is
  'DATA-TAXONOMY15 read-only Recommendation shadow overlay. Distinguishes exact legacy projection rows from valid catalog-only shadow rows without granting Recommendation admission.';

commit;
