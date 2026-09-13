begin;

create table public.catalog_taxonomy_versions (
  version text primary key,
  lifecycle_state text not null,
  authority_mode text not null,
  schema_version integer not null default 1,
  description text not null,
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  constraint catalog_taxonomy_versions_version_check
    check (version ~ '^[a-z0-9][a-z0-9._-]*$'),
  constraint catalog_taxonomy_versions_lifecycle_check
    check (lifecycle_state in ('draft','shadow','active','retired')),
  constraint catalog_taxonomy_versions_authority_check
    check (authority_mode in ('shadow_only','canonical')),
  constraint catalog_taxonomy_versions_activation_check
    check ((lifecycle_state = 'active') = (activated_at is not null))
);

comment on table public.catalog_taxonomy_versions is
  'Version authority for extensible catalog taxonomy. DATA-TAXONOMY1 creates shadow-only authority and does not replace products.category or Recommendation/Product Fact authority.';

create table public.catalog_taxonomy_terms (
  term_id text primary key,
  taxonomy_version text not null references public.catalog_taxonomy_versions(version) on delete cascade,
  axis text not null,
  term_key text not null,
  lifecycle_state text not null,
  display_label text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint catalog_taxonomy_terms_axis_check
    check (axis in ('entity_kind','domain','recommendation_family','category','form','capability')),
  constraint catalog_taxonomy_terms_key_check
    check (term_key ~ '^[a-z0-9][a-z0-9_]*$'),
  constraint catalog_taxonomy_terms_lifecycle_check
    check (lifecycle_state in ('active','reserved','deprecated')),
  constraint catalog_taxonomy_terms_metadata_check
    check (jsonb_typeof(metadata) = 'object' and octet_length(metadata::text) <= 16384),
  constraint catalog_taxonomy_terms_id_check
    check (term_id = taxonomy_version || ':' || axis || ':' || term_key),
  constraint catalog_taxonomy_terms_version_axis_key_unique
    unique (taxonomy_version, axis, term_key),
  constraint catalog_taxonomy_terms_id_version_unique
    unique (term_id, taxonomy_version)
);

comment on table public.catalog_taxonomy_terms is
  'Registry-backed taxonomy vocabulary. Reserved terms are future vocabulary only and carry no runtime or Recommendation authority.';

create table public.catalog_taxonomy_relations (
  taxonomy_version text not null references public.catalog_taxonomy_versions(version) on delete cascade,
  source_term_id text not null,
  relation_type text not null,
  target_term_id text not null,
  lifecycle_state text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (taxonomy_version, source_term_id, relation_type, target_term_id),
  constraint catalog_taxonomy_relations_source_fk
    foreign key (source_term_id, taxonomy_version)
    references public.catalog_taxonomy_terms(term_id, taxonomy_version) on delete cascade,
  constraint catalog_taxonomy_relations_target_fk
    foreign key (target_term_id, taxonomy_version)
    references public.catalog_taxonomy_terms(term_id, taxonomy_version) on delete cascade,
  constraint catalog_taxonomy_relations_type_check
    check (relation_type in ('belongs_to','allowed_form_for','has_capability')),
  constraint catalog_taxonomy_relations_lifecycle_check
    check (lifecycle_state in ('active','reserved','deprecated')),
  constraint catalog_taxonomy_relations_metadata_check
    check (jsonb_typeof(metadata) = 'object' and octet_length(metadata::text) <= 16384),
  constraint catalog_taxonomy_relations_not_self_check
    check (source_term_id <> target_term_id)
);

comment on table public.catalog_taxonomy_relations is
  'Extensible relationships between taxonomy terms. This table is shadow metadata only in DATA-TAXONOMY1.';

create table public.catalog_taxonomy_legacy_projections (
  projection_key text primary key,
  taxonomy_version text not null references public.catalog_taxonomy_versions(version) on delete cascade,
  legacy_category public.product_category not null,
  legacy_product_form public.product_form,
  entity_kind_term_id text not null,
  domain_term_id text not null,
  recommendation_family_term_id text not null,
  category_term_id text not null,
  form_term_id text,
  lifecycle_state text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint catalog_taxonomy_legacy_projections_version_category_form_unique
    unique nulls not distinct (taxonomy_version, legacy_category, legacy_product_form),
  constraint catalog_taxonomy_legacy_projections_key_version_unique
    unique (projection_key, taxonomy_version),
  constraint catalog_taxonomy_legacy_projections_entity_kind_fk
    foreign key (entity_kind_term_id, taxonomy_version)
    references public.catalog_taxonomy_terms(term_id, taxonomy_version),
  constraint catalog_taxonomy_legacy_projections_domain_fk
    foreign key (domain_term_id, taxonomy_version)
    references public.catalog_taxonomy_terms(term_id, taxonomy_version),
  constraint catalog_taxonomy_legacy_projections_family_fk
    foreign key (recommendation_family_term_id, taxonomy_version)
    references public.catalog_taxonomy_terms(term_id, taxonomy_version),
  constraint catalog_taxonomy_legacy_projections_category_fk
    foreign key (category_term_id, taxonomy_version)
    references public.catalog_taxonomy_terms(term_id, taxonomy_version),
  constraint catalog_taxonomy_legacy_projections_form_fk
    foreign key (form_term_id, taxonomy_version)
    references public.catalog_taxonomy_terms(term_id, taxonomy_version),
  constraint catalog_taxonomy_legacy_projections_lifecycle_check
    check (lifecycle_state in ('active','deprecated')),
  constraint catalog_taxonomy_legacy_projections_metadata_check
    check (jsonb_typeof(metadata) = 'object' and octet_length(metadata::text) <= 16384),
  constraint catalog_taxonomy_legacy_projections_entity_kind_axis_check
    check (entity_kind_term_id like taxonomy_version || ':entity_kind:%'),
  constraint catalog_taxonomy_legacy_projections_domain_axis_check
    check (domain_term_id like taxonomy_version || ':domain:%'),
  constraint catalog_taxonomy_legacy_projections_family_axis_check
    check (recommendation_family_term_id like taxonomy_version || ':recommendation_family:%'),
  constraint catalog_taxonomy_legacy_projections_category_axis_check
    check (category_term_id like taxonomy_version || ':category:%'),
  constraint catalog_taxonomy_legacy_projections_form_axis_check
    check (form_term_id is null or form_term_id like taxonomy_version || ':form:%')
);

