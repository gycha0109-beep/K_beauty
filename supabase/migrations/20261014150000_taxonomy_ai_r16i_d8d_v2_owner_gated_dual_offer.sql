-- R16I-R4 D8D v2: guarded two-seller offer correction, independent of v1.
-- Schema/RPC deployment is NOT Product/Offer APPLY authorization.
-- Gate defaults OFF and explicit OWNER attestation is absent by default.
-- Only a separately attested owner/production change process may authorize data writes.
-- Do not change existing v1 functions, gates, or application history.

CREATE TABLE public.admin_r16i_d8d_v2_gate (
 scope text PRIMARY KEY CHECK (scope='R16I_S_NATURE_PRODUCT_1'),
 enabled boolean NOT NULL DEFAULT false,
 change_ticket text,
 changed_at timestamptz NOT NULL DEFAULT now(),
 CHECK (NOT enabled OR char_length(btrim(coalesce(change_ticket,'')))>=12)
);
INSERT INTO public.admin_r16i_d8d_v2_gate(scope,enabled)
VALUES ('R16I_S_NATURE_PRODUCT_1',false);

-- Independent external approval, never synthesized from proposal strategy or a
-- PREVIEW. service_role may SELECT it but may not create/modify it.
CREATE TABLE public.admin_r16i_d8d_v2_owner_authorizations (
 authorization_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 proposal_id uuid NOT NULL UNIQUE REFERENCES public.admin_product_correction_proposals_v1(proposal_id) ON DELETE RESTRICT,
 product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
 product_revision timestamptz NOT NULL,
 price_policy text NOT NULL CHECK (price_policy='A_PRODUCT_PRICE_NULL_SELLER_OFFERS_ONLY'),
 evidence_fingerprint text NOT NULL CHECK(evidence_fingerprint ~ '^[a-f0-9]{64}$'),
 approved_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 product_identity_attested boolean NOT NULL DEFAULT false,
 review_population_attested boolean NOT NULL DEFAULT false,
 source_binding_attested boolean NOT NULL DEFAULT false,
 seller_option_scopes_attested boolean NOT NULL DEFAULT false,
 approved_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL,
 revoked_at timestamptz,
 CHECK (expires_at>approved_at)
);

CREATE TABLE public.admin_r16i_d8d_v2_applications (
 application_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 proposal_id uuid NOT NULL UNIQUE REFERENCES public.admin_product_correction_proposals_v1(proposal_id) ON DELETE RESTRICT,
 decision_id uuid NOT NULL REFERENCES public.admin_product_correction_decisions_v1(decision_id) ON DELETE RESTRICT,
 authorization_id uuid NOT NULL REFERENCES public.admin_r16i_d8d_v2_owner_authorizations(authorization_id) ON DELETE RESTRICT,
 product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
 before_values jsonb NOT NULL, after_values jsonb NOT NULL,
 evidence_fingerprint text NOT NULL,
 applied_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 apply_request_id uuid NOT NULL UNIQUE,
 applied_at timestamptz NOT NULL DEFAULT now(),
 rolled_back_at timestamptz,
 rolled_back_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
 rollback_request_id uuid UNIQUE,
 CHECK ((rolled_back_at IS NULL AND rolled_back_by IS NULL AND rollback_request_id IS NULL)
    OR (rolled_back_at IS NOT NULL AND rolled_back_by IS NOT NULL AND rollback_request_id IS NOT NULL))
);
CREATE UNIQUE INDEX admin_r16i_d8d_v2_active_product_idx
 ON public.admin_r16i_d8d_v2_applications(product_id) WHERE rolled_back_at IS NULL;

