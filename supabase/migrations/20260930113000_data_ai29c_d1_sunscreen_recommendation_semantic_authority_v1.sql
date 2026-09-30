begin;

create table if not exists public.sunscreen_recommendation_semantic_field_reviews (
  review_id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  subject_id uuid not null references public.product_fact_subjects(subject_id) on delete restrict,
  field_name text not null,
  review_state text not null,
  field_value jsonb,
  confidence text not null,
  evidence_records jsonb not null default '[]'::jsonb,
  evidence_digest text,
  semantic_bundle_version text not null,
  review_policy_version text not null,
  request_id text not null unique,
  supersedes_review_id uuid references public.sunscreen_recommendation_semantic_field_reviews(review_id) on delete restrict,
  payload_digest text not null,
  is_current boolean not null default true,
  reviewed_by uuid not null references auth.users(id) on delete restrict,
  reviewed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint sunscreen_semantic_field_name_check
    check (field_name in (
      'category_slot',
      'skin_types',
      'concerns',
      'texture',
      'finish',
      'uv_filter_type',
      'sensitivity_safe',
      'irritation_risk',
      'tone_up',
      'white_cast',
      'eye_sting',
      'pilling_risk'
    )),
  constraint sunscreen_semantic_review_state_check
    check (review_state in (
      'established',
      'reviewed_not_established',
      'conflict',
      'not_reviewed'
    )),
  constraint sunscreen_semantic_confidence_check
    check (confidence in ('high','medium','low','unknown')),
  constraint sunscreen_semantic_evidence_array_check
    check (jsonb_typeof(evidence_records) = 'array'),
  constraint sunscreen_semantic_evidence_digest_check
    check (evidence_digest is null or evidence_digest ~ '^[0-9a-f]{64}$'),
  constraint sunscreen_semantic_bundle_version_check
    check (semantic_bundle_version = 'sunscreen-recommendation-semantic-bundle-v1'),
  constraint sunscreen_semantic_review_policy_check
    check (review_policy_version = 'sunscreen-recommendation-semantic-review-policy-v1'),
  constraint sunscreen_semantic_request_check
    check (char_length(btrim(request_id)) between 8 and 120),
  constraint sunscreen_semantic_payload_digest_check
    check (payload_digest ~ '^[0-9a-f]{64}$'),
  constraint sunscreen_semantic_state_value_check
    check (
      (review_state = 'established'
        and field_value is not null
        and confidence in ('high','medium','low')
        and jsonb_array_length(evidence_records) > 0
        and evidence_digest is not null)
      or
      (review_state in ('reviewed_not_established','conflict')
        and field_value is null
        and confidence = 'unknown'
        and jsonb_array_length(evidence_records) > 0
        and evidence_digest is not null)
      or
      (review_state = 'not_reviewed'
        and field_value is null
        and confidence = 'unknown'
        and jsonb_array_length(evidence_records) = 0
        and evidence_digest is null)
    )
);

create unique index if not exists sunscreen_semantic_current_field_uidx
  on public.sunscreen_recommendation_semantic_field_reviews(product_id, field_name)
  where is_current;

create index if not exists sunscreen_semantic_subject_idx
  on public.sunscreen_recommendation_semantic_field_reviews(subject_id, field_name, reviewed_at desc);

create index if not exists sunscreen_semantic_state_idx
  on public.sunscreen_recommendation_semantic_field_reviews(review_state, field_name, reviewed_at desc);

alter table public.sunscreen_recommendation_semantic_field_reviews enable row level security;
revoke all on table public.sunscreen_recommendation_semantic_field_reviews
  from public, anon, authenticated, service_role;
grant select on table public.sunscreen_recommendation_semantic_field_reviews
  to service_role;

