# Hwahae Data Workspace

This folder contains file-based Hwahae import/review assets.

## Phase 1 Ranking Snapshots

The crawler writes raw ranking snapshots to:

```txt
data/hwahae/ranking-snapshots/{serviceCategory}/{rankingScope}/{rankingFilter}/
```

Those files are local collection artifacts and are ignored by git. Do not commit raw production ranking snapshots or large source payloads.
Dry-run mode can still create files here and fetch external Hwahae pages; its guarantee is no remote Supabase writes.

Phase 1 rules:

- ranking snapshot = observation data
- `product_candidates` = candidate pool
- `products` = approved production catalog
- Phase 1 does not insert, update, enrich, or promote `products`

## Legacy File-Based Import Flow

The older `hwahae:prepare` flow is not the Phase 1 ranking pipeline. It reads category JSON files from this folder, compares them with live `products`, and writes review files such as:

```txt
product_out_*/
  hwahae_match_review.csv
  hwahae_filtered_out.csv
  hwahae_final_new_candidates.json
```

That flow is review/preparation only. Do not use its output to generate direct `products` inserts for the Phase 1 ranking pipeline.

### Batch Metadata Contract

Each batch input JSON file can provide explicit file-level metadata:

```json
{
  "batch_metadata": {
    "canonical_category": "treatment",
    "product_form": "essence"
  },
  "rows": []
}
```

or:

```json
{
  "batch_metadata": {
    "canonical_category": "toner_essence",
    "product_form": null
  },
  "rows": []
}
```

Allowed `canonical_category` values are `cleanser`, `toner_essence`, `toner_pad`, `treatment`, `moisturizer`, `moisturizer_lotion_emulsion`, `moisturizer_gel`, `moisturizer_cream`, `moisturizer_balm`, and `sunscreen`.

For `canonical_category=treatment`, `product_form` is required and must be one of `serum`, `ampoule`, `essence`, `booster`, or `peeling_solution`. For every non-treatment category, `product_form` must be absent or `null`.

Raw filename/name tokens are not authoritative category signals. In particular, raw `essence` filenames or product names containing `essence`/`에센스` do not classify a batch as treatment essence. Use `batch_metadata` to choose either `canonical_category=treatment` with `product_form=essence`, or `canonical_category=toner_essence` with `product_form=null`.

Legacy generated files containing `product_form=unknown` are not valid input to the current package pipeline. Resolve them to a canonical treatment product form or exclude them before reuse.

## Manual Overrides

`manual_overrides.txt` and `manual_overrides.csv` are only for the legacy file-based review flow. They do not control config-based ranking jobs.