comment on table public.catalog_taxonomy_legacy_projections is
  'Bridge from legacy product_category/product_form into canonical taxonomy terms. Legacy enums remain current runtime authority until a later separately authorized cutover.';

create table public.product_catalog_taxonomy_assignments (
  product_id uuid not null references public.products(id) on delete cascade,
  taxonomy_version text not null references public.catalog_taxonomy_versions(version) on delete cascade,
  entity_kind_term_id text not null,
  domain_term_id text not null,
  recommendation_family_term_id text not null,
  category_term_id text not null,
  form_term_id text,
  legacy_projection_key text,
  assignment_state text not null default 'shadow',
  assignment_method text not null,
  source_snapshot jsonb not null,
  assigned_at timestamptz not null default now(),
  primary key (product_id, taxonomy_version),
  constraint product_catalog_taxonomy_assignments_entity_kind_fk
    foreign key (entity_kind_term_id, taxonomy_version)
    references public.catalog_taxonomy_terms(term_id, taxonomy_version),
  constraint product_catalog_taxonomy_assignments_domain_fk
    foreign key (domain_term_id, taxonomy_version)
    references public.catalog_taxonomy_terms(term_id, taxonomy_version),
  constraint product_catalog_taxonomy_assignments_family_fk
    foreign key (recommendation_family_term_id, taxonomy_version)
    references public.catalog_taxonomy_terms(term_id, taxonomy_version),
  constraint product_catalog_taxonomy_assignments_category_fk
    foreign key (category_term_id, taxonomy_version)
    references public.catalog_taxonomy_terms(term_id, taxonomy_version),
  constraint product_catalog_taxonomy_assignments_form_fk
    foreign key (form_term_id, taxonomy_version)
    references public.catalog_taxonomy_terms(term_id, taxonomy_version),
  constraint product_catalog_taxonomy_assignments_projection_fk
    foreign key (legacy_projection_key, taxonomy_version)
    references public.catalog_taxonomy_legacy_projections(projection_key, taxonomy_version),
  constraint product_catalog_taxonomy_assignments_state_check
    check (assignment_state in ('shadow','canonical','retired')),
  constraint product_catalog_taxonomy_assignments_method_check
    check (assignment_method in ('legacy_projection_v1','manual_review','source_classification')),
  constraint product_catalog_taxonomy_assignments_snapshot_check
    check (jsonb_typeof(source_snapshot) = 'object' and octet_length(source_snapshot::text) <= 16384),
  constraint product_catalog_taxonomy_assignments_entity_kind_axis_check
    check (entity_kind_term_id like taxonomy_version || ':entity_kind:%'),
  constraint product_catalog_taxonomy_assignments_domain_axis_check
    check (domain_term_id like taxonomy_version || ':domain:%'),
  constraint product_catalog_taxonomy_assignments_family_axis_check
    check (recommendation_family_term_id like taxonomy_version || ':recommendation_family:%'),
  constraint product_catalog_taxonomy_assignments_category_axis_check
    check (category_term_id like taxonomy_version || ':category:%'),
  constraint product_catalog_taxonomy_assignments_form_axis_check
    check (form_term_id is null or form_term_id like taxonomy_version || ':form:%')
);

comment on table public.product_catalog_taxonomy_assignments is
  'Shadow canonical taxonomy assignment per Product. DATA-TAXONOMY1 assignments do not participate in recommendation, Product Fact, offer, or public read paths.';

alter table public.catalog_taxonomy_versions enable row level security;
alter table public.catalog_taxonomy_terms enable row level security;
alter table public.catalog_taxonomy_relations enable row level security;
alter table public.catalog_taxonomy_legacy_projections enable row level security;
alter table public.product_catalog_taxonomy_assignments enable row level security;

