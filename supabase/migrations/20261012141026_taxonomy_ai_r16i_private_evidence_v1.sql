-- R16I-D8B: private, append-only operator-submitted sales screenshots.
-- This table is NOT Product Fact evidence and grants no approval or write authority.
CREATE TABLE IF NOT EXISTS public.admin_product_correction_evidence_v1 (
  evidence_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  source_key text NOT NULL CHECK (source_key IN ('official_single','hwahae_bundle')),
  source_url text NOT NULL CHECK (char_length(source_url) BETWEEN 10 AND 1500),
  selected_option text NOT NULL DEFAULT '' CHECK (char_length(selected_option) <= 500),
  checkout_price_krw integer CHECK (checkout_price_krw BETWEEN 0 AND 100000000),
  captured_at timestamptz NOT NULL,
  notes text NOT NULL DEFAULT '' CHECK (char_length(notes) <= 2000),
  object_path text NOT NULL UNIQUE CHECK (char_length(object_path) BETWEEN 25 AND 300),
  file_sha256 text NOT NULL CHECK (file_sha256 ~ '^[0-9a-f]{64}$'),
  mime_type text NOT NULL CHECK (mime_type IN ('image/png','image/jpeg','image/webp')),
  file_bytes integer NOT NULL CHECK (file_bytes BETWEEN 1 AND 4194304),
  submitted_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  client_request_id uuid NOT NULL UNIQUE,
  evidence_state text NOT NULL DEFAULT 'UNVERIFIED'
    CHECK (evidence_state = 'UNVERIFIED'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_product_correction_evidence_v1_product_recent_idx
  ON public.admin_product_correction_evidence_v1(product_id,created_at DESC);
ALTER TABLE public.admin_product_correction_evidence_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.admin_product_correction_evidence_v1 FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.admin_product_correction_evidence_v1 TO service_role;

-- Bucket is private and has no anon/authenticated policies. Upload is via
-- authenticated Next.js admin endpoint using a server-only service key.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('admin-product-correction-evidence','admin-product-correction-evidence',
  false,4194304,ARRAY['image/png','image/jpeg','image/webp'])
ON CONFLICT(id) DO NOTHING;

DO $$
DECLARE b record;
BEGIN
 SELECT public,file_size_limit,allowed_mime_types INTO b
 FROM storage.buckets WHERE id='admin-product-correction-evidence';
 IF NOT FOUND OR b.public IS DISTINCT FROM false OR b.file_size_limit IS DISTINCT FROM 4194304
   OR b.allowed_mime_types IS NULL
   OR NOT (b.allowed_mime_types @> ARRAY['image/png','image/jpeg','image/webp']) THEN
   RAISE EXCEPTION 'PRIVATE_EVIDENCE_BUCKET_INCORRECT_CONFIGURATION';
 END IF;
END;
$$;
