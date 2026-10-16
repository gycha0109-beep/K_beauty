-- D8K-13 / D8D v2 synthetic prerequisite for isolated PostgreSQL 17 ONLY.
-- D8K12 minimal fixture has only the correction-relevant Product and
-- evidence tables. Full D8D v2 function definitions require product_offers
-- as an existing row type, as in hosted migration chronology.
-- This is a disposable table, not a copy of hosted product/offer data.
CREATE TABLE public.product_offers (
 offer_id uuid PRIMARY KEY
);
