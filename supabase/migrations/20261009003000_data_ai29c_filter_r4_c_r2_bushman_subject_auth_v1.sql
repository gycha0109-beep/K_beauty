begin;
-- DATA-AI29C-FILTER-R4-C-R2 implementation. NOT DEPLOYED. No attestation writer here.
do $guards$
begin
if to_regprocedure('public.admin_require_product_review_actor(uuid,text)') is null
 or to_regprocedure('public.product_fact_controlled_sha256_json_v1(jsonb)') is null
 or to_regprocedure('public.product_fact_controlled_json_exact_keys_v1(jsonb,text[])') is null
 or to_regprocedure('public.record_admin_audit_event(uuid,text,text,text,text,jsonb,jsonb,text,text,jsonb)') is null
 or to_regclass('public.product_fact_subjects') is null
 or to_regclass('public.product_evidence_sources') is null
 or to_regclass('public.trust_official_source_binding_reviews') is null
 or to_regclass('public.product_evidence_source_subject_bindings') is null
then raise exception 'r4c_r2_missing_prerequisite' using errcode='55000';end if;
end;$guards$;

create table public.bushman_subject_identity_attestations_v1(
attestation_id uuid primary key default gen_random_uuid(),
product_id uuid not null references public.products(id),
subject_id uuid not null references public.product_fact_subjects(subject_id),
official_source_id uuid not null references public.product_evidence_sources(source_id),
official_binding_id uuid not null references public.product_source_bindings(binding_id),
official_review_id uuid not null references public.trust_official_source_binding_reviews(review_id),
official_content_digest text not null check(official_content_digest ~ '^[0-9a-f]{64}$'),
fresh_observation_digest text not null check(fresh_observation_digest ~ '^[0-9a-f]{64}$'),
fresh_observed_at timestamptz not null,
reviewed_identity jsonb not null,
unit_reconciliation jsonb not null,
reviewer_user_id uuid not null,
approval_audit_id uuid not null references public.admin_audit_logs(id),
approval_status text not null check(approval_status in('pending','approved','rejected')),
approved_at timestamptz,
created_at timestamptz not null default now(),
check(product_id='4608b3b4-8b51-4464-b46e-380b05c1a3d7'::uuid),
check(subject_id='0b5963bb-67d6-4738-a620-32ec86c1e3d0'::uuid),
check(official_source_id='94b32b8d-8340-4b91-9e62-646794fd4f41'::uuid),
check(official_binding_id='9da03b35-9e00-4c46-8ff0-8f6835382349'::uuid),
check(official_review_id='067e861d-2e61-4ec2-a3f7-660d78be468d'::uuid),
check(approval_status<>'approved' or approved_at is not null)
);
alter table public.bushman_subject_identity_attestations_v1 enable row level security;
alter table public.bushman_subject_identity_attestations_v1 force row level security;
revoke all on public.bushman_subject_identity_attestations_v1 from public,anon,authenticated,service_role;

