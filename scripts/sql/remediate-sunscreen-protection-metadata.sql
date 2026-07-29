begin;

select pg_advisory_xact_lock(hashtext('bejewely:sunscreen-protection-metadata-remediation-v1'));

do $$
begin
  if (
    select count(*)
    from public.products
    where id = '9983f167-24e7-4223-bd86-446ce6ced31b'
      and normalized_brand = '라로슈포제'
      and normalized_name = '안뗄리오스 선 플루이드'
      and category = 'sunscreen'
      and uva_label is null
      and pilling_risk is null
  ) <> 1 then
    raise exception 'laroche_precondition_failed';
  end if;

  if (
    select count(*)
    from public.products
    where id = 'cbcd06a2-de29-47ca-afd1-ab1d5de93903'
      and normalized_brand = '아넷사'
      and normalized_name = '퍼펙트 UV 선스크린 스킨케어 밀크 NA'
      and category = 'sunscreen'
      and uva_label = 'PA++++'
      and pilling_risk is null
  ) <> 1 then
    raise exception 'anessa_precondition_failed';
  end if;
end
$$;

update public.products
set
  uva_label = 'PA++++',
  pilling_risk = 'low',
  source_url = coalesce(
    nullif(source_url, ''),
    'https://www.larocheposay.co.kr/product/view/4833.do'
  ),
  hwahae_url = coalesce(
    nullif(hwahae_url, ''),
    'https://www.hwahae.com/en/products/LAROCHE-POSAY-ANTHELIOS-SUN-FLUID-SPF50PLUS-PAPLUS-PLUS-PLUS-PLUS/2199136'
  ),
  review_signals = coalesce(review_signals, '{}'::jsonb) || jsonb_build_object(
    'metadata_remediation',
    jsonb_build_object(
      'version', 'sunscreen-protection-metadata-remediation-v1',
      'reviewed_at', '2026-07-29',
      'uva_label', jsonb_build_object(
        'value', 'PA++++',
        'basis', 'official_product_and_exact_product_catalog'
      ),
      'pilling_risk', jsonb_build_object(
        'value', 'low',
        'basis', 'existing_direct_review_signal',
        'positive_label', '밀림없는',
        'positive_count', 2
      ),
      'sources', jsonb_build_array(
        'https://www.larocheposay.co.kr/product/view/4833.do',
        'https://www.hwahae.com/en/products/LAROCHE-POSAY-ANTHELIOS-SUN-FLUID-SPF50PLUS-PAPLUS-PLUS-PLUS-PLUS/2199136'
      )
    )
  )
where id = '9983f167-24e7-4223-bd86-446ce6ced31b';

update public.products
set
  pilling_risk = 'low',
  source_url = coalesce(
    nullif(source_url, ''),
    'https://www.shinsegaev.com/goods/initDetailGoods.siv?goods_no=2403357889'
  ),
  review_signals = coalesce(review_signals, '{}'::jsonb) || jsonb_build_object(
    'metadata_remediation',
    jsonb_build_object(
      'version', 'sunscreen-protection-metadata-remediation-v1',
      'reviewed_at', '2026-07-29',
      'pilling_risk', jsonb_build_object(
        'value', 'low',
        'basis', 'repeated_exact_product_makeup_compatibility_reviews'
      ),
      'sources', jsonb_build_array(
        'https://unpa.me/products/203820-perfect-uv-sunscreen-skincare-milk-na',
        'https://unpa.me/reviews/411824',
        'https://m.chicor.com/goods/0000000096884',
        'https://www.shinsegaev.com/goods/initDetailGoods.siv?goods_no=2403357889'
      )
    )
  )
where id = 'cbcd06a2-de29-47ca-afd1-ab1d5de93903';

do $$
begin
  if (
    select count(*)
    from public.products
    where id = '9983f167-24e7-4223-bd86-446ce6ced31b'
      and normalized_brand = '라로슈포제'
      and normalized_name = '안뗄리오스 선 플루이드'
      and category = 'sunscreen'
      and uva_label = 'PA++++'
      and pilling_risk = 'low'
      and source_url = 'https://www.larocheposay.co.kr/product/view/4833.do'
      and hwahae_url = 'https://www.hwahae.com/en/products/LAROCHE-POSAY-ANTHELIOS-SUN-FLUID-SPF50PLUS-PAPLUS-PLUS-PLUS-PLUS/2199136'
      and review_signals -> 'metadata_remediation' ->> 'version'
        = 'sunscreen-protection-metadata-remediation-v1'
  ) <> 1 then
    raise exception 'laroche_postcondition_failed';
  end if;

  if (
    select count(*)
    from public.products
    where id = 'cbcd06a2-de29-47ca-afd1-ab1d5de93903'
      and normalized_brand = '아넷사'
      and normalized_name = '퍼펙트 UV 선스크린 스킨케어 밀크 NA'
      and category = 'sunscreen'
      and uva_label = 'PA++++'
      and pilling_risk = 'low'
      and source_url = 'https://www.shinsegaev.com/goods/initDetailGoods.siv?goods_no=2403357889'
      and review_signals -> 'metadata_remediation' ->> 'version'
        = 'sunscreen-protection-metadata-remediation-v1'
  ) <> 1 then
    raise exception 'anessa_postcondition_failed';
  end if;

  if exists (
    select 1
    from public.products
    where category = 'sunscreen'
      and (
        uva_label is null
        or btrim(uva_label) = ''
        or pilling_risk is null
        or btrim(pilling_risk) = ''
      )
  ) then
    raise exception 'sunscreen_metadata_gap_remains';
  end if;
end
$$;

commit;
