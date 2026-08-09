-- TEST / LOCAL REPLAY ONLY.
-- NOT A PRODUCTION MIGRATION.
--
-- Compatibility bridge anchored immediately before
-- 20260524054049_reclassify_existing_moisturizers.sql. These actions model
-- tracked-chain prerequisites; they do not claim historical DDL identity.

alter type public.product_category add value if not exists 'toner_pad';
alter type public.product_category add value if not exists 'ampoule';
alter type public.product_category add value if not exists 'essence';

drop function public.map_product_category(text);
