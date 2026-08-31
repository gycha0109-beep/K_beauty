begin;

-- Temporary shared neutral face-count intake. This table is isolated from
-- production Face Lab scoring, profile, report, recommendation, and MyeongHa
-- semantic authorities. It stores Human observations only.
create table public.tmp_face_lab_neutral_face_count_submissions (
  id uuid primary key default gen_random_uuid(),
  campaign_key text not null,
  access_mode text not null,
  intake_version text not null,
  authority_digest text not null,
  submission_status text not null,
  session_id text not null,
  started_at timestamptz not null,
  submitted_at timestamptz not null default now(),
  client_submitted_at timestamptz not null,
  response_payload_json jsonb not null,
  response_payload_sha256 text not null,
  storage_schema_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tmp_face_lab_neutral_campaign_check
    check (campaign_key = 'face_count_neutral_shared_review_v1'),
  constraint tmp_face_lab_neutral_access_mode_check
    check (access_mode = 'shared_opaque_link'),
  constraint tmp_face_lab_neutral_status_check
    check (submission_status in ('submitted', 'test')),
  constraint tmp_face_lab_neutral_session_check
    check (session_id ~ '^hsi_[0-9a-fA-F-]{36}$'),
  constraint tmp_face_lab_neutral_digest_check
    check (
      authority_digest ~ '^[0-9a-f]{64}$'
      and response_payload_sha256 ~ '^[0-9a-f]{64}$'
    ),
  constraint tmp_face_lab_neutral_payload_check
    check (jsonb_typeof(response_payload_json) = 'object'),
  constraint tmp_face_lab_neutral_timeline_check
    check (
      started_at <= client_submitted_at
      and client_submitted_at <= submitted_at + interval '10 minutes'
    ),
  constraint tmp_face_lab_neutral_immutable_timestamp_check
    check (updated_at = created_at),
  constraint tmp_face_lab_neutral_session_unique
    unique (campaign_key, session_id)
);

comment on table public.tmp_face_lab_neutral_face_count_submissions is
  'Temporary shared blind Human neutral face-count observations. Service-role insert/select only. Not a production Face Lab or MyeongHa semantic authority.';
comment on column public.tmp_face_lab_neutral_face_count_submissions.response_payload_json is
  'Neutral face-count response envelope only. Source names, expected labels, provider output, traditional semantics, and downstream judgments are excluded.';

create index tmp_face_lab_neutral_status_submitted_idx
  on public.tmp_face_lab_neutral_face_count_submissions (
    campaign_key,
    submission_status,
    submitted_at desc
  );

alter table public.tmp_face_lab_neutral_face_count_submissions
  enable row level security;

revoke all on table public.tmp_face_lab_neutral_face_count_submissions
  from public, anon, authenticated, service_role;
grant insert, select on table public.tmp_face_lab_neutral_face_count_submissions
  to service_role;

commit;
