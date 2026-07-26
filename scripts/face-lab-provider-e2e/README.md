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
- image-bearing Vision Provider calls;
- optional image-free product-explanation Provider calls;
- text preflight calls and unexpected Provider stages;
- automatic retry count.

The production route can perform its existing optional image-free product-explanation call after successful Vision analysis. The smoke allows at most one such call, requires exactly one image-bearing Vision call, rejects any unexpected Provider stage, and requires text preflight calls and automatic retries to remain zero. It does not add, retry, or modify production Provider behavior. The canonical Vision service remains the only image-bearing Provider execution site.

There is no separate synthetic anonymous-grant preflight, RPC visibility poll, or readiness verifier. Local Supabase Replay Guard remains responsible for migration replay, database lint, and anonymous product-boundary checks; it does not duplicate the product write-grant flow.

The single actual smoke is the write-grant verification path:

```text
encrypted fixture
-> isolated Local Supabase start/reset
-> real Next application
-> one POST /api/analyze
-> production anonymous write-grant issuance
-> Face Lab semantic and response-header contract validation
-> sanitized report
-> fail-closed mandatory cleanup
```

The runner verifies presence—not values—of the result and track write-grant headers returned by the actual route. An actual `/api/analyze` PASS also requires an available Vision Face Lab envelope, passed eligibility, an available canonical analysis, a non-empty structured projection, at least one evidence-backed available Vision field, and `sourceImagePersisted === false`. Evidence text, observation names and values, structured content, and grant values are not reported.

`serverCleanupCompleted` covers only termination of the runner's Next child process. The workflow separately removes plaintext fixture inputs and the encrypted Actions copy, stops the isolated Local Supabase instance, writes a boolean-only `cleanup.json`, and fails the job if any mandatory cleanup result is false. Artifact upload runs afterward with `if: always()` so a cleanup failure remains observable without being converted to success.

Run `30212349131` was a PR merge-ref Replay Guard execution, not an exact-head replay. Its removed synthetic verifier failed before its visibility loop entered (`probeAttempts=0`), so that run did not observe a PostgREST schema-cache race or an RPC call.

## Sanitized report

The report uses:

```text
schemaVersion: face-lab-provider-e2e-report-v3
mode: actual-api-analyze-single-image
```

It records booleans, bounded counts, and machine-readable status only. Face Lab fields are limited to semantic booleans and the evidence-backed available-field count. Provider accounting separates image-bearing Vision calls, optional image-free explanation calls, text preflight calls, unexpected stages, and total observed Provider requests. It never stores image bytes, base64, the manifest body, raw Provider request or response, API keys, Supabase credentials, write-grant token values, the actual Idempotency-Key, face evidence, observation values, structured projection content, or local absolute paths.

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

The temporary harness design is retired rather than repaired. The current workflow uses the single-image execution through the actual `/api/analyze` route.

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
