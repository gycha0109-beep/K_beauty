# Face Lab Provider E2E

This package runs the final bounded Provider smoke for the unified Vision pipeline on a GitHub-hosted runner.

## Execution model

1. Text-only OpenAI credential preflight.
2. Lane B: one `lower_face_occlusion` image request through an ephemeral localhost-only canonical harness.
3. Lane A: one `frontal_clear` image request through the real `/api/analyze` route backed by the isolated Local Supabase Replay workspace.
4. Sanitized report generation and mandatory cleanup.

The run permits at most two image-bearing Provider attempts and performs no automatic retry.

## Required repository secrets

- `OPENAI_API_KEY`: the configured OpenAI project key used only inside the Actions job.
- `FACE_LAB_E2E_FIXTURE_PASSPHRASE`: the passphrase used to decrypt the fixture bundle.

Neither secret value is recorded in documentation, logs, command-line arguments, or repository files. The workflow never prints the OpenAI key value, key prefix, authorization header, request body, raw Provider response, image bytes, decrypted archive, or credential fingerprint.

## Fixture bundle

The workflow reads one encrypted binary file:

```text
private/face-lab-e2e/fixture-bundle-v3.tar.gz.enc
```

Its required size is `3210944` bytes and SHA-256 is:

```text
739365fe304253c3213100440a8894797e330cbe4081b3483c2493770b3eb658
```

The archive uses AES-256-CBC with salt, PBKDF2, and `iter 210000`. After decryption it must contain exactly:

```text
manifest.local.json
private/face-lab-fixtures/subject-a/frontal-clear.png
private/face-lab-fixtures/subject-a/lower-face-occluded.png
```

Plaintext fixtures are never stored in Git. They exist only in the Actions workspace and are removed during mandatory cleanup; the encrypted fixture is also removed from the runner workspace after use. The encrypted bytes are committed solely for this bounded E2E run, and Git history can retain encrypted data even after later removal.

The workflow starts only when this marker is pushed after all required secrets are configured:

```text
private/face-lab-e2e/run.trigger
```

## Commands

```text
npm run face-lab:e2e:verify
npm run face-lab:e2e:run -- --manifest manifest.local.json
```

`face-lab:e2e:run` refuses remote Supabase URLs, creates a temporary development-only route, binds Next.js to `127.0.0.1`, and removes the route before exit.
