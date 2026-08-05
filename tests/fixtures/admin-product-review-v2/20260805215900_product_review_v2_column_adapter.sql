begin;

create type public.cleansing_profile_type as enum (
  'low_ph',
  'balanced',
  'deep_clean'
);

alter table public.products
  add column cleansing_profile public.cleansing_profile_type;

commit;
