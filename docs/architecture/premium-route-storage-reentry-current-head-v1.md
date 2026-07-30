# Premium Route / Storage / Reentry Current-Head Gate v1

## Status

Reviewed implementation design for Stage 9, stacked on Draft PR #92 exact head `697c7314ff52e16b9254bc8693e2f5fce7030009`.

This stage validates the deployed Preview integration boundary. It does not authorize Production deployment, runtime activation, schema changes, RLS changes, entitlement changes, OAuth changes, or permanent test accounts.

## Objective

Verify on one exact Git-generated Preview commit that the current Premium decision output can pass through the actual deployed Route / Storage / Reentry lifecycle without semantic drift or authorization failure:

1. create a deterministic server-side Premium report session;
2. save the report through `POST /api/full-report`;
3. confirm the stored immutable snapshot and ownership;
4. repeat the same request and receive the existing snapshot;
5. reopen the saved report by ID;
6. reject a meaningful finalized-snapshot change;
7. reject cross-account read and Cookie/Bearer principal conflict;
8. discover the saved report through the current session;
9. rotate the Premium session without exposing identifiers;
10. create a second independent saved report;
11. prove the first snapshot remains unchanged and source-session tuples remain unique;
12. delete all temporary rows, sessions, profiles, and Auth users and prove residue zero.

## Existing production boundary under test

The self-test must call the deployed HTTP routes rather than reimplement their decisions:

- `POST /api/full-report`
- `GET /api/full-report/session`
- `POST /api/full-report/session`

The temporary harness may use server-only Supabase Admin APIs only for fixture creation, independent DB evidence reads, and cleanup.

## Why `/api/analyze` is excluded

Stage 9 is Route / Storage / Reentry verification. Calling `/api/analyze` would add unrelated Provider, image, recommendation-source, throttling, and anonymous-persistence dependencies.

The temporary harness therefore creates a deterministic Premium session directly from the current decision-state entry point, then tests the actual deployed Route / Storage / Reentry boundary. Provider-backed and UI journeys remain Stage 10 concerns.

## Temporary Preview-only endpoint

A temporary endpoint is permitted only for the validation commit and must be removed after evidence capture.

### Activation conditions

The endpoint fails closed unless every condition is true:

- `VERCEL_ENV === "preview"`;
- `VERCEL_GIT_COMMIT_SHA` is a valid 40-character SHA;
- request query `expectedSha` exactly equals `VERCEL_GIT_COMMIT_SHA`;
- request query `run` is a valid UUID;
- request method is `POST`;
- Vercel Preview Protection authorizes the request;
- the run-derived temporary Account A does not already exist.

The unique run-derived Account A identity is the no-schema concurrency guard. A repeated or concurrent invocation with the same run ID fails during fixture creation before route persistence begins.

Production, local development, malformed SHA, malformed run ID, and duplicate execution return no test result and perform no application-route writes.

### Response contract

The response contains only:

- gate version;
- exact runtime SHA;
- run ID;
- redacted step names and HTTP statuses;
- counts and boolean invariants;
- report fingerprints and version strings;
- cleanup counts;
- final PASS/FAIL marker.

The response must not contain:

- email addresses;
- passwords;
- access or refresh tokens;
- cookies or signed session values;
- raw user IDs or session IDs;
- authorization headers;
- full report bodies;
- service-role or public keys.

## Test identities and cookie capture

The endpoint creates two random, email-confirmed, password-based Supabase Auth users through the server-only Admin API.

- Account A: `app_metadata.premium_entitlement = "admin_override"`
- Account B: same entitlement, different identity
- both use random unlogged credentials;
- both are deleted during cleanup;
- authorization decisions use `app_metadata`, not user-editable metadata.

A server-only `@supabase/ssr` client signs in each temporary user with a cookie adapter. The adapter captures the exact cookies emitted by the installed SSR library while the returned access token remains process-local.

This supports all three current principal cases without fabricating cookie encoding:

- Cookie A only;
- Bearer B only;
- Cookie A plus Bearer B conflict.

No token or cookie value is serialized.

## Deterministic report fixture

The fixture is built through `rebuildPremiumDecisionState()` from a minimal canonical report source containing:

- survey answers;
- concern scores and priority;
- empty current-product selections;
- explicit no-photo state;
- locale;
- full routine compatibility fields.

The fixture must contain a valid Decision Bundle and `freeResult` before session creation. No client-provided Premium payload is accepted.

## Hosted sequence

### A. Preconditions

1. Verify Preview/exact-SHA/run guards.
2. Verify Supabase Admin and public Auth configuration.
3. Create and sign in Accounts A and B; Account A uniqueness guards duplicate execution.
4. Capture Account A and B SSR auth cookies from the installed library.
5. Build the deterministic report.
6. Create Account A Premium session and retain only its signed cookie value in memory.

