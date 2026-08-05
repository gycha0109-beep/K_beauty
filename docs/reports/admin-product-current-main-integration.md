# ADMIN-PRODUCT-INTEGRATION-1

## Baseline

- Repository: `gycha0109-beep/K_beauty`
- Original current-main baseline: `4202bd2c9a83f276436e226aee9d9bbc9ace2a8f`
- Refreshed current-main baseline: `1b2af0fba90dafbeb6ba2acc4548be89d45ff7e0`
- Refreshed through branch merge commit: `0675db4bd02bc348462323f3809b14b5631efa8b`
- Audited ADMIN-PRODUCT-4 source: `d089bff52f5a48e11acb5c190da78b8aa81db776`
- Target branch: `integration/admin-product-current-main`
- Historical exact-head runner: `30924961952`

## Integration policy

The historical AP stack was not merged or replayed wholesale. Runtime, UI, crawler, contract, verifier, fixture, and migration semantics were selected onto the current main tree.

The four previously unmerged migrations retain their current-main versions to avoid out-of-order hosted migration history:

- `20260804233000_admin_product_candidate_reviews.sql`
- `20260804233100_admin_product_candidate_reviews_hardening.sql`
- `20260804233200_admin_product_candidate_reviews_security_hardening.sql`
- `20260804233300_admin_product_review_import_confirm.sql`

The refreshed branch incorporates the merged #171 Skin Decision Engine closeout without changing Admin v1 storage or RPC contracts. Current-main package versions, workspaces, Vision/Face decision semantics, Premium persistence/reentry, CandidatePolicy state, Vercel main-only deployment policy, and unrelated application files are preserved.

## Semantic conflict resolution

The latest-main merge overlapped only these files:

- `package.json`
- `scripts/run-security-closeout-verifier-suite.mjs`
- `scripts/verify-candidate-policy-main-integration.mjs`

Resolution policy:

- preserve all #171 scripts and package entries
- restore the five Admin v1 verification scripts
- preserve all 60 closeout security verifiers and add the Admin Product verifier exactly once
- preserve closeout CandidatePolicy blob authority while registering only the existing five Admin semantic paths
- do not modify `/api/analyze`, the decision engine, Premium consumers, recommendation scoring, or persistence projections

## Validation contract

The prior exact-head evidence at `4efa74c8ce4c89b03cc592e7edbf93b20c6fd687` remains historical evidence only.

The refreshed exact head must independently pass:

- current-main integration verifier
- Admin Access, Product Candidate Reviews, import-confirm, import-UI, and route contracts
- crawler typecheck and export/intake regressions
- security closeout verifier suite
- architecture guard and ghost-code audit
- Next 15.5.22 production build and static page generation
- diff hygiene and allowed-path audit
- isolated Supabase export → reviewed fixture → dry-run → atomic confirm runtime
- capability, stale candidate, create, merge, defer, block, exact retry, conflicts, audit, and RLS assertions

This report update intentionally triggers the registered Admin integration workflow for the refreshed exact head.

## CandidatePolicy authority preservation

The frozen CandidatePolicy integration manifest remains exact for every protected path except five explicitly registered Admin semantic integration paths. Those paths are revalidated for CandidatePolicy workspace and script preservation, security verifier membership, Admin capability projection, and server-derived actor binding.

The #171 closeout Vision producer, bounded photo state, image eligibility, aggregate-count privacy boundary, saved-report reentry, and main-only Vercel deployment policy remain mandatory verifier assertions.

## Non-targets

- main merge
- Hosted Supabase migration or query
- Production DB query/write
- real product batch confirmation
- first admin-owner bootstrap
- Provider or payment call
- CandidatePolicy or recommendation activation
- catalog metadata write or backfill
- environment or secret mutation
- Production deployment or alias promotion
