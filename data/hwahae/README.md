# Hwahae Category Import Files

Use one raw candidate file per product category so review and SQL generation stay aligned with the `product_category` enum.

## Batch prepare

Save category-named Hwahae JSON files directly in this folder:

- `세럼.json` -> `serum`
- `앰플.json` -> `ampoule`
- `에센스.json` -> `essence`
- `클렌저.json` -> `cleanser`
- `토너.json` -> `toner_essence`
- `토너패드.json` -> `toner_pad`
- `로션.json` / `에멀전.json` -> `moisturizer_lotion_emulsion`
- `젤.json` -> `moisturizer_gel`
- `크림.json` -> `moisturizer_cream`
- `밤.json` -> `moisturizer_balm`
- `선크림.json` -> `sunscreen`

Then run:

```bash
npm run hwahae:prepare
```

The command reads live Supabase `products`, runs duplicate matching, and writes one output folder per JSON file:

```txt
product_out_세럼/
  hwahae_match_review.csv
  hwahae_filtered_out.csv
  hwahae_final_new_candidates.json
```

Use `npm run hwahae:prepare -- --dry-run` to preview the planned jobs.

If `manual_overrides.txt` was edited after reviewing duplicates, rerun the same process with:

```bash
npm run hwahae:override
```

This reapplies duplicate/exclude/new override decisions and overwrites the existing `product_out_*/hwahae_final_new_candidates.json` files.

For the common false-duplicate case, put only one Hwahae external ID per line in `manual_overrides.txt`:

```txt
999999
123456
```

Those IDs are treated as `new`, so the candidates are restored into `hwahae_final_new_candidates.json`.
Advanced CSV overrides are still supported with `manual_overrides.csv`, but `manual_overrides.txt` is preferred when both files exist.

Recommended moisturizer files:

- `moisturizer_lotion_emulsion_top20.json`
- `moisturizer_gel_top20.json`
- `moisturizer_cream_top20.json`
- `moisturizer_balm_top20.json`

The existing flow after prepare remains:

1. Save the Hwahae candidate JSON.
2. Run `npm run hwahae:prepare`.
3. Review `product_out_*/hwahae_match_review.csv` and `hwahae_final_new_candidates.json`.
4. Enrich tags from web/search review.
5. Generate `insert_preview.csv` and `insert.sql`.
6. Execute SQL in Supabase.

Keep these schema mappings unchanged:

- `category` -> `product_category`
- `texture` -> `product_texture`
- `finish` -> `product_finish`
- `skin_types`, `concerns` -> `text[]`
- `review_signals`, `market_signals`, `ingredient_signals` -> `jsonb`
