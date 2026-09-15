update public.product_candidates
set review_status = 'promoted',
    matched_product_id = '10000000-0000-0000-0000-000000000001',
    promotion_version = 'catalog-only-product-transactional-adoption-v1'
where id = '20000000-0000-0000-0000-000000000001';

do $$
declare
  v_row public.catalog_trust_intake%rowtype;
begin
  select * into strict v_row
  from public.catalog_trust_intake
  where source_candidate_id = '20000000-0000-0000-0000-000000000001';

  if v_row.category <> 'treatment' then
    raise exception 'catalog-only TRUST category mismatch: %', v_row.category;
  end if;
  if v_row.market <> 'KR' then
    raise exception 'catalog-only TRUST market mismatch: %', v_row.market;
  end if;
  if v_row.catalog_revision <> 'candidate:20000000-0000-0000-0000-000000000001:catalog-only-product-transactional-adoption-v1' then
    raise exception 'catalog-only TRUST revision mismatch: %', v_row.catalog_revision;
  end if;
end;
$$;

update public.product_candidates
set review_status = 'promoted',
    matched_product_id = '10000000-0000-0000-0000-000000000002',
    promotion_version = 'legacy-structural-test-v1'
where id = '20000000-0000-0000-0000-000000000002';

do $$
declare
  v_category text;
begin
  select category into strict v_category
  from public.catalog_trust_intake
  where source_candidate_id = '20000000-0000-0000-0000-000000000002';

  if v_category <> 'cleanser' then
    raise exception 'legacy structural TRUST category changed: %', v_category;
  end if;
end;
$$;

do $$
begin
  begin
    update public.product_candidates
    set review_status = 'promoted',
        matched_product_id = '10000000-0000-0000-0000-000000000003',
        promotion_version = 'catalog-only-product-transactional-adoption-v1'
    where id = '20000000-0000-0000-0000-000000000003';

    raise exception 'expected catalog-only promotion without governed classification to fail';
  exception
    when check_violation then
      null;
  end;

  if exists (
    select 1
    from public.catalog_trust_intake
    where source_candidate_id = '20000000-0000-0000-0000-000000000003'
  ) then
    raise exception 'invalid catalog-only promotion created TRUST intake';
  end if;

  if (select review_status from public.product_candidates where id='20000000-0000-0000-0000-000000000003') <> 'approved' then
    raise exception 'invalid catalog-only promotion was not rolled back';
  end if;
end;
$$;

select jsonb_build_object(
  'result','PASS',
  'catalog_only_category',(select category from public.catalog_trust_intake where source_candidate_id='20000000-0000-0000-0000-000000000001'),
  'legacy_category',(select category from public.catalog_trust_intake where source_candidate_id='20000000-0000-0000-0000-000000000002'),
  'invalid_intake_count',(select count(*) from public.catalog_trust_intake where source_candidate_id='20000000-0000-0000-0000-000000000003')
) as data_taxonomy15_runtime;
