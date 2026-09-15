begin;

-- DATA-TAXONOMY15 / TRUST Phase 1 compatibility bridge.
-- Preserve the existing structural-promotion intake semantics while allowing
-- catalog-only adoption to derive the TRUST policy category from the exact
-- governed catalog-taxonomy-v1 source rule.
create or replace function public.enqueue_catalog_trust_intake_from_promotion_v1()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_market text;
  v_catalog_revision text;
  v_category text;
begin
  if new.review_status = 'promoted'::public.product_review_status
    and old.review_status is distinct from 'promoted'::public.product_review_status
    and new.matched_product_id is not null
  then
    v_market := case when lower(coalesce(new.source_name, '')) = 'hwahae' then 'KR' else null end;
    v_catalog_revision := 'candidate:' || new.id::text || ':' || coalesce(new.promotion_version, 'unknown');
    v_category := nullif(btrim(coalesce(new.service_category::text, '')), '');

    if v_category is null
      and new.promotion_version = 'catalog-only-product-transactional-adoption-v1'
    then
      select rule.raw_category_key
        into v_category
      from public.product_candidate_catalog_taxonomy_classifications as classification
      join public.catalog_taxonomy_candidate_source_rules as rule
        on rule.rule_key = classification.source_rule_key
       and rule.taxonomy_version = classification.taxonomy_version
      where classification.candidate_id = new.id
        and classification.taxonomy_version = 'catalog-taxonomy-v1'
        and classification.source_name_snapshot is not distinct from new.source_name
        and classification.category_path_snapshot is not distinct from new.category_path
        and classification.legacy_category_snapshot is null
        and classification.legacy_product_form_snapshot is null
        and classification.classification_state = 'active_shadow'
        and classification.classification_method = 'source_rule_v1'
        and classification.source_rule_key is not null
        and classification.legacy_projection_key is null
        and classification.product_write_allowed is false
        and classification.product_promotion_allowed is false
        and classification.recommendation_admission_allowed is false
        and rule.lifecycle_state = 'active'
        and rule.source_name_key = lower(btrim(new.source_name))
        and rule.raw_category_key = lower(btrim(new.category_path))
        and rule.entity_kind_term_id is not distinct from classification.entity_kind_term_id
        and rule.domain_term_id is not distinct from classification.domain_term_id
        and rule.recommendation_family_term_id is not distinct from classification.recommendation_family_term_id
        and rule.category_term_id is not distinct from classification.category_term_id
        and rule.form_term_id is not distinct from classification.form_term_id
      limit 1;
    end if;

    if v_category is null then
      raise exception 'DATA-TAXONOMY15: promoted candidate % has no governed TRUST intake category', new.id
        using errcode = '23514';
    end if;

    insert into public.catalog_trust_intake (
      product_id,
      source_candidate_id,
      catalog_revision,
      category,
      market,
      identity_state,
      trust_state,
      required_fact_policy_version,
      created_at,
      updated_at
    ) values (
      new.matched_product_id,
      new.id,
      v_catalog_revision,
      v_category,
      v_market,
      'PENDING',
      'PENDING',
      'product-fact-required-policy-v1',
      now(),
      now()
    )
    on conflict (product_id, catalog_revision) do nothing;
  end if;

  return new;
end;
$$;

comment on function public.enqueue_catalog_trust_intake_from_promotion_v1() is
  'TRUST Phase 1 promotion intake bridge. Structural promotions use service_category; DATA-TAXONOMY15 catalog-only promotions derive category only from an exact active catalog-taxonomy-v1 source rule.';

revoke all on function public.enqueue_catalog_trust_intake_from_promotion_v1()
  from public, anon, authenticated, service_role;

commit;
