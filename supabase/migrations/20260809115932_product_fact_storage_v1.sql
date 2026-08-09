begin;

-- Product Fact persistence v1 is an additive, zero-data schema migration.
-- Registry code/config remains semantic authority; these tables persist versioned
-- release bindings, reviewed subjects, evidence lineage, immutable Fact versions,
-- and operational review support without changing the existing Admin v1/v2 seam.

create extension if not exists pgcrypto with schema extensions;

create table public.product_fact_registry_versions (
  registry_version text primary key,
  registry_checksum text not null,
  identity_serializer_version text not null,
  effective_at timestamptz,
  created_at timestamptz not null default now(),
  constraint product_fact_registry_versions_version_check
    check (char_length(btrim(registry_version)) between 1 and 160),
  constraint product_fact_registry_versions_checksum_check
    check (registry_checksum ~ '^[0-9a-f]{64}$'),
  constraint product_fact_registry_versions_serializer_check
    check (char_length(btrim(identity_serializer_version)) between 1 and 160)
);

create table public.product_fact_definition_snapshots (
  registry_version text not null
    references public.product_fact_registry_versions(registry_version) on delete restrict,
  fact_key text not null,
  value_type text not null,
  definition jsonb not null,
  definition_checksum text not null,
  deprecated boolean not null default false,
  superseded_by_fact_key text,
  created_at timestamptz not null default now(),
  primary key (registry_version, fact_key),
  constraint product_fact_definition_snapshots_fact_key_check
    check (char_length(btrim(fact_key)) between 1 and 160),
  constraint product_fact_definition_snapshots_value_type_check
    check (value_type in (
      'boolean', 'enum', 'number', 'number_unit', 'range_unit', 'entity_identifier'
    )),
  constraint product_fact_definition_snapshots_definition_check
    check (jsonb_typeof(definition) = 'object' and octet_length(definition::text) <= 131072),
  constraint product_fact_definition_snapshots_checksum_check
    check (definition_checksum ~ '^[0-9a-f]{64}$'),
  constraint product_fact_definition_snapshots_supersession_check
    check (
      superseded_by_fact_key is null
      or char_length(btrim(superseded_by_fact_key)) between 1 and 160
    )
);

create table public.product_fact_subjects (
  subject_id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  subject_semantic_key text not null unique,
  subject_identity_serializer_version text not null,
  variant_key text,
  formulation_revision_key text not null,
  formulation_label text,
  identity_status text not null,
  identity_resolution_version text not null,
  current_state text not null,
  market_applicability text,
  region_applicability text,
  valid_from date,
  valid_to date,
  predecessor_subject_id uuid,
  supersession_kind text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_fact_subjects_subject_product_unique
    unique (subject_id, product_id),
  constraint product_fact_subjects_predecessor_product_fk
    foreign key (predecessor_subject_id, product_id)
    references public.product_fact_subjects(subject_id, product_id) on delete restrict,
  constraint product_fact_subjects_semantic_key_check
    check (subject_semantic_key ~ '^[0-9a-f]{64}$'),
  constraint product_fact_subjects_serializer_check
    check (char_length(btrim(subject_identity_serializer_version)) between 1 and 160),
  constraint product_fact_subjects_variant_key_check
    check (variant_key is null or char_length(btrim(variant_key)) between 1 and 160),
  constraint product_fact_subjects_revision_key_check
    check (char_length(btrim(formulation_revision_key)) between 1 and 160),
  constraint product_fact_subjects_identity_status_check
    check (identity_status in ('resolved', 'ambiguous', 'unresolved')),
  constraint product_fact_subjects_identity_resolution_version_check
    check (char_length(btrim(identity_resolution_version)) between 1 and 160),
  constraint product_fact_subjects_current_state_check
    check (current_state in ('provisional', 'current', 'historical')),
  constraint product_fact_subjects_current_requires_resolved_check
    check (current_state <> 'current' or identity_status = 'resolved'),
  constraint product_fact_subjects_market_check
    check (
      market_applicability is null
      or char_length(btrim(market_applicability)) between 1 and 32
    ),
  constraint product_fact_subjects_region_check
    check (
      region_applicability is null
      or char_length(btrim(region_applicability)) between 1 and 64
    ),
  constraint product_fact_subjects_validity_check
    check (valid_from is null or valid_to is null or valid_from < valid_to),
  constraint product_fact_subjects_predecessor_self_check
    check (predecessor_subject_id is null or predecessor_subject_id <> subject_id),
  constraint product_fact_subjects_supersession_check
    check (
      (predecessor_subject_id is null and supersession_kind is null)
      or
      (predecessor_subject_id is not null and supersession_kind in (
        'reformulation', 'identity_correction', 'semantic_variant_split'
      ))
    )
);