revoke all on table public.catalog_taxonomy_versions from public, anon, authenticated, service_role;
revoke all on table public.catalog_taxonomy_terms from public, anon, authenticated, service_role;
revoke all on table public.catalog_taxonomy_relations from public, anon, authenticated, service_role;
revoke all on table public.catalog_taxonomy_legacy_projections from public, anon, authenticated, service_role;
revoke all on table public.product_catalog_taxonomy_assignments from public, anon, authenticated, service_role;

grant select on table public.catalog_taxonomy_versions to service_role;
grant select on table public.catalog_taxonomy_terms to service_role;
grant select on table public.catalog_taxonomy_relations to service_role;
grant select on table public.catalog_taxonomy_legacy_projections to service_role;
grant select on table public.product_catalog_taxonomy_assignments to service_role;

insert into public.catalog_taxonomy_versions (
  version, lifecycle_state, authority_mode, schema_version, description
) values (
  'catalog-taxonomy-v1',
  'shadow',
  'shadow_only',
  1,
  'Extensible catalog taxonomy shadow foundation. Legacy products.category/product_form remain runtime authority.'
);

insert into public.catalog_taxonomy_terms
  (term_id, taxonomy_version, axis, term_key, lifecycle_state, display_label, metadata)
values
  ('catalog-taxonomy-v1:entity_kind:cosmetic','catalog-taxonomy-v1','entity_kind','cosmetic','active','Cosmetic','{}'),
  ('catalog-taxonomy-v1:entity_kind:tool','catalog-taxonomy-v1','entity_kind','tool','reserved','Tool','{"future_scope":true}'),
  ('catalog-taxonomy-v1:entity_kind:device','catalog-taxonomy-v1','entity_kind','device','reserved','Device','{"future_scope":true}'),
  ('catalog-taxonomy-v1:entity_kind:accessory','catalog-taxonomy-v1','entity_kind','accessory','reserved','Accessory','{"future_scope":true}'),

  ('catalog-taxonomy-v1:domain:skincare','catalog-taxonomy-v1','domain','skincare','active','Skincare','{}'),
  ('catalog-taxonomy-v1:domain:makeup','catalog-taxonomy-v1','domain','makeup','reserved','Makeup','{"future_scope":true}'),
  ('catalog-taxonomy-v1:domain:bodycare','catalog-taxonomy-v1','domain','bodycare','reserved','Body Care','{"future_scope":true}'),
  ('catalog-taxonomy-v1:domain:haircare','catalog-taxonomy-v1','domain','haircare','reserved','Hair Care','{"future_scope":true}'),

  ('catalog-taxonomy-v1:recommendation_family:cleanser','catalog-taxonomy-v1','recommendation_family','cleanser','active','Cleanser','{}'),
  ('catalog-taxonomy-v1:recommendation_family:toner','catalog-taxonomy-v1','recommendation_family','toner','active','Toner','{}'),
  ('catalog-taxonomy-v1:recommendation_family:treatment','catalog-taxonomy-v1','recommendation_family','treatment','active','Treatment','{}'),
  ('catalog-taxonomy-v1:recommendation_family:moisturizer','catalog-taxonomy-v1','recommendation_family','moisturizer','active','Moisturizer','{}'),
  ('catalog-taxonomy-v1:recommendation_family:sunscreen','catalog-taxonomy-v1','recommendation_family','sunscreen','active','Sunscreen','{}'),
  ('catalog-taxonomy-v1:recommendation_family:mask','catalog-taxonomy-v1','recommendation_family','mask','reserved','Mask','{"future_scope":true}'),
  ('catalog-taxonomy-v1:recommendation_family:complexion','catalog-taxonomy-v1','recommendation_family','complexion','reserved','Complexion','{"future_scope":true}'),
  ('catalog-taxonomy-v1:recommendation_family:lip_makeup','catalog-taxonomy-v1','recommendation_family','lip_makeup','reserved','Lip Makeup','{"future_scope":true}'),
  ('catalog-taxonomy-v1:recommendation_family:skincare_tool','catalog-taxonomy-v1','recommendation_family','skincare_tool','reserved','Skincare Tool','{"future_scope":true}'),
  ('catalog-taxonomy-v1:recommendation_family:skincare_device','catalog-taxonomy-v1','recommendation_family','skincare_device','reserved','Skincare Device','{"future_scope":true}'),

  ('catalog-taxonomy-v1:category:cleanser','catalog-taxonomy-v1','category','cleanser','active','Cleanser','{}'),
  ('catalog-taxonomy-v1:category:toner','catalog-taxonomy-v1','category','toner','active','Toner','{}'),
  ('catalog-taxonomy-v1:category:treatment','catalog-taxonomy-v1','category','treatment','active','Treatment','{}'),
  ('catalog-taxonomy-v1:category:moisturizer','catalog-taxonomy-v1','category','moisturizer','active','Moisturizer','{}'),
  ('catalog-taxonomy-v1:category:sunscreen','catalog-taxonomy-v1','category','sunscreen','active','Sunscreen','{}'),
  ('catalog-taxonomy-v1:category:mask','catalog-taxonomy-v1','category','mask','reserved','Mask','{"future_scope":true}'),
  ('catalog-taxonomy-v1:category:foundation','catalog-taxonomy-v1','category','foundation','reserved','Foundation','{"future_scope":true}'),
  ('catalog-taxonomy-v1:category:lip_color','catalog-taxonomy-v1','category','lip_color','reserved','Lip Color','{"future_scope":true}'),
  ('catalog-taxonomy-v1:category:skincare_tool','catalog-taxonomy-v1','category','skincare_tool','reserved','Skincare Tool','{"future_scope":true}'),
  ('catalog-taxonomy-v1:category:skincare_device','catalog-taxonomy-v1','category','skincare_device','reserved','Skincare Device','{"future_scope":true}'),

  ('catalog-taxonomy-v1:form:pad','catalog-taxonomy-v1','form','pad','active','Pad','{}'),
  ('catalog-taxonomy-v1:form:serum','catalog-taxonomy-v1','form','serum','active','Serum','{}'),
  ('catalog-taxonomy-v1:form:ampoule','catalog-taxonomy-v1','form','ampoule','active','Ampoule','{}'),
  ('catalog-taxonomy-v1:form:essence','catalog-taxonomy-v1','form','essence','active','Essence','{}'),
  ('catalog-taxonomy-v1:form:booster','catalog-taxonomy-v1','form','booster','active','Booster','{"legacy_candidate_supported":true}'),
  ('catalog-taxonomy-v1:form:peeling_solution','catalog-taxonomy-v1','form','peeling_solution','active','Peeling Solution','{"legacy_candidate_supported":true}'),
  ('catalog-taxonomy-v1:form:lotion_emulsion','catalog-taxonomy-v1','form','lotion_emulsion','active','Lotion / Emulsion','{}'),
  ('catalog-taxonomy-v1:form:gel','catalog-taxonomy-v1','form','gel','active','Gel','{}'),
  ('catalog-taxonomy-v1:form:cream','catalog-taxonomy-v1','form','cream','active','Cream','{}'),
  ('catalog-taxonomy-v1:form:balm','catalog-taxonomy-v1','form','balm','active','Balm','{}'),
  ('catalog-taxonomy-v1:form:foam','catalog-taxonomy-v1','form','foam','reserved','Foam','{"future_scope":true}'),
  ('catalog-taxonomy-v1:form:oil','catalog-taxonomy-v1','form','oil','reserved','Oil','{"future_scope":true}'),
  ('catalog-taxonomy-v1:form:sheet','catalog-taxonomy-v1','form','sheet','reserved','Sheet','{"future_scope":true}'),
  ('catalog-taxonomy-v1:form:hydrogel','catalog-taxonomy-v1','form','hydrogel','reserved','Hydrogel','{"future_scope":true}'),
  ('catalog-taxonomy-v1:form:wash_off','catalog-taxonomy-v1','form','wash_off','reserved','Wash Off','{"future_scope":true}'),
  ('catalog-taxonomy-v1:form:sleeping','catalog-taxonomy-v1','form','sleeping','reserved','Sleeping','{"future_scope":true}'),
  ('catalog-taxonomy-v1:form:patch','catalog-taxonomy-v1','form','patch','reserved','Patch','{"future_scope":true}'),
  ('catalog-taxonomy-v1:form:cushion','catalog-taxonomy-v1','form','cushion','reserved','Cushion','{"future_scope":true}'),
  ('catalog-taxonomy-v1:form:stick','catalog-taxonomy-v1','form','stick','reserved','Stick','{"future_scope":true}'),
  ('catalog-taxonomy-v1:form:tint','catalog-taxonomy-v1','form','tint','reserved','Tint','{"future_scope":true}'),
  ('catalog-taxonomy-v1:form:roller','catalog-taxonomy-v1','form','roller','reserved','Roller','{"future_scope":true}'),
  ('catalog-taxonomy-v1:form:plate','catalog-taxonomy-v1','form','plate','reserved','Plate','{"future_scope":true}'),
  ('catalog-taxonomy-v1:form:wearable','catalog-taxonomy-v1','form','wearable','reserved','Wearable','{"future_scope":true}'),

  ('catalog-taxonomy-v1:capability:ingredient_composition','catalog-taxonomy-v1','capability','ingredient_composition','active','Ingredient Composition','{}'),
  ('catalog-taxonomy-v1:capability:skin_contact','catalog-taxonomy-v1','capability','skin_contact','active','Skin Contact','{}'),
  ('catalog-taxonomy-v1:capability:uv_protection_claim','catalog-taxonomy-v1','capability','uv_protection_claim','active','UV Protection Claim','{}'),
  ('catalog-taxonomy-v1:capability:rinse_off','catalog-taxonomy-v1','capability','rinse_off','active','Rinse Off','{}'),
  ('catalog-taxonomy-v1:capability:leave_on','catalog-taxonomy-v1','capability','leave_on','active','Leave On','{}'),
  ('catalog-taxonomy-v1:capability:shade_variant','catalog-taxonomy-v1','capability','shade_variant','reserved','Shade Variant','{"future_scope":true}'),
  ('catalog-taxonomy-v1:capability:reusable','catalog-taxonomy-v1','capability','reusable','reserved','Reusable','{"future_scope":true}'),
  ('catalog-taxonomy-v1:capability:powered_device','catalog-taxonomy-v1','capability','powered_device','reserved','Powered Device','{"future_scope":true}');

