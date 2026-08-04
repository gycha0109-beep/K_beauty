# ADMIN-PRODUCT-INTEGRATION-1

## Baseline

- Repository: `gycha0109-beep/K_beauty`
- Current-main baseline: `4202bd2c9a83f276436e226aee9d9bbc9ace2a8f`
- Audited ADMIN-PRODUCT-4 source: `d089bff52f5a48e11acb5c190da78b8aa81db776`
- Target branch: `integration/admin-product-current-main`
- Validation runner: `30923389434`

## Integration policy

The historical AP stack was not merged or replayed wholesale. Runtime, UI, crawler, contract, verifier, fixture, and migration semantics were selected onto the current main tree.

The four previously unmerged migrations were assigned new current-main versions to avoid out-of-order hosted migration history:

- `20260804233000_admin_product_candidate_reviews.sql`
- `20260804233100_admin_product_candidate_reviews_hardening.sql`
- `20260804233200_admin_product_candidate_reviews_security_hardening.sql`
- `20260804233300_admin_product_review_import_confirm.sql`

Current-main package versions, workspaces, CandidatePolicy state, Vercel branch policy, and unrelated application files are preserved.

## Validation contract

This branch is pushed only after the runner completes:

- current-main integration verifier
- Admin Access, Product Candidate Reviews, import-confirm, import-UI, and route contracts
- crawler typecheck and export/intake regressions
- security closeout verifier suite
- architecture guard
- Next production build
- diff hygiene and allowed-path audit
- isolated Supabase export → reviewed fixture → dry-run → atomic confirm runtime

## Non-targets

- main merge
- Hosted Supabase migration or query
- Production DB query/write
- real product batch confirmation
- first admin-owner bootstrap
- Provider or payment call
- CandidatePolicy activation
- environment or secret mutation
- Production deployment or alias promotion
