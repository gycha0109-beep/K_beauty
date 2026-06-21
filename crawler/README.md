# Hwahae Ranking Crawler

Phase 1/2 ranking collection stores observational ranking data and queues manual promotion reviews.

It writes to:

- `public.ranking_snapshots`
- `public.source_rankings`
- `public.product_candidates`
- `public.candidate_promotion_reviews`
- `public.crawl_jobs`

It does not write to `public.products`.

## Domain Model

- A ranking snapshot is observation data from one ranking job at one collection time.
- `product_candidates` is the long-term candidate pool.
- `products` is the approved production catalog.
- Phase 1/2 never inserts, updates, enriches, or promotes `products`.
- Phase 2 only refreshes promotion review candidates for human review.

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

Required config fields use snake_case in JSON:

- `id`
- `source`
- `source_category_key`
- `service_category`
- `source_product_form`
- `ranking_scope`
- `ranking_filter`
- `source_concern_key`
- `canonical_concerns`
- `evidence_type`
- `limit`
- `enabled`
- `disabled_reason`

Source parser fields such as `themeId` and `url` are optional. For Hwahae, `themeId` resolves to:

```txt
https://www.hwahae.com/en/rankings?english_name=category&theme_id=<themeId>
```

Use `ranking_filter` for ranking job filters. Do not treat it as product concerns. `source_concern_key` and `canonical_concerns` carry concern evidence only for verified concern ranking jobs.

Current enabled Hwahae scope is limited to verified single-page JSON-LD category rankings:

- toner, Top 20
- sunscreen, Top 20
- cleansing foam, Top 20

Top 50/100 pagination and concern-filter URLs are not enabled until the URL, pagination, and JSON-LD structure are verified. Disabled jobs must keep a `disabled_reason`.

## Commands

Run all enabled jobs:

```bash
npm run crawl
```

When every enabled job succeeds and no filters such as `--job-ids`, `--theme-ids`, or `--max-pages` are used, `npm run crawl` also refreshes `candidate_promotion_reviews`. Filtered crawls skip review refresh.

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

List queued/reviewing promotion reviews:

```bash
npm run reviews:pending
```

`--with-review-prep` is accepted for CLI compatibility but skipped. Manual approval, promotion, and product enrichment are separate workflows and are not part of ranking collection.

## Snapshot Files

Each crawl saves a local raw snapshot under:

```txt
data/hwahae/ranking-snapshots/{serviceCategory}/{rankingScope}/{rankingFilter}/
```

The snapshot contains the raw JSON-LD payload, normalized items, collector version, `snapshotHash`, and `ingestKey`.
The DB snapshot also stores source context from the job at collection time: `source_category_key`, `source_product_form`, `source_concern_key`, `canonical_concerns`, `evidence_type`, and `requested_limit`.
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

## Promotion Review Queue

`candidate_promotion_reviews` is a manual review queue. The refresh RPC can insert new `queued` rows and update evidence for `queued` or `reviewing` rows only.

It never changes `approved`, `rejected`, or `deferred` rows back to queued. It excludes candidates without external identity, candidates matching existing `products` by normalized brand/name, and candidates without concern evidence. Popularity ranking evidence is stored as support, but popularity-only observations do not queue candidates.

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
- review queue refresh does not write products
- review queue refresh does not overwrite protected review statuses

## Existing Non-Phase-1 Tools

These commands still exist but are outside ranking collection:

- `npm run review:prep`
- `npm run approve:candidate`
- `npm run reject:candidate`
- `npm run promote:approved`
- `npm run promote:report`
- `npm run enrich:queue`
- `npm run enrich:products`

`promote:approved` and `enrich:products` can modify `products`; do not run them as part of Phase 1 ranking collection.