insert into public.catalog_taxonomy_relations
  (taxonomy_version, source_term_id, relation_type, target_term_id, lifecycle_state)
values
  ('catalog-taxonomy-v1','catalog-taxonomy-v1:category:cleanser','belongs_to','catalog-taxonomy-v1:recommendation_family:cleanser','active'),
  ('catalog-taxonomy-v1','catalog-taxonomy-v1:category:toner','belongs_to','catalog-taxonomy-v1:recommendation_family:toner','active'),
  ('catalog-taxonomy-v1','catalog-taxonomy-v1:category:treatment','belongs_to','catalog-taxonomy-v1:recommendation_family:treatment','active'),
  ('catalog-taxonomy-v1','catalog-taxonomy-v1:category:moisturizer','belongs_to','catalog-taxonomy-v1:recommendation_family:moisturizer','active'),
  ('catalog-taxonomy-v1','catalog-taxonomy-v1:category:sunscreen','belongs_to','catalog-taxonomy-v1:recommendation_family:sunscreen','active'),
  ('catalog-taxonomy-v1','catalog-taxonomy-v1:category:mask','belongs_to','catalog-taxonomy-v1:recommendation_family:mask','reserved'),
  ('catalog-taxonomy-v1','catalog-taxonomy-v1:category:foundation','belongs_to','catalog-taxonomy-v1:recommendation_family:complexion','reserved'),
  ('catalog-taxonomy-v1','catalog-taxonomy-v1:category:lip_color','belongs_to','catalog-taxonomy-v1:recommendation_family:lip_makeup','reserved'),
  ('catalog-taxonomy-v1','catalog-taxonomy-v1:category:skincare_tool','belongs_to','catalog-taxonomy-v1:recommendation_family:skincare_tool','reserved'),
  ('catalog-taxonomy-v1','catalog-taxonomy-v1:category:skincare_device','belongs_to','catalog-taxonomy-v1:recommendation_family:skincare_device','reserved'),

  ('catalog-taxonomy-v1','catalog-taxonomy-v1:form:pad','allowed_form_for','catalog-taxonomy-v1:category:toner','active'),
  ('catalog-taxonomy-v1','catalog-taxonomy-v1:form:serum','allowed_form_for','catalog-taxonomy-v1:category:treatment','active'),
  ('catalog-taxonomy-v1','catalog-taxonomy-v1:form:ampoule','allowed_form_for','catalog-taxonomy-v1:category:treatment','active'),
  ('catalog-taxonomy-v1','catalog-taxonomy-v1:form:essence','allowed_form_for','catalog-taxonomy-v1:category:treatment','active'),
  ('catalog-taxonomy-v1','catalog-taxonomy-v1:form:booster','allowed_form_for','catalog-taxonomy-v1:category:treatment','active'),
  ('catalog-taxonomy-v1','catalog-taxonomy-v1:form:peeling_solution','allowed_form_for','catalog-taxonomy-v1:category:treatment','active'),
  ('catalog-taxonomy-v1','catalog-taxonomy-v1:form:lotion_emulsion','allowed_form_for','catalog-taxonomy-v1:category:moisturizer','active'),
  ('catalog-taxonomy-v1','catalog-taxonomy-v1:form:gel','allowed_form_for','catalog-taxonomy-v1:category:moisturizer','active'),
  ('catalog-taxonomy-v1','catalog-taxonomy-v1:form:cream','allowed_form_for','catalog-taxonomy-v1:category:moisturizer','active'),
  ('catalog-taxonomy-v1','catalog-taxonomy-v1:form:balm','allowed_form_for','catalog-taxonomy-v1:category:moisturizer','active'),
  ('catalog-taxonomy-v1','catalog-taxonomy-v1:form:foam','allowed_form_for','catalog-taxonomy-v1:category:cleanser','reserved'),
  ('catalog-taxonomy-v1','catalog-taxonomy-v1:form:oil','allowed_form_for','catalog-taxonomy-v1:category:cleanser','reserved'),
  ('catalog-taxonomy-v1','catalog-taxonomy-v1:form:sheet','allowed_form_for','catalog-taxonomy-v1:category:mask','reserved'),
  ('catalog-taxonomy-v1','catalog-taxonomy-v1:form:hydrogel','allowed_form_for','catalog-taxonomy-v1:category:mask','reserved'),
  ('catalog-taxonomy-v1','catalog-taxonomy-v1:form:wash_off','allowed_form_for','catalog-taxonomy-v1:category:mask','reserved'),
  ('catalog-taxonomy-v1','catalog-taxonomy-v1:form:sleeping','allowed_form_for','catalog-taxonomy-v1:category:mask','reserved'),
  ('catalog-taxonomy-v1','catalog-taxonomy-v1:form:patch','allowed_form_for','catalog-taxonomy-v1:category:mask','reserved'),
  ('catalog-taxonomy-v1','catalog-taxonomy-v1:form:cushion','allowed_form_for','catalog-taxonomy-v1:category:foundation','reserved'),
  ('catalog-taxonomy-v1','catalog-taxonomy-v1:form:stick','allowed_form_for','catalog-taxonomy-v1:category:foundation','reserved'),
  ('catalog-taxonomy-v1','catalog-taxonomy-v1:form:tint','allowed_form_for','catalog-taxonomy-v1:category:lip_color','reserved'),
  ('catalog-taxonomy-v1','catalog-taxonomy-v1:form:roller','allowed_form_for','catalog-taxonomy-v1:category:skincare_tool','reserved'),
  ('catalog-taxonomy-v1','catalog-taxonomy-v1:form:plate','allowed_form_for','catalog-taxonomy-v1:category:skincare_tool','reserved'),
  ('catalog-taxonomy-v1','catalog-taxonomy-v1:form:wearable','allowed_form_for','catalog-taxonomy-v1:category:skincare_device','reserved'),

  ('catalog-taxonomy-v1','catalog-taxonomy-v1:category:cleanser','has_capability','catalog-taxonomy-v1:capability:ingredient_composition','active'),
  ('catalog-taxonomy-v1','catalog-taxonomy-v1:category:cleanser','has_capability','catalog-taxonomy-v1:capability:skin_contact','active'),
  ('catalog-taxonomy-v1','catalog-taxonomy-v1:category:cleanser','has_capability','catalog-taxonomy-v1:capability:rinse_off','active'),
  ('catalog-taxonomy-v1','catalog-taxonomy-v1:category:toner','has_capability','catalog-taxonomy-v1:capability:ingredient_composition','active'),
  ('catalog-taxonomy-v1','catalog-taxonomy-v1:category:toner','has_capability','catalog-taxonomy-v1:capability:skin_contact','active'),
  ('catalog-taxonomy-v1','catalog-taxonomy-v1:category:toner','has_capability','catalog-taxonomy-v1:capability:leave_on','active'),
  ('catalog-taxonomy-v1','catalog-taxonomy-v1:category:treatment','has_capability','catalog-taxonomy-v1:capability:ingredient_composition','active'),
  ('catalog-taxonomy-v1','catalog-taxonomy-v1:category:treatment','has_capability','catalog-taxonomy-v1:capability:skin_contact','active'),
  ('catalog-taxonomy-v1','catalog-taxonomy-v1:category:treatment','has_capability','catalog-taxonomy-v1:capability:leave_on','active'),
  ('catalog-taxonomy-v1','catalog-taxonomy-v1:category:moisturizer','has_capability','catalog-taxonomy-v1:capability:ingredient_composition','active'),
  ('catalog-taxonomy-v1','catalog-taxonomy-v1:category:moisturizer','has_capability','catalog-taxonomy-v1:capability:skin_contact','active'),
  ('catalog-taxonomy-v1','catalog-taxonomy-v1:category:moisturizer','has_capability','catalog-taxonomy-v1:capability:leave_on','active'),
  ('catalog-taxonomy-v1','catalog-taxonomy-v1:category:sunscreen','has_capability','catalog-taxonomy-v1:capability:ingredient_composition','active'),
  ('catalog-taxonomy-v1','catalog-taxonomy-v1:category:sunscreen','has_capability','catalog-taxonomy-v1:capability:skin_contact','active'),
  ('catalog-taxonomy-v1','catalog-taxonomy-v1:category:sunscreen','has_capability','catalog-taxonomy-v1:capability:leave_on','active'),
  ('catalog-taxonomy-v1','catalog-taxonomy-v1:category:sunscreen','has_capability','catalog-taxonomy-v1:capability:uv_protection_claim','active'),
  ('catalog-taxonomy-v1','catalog-taxonomy-v1:category:mask','has_capability','catalog-taxonomy-v1:capability:ingredient_composition','reserved'),
  ('catalog-taxonomy-v1','catalog-taxonomy-v1:category:mask','has_capability','catalog-taxonomy-v1:capability:skin_contact','reserved'),
  ('catalog-taxonomy-v1','catalog-taxonomy-v1:category:foundation','has_capability','catalog-taxonomy-v1:capability:ingredient_composition','reserved'),
  ('catalog-taxonomy-v1','catalog-taxonomy-v1:category:foundation','has_capability','catalog-taxonomy-v1:capability:skin_contact','reserved'),
  ('catalog-taxonomy-v1','catalog-taxonomy-v1:category:foundation','has_capability','catalog-taxonomy-v1:capability:shade_variant','reserved'),
  ('catalog-taxonomy-v1','catalog-taxonomy-v1:category:lip_color','has_capability','catalog-taxonomy-v1:capability:ingredient_composition','reserved'),
  ('catalog-taxonomy-v1','catalog-taxonomy-v1:category:lip_color','has_capability','catalog-taxonomy-v1:capability:skin_contact','reserved'),
  ('catalog-taxonomy-v1','catalog-taxonomy-v1:category:lip_color','has_capability','catalog-taxonomy-v1:capability:shade_variant','reserved'),
  ('catalog-taxonomy-v1','catalog-taxonomy-v1:category:skincare_tool','has_capability','catalog-taxonomy-v1:capability:skin_contact','reserved'),
  ('catalog-taxonomy-v1','catalog-taxonomy-v1:category:skincare_tool','has_capability','catalog-taxonomy-v1:capability:reusable','reserved'),
  ('catalog-taxonomy-v1','catalog-taxonomy-v1:category:skincare_device','has_capability','catalog-taxonomy-v1:capability:skin_contact','reserved'),
  ('catalog-taxonomy-v1','catalog-taxonomy-v1:category:skincare_device','has_capability','catalog-taxonomy-v1:capability:powered_device','reserved');

