# ADMIN-PRODUCT-4 implementation report

## Scope

Implemented the administrator web adapter for the existing reviewed product import stack.

```text
/admin/products/reviews/import
→ POST /api/admin/product-reviews/import/dry-run
→ POST /api/admin/product-reviews/import/confirm
→ existing AP3 reviewed intake and atomic confirm contracts
```

This branch is stacked on `feature/admin-product-review-import-confirm`. It is not a current-main integration branch.

## Implemented

### Workbench

- capability-gated page and Admin navigation entry
- four independent file selectors
- selected-file status and byte display
- dry-run summary and row-level bounded errors
- strict confirm eligibility
- exact confirmation phrase
- confirmed and already-confirmed summaries
- request ID and retryability display
- explicit Reset
- file-change invalidation
- double-submit guard
- exact retry only after retryable confirm failure

### Routes

- Node.js runtime
- same-origin evaluation before protected processing
- session-bound admin actor
- `PRODUCTS_REVIEW` capability
- exact multipart field set
- actual request-stream and individual-file limits
- fatal UTF-8 and NUL rejection
- no upload persistence
- no-store responses
- allowlisted error codes and messages
- no raw auth, parser, file, database, or RPC errors

### Domain adapter

- in-memory byte parser added to the authoritative AP3 reviewed package parser
- existing batch, manifest, evidence, reviewed, row, candidate-set, source-snapshot, and SHA-256 integrity checks preserved
- existing AP3 dry-run reused
- dry-run products writes remain zero
- existing AP3 confirmation payload, exact ledger lookup, authoritative dry-run replay, and atomic RPC reused
- browser-to-RPC and CLI child-process paths were not introduced

### Verification assets

- UI reducer and source contract verifier
- actual multipart request verifier
- crawler in-memory package byte verifier
- isolated Supabase actor fixture
- GitHub Actions workflow with contract/build and isolated confirm-runtime jobs

## Protected execution

No Production or hosted protected execution is part of this implementation.

- Production DB query/write: 0
- Hosted Supabase migration/query/write: 0
- Provider call: 0
- Payment change: 0
- Production deployment: 0
- Admin owner change outside isolated fixture: 0
- CandidatePolicy activation: 0

## Validation status

At document creation, the implementation is committed on the target feature branch and the dedicated Draft PR CI has not yet completed. Only completed current-feature-SHA checks may be promoted to PASS in the final handoff report.

## Remaining integration risk

The AP3/AP4 stack is substantially behind current `main`. Direct merge, full historical cherry-pick replay, and wholesale overwrite are prohibited. Follow-up `ADMIN-PRODUCT-INTEGRATION-1` must perform a curated semantic integration onto current main and rerun migration, RLS, capability, audit, security, build, and isolated runtime verification.