CREATE TABLE public.admin_r16i_d8d_v2_application_offers (
 application_id uuid NOT NULL REFERENCES public.admin_r16i_d8d_v2_applications(application_id) ON DELETE RESTRICT,
 ordinal smallint NOT NULL CHECK(ordinal IN (1,2)),
 offer_id uuid NOT NULL UNIQUE,
 seller_key text NOT NULL CHECK(seller_key IN ('snature','hwahae')),
 evidence_id uuid NOT NULL UNIQUE REFERENCES public.admin_product_correction_evidence_v1(evidence_id) ON DELETE RESTRICT,
 offer_values jsonb NOT NULL,
 PRIMARY KEY(application_id,ordinal),
 UNIQUE(application_id,seller_key)
);
CREATE TABLE public.admin_r16i_d8d_v2_events (
 event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 application_id uuid NOT NULL REFERENCES public.admin_r16i_d8d_v2_applications(application_id) ON DELETE RESTRICT,
 event_type text NOT NULL CHECK(event_type IN ('APPLIED','ROLLED_BACK')),
 event_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 request_id uuid NOT NULL UNIQUE,
 before_values jsonb NOT NULL, after_values jsonb NOT NULL,
 occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX admin_r16i_d8d_v2_events_once
 ON public.admin_r16i_d8d_v2_events(application_id,event_type);

ALTER TABLE public.admin_r16i_d8d_v2_gate ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_r16i_d8d_v2_owner_authorizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_r16i_d8d_v2_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_r16i_d8d_v2_application_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_r16i_d8d_v2_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_r16i_d8d_v2_gate,public.admin_r16i_d8d_v2_owner_authorizations,
 public.admin_r16i_d8d_v2_applications,public.admin_r16i_d8d_v2_application_offers,
 public.admin_r16i_d8d_v2_events FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.admin_r16i_d8d_v2_gate,
 public.admin_r16i_d8d_v2_owner_authorizations TO service_role;
GRANT SELECT,INSERT,UPDATE ON public.admin_r16i_d8d_v2_applications TO service_role;
GRANT SELECT,INSERT ON public.admin_r16i_d8d_v2_application_offers,
 public.admin_r16i_d8d_v2_events TO service_role;

-- SECURITY INVOKER: only trusted server's service_role can call after session
-- owner verification. p_actor_id is never adequate on its own.
CREATE FUNCTION public.r16i_d8d_apply_v2(
 p_proposal_id uuid,p_actor_id uuid,p_request_id uuid,p_mode text DEFAULT 'PREVIEW'
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $r16i_v2$
DECLARE
 pr public.admin_product_correction_proposals_v1%ROWTYPE;
 d public.admin_product_correction_decisions_v1%ROWTYPE;
 p public.products%ROWTYPE;
 a public.admin_r16i_d8d_v2_owner_authorizations%ROWTYPE;
 e_off public.admin_product_correction_evidence_v1%ROWTYPE;
 e_hw public.admin_product_correction_evidence_v1%ROWTYPE;
 existing_app public.admin_r16i_d8d_v2_applications%ROWTYPE;
 inserted public.products%ROWTYPE;
 o1 public.product_offers%ROWTYPE;
 o2 public.product_offers%ROWTYPE;
 app_id uuid;
 gate_enabled boolean;
 before_json jsonb;
 after_json jsonb;
 ev_json jsonb;
 fingerprint text;
 expected_fields jsonb;
 v_off jsonb;
 v_hw jsonb;
BEGIN
 IF p_proposal_id IS NULL OR p_actor_id IS NULL OR p_request_id IS NULL
    OR p_mode NOT IN ('PREVIEW','APPLY') OR p_mode IS NULL
 THEN RAISE EXCEPTION 'R16I_D8D_V2_BAD_REQUEST'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.admin_memberships
   WHERE user_id=p_actor_id AND role='admin_owner' AND is_active=true)
 THEN RAISE EXCEPTION 'R16I_D8D_V2_OWNER_REQUIRED'; END IF;
 -- Coordinate v2 callers, including a concurrent same-listing v2 application.
 PERFORM pg_catalog.pg_advisory_xact_lock(195721,16);
 SELECT * INTO pr FROM public.admin_product_correction_proposals_v1
  WHERE proposal_id=p_proposal_id FOR UPDATE;
 IF NOT FOUND OR pr.product_id<>'b639c8b4-6a61-440e-b4db-fac7381593ff'::uuid
  OR pr.strategy<>'A_PRODUCT_ANCHOR_REUSE_AND_OFFER_SEPARATION'
 THEN RAISE EXCEPTION 'R16I_D8D_V2_PROPOSAL_INVALID'; END IF;
 SELECT * INTO existing_app FROM public.admin_r16i_d8d_v2_applications
  WHERE apply_request_id=p_request_id FOR UPDATE;
 IF FOUND THEN
   IF existing_app.proposal_id=p_proposal_id AND existing_app.applied_by=p_actor_id
     AND existing_app.rolled_back_at IS NULL
   THEN RETURN jsonb_build_object('status','ALREADY_APPLIED','applicationId',existing_app.application_id,
      'productWrites',0,'offerWrites',0);
   END IF;
   RAISE EXCEPTION 'R16I_D8D_V2_REPLAY_OR_ROLLBACK_CONFLICT';
 END IF;
 SELECT * INTO p FROM public.products WHERE id=pr.product_id FOR UPDATE;
 IF NOT FOUND OR p.updated_at IS DISTINCT FROM pr.product_revision OR
    p.name IS DISTINCT FROM '아쿠아 스쿠알란 수분크림' OR
    p.brand IS DISTINCT FROM '에스네이처' OR
    p.category::text IS DISTINCT FROM 'moisturizer_cream' OR
    p.size_ml IS DISTINCT FROM 160 OR p.price_min IS DISTINCT FROM 29900 OR
    p.price_max IS DISTINCT FROM 29900 OR p.unit_price_per_10ml IS DISTINCT FROM 1868.75 OR
    p.buy_link IS DISTINCT FROM 'https://www.hwahae.co.kr/goods/45194' OR
    p.hwahae_url IS DISTINCT FROM 'https://www.hwahae.co.kr/goods/45194' OR
    p.source_url IS DISTINCT FROM 'https://www.hwahae.co.kr/goods/45194' OR
    p.external_source IS DISTINCT FROM 'hwahae' OR p.external_type IS DISTINCT FROM 'goods' OR
    p.external_id IS DISTINCT FROM '45194' OR
    p.market_signals->>'review_count' IS DISTINCT FROM '41475' OR
    p.market_signals->>'rating' IS DISTINCT FROM '4.58'
 THEN RAISE EXCEPTION 'R16I_D8D_V2_PRESTATE_DRIFT'; END IF;
 IF EXISTS(SELECT 1 FROM public.admin_r16i_correction_applications_v1
     WHERE product_id=p.id AND rolled_back_at IS NULL)
    OR EXISTS(SELECT 1 FROM public.admin_r16i_d8d_v2_applications
     WHERE product_id=p.id AND rolled_back_at IS NULL)
    OR EXISTS(SELECT 1 FROM public.product_offers WHERE product_id=p.id OR
       (seller_key='snature' AND (listing_id='151' OR
        listing_url='https://www.snature.kr/product/detail.html?product_no=151')) OR
       (seller_key='hwahae' AND (listing_id='45194' OR
        listing_url='https://www.hwahae.co.kr/goods/45194')))
    OR EXISTS(SELECT 1 FROM public.product_fact_subjects WHERE product_id=p.id)
    OR (SELECT count(*) FROM public.product_source_bindings
        WHERE product_id=p.id AND source_name='hwahae' AND
        external_type='goods' AND external_id='45194' AND
        source_url='https://www.hwahae.co.kr/goods/45194'
        AND binding_state='resolved' AND product_scope_state='product_subject_unresolved')<>1
    OR (SELECT count(*) FROM public.product_source_bindings WHERE product_id=p.id)<>1
    OR (SELECT count(*) FROM public.catalog_trust_intake WHERE product_id=p.id AND
        identity_state='SUBJECT_CREATION_REQUIRED' AND trust_state='REVIEW_REQUIRED'
        AND subject_id IS NULL)<>1
    OR (SELECT count(*) FROM public.catalog_trust_intake WHERE product_id=p.id)<>1
 THEN RAISE EXCEPTION 'R16I_D8D_V2_COLLISION_OR_SCOPE_DRIFT'; END IF;
 IF cardinality(pr.evidence_ids)<>2 OR
    (SELECT count(DISTINCT z.id) FROM unnest(pr.evidence_ids) AS z(id))<>2
 THEN RAISE EXCEPTION 'R16I_D8D_V2_TWO_DISTINCT_EVIDENCE_REQUIRED'; END IF;
 SELECT e.* INTO e_off FROM public.admin_product_correction_evidence_v1 e
  WHERE e.evidence_id=ANY(pr.evidence_ids) AND e.product_id=p.id
   AND e.source_key='official_single'
   AND e.source_url='https://www.snature.kr/product/detail.html?product_no=151'
   AND e.selected_option='수분크림 80ml 1개'
   AND e.checkout_price_krw>0
   AND e.captured_at BETWEEN now()-interval '30 days' AND now()+interval '5 minutes'
   AND (SELECT count(*) FROM public.admin_product_correction_evidence_verdicts_v1 v
      WHERE v.evidence_id=e.evidence_id AND v.verdict='VERIFIED')=1;
 SELECT e.* INTO e_hw FROM public.admin_product_correction_evidence_v1 e
  WHERE e.evidence_id=ANY(pr.evidence_ids) AND e.product_id=p.id
   AND e.source_key='hwahae_bundle'
   AND e.source_url='https://www.hwahae.co.kr/goods/45194'
   AND e.selected_option='수분크림 80ml×2 + 세럼 10ml'
   AND e.checkout_price_krw>0
   AND e.captured_at BETWEEN now()-interval '30 days' AND now()+interval '5 minutes'
   AND (SELECT count(*) FROM public.admin_product_correction_evidence_verdicts_v1 v
      WHERE v.evidence_id=e.evidence_id AND v.verdict='VERIFIED')=1;
 IF e_off.evidence_id IS NULL OR e_hw.evidence_id IS NULL OR
    e_off.evidence_id=e_hw.evidence_id
 THEN RAISE EXCEPTION 'R16I_D8D_V2_SELLER_EVIDENCE_MISSING'; END IF;
 -- Exact field-level approved null contract, never infer from checkout or listing.
 expected_fields:=jsonb_build_array(
  jsonb_build_object('field','products.size_ml','before',160,'after',80),
  jsonb_build_object('field','products.price_min','before',29900,'after',NULL),
  jsonb_build_object('field','products.price_max','before',29900,'after',NULL),
  jsonb_build_object('field','products.unit_price_per_10ml','before',1868.75,'after',NULL),
  jsonb_build_object('field','products.buy_link',
   'before','https://www.hwahae.co.kr/goods/45194','after',NULL)
 );
 IF pr.field_changes IS DISTINCT FROM expected_fields
 THEN RAISE EXCEPTION 'R16I_D8D_V2_NOT_POLICY_A_FIELD_SET'; END IF;
 SELECT * INTO d FROM public.admin_product_correction_decisions_v1
  WHERE proposal_id=pr.proposal_id AND decision='APPROVE_FOR_D8D_REVIEW' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'R16I_D8D_V2_REVIEW_DECISION_MISSING'; END IF;
 ev_json:=jsonb_build_array(
  jsonb_build_object('evidenceId',e_off.evidence_id,'sourceKey',e_off.source_key,
    'url',e_off.source_url,'selectedOption',e_off.selected_option,
    'checkoutPrice',e_off.checkout_price_krw,'capturedAt',e_off.captured_at),
  jsonb_build_object('evidenceId',e_hw.evidence_id,'sourceKey',e_hw.source_key,
    'url',e_hw.source_url,'selectedOption',e_hw.selected_option,
    'checkoutPrice',e_hw.checkout_price_krw,'capturedAt',e_hw.captured_at)
 );
 fingerprint:=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(ev_json::text,'UTF8')),'hex');
 SELECT enabled INTO gate_enabled FROM public.admin_r16i_d8d_v2_gate
  WHERE scope='R16I_S_NATURE_PRODUCT_1';
 IF gate_enabled IS NULL THEN RAISE EXCEPTION 'R16I_D8D_V2_GATE_MISSING'; END IF;
 SELECT * INTO a FROM public.admin_r16i_d8d_v2_owner_authorizations
  WHERE proposal_id=pr.proposal_id FOR UPDATE;
 before_json:=jsonb_build_object('size_ml',p.size_ml,'price_min',p.price_min,
   'price_max',p.price_max,'unit_price_per_10ml',p.unit_price_per_10ml,
   'buy_link',p.buy_link,'updated_at',p.updated_at);
 after_json:=jsonb_build_object('size_ml',80,'price_min',NULL,'price_max',NULL,
   'unit_price_per_10ml',NULL,'buy_link',NULL);
 IF p_mode='PREVIEW' THEN
  RETURN jsonb_build_object('status','PREVIEW_HOLD_NO_WRITE','productId',p.id,
    'before',before_json,'after',after_json,'offerCandidates',ev_json,
    'ownerAuthorizationValid',a.authorization_id IS NOT NULL AND a.revoked_at IS NULL
      AND a.expires_at>now() AND a.product_revision=pr.product_revision
      AND a.evidence_fingerprint=fingerprint AND a.price_policy='A_PRODUCT_PRICE_NULL_SELLER_OFFERS_ONLY'
      AND a.product_identity_attested AND a.review_population_attested
      AND a.source_binding_attested AND a.seller_option_scopes_attested,
    'releaseGateEnabled',gate_enabled,'productWrites',0,'offerWrites',0,
    'productionWriteAuthorized',false);
 END IF;
 IF gate_enabled IS DISTINCT FROM true THEN
  RAISE EXCEPTION 'R16I_D8D_V2_GATE_DISABLED'; END IF;
 IF a.authorization_id IS NULL OR a.product_id IS DISTINCT FROM p.id OR
    a.product_revision IS DISTINCT FROM pr.product_revision OR
    a.price_policy IS DISTINCT FROM 'A_PRODUCT_PRICE_NULL_SELLER_OFFERS_ONLY' OR
    a.evidence_fingerprint IS DISTINCT FROM fingerprint OR
    a.revoked_at IS NOT NULL OR a.expires_at<=now() OR
    NOT a.product_identity_attested OR NOT a.review_population_attested OR
    NOT a.source_binding_attested OR NOT a.seller_option_scopes_attested OR
    NOT EXISTS(SELECT 1 FROM public.admin_memberships m WHERE
      m.user_id=a.approved_by AND m.role='admin_owner' AND m.is_active=true)
 THEN RAISE EXCEPTION 'R16I_D8D_V2_OWNER_POLICY_AND_SCOPE_HOLD'; END IF;
 UPDATE public.products
  SET size_ml=80,price_min=NULL,price_max=NULL,unit_price_per_10ml=NULL,buy_link=NULL
  WHERE id=p.id AND updated_at=p.updated_at RETURNING * INTO inserted;
 IF NOT FOUND OR inserted.size_ml IS DISTINCT FROM 80 OR
    inserted.price_min IS NOT NULL OR inserted.price_max IS NOT NULL OR
    inserted.unit_price_per_10ml IS NOT NULL OR inserted.buy_link IS NOT NULL
 THEN RAISE EXCEPTION 'R16I_D8D_V2_PRODUCT_WRITE_MISMATCH'; END IF;
 INSERT INTO public.product_offers(
  product_id,seller_key,seller_name,source_name,listing_id,listing_url,
  price_amount,currency_code,market_code,availability_state,offer_state,
  product_scope_state,first_observed_at,last_observed_at,link_health_state
 ) VALUES (
  p.id,'snature','에스네이처 공식몰','official_single','151',
  'https://www.snature.kr/product/detail.html?product_no=151',
  e_off.checkout_price_krw,'KRW','KR','unknown','current',
  'product_subject_unresolved',e_off.captured_at,e_off.captured_at,'unchecked'
 ) RETURNING * INTO o1;
 INSERT INTO public.product_offers(
  product_id,seller_key,seller_name,source_name,listing_id,listing_url,
  price_amount,currency_code,market_code,availability_state,offer_state,
  product_scope_state,first_observed_at,last_observed_at,link_health_state
 ) VALUES (
  p.id,'hwahae','화해','hwahae_bundle','45194',
  'https://www.hwahae.co.kr/goods/45194',
  e_hw.checkout_price_krw,'KRW','KR','unknown','current',
  'product_subject_unresolved',e_hw.captured_at,e_hw.captured_at,'unchecked'
 ) RETURNING * INTO o2;
 IF o1.offer_id IS NULL OR o2.offer_id IS NULL OR o1.offer_id=o2.offer_id
   OR o1.price_amount IS DISTINCT FROM e_off.checkout_price_krw
   OR o2.price_amount IS DISTINCT FROM e_hw.checkout_price_krw
 THEN RAISE EXCEPTION 'R16I_D8D_V2_DUAL_OFFER_RECONCILIATION_FAILED'; END IF;
 after_json:=after_json||jsonb_build_object('updated_at',inserted.updated_at);
 INSERT INTO public.admin_r16i_d8d_v2_applications(
  proposal_id,decision_id,authorization_id,product_id,before_values,
  after_values,evidence_fingerprint,applied_by,apply_request_id
 ) VALUES(pr.proposal_id,d.decision_id,a.authorization_id,p.id,before_json,
  after_json,fingerprint,p_actor_id,p_request_id) RETURNING application_id INTO app_id;
 v_off:=jsonb_build_object('product_id',o1.product_id,'seller_key',o1.seller_key,
   'seller_name',o1.seller_name,'source_name',o1.source_name,
   'listing_id',o1.listing_id,'listing_url',o1.listing_url,
   'price_amount',o1.price_amount,'currency_code',o1.currency_code,
   'market_code',o1.market_code,'availability_state',o1.availability_state,
   'offer_state',o1.offer_state,'product_scope_state',o1.product_scope_state,
   'first_observed_at',o1.first_observed_at,'last_observed_at',o1.last_observed_at,
   'link_health_state',o1.link_health_state);
 v_hw:=jsonb_build_object('product_id',o2.product_id,'seller_key',o2.seller_key,
   'seller_name',o2.seller_name,'source_name',o2.source_name,
   'listing_id',o2.listing_id,'listing_url',o2.listing_url,
   'price_amount',o2.price_amount,'currency_code',o2.currency_code,
   'market_code',o2.market_code,'availability_state',o2.availability_state,
   'offer_state',o2.offer_state,'product_scope_state',o2.product_scope_state,
   'first_observed_at',o2.first_observed_at,'last_observed_at',o2.last_observed_at,
   'link_health_state',o2.link_health_state);
 INSERT INTO public.admin_r16i_d8d_v2_application_offers(
  application_id,ordinal,offer_id,seller_key,evidence_id,offer_values
 ) VALUES
  (app_id,1,o1.offer_id,'snature',e_off.evidence_id,v_off),
  (app_id,2,o2.offer_id,'hwahae',e_hw.evidence_id,v_hw);
 INSERT INTO public.admin_r16i_d8d_v2_events(
   application_id,event_type,event_by,request_id,before_values,after_values
 ) VALUES(app_id,'APPLIED',p_actor_id,p_request_id,before_json,after_json);
 RETURN jsonb_build_object('status','APPLIED','applicationId',app_id,
  'productWrites',1,'offerWrites',2,'offerIds',jsonb_build_array(o1.offer_id,o2.offer_id),
  'rankingWrites',0,'subjectWrites',0);
