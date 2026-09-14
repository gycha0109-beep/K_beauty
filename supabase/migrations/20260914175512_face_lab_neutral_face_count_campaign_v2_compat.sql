alter table public.tmp_face_lab_neutral_face_count_submissions
  drop constraint if exists tmp_face_lab_neutral_campaign_check;

alter table public.tmp_face_lab_neutral_face_count_submissions
  add constraint tmp_face_lab_neutral_campaign_check
  check (campaign_key in (
    'face_count_neutral_shared_review_v1',
    'face_count_neutral_shared_review_v2'
  ));

comment on constraint tmp_face_lab_neutral_campaign_check
  on public.tmp_face_lab_neutral_face_count_submissions is
  'Allows historical Stage A v1 submissions and active Stage A v2 submissions without rewriting existing Human Review rows.';
