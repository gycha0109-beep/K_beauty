# Isolated Shadow Route Execution Runbook

## Purpose

This runbook defines the fail-closed execution sequence for the first controlled flag-off and flag-on `/api/analyze` comparison. It does not authorize production access or runtime policy integration.

## Current Gate Result

The current checkout is not executable as a fresh local environment:

- Supabase CLI and the Docker daemon are available.
- `supabase/config.toml` and `supabase/seed.sql` are absent.
- The migration set alters `public.products` but does not create that base table.
- The development provider resolver can read `OPENAI_API_KEY` from `.env.local` when process env is cleared.
- The mutation observer contract exists, but no local audit observer can be installed until the schema is reproducible.

The current hosted target remains classified as `hosted_unknown` and must not be used.

## Required Repairs Before Execution

1. Provide an approved, repository-owned local Supabase config.
2. Provide a reproducible base migration that creates every route dependency, including the product source schema. Do not patch historical migrations only for this test.
3. Provide an approved default-off test seam that guarantees external provider invocation count zero in development.
4. Add an idempotent synthetic seed for scorer-compatible rows without copying real product data.
5. Install a test-only local mutation observer outside production migrations.
6. Verify reset, storage cleanup, artifact cleanup, and server shutdown twice.

## Mutation Surface

The observer must cover:

- rate-limit and idempotency RPC operations;
- premium session expiry deletion and session insertion;
- any local Storage mutation found after local startup;
- local survey audit output separately from database mutations;
- local shadow artifact output separately from database and Storage mutations.

Each run must start from the same seed. Comparison stores only surface, operation, normalized row identity, and count. Timestamps, generated identifiers, and session tokens are excluded.

## Controlled Run Sequence

1. Assert that the selected target is loopback and that the hosted target is unused.
2. Reset local Supabase from repository migrations and the approved synthetic seed.
3. Install the ephemeral mutation observer and verify complete coverage.
4. Start a dedicated development process with external provider calls disabled by the approved seam.
5. Run the flag-off request with the repository fixture.
6. Save only sanitized response shape, recommendation identifiers/order, mutation counts, and artifact count.
7. Stop the process and fully reset the local database, Storage, and run artifact directory.
8. Start a second process with `DEV_ONLY_SHADOW_BOUNDARY_DRY_RUN=1` and otherwise identical env.
9. Run the identical request and collect the same sanitized evidence.
10. Compare response shape, recommendation order, database delta, Storage delta, and shadow artifact safety.
11. Turn the flag off, stop all test processes, reset local state, and verify cleanup.

## Pass Criteria

- HTTP status, response shape, and shape hash are identical.
- `topPick`, `supportingProducts`, and `budgetAlternatives` identifiers and order are identical.
- Shadow-added database and Storage mutation deltas are zero.
- Flag-off creates no shadow artifact; flag-on creates only the expected sanitized local artifact.
- Artifact schema validation passes and forbidden-field detection is false.
- External production provider invocation count is zero.
- Cleanup succeeds and is idempotent.

## Rollback

Turn the shadow flag off, disable the artifact writer, stop the test server, reset the local database, clear the isolated local Storage objects and run directory, then rerun the static guards and comparison verifier. Any cleanup failure blocks another route attempt.

This runbook is not approval for evaluator or CandidatePolicy runtime integration.
