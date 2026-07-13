insert into public.products (
  id, brand, name, category, product_form, skin_types, concerns, texture, finish,
  price_min, price_max, sensitivity_safe, irritation_risk, uv_filter_type, tone_up,
  white_cast, eye_sting, pilling_risk, review_signals, market_signals, ingredient_signals
) values
  ('shadow-cleanser', 'Synthetic Lab', 'Synthetic Cleanser', 'cleanser', null, '{oily,dry,combination,sensitive}', '{oiliness,redness}', 'gel', 'fresh', 10, 12, true, 'low', null, false, null, null, null, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('shadow-toner', 'Synthetic Lab', 'Synthetic Toner', 'toner_essence', 'essence', '{oily,dry,combination,sensitive}', '{dehydration,redness}', 'watery', 'natural', 11, 13, true, 'low', null, false, null, null, null, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('shadow-treatment', 'Synthetic Lab', 'Synthetic Treatment', 'treatment', 'serum', '{oily,dry,combination,sensitive}', '{acne,pores,uneven_tone}', 'gel', 'natural', 12, 14, true, 'low', null, false, null, null, null, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('shadow-moisturizer', 'Synthetic Lab', 'Synthetic Moisturizer', 'moisturizer', 'cream', '{dry,combination,sensitive}', '{dehydration,barrier}', 'cream', 'dewy', 13, 15, true, 'low', null, false, null, null, null, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb),
  ('shadow-sunscreen', 'Synthetic Lab', 'Synthetic Sunscreen', 'sunscreen', null, '{oily,dry,combination,sensitive}', '{redness,uneven_tone}', 'lotion', 'natural', 14, 16, true, 'low', 'organic', false, 'none', 'low', 'low', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb)
on conflict (id) do update set
  brand = excluded.brand,
  name = excluded.name,
  category = excluded.category,
  product_form = excluded.product_form,
  skin_types = excluded.skin_types,
  concerns = excluded.concerns,
  texture = excluded.texture,
  finish = excluded.finish,
  price_min = excluded.price_min,
  price_max = excluded.price_max,
  sensitivity_safe = excluded.sensitivity_safe,
  irritation_risk = excluded.irritation_risk;
