-- D8K-13 synthetic legacy two-self-review fixture for disposable PG17 ONLY.
-- Run after tests/fixtures/r16i-d8k12/00_minimal_pg17.sql.
-- Never use hosted credentials or real account IDs/source bytes.
CREATE TABLE public.admin_product_correction_proposals_v1(proposal_id uuid PRIMARY KEY);
CREATE TABLE public.admin_product_correction_decisions_v1(decision_id uuid PRIMARY KEY);
CREATE TABLE public.admin_r16i_correction_applications_v1(application_id uuid PRIMARY KEY);
CREATE TABLE public.admin_r16i_correction_application_events_v1(event_id uuid PRIMARY KEY);
CREATE TABLE public.admin_r16i_correction_release_gate_v1(
 scope text PRIMARY KEY,enabled boolean NOT NULL);
INSERT INTO public.admin_r16i_correction_release_gate_v1(scope,enabled)
 VALUES('R16I_S_NATURE_PRODUCT_1',false);
-- In actual observed hosted state only ONE active OWNER exists.
UPDATE public.admin_memberships SET is_active=false
 WHERE user_id IN ('00000000-0000-4000-8000-000000000011',
                   '00000000-0000-4000-8000-000000000014');
INSERT INTO public.admin_product_correction_evidence_verdicts_v1(
 verdict_id,evidence_id,verdict,reason,reviewer_id,request_id,reviewed_at
) VALUES
 ('00000000-0000-4000-8000-000000000101',
  '00000000-0000-4000-8000-000000000041',
  'VERIFIED','Original self review: official single',
  '00000000-0000-4000-8000-000000000012',
  '00000000-0000-4000-8000-000000000091',
  '2026-10-14T12:14:30+09:00'),
 ('00000000-0000-4000-8000-000000000102',
  '00000000-0000-4000-8000-000000000042',
  'VERIFIED','Original self review: hwahae bundle',
  '00000000-0000-4000-8000-000000000011',
  '00000000-0000-4000-8000-000000000092',
  '2026-10-14T12:14:50+09:00');
