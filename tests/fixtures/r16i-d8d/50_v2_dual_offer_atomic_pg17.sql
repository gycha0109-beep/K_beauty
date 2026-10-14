-- Isolated PostgreSQL 17 only: D8D v2 CAS, true 2-Offer writes and 2-ID rollback.
-- All values/evidence/approvals are FICTIONAL, NOT a real OWNER decision.
\set ON_ERROR_STOP on
BEGIN;

DO $setup$
DECLARE
 pid uuid:='00000000-0000-4000-8000-000000000021';
 target uuid:='b639c8b4-6a61-440e-b4db-fac7381593ff';
 owner_id uuid:='00000000-0000-4000-8000-000000000011';
 actor_other uuid:='00000000-0000-4000-8000-000000000012';
 preview jsonb;
 blocked boolean;
BEGIN
 IF has_table_privilege('service_role','public.admin_r16i_d8d_v2_gate','UPDATE')
    OR has_table_privilege('service_role','public.admin_r16i_d8d_v2_owner_authorizations','INSERT')
    OR has_table_privilege('service_role','public.admin_r16i_d8d_v2_owner_authorizations','UPDATE')
    OR has_function_privilege('anon','public.r16i_d8d_apply_v2(uuid,uuid,uuid,text)','EXECUTE')
    OR has_function_privilege('authenticated','public.r16i_d8d_rollback_v2(uuid,uuid,uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'R16I_V2_PRIVILEGE_GATE_FAIL'; END IF;
 IF (SELECT enabled FROM public.admin_r16i_d8d_v2_gate
    WHERE scope='R16I_S_NATURE_PRODUCT_1') IS DISTINCT FROM false
    OR EXISTS(SELECT 1 FROM public.admin_r16i_d8d_v2_owner_authorizations)
 THEN RAISE EXCEPTION 'R16I_V2_NONDEFAULT_GATE'; END IF;
 -- Fixture has legacy v1 proposal; replace with the precise v2 null plan.
 UPDATE public.admin_product_correction_proposals_v1 SET
 field_changes=jsonb_build_array(
  jsonb_build_object('field','products.size_ml','before',160,'after',80),
  jsonb_build_object('field','products.price_min','before',29900,'after',NULL),
  jsonb_build_object('field','products.price_max','before',29900,'after',NULL),
  jsonb_build_object('field','products.unit_price_per_10ml','before',1868.75,'after',NULL),
  jsonb_build_object('field','products.buy_link',
   'before','https://www.hwahae.co.kr/goods/45194','after',NULL))
 WHERE proposal_id=pid;
 UPDATE public.admin_product_correction_evidence_v1 SET
  selected_option=CASE source_key
   WHEN 'official_single' THEN '수분크림 80ml 1개'
   WHEN 'hwahae_bundle' THEN '수분크림 80ml×2 + 세럼 10ml'
   ELSE selected_option END
 WHERE product_id=target;
 BEGIN
   PERFORM public.r16i_d8d_apply_v2(pid,actor_other,
    '00000000-0000-4000-8000-000000000051','PREVIEW');
   RAISE EXCEPTION 'R16I_V2_NONOWNER_ALLOWED';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM='R16I_V2_NONOWNER_ALLOWED' THEN RAISE; END IF;
   IF SQLERRM NOT LIKE 'R16I_D8D_V2_OWNER_REQUIRED%'
     THEN RAISE; END IF;
 END;
 preview:=public.r16i_d8d_apply_v2(pid,owner_id,
  '00000000-0000-4000-8000-000000000052','PREVIEW');
 IF preview->>'status'<>'PREVIEW_HOLD_NO_WRITE' OR
    preview->>'ownerAuthorizationValid'<>'false' OR
    preview->>'releaseGateEnabled'<>'false' OR
    preview->'after'->>'size_ml'<>'80' OR
    preview->'after'->>'price_min' IS NOT NULL OR
    (SELECT count(*) FROM public.product_offers WHERE product_id=target)<>0
 THEN RAISE EXCEPTION 'R16I_V2_PREVIEW_FAIL'; END IF;
 BEGIN
   PERFORM public.r16i_d8d_apply_v2(pid,owner_id,
    '00000000-0000-4000-8000-000000000053','APPLY');
   RAISE EXCEPTION 'R16I_V2_DISABLED_GATE_BYPASS';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM='R16I_V2_DISABLED_GATE_BYPASS' THEN RAISE; END IF;
   IF SQLERRM NOT LIKE 'R16I_D8D_V2_GATE_DISABLED%' THEN RAISE; END IF;
 END;
 IF (SELECT size_ml FROM public.products WHERE id=target)<>160 OR
    (SELECT count(*) FROM public.product_offers WHERE product_id=target)<>0
 THEN RAISE EXCEPTION 'R16I_V2_DISABLED_APPLY_WROTE'; END IF;
END;
$setup$;
SELECT 'R16I_V2_DEFAULT_HOLD_OWNER_AND_PREVIEW_PASS' AS result;

-- THIS SECTION TESTS A FICTIONAL explicitly approved owner decision.
-- Never copy these authorizations into a connected or Production database.
DO $auth$
DECLARE
 pid uuid:='00000000-0000-4000-8000-000000000021';
 target uuid:='b639c8b4-6a61-440e-b4db-fac7381593ff';
 owner_id uuid:='00000000-0000-4000-8000-000000000011';
 off public.admin_product_correction_evidence_v1%ROWTYPE;
 hw public.admin_product_correction_evidence_v1%ROWTYPE;
 ev jsonb;
 sign text;
BEGIN
 UPDATE public.admin_r16i_d8d_v2_gate SET enabled=true,
  change_ticket='FICTIONAL_PG17_ONLY_0001' WHERE scope='R16I_S_NATURE_PRODUCT_1';
 BEGIN
   PERFORM public.r16i_d8d_apply_v2(pid,owner_id,
    '00000000-0000-4000-8000-000000000054','APPLY');
   RAISE EXCEPTION 'R16I_V2_MISSING_APPROVAL_BYPASS';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM='R16I_V2_MISSING_APPROVAL_BYPASS' THEN RAISE; END IF;
   IF SQLERRM NOT LIKE 'R16I_D8D_V2_OWNER_POLICY_AND_SCOPE_HOLD%'
   THEN RAISE; END IF;
 END;
 SELECT * INTO off FROM public.admin_product_correction_evidence_v1
  WHERE product_id=target AND source_key='official_single';
 SELECT * INTO hw FROM public.admin_product_correction_evidence_v1
  WHERE product_id=target AND source_key='hwahae_bundle';
 ev:=jsonb_build_array(
  jsonb_build_object('evidenceId',off.evidence_id,'sourceKey',off.source_key,
    'url',off.source_url,'selectedOption',off.selected_option,
    'checkoutPrice',off.checkout_price_krw,'capturedAt',off.captured_at),
  jsonb_build_object('evidenceId',hw.evidence_id,'sourceKey',hw.source_key,
    'url',hw.source_url,'selectedOption',hw.selected_option,
    'checkoutPrice',hw.checkout_price_krw,'capturedAt',hw.captured_at)
 );
 sign:=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(ev::text,'UTF8')),'hex');
 INSERT INTO public.admin_r16i_d8d_v2_owner_authorizations(
 proposal_id,product_id,product_revision,price_policy,evidence_fingerprint,
 approved_by,product_identity_attested,review_population_attested,
 source_binding_attested,seller_option_scopes_attested,expires_at
 ) VALUES(pid,target,(SELECT product_revision FROM public.admin_product_correction_proposals_v1
  WHERE proposal_id=pid),'A_PRODUCT_PRICE_NULL_SELLER_OFFERS_ONLY',sign,
  owner_id,true,true,true,true,now()+interval '1 hour');
