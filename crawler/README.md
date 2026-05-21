# Hwahae Ranking Crawler

Seed-only crawler and review/promotion tooling for Hwahae ranking pages.

## What it stores

- `public.source_rankings`
- `public.product_candidates`
- `public.crawl_jobs`

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

## Apply the review migration first

The review/promotion layer lives in:

```bash
../supabase/migrations/20260410_safe_review_and_promotion_layer.sql
```

Apply that SQL in Supabase before using `review:prep` or `promote:approved`.

## Commands

Run the seed crawler:

```bash
npm run crawl
```

Run crawl and automatically continue into review prep:

```bash
npm run crawl:hwahae -- --with-review-prep
```

Dry-run the crawler:

```bash
npm run crawl -- --dry-run --max-pages=3
```

Prepare new candidates for review:

```bash
npm run review:prep -- --limit=100
```

Approve a specific candidate:

```bash
npm run approve:candidate -- --id=<candidate-id>
```

Reject a specific candidate:

```bash
npm run reject:candidate -- --id=<candidate-id>
```

List review queue candidates from the CLI:

```bash
npm run list:candidates -- --status=needs_review --limit=20
npm run list:candidates -- --status=needs_review,approved --limit=20
```

Dry-run review prep:

```bash
npm run review:prep -- --dry-run --limit=20
```

Promote approved candidates through the RPC:

```bash
npm run promote:approved -- --actor=hun --limit=50
```

Show recent promotion results:

```bash
npm run promote:report -- --limit=20 --hours=24 --status=promoted
```

List products that still need manual enrichment:

```bash
npm run enrich:queue -- --limit=20
```

Apply manual enrichment to one product without overwriting existing populated fields:

```bash
npm run enrich:products -- --id=<product-id> --buy-link=https://... --image-url=https://... --price-min=18000 --price-max=22000 --known-source-url=https://...
```

Apply manual enrichment in batch from a JSON payload file:

```bash
npm run enrich:products -- --limit=10 --payload=./payloads/enrich-products.json
```

Example payload shape:

```json
[
  {
    "id": "product-uuid",
    "buy_link": "https://store.example/item",
    "image_url": "https://cdn.example/item.jpg",
    "price_min": 18000,
    "price_max": 22000,
    "known_source_url": "https://www.hwahae.com/en/rankings?english_name=category&theme_id=5106",
    "source_evidence": "matched against promoted Hwahae ranking evidence"
  }
]
```

Dry-run approved promotion queue:

```bash
npm run promote:approved -- --dry-run
```

## Notes

- `review:prep` only processes `review_status = 'new'`
- `promote:approved` only processes `review_status = 'approved'`
- the crawler still supports legacy `status` inserts until the DB is fully migrated
- `enrich:queue` only lists existing `products`; it never creates new product rows
- `enrich:products` is semi-manual in v1 and only fills `buy_link`, `image_url`, `price_min`, `price_max` when those fields are currently empty