create unique index product_fact_subjects_current_applicability_unique
  on public.product_fact_subjects (
    product_id,
    variant_key,
    market_applicability,
    region_applicability
  ) nulls not distinct
  where identity_status = 'resolved' and current_state = 'current';

create index product_fact_subjects_predecessor_idx
  on public.product_fact_subjects (predecessor_subject_id)
  where predecessor_subject_id is not null;
create index product_fact_subjects_product_idx
  on public.product_fact_subjects (product_id, created_at desc);

create table public.product_evidence_sources (
  source_id uuid primary key default gen_random_uuid(),
  canonical_locator text not null,
  publisher text not null,
  source_kind text not null,
  source_metadata jsonb not null default '{}'::jsonb,
  content_digest text not null,
  external_snapshot_reference text,
  market text,
  region text,
  locale text,
  published_at timestamptz,
  accessed_at timestamptz not null,
  observed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint product_evidence_sources_identity_unique
    unique (canonical_locator, publisher, source_kind, content_digest),
  constraint product_evidence_sources_locator_check
    check (char_length(btrim(canonical_locator)) between 1 and 4096),
  constraint product_evidence_sources_publisher_check
    check (char_length(btrim(publisher)) between 1 and 512),
  constraint product_evidence_sources_kind_check
    check (char_length(btrim(source_kind)) between 1 and 160),
  constraint product_evidence_sources_metadata_check
    check (jsonb_typeof(source_metadata) = 'object' and octet_length(source_metadata::text) <= 32768),
  constraint product_evidence_sources_digest_check
    check (content_digest ~ '^[0-9a-f]{64}$'),
  constraint product_evidence_sources_snapshot_reference_check
    check (
      external_snapshot_reference is null
      or char_length(btrim(external_snapshot_reference)) between 1 and 4096
    ),
  constraint product_evidence_sources_market_check
    check (market is null or char_length(btrim(market)) between 1 and 32),
  constraint product_evidence_sources_region_check
    check (region is null or char_length(btrim(region)) between 1 and 64),
  constraint product_evidence_sources_locale_check
    check (locale is null or char_length(btrim(locale)) between 1 and 64)
);