END;
$auth$;
SELECT 'R16I_V2_OWNER_ATTESTATION_FICTIONAL_SETUP_PASS' AS result;

DO $failure$
DECLARE
 pid uuid:='00000000-0000-4000-8000-000000000021';
 target uuid:='b639c8b4-6a61-440e-b4db-fac7381593ff';
 owner_id uuid:='00000000-0000-4000-8000-000000000011';
BEGIN
 -- Failure after Product update + first Offer insert must revert everything.
 CREATE FUNCTION public.r16i_fixture_fail_second_offer_v2() RETURNS trigger
 LANGUAGE plpgsql AS $fn$
 BEGIN
  IF NEW.seller_key='hwahae' THEN
    RAISE EXCEPTION 'R16I_V2_INJECT_SECOND_OFFER_FAILURE';
  END IF;
  RETURN NEW;
 END;
 $fn$;
 CREATE TRIGGER r16i_v2_fail_second BEFORE INSERT ON public.product_offers
 FOR EACH ROW EXECUTE FUNCTION public.r16i_fixture_fail_second_offer_v2();
 BEGIN
  PERFORM public.r16i_d8d_apply_v2(pid,owner_id,
   '00000000-0000-4000-8000-000000000055','APPLY');
  RAISE EXCEPTION 'R16I_V2_SECOND_OFFER_FAILURE_NOT_CAUGHT';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM='R16I_V2_SECOND_OFFER_FAILURE_NOT_CAUGHT' THEN RAISE; END IF;
  IF SQLERRM NOT LIKE 'R16I_V2_INJECT_SECOND_OFFER_FAILURE%' THEN RAISE; END IF;
 END;
 DROP TRIGGER r16i_v2_fail_second ON public.product_offers;
 DROP FUNCTION public.r16i_fixture_fail_second_offer_v2();
 IF (SELECT size_ml FROM public.products WHERE id=target)<>160 OR
  (SELECT price_min FROM public.products WHERE id=target)<>29900 OR
  EXISTS(SELECT 1 FROM public.product_offers WHERE product_id=target) OR
  EXISTS(SELECT 1 FROM public.admin_r16i_d8d_v2_applications)
 THEN RAISE EXCEPTION 'R16I_V2_ATOMICITY_VIOLATION'; END IF;
