begin;

create table public.product_evidence_source_verifications (
  verification_id uuid primary key default gen_random_uuid(),
  request_id text not null,
  source_id uuid not null references public.product_evidence_sources(source_id) on delete restrict,
  baseline_content_digest text not null,
  observed_content_digest text,
  verification_result text not null,
  trigger_kind text not null,
  checked_at timestamptz not null,
  verification_metadata jsonb not null default '{}'::jsonb,
  payload_digest text not null,
  created_at timestamptz not null default now(),
  constraint product_evidence_source_verifications_request_unique unique (request_id),
  constraint product_evidence_source_verifications_request_check
    check (char_length(btrim(request_id)) between 1 and 256),
  constraint product_evidence_source_verifications_baseline_digest_check
    check (baseline_content_digest ~ '^[0-9a-f]{64}$'),
  constraint product_evidence_source_verifications_observed_digest_check
    check (observed_content_digest is null or observed_content_digest ~ '^[0-9a-f]{64}$'),
  constraint product_evidence_source_verifications_result_check
    check (verification_result in ('unchanged', 'changed', 'unavailable', 'ambiguous')),
  constraint product_evidence_source_verifications_trigger_check
    check (trigger_kind in (
      'scheduled',
      'manual',
      'new_evidence',
      'subject_or_formulation_changed',
      'registry_changed'
    )),
  constraint product_evidence_source_verifications_metadata_check
    check (
      jsonb_typeof(verification_metadata) = 'object'
      and octet_length(verification_metadata::text) <= 32768
    ),
  constraint product_evidence_source_verifications_payload_digest_check
    check (payload_digest ~ '^[0-9a-f]{64}$'),
  constraint product_evidence_source_verifications_result_digest_relation_check
    check (
      (verification_result = 'unchanged'
        and observed_content_digest is not null
        and observed_content_digest = baseline_content_digest)
      or
      (verification_result = 'changed'
        and observed_content_digest is not null
        and observed_content_digest <> baseline_content_digest)
      or
      (verification_result = 'unavailable'
        and observed_content_digest is null)
      or
      verification_result = 'ambiguous'
    )
);

create index product_evidence_source_verifications_source_checked_idx
  on public.product_evidence_source_verifications (source_id, checked_at desc, verification_id);

create index product_evidence_source_verifications_result_checked_idx
  on public.product_evidence_source_verifications (verification_result, checked_at desc, verification_id);

alter table public.product_evidence_source_verifications enable row level security;

revoke all on table public.product_evidence_source_verifications
  from public, anon, authenticated, service_role;
grant select on table public.product_evidence_source_verifications to service_role;