create or replace function public.bushman_identity_auth_plan_v1(
p_actor_user_id uuid,p_subject_id uuid,p_attestation_id uuid,p_reviewed_identity jsonb
) returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $plan$
declare
s public.product_fact_subjects%rowtype;
pb public.product_source_bindings%rowtype;
rev public.trust_official_source_binding_reviews%rowtype;
att public.bushman_subject_identity_attestations_v1%rowtype;
audit public.admin_audit_logs%rowtype;
current_count bigint;
official_pairs jsonb;
official_rows jsonb;
current_facts jsonb;
instances jsonb;
tasks jsonb;
evidences jsonb;
semantics jsonb;
p jsonb;
snapshot jsonb;
begin
perform public.admin_require_product_review_actor(p_actor_user_id,'admin.products.review');
if p_subject_id is distinct from '0b5963bb-67d6-4738-a620-32ec86c1e3d0'::uuid
 or p_attestation_id is null or jsonb_typeof(p_reviewed_identity)<>'object'
 or not public.product_fact_controlled_json_exact_keys_v1(p_reviewed_identity,array[
'variant_key','variant_key_reviewed_as_null','formulation_revision_key',
'formulation_label','market_applicability','region_applicability','valid_from','valid_to'])
then raise exception 'r4c_r2_reviewed_identity_invalid' using errcode='22023';end if;
select * into s from public.product_fact_subjects where subject_id=p_subject_id;
if not found or s.product_id is distinct from '4608b3b4-8b51-4464-b46e-380b05c1a3d7'::uuid
 or s.subject_semantic_key is distinct from '33696edfb47c47672930e0d398b0cd67fb966c355ec474ea9ec4ffa72400a584'
 or s.formulation_revision_key is distinct from 'data-ai29c-c5-bushman-waterproof-pro-current'
 or s.formulation_label is distinct from 'BUSHMAN Waterproof Pro Suncream 50g'
 or s.variant_key is not null or s.market_applicability is distinct from 'KR'
 or s.region_applicability is not null or s.valid_from is not null or s.valid_to is not null
 or s.identity_status is distinct from 'resolved' or s.current_state is distinct from 'current'
 or s.subject_identity_serializer_version is distinct from 'product-fact-subject-identity-v1'
 or s.identity_resolution_version is distinct from 'data-ai29c-c5-presentation-identity-correction-v1'
then raise exception 'r4c_r2_subject_lineage_invalid' using errcode='55000';end if;
if p_reviewed_identity->'variant_key' is distinct from 'null'::jsonb
 or p_reviewed_identity->'variant_key_reviewed_as_null' is distinct from 'true'::jsonb
 or p_reviewed_identity->>'formulation_revision_key' is distinct from s.formulation_revision_key
 or p_reviewed_identity->>'formulation_label' is distinct from s.formulation_label
 or p_reviewed_identity->>'market_applicability' is distinct from 'KR'
 or p_reviewed_identity->'region_applicability' is distinct from 'null'::jsonb
 or p_reviewed_identity->'valid_from' is distinct from 'null'::jsonb
 or p_reviewed_identity->'valid_to' is distinct from 'null'::jsonb
then raise exception 'r4c_r2_identity_payload_mismatch' using errcode='55000';end if;
if public.product_fact_controlled_sha256_json_v1(jsonb_build_object(
'product_id',s.product_id,'variant_key',s.variant_key,
'formulation_revision_key',s.formulation_revision_key,
'market_applicability',s.market_applicability,'region_applicability',s.region_applicability,
'valid_from',s.valid_from,'valid_to',s.valid_to)) is distinct from s.subject_semantic_key
then raise exception 'r4c_r2_semantic_key_invalid' using errcode='55000';end if;
select count(*) into current_count from public.product_fact_subjects x where
x.product_id=s.product_id and x.current_state='current' and x.identity_status='resolved'
and x.variant_key is not distinct from s.variant_key
and x.market_applicability is not distinct from s.market_applicability
and x.region_applicability is not distinct from s.region_applicability;
if current_count<>1 then raise exception 'r4c_r2_competing_subject' using errcode='55000';end if;
select * into pb from public.product_source_bindings where binding_id='9da03b35-9e00-4c46-8ff0-8f6835382349'::uuid;
if not found or pb.product_id is distinct from s.product_id
or pb.source_url is distinct from 'https://bushmankorea.com/product/%EB%B6%80%EC%89%AC%EB%A7%A8-%EC%9B%8C%ED%84%B0%ED%94%84%EB%A3%A8%ED%94%84-%ED%94%84%EB%A1%9C-%EC%84%A0%ED%81%AC%EB%A6%BC-spf50-pa-50ml/31/'
or pb.source_name is distinct from 'bushman_official'
or pb.market_code is distinct from 'KR'
or pb.binding_state is distinct from 'resolved'
or pb.binding_method is distinct from 'trust_official_source_review_v1'
or pb.product_scope_state is distinct from 'product'
then raise exception 'r4c_r2_product_official_binding_invalid' using errcode='55000';end if;
select * into rev from public.trust_official_source_binding_reviews
where review_id='067e861d-2e61-4ec2-a3f7-660d78be468d'::uuid;
if not found or rev.binding_id is distinct from pb.binding_id
or rev.product_id is distinct from s.product_id
or rev.subject_id is distinct from s.subject_id
or rev.subject_market is distinct from 'KR'
or rev.source_market is distinct from 'KR'
or rev.scope_relation is distinct from 'equivalent'
or rev.variant_key is not null
or rev.formulation_revision_key is distinct from s.formulation_revision_key
or rev.review_version is distinct from 'trust-official-source-review-v1'
then raise exception 'r4c_r2_review_source_invalid' using errcode='55000';end if;