END;
$failure$;
SELECT 'R16I_V2_FAIL_SECOND_INSERT_ALL_ROWS_ROLLBACK_PASS' AS result;

DO $apply$
DECLARE
 pid uuid:='00000000-0000-4000-8000-000000000021';
 target uuid:='b639c8b4-6a61-440e-b4db-fac7381593ff';
 actor uuid:='00000000-0000-4000-8000-000000000011';
 id1 uuid:='00000000-0000-4000-8000-000000000056';
 applied jsonb;
 again jsonb;
 app uuid;
 rejected boolean;
BEGIN
 applied:=public.r16i_d8d_apply_v2(pid,actor,id1,'APPLY');
 IF applied->>'status'<>'APPLIED' OR applied->>'productWrites'<>'1' OR
    applied->>'offerWrites'<>'2' THEN
   RAISE EXCEPTION 'R16I_V2_APPLY_STATUS_WRONG'; END IF;
 app:=(applied->>'applicationId')::uuid;
 IF (SELECT count(*) FROM public.admin_r16i_d8d_v2_application_offers
      WHERE application_id=app)<>2 OR
    (SELECT count(DISTINCT seller_key) FROM public.admin_r16i_d8d_v2_application_offers
      WHERE application_id=app)<>2 OR
    (SELECT count(*) FROM public.product_offers WHERE product_id=target)<>2 OR
    NOT EXISTS(SELECT 1 FROM public.products WHERE id=target AND
      size_ml=80 AND price_min IS NULL AND price_max IS NULL
      AND unit_price_per_10ml IS NULL AND buy_link IS NULL) OR
    (SELECT count(*) FROM public.product_offers WHERE product_id=target AND
      offer_state='current' AND availability_state='unknown' AND
      link_health_state='unchecked' AND product_scope_state='product_subject_unresolved')<>2
 THEN RAISE EXCEPTION 'R16I_V2_APPLY_NOT_TWO_SCOPE_SAFE_OFFERS'; END IF;
 again:=public.r16i_d8d_apply_v2(pid,actor,id1,'APPLY');
 IF again->>'status'<>'ALREADY_APPLIED' OR again->>'offerWrites'<>'0' THEN
  RAISE EXCEPTION 'R16I_V2_DUPLICATE_REQUEST_NOT_IDEMPOTENT'; END IF;
 BEGIN
   PERFORM public.r16i_d8d_apply_v2(pid,actor,
    '00000000-0000-4000-8000-000000000057','APPLY');
   RAISE EXCEPTION 'R16I_V2_DIFFERENT_REQUEST_ALLOWED';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM='R16I_V2_DIFFERENT_REQUEST_ALLOWED' THEN RAISE; END IF;
 END;
END;
$apply$;
SELECT 'R16I_V2_TWO_OFFERS_APPLY_AND_RETRY_PASS' AS result;

DO $rollback$
DECLARE
 actor uuid:='00000000-0000-4000-8000-000000000011';
 target uuid:='b639c8b4-6a61-440e-b4db-fac7381593ff';
 app uuid;
 offer1 uuid;
 offer2 uuid;
 response jsonb;
