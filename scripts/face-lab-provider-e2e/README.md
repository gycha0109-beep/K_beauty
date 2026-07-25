# Face Lab Provider E2E

This package runs the final bounded Provider smoke for the unified Vision pipeline on a GitHub-hosted runner.

## Execution model

1. Text-only OpenAI credential preflight.
2. Lane B: one `lower_face_occlusion` image request through an ephemeral localhost-only canonical harness.
3. Lane A: one `frontal_clear` image request through the real `/api/analyze` route backed by the isolated Local Supabase Replay workspace.
4. Sanitized report generation and mandatory cleanup.

The run permits at most two image-bearing Provider attempts and performs no automatic retry.

## Required repository secrets

- `FACE_LAB_E2E_OPENAI_API_KEY`: a non-production OpenAI project key.
- `FACE_LAB_E2E_FIXTURE_PASSPHRASE`: the passphrase used to encrypt the fixture bundle.

The workflow maps the OpenAI secret to `OPENAI_API_KEY` only inside the job. It never prints the value, key prefix, authorization header, request body, raw Provider response, image bytes, base64, or credential fingerprint.

## Fixture bundle

The workflow starts automatically when this encrypted file is pushed:

```text
private/face-lab-e2e/fixture-bundle.tar.gz.enc
```

After decryption, the archive must contain exactly:

```text
manifest.local.json
private/face-lab-fixtures/subject-a/frontal-clear.png
private/face-lab-fixtures/subject-a/lower-face-occluded.png
```

The plaintext manifest and images exist only in the Actions workspace and are removed during cleanup. The repository stores only the encrypted archive, which should be deleted from the branch after the run is recorded.

## Commands

```text
npm run face-lab:e2e:verify
npm run face-lab:e2e:run -- --manifest manifest.local.json
```

`face-lab:e2e:run` refuses remote Supabase URLs, creates a temporary development-only route, binds Next.js to `127.0.0.1`, and removes the route before exit.
