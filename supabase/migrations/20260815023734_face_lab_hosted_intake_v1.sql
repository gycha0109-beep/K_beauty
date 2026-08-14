begin;

-- D2D-XP only: temporary research/evaluation intake. This table is isolated
-- from production Face Lab result, scoring, profile, and report authorities.
create table public.tmp_face_lab_independent_human_cue_submissions (
  id uuid primary key default gen_random_uuid(),
  campaign_key text not null,
  access_mode text not null,
  intake_version text not null,
  protocol_version text not null,
  ui_version text not null,
  source_authority_digest text not null,
  target_axis_definition_digest text not null,
  packet_authority_digest text not null,
  distribution_mode text not null,
  submission_status text not null,
  session_id text not null,
  started_at timestamptz not null,
  submitted_at timestamptz not null default now(),
  client_submitted_at timestamptz,
  response_payload_json jsonb not null,
  response_payload_sha256 text not null,
  completion_summary_json jsonb not null,
  reviewer_attestations_json jsonb not null,
  storage_schema_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tmp_face_lab_human_cue_campaign_check
    check (campaign_key = 'face_lab_cx1g_d2d_xp_v1'),
  constraint tmp_face_lab_human_cue_access_mode_check
    check (access_mode = 'shared_opaque_link'),
  constraint tmp_face_lab_human_cue_distribution_check
    check (distribution_mode = 'single_hosted_set'),
  constraint tmp_face_lab_human_cue_status_check
    check (submission_status in ('started', 'submitted', 'invalid', 'test')),
  constraint tmp_face_lab_human_cue_session_check
    check (session_id ~ '^hsi_[0-9a-fA-F-]{36}$'),
  constraint tmp_face_lab_human_cue_digest_check
    check (
      source_authority_digest ~ '^[0-9a-f]{64}$'
      and target_axis_definition_digest ~ '^[0-9a-f]{64}$'
      and packet_authority_digest ~ '^[0-9a-f]{64}$'
      and response_payload_sha256 ~ '^[0-9a-f]{64}$'
    ),
  constraint tmp_face_lab_human_cue_payload_check
    check (jsonb_typeof(response_payload_json) = 'object'),
  constraint tmp_face_lab_human_cue_completion_check
    check (jsonb_typeof(completion_summary_json) = 'object'),
  constraint tmp_face_lab_human_cue_attestation_check
    check (jsonb_typeof(reviewer_attestations_json) = 'object'),
  constraint tmp_face_lab_human_cue_timeline_check
    check (
      started_at <= submitted_at
      and (client_submitted_at is null or client_submitted_at >= started_at)
    ),
  constraint tmp_face_lab_human_cue_immutable_timestamp_check
    check (updated_at = created_at),
  constraint tmp_face_lab_human_cue_session_unique
    unique (campaign_key, session_id)
);

comment on table public.tmp_face_lab_independent_human_cue_submissions is
  'Temporary D2D-XP blind Human cue submissions. Service-role insert/select only; no canonical Face Lab production consumption.';
comment on column public.tmp_face_lab_independent_human_cue_submissions.response_payload_json is
  'Canonical-token hosted response envelope. Korean labels are display-only and are not persisted as authority.';

create index tmp_face_lab_human_cue_status_submitted_idx
  on public.tmp_face_lab_independent_human_cue_submissions (
    campaign_key,
    submission_status,
    submitted_at desc
  );

alter table public.tmp_face_lab_independent_human_cue_submissions
  enable row level security;

revoke all on table public.tmp_face_lab_independent_human_cue_submissions
  from public, anon, authenticated, service_role;
grant insert, select on table public.tmp_face_lab_independent_human_cue_submissions
  to service_role;

commit;