insert into public.catalog_taxonomy_legacy_projections
  (projection_key, taxonomy_version, legacy_category, legacy_product_form,
   entity_kind_term_id, domain_term_id, recommendation_family_term_id, category_term_id, form_term_id, metadata)
values
  ('catalog-taxonomy-v1:legacy:cleanser:none','catalog-taxonomy-v1','cleanser',null,
   'catalog-taxonomy-v1:entity_kind:cosmetic','catalog-taxonomy-v1:domain:skincare','catalog-taxonomy-v1:recommendation_family:cleanser','catalog-taxonomy-v1:category:cleanser',null,'{}'),
  ('catalog-taxonomy-v1:legacy:toner_essence:none','catalog-taxonomy-v1','toner_essence',null,
   'catalog-taxonomy-v1:entity_kind:cosmetic','catalog-taxonomy-v1:domain:skincare','catalog-taxonomy-v1:recommendation_family:toner','catalog-taxonomy-v1:category:toner',null,'{"legacy_semantics":"toner_essence remains unresolved at form axis"}'),
  ('catalog-taxonomy-v1:legacy:toner_pad:none','catalog-taxonomy-v1','toner_pad',null,
   'catalog-taxonomy-v1:entity_kind:cosmetic','catalog-taxonomy-v1:domain:skincare','catalog-taxonomy-v1:recommendation_family:toner','catalog-taxonomy-v1:category:toner','catalog-taxonomy-v1:form:pad','{}'),
  ('catalog-taxonomy-v1:legacy:treatment:serum','catalog-taxonomy-v1','treatment','serum',
   'catalog-taxonomy-v1:entity_kind:cosmetic','catalog-taxonomy-v1:domain:skincare','catalog-taxonomy-v1:recommendation_family:treatment','catalog-taxonomy-v1:category:treatment','catalog-taxonomy-v1:form:serum','{}'),
  ('catalog-taxonomy-v1:legacy:treatment:ampoule','catalog-taxonomy-v1','treatment','ampoule',
   'catalog-taxonomy-v1:entity_kind:cosmetic','catalog-taxonomy-v1:domain:skincare','catalog-taxonomy-v1:recommendation_family:treatment','catalog-taxonomy-v1:category:treatment','catalog-taxonomy-v1:form:ampoule','{}'),
  ('catalog-taxonomy-v1:legacy:treatment:essence','catalog-taxonomy-v1','treatment','essence',
   'catalog-taxonomy-v1:entity_kind:cosmetic','catalog-taxonomy-v1:domain:skincare','catalog-taxonomy-v1:recommendation_family:treatment','catalog-taxonomy-v1:category:treatment','catalog-taxonomy-v1:form:essence','{}'),
  ('catalog-taxonomy-v1:legacy:moisturizer_lotion_emulsion:none','catalog-taxonomy-v1','moisturizer_lotion_emulsion',null,
   'catalog-taxonomy-v1:entity_kind:cosmetic','catalog-taxonomy-v1:domain:skincare','catalog-taxonomy-v1:recommendation_family:moisturizer','catalog-taxonomy-v1:category:moisturizer','catalog-taxonomy-v1:form:lotion_emulsion','{}'),
  ('catalog-taxonomy-v1:legacy:moisturizer_gel:none','catalog-taxonomy-v1','moisturizer_gel',null,
   'catalog-taxonomy-v1:entity_kind:cosmetic','catalog-taxonomy-v1:domain:skincare','catalog-taxonomy-v1:recommendation_family:moisturizer','catalog-taxonomy-v1:category:moisturizer','catalog-taxonomy-v1:form:gel','{}'),
  ('catalog-taxonomy-v1:legacy:moisturizer_cream:none','catalog-taxonomy-v1','moisturizer_cream',null,
   'catalog-taxonomy-v1:entity_kind:cosmetic','catalog-taxonomy-v1:domain:skincare','catalog-taxonomy-v1:recommendation_family:moisturizer','catalog-taxonomy-v1:category:moisturizer','catalog-taxonomy-v1:form:cream','{}'),
  ('catalog-taxonomy-v1:legacy:moisturizer_balm:none','catalog-taxonomy-v1','moisturizer_balm',null,
   'catalog-taxonomy-v1:entity_kind:cosmetic','catalog-taxonomy-v1:domain:skincare','catalog-taxonomy-v1:recommendation_family:moisturizer','catalog-taxonomy-v1:category:moisturizer','catalog-taxonomy-v1:form:balm','{}'),
  ('catalog-taxonomy-v1:legacy:sunscreen:none','catalog-taxonomy-v1','sunscreen',null,
   'catalog-taxonomy-v1:entity_kind:cosmetic','catalog-taxonomy-v1:domain:skincare','catalog-taxonomy-v1:recommendation_family:sunscreen','catalog-taxonomy-v1:category:sunscreen',null,'{}');

