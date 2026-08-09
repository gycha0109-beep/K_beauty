-- TEST / LOCAL REPLAY ONLY.
-- NOT A PRODUCTION MIGRATION.
--
-- Repository-owned mid-chain compatibility bridge anchored immediately before
-- 20260805220000_admin_product_review_cleanser_metadata_v2.sql. This reproduces
-- the approved Admin v2 prerequisite contract without claiming historical
-- Production or Hosted DDL identity.

begin;

create type public.cleansing_profile_type as enum (
  'low_ph',
  'balanced',
  'deep_clean'
);

alter table public.products
  add column cleansing_profile public.cleansing_profile_type;

commit;
