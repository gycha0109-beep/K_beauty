create or replace function public.admin_enqueue_product_candidate_structural_review_v1(
  p_actor_user_id uuid, p_candidate_id uuid, p_request_id text, p_reason text, p_identity_evidence jsonb
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $function$
declare
  v_role text; v_request_id text := btrim(coalesce(p_request_id,'')); v_reason text := btrim(coalesce(p_reason,''));
  v_payload jsonb; v_match record; v_candidate record; v_review public.candidate_promotion_reviews%rowtype;
  v_review_id uuid; v_audit_id uuid; v_action text; v_before jsonb; v_snapshot jsonb; v_base jsonb; v_entry jsonb;
begin
  v_role := public.admin_require_product_review_actor(p_actor_user_id,'admin.products.review');
  if p_candidate_id is null then raise exception 'manual_catalog_review_candidate_required' using errcode='22004'; end if;
  if char_length(v_request_id) not between 8 and 120 then raise exception 'manual_catalog_review_request_id_invalid' using errcode='22023'; end if;
  if char_length(v_reason) not between 12 and 1000 then raise exception 'manual_catalog_review_reason_invalid' using errcode='22023'; end if;
  if p_identity_evidence is null or jsonb_typeof(p_identity_evidence)<>'object' or p_identity_evidence='{}'::jsonb
     or octet_length(p_identity_evidence::text)>16384
     or p_identity_evidence->>'contract_version'<>'manual-catalog-identity-evidence-v1'
     or jsonb_typeof(p_identity_evidence->'providers')<>'array' or jsonb_array_length(p_identity_evidence->'providers')<2
     or jsonb_typeof(p_identity_evidence->'convergence_dimensions')<>'array' or jsonb_array_length(p_identity_evidence->'convergence_dimensions')<1
     or jsonb_typeof(p_identity_evidence->'authority_boundary')<>'object'
     or p_identity_evidence#>>'{authority_boundary,product_write_allowed}'<>'false'
     or p_identity_evidence#>>'{authority_boundary,candidate_identity_resolution_write_allowed}'<>'false'
     or p_identity_evidence#>>'{authority_boundary,product_source_binding_write_allowed}'<>'false'
     or p_identity_evidence#>>'{authority_boundary,offer_materialization_allowed}'<>'false'
     or p_identity_evidence#>>'{authority_boundary,recommendation_authority}'<>'false'
     or (select count(distinct nullif(btrim(x.value->>'provider'),'')) from jsonb_array_elements(p_identity_evidence->'providers') x(value) where jsonb_typeof(x.value)='object')<2
     or exists(select 1 from jsonb_array_elements(p_identity_evidence->'providers') x(value) where jsonb_typeof(x.value)<>'object' or nullif(btrim(x.value->>'provider'),'') is null)
  then raise exception 'manual_catalog_review_identity_evidence_invalid' using errcode='22023'; end if;
  if exists(
    with recursive n(v) as (
      select p_identity_evidence union all
      select c.v from n cross join lateral(
        select e.value v from jsonb_each(case when jsonb_typeof(n.v)='object' then n.v else '{}'::jsonb end)e
        union all select a.value from jsonb_array_elements(case when jsonb_typeof(n.v)='array' then n.v else '[]'::jsonb end)a
      )c
    ) select 1 from n where v='null'::jsonb
  ) then raise exception 'manual_catalog_review_identity_evidence_null_forbidden' using errcode='22023'; end if;
  if exists(
    with recursive n(v) as (
      select p_identity_evidence union all
      select c.v from n cross join lateral(
        select e.value v from jsonb_each(case when jsonb_typeof(n.v)='object' then n.v else '{}'::jsonb end)e
        union all select a.value from jsonb_array_elements(case when jsonb_typeof(n.v)='array' then n.v else '[]'::jsonb end)a
      )c
    ) select 1 from n cross join lateral jsonb_object_keys(case when jsonb_typeof(n.v)='object' then n.v else '{}'::jsonb end)k(key)
      where k.key=any(array['score_total','slot_status','recommendation_eligible','data_status','evidence_status','ingredients_status','price_fit_status','routine_fit_status','sensitivity_fit_status','explanation','evidence_summary','reason','reasons'])
  ) then raise exception 'manual_catalog_review_identity_evidence_semantic_authority_forbidden' using errcode='22023'; end if;

  v_payload:=jsonb_build_object('actor_user_id',p_actor_user_id,'candidate_id',p_candidate_id,'reason',v_reason,'identity_evidence',p_identity_evidence);
  perform pg_advisory_xact_lock(hashtextextended('manual-catalog-review-request:'||v_request_id,0));
  select r.id review_id,r.candidate_id,r.status,r.rule_version,q.value request_entry into v_match
  from public.candidate_promotion_reviews r
  cross join lateral jsonb_array_elements(case when jsonb_typeof(r.evidence_snapshot->'manual_intake_requests')='array' then r.evidence_snapshot->'manual_intake_requests' else '[]'::jsonb end)q(value)
  where q.value->>'request_id'=v_request_id limit 1;
  if found then
    if v_match.candidate_id<>p_candidate_id or v_match.request_entry->'payload'<>v_payload then raise exception 'manual_catalog_review_request_conflict' using errcode='23505'; end if;
    return jsonb_build_object('status',v_match.status,'candidate_id',p_candidate_id,'review_id',v_match.review_id,'actor_role',v_role,'rule_version',v_match.rule_version,'request_id',v_request_id,'action','replay','idempotent',true,'audit_written',false,'products_written',0,'candidate_identity_writes',0,'product_source_bindings_written',0,'offers_written',0,'product_facts_written',0,'recommendation_semantic_writes',0);
  end if;

  select c.id,c.source_name,c.external_type,c.external_id,c.source_url,c.category_path,c.product_name_raw,c.brand_name_raw,c.review_status::text review_status,
         c.identity_resolution_state,c.canonical_name,c.canonical_brand,c.service_category,c.product_form,c.matched_product_id,c.duplicate_of_product_id
  into v_candidate from public.product_candidates c where c.id=p_candidate_id for update;
  if not found then raise exception 'manual_catalog_review_candidate_not_found' using errcode='P0002'; end if;
  if v_candidate.review_status<>'new' or v_candidate.identity_resolution_state<>'unresolved' or v_candidate.canonical_name is not null or v_candidate.canonical_brand is not null
     or v_candidate.service_category is not null or v_candidate.product_form is not null or v_candidate.matched_product_id is not null or v_candidate.duplicate_of_product_id is not null
  then raise exception 'manual_catalog_review_candidate_state_not_intake_eligible' using errcode='23514'; end if;
  if nullif(btrim(coalesce(v_candidate.source_name,'')),'') is null or nullif(btrim(coalesce(v_candidate.external_type,'')),'') is null
     or nullif(btrim(coalesce(v_candidate.external_id,'')),'') is null or nullif(btrim(coalesce(v_candidate.source_url,'')),'') is null
     or nullif(btrim(coalesce(v_candidate.category_path,'')),'') is null or nullif(btrim(coalesce(v_candidate.product_name_raw,'')),'') is null or nullif(btrim(coalesce(v_candidate.brand_name_raw,'')),'') is null
  then raise exception 'manual_catalog_review_candidate_provenance_incomplete' using errcode='23514'; end if;

  select * into v_review from public.candidate_promotion_reviews where candidate_id=p_candidate_id for update;
  v_entry:=jsonb_build_object('request_id',v_request_id,'payload',v_payload,'admitted_at',now());
  v_base:=jsonb_build_object(
    'intake_contract','manual-catalog-review-intake-v1','queue_policy','manual_catalog_admission','manual_queue_eligible',true,'ranking_queue_authority',false,'manual_review_required',true,
    'candidate_provenance',jsonb_build_object('candidate_id',v_candidate.id,'source_name',v_candidate.source_name,'external_type',v_candidate.external_type,'external_id',v_candidate.external_id,'source_url',v_candidate.source_url,'category_path',v_candidate.category_path,'product_name_raw',v_candidate.product_name_raw,'brand_name_raw',v_candidate.brand_name_raw),
    'identity_evidence',p_identity_evidence,
    'authority_boundary',jsonb_build_object('product_write_allowed',false,'candidate_identity_resolution_write_allowed',false,'product_source_binding_write_allowed',false,'offer_materialization_allowed',false,'product_fact_write_allowed',false,'recommendation_semantic_write_allowed',false)
  );
  if found then
    if v_review.status in('approved','rejected') then raise exception 'manual_catalog_review_terminal_review_protected' using errcode='23514'; end if;
    if v_review.status in('queued','reviewing') then raise exception 'manual_catalog_review_actionable_review_exists' using errcode='23505'; end if;
    if v_review.status<>'deferred' or v_review.approved_product_id is not null then raise exception 'manual_catalog_review_existing_review_not_requeueable' using errcode='23514'; end if;
    v_before:=jsonb_build_object('status',v_review.status,'rule_version',v_review.rule_version,'priority_score',v_review.priority_score,'selection_reason',v_review.selection_reason);
    v_snapshot:=coalesce(v_review.evidence_snapshot,'{}'::jsonb)||v_base||jsonb_build_object(
      'prior_queue_state',jsonb_build_object('status',v_review.status,'rule_version',v_review.rule_version,'priority_score',v_review.priority_score,'selection_reason',v_review.selection_reason,'reviewed_at',v_review.reviewed_at,'review_note',v_review.review_note),
      'manual_intake_requests',(case when jsonb_typeof(v_review.evidence_snapshot->'manual_intake_requests')='array' then v_review.evidence_snapshot->'manual_intake_requests' else '[]'::jsonb end)||jsonb_build_array(v_entry)
    );
    update public.candidate_promotion_reviews set status='queued',priority_score=0,selection_reason='manual catalog admission: '||v_reason,evidence_snapshot=v_snapshot,
      rule_version='manual-catalog-identity-review-v1',last_queued_at=now(),reviewed_at=null,review_note=null,approved_product_id=null,updated_at=now()
    where id=v_review.id returning id into v_review_id;
    v_action:='requeued';
  else
    v_snapshot:=v_base||jsonb_build_object('manual_intake_requests',jsonb_build_array(v_entry));
    insert into public.candidate_promotion_reviews(candidate_id,status,priority_score,selection_reason,evidence_snapshot,rule_version,first_queued_at,last_queued_at)
    values(p_candidate_id,'queued',0,'manual catalog admission: '||v_reason,v_snapshot,'manual-catalog-identity-review-v1',now(),now()) returning id into v_review_id;
    v_before:=null; v_action:='inserted';
  end if;

  v_audit_id:=public.record_admin_audit_event(p_actor_user_id,'admin.products.review',case when v_action='inserted' then 'admin.product_candidate.manual_catalog_review_queued' else 'admin.product_candidate.manual_catalog_review_requeued' end,
    'product_candidate',p_candidate_id::text,v_before,jsonb_build_object('status','queued','rule_version','manual-catalog-identity-review-v1','priority_score',0,'manual_queue_eligible',true,'ranking_queue_authority',false),
    v_reason,v_request_id,jsonb_build_object('contract_version','manual-catalog-review-intake-v1','rule_version','manual-catalog-identity-review-v1','queue_policy','manual_catalog_admission'));
  return jsonb_build_object('status','queued','candidate_id',p_candidate_id,'review_id',v_review_id,'audit_id',v_audit_id,'actor_role',v_role,'rule_version','manual-catalog-identity-review-v1','request_id',v_request_id,'action',v_action,'idempotent',false,'audit_written',true,'manual_review_required',true,'products_written',0,'candidate_identity_writes',0,'product_source_bindings_written',0,'offers_written',0,'product_facts_written',0,'recommendation_semantic_writes',0);
end;
$function$;

revoke all on function public.admin_enqueue_product_candidate_structural_review_v1(uuid,uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.admin_enqueue_product_candidate_structural_review_v1(uuid,uuid,text,text,jsonb) to service_role;
comment on function public.admin_enqueue_product_candidate_structural_review_v1(uuid,uuid,text,text,jsonb) is
  'Admin-only governed manual catalog-admission ingress. Creates a queued review or requeues a deferred review, audits actual writes, and grants no Product, identity-resolution, source-binding, Offer, Product Fact, or recommendation authority.';

create or replace function public.refresh_candidate_promotion_reviews(p_rule_version text default 'ranking-review-v2'::text)
returns jsonb language plpgsql set search_path to 'public'
as $function$
declare
  v_rule_version text:=nullif(btrim(coalesce(p_rule_version,'')),''); v_inserted integer:=0; v_updated integer:=0; v_deferred integer:=0; v_protected integer:=0; v_examined integer:=0; v_review_id uuid; v_row record;
begin
  if v_rule_version is null then v_rule_version:='ranking-review-v2'; end if;
  if v_rule_version<>'ranking-review-v2' then raise exception using errcode='22023',message='review_refresh_unsupported_rule_version'; end if;
  for v_row in select summary.* from public.candidate_ranking_evidence_summary summary
    where summary.queue_eligible and nullif(btrim(coalesce(summary.external_type,'')),'') is not null and nullif(btrim(coalesce(summary.external_id,'')),'') is not null and not summary.product_match_exists
    order by summary.priority_score desc,summary.concern_best_rank asc nulls last,summary.candidate_id
  loop
    v_examined:=v_examined+1; v_review_id:=null;
    update public.candidate_promotion_reviews set priority_score=v_row.priority_score,selection_reason=v_row.selection_reason,
      evidence_snapshot=v_row.evidence_snapshot||jsonb_build_object('queue_eligible',true,'queue_policy',v_row.queue_policy,'rule_version',v_rule_version),rule_version=v_rule_version,last_queued_at=now()
    where candidate_id=v_row.candidate_id and status in('queued','reviewing') and rule_version=v_rule_version returning id into v_review_id;
    if v_review_id is not null then v_updated:=v_updated+1; continue; end if;
    insert into public.candidate_promotion_reviews(candidate_id,status,priority_score,selection_reason,evidence_snapshot,rule_version,first_queued_at,last_queued_at)
    values(v_row.candidate_id,'queued',v_row.priority_score,v_row.selection_reason,v_row.evidence_snapshot||jsonb_build_object('queue_eligible',true,'queue_policy',v_row.queue_policy,'rule_version',v_rule_version),v_rule_version,now(),now())
    on conflict(candidate_id) do nothing returning id into v_review_id;
    if v_review_id is not null then v_inserted:=v_inserted+1; else v_protected:=v_protected+1; end if;
  end loop;
  for v_row in select reviews.id review_id,reviews.candidate_id,coalesce(summary.evidence_snapshot,'{}'::jsonb) evidence_snapshot
    from public.candidate_promotion_reviews reviews left join public.candidate_ranking_evidence_summary summary on summary.candidate_id=reviews.candidate_id
    where reviews.status in('queued','reviewing') and reviews.rule_version=v_rule_version and not exists(
      select 1 from public.candidate_ranking_evidence_summary eligible where eligible.candidate_id=reviews.candidate_id and eligible.queue_eligible
        and nullif(btrim(coalesce(eligible.external_type,'')),'') is not null and nullif(btrim(coalesce(eligible.external_id,'')),'') is not null and not eligible.product_match_exists)
  loop
    update public.candidate_promotion_reviews set status='deferred',priority_score=0,selection_reason='currently below queue threshold under ranking-review-v2',
      evidence_snapshot=v_row.evidence_snapshot||jsonb_build_object('queue_eligible',false,'rule_version',v_rule_version,'ineligible_reasons',jsonb_build_array('ranking-review-v2 requires concern rank <= 15, persistent rank 16-30, or reinforced rank 31-50')),rule_version=v_rule_version
    where id=v_row.review_id;
    v_deferred:=v_deferred+1;
  end loop;
  return jsonb_build_object('rule_version',v_rule_version,'candidates_examined',v_examined,'reviews_inserted',v_inserted,'reviews_updated',v_updated,'reviews_deferred',v_deferred,'protected_reviews_skipped',v_protected,'products_written',0);
end;
$function$;