do $$
declare
  v_total integer;
  v_mapped integer;
begin
  select count(*) into v_total from public.products;
  select count(*) into v_mapped
  from public.products p
  join public.catalog_taxonomy_legacy_projections lp
    on lp.taxonomy_version = 'catalog-taxonomy-v1'
   and lp.lifecycle_state = 'active'
   and lp.legacy_category = p.category
   and lp.legacy_product_form is not distinct from p.product_form;

  if v_total <> v_mapped then
    raise exception 'DATA_TAXONOMY1_UNMAPPED_PRODUCTS total=% mapped=%', v_total, v_mapped;
  end if;
end;
$$;

insert into public.product_catalog_taxonomy_assignments (
  product_id, taxonomy_version,
  entity_kind_term_id, domain_term_id, recommendation_family_term_id,
  category_term_id, form_term_id, legacy_projection_key,
  assignment_state, assignment_method, source_snapshot
)
select
  p.id,
  lp.taxonomy_version,
  lp.entity_kind_term_id,
  lp.domain_term_id,
  lp.recommendation_family_term_id,
  lp.category_term_id,
  lp.form_term_id,
  lp.projection_key,
  'shadow',
  'legacy_projection_v1',
  jsonb_build_object(
    'legacy_category', p.category::text,
    'legacy_product_form', p.product_form::text,
    'product_updated_at', p.updated_at,
    'authority', 'products.category/product_form'
  )