create table public.product_evidence_source_subject_bindings (
  binding_id uuid primary key default gen_random_uuid(),
  source_id uuid not null
    references public.product_evidence_sources(source_id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  subject_id uuid,
  binding_state text not null,
  scope_relation text not null,
  presentation_metadata jsonb not null default '{}'::jsonb,
  identity_resolution_version text not null,
  reviewed_by uuid references auth.users(id) on delete restrict,
  reviewed_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint product_evidence_source_subject_bindings_subject_product_fk
    foreign key (subject_id, product_id)
    references public.product_fact_subjects(subject_id, product_id) on delete restrict,
  constraint product_evidence_source_subject_bindings_evidence_gate_unique
    unique (binding_id, source_id, subject_id, binding_state),
  constraint product_evidence_source_subject_bindings_identity_unique
    unique nulls not distinct (
      source_id, product_id, subject_id, binding_state, identity_resolution_version
    ),
  constraint product_evidence_source_subject_bindings_state_check
    check (binding_state in (
      'exact_subject_match',
      'equivalent_presentation_match',
      'product_family_only',
      'variant_ambiguous',
      'formulation_ambiguous',
      'identity_unresolved',
      'disjoint_subject'
    )),
  constraint product_evidence_source_subject_bindings_scope_relation_check
    check (scope_relation in (
      'equivalent', 'narrower', 'broader', 'disjoint', 'overlapping'
    )),
  constraint product_evidence_source_subject_bindings_target_check
    check (
      (
        binding_state in (
          'exact_subject_match', 'equivalent_presentation_match', 'disjoint_subject'
        )
        and subject_id is not null
      )
      or
      (
        binding_state in (
          'product_family_only',
          'variant_ambiguous',
          'formulation_ambiguous',
          'identity_unresolved'
        )
        and subject_id is null
      )
    ),
  constraint product_evidence_source_subject_bindings_metadata_check
    check (
      jsonb_typeof(presentation_metadata) = 'object'
      and octet_length(presentation_metadata::text) <= 32768
    ),
  constraint product_evidence_source_subject_bindings_resolution_version_check
    check (char_length(btrim(identity_resolution_version)) between 1 and 160)
);

create index product_evidence_source_subject_bindings_subject_idx
  on public.product_evidence_source_subject_bindings (subject_id, reviewed_at desc)
  where subject_id is not null;
create index product_evidence_source_subject_bindings_product_idx
  on public.product_evidence_source_subject_bindings (product_id, reviewed_at desc);
create index product_evidence_source_subject_bindings_reviewer_idx
  on public.product_evidence_source_subject_bindings (reviewed_by, reviewed_at desc)
  where reviewed_by is not null;

create table public.product_evidence_records (
  evidence_id uuid primary key default gen_random_uuid(),
  source_id uuid not null,
  binding_id uuid not null,
  binding_state text not null,
  subject_id uuid not null
    references public.product_fact_subjects(subject_id) on delete restrict,
  registry_version text not null,
  fact_key text not null,
  proposition_key text not null,
  proposition_serializer_version text not null,
  proposition_value_identity jsonb,
  parent_proposition_key text,
  evidence_class text not null,
  evidence_authority text not null,
  confidence text not null,
  support_direction text not null,
  negative_admissibility text not null,
  market text,
  region text,
  locale text,
  valid_from date,
  valid_to date,
  qualifier jsonb not null default '{}'::jsonb,
  canonical_evidence_digest text not null,
  supersedes_evidence_id uuid,
  created_at timestamptz not null default now(),
  constraint product_evidence_records_binding_gate_fk
    foreign key (binding_id, source_id, subject_id, binding_state)
    references public.product_evidence_source_subject_bindings(
      binding_id, source_id, subject_id, binding_state
    ) on delete restrict,
  constraint product_evidence_records_source_fk
    foreign key (source_id)
    references public.product_evidence_sources(source_id) on delete restrict,
  constraint product_evidence_records_definition_fk
    foreign key (registry_version, fact_key)
    references public.product_fact_definition_snapshots(registry_version, fact_key)
    on delete restrict,
  constraint product_evidence_records_proposition_subject_unique
    unique (evidence_id, proposition_key, subject_id),
  constraint product_evidence_records_supersedes_fk
    foreign key (supersedes_evidence_id, proposition_key, subject_id)
    references public.product_evidence_records(evidence_id, proposition_key, subject_id)
    on delete restrict,
  constraint product_evidence_records_binding_state_check
    check (binding_state in ('exact_subject_match', 'equivalent_presentation_match')),
  constraint product_evidence_records_proposition_key_check
    check (proposition_key ~ '^[0-9a-f]{64}$'),
  constraint product_evidence_records_serializer_check
    check (char_length(btrim(proposition_serializer_version)) between 1 and 160),
  constraint product_evidence_records_parent_proposition_check
    check (parent_proposition_key is null or parent_proposition_key ~ '^[0-9a-f]{64}$'),
  constraint product_evidence_records_evidence_class_check
    check (evidence_class in (
      'product_claim',
      'measurement',
      'observation',
      'usage_instruction',
      'composition_identity',
      'physical_characteristic',
      'role_declaration',
      'legacy_catalog_observation'
    )),
  constraint product_evidence_records_authority_check
    check (evidence_authority in (
      'product_specific_primary',
      'limited_non_product_specific',
      'review_observation',
      'ingredient_basis',
      'legacy_unreviewed',
      'none'
    )),
  constraint product_evidence_records_confidence_check
    check (confidence in ('high', 'medium', 'low', 'unknown')),
  constraint product_evidence_records_support_direction_check
    check (support_direction in ('supports', 'opposes', 'context_only')),
  constraint product_evidence_records_negative_admissibility_check
    check (negative_admissibility in (
      'not_applicable',
      'explicit_negative',
      'conflict_opposition',
      'ambiguous',
      'context_only'
    )),
  constraint product_evidence_records_support_negative_pair_check
    check (support_direction <> 'supports' or negative_admissibility = 'not_applicable'),
  constraint product_evidence_records_validity_check
    check (valid_from is null or valid_to is null or valid_from < valid_to),
  constraint product_evidence_records_qualifier_check
    check (jsonb_typeof(qualifier) = 'object' and octet_length(qualifier::text) <= 32768),
  constraint product_evidence_records_digest_check
    check (canonical_evidence_digest ~ '^[0-9a-f]{64}$'),
  constraint product_evidence_records_supersedes_self_check
    check (supersedes_evidence_id is null or supersedes_evidence_id <> evidence_id)
);

create index product_evidence_records_subject_fact_idx
  on public.product_evidence_records (subject_id, registry_version, fact_key, created_at desc);
create index product_evidence_records_binding_idx
  on public.product_evidence_records (binding_id, source_id, subject_id, binding_state);
create index product_evidence_records_source_idx
  on public.product_evidence_records (source_id, created_at desc);
create index product_evidence_records_definition_idx
  on public.product_evidence_records (registry_version, fact_key);
create index product_evidence_records_supersedes_idx
  on public.product_evidence_records (supersedes_evidence_id)
  where supersedes_evidence_id is not null;

create table public.product_fact_instances (
  fact_instance_id uuid primary key default gen_random_uuid(),
  subject_id uuid not null
    references public.product_fact_subjects(subject_id) on delete restrict,
  registry_version text not null,
  fact_key text not null,
  proposition_key text not null,
  proposition_serializer_version text not null,
  semantic_status text not null,
  value_type text,
  value_boolean boolean,
  value_enum text,
  value_number numeric,
  value_unit text,
  value_range_min numeric,
  value_range_max numeric,
  value_entity_identifier text,
  market text,
  region text,
  locale text,
  valid_from date,
  valid_to date,
  qualifier jsonb not null default '{}'::jsonb,
  parent_proposition_key text,
  parent_fact_instance_id uuid,
  authority_ceiling text not null,
  fused_confidence text not null,
  fusion_policy_version text not null,
  fusion_input_digest text not null,
  supersedes_fact_instance_id uuid,
  adjudicated_at timestamptz,
  created_at timestamptz not null default now(),
  constraint product_fact_instances_definition_fk
    foreign key (registry_version, fact_key)
    references public.product_fact_definition_snapshots(registry_version, fact_key)
    on delete restrict,
  constraint product_fact_instances_proposition_subject_unique
    unique (fact_instance_id, proposition_key, subject_id),
  constraint product_fact_instances_parent_fk
    foreign key (parent_fact_instance_id, parent_proposition_key, subject_id)
    references public.product_fact_instances(fact_instance_id, proposition_key, subject_id)
    on delete restrict,
  constraint product_fact_instances_supersedes_fk
    foreign key (supersedes_fact_instance_id, proposition_key, subject_id)
    references public.product_fact_instances(fact_instance_id, proposition_key, subject_id)
    on delete restrict,
  constraint product_fact_instances_proposition_key_check
    check (proposition_key ~ '^[0-9a-f]{64}$'),
  constraint product_fact_instances_serializer_check
    check (char_length(btrim(proposition_serializer_version)) between 1 and 160),
  constraint product_fact_instances_semantic_status_check
    check (semantic_status in (
      'supported',
      'reviewed_not_established',
      'not_reviewed',
      'evidence_insufficient',
      'evidence_conflict'
    )),
  constraint product_fact_instances_value_type_check
    check (
      value_type is null
      or value_type in (
        'boolean', 'enum', 'number', 'number_unit', 'range_unit', 'entity_identifier'
      )
    ),
  constraint product_fact_instances_typed_value_check
    check (
      (
        semantic_status <> 'supported'
        and value_type is null
        and value_boolean is null
        and value_enum is null
        and value_number is null
        and value_unit is null
        and value_range_min is null
        and value_range_max is null
        and value_entity_identifier is null
      )
      or
      (
        semantic_status = 'supported'
        and (
          (
            value_type = 'boolean'
            and value_boolean is not null
            and value_enum is null
            and value_number is null
            and value_unit is null
            and value_range_min is null
            and value_range_max is null
            and value_entity_identifier is null
          )
          or
          (
            value_type = 'enum'
            and value_boolean is null
            and value_enum is not null
            and value_number is null
            and value_unit is null
            and value_range_min is null
            and value_range_max is null
            and value_entity_identifier is null
          )
          or
          (
            value_type = 'number'
            and value_boolean is null
            and value_enum is null
            and value_number is not null
            and value_unit is null
            and value_range_min is null
            and value_range_max is null
            and value_entity_identifier is null
          )
          or
          (
            value_type = 'number_unit'
            and value_boolean is null
            and value_enum is null
            and value_number is not null
            and value_unit is not null
            and value_range_min is null
            and value_range_max is null
            and value_entity_identifier is null
          )
          or
          (
            value_type = 'range_unit'
            and value_boolean is null
            and value_enum is null
            and value_number is null
            and value_unit is not null
            and value_range_min is not null
            and value_range_max is not null
            and value_range_min <= value_range_max
            and value_entity_identifier is null
          )
          or
          (
            value_type = 'entity_identifier'
            and value_boolean is null
            and value_enum is null
            and value_number is null
            and value_unit is null
            and value_range_min is null
            and value_range_max is null
            and value_entity_identifier is not null
          )
        )
      )
    ),
  constraint product_fact_instances_value_text_check
    check (
      (value_enum is null or char_length(btrim(value_enum)) between 1 and 512)
      and (value_unit is null or char_length(btrim(value_unit)) between 1 and 160)
      and (
        value_entity_identifier is null
        or char_length(btrim(value_entity_identifier)) between 1 and 512
      )
    ),
  constraint product_fact_instances_validity_check
    check (valid_from is null or valid_to is null or valid_from < valid_to),
  constraint product_fact_instances_qualifier_check
    check (jsonb_typeof(qualifier) = 'object' and octet_length(qualifier::text) <= 32768),
  constraint product_fact_instances_parent_pair_check
    check (
      (parent_fact_instance_id is null and parent_proposition_key is null)
      or
      (parent_fact_instance_id is not null and parent_proposition_key is not null)
    ),
  constraint product_fact_instances_parent_self_check
    check (parent_fact_instance_id is null or parent_fact_instance_id <> fact_instance_id),
  constraint product_fact_instances_authority_check
    check (authority_ceiling in (
      'product_specific_primary',
      'limited_non_product_specific',
      'review_observation',
      'ingredient_basis',
      'legacy_unreviewed',
      'none'
    )),
  constraint product_fact_instances_confidence_check
    check (fused_confidence in ('high', 'medium', 'low', 'unknown')),
  constraint product_fact_instances_fusion_policy_check
    check (char_length(btrim(fusion_policy_version)) between 1 and 160),
  constraint product_fact_instances_fusion_digest_check
    check (fusion_input_digest ~ '^[0-9a-f]{64}$'),
  constraint product_fact_instances_supersedes_self_check
    check (
      supersedes_fact_instance_id is null
      or supersedes_fact_instance_id <> fact_instance_id
    )
);

create index product_fact_instances_subject_fact_idx
  on public.product_fact_instances (subject_id, registry_version, fact_key, created_at desc);
create index product_fact_instances_definition_idx
  on public.product_fact_instances (registry_version, fact_key);
create index product_fact_instances_proposition_history_idx
  on public.product_fact_instances (proposition_key, created_at desc);
create index product_fact_instances_parent_idx
  on public.product_fact_instances (parent_fact_instance_id)
  where parent_fact_instance_id is not null;
create index product_fact_instances_supersedes_idx
  on public.product_fact_instances (supersedes_fact_instance_id)
  where supersedes_fact_instance_id is not null;

create table public.product_fact_evidence_links (
  fact_instance_id uuid not null,
  evidence_id uuid not null,
  subject_id uuid not null,
  proposition_key text not null,
  link_role text not null,
  created_at timestamptz not null default now(),
  primary key (fact_instance_id, evidence_id),
  constraint product_fact_evidence_links_fact_fk
    foreign key (fact_instance_id, proposition_key, subject_id)
    references public.product_fact_instances(fact_instance_id, proposition_key, subject_id)
    on delete restrict,
  constraint product_fact_evidence_links_evidence_fk
    foreign key (evidence_id, proposition_key, subject_id)
    references public.product_evidence_records(evidence_id, proposition_key, subject_id)
    on delete restrict,
  constraint product_fact_evidence_links_role_check
    check (link_role in ('supporting', 'opposing')),
  constraint product_fact_evidence_links_proposition_key_check
    check (proposition_key ~ '^[0-9a-f]{64}$')
);

create index product_fact_evidence_links_evidence_idx
  on public.product_fact_evidence_links (evidence_id, fact_instance_id);

create table public.product_fact_confirmations (
  confirmation_id uuid primary key default gen_random_uuid(),
  request_id text not null,
  namespace text not null,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  payload_digest text not null,
  prestate_digest text not null,
  result_digest text not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  constraint product_fact_confirmations_request_unique
    unique (namespace, request_id),
  constraint product_fact_confirmations_request_check
    check (char_length(btrim(request_id)) between 8 and 120),
  constraint product_fact_confirmations_namespace_check
    check (char_length(btrim(namespace)) between 1 and 160),
  constraint product_fact_confirmations_payload_digest_check
    check (payload_digest ~ '^[0-9a-f]{64}$'),
  constraint product_fact_confirmations_prestate_digest_check
    check (prestate_digest ~ '^[0-9a-f]{64}$'),
  constraint product_fact_confirmations_result_digest_check
    check (result_digest ~ '^[0-9a-f]{64}$'),
  constraint product_fact_confirmations_result_check
    check (jsonb_typeof(result) = 'object' and octet_length(result::text) <= 1048576)
);

create index product_fact_confirmations_actor_idx
  on public.product_fact_confirmations (actor_user_id, created_at desc);

create table public.product_fact_current (
  proposition_key text primary key,
  fact_instance_id uuid not null,
  subject_id uuid not null,
  confirmation_id uuid not null
    references public.product_fact_confirmations(confirmation_id) on delete restrict,
  updated_at timestamptz not null default now(),
  constraint product_fact_current_fact_fk
    foreign key (fact_instance_id, proposition_key, subject_id)
    references public.product_fact_instances(fact_instance_id, proposition_key, subject_id)
    on delete restrict,
  constraint product_fact_current_proposition_key_check
    check (proposition_key ~ '^[0-9a-f]{64}$')
);

create index product_fact_current_fact_idx
  on public.product_fact_current (fact_instance_id, proposition_key, subject_id);
create index product_fact_current_confirmation_idx
  on public.product_fact_current (confirmation_id);

create table public.product_fact_review_assignments (
  assignment_id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  subject_id uuid,
  registry_version text,
  fact_key text,
  proposition_key text,
  operational_state text not null,
  assigned_to uuid references auth.users(id) on delete restrict,
  review_policy_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_fact_review_assignments_subject_product_fk
    foreign key (subject_id, product_id)
    references public.product_fact_subjects(subject_id, product_id) on delete restrict,
  constraint product_fact_review_assignments_definition_fk
    foreign key (registry_version, fact_key)
    references public.product_fact_definition_snapshots(registry_version, fact_key)
    on delete restrict,
  constraint product_fact_review_assignments_definition_pair_check
    check (
      (registry_version is null and fact_key is null)
      or
      (registry_version is not null and fact_key is not null)
    ),
  constraint product_fact_review_assignments_proposition_key_check
    check (proposition_key is null or proposition_key ~ '^[0-9a-f]{64}$'),
  constraint product_fact_review_assignments_operational_state_check
    check (operational_state in (
      'queued',
      'assigned',
      'under_review',
      'identity_blocked',
      'source_blocked',
      'needs_adjudication',
      'ready_for_confirm',
      'confirmed',
      'stale',
      're_review_required',
      'superseded'
    )),
  constraint product_fact_review_assignments_policy_check
    check (char_length(btrim(review_policy_version)) between 1 and 160)
);

create index product_fact_review_assignments_queue_idx
  on public.product_fact_review_assignments (operational_state, updated_at, assignment_id);
create index product_fact_review_assignments_product_idx
  on public.product_fact_review_assignments (product_id, updated_at desc);
create index product_fact_review_assignments_subject_idx
  on public.product_fact_review_assignments (subject_id, updated_at desc)
  where subject_id is not null;
create index product_fact_review_assignments_definition_idx
  on public.product_fact_review_assignments (registry_version, fact_key)
  where registry_version is not null;
create index product_fact_review_assignments_assignee_idx
  on public.product_fact_review_assignments (assigned_to, updated_at desc)
  where assigned_to is not null;
create index product_fact_review_assignments_proposition_idx
  on public.product_fact_review_assignments (proposition_key, updated_at desc)
  where proposition_key is not null;

create table public.product_fact_review_events (
  event_id uuid primary key default gen_random_uuid(),
  assignment_id uuid
    references public.product_fact_review_assignments(assignment_id) on delete restrict,
  subject_id uuid references public.product_fact_subjects(subject_id) on delete restrict,
  evidence_id uuid references public.product_evidence_records(evidence_id) on delete restrict,
  fact_instance_id uuid
    references public.product_fact_instances(fact_instance_id) on delete restrict,
  confirmation_id uuid
    references public.product_fact_confirmations(confirmation_id) on delete restrict,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  event_kind text not null,
  reason_code text,
  event_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint product_fact_review_events_target_check
    check (
      num_nonnulls(
        assignment_id,
        subject_id,
        evidence_id,
        fact_instance_id,
        confirmation_id
      ) >= 1
    ),
  constraint product_fact_review_events_kind_check
    check (char_length(btrim(event_kind)) between 1 and 160),
  constraint product_fact_review_events_reason_check
    check (reason_code is null or char_length(btrim(reason_code)) between 1 and 160),
  constraint product_fact_review_events_payload_check
    check (jsonb_typeof(event_payload) = 'object' and octet_length(event_payload::text) <= 32768)
);

create index product_fact_review_events_assignment_idx
  on public.product_fact_review_events (assignment_id, created_at desc)
  where assignment_id is not null;
create index product_fact_review_events_subject_idx
  on public.product_fact_review_events (subject_id, created_at desc)
  where subject_id is not null;
create index product_fact_review_events_evidence_idx
  on public.product_fact_review_events (evidence_id, created_at desc)
  where evidence_id is not null;
create index product_fact_review_events_fact_idx
  on public.product_fact_review_events (fact_instance_id, created_at desc)
  where fact_instance_id is not null;
create index product_fact_review_events_confirmation_idx
  on public.product_fact_review_events (confirmation_id, created_at desc)
  where confirmation_id is not null;
create index product_fact_review_events_actor_idx
  on public.product_fact_review_events (actor_user_id, created_at desc);

alter table public.product_fact_registry_versions enable row level security;
alter table public.product_fact_definition_snapshots enable row level security;
alter table public.product_fact_subjects enable row level security;
alter table public.product_evidence_sources enable row level security;
alter table public.product_evidence_source_subject_bindings enable row level security;
alter table public.product_evidence_records enable row level security;
alter table public.product_fact_instances enable row level security;
alter table public.product_fact_evidence_links enable row level security;
alter table public.product_fact_current enable row level security;
alter table public.product_fact_review_assignments enable row level security;
alter table public.product_fact_review_events enable row level security;
alter table public.product_fact_confirmations enable row level security;

revoke all on table public.product_fact_registry_versions
  from public, anon, authenticated, service_role;
revoke all on table public.product_fact_definition_snapshots
  from public, anon, authenticated, service_role;
revoke all on table public.product_fact_subjects
  from public, anon, authenticated, service_role;
revoke all on table public.product_evidence_sources
  from public, anon, authenticated, service_role;
revoke all on table public.product_evidence_source_subject_bindings
  from public, anon, authenticated, service_role;
revoke all on table public.product_evidence_records
  from public, anon, authenticated, service_role;
revoke all on table public.product_fact_instances
  from public, anon, authenticated, service_role;
revoke all on table public.product_fact_evidence_links
  from public, anon, authenticated, service_role;
revoke all on table public.product_fact_current
  from public, anon, authenticated, service_role;
revoke all on table public.product_fact_review_assignments
  from public, anon, authenticated, service_role;
revoke all on table public.product_fact_review_events
  from public, anon, authenticated, service_role;
revoke all on table public.product_fact_confirmations
  from public, anon, authenticated, service_role;

grant select on table public.product_fact_registry_versions to service_role;
grant select on table public.product_fact_definition_snapshots to service_role;
grant select on table public.product_fact_subjects to service_role;
grant select on table public.product_evidence_sources to service_role;
grant select on table public.product_evidence_source_subject_bindings to service_role;
grant select on table public.product_evidence_records to service_role;
grant select on table public.product_fact_instances to service_role;
grant select on table public.product_fact_evidence_links to service_role;
grant select on table public.product_fact_current to service_role;
grant select on table public.product_fact_review_assignments to service_role;
grant select on table public.product_fact_review_events to service_role;
grant select on table public.product_fact_confirmations to service_role;

comment on table public.product_fact_registry_versions is
  'Immutable Product Fact Registry release binding; code/config remains semantic authority.';
comment on table public.product_fact_definition_snapshots is
  'Immutable query/Admin mirror of a versioned Registry definition; contains no seed rows in PF-2.';
comment on table public.product_fact_subjects is
  'Versioned Product Fact semantic subjects under products.id; products remains the catalog anchor only.';
comment on table public.product_evidence_sources is
  'Source identity, safe locator, digest, and bounded metadata; arbitrary raw source bodies are excluded.';
comment on table public.product_evidence_source_subject_bindings is
  'Reviewed source-to-subject identity binding, separate from evidence authority.';
comment on table public.product_evidence_records is
  'Append-only subject-targeted EvidenceRecords. PF-4 must additionally verify resolved subject identity and scope compatibility transactionally.';
comment on table public.product_fact_instances is
  'Immutable fused Product Fact versions with typed values and semantic status separate from workflow state.';
comment on table public.product_fact_evidence_links is
  'Directional supporting/opposing provenance for one immutable Fact version.';
comment on table public.product_fact_current is
  'One confirmed current Fact pointer per persisted semantic proposition key.';
comment on table public.product_fact_review_assignments is
  'Mutable Product Fact Admin assignment/queue state, separate from Fact semantic status.';
comment on table public.product_fact_review_events is
  'Append-only Product Fact review/adjudication/re-review event history.';
comment on table public.product_fact_confirmations is
  'Idempotent Product Fact confirmation ledger with payload, pre-state, and bounded result digests.';

commit;
