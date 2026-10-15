-- D8K-12 synthetic isolated PG17 role/schema fixture. NO production data.
-- Run ONLY in disposable local PostgreSQL 17 with untrusted test UUIDs.
CREATE SCHEMA auth;
DO $roles$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role')
 THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon')
 THEN CREATE ROLE anon NOLOGIN; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated')
 THEN CREATE ROLE authenticated NOLOGIN; END IF;
END
$roles$;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE TABLE public.products(id uuid PRIMARY KEY);
CREATE TABLE public.admin_memberships(
 user_id uuid PRIMARY KEY REFERENCES auth.users(id),
 role text NOT NULL,is_active boolean NOT NULL
);
CREATE TABLE public.admin_product_correction_evidence_v1 (
 evidence_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 product_id uuid NOT NULL REFERENCES public.products(id),
 evidence_state text NOT NULL DEFAULT 'UNVERIFIED',
 submitted_by uuid NOT NULL REFERENCES auth.users(id),
 source_key text NOT NULL
);
CREATE TABLE public.admin_product_correction_evidence_verdicts_v1 (
 verdict_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 evidence_id uuid NOT NULL UNIQUE
  REFERENCES public.admin_product_correction_evidence_v1(evidence_id),
 verdict text NOT NULL CHECK (verdict IN ('VERIFIED','REJECTED')),
 reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 1 AND 2000),
 reviewer_id uuid NOT NULL REFERENCES auth.users(id),
 request_id uuid NOT NULL UNIQUE,
 reviewed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_product_correction_evidence_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_product_correction_evidence_verdicts_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_product_correction_evidence_v1,
 public.admin_product_correction_evidence_verdicts_v1 FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.admin_product_correction_evidence_verdicts_v1 TO service_role;
GRANT SELECT ON public.admin_product_correction_evidence_v1 TO service_role;
INSERT INTO auth.users(id) VALUES
 ('00000000-0000-4000-8000-000000000011'), -- OWNER 1
 ('00000000-0000-4000-8000-000000000012'), -- OWNER collector
 ('00000000-0000-4000-8000-000000000013'), -- non-owner
 ('00000000-0000-4000-8000-000000000014'); -- OWNER 2
INSERT INTO public.admin_memberships(user_id,role,is_active)
 VALUES
 ('00000000-0000-4000-8000-000000000011','admin_owner',true),
 ('00000000-0000-4000-8000-000000000012','admin_owner',true),
 ('00000000-0000-4000-8000-000000000013','admin_operator',true),
 ('00000000-0000-4000-8000-000000000014','admin_owner',true);
INSERT INTO public.products(id)
 VALUES('b639c8b4-6a61-440e-b4db-fac7381593ff');
INSERT INTO public.admin_product_correction_evidence_v1(
 evidence_id,product_id,evidence_state,submitted_by,source_key
) VALUES
 ('00000000-0000-4000-8000-000000000041',
 'b639c8b4-6a61-440e-b4db-fac7381593ff','UNVERIFIED',
 '00000000-0000-4000-8000-000000000012','official_single'),
 ('00000000-0000-4000-8000-000000000042',
 'b639c8b4-6a61-440e-b4db-fac7381593ff','UNVERIFIED',
 '00000000-0000-4000-8000-000000000011','hwahae_bundle');
