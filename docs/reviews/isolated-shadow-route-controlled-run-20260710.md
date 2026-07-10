# Isolated Shadow Route Controlled Run Review

## Phase 43 Purpose

Phase 43 investigated the complete route dependency surface and added a fail-closed harness for the first controlled flag-off/flag-on shadow comparison. The harness sends no request unless local target, provider isolation, fixture, mutation observer, and cleanup gates all pass.

## Repository Structure Findings

`/api/analyze` performs multipart validation, claims the analysis guard, builds fallback or external photo evidence, reads recommendation products, runs the existing decision engine, creates a premium report session, completes the guard, and only then invokes the disabled shadow helper before returning the existing response.

The route mutation surface is:

- analysis guard rate-limit RPC;
- optional idempotency claim, complete, and fail RPCs;
- premium report session expiry deletion;
- premium report session insertion;
- development survey audit local file append;
- flag-on sanitized shadow artifact local file write.

No route call-graph Storage mutation was found. Product loading is read-only, but it requires the base `products` schema and scorer-compatible rows.

## Supabase Isolation Result

Supabase CLI and the Docker daemon are available. The repository has 23 migration files, including premium session and analysis guard objects. It does not have `supabase/config.toml`, a seed file, or a migration that creates `public.products`; the earliest product migration already alters that table.

The current configured hosted target is still `hosted_unknown`. It was not contacted or used. No local stack was started because the repository schema cannot be reproduced from a fresh database without inventing a missing base migration.

## External Provider Isolation

The route has a deterministic fallback when no API key resolves. However, the development key resolver reads `.env.local` when the process key is absent or different. A key name is present in the local env file, and there is no existing provider test adapter. Clearing child-process env alone therefore cannot guarantee zero external provider calls.

No provider request was made. A future run needs approval for a minimal, default-off test-only provider isolation seam after the local schema blocker is repaired.

## Fixture Result

The Phase 42 payload is parseable and contains every required route form field. The repository PNG is synthetic and valid for MIME/size upload validation. It is not semantically suitable for face analysis, so it is usable only when the deterministic provider fallback is guaranteed.

## Mutation Observer Coverage

The new observer contract enumerates database RPC, premium session table, Storage, and local filesystem surfaces and defines identical-seed normalized comparison. It is not installed because there is no reproducible local database. Coverage is `incomplete`; baseline and flag-on mutation summaries and deltas remain unmeasured (`null`).

## Cleanup Contract

The teardown helper only removes an explicitly marked Phase 43 run directory under the isolated tmp root. No local database, Storage object, server, or run directory was created, so teardown completed as an idempotent no-resource cleanup. Full reset/cleanup verification remains blocked until a reproducible local environment exists.

## Controlled Run Result

- route invoked: false
- hosted unknown target used: false
- external production provider invoked: false
- database command executed: false
- Supabase write executed: false
- flag-off execution: not attempted
- flag-on execution: not attempted
- response comparison: not measured
- recommendation comparison: not measured
- database and Storage deltas: not measured
- shadow artifact validation: not measured

`finalStatus: blocked_local_schema_not_reproducible`

The primary blocker is the missing base product schema/config needed for a clean local reset. Secondary blockers are the missing provider isolation seam, uninstalled mutation observer, and cleanup verification against real isolated resources.

## Next Runtime Gate

Do not attempt the route until the repository can reproduce a loopback Supabase stack and an approved test-only provider seam guarantees zero external calls. After those repairs, install the ephemeral observer, verify cleanup twice, then rerun this harness.

“이 검증은 disabled shadow dry-run 배선의 격리 실행 검증이며, evaluator 또는 CandidatePolicy runtime 정책 연결 승인이 아니다.”
