-- LOCAL-ONLY REPLAY ADAPTER.
--
-- The tracked 20260524054049 migration assumes three category enum labels
-- that are absent from the clean enum created by the tracked 20260410
-- migration. It also replaces map_product_category(text) while changing the
-- input parameter name from value to input, which PostgreSQL rejects unless
-- the prior function is dropped first.
--
-- Keep this adapter immediately before the tracked 20260524054049 migration.

alter type public.product_category add value if not exists 'toner_pad';
alter type public.product_category add value if not exists 'ampoule';
alter type public.product_category add value if not exists 'essence';

drop function public.map_product_category(text);
