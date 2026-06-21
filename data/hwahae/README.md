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

## Manual Overrides

`manual_overrides.txt` and `manual_overrides.csv` are only for the legacy file-based review flow. They do not control config-based ranking jobs.
