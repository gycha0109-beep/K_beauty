-- R16I-R4-D8D: narrow transactional correction with rollback.
-- Initially disabled in every environment. Enabling requires independent operational approval.
-- This migration NEVER changes products, offers, source bindings or recommendations.
CREATE TABLE public.admin_r16i_correction_release_gate_v1 (
  scope text PRIMARY KEY CHECK(scope='R16I_S_NATURE_PRODUCT_1'),
  enabled boolean NOT NULL DEFAULT false,
  changed_at timestamptz NOT NULL DEFAULT now(),
  change_ticket text,
  CHECK(NOT enabled OR char_length(btrim(coalesce(change_ticket,'')))>=12)
);
INSERT INTO public.admin_r16i_correction_release_gate_v1(scope,enabled,change_ticket)
VALUES('R16I_S_NATURE_PRODUCT_1',false,null);
ALTER TABLE public.admin_r16i_correction_release_gate_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_r16i_correction_release_gate_v1 FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.admin_r16i_correction_release_gate_v1 TO service_role;

CREATE TABLE public.admin_r16i_correction_applications_v1 (
  application_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL UNIQUE REFERENCES public.admin_product_correction_proposals_v1(proposal_id) ON DELETE RESTRICT,
  decision_id uuid NOT NULL REFERENCES public.admin_product_correction_decisions_v1(decision_id) ON DELETE RESTRICT,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  -- Keep historical offer identifier even when a verified rollback deletes the offer.
  offer_id uuid NOT NULL UNIQUE,
  before_values jsonb NOT NULL,
  after_values jsonb NOT NULL,
  offer_values jsonb NOT NULL,
  applied_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  apply_request_id uuid NOT NULL UNIQUE,
  applied_at timestamptz NOT NULL DEFAULT now(),
  rolled_back_at timestamptz,
  rolled_back_by uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  rollback_request_id uuid UNIQUE,
  CHECK((rolled_back_at IS NULL AND rolled_back_by IS NULL AND rollback_request_id IS NULL)
     OR (rolled_back_at IS NOT NULL AND rolled_back_by IS NOT NULL AND rollback_request_id IS NOT NULL))
);
CREATE UNIQUE INDEX admin_r16i_correction_active_product_idx
 ON public.admin_r16i_correction_applications_v1(product_id)
 WHERE rolled_back_at IS NULL;

