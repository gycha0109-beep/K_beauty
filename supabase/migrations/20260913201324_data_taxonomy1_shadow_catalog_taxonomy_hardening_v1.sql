begin;

alter table public.catalog_taxonomy_versions
  add column retired_at timestamptz;

alter table public.catalog_taxonomy_versions
  drop constraint catalog_taxonomy_versions_activation_check;

alter table public.catalog_taxonomy_versions
  add constraint catalog_taxonomy_versions_lifecycle_timestamps_check
  check (
    (lifecycle_state in ('draft','shadow') and activated_at is null and retired_at is null)
    or (lifecycle_state = 'active' and activated_at is not null and retired_at is null)
    or (lifecycle_state = 'retired' and retired_at is not null)
  );

comment on column public.catalog_taxonomy_versions.activated_at is
  'First canonical activation timestamp; remains preserved after retirement when the version was previously active.';
comment on column public.catalog_taxonomy_versions.retired_at is
  'Retirement timestamp. A retired version may have never been activated, or may retain its historical activated_at.';

alter table public.catalog_taxonomy_relations
  drop constraint catalog_taxonomy_relations_type_check;

update public.catalog_taxonomy_relations
set relation_type = 'supports_capability',
    metadata = metadata || '{"semantics":"applicability_only_not_product_fact"}'::jsonb
where relation_type = 'has_capability';

alter table public.catalog_taxonomy_relations
  add constraint catalog_taxonomy_relations_type_check
  check (relation_type in ('belongs_to','allowed_form_for','supports_capability'));

comment on column public.catalog_taxonomy_relations.relation_type is
  'belongs_to and allowed_form_for express taxonomy structure. supports_capability means the taxonomy node may support that attribute/fact dimension; it is never evidence that an individual Product actually has the capability.';

commit;
