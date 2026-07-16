# Premium Authenticated Browser Journey Verification v1

## Purpose

This gate validates the deployed Premium lifecycle through an actual Chromium browser context instead of source inspection alone.

The journey covers:

1. authenticated `/api/analyze` execution and Premium session-cookie creation
2. first `/api/full-report` save
3. identical retry returning the same immutable saved report
4. saved-report reopening with request tampering ignored
5. saved locale remaining authoritative
6. optional finalized-snapshot conflict verification
7. current-session saved-report discovery
8. safe session rotation
9. new session producing a different saved report

## Execution boundary

The verifier is intentionally not part of ordinary CI because it requires:

- a deployed URL
- a dedicated permanent test-account access token
- Premium creation permission for that account
- live Supabase route and session storage
- a Chromium installation

It must run only against an explicitly selected Preview or production-like environment. It must not reuse a personal account token.

## Required variables

```text
PREMIUM_E2E_BASE_URL
PREMIUM_E2E_ACCESS_TOKEN
```

Optional variables:

```text
PREMIUM_E2E_LOCALE=ko|en
PREMIUM_E2E_HEADLESS=0|1
PREMIUM_E2E_CONFLICT_BODY_JSON={...}
```

`PREMIUM_E2E_CONFLICT_BODY_JSON` must contain a request body that changes stable Premium report content. When omitted, the conflict step is reported as not checked; all other steps remain mandatory.

## Command

```bash
npx playwright install chromium
npm run verify:premium-browser-journey
```

## Assertions

The verifier fails unless all mandatory assertions hold:

- analyze returns HTTP 200
- exactly one `kbeauty_premium_report` cookie is present
- first full report returns a saved-report ID
- identical retry returns `existing` and the same ID
- saved reopen uses `source = saved-report`
- opposite request locale cannot change the saved locale
- request `topPick` is ignored during saved reopen
- current-session lookup returns the saved ID
- rotation returns `rotated = true` and `new_session_created`
- rotation JSON contains no session ID or token fields
- rotation replaces the Premium session cookie
- the new session creates a different saved-report ID

When conflict input is provided:

- changed finalized content returns HTTP 409
- the error is `premium_snapshot_finalized`
- a subsequent identical retry still resolves to the original saved-report ID

## Data handling

The journey creates saved reports for the dedicated test account. The verifier performs no automatic deletion because deletion would weaken the immutable-history evidence and introduces an additional destructive permission path. Test-account data retention and cleanup must be handled as an explicit separate operation.

## Promotion rule

Preview validation is a prerequisite for Hosted Preview acceptance. Production execution remains a separate explicit gate and must not be inferred from Preview success.