CREATE TABLE public.admin_r16i_correction_application_events_v1 (
  event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.admin_r16i_correction_applications_v1(application_id) ON DELETE RESTRICT,
  event_type text NOT NULL CHECK(event_type IN ('APPLIED','ROLLED_BACK')),
  event_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  request_id uuid NOT NULL UNIQUE,
  before_values jsonb NOT NULL,
  after_values jsonb NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_r16i_correction_events_app_idx
 ON public.admin_r16i_correction_application_events_v1(application_id,occurred_at DESC);

ALTER TABLE public.admin_r16i_correction_applications_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_r16i_correction_application_events_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_r16i_correction_applications_v1,
 public.admin_r16i_correction_application_events_v1 FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.admin_r16i_correction_applications_v1 TO service_role;
GRANT SELECT,INSERT ON public.admin_r16i_correction_application_events_v1 TO service_role;
-- D8C previously granted decisions SELECT only; its SECURITY INVOKER RPC needs INSERT.
GRANT INSERT ON public.admin_product_correction_decisions_v1 TO service_role;

-- Everything uses SECURITY INVOKER and is callable only by the trusted service role.
-- Caller must separately authenticate the real web session and owner role.
CREATE FUNCTION public.r16i_d8d_apply_v1(
  p_proposal_id uuid, p_actor_id uuid, p_request_id uuid, p_mode text DEFAULT 'PREVIEW'
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $$
DECLARE
  proposal public.admin_product_correction_proposals_v1%ROWTYPE;
  decision public.admin_product_correction_decisions_v1%ROWTYPE;
  product public.products%ROWTYPE;
  official public.admin_product_correction_evidence_v1%ROWTYPE;
  seller public.admin_product_correction_evidence_v1%ROWTYPE;
  changes jsonb;
  element jsonb;
  change_key text;
  seen text[]:=ARRAY[]::text[];
  intended_size numeric;
  intended_min integer;
  intended_max integer;
  intended_unit numeric;
  intended_link text;
  gate_enabled boolean;
  before_snapshot jsonb;
  after_snapshot jsonb;
  offer_snapshot jsonb;
  saved_offer_id uuid;
  saved_application_id uuid;
  saved_product public.products%ROWTYPE;
  created_offer public.product_offers%ROWTYPE;
BEGIN
  IF p_proposal_id IS NULL OR p_actor_id IS NULL OR p_request_id IS NULL
     OR p_mode IS NULL OR p_mode NOT IN ('PREVIEW','APPLY') THEN RAISE EXCEPTION 'R16I_D8D_INVALID_REQUEST'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.admin_memberships
      WHERE user_id=p_actor_id AND role='admin_owner' AND is_active=true)
     THEN RAISE EXCEPTION 'R16I_D8D_OWNER_REQUIRED'; END IF;

  -- Serialize every correction attempt for this product and cross-check exact original state.
  SELECT * INTO proposal FROM public.admin_product_correction_proposals_v1
    WHERE proposal_id=p_proposal_id FOR UPDATE;
  IF NOT FOUND OR proposal.product_id <> 'b639c8b4-6a61-440e-b4db-fac7381593ff'::uuid
     OR proposal.strategy <> 'A_PRODUCT_ANCHOR_REUSE_AND_OFFER_SEPARATION'
  THEN RAISE EXCEPTION 'R16I_D8D_PROPOSAL_INVALID'; END IF;
  SELECT d.* INTO decision FROM public.admin_product_correction_decisions_v1 AS d
    WHERE d.proposal_id=p_proposal_id AND d.decision='APPROVE_FOR_D8D_REVIEW';
  IF NOT FOUND THEN RAISE EXCEPTION 'R16I_D8D_APPROVAL_MISSING'; END IF;
  IF EXISTS(SELECT 1 FROM public.admin_r16i_correction_applications_v1
     WHERE proposal_id=p_proposal_id OR (product_id=proposal.product_id AND rolled_back_at IS NULL))
     THEN RAISE EXCEPTION 'R16I_D8D_ALREADY_APPLIED'; END IF;
  SELECT * INTO product FROM public.products
    WHERE id=proposal.product_id FOR UPDATE;
  IF NOT FOUND OR product.updated_at IS DISTINCT FROM proposal.product_revision OR
     product.name IS DISTINCT FROM '아쿠아 스쿠알란 수분크림' OR
     product.brand IS DISTINCT FROM '에스네이처' OR
     product.category::text IS DISTINCT FROM 'moisturizer_cream' OR
     product.size_ml IS DISTINCT FROM 160 OR
     product.price_min IS DISTINCT FROM 29900 OR product.price_max IS DISTINCT FROM 29900 OR
     product.unit_price_per_10ml IS DISTINCT FROM 1868.75 OR
     product.buy_link IS DISTINCT FROM 'https://www.hwahae.co.kr/goods/45194' OR
     product.hwahae_url IS DISTINCT FROM 'https://www.hwahae.co.kr/goods/45194' OR
     product.source_url IS DISTINCT FROM 'https://www.hwahae.co.kr/goods/45194' OR
     product.external_source IS DISTINCT FROM 'hwahae' OR
     product.external_type IS DISTINCT FROM 'goods' OR product.external_id IS DISTINCT FROM '45194' OR
     product.market_signals->>'review_count' IS DISTINCT FROM '41475' OR
     product.market_signals->>'rating' IS DISTINCT FROM '4.58'
  THEN RAISE EXCEPTION 'R16I_D8D_PRESTATE_DRIFT'; END IF;
  IF EXISTS(SELECT 1 FROM public.product_offers o
       WHERE o.product_id=product.id OR (o.seller_key='hwahae' AND (o.listing_id='45194'
          OR o.listing_url='https://www.hwahae.co.kr/goods/45194')))
    OR EXISTS(SELECT 1 FROM public.product_fact_subjects f WHERE f.product_id=product.id)
    OR (SELECT count(*) FROM public.product_source_bindings b
        WHERE b.product_id=product.id AND b.source_name='hwahae'
          AND b.external_type='goods' AND b.external_id='45194'
          AND b.source_url='https://www.hwahae.co.kr/goods/45194'
          AND b.binding_state='resolved'
          AND b.product_scope_state='product_subject_unresolved')<>1
    OR (SELECT count(*) FROM public.product_source_bindings b WHERE b.product_id=product.id)<>1
    OR (SELECT count(*) FROM public.catalog_trust_intake i WHERE i.product_id=product.id
        AND i.identity_state='SUBJECT_CREATION_REQUIRED'
        AND i.trust_state='REVIEW_REQUIRED' AND i.subject_id IS NULL)<>1
    OR (SELECT count(*) FROM public.catalog_trust_intake i WHERE i.product_id=product.id)<>1
  THEN RAISE EXCEPTION 'R16I_D8D_BINDING_OR_OFFER_COLLISION'; END IF;

  IF cardinality(proposal.evidence_ids) <> 2 OR
    (SELECT count(DISTINCT x.id) FROM unnest(proposal.evidence_ids) AS x(id))<>2
  THEN RAISE EXCEPTION 'R16I_D8D_TWO_DISTINCT_SOURCES_REQUIRED'; END IF;
  -- Source evidence must be human-approved, specific option, price, fresh screenshot.
  SELECT e.* INTO official
    FROM public.admin_product_correction_evidence_v1 e
    JOIN public.admin_product_correction_evidence_verdicts_v1 v
      ON v.evidence_id=e.evidence_id AND v.verdict='VERIFIED'
    WHERE e.evidence_id=ANY(proposal.evidence_ids)
      AND e.product_id=product.id AND e.source_key='official_single'
      AND e.source_url='https://www.snature.kr/product/detail.html?product_no=151'
      AND e.checkout_price_krw>0 AND char_length(btrim(e.selected_option))>=3
      AND e.captured_at BETWEEN now()-interval '30 days' AND now()+interval '5 minutes';
  SELECT e.* INTO seller
    FROM public.admin_product_correction_evidence_v1 e
    JOIN public.admin_product_correction_evidence_verdicts_v1 v
      ON v.evidence_id=e.evidence_id AND v.verdict='VERIFIED'
    WHERE e.evidence_id=ANY(proposal.evidence_ids)
      AND e.product_id=product.id AND e.source_key='hwahae_bundle'
      AND e.source_url='https://www.hwahae.co.kr/goods/45194'
      AND e.checkout_price_krw>0 AND char_length(btrim(e.selected_option))>=3
      AND e.captured_at BETWEEN now()-interval '30 days' AND now()+interval '5 minutes';
  IF official.evidence_id IS NULL OR seller.evidence_id IS NULL
    THEN RAISE EXCEPTION 'R16I_D8D_CHECKOUT_EVIDENCE_MISSING'; END IF;

  changes:=proposal.field_changes;
  IF jsonb_typeof(changes)<>'array' OR jsonb_array_length(changes)<2 OR jsonb_array_length(changes)>5
    THEN RAISE EXCEPTION 'R16I_D8D_INVALID_CHANGESET'; END IF;
  intended_size:=product.size_ml;intended_min:=product.price_min;
  intended_max:=product.price_max;intended_unit:=product.unit_price_per_10ml;
  intended_link:=product.buy_link;
  FOR element IN SELECT value FROM jsonb_array_elements(changes) LOOP
    IF jsonb_typeof(element)<>'object' OR
       (SELECT count(*) FROM jsonb_object_keys(element))<>3 OR
       NOT(element ? 'field' AND element ? 'before' AND element ? 'after')
      THEN RAISE EXCEPTION 'R16I_D8D_INVALID_FIELD_OBJECT'; END IF;
    change_key:=element->>'field';
    IF change_key NOT IN ('products.size_ml','products.price_min','products.price_max',
       'products.unit_price_per_10ml','products.buy_link') OR change_key=ANY(seen)
      THEN RAISE EXCEPTION 'R16I_D8D_FIELD_NOT_ALLOWED'; END IF;
    seen:=array_append(seen,change_key);
    IF (change_key='products.size_ml' AND element->'before' <> to_jsonb(product.size_ml)) OR
       (change_key='products.price_min' AND element->'before' <> to_jsonb(product.price_min)) OR
       (change_key='products.price_max' AND element->'before' <> to_jsonb(product.price_max)) OR
       (change_key='products.unit_price_per_10ml' AND element->'before' <> to_jsonb(product.unit_price_per_10ml)) OR
       (change_key='products.buy_link' AND element->'before' <> to_jsonb(product.buy_link))
      THEN RAISE EXCEPTION 'R16I_D8D_BEFORE_VALUE_DRIFT'; END IF;
    IF change_key='products.buy_link' THEN
      IF jsonb_typeof(element->'after')<>'string' OR
         element->>'after'<>'https://www.snature.kr/product/detail.html?product_no=151'
       THEN RAISE EXCEPTION 'R16I_D8D_INVALID_BUY_LINK'; END IF;
      intended_link:=element->>'after';
    ELSE
      IF jsonb_typeof(element->'after')<>'number' OR
         length(element->>'after')>12 OR (element->>'after')::numeric<=0
         OR (element->>'after')::numeric>100000000
      THEN RAISE EXCEPTION 'R16I_D8D_NUMERIC_VALUE_INVALID'; END IF;
      CASE change_key
        WHEN 'products.size_ml' THEN intended_size:=(element->>'after')::numeric;
        WHEN 'products.price_min' THEN intended_min:=(element->>'after')::integer;
        WHEN 'products.price_max' THEN intended_max:=(element->>'after')::integer;
        WHEN 'products.unit_price_per_10ml' THEN intended_unit:=(element->>'after')::numeric;
      END CASE;
    END IF;
  END LOOP;
  IF intended_size<>80 OR
     intended_link<>'https://www.snature.kr/product/detail.html?product_no=151' OR
     intended_min<>official.checkout_price_krw OR intended_max<>official.checkout_price_krw OR
     intended_unit<>round(official.checkout_price_krw::numeric*10/80,2) OR
     intended_min<>intended_max OR
     NOT('products.size_ml'=ANY(seen) AND 'products.buy_link'=ANY(seen))
  THEN RAISE EXCEPTION 'R16I_D8D_PRODUCT_PRICE_UNIT_INCOHERENT'; END IF;
  before_snapshot:=jsonb_build_object(
    'size_ml',product.size_ml,'price_min',product.price_min,
    'price_max',product.price_max,'unit_price_per_10ml',product.unit_price_per_10ml,
    'buy_link',product.buy_link,'updated_at',product.updated_at);
  after_snapshot:=jsonb_build_object(
    'size_ml',intended_size,'price_min',intended_min,
    'price_max',intended_max,'unit_price_per_10ml',intended_unit,
    'buy_link',intended_link);
  offer_snapshot:=jsonb_build_object(
    'seller_key','hwahae','listing_id','45194',
    'listing_url','https://www.hwahae.co.kr/goods/45194',
    'price_amount',seller.checkout_price_krw,
    'product_scope_state','product_subject_unresolved',
    'offer_state','current','availability_state','unknown');

  SELECT enabled INTO gate_enabled FROM public.admin_r16i_correction_release_gate_v1
    WHERE scope='R16I_S_NATURE_PRODUCT_1';
  IF gate_enabled IS NULL THEN RAISE EXCEPTION 'R16I_D8D_RELEASE_GATE_MISSING'; END IF;
  IF p_mode='PREVIEW' THEN
    RETURN jsonb_build_object(
      'status','PREVIEW_VERIFIED_NO_WRITE','productId',product.id,
      'proposalId',proposal.proposal_id,'before',before_snapshot,
      'after',after_snapshot,'plannedOffer',offer_snapshot,
      'releaseGateEnabled',gate_enabled,
      'productionWriteAuthorized',false,'productWrites',0,'offerWrites',0);
  END IF;
  IF gate_enabled IS DISTINCT FROM true
    THEN RAISE EXCEPTION 'R16I_D8D_RELEASE_GATE_DISABLED'; END IF;
  -- One transaction. Any INSERT/UPDATE/trigger or FK error reverts every write.
  UPDATE public.products SET
    size_ml=intended_size, price_min=intended_min, price_max=intended_max,
    unit_price_per_10ml=intended_unit, buy_link=intended_link
   WHERE id=product.id AND updated_at=product.updated_at
   RETURNING * INTO saved_product;
  IF NOT FOUND THEN RAISE EXCEPTION 'R16I_D8D_PRODUCT_OPTIMISTIC_CONFLICT'; END IF;
  INSERT INTO public.product_offers(
    product_id,seller_key,seller_name,source_name,listing_id,listing_url,
    price_amount,currency_code,availability_state,offer_state,product_scope_state,
    first_observed_at,last_observed_at,link_health_state
  ) VALUES(product.id,'hwahae','화해','hwahae','45194',
    'https://www.hwahae.co.kr/goods/45194',seller.checkout_price_krw,
    'KRW','unknown','current','product_subject_unresolved',
    seller.captured_at,seller.captured_at,'unchecked') RETURNING * INTO created_offer;
  IF created_offer.offer_id IS NULL OR saved_product.size_ml<>80 OR
     saved_product.price_min<>official.checkout_price_krw OR
     saved_product.price_max<>official.checkout_price_krw OR
     created_offer.price_amount<>seller.checkout_price_krw
    THEN RAISE EXCEPTION 'R16I_D8D_POSTWRITE_RECONCILIATION_FAILED'; END IF;
  after_snapshot:=after_snapshot||jsonb_build_object('updated_at',saved_product.updated_at);
  offer_snapshot:=offer_snapshot||jsonb_build_object('offer_id',created_offer.offer_id);
  INSERT INTO public.admin_r16i_correction_applications_v1(
    proposal_id,decision_id,product_id,offer_id,before_values,after_values,
    offer_values,applied_by,apply_request_id
  ) VALUES(proposal.proposal_id,decision.decision_id,product.id,created_offer.offer_id,
    before_snapshot,after_snapshot,offer_snapshot,p_actor_id,p_request_id)
  RETURNING application_id INTO saved_application_id;
  INSERT INTO public.admin_r16i_correction_application_events_v1(
    application_id,event_type,event_by,request_id,before_values,after_values
  ) VALUES(saved_application_id,'APPLIED',p_actor_id,p_request_id,before_snapshot,after_snapshot);
  RETURN jsonb_build_object('status','APPLIED','applicationId',saved_application_id,
    'productId',product.id,'before',before_snapshot,'after',after_snapshot,
    'offer',offer_snapshot,'productWrites',1,'offerWrites',1,
    'rankingWrites',0,'subjectWrites',0);
END;
$$;

CREATE FUNCTION public.r16i_d8d_rollback_v1(
  p_application_id uuid, p_actor_id uuid, p_request_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $$
DECLARE
  a public.admin_r16i_correction_applications_v1%ROWTYPE;
  p public.products%ROWTYPE;
  o public.product_offers%ROWTYPE;
  restored public.products%ROWTYPE;
BEGIN
  IF p_application_id IS NULL OR p_actor_id IS NULL OR p_request_id IS NULL
    THEN RAISE EXCEPTION 'R16I_D8D_ROLLBACK_INVALID_REQUEST'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.admin_memberships
     WHERE user_id=p_actor_id AND role='admin_owner' AND is_active=true)
    THEN RAISE EXCEPTION 'R16I_D8D_OWNER_REQUIRED'; END IF;
  SELECT * INTO a FROM public.admin_r16i_correction_applications_v1
   WHERE application_id=p_application_id FOR UPDATE;
  IF NOT FOUND OR a.rolled_back_at IS NOT NULL OR
    a.product_id <> 'b639c8b4-6a61-440e-b4db-fac7381593ff'::uuid
    THEN RAISE EXCEPTION 'R16I_D8D_ROLLBACK_NOT_AVAILABLE'; END IF;
  SELECT * INTO p FROM public.products WHERE id=a.product_id FOR UPDATE;
  SELECT * INTO o FROM public.product_offers WHERE offer_id=a.offer_id FOR UPDATE;
  IF NOT FOUND OR p.id IS NULL OR o.offer_id IS NULL OR
    p.updated_at IS DISTINCT FROM (a.after_values->>'updated_at')::timestamptz OR
    p.size_ml IS DISTINCT FROM (a.after_values->>'size_ml')::numeric OR
    p.price_min IS DISTINCT FROM (a.after_values->>'price_min')::integer OR
    p.price_max IS DISTINCT FROM (a.after_values->>'price_max')::integer OR
    p.unit_price_per_10ml IS DISTINCT FROM (a.after_values->>'unit_price_per_10ml')::numeric OR
    p.buy_link IS DISTINCT FROM a.after_values->>'buy_link' OR
    o.product_id IS DISTINCT FROM a.product_id OR
    o.price_amount IS DISTINCT FROM (a.offer_values->>'price_amount')::numeric OR
    o.seller_key<>'hwahae' OR o.listing_id<>'45194' OR
    o.listing_url<>'https://www.hwahae.co.kr/goods/45194'
    THEN RAISE EXCEPTION 'R16I_D8D_ROLLBACK_DRIFT'; END IF;
  DELETE FROM public.product_offers WHERE offer_id=a.offer_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'R16I_D8D_ROLLBACK_OFFER_MISSING'; END IF;
  UPDATE public.products SET
    size_ml=(a.before_values->>'size_ml')::numeric,
    price_min=(a.before_values->>'price_min')::integer,
    price_max=(a.before_values->>'price_max')::integer,
    unit_price_per_10ml=(a.before_values->>'unit_price_per_10ml')::numeric,
    buy_link=a.before_values->>'buy_link'
   WHERE id=a.product_id AND updated_at=p.updated_at
   RETURNING * INTO restored;
  IF NOT FOUND OR restored.size_ml IS DISTINCT FROM (a.before_values->>'size_ml')::numeric
    THEN RAISE EXCEPTION 'R16I_D8D_ROLLBACK_PRODUCT_FAILED'; END IF;
  UPDATE public.admin_r16i_correction_applications_v1 SET
    rolled_back_at=now(),rolled_back_by=p_actor_id,rollback_request_id=p_request_id
   WHERE application_id=a.application_id;
  INSERT INTO public.admin_r16i_correction_application_events_v1(
    application_id,event_type,event_by,request_id,before_values,after_values
  ) VALUES(a.application_id,'ROLLED_BACK',p_actor_id,p_request_id,
    a.after_values,jsonb_build_object('size_ml',restored.size_ml,'price_min',restored.price_min,
    'price_max',restored.price_max,'unit_price_per_10ml',restored.unit_price_per_10ml,
    'buy_link',restored.buy_link,'updated_at',restored.updated_at));
  RETURN jsonb_build_object('status','ROLLED_BACK','applicationId',a.application_id,
    'productId',a.product_id,'restoredRevision',restored.updated_at,
    'productWrites',1,'offerDeletes',1,'rankingWrites',0,'subjectWrites',0);
END;
$$;
ALTER TABLE public.admin_r16i_correction_release_gate_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON FUNCTION public.r16i_d8d_apply_v1(uuid,uuid,uuid,text),
 public.r16i_d8d_rollback_v1(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.r16i_d8d_apply_v1(uuid,uuid,uuid,text),
 public.r16i_d8d_rollback_v1(uuid,uuid,uuid) TO service_role;
