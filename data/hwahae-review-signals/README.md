# Hwahae Review Signal Dataset

This folder stores curated Hwahae review-signal assets that we want to keep in the repository.

## Structure

- `samples/single/`
  - single-product raw JSON and the matching fixture output
- `samples/batch/`
  - multi-product batch raw JSON and the matching fixture output
- `categories/<category>/raw/`
  - visible-page raw JSON captured per product
- `categories/<category>/`
  - category batch JSON, JSONL, and review-label notes

## Usage

Build a fixture from a saved raw sample:

```bash
node scripts/review-signals/build-review-signal-fixture.mjs --input "data/hwahae-review-signals/samples/single/hwahae-raw.single.json" --out "data/hwahae-review-signals/samples/single/hwahae-review-signals.single.fixture.json"
```

Dry-run the import:

```bash
node scripts/review-signals/import-review-signals-to-supabase.mjs --file "data/hwahae-review-signals/samples/single/hwahae-review-signals.single.fixture.json" --dry-run
```

`tmp/` stays ignored and should be treated as disposable scratch space only.
