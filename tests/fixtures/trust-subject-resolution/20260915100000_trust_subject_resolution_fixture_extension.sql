-- TRUST Phase 2 isolated-runtime fixture extension.
-- Adds only the identity columns needed to mirror current Production contracts.

alter table public.product_candidates
  add column identity_resolution_state text not null default 'resolved',
  add column identity_resolution_version text not null default 'crawler-identity-resolution-v1',
  add column identity_resolution_evidence jsonb not null default '{}'::jsonb;

alter table public.product_fact_subjects
  add column variant_key text,
  add column formulation_revision_key text not null default 'fixture-formulation-v1';

update public.product_fact_subjects
set variant_key = 'fixture-primary'
where subject_id = '30000000-0000-4000-8000-000000000001'::uuid;

create unique index product_fact_subjects_current_applicability_unique
  on public.product_fact_subjects(product_id, variant_key, market_applicability) nulls not distinct
  where identity_status = 'resolved' and current_state = 'current';

-- Missing Subject.
insert into public.products (id, name, brand, category)
values ('10000000-0000-4000-8000-000000000002','Missing Subject Sunscreen','Fixture','sunscreen');
insert into public.product_candidates (
  id, source_name, service_category, review_status, matched_product_id
) values (
  '20000000-0000-4000-8000-000000000002','hwahae','sunscreen','approved',
  '10000000-0000-4000-8000-000000000002'
);

-- Single exact-market provisional Subject candidate.
insert into public.products (id, name, brand, category)
values ('10000000-0000-4000-8000-000000000003','Candidate Subject Sunscreen','Fixture','sunscreen');
insert into public.product_candidates (
  id, source_name, service_category, review_status, matched_product_id
) values (
  '20000000-0000-4000-8000-000000000003','hwahae','sunscreen','approved',
  '10000000-0000-4000-8000-000000000003'
);
insert into public.product_fact_subjects (
  subject_id, product_id, identity_status, current_state, market_applicability, variant_key, formulation_revision_key
) values (
  '30000000-0000-4000-8000-000000000003',
  '10000000-0000-4000-8000-000000000003',
  'resolved','provisional','KR','candidate-primary','candidate-formulation-v1'
);

-- Upstream catalog identity ambiguity.
insert into public.products (id, name, brand, category)
values ('10000000-0000-4000-8000-000000000004','Ambiguous Identity Sunscreen','Fixture','sunscreen');
insert into public.product_candidates (
  id, source_name, service_category, review_status, matched_product_id,
  identity_resolution_state, identity_resolution_evidence
) values (
  '20000000-0000-4000-8000-000000000004','hwahae','sunscreen','approved',
  '10000000-0000-4000-8000-000000000004','identity_ambiguous',
  '{"reason_code":"fixture_ambiguous"}'::jsonb
);

-- Global-only Subject for a KR intake.
insert into public.products (id, name, brand, category)
values ('10000000-0000-4000-8000-000000000005','Market Conflict Sunscreen','Fixture','sunscreen');
insert into public.product_candidates (
  id, source_name, service_category, review_status, matched_product_id
) values (
  '20000000-0000-4000-8000-000000000005','hwahae','sunscreen','approved',
  '10000000-0000-4000-8000-000000000005'
);
insert into public.product_fact_subjects (
  subject_id, product_id, identity_status, current_state, market_applicability, variant_key, formulation_revision_key
) values (
  '30000000-0000-4000-8000-000000000005',
  '10000000-0000-4000-8000-000000000005',
  'resolved','current',null,'global-primary','market-formulation-v1'
);

-- Multiple current variants sharing one formulation.
insert into public.products (id, name, brand, category)
values ('10000000-0000-4000-8000-000000000006','Variant Conflict Sunscreen','Fixture','sunscreen');
insert into public.product_candidates (
  id, source_name, service_category, review_status, matched_product_id
) values (
  '20000000-0000-4000-8000-000000000006','hwahae','sunscreen','approved',
  '10000000-0000-4000-8000-000000000006'
);
insert into public.product_fact_subjects (
  subject_id, product_id, identity_status, current_state, market_applicability, variant_key, formulation_revision_key
) values
  ('30000000-0000-4000-8000-000000000061','10000000-0000-4000-8000-000000000006','resolved','current','KR','variant-a','same-formulation'),
  ('30000000-0000-4000-8000-000000000062','10000000-0000-4000-8000-000000000006','resolved','current','KR','variant-b','same-formulation');

-- Multiple current formulations. Distinct variants keep the Production unique
-- current-applicability invariant while still exposing a formulation conflict.
insert into public.products (id, name, brand, category)
values ('10000000-0000-4000-8000-000000000007','Formulation Conflict Sunscreen','Fixture','sunscreen');
insert into public.product_candidates (
  id, source_name, service_category, review_status, matched_product_id
) values (
  '20000000-0000-4000-8000-000000000007','hwahae','sunscreen','approved',
  '10000000-0000-4000-8000-000000000007'
);
insert into public.product_fact_subjects (
  subject_id, product_id, identity_status, current_state, market_applicability, variant_key, formulation_revision_key
) values
  ('30000000-0000-4000-8000-000000000071','10000000-0000-4000-8000-000000000007','resolved','current','KR','form-variant-a','formulation-a'),
  ('30000000-0000-4000-8000-000000000072','10000000-0000-4000-8000-000000000007','resolved','current','KR','form-variant-b','formulation-b');

-- Missing first, then an exact Subject is inserted by the runtime test to prove
-- placeholder task reconciliation is duplicate-free.
insert into public.products (id, name, brand, category)
values ('10000000-0000-4000-8000-000000000008','Late Subject Sunscreen','Fixture','sunscreen');
insert into public.product_candidates (
  id, source_name, service_category, review_status, matched_product_id
) values (
  '20000000-0000-4000-8000-000000000008','hwahae','sunscreen','approved',
  '10000000-0000-4000-8000-000000000008'
);
