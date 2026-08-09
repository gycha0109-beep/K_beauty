-- TEST / LOCAL REPLAY ONLY.
-- NOT A PRODUCTION MIGRATION.
--
-- Compatibility bridge anchored immediately before
-- 20260526_moisturizer_lotion_emulsion_insert.sql. The tracked insert consumes
-- these columns, but no earlier tracked migration in the pre-PF2 tree creates
-- them. This is a replay contract, not a historical provenance claim.

begin;

alter table public.products
  add column is_mens boolean not null default false,
  add column recommendation_tier text,
  add column size_ml numeric,
  add column unit_price_per_10ml numeric,
  add column hwahae_url text,
  add column external_source text,
  add column external_type text,
  add column external_id text,
  add column source_url text;

commit;
