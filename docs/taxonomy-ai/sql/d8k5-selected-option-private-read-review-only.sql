-- D8K-5 REVIEW-ONLY follow-on to selected-option evidence schema candidate.
-- NOT a migration; NOT approved or applied. Requires PG17 role/RLS rehearsal.
-- Assumes both child tables from the sibling review-only SQL are present.
begin;

do $$
begin
  if not exists (select 1 from pg_roles
                 where rolname = 'recommendation_admission_runtime')
    or not exists (select 1 from pg_roles
                   where rolname = 'product_offer_presentation_reader_owner')
  then
    raise exception 'D8K5_PRIVATE_OFFER_READER_ROLES_REQUIRED';
  end if;
end $$;

grant select on public.product_offer_option_observations,
                public.product_offer_option_reviews
  to product_offer_presentation_reader_owner;

-- Only the dedicated *database* reader owner can SELECT raw candidate rows.
-- The UI and generic service_role have NO table privileges or policies.
create policy product_offer_option_reader_observations_v1
  on public.product_offer_option_observations
  for select to product_offer_presentation_reader_owner using (true);
create policy product_offer_option_reader_reviews_v1
  on public.product_offer_option_reviews
  for select to product_offer_presentation_reader_owner using (true);

create function public.read_selected_offer_option_evidence_v1(
  p_product_ids uuid[]
) returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_count integer;
  v_options jsonb;
begin
  if p_product_ids is null
    or cardinality(p_product_ids) = 0
    or cardinality(p_product_ids) > 64
    or array_position(p_product_ids, null) is not null
  then
    return pg_catalog.jsonb_build_object(
      'read_contract_version', 'selected-offer-option-evidence-read-v1',
      'status', 'NO_AUTHORITY', 'reason', 'PRODUCT_IDS_INVALID_OR_OVER_LIMIT'
    );
  end if;

  with ranked as (
    select
      o.*, p.product_id, p.seller_key, p.seller_name, p.listing_id,
      p.currency_code, p.market_code, p.offer_state, p.product_scope_state,
      row_number() over (
        partition by o.offer_id, o.seller_option_key
        order by o.observed_at desc, o.recorded_at desc, o.observation_id desc
      ) as option_rank
    from public.product_offer_option_observations o
    join public.product_offers p on p.offer_id = o.offer_id
    where p.product_id = any(p_product_ids)
  ),
  latest_review as (
    select
      r.*,
      row_number() over (
        partition by r.observation_id
        order by r.reviewed_at desc, r.created_at desc, r.review_id desc
      ) as review_rank
    from public.product_offer_option_reviews r
    join ranked ro on ro.observation_id = r.observation_id
    where ro.option_rank = 1
  ),
  eligible as (
    select
      ranked.*,
      r.review_id, r.evidence_sha256, r.reviewer_reference, r.reviewed_at
    from ranked
    join latest_review r
      on r.observation_id = ranked.observation_id
    where ranked.option_rank = 1
      and r.review_rank = 1
      and ranked.offer_state = 'current'
      and ranked.product_scope_state = 'product'
      and ranked.currency_code = 'KRW'
      and ranked.market_code = 'KR'
      and ranked.listing_id is not null
      and r.verdict = 'verified'
      and ranked.observed_at <= pg_catalog.now()
      and ranked.recorded_at <= pg_catalog.now()
      and r.reviewed_at >= ranked.observed_at
      and r.reviewed_at <= pg_catalog.now()
  )
  select count(*)::integer,
         coalesce(
           jsonb_agg(
             jsonb_build_object(
               'observation_id', observation_id,
               'review_id', review_id,
               'offer_id', offer_id,
               'product_id', product_id,
               'seller_key', seller_key,
               'seller_name', seller_name,
               'listing_id', listing_id,
               'seller_option_key', seller_option_key,
               'variant_id', variant_id,
               'option_kind', option_kind,
               'unit_size', unit_size,
               'size_unit', size_unit,
               'quantity', quantity,
               'gifts', gifts,
               'selected_option_price_krw', selected_option_price_krw,
               'shipping_price_krw', shipping_price_krw,
               'currency_code', currency_code,
               'observed_at', observed_at,
               'reviewed_at', reviewed_at,
               'evidence_sha256', evidence_sha256
             )
             order by product_id, offer_id, seller_option_key
           ), '[]'::jsonb
         )
  into v_count, v_options from eligible;

  if v_count > 256 then
    return pg_catalog.jsonb_build_object(
      'read_contract_version', 'selected-offer-option-evidence-read-v1',
      'status', 'NO_AUTHORITY', 'reason', 'SELECTED_OPTION_ROW_LIMIT_EXCEEDED'
    );
  end if;

  return pg_catalog.jsonb_build_object(
    'read_contract_version', 'selected-offer-option-evidence-read-v1',
    'status', 'AUTHORITY_RESOLVED', 'options', v_options
  );
end;
$$;

revoke all on function public.read_selected_offer_option_evidence_v1(uuid[])
  from public, anon, authenticated, service_role;
grant execute on function public.read_selected_offer_option_evidence_v1(uuid[])
  to recommendation_admission_runtime;

-- Follow existing owner transfer convention; PG role membership and schema
-- CREATE grants must be reviewed, minimized and transaction-scoped.
grant create on schema public to product_offer_presentation_reader_owner;
grant product_offer_presentation_reader_owner to postgres;
alter function public.read_selected_offer_option_evidence_v1(uuid[])
  owner to product_offer_presentation_reader_owner;
revoke product_offer_presentation_reader_owner from postgres;
revoke create on schema public from product_offer_presentation_reader_owner;

-- These checks must also run in isolated PG17 as anon/authenticated/
-- service_role (negative), named internal role (positive), plus owner RLS.
do $$
begin
  if has_table_privilege('anon',
      'public.product_offer_option_observations','SELECT')
    or has_table_privilege('authenticated',
      'public.product_offer_option_observations','SELECT')
    or has_table_privilege('service_role',
      'public.product_offer_option_observations','SELECT')
    or has_table_privilege('anon',
      'public.product_offer_option_reviews','SELECT')
    or has_table_privilege('authenticated',
      'public.product_offer_option_reviews','SELECT')
    or has_table_privilege('service_role',
      'public.product_offer_option_reviews','SELECT')
    or has_function_privilege('anon',
      'public.read_selected_offer_option_evidence_v1(uuid[])','EXECUTE')
    or has_function_privilege('authenticated',
      'public.read_selected_offer_option_evidence_v1(uuid[])','EXECUTE')
    or has_function_privilege('service_role',
      'public.read_selected_offer_option_evidence_v1(uuid[])','EXECUTE')
  then
    raise exception 'D8K5_BROAD_OFFER_OPTION_AUTHORITY_FORBIDDEN';
  end if;
end $$;

-- SELECT THE MOST RECENT OBSERVATION before filtering any review.
-- SELECT THE MOST RECENT REVIEW (verified/rejected) before filtering verdict.
-- A newer rejected review MUST suppress a previous verified review; an
-- unreviewed newer observation MUST suppress an older verified price.
-- This SQL alone does not establish collector/reviewer identity separation,
-- external evidence authenticity, or safe live server execution.
-- Output does not contain listing_url or direct CTA; it does not re-attest
-- the underlying screenshot/source, user authorization, or Product admission.
-- The server must separately verify trust and observation freshness.
commit;
