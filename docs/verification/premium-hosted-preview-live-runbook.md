# Premium Hosted Preview Live Execution Runbook

## Scope

This runbook executes the live Hosted Preview gate for Draft PR #51. It does not authorize Production promotion, merge, runtime changes, DB schema/RLS/Auth-policy changes, service-role access, or broad deletion.

## Fixed identity

- Repository: `gycha0109-beep/K_beauty`
- Implementation PR: `#51`
- Implementation branch: `agent/premium-hosted-preview-harness-hardening`
- Design PR: `#44`
- Vercel team ID: `team_xuYA9OhCWlJETaYFOmeVodgS`
- Vercel project ID: `prj_VHh3BMegmXFGwxgOJLlgFQjksmKA`
- Environment: Preview only

The selected immutable deployment must be `READY`, non-Production, attached to PR #51, and built from the current PR #51 head SHA.

## Secure local workspace

All manifest, account registry, deployment attestations, storage states, tokens, photos, case fixtures, intermediate JSON, raw saved-report IDs, browser-journey evidence, and cleanup evidence must remain below `PREMIUM_HOSTED_SECURE_ROOT` in the OS temporary directory.

Recommended Windows path:

```text
%LOCALAPPDATA%\Temp\bejewely-premium-hosted\<run-id>
```

Required structure:

```text
<secure-root>/
  manifest.json
  credentials/
    deployment-attestation.json
    fault-preview-attestation.json
    account-a-storage-state.json
    account-a-login-evidence.json
    account-b-storage-state.json
    account-b-login-evidence.json
    preflight-result.json
    ui-result.json
    db-result.json
    error-result.json
    ui-created-ids/
    browser-journey/<run-id>/
    cleanup-manifest.json
  fixtures/
    images/
    cases/
  artifacts/
```

Do not use the repository directory, OneDrive, Dropbox, Google Drive, or another synchronized folder.

## Required inputs

1. Permanent Google Account A with Premium access.
2. Permanent Google Account B without Premium access.
3. Different SHA-256 user-ID hashes for A and B.
4. Public Supabase URL and anon key for the Preview project.
5. Supabase project ref and exact catalog hash.
6. Synthetic normal and fallback photos.
7. Seven `premium-hosted-ui-case-v2` fixtures.
8. Browser finalized-conflict body fixture.
9. A separate non-Production Fault Preview.
10. Authoritative GitHub/Vercel deployment IDs for both Preview deployments.

Never commit account emails, passwords, tokens, cookies, OAuth codes, storage state, raw UUIDs, full Premium reports, or source-session IDs.

## Base environment

```powershell
$env:PREMIUM_HOSTED_RUN_ID = "live-<timestamp>"
$env:PREMIUM_HOSTED_PR_NUMBER = "51"
$env:PREMIUM_HOSTED_ENVIRONMENT = "preview"
$env:PREMIUM_HOSTED_BASE_URL = "https://<immutable-deployment-host>"
$env:PREMIUM_HOSTED_EXPECTED_HOST = "<immutable-deployment-host>"
$env:PREMIUM_HOSTED_EXPECTED_SHA = "<current-pr-51-head>"
$env:PREMIUM_HOSTED_DEPLOYMENT_SHA = "<current-pr-51-head>"
$env:PREMIUM_HOSTED_SECURE_ROOT = "<secure-root>"
$env:PREMIUM_HOSTED_MANIFEST_PATH = "<secure-root>\manifest.json"
$env:PREMIUM_HOSTED_SUPABASE_URL = "https://<project-ref>.supabase.co"
$env:PREMIUM_HOSTED_SUPABASE_ANON_KEY = "<public-anon-key>"
$env:PREMIUM_HOSTED_PREVIEW_BYPASS_TOKEN = "<optional-vercel-preview-bypass-token>"
$env:PREMIUM_HOSTED_FAULT_PREVIEW_BYPASS_TOKEN = "<optional-fault-preview-bypass-token>"
```

`PREMIUM_HOSTED_PR_NUMBER` is mandatory. The verifier must never default to an older stacked PR.

## Execution order