create or replace function public.admin_register_sunscreen_recommendation_semantic_field_v1(
  p_actor_user_id uuid,
  p_request_id text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_role text;
  v_request_id text := btrim(coalesce(p_request_id, ''));
  v_product_id uuid;
  v_subject_id uuid;
  v_field_name text;
  v_review_state text;
  v_value jsonb;
  v_confidence text;
  v_evidence jsonb;
  v_evidence_digest text;
  v_supersedes uuid;
  v_payload_digest text;
  v_existing public.sunscreen_recommendation_semantic_field_reviews%rowtype;
  v_current public.sunscreen_recommendation_semantic_field_reviews%rowtype;
  v_review_id uuid;
  v_audit_id uuid;
  v_established_count integer;
  v_reviewed_count integer;
  v_allowed_keys text[] := array[
    'product_id','subject_id','field_name','review_state','field_value',
    'confidence','evidence_records','supersedes_review_id'
  ];
begin
  v_actor_role := public.admin_require_product_review_actor(
    p_actor_user_id,
    'admin.products.review'
  );

  if char_length(v_request_id) not between 8 and 120
     or p_payload is null
     or jsonb_typeof(p_payload) <> 'object'
     or octet_length(p_payload::text) > 65536
     or not (p_payload ?& array[
       'product_id','subject_id','field_name','review_state','field_value',
       'confidence','evidence_records','supersedes_review_id'
     ])
     or exists (
       select 1
       from jsonb_object_keys(p_payload) as k(key)
       where not (k.key = any(v_allowed_keys))
     )
  then
    raise exception 'sunscreen_semantic_review_payload_invalid'
      using errcode = '22023';
  end if;

  begin
    v_product_id := (p_payload ->> 'product_id')::uuid;
    v_subject_id := (p_payload ->> 'subject_id')::uuid;
    v_supersedes := nullif(p_payload ->> 'supersedes_review_id','')::uuid;
  exception when invalid_text_representation then
    raise exception 'sunscreen_semantic_review_identity_invalid'
      using errcode = '22023';
  end;

  v_field_name := btrim(coalesce(p_payload ->> 'field_name',''));
  v_review_state := btrim(coalesce(p_payload ->> 'review_state',''));
  v_value := case
    when p_payload -> 'field_value' is null
      or p_payload -> 'field_value' = 'null'::jsonb then null
    else p_payload -> 'field_value'
  end;
  v_confidence := btrim(coalesce(p_payload ->> 'confidence',''));
  v_evidence := coalesce(p_payload -> 'evidence_records','[]'::jsonb);

  if v_field_name not in (
       'category_slot','skin_types','concerns','texture','finish','uv_filter_type',
       'sensitivity_safe','irritation_risk','tone_up','white_cast','eye_sting','pilling_risk'
     )
     or v_review_state not in (
       'established','reviewed_not_established','conflict','not_reviewed'
     )
     or v_confidence not in ('high','medium','low','unknown')
     or jsonb_typeof(v_evidence) <> 'array'
     or jsonb_array_length(v_evidence) > 32
     or octet_length(v_evidence::text) > 32768
  then
    raise exception 'sunscreen_semantic_review_fields_invalid'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_evidence) as e(value)
    where jsonb_typeof(e.value) <> 'object'
       or coalesce(e.value ->> 'source_type','') not in (
         'canonical_taxonomy',
         'product_fact_current',
         'official_product_page',
         'hwahae_review_signal',
         'hwahae_review_sample'
       )
       or char_length(coalesce(e.value ->> 'source_ref','')) not between 3 and 1000
       or (
         coalesce(e.value ->> 'source_type','') in (
           'official_product_page','hwahae_review_signal','hwahae_review_sample'
         )
         and coalesce(e.value ->> 'source_ref','') !~ '^https://'
       )
       or (
         coalesce(e.value ->> 'source_type','') in (
           'canonical_taxonomy','product_fact_current'
         )
         and coalesce(e.value ->> 'source_ref','') !~ '^db:'
       )
  ) then
    raise exception 'sunscreen_semantic_review_evidence_invalid'
      using errcode = '22023';
  end if;

  if v_review_state = 'established' then
    if v_value is null
       or v_confidence = 'unknown'
       or jsonb_array_length(v_evidence) = 0 then
      raise exception 'sunscreen_semantic_established_contract_invalid'
        using errcode = '23514';
    end if;
  elsif v_review_state in ('reviewed_not_established','conflict') then
    if v_value is not null
       or v_confidence <> 'unknown'
       or jsonb_array_length(v_evidence) = 0 then
      raise exception 'sunscreen_semantic_unresolved_contract_invalid'
        using errcode = '23514';
    end if;
  else
    if v_value is not null
       or v_confidence <> 'unknown'
       or jsonb_array_length(v_evidence) <> 0 then
      raise exception 'sunscreen_semantic_not_reviewed_contract_invalid'
        using errcode = '23514';
    end if;
  end if;

  if v_review_state = 'established' then
    case v_field_name
      when 'category_slot' then
        if jsonb_typeof(v_value) <> 'string'
           or v_value #>> '{}' <> 'sunscreen' then
          raise exception 'sunscreen_semantic_category_value_invalid'
            using errcode = '23514';
        end if;
      when 'skin_types' then
        if jsonb_typeof(v_value) <> 'array'
           or jsonb_array_length(v_value) = 0
           or exists (
             select 1
             from jsonb_array_elements_text(v_value) as x(value)
             where x.value not in ('oily','dry','combination','sensitive')
           )
           or (
             select count(*) from jsonb_array_elements_text(v_value)
           ) <> (
             select count(distinct value) from jsonb_array_elements_text(v_value)
           ) then
          raise exception 'sunscreen_semantic_skin_types_value_invalid'
            using errcode = '23514';
        end if;
      when 'concerns' then
        if jsonb_typeof(v_value) <> 'array'
           or jsonb_array_length(v_value) = 0
           or exists (
             select 1
             from jsonb_array_elements_text(v_value) as x(value)
             where x.value not in (
               'oiliness','dehydration','acne','uneven_tone','pores','redness','barrier'
             )
           )
           or (
             select count(*) from jsonb_array_elements_text(v_value)
           ) <> (
             select count(distinct value) from jsonb_array_elements_text(v_value)
           ) then
          raise exception 'sunscreen_semantic_concerns_value_invalid'
            using errcode = '23514';
        end if;
      when 'texture' then
        if jsonb_typeof(v_value) <> 'string'
           or v_value #>> '{}' not in ('watery','gel','lotion','cream') then
          raise exception 'sunscreen_semantic_texture_value_invalid'
            using errcode = '23514';
        end if;
      when 'finish' then
        if jsonb_typeof(v_value) <> 'string'
           or v_value #>> '{}' not in ('fresh','natural','dewy','soft_matte') then
          raise exception 'sunscreen_semantic_finish_value_invalid'
            using errcode = '23514';
        end if;
      when 'uv_filter_type' then
        if jsonb_typeof(v_value) <> 'string'
           or v_value #>> '{}' not in ('organic','mineral','hybrid') then
          raise exception 'sunscreen_semantic_uv_filter_value_invalid'
            using errcode = '23514';
        end if;
      when 'sensitivity_safe' then
        if jsonb_typeof(v_value) <> 'boolean' then
          raise exception 'sunscreen_semantic_sensitivity_safe_value_invalid'
            using errcode = '23514';
        end if;
      when 'irritation_risk' then
        if jsonb_typeof(v_value) <> 'string'
           or v_value #>> '{}' not in ('low','medium','high') then
          raise exception 'sunscreen_semantic_irritation_risk_value_invalid'
            using errcode = '23514';
        end if;
      when 'tone_up' then
        if jsonb_typeof(v_value) <> 'boolean' then
          raise exception 'sunscreen_semantic_tone_up_value_invalid'
            using errcode = '23514';
        end if;
      when 'white_cast' then
        if jsonb_typeof(v_value) <> 'string'
           or v_value #>> '{}' not in ('none','low','medium','high') then
          raise exception 'sunscreen_semantic_white_cast_value_invalid'
            using errcode = '23514';
        end if;
      when 'eye_sting' then
        if jsonb_typeof(v_value) <> 'string'
           or v_value #>> '{}' not in ('low','medium','high') then
          raise exception 'sunscreen_semantic_eye_sting_value_invalid'
            using errcode = '23514';
        end if;
      when 'pilling_risk' then
        if jsonb_typeof(v_value) <> 'string'
           or v_value #>> '{}' not in ('low','medium','high') then
          raise exception 'sunscreen_semantic_pilling_risk_value_invalid'
            using errcode = '23514';
        end if;
      else
        raise exception 'sunscreen_semantic_field_unsupported'
          using errcode = '23514';
    end case;
  end if;

  if not exists (
    select 1
    from public.products p
    where p.id = v_product_id
      and (
        p.category::text = 'sunscreen'
        or exists (
          select 1
          from public.product_catalog_taxonomy_assignments a
          where a.product_id = p.id
            and a.taxonomy_version = 'catalog-taxonomy-v1'
            and a.category_term_id = 'catalog-taxonomy-v1:category:sunscreen'
            and a.assignment_state = 'shadow'
        )
      )
  ) then
    raise exception 'sunscreen_semantic_product_scope_invalid'
      using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.product_fact_subjects s
    where s.subject_id = v_subject_id
      and s.product_id = v_product_id
      and s.identity_status = 'resolved'
      and s.current_state = 'current'
      and (s.valid_to is null or s.valid_to > current_date)
  ) then
    raise exception 'sunscreen_semantic_subject_scope_invalid'
      using errcode = '23514';
  end if;

  if v_review_state = 'established'
     and v_field_name = 'category_slot' then
    if not exists (
      select 1
      from jsonb_array_elements(v_evidence) as e(value)
      where e.value ->> 'source_type' = 'canonical_taxonomy'
    ) then
      raise exception 'sunscreen_semantic_category_taxonomy_evidence_required'
        using errcode = '23514';
    end if;
  end if;

  if v_review_state = 'established'
     and v_field_name = 'uv_filter_type' then
    if not exists (
      select 1
      from jsonb_array_elements(v_evidence) as e(value)
      where e.value ->> 'source_type' = 'product_fact_current'
    ) then
      raise exception 'sunscreen_semantic_uv_filter_fact_evidence_required'
        using errcode = '23514';
    end if;

    if not exists (
      select 1
      from public.product_fact_current c
      join public.product_fact_instances fi
        on fi.fact_instance_id = c.fact_instance_id
      where c.subject_id = v_subject_id
        and fi.fact_key = 'uv_filter_type'
        and fi.semantic_status = 'supported'
        and fi.authority_ceiling = 'product_specific_primary'
        and fi.fused_confidence in ('high','medium')
        and (fi.valid_to is null or fi.valid_to > current_date)
        and fi.value_enum = v_value #>> '{}'
    ) then
      raise exception 'sunscreen_semantic_uv_filter_fact_mismatch'
        using errcode = '23514';
    end if;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'sunscreen-semantic-review:' || v_product_id::text || ':' || v_field_name,
      0
    )
  );

  v_evidence_digest := case
    when jsonb_array_length(v_evidence) = 0 then null
    else public.admin_product_review_sha256_json(v_evidence)
  end;

  v_payload_digest := public.admin_product_review_sha256_json(
    jsonb_build_object(
      'product_id', v_product_id,
      'subject_id', v_subject_id,
      'field_name', v_field_name,
      'review_state', v_review_state,
      'field_value', v_value,
      'confidence', v_confidence,
      'evidence_records', v_evidence,
      'evidence_digest', v_evidence_digest,
      'semantic_bundle_version', 'sunscreen-recommendation-semantic-bundle-v1',
      'review_policy_version', 'sunscreen-recommendation-semantic-review-policy-v1',
      'supersedes_review_id', v_supersedes
    )
  );

  select *
    into v_existing
  from public.sunscreen_recommendation_semantic_field_reviews r
  where r.request_id = v_request_id;

  if found then
    if v_existing.reviewed_by <> p_actor_user_id
       or v_existing.payload_digest <> v_payload_digest then
      raise exception 'sunscreen_semantic_review_request_conflict'
        using errcode = '23505';
    end if;

    return jsonb_build_object(
      'status', 'reviewed',
      'review_id', v_existing.review_id,
      'product_id', v_existing.product_id,
      'subject_id', v_existing.subject_id,
      'field_name', v_existing.field_name,
      'review_state', v_existing.review_state,
      'field_value', v_existing.field_value,
      'confidence', v_existing.confidence,
      'is_current', v_existing.is_current,
      'inserted', false,
      'idempotent', true,
      'product_row_mutated', false,
      'recommendation_admission_mutated', false,
      'production_ranking_changed', false
    );
  end if;

  select *
    into v_current
  from public.sunscreen_recommendation_semantic_field_reviews r
  where r.product_id = v_product_id
    and r.field_name = v_field_name
    and r.is_current
  for update;

  if found then
    if v_supersedes is distinct from v_current.review_id then
      raise exception 'sunscreen_semantic_review_supersedes_current_required'
        using errcode = '40001';
    end if;
  elsif v_supersedes is not null then
    raise exception 'sunscreen_semantic_review_supersedes_unexpected'
      using errcode = '40001';
  end if;

  if found then
    update public.sunscreen_recommendation_semantic_field_reviews
       set is_current = false
     where review_id = v_current.review_id;
  end if;

  insert into public.sunscreen_recommendation_semantic_field_reviews (
    product_id,
    subject_id,
    field_name,
    review_state,
    field_value,
    confidence,
    evidence_records,
    evidence_digest,
    semantic_bundle_version,
    review_policy_version,
    request_id,
    supersedes_review_id,
    payload_digest,
    is_current,
    reviewed_by,
    reviewed_at
  )
  values (
    v_product_id,
    v_subject_id,
    v_field_name,
    v_review_state,
    v_value,
    v_confidence,
    v_evidence,
    v_evidence_digest,
    'sunscreen-recommendation-semantic-bundle-v1',
    'sunscreen-recommendation-semantic-review-policy-v1',
    v_request_id,
    v_supersedes,
    v_payload_digest,
    true,
    p_actor_user_id,
    now()
  )
  returning review_id into v_review_id;

  select
    count(*) filter (where r.review_state = 'established')::integer,
    count(*)::integer
    into v_established_count, v_reviewed_count
  from public.sunscreen_recommendation_semantic_field_reviews r
  where r.product_id = v_product_id
    and r.subject_id = v_subject_id
    and r.is_current;

  v_audit_id := public.record_admin_audit_event(
    p_actor_user_id,
    'admin.products.review',
    'admin.sunscreen_recommendation_semantic_field_reviewed',
    'sunscreen_recommendation_semantic_field_review',
    v_review_id::text,
    null,
    jsonb_build_object(
      'product_id', v_product_id,
      'subject_id', v_subject_id,
      'field_name', v_field_name,
      'review_state', v_review_state,
      'field_value', v_value,
      'confidence', v_confidence,
      'evidence_digest', v_evidence_digest
    ),
    'review sunscreen recommendation semantic field without mutating Product or Recommendation authority',
    v_request_id,
    jsonb_build_object(
      'contract_version', 'sunscreen-recommendation-semantic-bundle-v1',
      'review_policy_version', 'sunscreen-recommendation-semantic-review-policy-v1',
      'actor_role', v_actor_role,
      'established_field_count', v_established_count,
      'reviewed_field_count', v_reviewed_count,
      'required_field_count', 12,
      'product_row_mutated', false,
      'recommendation_admission_mutated', false,
      'production_ranking_changed', false
    )
  );

  return jsonb_build_object(
    'status', 'reviewed',
    'review_id', v_review_id,
    'audit_id', v_audit_id,
    'product_id', v_product_id,
    'subject_id', v_subject_id,
    'field_name', v_field_name,
    'review_state', v_review_state,
    'field_value', v_value,
    'confidence', v_confidence,
    'established_field_count', v_established_count,
    'reviewed_field_count', v_reviewed_count,
    'required_field_count', 12,
    'bundle_complete', v_established_count = 12,
    'inserted', true,
    'idempotent', false,
    'product_row_mutated', false,
    'recommendation_admission_mutated', false,
    'production_ranking_changed', false
  );