from public.products p
join public.catalog_taxonomy_legacy_projections lp
  on lp.taxonomy_version = 'catalog-taxonomy-v1'
 and lp.lifecycle_state = 'active'
 and lp.legacy_category = p.category
 and lp.legacy_product_form is not distinct from p.product_form;

create view public.catalog_taxonomy_shadow_read_v1
with (security_invoker = true)
as
select
  a.product_id,
  a.taxonomy_version,
  p.category as legacy_category,
  p.product_form as legacy_product_form,
  ek.term_key as entity_kind,
  d.term_key as domain,
  rf.term_key as recommendation_family,
  c.term_key as canonical_category,
  f.term_key as canonical_form,
  a.assignment_state,
  a.assignment_method,
  lp.projection_key,
  (p.category = lp.legacy_category and p.product_form is not distinct from lp.legacy_product_form) as exact_legacy_projection
from public.product_catalog_taxonomy_assignments a
join public.products p on p.id = a.product_id
join public.catalog_taxonomy_legacy_projections lp
  on lp.projection_key = a.legacy_projection_key
 and lp.taxonomy_version = a.taxonomy_version
join public.catalog_taxonomy_terms ek on ek.term_id = a.entity_kind_term_id
join public.catalog_taxonomy_terms d on d.term_id = a.domain_term_id
join public.catalog_taxonomy_terms rf on rf.term_id = a.recommendation_family_term_id
join public.catalog_taxonomy_terms c on c.term_id = a.category_term_id
left join public.catalog_taxonomy_terms f on f.term_id = a.form_term_id;