1. Confirm PR #51 is Open, Draft, and unmerged.
2. Record the current exact PR head.
3. Obtain an immutable READY Preview for that exact head.
4. Generate authenticated GitHub/Vercel attestations for the main and Fault Preview deployments.
5. Run the hardening contract verifier before credential access.
6. Capture Account A and Account B through separate headed Google-login runs.
7. Run preflight.
8. Run the seven UI/canonical-correlation cases.
9. Run the authenticated browser journey with all browser artifacts rooted under `credentials/browser-journey`.
10. Build DB evidence from the secure browser persistence file and the seven secure UI-created-ID files.
11. Run unauthenticated, forbidden, ownership, and isolated Fault Preview lanes.
12. Run the final gate using only result files under `credentials`.
13. Inspect the redacted final artifacts.
14. Request explicit cleanup approval.

## Contract and login commands

```text
npm ci
npm run verify:premium-hosted-preview-harness-hardening
npm run verify:premium-hosted-preview-contract
npm run generate:premium-hosted-preview-attestation
npm run capture:premium-hosted-preview-login
```

Run login capture once with `PREMIUM_HOSTED_LOGIN_ACCOUNT=A` and once with `B`. Google OAuth and any 2FA interaction are completed directly by the user in the headed browser.

Access and refresh tokens resolved from the validated storage states may exist only in process memory. Do not copy them into the manifest, command history, result JSON, or final artifacts.

## Evidence commands

```text
npm run verify:premium-hosted-preview-preflight
npm run verify:premium-hosted-preview-ui
npm run verify:premium-browser-journey
npm run verify:premium-hosted-preview-db
npm run verify:premium-hosted-preview-errors
npm run verify:premium-hosted-preview-gate
```

The gate additionally requires these secure input paths:

```text
PREMIUM_HOSTED_PREFLIGHT_RESULT_PATH
PREMIUM_HOSTED_UI_RESULT_PATH
PREMIUM_HOSTED_DB_RESULT_PATH
PREMIUM_HOSTED_ERROR_RESULT_PATH
PREMIUM_HOSTED_BROWSER_STEPS_PATH
PREMIUM_HOSTED_BROWSER_MANIFEST_PATH
PREMIUM_HOSTED_BROWSER_VERDICT_PATH
```

The browser journey must write its `run-manifest.json`, `browser-steps.json`, `persistence-evidence.json`, and `invariant-verdict.json` beneath `credentials/browser-journey/<run-id>`. They are sensitive intermediate evidence, not distributable artifacts.

A complete successful run creates exactly eleven Account-A test rows:

- seven UI/canonical-correlation rows;
- four authenticated browser-journey rows.

Raw IDs are retained only in the secure cleanup manifest. Final artifacts contain hashes only.

## Stop conditions

Stop without weakening the verifier when any of the following occurs:

- configured PR, attested PR, GitHub deployment SHA, and Vercel source SHA differ;
- the target is Production, non-READY, mutable, or redirects to another origin;
- account identity, permanence, Google provider, entitlement separation, or user hash fails;
- manifest, attestation, fixture, result, storage-state, or cleanup paths escape the secure root;
- a fixture symlink or upload escapes the fixture root;
- canonical paths, types, reason codes, or request correlation fail;
- KO/EN semantic fingerprints differ;
- a required lane or exact browser step is missing, duplicated, non-passed, or from another run;
- DB evidence does not contain all eleven current-run rows;
- artifacts contain credentials, email addresses, raw UUIDs, data URLs, or full reports;
- cleanup scope includes any row not produced, owned, and attested by the current run.

## Cleanup

Cleanup is a separate user-approved action. It consumes only the hash-pinned secure cleanup manifest and deletes exactly the eleven current-run Account-A rows through normal RLS.

Required variables:

```text
PREMIUM_HOSTED_CLEANUP_MANIFEST_PATH=<secure-root>/credentials/cleanup-manifest.json
PREMIUM_HOSTED_CLEANUP_MANIFEST_SHA256=<hash emitted by DB evidence>
PREMIUM_HOSTED_CLEANUP_CONFIRMATION=DELETE_HOSTED_TEST_ROWS:<run-id>
```

Command:

```text
npm run cleanup:premium-hosted-preview
```

No wildcard, date-range, owner-wide, source-wide, or service-role deletion is allowed. The credentials directory is removed only after every deletion is observed successfully.
