-- LOCAL-ONLY REPLAY ADAPTER.
--
-- The tracked 20260526 operational insert requires these columns, but no
-- earlier tracked production migration creates them. This adapter is placed
-- immediately before that file in the generated local replay workspace.
-- It does not claim that all columns were introduced together historically.

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
