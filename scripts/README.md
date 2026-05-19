# Hwahae Signal Workflow

This repo no longer uses Playwright as the primary Hwahae collector.

The active flow is:

1. Open a visible Hwahae product page in your own browser.
2. Paste [`scripts/hwahae-console-extractor-snippet.js`](./hwahae-console-extractor-snippet.js) into DevTools Console.
3. Save the returned raw JSON to a tracked sample file such as `data/hwahae-review-signals/samples/single/hwahae-raw.single.json`.
4. Replace `USER_MUST_REPLACE_SUPABASE_PRODUCT_ID` with the real `products.id`.
5. Build a normalized fixture:

```bash
node scripts/build-review-signal-fixture.mjs --input "data/hwahae-review-signals/samples/single/hwahae-raw.single.json" --out "data/hwahae-review-signals/samples/single/hwahae-review-signals.single.fixture.json"
```

6. Dry-run the import:

```bash
node scripts/import-review-signals-to-supabase.mjs --file "data/hwahae-review-signals/samples/single/hwahae-review-signals.single.fixture.json" --dry-run
```

7. If the output looks correct, run the import without `--dry-run`.

```bash
node scripts/import-review-signals-to-supabase.mjs --file "data/hwahae-review-signals/samples/single/hwahae-review-signals.single.fixture.json"
```

## Script Roles

- `scrape-hwahae-review-signals.mjs`
  - Helper entrypoint that prints the current workflow and the console snippet.
- `hwahae-console-extractor-snippet.js`
  - Runs inside the browser console and reads only visible page text.
- `build-review-signal-fixture.mjs`
  - Converts raw visible-page output into normalized fixture JSON.
- `import-review-signals-to-supabase.mjs`
  - Updates `products.review_signals`, `products.market_signals`, and `products.ingredient_signals` when those columns exist.

## Required Product Columns

The current workflow expects these JSONB columns on `products`:

- `review_signals`
- `market_signals`
- `ingredient_signals`

The migration file is:

- [`supabase/migrations/20260430_add_products_signal_columns.sql`](../supabase/migrations/20260430_add_products_signal_columns.sql)

## Notes

- The import script never inserts new products.
- Product matching is by `products.id` only.
- If a column does not exist yet, the import script skips that column and warns.
- Curated raw samples, fixtures, category batches, and notes now live under `data/hwahae-review-signals/`.
- Keep `tmp/` for disposable scratch files only.
