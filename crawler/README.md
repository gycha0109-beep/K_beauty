# Hwahae Ranking Crawler

Phase 1 ranking collection stores observational ranking data only.

It writes to:

- `public.ranking_snapshots`
- `public.source_rankings`
- `public.product_candidates`
- `public.crawl_jobs`

It does not write to `public.products`.

## Domain Model

- A ranking snapshot is observation data from one ranking job at one collection time.
- `product_candidates` is the long-term candidate pool.
- `products` is the approved production catalog.
- Phase 1 never inserts, updates, enriches, or promotes `products`.

`serviceCategory`, `rankingScope`, and `rankingFilter` belong to `ranking_snapshots` and `source_rankings` observations. They are not canonical candidate identity fields.

## Setup

```bash
cd crawler
npm install
npx playwright install chromium
```

Create `crawler/.env` or reuse the workspace root `.env.local` with:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Apply the Phase 1 migration before DB writes:

```bash
../supabase/migrations/20260621030000_phase1_ranking_snapshot_pipeline.sql
```

## Ranking Jobs

Jobs live in `crawler/config/ranking-jobs.json`.

Required fields:

- `id`
- `source`
- `serviceCategory`
- `rankingScope`
- `rankingFilter`
- `limit`
- `enabled`

Source parser fields such as `themeId` and `url` are optional. For Hwahae, `themeId` resolves to:

```txt
https://www.hwahae.com/en/rankings?english_name=category&theme_id=<themeId>
```

Use `rankingFilter` for ranking job filters. Do not treat it as product concerns.

## Commands

Run all enabled jobs:

```bash
npm run crawl
```

Run a dry-run. This still fetches Hwahae pages and writes local snapshot files, but it does not create remote Supabase rows:

```bash
npm run crawl -- --dry-run --max-pages=1
```

Run one job:

```bash
npm run crawl:hwahae -- --job-ids=hwahae-skincare-toner-category-all
```

Legacy `--theme-ids` filtering is still supported:

```bash
npm run crawl -- --theme-ids=5106
```

`--with-review-prep` is accepted for CLI compatibility but skipped in Phase 1. Review prep, approval, promotion, and product enrichment are separate workflows and are not part of ranking collection.

## Snapshot Files

Each crawl saves a local raw snapshot under:

```txt
data/hwahae/ranking-snapshots/{serviceCategory}/{rankingScope}/{rankingFilter}/
```

The snapshot contains the raw JSON-LD payload, normalized items, collector version, `snapshotHash`, and `ingestKey`.
`snapshotHash` is a content fingerprint for comparison and audit. It excludes collection time and is not unique; the same ranking payload can be collected again in a later run.
`ingestKey` is the retry identity for one locally generated snapshot. Re-running the same saved snapshot reuses the DB snapshot only when the existing remote snapshot is already `ingested`; it does not duplicate source rankings or increment candidate `seen_count` again. Reusing the same `ingestKey` with different snapshot metadata is a conflict. Reusing the same `ingestKey` for an existing non-`ingested` snapshot is blocked and requires investigation/recovery. A later collection with the same `snapshotHash` but a new collection time gets a different `ingestKey` and is stored as a new snapshot.

This directory is ignored by git. Do not commit large raw snapshots or production collection data.

## Candidate Identity

Candidate identity:

```txt
source_name + external_type + external_id
```

Phase 1 requires `external_type` and `external_id` on every ranking item. Items without stable source identity fail before any remote DB write. Name/brand fallback identity is intentionally not used in Phase 1 because SQL and crawler text normalization can drift.

Allowed Phase 1 categories are:

- `cleanser`
- `toner_essence`
- `toner_pad`
- `treatment`
- `moisturizer`
- `moisturizer_lotion_emulsion`
- `moisturizer_gel`
- `moisturizer_cream`
- `moisturizer_balm`
- `sunscreen`

Legacy `serum`, `ampoule`, and `essence` are rejected for ranking ingestion.

The `ingest_ranking_snapshot` RPC validates a full snapshot before any candidate mutation. It rejects duplicate rank positions and duplicate candidate identities inside one snapshot. The DB also prevents duplicate observations inside one snapshot by both `snapshot_id + rank_position` and, when available, `snapshot_id + candidate_id`.
Candidate creation is conflict-safe on external identity, so concurrent snapshots observing the same new product reuse one candidate instead of failing on the unique index.
The service-role crawler is the only intended DB writer for Phase 1 ranking ingestion. The migration grants only the table privileges needed by the security-invoker RPC and does not add public read policies or anon/authenticated write grants.

## First Safe DB Write

Before the first real DB write:

1. Apply the Phase 1 migration to the intended Supabase project.
2. Verify `ranking_snapshots` has RLS enabled and `ingest_ranking_snapshot(text, jsonb)` is executable only by `service_role`.
3. Run `npm run typecheck` and `npm run test:ranking-ingest`.
4. Run one dry-run for a single job and inspect the local snapshot file.
5. Run one real job only, then inspect `ranking_snapshots`, `source_rankings`, and `product_candidates` before expanding.

## Verification

```bash
npm run test:ranking-ingest
npm run typecheck
```

The smoke test covers:

- same snapshot replay does not increase candidate observations
- same `external_id` in another ranking job reuses one candidate
- same `ingestKey` with different metadata fails
- missing external identity fails
- invalid and legacy categories fail
- only source ranking observations accumulate across snapshots

## Existing Non-Phase-1 Tools

These commands still exist but are outside Phase 1 collection:

- `npm run review:prep`
- `npm run approve:candidate`
- `npm run reject:candidate`
- `npm run promote:approved`
- `npm run promote:report`
- `npm run enrich:queue`
- `npm run enrich:products`

`promote:approved` and `enrich:products` can modify `products`; do not run them as part of Phase 1 ranking collection.
