# Premium Hosted Preview Live Execution Runbook

## Scope

This runbook prepares and executes the live Hosted Preview gate for Draft PR #51. It does not authorize Production promotion, runtime changes, DB schema/RLS/Auth policy changes, service-role access, broad deletion, or merge.

## Fixed repository and Vercel identity

- Repository: `gycha0109-beep/K_beauty`
- Implementation PR: `#51`
- Implementation branch: `agent/premium-hosted-preview-harness-hardening`
- Design PR: `#44`
- Vercel team ID: `team_xuYA9OhCWlJETaYFOmeVodgS`
- Vercel project ID: `prj_VHh3BMegmXFGwxgOJLlgFQjksmKA`
- Environment: Preview only

The execution target must be an immutable Vercel deployment URL whose authenticated metadata reports:

- `READY`
- target is not Production
- GitHub repository is `gycha0109-beep/K_beauty`
- GitHub PR is `51`
- GitHub commit SHA equals the current PR #51 head
- Vercel project ID equals `prj_VHh3BMegmXFGwxgOJLlgFQjksmKA`

## Local-only directory

All credentials, storage states, account registry data, generated attestation, photos, fixture cases, result JSON, and cleanup evidence must remain under the OS temporary directory selected by `PREMIUM_HOSTED_SECURE_ROOT`.

Do not place these files in the repository, OneDrive, Dropbox, Google Drive, or another synchronized folder.

Recommended Windows location:

```text
%LOCALAPPDATA%\Temp\bejewely-premium-hosted\<run-id>
```

## Required local inputs

1. Permanent Google Account A with Premium access.
2. Permanent Google Account B without Premium access.
3. SHA-256 user-ID hashes for A and B. The hashes must differ.
4. Public Supabase URL and anon key for the Preview project.
5. Supabase project ref extracted from the public URL.
6. A catalog hash produced from the exact catalog snapshot used by the Preview.
7. One synthetic normal photo and one synthetic fallback photo.
8. UI fixture JSON files using `premium-hosted-ui-case-v2`.
9. A separate non-Production Fault Preview.

Never commit account emails, passwords, access tokens, refresh tokens, cookies, OAuth codes, full storage state, raw UUIDs, full Premium reports, or source-session IDs.

## Preparation order

1. Confirm PR #51 is Open, Draft, and unmerged.
2. Record the exact PR #51 head SHA.
3. Select the immutable READY Preview for that SHA.
4. Generate authoritative deployment attestation with authenticated GitHub and Vercel APIs.
5. Create the local manifest from `manifest.example.json`.
6. Run the contract verifier before reading any credential file.
7. Capture Account A Google login.
8. Capture Account B Google login.
9. Run preflight.
10. Run UI, browser journey, DB evidence, error-boundary, and final-gate verifiers.
11. Review artifacts and secret scan.
12. Request explicit approval before cleanup.

## Environment skeleton

```powershell
$env:PREMIUM_HOSTED_RUN_ID = "live-<timestamp>"
$env:PREMIUM_HOSTED_PR_NUMBER = "51"
$env:PREMIUM_HOSTED_ENVIRONMENT = "preview"
$env:PREMIUM_HOSTED_BASE_URL = "https://<immutable-deployment-host>"
$env:PREMIUM_HOSTED_EXPECTED_HOST = "<immutable-deployment-host>"
$env:PREMIUM_HOSTED_EXPECTED_SHA = "<current-pr-51-head>"
$env:PREMIUM_HOSTED_DEPLOYMENT_SHA = "<current-pr-51-head>"
$env:PREMIUM_HOSTED_MANIFEST_PATH = "<secure-root>\manifest.json"
$env:PREMIUM_HOSTED_SECURE_ROOT = "<secure-root>"
$env:PREMIUM_HOSTED_SUPABASE_URL = "https://<project-ref>.supabase.co"
$env:PREMIUM_HOSTED_SUPABASE_ANON_KEY = "<public-anon-key>"
```

`PREMIUM_HOSTED_PR_NUMBER` is mandatory. The verifier must not infer or default to an older stacked PR because the selected deployment must be bound to the current implementation PR and exact head.

Attestation generation additionally requires authenticated GitHub and Vercel API credentials supplied only through the process environment. Do not write them into the manifest.

## Verification commands

```text
npm ci
npm run verify:premium-hosted-preview-harness-hardening
npm run verify:premium-hosted-preview-contract
npm run generate:premium-hosted-preview-attestation
npm run capture:premium-hosted-preview-login
npm run verify:premium-hosted-preview-preflight
npm run verify:premium-hosted-preview-ui
npm run verify:premium-browser-journey
npm run verify:premium-hosted-preview-db
npm run verify:premium-hosted-preview-errors
npm run verify:premium-hosted-preview-gate
```

Account A and B login capture are separate headed-browser runs. The user must complete Google login and any 2FA interaction directly in the browser.

## Mandatory stop conditions

Stop without weakening the verifier when any of the following occurs:

- Preview metadata does not match the current PR #51 head.
- configured PR number, attested PR number, deployment SHA, and Vercel source SHA do not all agree.
- target is Production or the immutable host redirects to another origin.
- Account A/B identity, permanence, provider, hash, or separation fails.
- fixture path escapes the fixture root.
- canonical response fields are missing or invalid.
- KO/EN semantic fingerprints differ.
- any required lane is missing, duplicated, blocked, unknown, partial, not run, or failed.
- artifacts contain credentials, email addresses, raw UUIDs, data URLs, or full reports.
- cleanup scope contains an ID not produced and attested by the current run.

## Cleanup

Cleanup is a separate, explicitly approved action. It may delete only the saved report IDs listed in the current run's validated persistence evidence and owned by Account A under normal RLS.

Required confirmation format:

```text
DELETE_HOSTED_TEST_ROWS:<run-id>
```

No wildcard, date-range, owner-wide, source-wide, or service-role deletion is allowed.
