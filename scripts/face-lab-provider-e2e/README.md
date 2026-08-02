# Face Lab Provider E2E

This package separates deterministic Vision contract verification from one bounded actual Provider smoke.

## Execution policy

The workflow is present on `main` so it can be selected for manual dispatch. Automatic trigger-file pushes are accepted only from `provider-validation/face-lab`. Feature, integration, and ordinary release branches cannot trigger the Provider job by push.

The current integration task does not create the validation branch or execute this workflow.

## Provider-free authority

The following checks cover schema, projection, eligibility, logging, and architecture without an external Provider call:

```text
npm run verify:unified-vision-pipeline
node scripts/verify-face-lab-observation-contract.mjs
node scripts/verify-image-analysis-eligibility.mjs
node scripts/verify-face-lab-failure-and-legacy-contract.mjs
npm run architecture:guard
```

They do not replace the live endpoint/model response check.

## Bounded actual smoke

The actual smoke runs only in GitHub Actions with isolated Local Supabase and the real Next application. It sends one `subject-a-frontal-clear` image to production `POST /api/analyze` exactly once. There is no temporary Route Handler, text Provider preflight, or automatic retry.

The runner checks readiness through public `GET /`, prepares one multipart request with an `Idempotency-Key`, and records request dispatch immediately before `fetch()`. A successful result requires:

- exactly one image-bearing Vision Provider request;
- no text preflight and no unexpected Provider stage;
- at most one existing optional image-free product-explanation request;
- a valid response envelope and write-grant header presence;
- passed image eligibility and evidence-backed Face Lab projection;
- `sourceImagePersisted === false`;
- sanitized report output and fail-closed cleanup.

Evidence text, observation names or values, structured projection content, grant values, and source images are not reported.

## Fixture boundary

The workflow reads the unchanged encrypted binary:

```text
private/face-lab-e2e/fixture-bundle-v3.tar.gz.enc
```

- Size: `3094224` bytes
- SHA-256: `3d7c888484c36b7f0293b8037d842b98cbc11ca4bcd6c28d136aef01222b935f`
- Encryption: AES-256-CBC with PBKDF2, `210000` iterations

The decrypted archive is allowlisted to:

```text
manifest.local.json
private/face-lab-fixtures/subject-a/frontal-clear.png
private/face-lab-fixtures/subject-a/lower-face-occluded.png
```

Only the frontal fixture is dispatched. Plaintext is never tracked and mandatory cleanup removes decrypted inputs, the Actions copy of the encrypted bundle, and the isolated Supabase instance before artifact upload.

Required Repository Secrets keep their existing names:

- `OPENAI_API_KEY`
- `FACE_LAB_E2E_FIXTURE_PASSPHRASE`

Secret values are never documented, printed, or placed on the command line.

## Sanitized artifact

The report uses schema `face-lab-provider-e2e-report-v3` and mode `actual-api-analyze-single-image`. It contains booleans, bounded counters, and machine-readable status only. Cleanup evidence is boolean-only. Artifact upload runs after mandatory cleanup with `if: always()`, so cleanup failure stays observable.

## Commands

```text
npm run face-lab:e2e:verify
npm run face-lab:e2e:run -- --manifest manifest.local.json
```

The run command requires the bounded Actions environment and must not be executed locally.
