ALTER TABLE products
ADD COLUMN IF NOT EXISTS market_signals jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS ingredient_signals jsonb DEFAULT '{}'::jsonb;
