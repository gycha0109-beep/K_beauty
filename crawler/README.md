# Hwahae Ranking Crawler

Seed-only crawler for Hwahae ranking/category pages.

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
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

## Run

```bash
npm run crawl
```

Useful options:

```bash
npm run crawl -- --dry-run --max-pages=3
npm run crawl -- --theme-ids=4200,5105
npm run crawl -- --delay-ms=2000 --retries=4
```

The crawler discovers category pages from Hwahae's ranking tree, then visits each page with Playwright and parses ranking seed data from the page JSON-LD.