select coalesce(jsonb_agg(jsonb_build_object(
'source_id',bind.source_id,'binding_id',bind.binding_id,'content_digest',src.content_digest
) order by bind.source_id),'[]'::jsonb) into official_pairs
from public.product_evidence_source_subject_bindings bind
join public.product_evidence_sources src on src.source_id=bind.source_id
where bind.subject_id=s.subject_id and bind.product_id=s.product_id
and bind.binding_state='exact_subject_match' and bind.scope_relation='equivalent'
and src.market='KR' and src.region is null and src.canonical_locator=pb.source_url
and src.source_kind in('official_product_page','brand_official_product_page');
select coalesce(jsonb_agg(jsonb_build_object('binding',to_jsonb(bind),'source',to_jsonb(src))
order by bind.source_id),'[]'::jsonb) into official_rows
from public.product_evidence_source_subject_bindings bind
join public.product_evidence_sources src on src.source_id=bind.source_id where bind.subject_id=s.subject_id;
if jsonb_array_length(official_rows)<>4 or official_pairs is distinct from
'[{"source_id":"76cc7f5b-d5dc-4d72-bb1c-ab2a899211c1","binding_id":"c8b91f9b-a1b1-4b26-a435-b390672bf73f","content_digest":"02aa9f0073cd4e4a6f433a3596fe94eee77b0bb8bb880f202c36fd44eb24c701"},{"source_id":"94b32b8d-8340-4b91-9e62-646794fd4f41","binding_id":"2b554836-0c57-4829-ac01-2631f34267d2","content_digest":"3a9fbcb280935133e95a0f7f19bfff20157258b4dc17b8dce4d601e40f6681a9"},{"source_id":"9b98d800-66c3-4a40-880c-4c99f415a920","binding_id":"09650eb5-db97-474b-995c-5f5aeb706467","content_digest":"696c6ab509c4a0045ef5b408b06a2359e08570cc4d3ece1338a749c3fa2e6460"},{"source_id":"f25f3fc4-07b3-45e9-a0a8-12f0d1b37f06","binding_id":"a19156b9-8a1c-4af5-8a8b-d9f58ae9b17d","content_digest":"183405aeaaec9640d798ae38da817a7ca39ceac4881b22485cf2cf118aa3e7ab"}]'::jsonb
then raise exception 'r4c_r2_official_sources_mismatch' using errcode='55000';end if;

select * into att from public.bushman_subject_identity_attestations_v1
where attestation_id=p_attestation_id;
if not found or att.product_id is distinct from s.product_id
or att.subject_id is distinct from s.subject_id
or att.official_source_id is distinct from '94b32b8d-8340-4b91-9e62-646794fd4f41'::uuid
or att.official_binding_id is distinct from pb.binding_id
or att.official_review_id is distinct from rev.review_id
or att.official_content_digest is distinct from '3a9fbcb280935133e95a0f7f19bfff20157258b4dc17b8dce4d601e40f6681a9'
or att.reviewed_identity is distinct from p_reviewed_identity
or att.approval_status is distinct from 'approved' or att.approved_at is null
or att.fresh_observed_at<now()-interval '90 days' or att.fresh_observed_at>now()
or att.unit_reconciliation->>'finding' is distinct from 'same_product_verified'
or att.unit_reconciliation->>'subject_label' is distinct from 'BUSHMAN Waterproof Pro Suncream 50g'
or att.unit_reconciliation->>'official_unit' is distinct from '50ml'
or length(coalesce(att.unit_reconciliation->>'review_rationale',''))<30
then raise exception 'r4c_r2_attestation_missing_or_invalid' using errcode='55000';end if;
select * into audit from public.admin_audit_logs where id=att.approval_audit_id;
if not found or audit.actor_user_id is distinct from att.reviewer_user_id
or audit.required_capability is distinct from 'admin.products.review'
or audit.action is distinct from 'admin.product_fact.bushman_subject_identity_attested'
or audit.target_type is distinct from 'product_fact_subject'
or audit.target_id is distinct from s.subject_id::text
or audit.metadata->>'attestation_id' is distinct from att.attestation_id::text
or audit.metadata->>'fresh_observation_digest' is distinct from att.fresh_observation_digest
then raise exception 'r4c_r2_attestation_audit_invalid' using errcode='55000';end if;

