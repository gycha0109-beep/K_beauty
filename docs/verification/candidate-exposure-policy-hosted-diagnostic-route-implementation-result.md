# CandidateExposurePolicy Hosted Diagnostic Route Implementation Result

## Result

Stage 11K implements and reviews the temporary Preview-only synthetic CandidateExposurePolicy diagnostic route.

Current implementation head:

```text
branch: codex/candidate-exposure-policy-synthetic-diagnostic-route
head: a65ce96db2fc477fc00e5a4ab46f5ad0033631e8
Draft PR: #122
```

## Implemented and reviewed

- temporary `POST /api/internal/candidate-exposure-policy-diagnostic` route;
- `/api/analyze` remains unchanged and does not import the diagnostic route;
- Preview and Node production-runtime hard-disable before request-body reads;
- exact `VERCEL_GIT_COMMIT_SHA`, `VERCEL_DEPLOYMENT_ID`, execution-grant digest, and `VERCEL_URL` host binding;
- HMAC-SHA-256 authentication over method, path, immutable host, content type, timestamp, nonce, and exact body digest;
- 8 KiB request cap and 64 KiB response cap;
- strict flat JSON parsing and duplicate-key rejection;
- internal Stage 11F fixture selection only;
- control evaluator execution count zero;
- canary evaluator execution count one;
- aggregate-only response;
- explicit Production-alias absence evidence while Preview branch aliases remain permitted;
- diagnostic response Content-Type and `Cache-Control: no-store` enforcement;
- any `Set-Cookie` response fails closed;
- no database, storage, Provider, user session, cookie jar, runtime-log read, retry, or deployment mutation.

## Independent hardening review

Resolved after the original implementation review:

1. The signed request host is now bound to the runtime `VERCEL_URL` before body reads in the real exported route.
2. Preview branch aliases no longer count as Production aliases; the metadata capability must provide `productionAliasPresent: false`.
3. A response with an invalid content type, missing `no-store`, or any `Set-Cookie` cannot produce a successful diagnostic probe.
4. The execution checker fixtures now provide explicit Production-alias evidence and assert zero cookie contamination.

## Verification

```text
JavaScript syntax checks for modified route and adapter: PASS
Independent hardening smoke: PASS, 12 assertions
Vercel exact-SHA Preview deployment: READY
Vercel Next.js build: PASS
Build error log entries: 0
GitHub Actions runs: 0
Hosted diagnostic POST requests: 0
Production changes: 0
```

Exact Preview evidence:

```text
deployment: dpl_8idAKVyfnZVyKxPioczfSQdrpaQy
source SHA: a65ce96db2fc477fc00e5a4ab46f5ad0033631e8
target: null
state: READY
branch alias only
```

The original Stage 11K implementation checkers recorded 170 passing assertions before the follow-up hardening. Their fixtures have been aligned with the new fail-closed metadata contract, but the full repository checker suite was not executed through GitHub Actions in this stage.

## Not claimed

- Hosted CandidateExposurePolicy diagnostic execution PASS;
- `/api/analyze` integration PASS;
- end-to-end user analysis PASS;
- runtime activation;
- public traffic authorization;
- Production readiness;
- full security-closeout suite PASS after the final hardening commit.

## Current machine status

```text
temporary_synthetic_diagnostic_route_hardened_exact_sha_preview_build_pass_full_checker_execution_pending
```

## Authorization boundary

```text
Preview auto-deployment: authorized and completed
Vercel deployment inspection: completed
Hosted diagnostic execution: not performed
GitHub Actions: not run
/api/analyze modification: not authorized and not performed
runtime activation: not authorized
public traffic: not authorized
Production activation: not authorized
```

The route remains temporary and must be removed in a separately reviewed cleanup branch before integration toward `main`.
