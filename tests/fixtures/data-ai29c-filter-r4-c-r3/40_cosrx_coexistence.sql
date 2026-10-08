-- Installed alongside unmodified legacy COSRX migration on disposable Pg17.
-- This is boundary/noninterference smoke; not a complete COSRX approval replay.
\set ON_ERROR_STOP on
begin;
do $t$
declare v_message text;
begin
 if to_regprocedure('public.admin_upgrade_product_fact_subject_identity_authority_v1(uuid,text,jsonb,text,text)') is null
 or to_regprocedure('public.admin_confirm_bushman_identity_auth_v1(uuid,text,jsonb,text,text)') is null
 or has_function_privilege('anon','public.admin_upgrade_product_fact_subject_identity_authority_v1(uuid,text,jsonb,text,text)','EXECUTE')
 or has_function_privilege('authenticated','public.admin_upgrade_product_fact_subject_identity_authority_v1(uuid,text,jsonb,text,text)','EXECUTE')
 or not has_function_privilege('service_role','public.admin_upgrade_product_fact_subject_identity_authority_v1(uuid,text,jsonb,text,text)','EXECUTE')
 then raise exception 'R3_COSRX_BUSHMAN_COEXISTENCE_BAD';end if;

 begin
   perform public.admin_preflight_product_fact_subject_identity_authority_upgrade_v1(
   'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
   '00000000-0000-4000-8000-000000000099'::uuid,
   '00000000-0000-4000-8000-000000000098'::uuid,
   '{}'::jsonb);
   raise exception 'R3_COSRX_UNAUTHORIZED_ACCEPTED';
 exception when others then
   get stacked diagnostics v_message=message_text;
   if v_message is distinct from 'admin_product_review_capability_required'
   then raise exception 'R3_COSRX_UNAUTHORIZED_WRONG_REJECTION: %',v_message;end if;
 end;

 begin
   perform public.admin_preflight_product_fact_subject_identity_authority_upgrade_v1(
   'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
   '00000000-0000-4000-8000-000000000099'::uuid,
   '00000000-0000-4000-8000-000000000098'::uuid,
   jsonb_build_object('variant_key',null,'variant_key_reviewed_as_null',true,
   'formulation_revision_key','synthetic-cosrx-revision',
   'formulation_label','Synthetic COSRX item','market_applicability','KR',
   'region_applicability',null,'valid_from',null,'valid_to',null));
   raise exception 'R3_COSRX_UNKNOWN_SUBJECT_ACCEPTED';
 exception when others then
   get stacked diagnostics v_message=message_text;
   if v_message is distinct from 'd5e_d_r3_subject_authority_upgrade_subject_not_found'
   then raise exception 'R3_COSRX_UNKNOWN_SUBJECT_WRONG_REJECTION: %',v_message;end if;
 end;
 if (select identity_resolution_version from public.product_fact_subjects
 where subject_id='0b5963bb-67d6-4738-a620-32ec86c1e3d0') is distinct from
 'trust-phase5-admin-subject-review-v1'
 then raise exception 'R3_BUSHMAN_UPGRADE_LOST_AFTER_COSRX';end if;
 if (select count(*) from public.product_fact_review_events where event_kind='subject_identity_authority_upgraded')<>1
 then raise exception 'R3_BUSHMAN_EVENT_UNEXPECTED_AFTER_COSRX';end if;
 if (select count(*) from public.admin_audit_logs where action='admin.product_fact.subject_identity_authority_upgraded')<>0
 then raise exception 'R3_COSRX_UNEXPECTED_AUTHORITY_WRITE';end if;
end $t$;
rollback;
\echo R3_COSRX_LEGACY_RPC_COEXISTENCE_PASS