END;
$r16i_v2$;

-- SECURITY DEFINER is necessary for revoking INSERT/DELETE from service_role
-- while supporting rollback; no direct client has EXECUTE.
CREATE FUNCTION public.r16i_d8d_rollback_v2(
 p_application_id uuid,p_actor_id uuid,p_request_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $r16i_rb_v2$
DECLARE
 a public.admin_r16i_d8d_v2_applications%ROWTYPE;
 p public.products%ROWTYPE;
 o public.product_offers%ROWTYPE;
 r record;
 saved public.products%ROWTYPE;
 total integer:=0;
 current_json jsonb;
BEGIN
 IF p_application_id IS NULL OR p_actor_id IS NULL OR p_request_id IS NULL
 THEN RAISE EXCEPTION 'R16I_D8D_V2_ROLLBACK_BAD_REQUEST'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.admin_memberships WHERE
     user_id=p_actor_id AND role='admin_owner' AND is_active=true)
 THEN RAISE EXCEPTION 'R16I_D8D_V2_OWNER_REQUIRED'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(195721,16);
 SELECT * INTO a FROM public.admin_r16i_d8d_v2_applications
   WHERE application_id=p_application_id FOR UPDATE;
 IF NOT FOUND OR a.product_id<>'b639c8b4-6a61-440e-b4db-fac7381593ff'::uuid
 THEN RAISE EXCEPTION 'R16I_D8D_V2_ROLLBACK_NOT_AVAILABLE'; END IF;
 IF a.rolled_back_at IS NOT NULL THEN
  IF a.rollback_request_id=p_request_id AND a.rolled_back_by=p_actor_id
  THEN RETURN jsonb_build_object('status','ALREADY_ROLLED_BACK',
      'applicationId',a.application_id,'productWrites',0,'offerDeletes',0); END IF;
  RAISE EXCEPTION 'R16I_D8D_V2_ROLLBACK_REPLAY_CONFLICT';
 END IF;
 IF EXISTS(SELECT 1 FROM public.admin_r16i_d8d_v2_applications
  WHERE rollback_request_id=p_request_id OR apply_request_id=p_request_id)
 THEN RAISE EXCEPTION 'R16I_D8D_V2_ROLLBACK_REQUEST_CONFLICT'; END IF;
 SELECT * INTO p FROM public.products WHERE id=a.product_id FOR UPDATE;
 IF NOT FOUND OR p.updated_at IS DISTINCT FROM (a.after_values->>'updated_at')::timestamptz
  OR p.size_ml IS DISTINCT FROM 80 OR p.price_min IS NOT NULL OR
  p.price_max IS NOT NULL OR p.unit_price_per_10ml IS NOT NULL OR p.buy_link IS NOT NULL
 THEN RAISE EXCEPTION 'R16I_D8D_V2_ROLLBACK_PRODUCT_DRIFT'; END IF;
 IF (SELECT count(*) FROM public.admin_r16i_d8d_v2_application_offers
       WHERE application_id=a.application_id)<>2
   OR (SELECT count(DISTINCT seller_key) FROM public.admin_r16i_d8d_v2_application_offers
       WHERE application_id=a.application_id)<>2
 THEN RAISE EXCEPTION 'R16I_D8D_V2_ROLLBACK_LEDGER_INCOMPLETE'; END IF;
 -- Every created offer must still match the exact immutable offer ledger.
 FOR r IN SELECT * FROM public.admin_r16i_d8d_v2_application_offers
    WHERE application_id=a.application_id ORDER BY ordinal LOOP
  SELECT * INTO o FROM public.product_offers WHERE offer_id=r.offer_id FOR UPDATE;
  IF NOT FOUND OR o.product_id IS DISTINCT FROM a.product_id OR
     o.seller_key IS DISTINCT FROM r.seller_key
  THEN RAISE EXCEPTION 'R16I_D8D_V2_ROLLBACK_OFFER_MISSING'; END IF;
  current_json:=jsonb_build_object('product_id',o.product_id,'seller_key',o.seller_key,
   'seller_name',o.seller_name,'source_name',o.source_name,
   'listing_id',o.listing_id,'listing_url',o.listing_url,
   'price_amount',o.price_amount,'currency_code',o.currency_code,
   'market_code',o.market_code,'availability_state',o.availability_state,
   'offer_state',o.offer_state,'product_scope_state',o.product_scope_state,
   'first_observed_at',o.first_observed_at,'last_observed_at',o.last_observed_at,
   'link_health_state',o.link_health_state);
  IF current_json IS DISTINCT FROM r.offer_values
  THEN RAISE EXCEPTION 'R16I_D8D_V2_ROLLBACK_OFFER_DRIFT'; END IF;
  total:=total+1;
 END LOOP;
 IF total<>2 THEN RAISE EXCEPTION 'R16I_D8D_V2_ROLLBACK_LEDGER_INCOMPLETE'; END IF;
 -- Catch unrelated seller records added after apply, not only the two ledger IDs.
 IF (SELECT count(*) FROM public.product_offers WHERE product_id=a.product_id)<>2
 THEN RAISE EXCEPTION 'R16I_D8D_V2_ROLLBACK_UNTRACKED_OFFER'; END IF;
 FOR r IN SELECT offer_id FROM public.admin_r16i_d8d_v2_application_offers
      WHERE application_id=a.application_id ORDER BY ordinal DESC LOOP
  DELETE FROM public.product_offers WHERE offer_id=r.offer_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'R16I_D8D_V2_ROLLBACK_DELETE_FAILED'; END IF;
 END LOOP;
 UPDATE public.products SET size_ml=(a.before_values->>'size_ml')::numeric,
   price_min=(a.before_values->>'price_min')::integer,
   price_max=(a.before_values->>'price_max')::integer,
   unit_price_per_10ml=(a.before_values->>'unit_price_per_10ml')::numeric,
   buy_link=a.before_values->>'buy_link'
  WHERE id=a.product_id AND updated_at=p.updated_at RETURNING * INTO saved;
 IF NOT FOUND OR saved.size_ml IS DISTINCT FROM (a.before_values->>'size_ml')::numeric
 THEN RAISE EXCEPTION 'R16I_D8D_V2_ROLLBACK_RESTORE_FAILED'; END IF;
 UPDATE public.admin_r16i_d8d_v2_applications SET
   rolled_back_at=now(),rolled_back_by=p_actor_id,rollback_request_id=p_request_id
  WHERE application_id=a.application_id;
 INSERT INTO public.admin_r16i_d8d_v2_events(
   application_id,event_type,event_by,request_id,before_values,after_values
 ) VALUES(a.application_id,'ROLLED_BACK',p_actor_id,p_request_id,a.after_values,
   jsonb_build_object('size_ml',saved.size_ml,'price_min',saved.price_min,
     'price_max',saved.price_max,'unit_price_per_10ml',saved.unit_price_per_10ml,
     'buy_link',saved.buy_link,'updated_at',saved.updated_at));
 RETURN jsonb_build_object('status','ROLLED_BACK','applicationId',a.application_id,
   'productWrites',1,'offerDeletes',2,'rankingWrites',0,'subjectWrites',0);
END;
$r16i_rb_v2$;

REVOKE ALL ON FUNCTION public.r16i_d8d_apply_v2(uuid,uuid,uuid,text),
 public.r16i_d8d_rollback_v2(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.r16i_d8d_apply_v2(uuid,uuid,uuid,text),
 public.r16i_d8d_rollback_v2(uuid,uuid,uuid) TO service_role;