BEGIN
 SELECT application_id INTO app FROM public.admin_r16i_d8d_v2_applications;
 SELECT offer_id INTO offer1 FROM public.admin_r16i_d8d_v2_application_offers
  WHERE application_id=app AND ordinal=1;
 SELECT offer_id INTO offer2 FROM public.admin_r16i_d8d_v2_application_offers
  WHERE application_id=app AND ordinal=2;
 -- Mutating either offer must prevent the entire rollback.
 BEGIN
  UPDATE public.product_offers SET price_amount=12345 WHERE offer_id=offer1;
  PERFORM public.r16i_d8d_rollback_v2(app,actor,
   '00000000-0000-4000-8000-000000000058');
  RAISE EXCEPTION 'R16I_V2_FIRST_OFFER_DRIFT_NOT_DETECTED';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM='R16I_V2_FIRST_OFFER_DRIFT_NOT_DETECTED' THEN RAISE; END IF;
  IF SQLERRM NOT LIKE 'R16I_D8D_V2_ROLLBACK_OFFER_DRIFT%' THEN RAISE; END IF;
 END;
 BEGIN
  UPDATE public.product_offers SET price_amount=12345 WHERE offer_id=offer2;
  PERFORM public.r16i_d8d_rollback_v2(app,actor,
   '00000000-0000-4000-8000-000000000059');
  RAISE EXCEPTION 'R16I_V2_SECOND_OFFER_DRIFT_NOT_DETECTED';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM='R16I_V2_SECOND_OFFER_DRIFT_NOT_DETECTED' THEN RAISE; END IF;
  IF SQLERRM NOT LIKE 'R16I_D8D_V2_ROLLBACK_OFFER_DRIFT%' THEN RAISE; END IF;
 END;
 BEGIN
  UPDATE public.products SET size_ml=81 WHERE id=target;
  PERFORM public.r16i_d8d_rollback_v2(app,actor,
   '00000000-0000-4000-8000-000000000060');
  RAISE EXCEPTION 'R16I_V2_PRODUCT_DRIFT_NOT_DETECTED';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM='R16I_V2_PRODUCT_DRIFT_NOT_DETECTED' THEN RAISE; END IF;
  IF SQLERRM NOT LIKE 'R16I_D8D_V2_ROLLBACK_PRODUCT_DRIFT%' THEN RAISE; END IF;
 END;
 response:=public.r16i_d8d_rollback_v2(app,actor,
  '00000000-0000-4000-8000-000000000061');
 IF response->>'status'<>'ROLLED_BACK' OR response->>'offerDeletes'<>'2'
 OR (SELECT count(*) FROM public.product_offers WHERE product_id=target)<>0
 OR NOT EXISTS(SELECT 1 FROM public.products WHERE id=target AND size_ml=160
    AND price_min=29900 AND price_max=29900 AND unit_price_per_10ml=1868.75
    AND buy_link='https://www.hwahae.co.kr/goods/45194')
 OR (SELECT count(*) FROM public.admin_r16i_d8d_v2_application_offers
    WHERE application_id=app)<>2
 OR (SELECT count(*) FROM public.admin_r16i_d8d_v2_events
    WHERE application_id=app)<>2
 THEN RAISE EXCEPTION 'R16I_V2_ROLLBACK_NOT_ATOMIC'; END IF;
 response:=public.r16i_d8d_rollback_v2(app,actor,
  '00000000-0000-4000-8000-000000000061');
 IF response->>'status'<>'ALREADY_ROLLED_BACK' OR response->>'offerDeletes'<>'0'
 THEN RAISE EXCEPTION 'R16I_V2_ROLLBACK_RETRY_NOT_IDEMPOTENT'; END IF;
END;
$rollback$;
SELECT 'R16I_V2_TWO_OFFER_CAS_ROLLBACK_PASS' AS result;

-- Test runtime inside one SQL transaction, leave historical v1 fixture unchanged.
ROLLBACK;
DO $post$
BEGIN
 IF EXISTS(SELECT 1 FROM public.admin_r16i_d8d_v2_applications)
  OR EXISTS(SELECT 1 FROM public.admin_r16i_d8d_v2_application_offers)
  OR EXISTS(SELECT 1 FROM public.admin_r16i_d8d_v2_events)
  OR EXISTS(SELECT 1 FROM public.admin_r16i_d8d_v2_owner_authorizations)
  OR (SELECT enabled FROM public.admin_r16i_d8d_v2_gate
      WHERE scope='R16I_S_NATURE_PRODUCT_1') IS DISTINCT FROM false
  OR (SELECT size_ml FROM public.products
      WHERE id='b639c8b4-6a61-440e-b4db-fac7381593ff')<>160
 THEN RAISE EXCEPTION 'R16I_V2_FIXTURE_OUTER_ROLLBACK_FAILED'; END IF;
END;
$post$;
SELECT 'R16I_V2_ISOLATED_PG17_NO_RESIDUAL_WRITES_PASS' AS result;
