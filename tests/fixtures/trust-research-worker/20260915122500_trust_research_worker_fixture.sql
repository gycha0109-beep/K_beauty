-- TRUST Phase 3 isolated-runtime fixture extension.
-- Mirrors the catalog source-binding shape used by the Research Worker without
-- adding governed Product Fact Evidence tables.

create table public.product_source_bindings (
  binding_id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  source_name text not null,
  external_type text not null,
  external_id text not null,
  source_url text,
  market_code text,
  locale text,
  binding_state text not null,
  binding_method text not null,
  product_scope_state text not null,
  first_observed_at timestamptz,
  last_observed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enrich the minimal Phase 1 registry fixture with the Phase 3 evidence policy
-- fields used by the runtime gate.
update public.product_fact_definition_snapshots
set definition = case fact_key
  when 'spf_value' then '{"fact_key":"spf_value","value_type":"number","domain_scope":["sunscreen"],"allowed_values":null,"permitted_evidence_classes":["product_claim"],"positive_evidence_requirement":"product-specific evidence"}'::jsonb
  when 'uva_label' then '{"fact_key":"uva_label","value_type":"enum","domain_scope":["sunscreen"],"allowed_values":["PA+","PA++","PA+++","PA++++","UVA-PF-declared"],"permitted_evidence_classes":["product_claim"],"positive_evidence_requirement":"product-specific evidence"}'::jsonb
  when 'uv_filter_type' then '{"fact_key":"uv_filter_type","value_type":"enum","domain_scope":["sunscreen"],"allowed_values":["mineral","organic","hybrid"],"permitted_evidence_classes":["product_claim","composition_identity"],"positive_evidence_requirement":"product-specific evidence"}'::jsonb
  else definition
end,
value_type = case fact_key
  when 'spf_value' then 'number'
  when 'uva_label' then 'enum'
  when 'uv_filter_type' then 'enum'
  else value_type
end
where registry_version = 'product-fact-registry-cross-category-v1'
  and fact_key in ('spf_value','uva_label','uv_filter_type');

-- Create one exact product-scoped KR Subject and let the Phase 1/2 processor
-- materialize the three required sunscreen research tasks.
insert into public.products (id, name, brand, category)
values ('10000000-0000-4000-8000-000000000009','Phase3 Product Scoped Sunscreen','Fixture','sunscreen');

insert into public.product_candidates (
  id, source_name, service_category, review_status, matched_product_id,
  identity_resolution_state, identity_resolution_version, identity_resolution_evidence
) values (
  '20000000-0000-4000-8000-000000000009','hwahae','sunscreen','approved',
  '10000000-0000-4000-8000-000000000009','resolved',
  'crawler-identity-resolution-v1','{}'::jsonb
);

insert into public.product_fact_subjects (
  subject_id, product_id, identity_status, current_state, market_applicability,
  variant_key, formulation_revision_key
) values (
  '30000000-0000-4000-8000-000000000009',
  '10000000-0000-4000-8000-000000000009',
  'resolved','current','KR',null,'product-scope-formulation-v1'
);

select public.promote_product_candidate(
  '20000000-0000-4000-8000-000000000009'::uuid,
  'phase3-fixture'
);
select public.process_catalog_trust_product_v1('10000000-0000-4000-8000-000000000009'::uuid);

insert into public.product_source_bindings (
  binding_id, product_id, source_name, external_type, external_id, source_url,
  market_code, locale, binding_state, binding_method, product_scope_state
) values
  (
    '70000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000009',
    'fixture_official','official_product','fixture-product-9',
    'https://official.example.test/products/product-9','KR','ko-KR',
    'resolved','manual_fixture','product'
  ),
  (
    '70000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000009',
    'hwahae','goods','fixture-third-party-product-9',
    'https://third-party.example.test/products/product-9','KR','ko-KR',
    'resolved','manual_fixture','product'
  ),
  (
    '70000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000009',
    'fixture_global_official','official_product','fixture-global-product-9',
    'https://global-official.example.test/products/product-9',null,'en',
    'resolved','manual_fixture','product'
  );