create or replace function public.record_product_evidence_source_verification_v1(
  p_request_id text,
  p_source_id uuid,
  p_observed_content_digest text,
  p_verification_result text,
  p_trigger_kind text,
  p_checked_at timestamptz,
  p_verification_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source public.product_evidence_sources%rowtype;
  v_payload jsonb;
  v_payload_digest text;
  v_verification_id uuid;
  v_existing public.product_evidence_source_verifications%rowtype;
begin
  if p_request_id is null or char_length(btrim(p_request_id)) not between 1 and 256 then
    raise exception 'product_evidence_source_verification_invalid_request_id'
      using errcode = '22023';
  end if;

  if p_source_id is null then
    raise exception 'product_evidence_source_verification_source_required'
      using errcode = '22023';
  end if;

  if p_verification_result is null
     or p_verification_result not in ('unchanged', 'changed', 'unavailable', 'ambiguous') then
    raise exception 'product_evidence_source_verification_invalid_result'
      using errcode = '22023';
  end if;

  if p_trigger_kind is null
     or p_trigger_kind not in (
       'scheduled',
       'manual',
       'new_evidence',
       'subject_or_formulation_changed',
       'registry_changed'
     ) then
    raise exception 'product_evidence_source_verification_invalid_trigger'
      using errcode = '22023';
  end if;

  if p_checked_at is null then
    raise exception 'product_evidence_source_verification_checked_at_required'
      using errcode = '22023';
  end if;

  if p_verification_metadata is null
     or jsonb_typeof(p_verification_metadata) <> 'object'
     or octet_length(p_verification_metadata::text) > 32768 then
    raise exception 'product_evidence_source_verification_invalid_metadata'
      using errcode = '22023';
  end if;

  if p_observed_content_digest is not null
     and p_observed_content_digest !~ '^[0-9a-f]{64}$' then
    raise exception 'product_evidence_source_verification_invalid_observed_digest'
      using errcode = '22023';
  end if;

  select *
    into v_source
    from public.product_evidence_sources
   where source_id = p_source_id;

  if not found then
    raise exception 'product_evidence_source_verification_source_not_found'
      using errcode = 'P0002';
  end if;

  if p_verification_result = 'unchanged'
     and p_observed_content_digest is distinct from v_source.content_digest then
    raise exception 'product_evidence_source_verification_unchanged_digest_mismatch'
      using errcode = '22023';
  end if;

  if p_verification_result = 'changed'
     and (
       p_observed_content_digest is null
       or p_observed_content_digest = v_source.content_digest
     ) then
    raise exception 'product_evidence_source_verification_changed_digest_required'
      using errcode = '22023';
  end if;

  if p_verification_result = 'unavailable'
     and p_observed_content_digest is not null then
    raise exception 'product_evidence_source_verification_unavailable_digest_forbidden'
      using errcode = '22023';
  end if;

  v_payload := jsonb_build_object(
    'request_id', btrim(p_request_id),
    'source_id', p_source_id,
    'baseline_content_digest', v_source.content_digest,
    'observed_content_digest', p_observed_content_digest,
    'verification_result', p_verification_result,
    'trigger_kind', p_trigger_kind,
    'checked_at', p_checked_at,
    'verification_metadata', p_verification_metadata
  );

  v_payload_digest := encode(
    extensions.digest(convert_to(v_payload::text, 'UTF8'), 'sha256'),
    'hex'
  );

  insert into public.product_evidence_source_verifications (
    request_id,
    source_id,
    baseline_content_digest,
    observed_content_digest,
    verification_result,
    trigger_kind,
    checked_at,
    verification_metadata,
    payload_digest
  )
  values (
    btrim(p_request_id),
    p_source_id,
    v_source.content_digest,
    p_observed_content_digest,
    p_verification_result,
    p_trigger_kind,
    p_checked_at,
    p_verification_metadata,
    v_payload_digest
  )
  on conflict (request_id) do nothing
  returning verification_id into v_verification_id;

  if v_verification_id is not null then
    return jsonb_build_object(
      'verification_id', v_verification_id,
      'source_id', p_source_id,
      'baseline_content_digest', v_source.content_digest,
      'observed_content_digest', p_observed_content_digest,
      'verification_result', p_verification_result,
      'trigger_kind', p_trigger_kind,
      'payload_digest', v_payload_digest,
      'inserted', true,
      'automatic_fact_mutation', false,
      'automatic_confirmation', false
    );
  end if;

  select *
    into v_existing
    from public.product_evidence_source_verifications
   where request_id = btrim(p_request_id);

  if not found then
    raise exception 'product_evidence_source_verification_retry_resolution_failed'
      using errcode = '40001';
  end if;

  if v_existing.payload_digest <> v_payload_digest then
    raise exception 'product_evidence_source_verification_request_conflict'
      using errcode = '23505';
  end if;

  return jsonb_build_object(
    'verification_id', v_existing.verification_id,
    'source_id', v_existing.source_id,
    'baseline_content_digest', v_existing.baseline_content_digest,
    'observed_content_digest', v_existing.observed_content_digest,
    'verification_result', v_existing.verification_result,
    'trigger_kind', v_existing.trigger_kind,
    'payload_digest', v_existing.payload_digest,
    'inserted', false,
    'automatic_fact_mutation', false,
    'automatic_confirmation', false
  );
end;
$$;

revoke all on function public.record_product_evidence_source_verification_v1(
  text, uuid, text, text, text, timestamptz, jsonb
) from public, anon, authenticated, service_role;

grant execute on function public.record_product_evidence_source_verification_v1(
  text, uuid, text, text, text, timestamptz, jsonb
) to service_role;

comment on table public.product_evidence_source_verifications is
  'Append-only source revalidation observations. A changed or unavailable source is an operational re-review signal and never semantic Product Fact authority by itself.';

comment on function public.record_product_evidence_source_verification_v1(
  text, uuid, text, text, text, timestamptz, jsonb
) is
  'Service-role-only idempotent source verification recorder. It never mutates Product Facts, review assignments, current pointers, confirmations, Subjects, or Recommendation authority.';

commit;
