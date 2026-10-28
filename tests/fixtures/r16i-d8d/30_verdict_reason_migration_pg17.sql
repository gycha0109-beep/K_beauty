-- Isolated PostgreSQL 17 contract test. All schema/data changes are rolled back.
-- This intentionally mocks ONLY the predecessor CHECK and unrelated reason guards.
\set ON_ERROR_STOP on
BEGIN;

CREATE TABLE public.admin_product_correction_evidence_verdicts_v1 (
  verdict_id uuid PRIMARY KEY,
  reason text NOT NULL CONSTRAINT admin_product_correction_evidence_verdicts_v1_reason_check
    CHECK (char_length(btrim(reason)) BETWEEN 12 AND 2000)
);
CREATE TABLE public.admin_product_correction_proposals_v1 (
  proposal_id uuid PRIMARY KEY,
  rationale text NOT NULL CONSTRAINT d8c_proposal_rationale_guard
    CHECK (char_length(btrim(rationale)) BETWEEN 12 AND 2000)
);
CREATE TABLE public.admin_product_correction_decisions_v1 (
  decision_id uuid PRIMARY KEY,
  reason text NOT NULL CONSTRAINT d8c_decision_reason_guard
    CHECK (char_length(btrim(reason)) BETWEEN 12 AND 2000)
);

INSERT INTO public.admin_product_correction_evidence_verdicts_v1 (verdict_id,reason)
VALUES ('00000000-0000-4000-8000-000000000001','기존 원본을 확인한 판정 사유입니다.');

DO $pre$
DECLARE blocked boolean := false;
BEGIN
  BEGIN
    INSERT INTO public.admin_product_correction_evidence_verdicts_v1 (verdict_id,reason)
    VALUES ('00000000-0000-4000-8000-000000000002','오');
  EXCEPTION WHEN check_violation THEN blocked := true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'R16I_D8C_PREDECESSOR_MUST_DENY_SHORT_REASON'; END IF;
END
$pre$;

-- Apply the actual checked-in migration to the predecessor-only fixture.
\i supabase/migrations/20261014121000_taxonomy_ai_r16i_verdict_reason_nonempty_v1.sql

DO $verify$
DECLARE
  blocked boolean;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid='public.admin_product_correction_evidence_verdicts_v1'::regclass
      AND c.conname='admin_product_correction_evidence_verdicts_v1_reason_check'
      AND pg_get_constraintdef(c.oid) LIKE '%char_length(btrim(reason)) >= 1%'
      AND pg_get_constraintdef(c.oid) LIKE '%char_length(btrim(reason)) <= 2000%'
  ) THEN RAISE EXCEPTION 'R16I_D8C_NEW_REASON_GUARD_MISSING'; END IF;
  IF (SELECT count(*) FROM public.admin_product_correction_evidence_verdicts_v1
      WHERE verdict_id='00000000-0000-4000-8000-000000000001')<>1
  THEN RAISE EXCEPTION 'R16I_D8C_EXISTING_VERDICT_NOT_PRESERVED'; END IF;

  INSERT INTO public.admin_product_correction_evidence_verdicts_v1 (verdict_id,reason)
  VALUES
    ('00000000-0000-4000-8000-000000000002','오'),
    ('00000000-0000-4000-8000-000000000003','오너 확인 완료'),
    ('00000000-0000-4000-8000-000000000004',repeat('x',2000));

  blocked := false;
  BEGIN
    INSERT INTO public.admin_product_correction_evidence_verdicts_v1 (verdict_id,reason)
    VALUES ('00000000-0000-4000-8000-000000000005','  ');
  EXCEPTION WHEN check_violation THEN blocked := true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'R16I_D8C_WHITESPACE_REASON_ACCEPTED'; END IF;
  blocked := false;
  BEGIN
    INSERT INTO public.admin_product_correction_evidence_verdicts_v1 (verdict_id,reason)
    VALUES ('00000000-0000-4000-8000-000000000006',repeat('y',2001));
  EXCEPTION WHEN check_violation THEN blocked := true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'R16I_D8C_TOO_LONG_REASON_ACCEPTED'; END IF;

  blocked := false;
  BEGIN
    INSERT INTO public.admin_product_correction_proposals_v1 (proposal_id,rationale)
    VALUES ('00000000-0000-4000-8000-000000000007','짧음');
  EXCEPTION WHEN check_violation THEN blocked := true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'R16I_D8C_PROPOSAL_REASON_WEAKENED'; END IF;
  blocked := false;
  BEGIN
    INSERT INTO public.admin_product_correction_decisions_v1 (decision_id,reason)
    VALUES ('00000000-0000-4000-8000-000000000008','짧음');
  EXCEPTION WHEN check_violation THEN blocked := true;
  END;
  IF NOT blocked THEN RAISE EXCEPTION 'R16I_D8C_OWNER_DECISION_REASON_WEAKENED'; END IF;
  IF (SELECT count(*) FROM public.admin_product_correction_evidence_verdicts_v1)<>4
  THEN RAISE EXCEPTION 'R16I_D8C_UNEXPECTED_ROWS'; END IF;
END
$verify$;

SELECT 'R16I_D8C_VERDICT_REASON_PG17_PASS' AS result;
ROLLBACK;