select coalesce(jsonb_agg(to_jsonb(x) order by x.proposition_key),'[]'::jsonb) into current_facts
from public.product_fact_current x where x.subject_id=s.subject_id;
select coalesce(jsonb_agg(to_jsonb(x) order by x.fact_instance_id),'[]'::jsonb) into instances
from public.product_fact_instances x where x.subject_id=s.subject_id;
select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb) into tasks
from public.product_fact_research_tasks x where x.subject_id=s.subject_id;
select coalesce(jsonb_agg(to_jsonb(x) order by x.evidence_id),'[]'::jsonb) into evidences
from public.product_evidence_records x where x.subject_id=s.subject_id;
select coalesce(jsonb_agg(to_jsonb(x) order by x.review_id),'[]'::jsonb) into semantics
from public.sunscreen_recommendation_semantic_field_reviews x where x.subject_id=s.subject_id and x.is_current;
if jsonb_array_length(current_facts)<>3 or jsonb_array_length(instances)<>3
then raise exception 'r4c_r2_fact_lineage_mismatch' using errcode='55000';end if;
snapshot:=jsonb_build_object(
'contract','data-ai29c-filter-r4-c-r2-bushman-v1','subject',to_jsonb(s),
'current_subject_count',current_count,'official_binding',to_jsonb(pb),
'official_review',to_jsonb(rev),'sources_and_bindings',official_rows,
'identity_attestation',to_jsonb(att),'identity_attestation_audit',to_jsonb(audit),
'fact_current',current_facts,'instances',instances,'tasks',tasks,
'evidence',evidences,'semantic_reviews',semantics);
p:=jsonb_build_object('subject_id',s.subject_id,'product_id',s.product_id,
'attestation_id',att.attestation_id,'reviewed_identity',p_reviewed_identity,
'expected_subject_semantic_key',s.subject_semantic_key,
'from_identity_resolution_version','data-ai29c-c5-presentation-identity-correction-v1',
'to_identity_resolution_version','trust-phase5-admin-subject-review-v1',
'reason_code','controlled_bushman_subject_identity_authority_upgrade');
return jsonb_build_object(
'status','ready','subject_id',s.subject_id,'product_id',s.product_id,
'attestation_id',att.attestation_id,'payload',p,
'payload_digest',public.product_fact_controlled_sha256_json_v1(p),
'prestate_digest',public.product_fact_controlled_sha256_json_v1(snapshot),
'planned_writes',jsonb_build_object('product_fact_subjects',1,'product_fact_review_events',1,'admin_audit_logs',1),
'requires_explicit_confirmation',true);
end;$plan$;

create or replace function public.admin_pf_bushman_identity_auth_v1(
p_actor_user_id uuid,p_subject_id uuid,p_attestation_id uuid,p_reviewed_identity jsonb
) returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $pf$
begin return public.bushman_identity_auth_plan_v1(p_actor_user_id,p_subject_id,p_attestation_id,p_reviewed_identity);end;$pf$;