end;
$$;

create or replace function public.read_sunscreen_recommendation_semantic_bundle_v1(
  p_product_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
with current_subject as (
  select s.subject_id
  from public.product_fact_subjects s
  where s.product_id = p_product_id
    and s.identity_status = 'resolved'
    and s.current_state = 'current'
    and (s.valid_to is null or s.valid_to > current_date)
  order by s.created_at desc, s.subject_id
),
subject_state as (
  select
    count(*)::integer as subject_count,
    min(subject_id::text)::uuid as subject_id
  from current_subject
),
required(field_name) as (
  values
    ('category_slot'),
    ('skin_types'),
    ('concerns'),
    ('texture'),
    ('finish'),
    ('uv_filter_type'),
    ('sensitivity_safe'),
    ('irritation_risk'),
    ('tone_up'),
    ('white_cast'),
    ('eye_sting'),
    ('pilling_risk')
),
reviews as (
  select r.*
  from public.sunscreen_recommendation_semantic_field_reviews r
  join subject_state ss
    on ss.subject_count = 1
   and r.subject_id = ss.subject_id
  where r.product_id = p_product_id
    and r.is_current
),
rows as (
  select
    req.field_name,
    r.review_id,
    r.review_state,
    r.field_value,
    r.confidence,
    r.evidence_digest,
    r.reviewed_at
  from required req
  left join reviews r
    on r.field_name = req.field_name
),
summary as (
  select
    count(*) filter (where review_state is not null)::integer as reviewed_count,
    count(*) filter (where review_state = 'established')::integer as established_count,
    count(*) filter (where review_state = 'reviewed_not_established')::integer as not_established_count,
    count(*) filter (where review_state = 'conflict')::integer as conflict_count,
    count(*) filter (where review_state = 'not_reviewed' or review_state is null)::integer as not_reviewed_count
  from rows
)
select jsonb_build_object(
  'contractVersion', 'sunscreen-recommendation-semantic-bundle-v1',
  'reviewPolicyVersion', 'sunscreen-recommendation-semantic-review-policy-v1',
  'productId', p_product_id,
  'subjectId', case when ss.subject_count = 1 then ss.subject_id else null end,
  'subjectCount', ss.subject_count,
  'status', case
    when ss.subject_count <> 1 then 'SUBJECT_NOT_EXACT'
    when sm.established_count = 12 then 'SEMANTIC_BUNDLE_COMPLETE'
    else 'SEMANTIC_BUNDLE_INCOMPLETE'
  end,
  'requiredFieldCount', 12,
  'reviewedFieldCount', sm.reviewed_count,
  'establishedFieldCount', sm.established_count,
  'reviewedNotEstablishedFieldCount', sm.not_established_count,
  'conflictFieldCount', sm.conflict_count,
  'notReviewedFieldCount', sm.not_reviewed_count,
  'complete', ss.subject_count = 1 and sm.established_count = 12,
  'fields', (
    select jsonb_object_agg(
      field_name,
      jsonb_build_object(
        'reviewId', review_id,
        'state', coalesce(review_state, 'not_reviewed'),
        'value', field_value,
        'confidence', coalesce(confidence, 'unknown'),
        'evidenceDigest', evidence_digest,
        'reviewedAt', reviewed_at
      )
      order by field_name
    )
    from rows
  ),
  'limits', jsonb_build_object(
    'productRowMutated', false,
    'recommendationAdmissionMutated', false,
    'productionRankingChanged', false,
    'productionCutoverAuthorized', false
  )
)
from subject_state ss
cross join summary sm;
$$;

comment on table public.sunscreen_recommendation_semantic_field_reviews is
  'Versioned field-level D1 review authority for sunscreen Recommendation semantics. Missing is not false; Product rows and Recommendation admission remain unchanged.';
comment on function public.admin_register_sunscreen_recommendation_semantic_field_v1(uuid,text,jsonb) is
  'Admin-only D1 field review registration. Requires canonical sunscreen scope/current Subject and governed Product Fact Current for established uv_filter_type; never mutates Product rows or Recommendation authority.';
comment on function public.read_sunscreen_recommendation_semantic_bundle_v1(uuid) is
  'Service-role-only read projection for the D1 sunscreen Recommendation semantic bundle. Complete only when all 12 required fields are established.';

revoke all on function public.admin_register_sunscreen_recommendation_semantic_field_v1(uuid,text,jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.admin_register_sunscreen_recommendation_semantic_field_v1(uuid,text,jsonb)
  to service_role;

revoke all on function public.read_sunscreen_recommendation_semantic_bundle_v1(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.read_sunscreen_recommendation_semantic_bundle_v1(uuid)
  to service_role;

commit;
