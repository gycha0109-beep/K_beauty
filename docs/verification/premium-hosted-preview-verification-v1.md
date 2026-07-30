# Premium Hosted Preview Verification v1

## Purpose

This is Step 10 of the Premium contract. It verifies the deployed Hosted Preview boundary after route/storage/reentry verification and before CandidatePolicy runtime re-evaluation.

## Scope

The gate covers:

- exact Preview host and deployment SHA
- two permanent Google-authenticated test accounts
- Premium allowed, forbidden, unauthenticated, ownership, and optional principal-conflict paths
- KO and EN semantic parity
- selected, not-in-db, mixed current-product, and duplicate-axis cases
- normal-photo and photo-fallback cases
- first save, identical retry, saved reentry, finalized conflict, rotation, second save
- RLS-readable persistence evidence and duplicate source-tuple detection
- one isolated fault Preview for safe 5xx behavior
- privacy-safe evidence and separately confirmed cleanup

It does not change application runtime behavior, DB schema, RLS, auth, payment, provider, UI, or production deployment.

## Required inputs

```text
PREMIUM_HOSTED_BASE_URL
PREMIUM_HOSTED_ENVIRONMENT=preview|production-like
PREMIUM_HOSTED_EXPECTED_HOST
PREMIUM_HOSTED_EXPECTED_SHA
PREMIUM_HOSTED_DEPLOYMENT_SHA
PREMIUM_HOSTED_MANIFEST_PATH
```

Runtime and DB evidence commands additionally require the existing Premium browser journey public Supabase configuration and dedicated test-account credentials through environment variables. Tokens, cookies, email addresses, original photos, OAuth codes, and complete Premium report bodies must never be committed or written to artifacts.

## Manifest contract

The manifest is local-only and contains:

- account A/B expected user-ID hashes and storage-state paths
- normal and fallback photo fixture paths
- KO/EN UI action fixture paths
- current-product case fixture paths and expected outcomes
- stable selectors and route paths

Storage states must originate from an actual Google OAuth login on the selected Preview origin. A storage state from another origin, anonymous account, or personal account is invalid.

## Execution order

```text
npm run verify:premium-hosted-preview-contract
npm run verify:premium-hosted-preview-preflight
npm run verify:premium-hosted-preview-ui
npm run verify:premium-browser-journey
npm run verify:premium-hosted-preview-db
```

The first Critical or Important failure stops the run. Do not patch the Preview or weaken assertions inside the same run.

## Required lanes

- preflight
- google-login
- premium-entry
- ko-normal
- en-normal
- selected-product
- not-in-db
- selected-plus-not-in-db
- photo-fallback
- persistence
- finalized-conflict
- session-rotation
- unauthenticated
- forbidden
- ownership
- safe-5xx

The API lifecycle verifier from the previous step supplies persistence, conflict, rotation, and unauthenticated evidence. The UI verifier supplies OAuth-session persistence, Premium entry, localized projection, product-state, and fallback evidence. The final verdict must combine all lanes; missing evidence is failure.

## Evidence

```text
tmp/premium-hosted-preview-verification/<run-id>/
  run-manifest.json
  preflight.json
  lane-results.json
  persistence-evidence.json
  invariant-verdict.json
  summary.md
```

Screenshots and network summaries may be retained only when they have been redacted. The artifact set must not contain credentials, cookies, authorization values, email addresses, raw photo data, or complete report payloads.

## Cleanup

Cleanup is separate from verification and requires:

```text
PREMIUM_HOSTED_CLEANUP_CONFIRMATION=DELETE_HOSTED_TEST_ROWS:<run-id>
PREMIUM_HOSTED_CLEANUP_EVIDENCE_PATH=<persistence-evidence.json>
```

Only saved-report IDs listed in the verified evidence file may be deleted, using the same dedicated account under RLS. No service-role broad deletion is allowed.

## Pass rule

Step 10 passes only when every required lane passes, Critical and Important counts are zero, KO/EN canonical meaning is identical, source-session duplicates are zero, immutable rows remain unchanged, and the artifact secret scan passes. Production remains a separate explicit gate.