### B. Authorization and first persistence

1. Anonymous `POST /api/full-report` returns `401 login_required`.
2. Account A `GET /api/full-report/session` returns `hasSavedReport: false`.
3. Account A `POST /api/full-report` returns persistence `saved` and one saved-report ID.
4. Admin evidence read proves:
   - owner is Account A;
   - report type is `premium`;
   - source type is `premium_report_session`;
   - source session is present;
   - stored fingerprint equals the response fingerprint;
   - report, snapshot, and Decision Bundle versions are present and distinct.
5. Account A RLS read returns the row; Account B RLS read returns no row.

### C. Immutability and reentry

1. Repeat the identical request and receive persistence `existing` with the same ID and fingerprint.
2. Reopen by saved-report ID with opposite locale and tampered Top Pick input.
3. Stored locale and stored Top Pick remain authoritative.
4. Submit a meaningful current-product change after finalization.
5. Receive `409 premium_snapshot_finalized`.
6. Stored report content, fingerprint, and `updated_at` remain unchanged.

### D. Authorization isolation

1. Account B Cookie or Bearer cannot read Account A's saved-report ID.
2. Account A SSR auth cookie plus Account B Bearer token is rejected as `premium_principal_conflict`.
3. Rejected requests create no saved report and mutate no existing row.

### E. Rotation and second persistence

1. Current-session GET returns Account A's first saved-report ID.
2. Session POST rotates successfully and exposes none of `sessionId`, `premiumSessionToken`, or `accessToken`.
3. Set-Cookie contains a different Premium cookie value.
4. Second save returns `saved` with a different saved-report ID and source-session ID.
5. First report remains unchanged.
6. Duplicate `(user_id, source_type, source_session_id)` tuples equal zero.

### F. Cleanup

Cleanup executes in `finally` and is mandatory on both PASS and FAIL:

1. delete the exact saved-report IDs owned by Accounts A and B;
2. delete Premium session rows for the exact in-memory session IDs;
3. delete exact temporary profile rows;
4. delete Accounts A and B through `auth.admin.deleteUser`;
5. verify saved-report, session, profile, and Auth-user residue counts are zero.

A cleanup failure forces the overall verdict to FAIL.

## Review constraints

- no schema or migration;
- no RLS or policy changes;
- no Production URL or Production confirmation path;
- no environment-variable mutation;
- no OAuth configuration;
- no Provider call;
- no payment call;
- no existing user or report mutation;
- all delete queries are scoped to IDs created in the current process;
- endpoint is removed after evidence capture;
- final branch retains only durable documentation and network-free contract verification if useful.

## Verification gates

### Validation commit

- exact Git-generated Preview is READY;
- deployment metadata SHA equals validation commit SHA;
- temporary endpoint returns `STAGE_9_ROUTE_STORAGE_REENTRY_HOSTED_PASS`;
- cleanup residue is zero;
- runtime logs contain no unexpected 5xx for the test route sequence;
- JavaScript syntax, focused contract verifier, existing reentry/storage verifiers, architecture guard, optimized build, and diff hygiene pass.

### Final cleanup head

- temporary endpoint removed;
- temporary execution evidence removed or reduced to redacted PR metadata;
- no `postbuild`, workflow, runtime flag, test secret, credential, test account, or database residue remains;
- final diff is reviewed against PR #92 exact head;
- PR remains Draft.

## Attempt recorded on 2026-07-30

The reviewed temporary implementation and execution workflow were created, reviewed, and then removed because no Preview execution path was available.

Repository validation passed on commit `c5bdf7022a50382468e85331da793d47084e2fb0`:

- dependency installation;
- temporary endpoint syntax;
- existing Premium Route / Storage / Reentry verifier;
- Premium saved-report reentry verifier;
- Integrated Evaluation Pack v2 (`401 assertions`, `21 logical scenarios`, `28 variants`, `6 negative cases`);
- architecture guard and ghost-code audit;
- diff hygiene.

Hosted execution did not start:

- Vercel Git Preview was rejected before build by the project build-rate-limit;
- the repository had no `VERCEL_TOKEN` GitHub Actions secret for a CLI Preview deployment;
- the connected Vercel file-deployment API required a complete source archive that the available private-repository connector could not provide.

Because the Preview endpoint never executed, no temporary Auth user, profile, Premium session, or saved report was created. The temporary endpoint, workflow, and result file were removed. This is an infrastructure-blocked attempt, not a product PASS or product failure.

## Completion rule

Stage 9 is complete only when the exact validation Preview passes the hosted sequence, cleanup proves zero residue, and the final cleanup head contains no executable self-test endpoint.
