# Premium Authenticated Runtime Journey Verification v1

## Purpose

This gate validates the deployed Premium lifecycle through Chromium. Its scope is the integration boundary around the deterministic engine: authentication, Premium-session creation, immutable persistence, saved-report reentry, finalized-snapshot rejection, rotation, and a second independent save.

It does not change engine behavior, database schema, RLS, payment, provider, UI, or deployment configuration.

## Mandatory coverage

Both Korean and English journeys execute the following sequence:

1. Reject an unauthenticated Premium request.
2. Open the explicitly selected deployment.
3. Run authenticated `/api/analyze`.
4. Verify the Premium cookie contract.
5. Verify the current session is unsaved before the first save.
6. Save the first `/api/full-report` result.
7. Compare the response fingerprint with the RLS-readable database row.
8. Verify report, snapshot, and Decision Bundle version separation.
9. Retry the identical request and receive the same immutable report.
10. Reopen the saved report with opposite locale and Top Pick tampering.
11. Submit a mandatory meaningful conflict fixture and receive HTTP 409.
12. Verify the database row and `updated_at` remain unchanged.
13. Verify current-session saved-report discovery.
14. Optionally verify mismatched Cookie and Bearer users fail closed.
15. Rotate the Premium session without exposing identifiers.
16. Save a second report under a distinct source-session tuple.
17. Verify the first report remains unchanged.
18. Verify duplicate Premium source-session tuples are zero.
19. Write redacted evidence artifacts.

## Fail-closed preconditions

Execution stops before the journey unless all mandatory preconditions hold:

- HTTPS root URL with no credentials, query, or fragment
- explicit environment classification
- exact expected host
- exact expected and deployed 40-character Git SHA values
- dedicated permanent Premium test account confirmation
- expected SHA-256 user ID hash
- cookie-backed Playwright storage state
- matching account access credential
- public Supabase endpoint configuration for RLS reads
- non-personal JPEG, PNG, or WEBP fixture up to 8 MB
- mandatory KO/EN conflict request fixture

Production additionally requires the exact confirmation value documented in the script. Preview protection may use a bypass credential supplied only through the execution environment.

## Required environment variable names

```text
PREMIUM_E2E_BASE_URL
PREMIUM_E2E_ENVIRONMENT
PREMIUM_E2E_EXPECTED_HOST
PREMIUM_E2E_EXPECTED_SHA
PREMIUM_E2E_DEPLOYMENT_SHA
PREMIUM_E2E_ACCESS_TOKEN
PREMIUM_E2E_EXPECTED_USER_ID_HASH
PREMIUM_E2E_SUPABASE_URL
PREMIUM_E2E_SUPABASE_ANON_KEY
PREMIUM_E2E_STORAGE_STATE_PATH
PREMIUM_E2E_IMAGE_PATH
PREMIUM_E2E_CONFLICT_BODY_PATH
PREMIUM_E2E_DEDICATED_ACCOUNT_CONFIRMATION
```

Optional second-account conflict coverage uses:

```text
PREMIUM_E2E_CONFLICT_ACCESS_TOKEN
PREMIUM_E2E_EXPECTED_CONFLICT_USER_ID_HASH
```

## Fixture contracts

The storage-state file must contain Supabase auth cookies for the dedicated test account. A stale Premium-report cookie is cleared before each locale journey.

The conflict-body file may contain one shared request object or separate `ko` and `en` objects. It must cause a meaningful snapshot difference for the selected deployment. Control and credential fields are rejected.

## Commands

```bash
npx playwright install chromium
npm run verify:premium-browser-journey-contract
npm run verify:premium-browser-journey
```

## Evidence artifacts

Each run creates a run-specific directory containing:

```text
run-manifest.json
browser-steps.json
response-contracts.json
persistence-evidence.json
invariant-verdict.json
summary.md
```

Artifacts contain target metadata, hashed account and session identifiers, response contracts, saved-report IDs, fingerprints, version metadata, timestamps, and verdicts. They exclude credentials, cookies, authorization headers, email addresses, raw photos, and full report bodies. A secret scan is mandatory.

## Failure taxonomy

```text
PRECONDITION_FAILURE
AUTH_BOUNDARY_FAILURE
SESSION_FAILURE
PERSISTENCE_FAILURE
IMMUTABILITY_FAILURE
REENTRY_FAILURE
LOCALE_AUTHORITY_FAILURE
INFRASTRUCTURE_FAILURE
HARNESS_FAILURE
```

Infrastructure and harness failures are not classified as product defects.

## Cleanup

The verifier does not delete data during evidence collection. Cleanup is a separate explicit command scoped to the exact saved-report IDs recorded by the run and the same hashed test account. Before deletion it checks target host, account ownership, UUID shape, Premium report type, and Premium-session source type. It records the result in `cleanup-result.json`.

## Promotion rule

Repository verification proves that the harness compiles and its pure contracts hold. Hosted Preview execution remains a separate gate requiring an explicitly selected deployment and dedicated test credentials. Production execution requires separate explicit approval and cannot be inferred from Preview success.
