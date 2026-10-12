-- Run only in isolated PG17 after 00_minimal_pg17.sql and the D8D migration.
-- Every commercial number here is SYNTHETIC and exists only in the isolated test database.
DO $$
DECLARE
 payload jsonb;
 has_error boolean;
 pid uuid:='00000000-0000-4000-8000-000000000021';
 actor uuid:='00000000-0000-4000-8000-000000000011';
 wrong_actor uuid:='00000000-0000-4000-8000-000000000012';
BEGIN
  SELECT public.r16i_d8d_apply_v1(pid,actor,gen_random_uuid(),'PREVIEW') INTO payload;
  IF payload->>'status'<>'PREVIEW_VERIFIED_NO_WRITE' OR
     (payload->>'productWrites')::integer<>0 OR
     (payload->>'releaseGateEnabled')::boolean<>false OR
     (payload->'after'->>'price_min')::integer<>24000 OR
     (payload->'plannedOffer'->>'price_amount')::integer<>29900
  THEN RAISE EXCEPTION 'D8D_PREVIEW_MISMATCH'; END IF;
  IF (SELECT count(*) FROM public.product_offers)<>0 OR
     (SELECT size_ml FROM public.products WHERE id='b639c8b4-6a61-440e-b4db-fac7381593ff')<>160
  THEN RAISE EXCEPTION 'D8D_PREVIEW_NOT_READ_ONLY'; END IF;

  has_error:=false;
  BEGIN
    PERFORM public.r16i_d8d_apply_v1(pid,wrong_actor,gen_random_uuid(),'APPLY');
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM='R16I_D8D_OWNER_REQUIRED' THEN has_error:=true; ELSE RAISE; END IF;
  END;
  IF NOT has_error THEN RAISE EXCEPTION 'D8D_OPERATOR_BYPASS'; END IF;

  has_error:=false;
  BEGIN
    PERFORM public.r16i_d8d_apply_v1(pid,actor,gen_random_uuid(),'APPLY');
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM='R16I_D8D_RELEASE_GATE_DISABLED' THEN has_error:=true; ELSE RAISE; END IF;
  END;
  IF NOT has_error THEN RAISE EXCEPTION 'D8D_DISABLED_GATE_BYPASS'; END IF;
  IF (SELECT count(*) FROM public.admin_r16i_correction_applications_v1)<>0 OR
     (SELECT count(*) FROM public.product_offers)<>0
  THEN RAISE EXCEPTION 'D8D_BLOCKED_ATTEMPT_WRITTEN'; END IF;
END;
$$;

-- Explicitly isolated-only gate enablement. Production gate always remains FALSE.
UPDATE public.admin_r16i_correction_release_gate_v1
 SET enabled=true,change_ticket='PG17_SYNTHETIC_TEST_ONLY'
 WHERE scope='R16I_S_NATURE_PRODUCT_1';

CREATE FUNCTION public.fixture_offer_reject() RETURNS trigger LANGUAGE plpgsql
AS $$BEGIN RAISE EXCEPTION 'SYNTHETIC_OFFER_WRITE_FAILURE';END;$$;
CREATE TRIGGER fixture_offer_write_failure BEFORE INSERT ON public.product_offers
 FOR EACH ROW EXECUTE FUNCTION public.fixture_offer_reject();
DO $$
DECLARE has_error boolean:=false;
BEGIN
 BEGIN
  PERFORM public.r16i_d8d_apply_v1(
    '00000000-0000-4000-8000-000000000021',
    '00000000-0000-4000-8000-000000000011',gen_random_uuid(),'APPLY');
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM='SYNTHETIC_OFFER_WRITE_FAILURE' THEN has_error:=true; ELSE RAISE; END IF;
 END;
 IF NOT has_error OR
   (SELECT size_ml FROM public.products WHERE id='b639c8b4-6a61-440e-b4db-fac7381593ff')<>160 OR
   (SELECT price_min FROM public.products WHERE id='b639c8b4-6a61-440e-b4db-fac7381593ff')<>29900 OR
   (SELECT count(*) FROM public.product_offers)<>0 OR
   (SELECT count(*) FROM public.admin_r16i_correction_applications_v1)<>0 OR
   (SELECT count(*) FROM public.admin_r16i_correction_application_events_v1)<>0
 THEN RAISE EXCEPTION 'D8D_MID_TRANSACTION_ROLLBACK_FAILED'; END IF;
END;
$$;
DROP TRIGGER fixture_offer_write_failure ON public.product_offers;
DROP FUNCTION public.fixture_offer_reject();

DO $$
DECLARE
 result jsonb;
 applied_id uuid;
 old_revision timestamptz;
 has_error boolean;