create or replace function public.admin_confirm_bushman_identity_auth_v1(
p_actor_user_id uuid,p_request_id text,p_payload jsonb,
p_expected_payload_digest text,p_expected_prestate_digest text
) returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $confirm$
declare req text:=btrim(coalesce(p_request_id,''));
pd text:=lower(btrim(coalesce(p_expected_payload_digest,'')));
sd text:=lower(btrim(coalesce(p_expected_prestate_digest,'')));
sid uuid; att_id uuid;plan jsonb;replays bigint;
prev public.admin_audit_logs%rowtype;updated timestamptz;audit_id uuid;
begin
perform public.admin_require_product_review_actor(p_actor_user_id,'admin.products.review');
if char_length(req) not between 8 and 120 or pd !~ '^[0-9a-f]{64}$' or sd !~ '^[0-9a-f]{64}$'
or jsonb_typeof(p_payload)<>'object'
or not public.product_fact_controlled_json_exact_keys_v1(p_payload,array[
'subject_id','product_id','attestation_id','reviewed_identity',
'expected_subject_semantic_key','from_identity_resolution_version',
'to_identity_resolution_version','reason_code'])
then raise exception 'r4c_r2_confirmation_invalid' using errcode='22023';end if;
begin sid:=(p_payload->>'subject_id')::uuid;att_id:=(p_payload->>'attestation_id')::uuid;
exception when others then raise exception 'r4c_r2_confirmation_uuid_invalid' using errcode='22023';end;
if sid is distinct from '0b5963bb-67d6-4738-a620-32ec86c1e3d0'::uuid or att_id is null
or p_payload->>'product_id' is distinct from '4608b3b4-8b51-4464-b46e-380b05c1a3d7'
or p_payload->>'expected_subject_semantic_key' is distinct from '33696edfb47c47672930e0d398b0cd67fb966c355ec474ea9ec4ffa72400a584'
or p_payload->>'from_identity_resolution_version' is distinct from 'data-ai29c-c5-presentation-identity-correction-v1'
or p_payload->>'to_identity_resolution_version' is distinct from 'trust-phase5-admin-subject-review-v1'
or p_payload->>'reason_code' is distinct from 'controlled_bushman_subject_identity_authority_upgrade'
then raise exception 'r4c_r2_transition_invalid' using errcode='55000';end if;
perform pg_advisory_xact_lock(hashtextextended('bejewely_bushman_authority:'||sid::text,0));
perform 1 from public.product_fact_subjects where subject_id=sid for update;
if not found then raise exception 'r4c_r2_subject_missing' using errcode='55000';end if;
perform 1 from public.bushman_subject_identity_attestations_v1 where attestation_id=att_id for share;
if not found then raise exception 'r4c_r2_attestation_missing' using errcode='55000';end if;
select count(*) into replays from public.admin_audit_logs a
where a.actor_user_id=p_actor_user_id and a.request_id=req
and a.action='admin.product_fact.bushman_subject_identity_authority_upgraded';
if replays>1 then raise exception 'r4c_r2_idempotency_collision' using errcode='55000';end if;
if replays=1 then
select * into prev from public.admin_audit_logs a where a.actor_user_id=p_actor_user_id
and a.request_id=req and a.action='admin.product_fact.bushman_subject_identity_authority_upgraded' limit 1;
if prev.target_id is distinct from sid::text
or prev.metadata->>'attestation_id' is distinct from att_id::text
or prev.metadata->>'payload_digest' is distinct from pd
or prev.metadata->>'prestate_digest' is distinct from sd
or prev.after_value->>'identity_resolution_version' is distinct from 'trust-phase5-admin-subject-review-v1'
or not exists(select 1 from public.product_fact_subjects x where x.subject_id=sid
and x.identity_resolution_version='trust-phase5-admin-subject-review-v1'
and x.subject_semantic_key='33696edfb47c47672930e0d398b0cd67fb966c355ec474ea9ec4ffa72400a584')
then raise exception 'r4c_r2_request_reuse_conflict' using errcode='55000';end if;
return jsonb_build_object('status','identity_authority_upgraded','idempotent',true,'subject_id',sid,'audit_id',prev.id);
end if;
plan:=public.bushman_identity_auth_plan_v1(p_actor_user_id,sid,att_id,p_payload->'reviewed_identity');
if plan->>'status' is distinct from 'ready' or plan->'payload' is distinct from p_payload
or plan->>'payload_digest' is distinct from pd or plan->>'prestate_digest' is distinct from sd
then raise exception 'r4c_r2_stale_preflight' using errcode='55000';end if;
update public.product_fact_subjects set identity_resolution_version='trust-phase5-admin-subject-review-v1',updated_at=now()
where subject_id=sid and identity_resolution_version='data-ai29c-c5-presentation-identity-correction-v1'
returning updated_at into updated;
if updated is null then raise exception 'r4c_r2_subject_update_failed' using errcode='55000';end if;
insert into public.product_fact_review_events(subject_id,actor_user_id,event_kind,reason_code,event_payload,created_at)
values(sid,p_actor_user_id,'subject_identity_authority_upgraded','controlled_bushman_subject_identity_authority_upgrade',
jsonb_build_object('request_id',req,'attestation_id',att_id,'payload_digest',pd,'prestate_digest',sd),now());
audit_id:=public.record_admin_audit_event(p_actor_user_id,'admin.products.review',
'admin.product_fact.bushman_subject_identity_authority_upgraded','product_fact_subject',sid::text,
jsonb_build_object('identity_resolution_version','data-ai29c-c5-presentation-identity-correction-v1'),
jsonb_build_object('identity_resolution_version','trust-phase5-admin-subject-review-v1'),
'approved BUSHMAN Subject identity authority upgrade',req,
jsonb_build_object('product_id','4608b3b4-8b51-4464-b46e-380b05c1a3d7','subject_semantic_key','33696edfb47c47672930e0d398b0cd67fb966c355ec474ea9ec4ffa72400a584',
'attestation_id',att_id,'payload_digest',pd,'prestate_digest',sd));
return jsonb_build_object('status','identity_authority_upgraded','idempotent',false,'subject_id',sid,
'updated_at',updated,'audit_id',audit_id);
end;$confirm$;

