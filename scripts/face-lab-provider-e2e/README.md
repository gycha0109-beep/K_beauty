# Face Lab Provider E2E

This package runs the final bounded Provider smoke for the unified Vision pipeline on a GitHub-hosted runner.

## Execution model

1. Text-only OpenAI credential preflight.
2. Lane B: one `lower_face_occlusion` image request through an ephemeral localhost-only canonical harness.
3. Lane A: one `frontal_clear` image request through the real `/api/analyze` route backed by the isolated Local Supabase Replay workspace.
4. Sanitized report generation and mandatory cleanup.

The run permits at most two image-bearing Provider attempts and performs no automatic retry.

## Temporary harness readiness

Lane B uses a temporary, untracked App Router handler at:

```text
app/api/face-lab-provider-e2e-harness/route.js
/api/face-lab-provider-e2e-harness
```

The runner materializes this non-private segment before starting the localhost Next.js server. A token-protected `GET` must return an empty `204` response with `Cache-Control: no-store` before the text-only Provider preflight or either image lane can run. Production mode or a disabled E2E flag returns `404`; an invalid ephemeral token returns `403`. The readiness request does not read a fixture, access Supabase, or call the Provider.

The route contract can be verified locally without secrets, fixtures, Provider calls, or Supabase:

```text
npm run face-lab:e2e:verify-harness
```

This mode selects an available localhost port unless `FACE_LAB_PROVIDER_E2E_PORT` or `--port` supplies a validated port from `1024` through `65535`. Both the canonical temporary route and the legacy private `app/api/__face-lab-provider-e2e` directory are removed during cleanup and must remain untracked.

## Required repository secrets

- `OPENAI_API_KEY`: the configured OpenAI project key used only inside the Actions job.
- `FACE_LAB_E2E_FIXTURE_PASSPHRASE`: the passphrase used to decrypt the fixture bundle.

Neither secret value is recorded in documentation, logs, command-line arguments, or repository files. The workflow never prints the OpenAI key value, key prefix, authorization header, request body, raw Provider response, image bytes, decrypted archive, or credential fingerprint.

## Fixture bundle

The workflow reads one encrypted binary file:

```text
private/face-lab-e2e/fixture-bundle-v3.tar.gz.enc
```

Its required size is `3094224` bytes and SHA-256 is:

```text
3d7c888484c36b7f0293b8037d842b98cbc11ca4bcd6c28d136aef01222b935f
```

The archive uses AES-256-CBC with salt, PBKDF2, and `iter 210000`. After decryption it must contain exactly:

```text
manifest.local.json
private/face-lab-fixtures/subject-a/frontal-clear.png
private/face-lab-fixtures/subject-a/lower-face-occluded.png
```

Plaintext fixtures are never stored in Git. They exist only in the Actions workspace and are removed during mandatory cleanup; the encrypted fixture is also removed from the runner workspace after use. The encrypted bytes are committed solely for this bounded E2E run, and Git history can retain encrypted data even after later removal.

Archive validation permits exactly three regular files. Tar archives may contain directory entries, but only the exact ancestor scaffolding (`.`, `private`, `private/face-lab-fixtures`, and `private/face-lab-fixtures/subject-a`) is allowed; directory entries are optional. Symlinks, hardlinks, devices, FIFOs, traversal paths, backslash paths, duplicate members, and every non-allowlisted member are rejected. The runner does not restore archive owner, mode, or mtime metadata: after full validation, it streams only the three expected files to newly created targets.

This replacement bundle was rebuilt with exactly the three allowlisted regular files and no directory entries. Its encrypted binary, size, and SHA-256 therefore replace the earlier v3 values while the file path, encryption algorithm, KDF, iteration count, two-image maximum, and zero automatic retries remain unchanged. The preceding run `30205374997` failed before the Provider and made zero image-bearing attempts. This trigger change creates one new first attempt.

Run `30207202041` subsequently passed the encrypted input, decryption/member, and Local Supabase gates but received HTTP `404` from Lane B before any Provider image usage event. The cause was the legacy temporary segment beginning with `__`, which Next.js treated as a private folder and excluded from routing. The routable segment and non-Provider readiness probe fix that boundary without changing the encrypted fixture, Secret, production routes, Provider runtime contract, attempt budget, or retry policy.

The workflow starts only when this marker is pushed after all required secrets are configured:

```text
private/face-lab-e2e/run.trigger
```

## Commands

```text
npm run face-lab:e2e:verify
npm run face-lab:e2e:verify-harness
npm run face-lab:e2e:run -- --manifest manifest.local.json
```

`face-lab:e2e:run` refuses remote Supabase URLs, creates a temporary development-only route, binds Next.js to `127.0.0.1`, and removes the route before exit.