BEGIN
 SELECT public.r16i_d8d_apply_v1(
   '00000000-0000-4000-8000-000000000021',
   '00000000-0000-4000-8000-000000000011',
   '00000000-0000-4000-8000-000000000051','APPLY')
 INTO result;
 IF result->>'status'<>'APPLIED' OR
    (result->>'productWrites')::integer<>1 OR
    (result->>'offerWrites')::integer<>1 OR
    (SELECT size_ml FROM public.products WHERE id='b639c8b4-6a61-440e-b4db-fac7381593ff')<>80 OR
    (SELECT price_min FROM public.products WHERE id='b639c8b4-6a61-440e-b4db-fac7381593ff')<>24000 OR
    (SELECT unit_price_per_10ml FROM public.products WHERE id='b639c8b4-6a61-440e-b4db-fac7381593ff')<>3000 OR
    (SELECT count(*) FROM public.product_offers WHERE seller_key='hwahae' AND listing_id='45194' AND price_amount=29900 AND product_scope_state='product_subject_unresolved')<>1 OR
    (SELECT count(*) FROM public.admin_r16i_correction_application_events_v1 WHERE event_type='APPLIED')<>1
 THEN RAISE EXCEPTION 'D8D_APPLY_TRANSACTION_OR_AUDIT_FAILED'; END IF;
 applied_id:=(result->>'applicationId')::uuid;

 has_error:=false;
 BEGIN
   PERFORM public.r16i_d8d_apply_v1(
     '00000000-0000-4000-8000-000000000021',
     '00000000-0000-4000-8000-000000000011',gen_random_uuid(),'APPLY');
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM='R16I_D8D_ALREADY_APPLIED' THEN has_error:=true; ELSE RAISE; END IF;
 END;
 IF NOT has_error THEN RAISE EXCEPTION 'D8D_DUPLICATE_APPLICATION_ALLOWED'; END IF;

 -- Alter a result to simulate downstream drift; safe rollback must reject this.
 UPDATE public.products SET price_min=23999
  WHERE id='b639c8b4-6a61-440e-b4db-fac7381593ff';
 has_error:=false;
 BEGIN
   PERFORM public.r16i_d8d_rollback_v1(
     applied_id,'00000000-0000-4000-8000-000000000011',gen_random_uuid());
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM='R16I_D8D_ROLLBACK_DRIFT' THEN has_error:=true; ELSE RAISE; END IF;
 END;
 IF NOT has_error OR (SELECT count(*) FROM public.product_offers)<>1
 THEN RAISE EXCEPTION 'D8D_ROLLBACK_DRIFT_NOT_BLOCKED'; END IF;

 -- Restore the synthetic after-image solely for rollback testing.
 ALTER TABLE public.products DISABLE TRIGGER trg_products_updated_at;
 UPDATE public.products SET price_min=24000,
    updated_at=(SELECT (after_values->>'updated_at')::timestamptz
      FROM public.admin_r16i_correction_applications_v1 WHERE application_id=applied_id)
    WHERE id='b639c8b4-6a61-440e-b4db-fac7381593ff';
 ALTER TABLE public.products ENABLE TRIGGER trg_products_updated_at;

 SELECT public.r16i_d8d_rollback_v1(
   applied_id,'00000000-0000-4000-8000-000000000011',
   '00000000-0000-4000-8000-000000000052') INTO result;
 IF result->>'status'<>'ROLLED_BACK' OR
    (result->>'offerDeletes')::integer<>1 OR
    (SELECT count(*) FROM public.product_offers)<>0 OR
    (SELECT size_ml FROM public.products WHERE id='b639c8b4-6a61-440e-b4db-fac7381593ff')<>160 OR
    (SELECT price_min FROM public.products WHERE id='b639c8b4-6a61-440e-b4db-fac7381593ff')<>29900 OR
    (SELECT unit_price_per_10ml FROM public.products WHERE id='b639c8b4-6a61-440e-b4db-fac7381593ff')<>1868.75 OR
    (SELECT count(*) FROM public.admin_r16i_correction_application_events_v1)<>2 OR
    (SELECT count(*) FROM public.admin_r16i_correction_applications_v1 WHERE rolled_back_at IS NOT NULL)<>1
 THEN RAISE EXCEPTION 'D8D_ROLLBACK_RESULT_FAILED'; END IF;

 has_error:=false;
 BEGIN
   PERFORM public.r16i_d8d_rollback_v1(
     applied_id,'00000000-0000-4000-8000-000000000011',gen_random_uuid());
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM='R16I_D8D_ROLLBACK_NOT_AVAILABLE' THEN has_error:=true; ELSE RAISE; END IF;
 END;
 IF NOT has_error THEN RAISE EXCEPTION 'D8D_DUPLICATE_ROLLBACK_ALLOWED'; END IF;
END;
$$;

DO $$
BEGIN
  IF NOT has_function_privilege('service_role','public.r16i_d8d_apply_v1(uuid,uuid,uuid,text)','EXECUTE')
    OR has_function_privilege('anon','public.r16i_d8d_apply_v1(uuid,uuid,uuid,text)','EXECUTE')
    OR has_function_privilege('authenticated','public.r16i_d8d_apply_v1(uuid,uuid,uuid,text)','EXECUTE')
    OR NOT has_function_privilege('service_role','public.r16i_d8d_rollback_v1(uuid,uuid,uuid)','EXECUTE')
    OR has_function_privilege('anon','public.r16i_d8d_rollback_v1(uuid,uuid,uuid)','EXECUTE')
    OR has_function_privilege('authenticated','public.r16i_d8d_rollback_v1(uuid,uuid,uuid)','EXECUTE')
    OR (SELECT enabled FROM public.admin_r16i_correction_release_gate_v1
        WHERE scope='R16I_S_NATURE_PRODUCT_1') IS DISTINCT FROM true
  THEN RAISE EXCEPTION 'D8D_PRIVILEGE_OR_ROLLOUT_GATE_CONTRACT_FAILED'; END IF;
END;
$$;
SELECT 'R16I_D8D_PG17_APPLY_FAIL_ROLLBACK_PASS' AS result;
