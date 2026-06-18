-- moisturizer_lotion_emulsion 후보 15개 INSERT
-- 기준 파일: hwahae_final_new_candidates.json + products_schema CSV
-- 생성일: 2026-05-26
-- 주의: texture/finish enum 값이 현재 DB와 다르면 해당 컬럼만 NULL 처리 후 실행하세요.

WITH rows (
  name,
  brand,
  category,
  price_min,
  price_max,
  buy_link,
  image_url,
  skin_types,
  concerns,
  texture,
  finish,
  irritation_risk,
  sensitivity_safe,
  normalized_name,
  normalized_brand,
  is_mens,
  recommendation_tier,
  size_ml,
  unit_price_per_10ml,
  review_signals,
  hwahae_url,
  market_signals,
  ingredient_signals,
  external_source,
  external_type,
  external_id,
  source_url
) AS (
VALUES
  ('MLE 로션 300ml+300ml', '아토팜', 'moisturizer_lotion_emulsion', 61000, 61000, 'https://neopharmshop.co.kr/product/아토팜-mle-로션-300ml/2184/', NULL, ARRAY['dry', 'sensitive', 'normal']::text[], ARRAY['barrier', 'dryness', 'hydration', 'sensitivity']::text[], 'lotion', 'dewy', 'low', TRUE, 'mle로션', '아토팜', FALSE, 'core_barrier', 600, 1016.67, '{"source":"hwahae_candidate","category":"moisturizer_lotion_emulsion","concern":"all","rank":2,"normalized_name":"mle로션","normalized_brand":"아토팜","note":"official: MLE/Omega-Ceramide-16/Lipimoide barrier moisturizing"}'::jsonb, 'https://www.hwahae.co.kr/goods/74200', '{"source":"hwahae_candidate","price":61000,"bundle_size_ml":600,"unit_price_per_10ml":1016.67,"external_url":"https://www.hwahae.co.kr/goods/74200","updated_at":"2026-05-26"}'::jsonb, '{"source":"web_manual_mapping","confidence":"medium","inferred_tags":["barrier","dryness","hydration","sensitivity"],"source_note":"official: MLE/Omega-Ceramide-16/Lipimoide barrier moisturizing"}'::jsonb, 'hwahae', 'goods', '74200', NULL),
  ('더 심플 데일리 로션 300ml 3개', '싸이닉', 'moisturizer_lotion_emulsion', 31900, 31900, 'https://scinic.com/product/싸이닉-더-심플-데일리-로션-300ml/43/', NULL, ARRAY['all', 'sensitive', 'combination']::text[], ARRAY['hydration', 'soothing', 'oil_water_balance', 'sensitivity']::text[], 'lotion', 'fresh', 'low', TRUE, '더심플데일리로션', '싸이닉', FALSE, 'daily_basic', 900, 354.44, '{"source":"hwahae_candidate","category":"moisturizer_lotion_emulsion","concern":"all","rank":4,"normalized_name":"더심플데일리로션","normalized_brand":"싸이닉","note":"official: mild acidic daily hydrating lotion"}'::jsonb, 'https://www.hwahae.co.kr/goods/78501', '{"source":"hwahae_candidate","price":31900,"bundle_size_ml":900,"unit_price_per_10ml":354.44,"external_url":"https://www.hwahae.co.kr/goods/78501","updated_at":"2026-05-26"}'::jsonb, '{"source":"web_manual_mapping","confidence":"medium","inferred_tags":["hydration","soothing","oil_water_balance","sensitivity"],"source_note":"official: mild acidic daily hydrating lotion"}'::jsonb, 'hwahae', 'goods', '78501', NULL),
  ('수딩 젤 로션 160ml+160ml', '아토팜', 'moisturizer_lotion_emulsion', 32800, 32800, 'https://neopharmshop.co.kr/product/아토팜-수딩-젤-로션-160ml/2175/', NULL, ARRAY['all', 'sensitive', 'combination']::text[], ARRAY['soothing', 'redness', 'hydration', 'sensitivity']::text[], 'lotion', 'fresh', 'low', TRUE, '수딩젤로션', '아토팜', FALSE, 'soothing_light', 320, 1025.00, '{"source":"hwahae_candidate","category":"moisturizer_lotion_emulsion","concern":"all","rank":5,"normalized_name":"수딩젤로션","normalized_brand":"아토팜","note":"official: soothing gel lotion for heated/red sensitive skin; all ages"}'::jsonb, 'https://www.hwahae.co.kr/goods/74198', '{"source":"hwahae_candidate","price":32800,"bundle_size_ml":320,"unit_price_per_10ml":1025.0,"external_url":"https://www.hwahae.co.kr/goods/74198","updated_at":"2026-05-26"}'::jsonb, '{"source":"web_manual_mapping","confidence":"medium","inferred_tags":["soothing","redness","hydration","sensitivity"],"source_note":"official: soothing gel lotion for heated/red sensitive skin; all ages"}'::jsonb, 'hwahae', 'goods', '74198', NULL),
  ('갈락토미세스 더마로션', '레스케미', 'moisturizer_lotion_emulsion', 39900, 39900, 'https://lesschemi.com/shop_view/?idx=13', NULL, ARRAY['dry', 'sensitive', 'normal']::text[], ARRAY['barrier', 'hydration', 'sensitivity', 'soothing']::text[], 'lotion', 'dewy', 'low', TRUE, '갈락토미세스더마로션', '레스케미', FALSE, 'sensitive_barrier', 290, 1375.86, '{"source":"hwahae_candidate","category":"moisturizer_lotion_emulsion","concern":"all","rank":7,"normalized_name":"갈락토미세스더마로션","normalized_brand":"레스케미","note":"official/news: galactomyces dermalotion for low-irritation moisturizing/barrier support"}'::jsonb, 'https://www.hwahae.co.kr/products/2178508', '{"source":"hwahae_candidate","price":39900,"bundle_size_ml":290,"unit_price_per_10ml":1375.86,"external_url":"https://www.hwahae.co.kr/products/2178508","updated_at":"2026-05-26"}'::jsonb, '{"source":"web_manual_mapping","confidence":"medium","inferred_tags":["barrier","hydration","sensitivity","soothing"],"source_note":"official/news: galactomyces dermalotion for low-irritation moisturizing/barrier support"}'::jsonb, 'hwahae', 'products', '2178508', NULL),
  ('판테놀 베리어 에멀전 150ml 더블기획(+판테놀 앰플 30ml 증정)', '코스노리', 'moisturizer_lotion_emulsion', 35600, 35600, 'https://www.oliveyoung.co.kr/store/G.do?goodsNo=A000000237493', NULL, ARRAY['dry', 'sensitive', 'normal']::text[], ARRAY['barrier', 'hydration', 'soothing', 'makeup_fit']::text[], 'lotion', 'dewy', 'low', TRUE, '판테놀베리어에멀전', '코스노리', FALSE, 'barrier_makeup_fit', 300, 1186.67, '{"source":"hwahae_candidate","category":"moisturizer_lotion_emulsion","concern":"all","rank":8,"normalized_name":"판테놀베리어에멀전","normalized_brand":"코스노리","note":"retailer/ingredient source: panthenol, ceramide family, hyaluronic acid, cica components"}'::jsonb, 'https://www.hwahae.co.kr/goods/77109', '{"source":"hwahae_candidate","price":35600,"bundle_size_ml":300,"unit_price_per_10ml":1186.67,"external_url":"https://www.hwahae.co.kr/goods/77109","updated_at":"2026-05-26"}'::jsonb, '{"source":"web_manual_mapping","confidence":"medium","inferred_tags":["barrier","hydration","soothing","makeup_fit"],"source_note":"retailer/ingredient source: panthenol, ceramide family, hyaluronic acid, cica components"}'::jsonb, 'hwahae', 'goods', '77109', 'https://www.hwahae.co.kr/goods/77109'),
  ('스킨 베리어 카밍 로션 EX 220ml', '온그리디언츠', 'moisturizer_lotion_emulsion', 28000, 28000, 'https://ongredients.cafe24.com/product/속광장벽-스킨-베리어-카밍-로션-ex-220ml/62/', NULL, ARRAY['all', 'sensitive', 'combination']::text[], ARRAY['barrier', 'hydration', 'soothing', 'dehydration']::text[], 'lotion', 'dewy', 'low', TRUE, '스킨베리어카밍로션ex', '온그리디언츠', FALSE, 'barrier_glow', 220, 1272.73, '{"source":"hwahae_candidate","category":"moisturizer_lotion_emulsion","concern":"all","rank":9,"normalized_name":"스킨베리어카밍로션ex","normalized_brand":"온그리디언츠","note":"official/costco: barrier calming lotion, all skin types, lotion step"}'::jsonb, 'https://www.hwahae.co.kr/goods/62643', '{"source":"hwahae_candidate","price":28000,"bundle_size_ml":220,"unit_price_per_10ml":1272.73,"external_url":"https://www.hwahae.co.kr/goods/62643","updated_at":"2026-05-26"}'::jsonb, '{"source":"web_manual_mapping","confidence":"medium","inferred_tags":["barrier","hydration","soothing","dehydration"],"source_note":"official/costco: barrier calming lotion, all skin types, lotion step"}'::jsonb, 'hwahae', 'goods', '62643', NULL),
  ('소나무 진정 시카 로션 250ml 기획 (+앰플15ml+마스크1매)', '라운드랩', 'moisturizer_lotion_emulsion', 15500, 15500, 'https://roundlab.co.kr/product/소나무-진정-시카-로션-250ml/220/', NULL, ARRAY['sensitive', 'combination', 'oily']::text[], ARRAY['soothing', 'redness', 'hydration', 'sensitivity']::text[], 'lotion', 'fresh', 'low', TRUE, '소나무진정시카로션기획', '라운드랩', FALSE, 'cica_soothing', 250, 620.00, '{"source":"hwahae_candidate","category":"moisturizer_lotion_emulsion","concern":"all","rank":11,"normalized_name":"소나무진정시카로션기획","normalized_brand":"라운드랩","note":"official/retailer: pine cica soothing lotion, light hydration"}'::jsonb, 'https://www.hwahae.co.kr/goods/75403', '{"source":"hwahae_candidate","price":15500,"bundle_size_ml":250,"unit_price_per_10ml":620.0,"external_url":"https://www.hwahae.co.kr/goods/75403","updated_at":"2026-05-26"}'::jsonb, '{"source":"web_manual_mapping","confidence":"medium","inferred_tags":["soothing","redness","hydration","sensitivity"],"source_note":"official/retailer: pine cica soothing lotion, light hydration"}'::jsonb, 'hwahae', 'goods', '75403', 'https://www.hwahae.co.kr/goods/75403'),
  ('블루빈 B5-PDRN 마일드 로션', '브링그린', 'moisturizer_lotion_emulsion', 21000, 21000, 'https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A000000234380', NULL, ARRAY['sensitive', 'combination', 'normal']::text[], ARRAY['barrier', 'hydration', 'sensitivity', 'soothing']::text[], 'lotion', 'fresh', 'low', TRUE, '블루빈b5pdrn마일드로션', '브링그린', FALSE, 'mild_barrier', 230, 913.04, '{"source":"hwahae_candidate","category":"moisturizer_lotion_emulsion","concern":"all","rank":12,"normalized_name":"블루빈b5pdrn마일드로션","normalized_brand":"브링그린","note":"retailer/news: Bluebean B5-PDRN for hydration/nutrition/barrier support"}'::jsonb, 'https://www.hwahae.co.kr/products/2158011', '{"source":"hwahae_candidate","price":21000,"bundle_size_ml":230,"unit_price_per_10ml":913.04,"external_url":"https://www.hwahae.co.kr/products/2158011","updated_at":"2026-05-26"}'::jsonb, '{"source":"web_manual_mapping","confidence":"medium","inferred_tags":["barrier","hydration","sensitivity","soothing"],"source_note":"retailer/news: Bluebean B5-PDRN for hydration/nutrition/barrier support"}'::jsonb, 'hwahae', 'products', '2158011', NULL),
  ('세라엠디 리페어 로션 400ml (2개) + 랜덤 바디로션 20ml (2개)', '더마비', 'moisturizer_lotion_emulsion', 32000, 32000, 'https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A000000216987', NULL, ARRAY['dry', 'sensitive', 'body']::text[], ARRAY['barrier', 'dryness', 'hydration', 'soothing']::text[], 'lotion', 'dewy', 'low', TRUE, '세라엠디리페어로션랜덤바디로션', '더마비', FALSE, 'body_barrier', 840, 380.95, '{"source":"hwahae_candidate","category":"moisturizer_lotion_emulsion","concern":"all","rank":13,"normalized_name":"세라엠디리페어로션랜덤바디로션","normalized_brand":"더마비","note":"retailer/news: Cerapanthe-some, ceramide/panthenol, low-irritation body/face lotion"}'::jsonb, 'https://www.hwahae.co.kr/goods/73272', '{"source":"hwahae_candidate","price":32000,"bundle_size_ml":840,"unit_price_per_10ml":380.95,"external_url":"https://www.hwahae.co.kr/goods/73272","updated_at":"2026-05-26"}'::jsonb, '{"source":"web_manual_mapping","confidence":"medium","inferred_tags":["barrier","dryness","hydration","soothing"],"source_note":"retailer/news: Cerapanthe-some, ceramide/panthenol, low-irritation body/face lotion"}'::jsonb, 'hwahae', 'goods', '73272', NULL),
  ('모이스춰라이징 로션', '세타필', 'moisturizer_lotion_emulsion', 15300, 15300, 'https://www.cetaphil.co.kr/moisturizers/모이스춰라이징-로션/KR_302990241333.html', NULL, ARRAY['dry', 'normal', 'sensitive']::text[], ARRAY['dryness', 'hydration', 'sensitivity', 'barrier']::text[], 'lotion', 'dewy', 'low', TRUE, '모이스춰라이징로션', '세타필', FALSE, 'basic_moisture', NULL, NULL, '{"source":"hwahae_candidate","category":"moisturizer_lotion_emulsion","concern":"all","rank":14,"normalized_name":"모이스춰라이징로션","normalized_brand":"세타필","note":"official: dry to normal sensitive skin, 48h hydration, niacinamide/panthenol/glycerin"}'::jsonb, 'https://www.hwahae.co.kr/products/1980180', '{"source":"hwahae_candidate","price":15300,"bundle_size_ml":null,"unit_price_per_10ml":null,"external_url":"https://www.hwahae.co.kr/products/1980180","updated_at":"2026-05-26"}'::jsonb, '{"source":"web_manual_mapping","confidence":"medium","inferred_tags":["dryness","hydration","sensitivity","barrier"],"source_note":"official: dry to normal sensitive skin, 48h hydration, niacinamide/panthenol/glycerin"}'::jsonb, 'hwahae', 'products', '1980180', NULL),
  ('세라마이드 릴리프 하이드레이션 에멀젼 120ml', 'YBK', 'moisturizer_lotion_emulsion', 22400, 22400, 'https://ybk-cosmetics.com/product/세라마이드-릴리프-하이드레이션-에멀젼-120ml/9/', NULL, ARRAY['sensitive', 'combination', 'normal']::text[], ARRAY['barrier', 'hydration', 'soothing', 'oil_water_balance']::text[], 'lotion', 'fresh', 'low', TRUE, '세라마이드릴리프하이드레이션에멀젼', 'ybk', FALSE, 'ceramide_emulsion', 120, 1866.67, '{"source":"hwahae_candidate","category":"moisturizer_lotion_emulsion","concern":"all","rank":15,"normalized_name":"세라마이드릴리프하이드레이션에멀젼","normalized_brand":"ybk","note":"official: ceramide relief hydration emulsion for sensitive calming and oil-water balance"}'::jsonb, 'https://www.hwahae.co.kr/goods/33374', '{"source":"hwahae_candidate","price":22400,"bundle_size_ml":120,"unit_price_per_10ml":1866.67,"external_url":"https://www.hwahae.co.kr/goods/33374","updated_at":"2026-05-26"}'::jsonb, '{"source":"web_manual_mapping","confidence":"medium","inferred_tags":["barrier","hydration","soothing","oil_water_balance"],"source_note":"official: ceramide relief hydration emulsion for sensitive calming and oil-water balance"}'::jsonb, 'hwahae', 'goods', '33374', NULL),
  ('서양송악 순수 로션 450ml', '퓨어솜', 'moisturizer_lotion_emulsion', 23500, 23500, 'https://puresomme.com/product/detail.html?product_no=32', NULL, ARRAY['sensitive', 'all', 'body']::text[], ARRAY['soothing', 'sensitivity', 'hydration', 'barrier']::text[], 'lotion', 'fresh', 'low', TRUE, '서양송악순수로션', '퓨어솜', FALSE, 'sensitive_large', 450, 522.22, '{"source":"hwahae_candidate","category":"moisturizer_lotion_emulsion","concern":"all","rank":17,"normalized_name":"서양송악순수로션","normalized_brand":"퓨어솜","note":"official: low-irritation 0.00, EWG green, no 20 caution ingredients/allergens"}'::jsonb, 'https://www.hwahae.co.kr/goods/71802', '{"source":"hwahae_candidate","price":23500,"bundle_size_ml":450,"unit_price_per_10ml":522.22,"external_url":"https://www.hwahae.co.kr/goods/71802","updated_at":"2026-05-26"}'::jsonb, '{"source":"web_manual_mapping","confidence":"medium","inferred_tags":["soothing","sensitivity","hydration","barrier"],"source_note":"official: low-irritation 0.00, EWG green, no 20 caution ingredients/allergens"}'::jsonb, 'hwahae', 'goods', '71802', NULL),
  ('울트라 페이셜 모이스처라이징 로션 80g', '시드물', 'moisturizer_lotion_emulsion', 9900, 9900, 'https://www.hwahae.co.kr/goods/6129', NULL, ARRAY['dry', 'sensitive', 'normal']::text[], ARRAY['hydration', 'dryness', 'brightening', 'sensitivity']::text[], 'lotion', 'dewy', 'low', TRUE, '울트라페이셜모이스처라이징로션', '시드물', FALSE, 'facial_moisture', 80, 1237.50, '{"source":"hwahae_candidate","category":"moisturizer_lotion_emulsion","concern":"all","rank":18,"normalized_name":"울트라페이셜모이스처라이징로션","normalized_brand":"시드물","note":"retailer/price source: dry skin, brightening functional, moisture supply"}'::jsonb, 'https://www.hwahae.co.kr/goods/6129', '{"source":"hwahae_candidate","price":9900,"bundle_size_ml":80,"unit_price_per_10ml":1237.5,"external_url":"https://www.hwahae.co.kr/goods/6129","updated_at":"2026-05-26"}'::jsonb, '{"source":"web_manual_mapping","confidence":"medium","inferred_tags":["hydration","dryness","brightening","sensitivity"],"source_note":"retailer/price source: dry skin, brightening functional, moisture supply"}'::jsonb, 'hwahae', 'goods', '6129', NULL),
  ('수딩 로션', '제로이드', 'moisturizer_lotion_emulsion', 32000, 32000, 'https://www.zeroid.co.kr/web/product/product_detail.asp?idx=324', NULL, ARRAY['sensitive', 'dry', 'normal']::text[], ARRAY['barrier', 'sensitivity', 'soothing', 'hydration']::text[], 'lotion', 'fresh', 'low', TRUE, '수딩로션', '제로이드', FALSE, 'derma_barrier', 160, 2000.00, '{"source":"hwahae_candidate","category":"moisturizer_lotion_emulsion","concern":"all","rank":19,"normalized_name":"수딩로션","normalized_brand":"제로이드","note":"official: MLE barrier technology, defensamide, low-irritation soothing lotion"}'::jsonb, 'https://www.hwahae.co.kr/products/1818570', '{"source":"hwahae_candidate","price":32000,"bundle_size_ml":160,"unit_price_per_10ml":2000.0,"external_url":"https://www.hwahae.co.kr/products/1818570","updated_at":"2026-05-26"}'::jsonb, '{"source":"web_manual_mapping","confidence":"medium","inferred_tags":["barrier","sensitivity","soothing","hydration"],"source_note":"official: MLE barrier technology, defensamide, low-irritation soothing lotion"}'::jsonb, 'hwahae', 'products', '1818570', NULL),
  ('탄탄 모공 펩타노산™ 단백질 로션 120ml', '스킨웨이비', 'moisturizer_lotion_emulsion', 29700, 29700, 'https://skinwavey.co.kr/product/탄탄-모공-펩타노산-단백질-로션/55/', NULL, ARRAY['combination', 'oily', 'normal']::text[], ARRAY['pores', 'elasticity', 'hydration', 'texture']::text[], 'lotion', 'dewy', 'medium', TRUE, '탄탄모공펩타노산단백질로션', '스킨웨이비', FALSE, 'pore_elasticity', 120, 2475.00, '{"source":"hwahae_candidate","category":"moisturizer_lotion_emulsion","concern":"all","rank":20,"normalized_name":"탄탄모공펩타노산단백질로션","normalized_brand":"스킨웨이비","note":"official: Peptanosan/oat peptide, pore elasticity, 100h moisture, anti-glycation positioning"}'::jsonb, 'https://www.hwahae.co.kr/goods/72564', '{"source":"hwahae_candidate","price":29700,"bundle_size_ml":120,"unit_price_per_10ml":2475.0,"external_url":"https://www.hwahae.co.kr/goods/72564","updated_at":"2026-05-26"}'::jsonb, '{"source":"web_manual_mapping","confidence":"medium","inferred_tags":["pores","elasticity","hydration","texture"],"source_note":"official: Peptanosan/oat peptide, pore elasticity, 100h moisture, anti-glycation positioning"}'::jsonb, 'hwahae', 'goods', '72564', NULL)
)
INSERT INTO products (
  id,
  name,
  brand,
  category,
  price_min,
  price_max,
  buy_link,
  image_url,
  skin_types,
  concerns,
  texture,
  finish,
  irritation_risk,
  sensitivity_safe,
  normalized_name,
  normalized_brand,
  is_mens,
  recommendation_tier,
  size_ml,
  unit_price_per_10ml,
  review_signals,
  hwahae_url,
  market_signals,
  ingredient_signals,
  external_source,
  external_type,
  external_id,
  source_url,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  r.name,
  r.brand,
  r.category::public.product_category,
  r.price_min,
  r.price_max,
  r.buy_link,
  r.image_url,
  (
    SELECT coalesce(array_agg(DISTINCT mapped_skin_type), ARRAY['combination']::text[])
    FROM (
      SELECT unnest(case skin_type
        when 'all' then ARRAY['oily', 'dry', 'combination', 'sensitive']
        when 'normal' then ARRAY['combination']
        when 'body' then ARRAY[]::text[]
        else ARRAY[skin_type]
      end) as mapped_skin_type
      FROM unnest(r.skin_types) as skin_type
    ) mapped
    WHERE mapped_skin_type = ANY (ARRAY[
      'oily',
      'dry',
      'combination',
      'sensitive'
    ]::text[])
  ),
  (
    SELECT coalesce(array_agg(DISTINCT mapped_concern), ARRAY['dehydration']::text[])
    FROM (
      SELECT case concern
        when 'dryness' then 'dehydration'
        when 'hydration' then 'dehydration'
        when 'sensitivity' then 'redness'
        when 'soothing' then 'redness'
        when 'oil_water_balance' then 'oiliness'
        when 'makeup_fit' then 'pores'
        when 'elasticity' then 'uneven_tone'
        when 'texture' then 'pores'
        else concern
      end as mapped_concern
      FROM unnest(r.concerns) as concern
    ) mapped
    WHERE mapped_concern = ANY (ARRAY[
      'oiliness',
      'dehydration',
      'acne',
      'uneven_tone',
      'pores',
      'redness',
      'barrier'
    ]::text[])
  ),
  r.texture::public.product_texture,
  r.finish::public.product_finish,
  r.irritation_risk,
  r.sensitivity_safe,
  r.normalized_name,
  r.normalized_brand,
  r.is_mens,
  r.recommendation_tier,
  r.size_ml,
  r.unit_price_per_10ml,
  r.review_signals,
  r.hwahae_url,
  r.market_signals,
  r.ingredient_signals,
  r.external_source,
  r.external_type,
  r.external_id,
  r.source_url,
  now(),
  now()
FROM rows r
WHERE NOT EXISTS (
  SELECT 1
  FROM products p
  WHERE p.external_source = r.external_source
    AND p.external_type = r.external_type
    AND p.external_id = r.external_id
);
