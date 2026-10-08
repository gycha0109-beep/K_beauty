-- R4-C-R3 isolated PostgreSQL concurrency fixture. Synthetic only.
\set ON_ERROR_STOP on
create schema test_r3_concurrency;
create function test_r3_concurrency.reviewed_identity() returns jsonb language sql stable as $f$
select jsonb_build_object(
'variant_key',null,'variant_key_reviewed_as_null',true,
'formulation_revision_key','data-ai29c-c5-bushman-waterproof-pro-current',
'formulation_label','BUSHMAN Waterproof Pro Suncream 50g',
'market_applicability','KR','region_applicability',null,'valid_from',null,'valid_to',null);
$f$;
insert into public.admin_audit_logs(
id,actor_user_id,actor_role,required_capability,action,target_type,target_id,
reason,request_id,metadata
) values(
'dddddddd-dddd-4ddd-8ddd-dddddddddddd','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
'admin_operator','admin.products.review','admin.product_fact.bushman_subject_identity_attested',
'product_fact_subject','0b5963bb-67d6-4738-a620-32ec86c1e3d0',
'synthetic concurrency attestation; not real authorization',
'r3-concurr-approval',jsonb_build_object('attestation_id','cccccccc-cccc-4ccc-8ccc-cccccccccccc',
'fresh_observation_digest',repeat('1',64)));
insert into public.bushman_subject_identity_attestations_v1(
attestation_id,product_id,subject_id,official_source_id,official_binding_id,official_review_id,
official_content_digest,fresh_observation_digest,fresh_observed_at,reviewed_identity,
unit_reconciliation,reviewer_user_id,approval_audit_id,approval_status,approved_at
) values (
'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
'4608b3b4-8b51-4464-b46e-380b05c1a3d7',
'0b5963bb-67d6-4738-a620-32ec86c1e3d0',
'94b32b8d-8340-4b91-9e62-646794fd4f41',
'9da03b35-9e00-4c46-8ff0-8f6835382349',
'067e861d-2e61-4ec2-a3f7-660d78be468d',
'3a9fbcb280935133e95a0f7f19bfff20157258b4dc17b8dce4d601e40f6681a9',
repeat('1',64),now()-interval '1 day',
test_r3_concurrency.reviewed_identity(),
jsonb_build_object('finding','same_product_verified','subject_label',
'BUSHMAN Waterproof Pro Suncream 50g','official_unit','50ml',
'review_rationale',repeat('strictly synthetic test attestation only; ',2)),
'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
'approved',now()-interval '1 day');
create table test_r3_concurrency.plan as
select public.admin_pf_bushman_identity_auth_v1(
'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
'0b5963bb-67d6-4738-a620-32ec86c1e3d0'::uuid,
'cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid,
test_r3_concurrency.reviewed_identity()) as value;
do $assert$
begin if (select value->>'status' from test_r3_concurrency.plan) is distinct from 'ready'
then raise exception 'R3_CONCURRENT_PREFLIGHT_NOT_READY';end if;
end $assert$;

-- Only the COSRX migration compile-time schema contract is required for
-- coexistence smoke. No real COSRX product, subject, or authority event exists.
create table public.product_candidates(
 id uuid primary key,
 matched_product_id uuid,
 review_status text,
 identity_resolution_state text,
 identity_resolution_version text,
 identity_resolution_evidence jsonb,
 latest_raw_source jsonb,
 source_url text
);
