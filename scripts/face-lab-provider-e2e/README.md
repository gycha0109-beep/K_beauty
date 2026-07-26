# Face Lab Provider E2E

This package separates deterministic Vision contract verification from one bounded actual Provider smoke.

## Verification model

Provider-free checks remain authoritative for projection, schema, locale, and eligibility behavior:

```text
npm run verify:unified-vision-pipeline
npm run face-lab:eval:verify
npm run architecture:guard
```

The actual smoke runs only in GitHub Actions with isolated Local Supabase and the real Next application. It sends one `subject-a-frontal-clear` image to the production `POST /api/analyze` route exactly once. There is no temporary Route Handler, Lane B, harness readiness API, or text Provider preflight. Automatic retry is zero.

The runner checks server readiness through the existing public `GET /` route. This readiness request reads no fixture, calls no Provider, and performs no database mutation. After readiness, the runner prepares one multipart `/api/analyze` request with the production survey fields and an `Idempotency-Key`.

Request dispatch is recorded immediately before `fetch()`, so a fetch exception cannot incorrectly report zero dispatched requests. The report distinguishes:

- request preparation;
- request dispatch;
- HTTP response receipt and status;
- response-contract success;
- response-reported image Provider attempts;
- the existing `[vision-observation-usage]` event;
- automatic retry count.

The production route can perform its existing optional image-free product-explanation call after successful Vision analysis. The smoke does not add, retry, or modify that behavior. The canonical Vision service remains the only image-bearing Provider execution site.

Before that Provider smoke, the workflow runs a Provider-free anonymous write-grant gate against isolated Local Supabase:

```text
npm run anonymous-write-grant:runtime:verify
```

The gate canonicalizes a realistic synthetic free result (including bounded `imageEligibility`). Before creating rows, it polls a no-write invalid call with `p_grants: []` for at most 60 seconds at one-second intervals. SQLSTATE `22023` is the readiness signal: PostgREST can see the exact RPC and the function rejected the invalid array before its insert loop. Only schema-cache/network readiness states are rechecked; authentication, permission, or unexpected function-contract results fail immediately.

After visibility is confirmed, the gate calls the service-role-only `create_anonymous_write_grants` RPC with the real synthetic pair exactly once. It verifies exactly `result:create` and `track:create`, deletes the synthetic rows, and confirms zero rows remain. Actual grant creation is never retried. It rejects non-local Supabase URLs and never uses an image, fixture, Provider, production data, or a Repository Secret.

The sanitized `anonymous-grant-preflight-v1` diagnostic records only the visibility attempt count, bounded safe error code, actual-create attempt count, created/row/cleanup counts, and fixed failure markers. It never records URLs, credentials, tokens, identifiers, row bodies, or raw database error text. The same gate runs in Local Supabase Replay Guard and before the Provider smoke.

Run `30211073388` passed Local Supabase reset and masked runtime export, then stopped at the prior generic `anonymous_grant_rpc_failed` marker. The actual `/api/analyze` step was skipped, Provider text/image calls were zero, automatic retries were zero, and cleanup passed. Local execution and the exact-head Replay Guard passed, so immediate PostgREST RPC visibility after `db reset` is the probable boundary, not yet a confirmed root cause. The visibility diagnostic in the next Provider-free Replay Guard run is the deciding evidence. No migration, RPC body/signature, permission, RLS policy, Secret, fixture, or Provider request contract is changed by this readiness boundary.

## Sanitized report

The report uses:

```text
schemaVersion: face-lab-provider-e2e-report-v2
mode: actual-api-analyze-single-image
```

It records booleans and bounded machine-readable status only. It never stores image bytes, base64, the manifest body, raw Provider request or response, API keys, Supabase credentials, write-grant token values, the actual Idempotency-Key, face evidence, or local absolute paths.

## Fixture bundle

The workflow reads the unchanged encrypted binary:

```text
private/face-lab-e2e/fixture-bundle-v3.tar.gz.enc
```

- Size: `3094224` bytes
- SHA-256: `3d7c888484c36b7f0293b8037d842b98cbc11ca4bcd6c28d136aef01222b935f`
- Encryption: AES-256-CBC with salt
- KDF: PBKDF2
- Iterations: `210000`

The decrypted archive contract remains exactly:

```text
manifest.local.json
private/face-lab-fixtures/subject-a/frontal-clear.png
private/face-lab-fixtures/subject-a/lower-face-occluded.png
```

Only `subject-a-frontal-clear` is used by this single-image smoke. The lower-face fixture remains in the encrypted bundle but is not dispatched. Plaintext fixtures are never tracked and are removed by mandatory cleanup.

Required Repository Secrets retain their existing names:

- `OPENAI_API_KEY`
- `FACE_LAB_E2E_FIXTURE_PASSPHRASE`

Secret values are never documented, printed, or placed on the command line.

## Prior harness result

Run `30208164340` passed fixture transport, Secret input gates, decryption/member validation, and Local Supabase. Its temporary harness readiness GET passed, its temporary POST returned a catch-all HTTP `502`, and the real `/api/analyze` route never ran. Because the temporary handler collapsed every internal exception into `provider_execution_failed`, that result is not classified as a production Provider failure.

The temporary harness design is retired rather than repaired. This push creates the first single-image execution through the actual `/api/analyze` route.

## Anonymous grant contract correction

Run `30209305514` successfully completed the image Vision Provider call and the existing product-explanation call, then returned HTTP `503 anonymous_write_grant_unavailable`. The failure was before grant RPC creation: the free response contained bounded `imageEligibility`, but the anonymous persistence top-level allowlist did not. Its fail-closed canonicalizer therefore returned `null`.

The persistence contract now includes only normalized `imageEligibility`; arbitrary nested fields are discarded, missing or malformed eligibility becomes the bounded invalid eligibility shape, and unrelated top-level response fields remain rejected. The route keeps the same external 503 contract while internally distinguishing invalid persistence payloads from grant issuance failures.

No migration, RPC permission, Secret, fixture, image-attempt budget, or automatic-retry policy changes are part of this correction. The image-bearing request maximum remains one and automatic retries remain zero.

Local Supabase Replay Guard run `30209306671` applied migrations and seed before timing out at the local Storage health/restart boundary. That result is not classified as a migration SQL or anonymous grant RPC failure.

## Commands

```text
npm run face-lab:e2e:verify
npm run face-lab:e2e:run -- --manifest manifest.local.json
```

The run command requires the bounded Actions environment. It must not be executed locally.