revoke all on function public.bushman_identity_auth_plan_v1(uuid,uuid,uuid,jsonb)
from public,anon,authenticated,service_role;
revoke all on function public.admin_pf_bushman_identity_auth_v1(uuid,uuid,uuid,jsonb)
from public,anon,authenticated,service_role;
revoke all on function public.admin_confirm_bushman_identity_auth_v1(uuid,text,jsonb,text,text)
from public,anon,authenticated,service_role;
grant execute on function public.admin_pf_bushman_identity_auth_v1(uuid,uuid,uuid,jsonb) to service_role;
grant execute on function public.admin_confirm_bushman_identity_auth_v1(uuid,text,jsonb,text,text) to service_role;
do $acl$ begin
if has_table_privilege('service_role','public.product_fact_subjects','UPDATE')
or has_table_privilege('service_role','public.bushman_subject_identity_attestations_v1','INSERT')
or has_table_privilege('service_role','public.bushman_subject_identity_attestations_v1','UPDATE')
or has_function_privilege('service_role','public.bushman_identity_auth_plan_v1(uuid,uuid,uuid,jsonb)','EXECUTE')
or has_function_privilege('anon','public.admin_pf_bushman_identity_auth_v1(uuid,uuid,uuid,jsonb)','EXECUTE')
or has_function_privilege('authenticated','public.admin_pf_bushman_identity_auth_v1(uuid,uuid,uuid,jsonb)','EXECUTE')
or has_function_privilege('anon','public.admin_confirm_bushman_identity_auth_v1(uuid,text,jsonb,text,text)','EXECUTE')
or has_function_privilege('authenticated','public.admin_confirm_bushman_identity_auth_v1(uuid,text,jsonb,text,text)','EXECUTE')
or not has_function_privilege('service_role','public.admin_pf_bushman_identity_auth_v1(uuid,uuid,uuid,jsonb)','EXECUTE')
or not has_function_privilege('service_role','public.admin_confirm_bushman_identity_auth_v1(uuid,text,jsonb,text,text)','EXECUTE')
then raise exception 'r4c_r2_acl_violation' using errcode='55000';end if;
end;$acl$;
commit;