comment on view public.catalog_taxonomy_shadow_read_v1 is
  'Service-role audit projection for DATA-TAXONOMY1. Not a public or Recommendation runtime read path.';

revoke all on table public.catalog_taxonomy_shadow_read_v1 from public, anon, authenticated, service_role;
grant select on table public.catalog_taxonomy_shadow_read_v1 to service_role;

do $$
declare
  v_products integer;
  v_assignments integer;
  v_mismatch integer;
  v_non_active_assignment_terms integer;
begin
  select count(*) into v_products from public.products;
  select count(*) into v_assignments
  from public.product_catalog_taxonomy_assignments
  where taxonomy_version = 'catalog-taxonomy-v1' and assignment_state = 'shadow';

  select count(*) into v_mismatch
  from public.catalog_taxonomy_shadow_read_v1
  where taxonomy_version = 'catalog-taxonomy-v1'
    and exact_legacy_projection is not true;

  select count(*) into v_non_active_assignment_terms
  from public.product_catalog_taxonomy_assignments a
  join lateral (
    values (a.entity_kind_term_id), (a.domain_term_id), (a.recommendation_family_term_id),
           (a.category_term_id), (a.form_term_id)
  ) x(term_id) on x.term_id is not null
  join public.catalog_taxonomy_terms t on t.term_id = x.term_id
  where a.taxonomy_version = 'catalog-taxonomy-v1'
    and t.lifecycle_state <> 'active';

  if v_products <> v_assignments or v_mismatch <> 0 or v_non_active_assignment_terms <> 0 then
    raise exception 'DATA_TAXONOMY1_POSTCHECK_FAILED products=% assignments=% mismatch=% non_active_terms=%',
      v_products, v_assignments, v_mismatch, v_non_active_assignment_terms;
  end if;
end;
$$;

commit;
