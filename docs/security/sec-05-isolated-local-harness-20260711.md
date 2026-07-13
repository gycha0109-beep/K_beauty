# SEC-05 Isolated Local Database Harness

## 1. 목적

이 harness는 SEC-05 anonymous write grant migration의 PostgreSQL RPC, ACL/RLS, unique linkage, 상태 전이, multi-connection 동시성을 production migration chain과 분리해 검증하기 위한 local-only artifact다.

## 2. 전체 baseline과 분리한 이유

Repository의 production migration chain은 timestamp-0 predecessor schema가 없어 빈 DB replay가 불가능하다. 이는 전체 역사 복원 문제이며, SEC-05가 직접 의존하는 pre-SEC-05 object만으로 grant contract를 검증하는 isolated harness와는 별개다. 이 harness 결과는 전체 production migration replay 성공을 주장하지 않는다.

## 3. 검증 범위

- production SEC-05 migration의 actual PostgreSQL apply
- grant/use schema, RPC, RLS, function ACL, fixed `search_path`
- result single-use, result lease no-reclaim, linkage unique constraint
- track duplicate event dedupe, maximum 24 unique event limit
- principal/resource/operation mismatch rejection
- service_role-only RPC/table boundary
- C01-C05 실제 multi-connection competition
- V05 cleanup의 expired in-progress grant 삭제 특성

## 4. 비검증 범위

- 전체 production migration history와 20260410 predecessor schema
- Next.js route, cookie, sessionStorage, OpenAI, browser flow
- production/remote deployment, live data, remote RLS metadata
- SEC-01 behavior itself. SEC-05 SQL은 SEC-01 table/function을 참조하지 않아 stage하지 않는다.

## 5. Pre-SEC-05 bootstrap 근거

`20260424_align_analysis_results_share_schema.sql` 원본을 runtime staging해 `analysis_requests`와 `analysis_results`를 만든다. Bootstrap은 SEC-05가 ALTER하는 `recommendation_logs`의 12 columns, UUID PK, nullable `auth.users` FK, RLS enabled/no policy, anon/authenticated revoke, service_role DML grant만 제공한다.

이 bootstrap은 production baseline이 아니며 SEC-05와 직접 무관한 product, ranking, candidate, existing recommendation index를 포함하지 않는다. 실제 product data, analysis result, recommendation event, raw schema dump는 포함하지 않는다.

## 6. Bootstrap 포함 object

| Object | 이유 |
| --- | --- |
| `pgcrypto` | UUID defaults required by bootstrap and staged analysis migration |
| `public.recommendation_logs` | SEC-05 grant-use FK/index ALTER target |
| `auth.users` FK reference | Supabase local managed schema dependency |
| recommendation log RLS/ACL | pre-SEC-05 direct security boundary |

## 7. Bootstrap 제외 object

- `products`, candidates, rankings, promotion/ranking RPC
- SEC-01 table/function
- SEC-05 grant/use table, linkage columns, indexes, functions, ACL
- seed data, local key, remote identifier, raw schema dump
- nonessential recommendation log indexes and unrelated current-state schema

## 8. Production migration staging 방식

`run.ps1` creates a unique OS TEMP workdir and stages immutable copies of these repository sources after SHA-256 equality checks:

1. `20260424_align_analysis_results_share_schema.sql`
2. `20260711032649_sec_05_anonymous_write_grants.sql`

The bootstrap is staged before them. SEC-01 is not staged because the SEC-05 source SQL has no direct dependency on its tables or functions. Source content is never edited, copied into the repository migration directory, or applied remotely.

## 9. 격리 config

The template uses a placeholder project ID replaced by a per-run random local ID and distinct local ports. The runner starts only the local database service and excludes API, Auth, storage, realtime, studio, analytics, edge, and other unnecessary services. It never uses `--linked`, `--db-url`, `--all`, root `supabase/config.toml`, or a production project identifier.

## 10. Structure test

`001_sec05_structure.sql` runs pgTAP assertions against PostgreSQL catalogs for grant/use tables, grant-use linkage columns/FKs/partial unique indexes, checks, RPC signatures, SECURITY INVOKER mode, and fixed `search_path`. SECURITY DEFINER is intentionally not expected: the production migration uses SECURITY INVOKER with explicit service_role execute/table grants.

## 11. RLS·Privilege test

`002_sec05_privileges_rls.sql` verifies both grant tables have RLS enabled; anon/authenticated lack direct table and RPC permissions; PUBLIC lacks claim execute; service_role has only the migration-granted table/RPC access; and no permissive policy is created.

## 12. Result state-machine test

`003_sec05_result_state_machine.sql` has `plan(23)` and covers R01-R23: valid claim, duplicate denial, principal/resource/operation mismatch, completion/failure terminal behavior, expiry, malformed input, result no-reclaim after a stale lease, `analysis_results.anonymous_write_grant_use_id` unique linkage, and complete/fail mandatory binding NULL rejection without a state transition. R15 requires SQLSTATE `22023` and the exact `anonymous_write_grant_claim_invalid` message; R18-R23 cover complete/fail principal, resource type/id, and operation NULL inputs.

## 13. Track state-machine test

`004_sec05_track_state_machine.sql` covers T01-T10, T13-T14 and V05. T11 and T12 are intentionally performed by the actual concurrent worker harness: one duplicate track event and a max-use boundary race cannot be proven in a single pgTAP transaction.

## 14. Multi-connection concurrency test

`run-concurrency-tests.ps1` discovers exactly one database container using the generated project ID, opens separate container-local `psql` sessions, adds a bounded synchronization delay, and asserts:

- C01: eight identical result claims yield exactly one claim/use.
- C02: only the owning worker can complete the result claim.
- C03: eight inserts for one result use ID yield at most one `analysis_results` row.
- C04/T11: eight identical track workers create one use and one recommendation log.
- C05/T12: a 23-use track grant accepts only one of eight concurrent distinct events, ending at 24.

Worker exit codes, returned states, and post-race SQL invariants are all checked. Unrelated SQL errors are failures, not expected denials.

## 15. Test oracle completeness

`verify-test-evidence.ps1` requires `STRUCTURE`, `PRIV_RLS`, R01-R23, T01-T14, C01-C05, V05, C03/C04 worker aggregates and details, and cleanup evidence. Missing, failed, `TIMEOUT`, or `NOT_RUN` scenario evidence cannot yield `FULL_PASS`.

## 16. V05 residual-risk 처리

V05 is characterized, not fixed. The test captures exactly one related grant-use before cleanup, makes that claimed result grant expire, then verifies the current cleanup RPC deletes both the grant and the captured use. A successful V05 test therefore records the known Low residual risk rather than resolving it: cleanup lacks a separate in-progress grace condition.

## 17. Runner cleanup·격리 보장

Each run uses `try/finally`, stops only its generated local project with `--project-id ... --no-backup`, checks project-scoped container/volume residue, and deletes its TEMP workdir. It does not stop all local projects or interact with root local Supabase state.

Rendered `config.toml` is written with `System.Text.UTF8Encoding($false)` and `System.IO.File.WriteAllText`. Before `supabase start`, the runner verifies the file is non-empty, does not begin with `EF BB BF`, contains the isolated project ID, and contains no remote project reference or credential field.

External commands now use separate TEMP stdout/stderr files and preserve the real process exit code, timestamps, timeout state, and a redacted first causal error. Worker and worker-group timeouts are retained as structured `TIMEOUT` evidence, mark later DB-dependent concurrency scenarios `NOT_RUN`, and are not downgraded to ordinary failure or invalid-worker evidence. Explicit parser/config/SQL errors from stderr or stdout take precedence over progress and profile/debug notices. Cleanup errors are appended to the original failure instead of replacing it. Raw logs are removed with the isolated TEMP workdir.

## 18. 실행 명령

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File security-tests/sec05-isolated/run.ps1
```

The default performs two clean runs. It writes only temporary staged migration/test/log artifacts and removes them after each run.

## 19. Historical diagnostic record (superseded; not the current contract)

The previous **`NOT_RUN_SUPABASE_CLI_PROFILE_UNAVAILABLE`** classification was inaccurate. The runner has no login/profile/access-token prerequisite, and the TEMP layout, `supabase/config.toml` location, cwd, and `--workdir` were correct.

The actual initial blocker was a UTF-8 BOM added by Windows PowerShell 5.1 `Set-Content -Encoding UTF8`. Supabase CLI `2.82.0` could not parse the rendered TOML. After the no-BOM write fix, static rendering produced first bytes `70 72 6F`, `utf8BomPresent=False`, and the expected isolated project ID. A synthetic process test also preserved separate stdout/stderr, exit code `7`, and the explicit causal error.

The first local run then reached migration application and failed during the unchanged production SEC-05 migration:

- status: **`FAIL`**
- causal error: `ERROR: syntax error at or near "grant" (SQLSTATE 42601)`
- source: `20260711032649_sec_05_anonymous_write_grants.sql:96`, first invalid alias at `jsonb_to_recordset(p_grants) as grant(...)`
- source/staged SHA-256: `342044B4E0DDD0B116E8C122CF7322CA37C8DA96E6C9037CC7A7F1CDEBD4DC94`, exact match
- production source, bootstrap, test SQL, helper scripts, and runtime code: unchanged
- cleanup: isolated TEMP, project containers, and project volumes all zero after failure

Because the first run was not `FULL_PASS`, the required second clean run was not executed. Structure, privilege/RLS, R01-R17, T01-T14, C01-C05, V05, and evidence completeness are all **`NOT_RUN`**. No security PASS is claimed.

### Alias remediation and rerun

The production migration was then minimally corrected by renaming only the unquoted reserved aliases: the two `jsonb_to_recordset` aliases at lines 96 and 153, plus the cleanup join alias and its two references at lines 513-514, now use `grant_row`. SQL `GRANT` statements, function signatures, return values, state transitions, checks, indexes, RLS, grants/revokes, exception SQLSTATEs, and cleanup conditions are unchanged. Static verification found zero legacy unquoted alias occurrences, four `grant_row` occurrences, and all seven SQL `GRANT` statements intact.

The corrected migration SHA-256 is `6793093152A863BB08193FADDDE90E81B097E675EAEF35B74AFB5E7B47E05423`. The isolated runner source/staged hash gate passed, local start passed, and migration apply passed. The first rerun then stopped in the unchanged pgTAP privilege suite:

- status: **`FAIL_NEW_DEFECT`**
- causal error: `role "PUBLIC" does not exist`
- source: `security-tests/sec05-isolated/template/tests/002_sec05_privileges_rls.sql:19`
- cause: `has_function_privilege('PUBLIC', ...)` supplies PostgreSQL's pseudo-role as a text role name; it is not a concrete role accepted by that function
- second clean run: **`NOT_RUN`**, because the first rerun was not `FULL_PASS`
- structure: **`NOT_RUN`** (no durable per-suite PASS evidence was retained after the aggregate pgTAP failure)
- privilege/RLS: **`FAIL`**
- R01-R17, T01-T14, C01-C05, V05, and test-oracle completeness: **`NOT_RUN`**
- cleanup: isolated TEMP, project containers, and project volumes all zero

The runner, bootstrap, test SQL, template helper scripts, runtime code, and all non-SEC-05 migrations remain unchanged. No remote access or write occurred.

### PUBLIC ACL assertion remediation and rerun

`002_sec05_privileges_rls.sql` replaced only the invalid `has_function_privilege('PUBLIC', ...)` assertion. The pgTAP plan remains 23 assertions. The replacement identifies the exact claim RPC with `regprocedure`, expands `COALESCE(p.proacl, acldefault('f', p.proowner))`, and denies a direct PUBLIC EXECUTE ACL only when no `aclexplode` entry has `grantee = 0` and `privilege_type = 'EXECUTE'`. The anon, authenticated, and service_role effective privilege assertions are unchanged.

Static verification confirmed zero PUBLIC concrete-role inquiries, the required catalog/default-ACL/signature predicates, and 23 `ok` assertions. The corrected assertion no longer produced a SQL error; the first isolated rerun reached `003_sec05_result_state_machine.sql`, where a separate existing test defect stopped pgTAP:

- status: **`FAIL_NEW_DEFECT`**
- causal error: `WITH query "second_insert" does not have a RETURNING clause`
- source: `security-tests/sec05-isolated/template/tests/003_sec05_result_state_machine.sql:136-141`
- cause: the CTE inserts with `ON CONFLICT DO NOTHING` but has no `RETURNING` clause, while line 141 selects from that CTE
- second clean run: **`NOT_RUN`**, because the first rerun was not `FULL_PASS`
- PUBLIC assertion: executed without the previous PUBLIC-role SQL error, but no independent final group PASS evidence was retained after the later aggregate pgTAP failure
- structure, privilege/RLS final group status, R01-R17, T01-T14, C01-C05, V05, and test-oracle completeness: **`NOT_RUN`**
- cleanup: isolated TEMP, project containers, and project volumes all zero

The production SEC-05 migration SHA-256 remains `6793093152A863BB08193FADDDE90E81B097E675EAEF35B74AFB5E7B47E05423`; source/staged verification passed before migration apply. No production migration, runtime code, bootstrap, runner, or other test file was modified in this PUBLIC assertion task.

### R13 CTE remediation and rerun

`003_sec05_result_state_machine.sql` changed only R13 `second_insert` by adding `RETURNING 1` after its existing `ON CONFLICT ... DO NOTHING`. The INSERT target, columns, values, conflict predicate, assertion, and plan of 17 remain unchanged. This gives the CTE a result set: the first insert returns one row, and the conflict path returns zero rows for the existing unique-linkage postcondition.

Static verification confirmed exactly one R13 `RETURNING 1`, the unchanged count assertion, plan 17, and no change to the production migration, runner, bootstrap, 001/002/004 tests, config, or helper scripts. The first rerun passed local start and migration apply, moved beyond the previous R13 failure, and then stopped at a separate track test defect:

- status: **`FAIL_NEW_DEFECT`**
- causal error: `WITH query "second_insert" does not have a RETURNING clause`
- source: `security-tests/sec05-isolated/template/tests/004_sec05_track_state_machine.sql:97-102`
- cause: T10 repeats the same pattern: a data-modifying CTE without `RETURNING` is referenced by its unique-linkage assertion
- second clean run: **`NOT_RUN`**, because the first rerun was not `FULL_PASS`
- structure, privilege/RLS, R01-R17, T01-T14, C01-C05, V05, and test-oracle completeness: **`NOT_RUN`** as final evidence groups
- cleanup: isolated TEMP, project containers, and project volumes all zero

No remote access, remote write, production migration change, runtime change, or T10 test change occurred in this R13-only task.

### Data-modifying CTE inventory and T10 remediation

The 003/004-only inventory found these referenced data-modifying CTEs:

| File | Scenario | CTE | DML | Referenced later | RETURNING | Change |
| --- | --- | --- | --- | --- | --- | --- |
| 003 | R13 | `request_one` | INSERT | yes | `id` | none |
| 003 | R13 | `first_insert` | INSERT | yes | `id` | none |
| 003 | R13 | `request_two` | INSERT | yes | `id` | none |
| 003 | R13 | `second_insert` | INSERT | yes | `1` | prior correction |
| 004 | T10 | `first_insert` | INSERT | yes | `id` | none |
| 004 | T10 | `second_insert` | INSERT | yes | `1` | added |

R10 and T13 CTEs are SELECT function-call pipelines, not data-modifying CTEs. The R16 and V05 updates are outside CTEs. No other referenced INSERT, UPDATE, or DELETE CTE was found in 003 or 004.

T10 now adds only `RETURNING 1` after its unchanged `ON CONFLICT ... DO NOTHING`; its first-insert-one/second-insert-zero assertion and plan 13 remain unchanged. Static checks confirmed R13 and T10 both have the required `RETURNING 1`, while their existing assertions and plans remain R13 17 and T10 13.

The next first local rerun passed no-BOM config, start, migration apply, and progressed beyond both R13 and T10. It then stopped at an unrelated V05 fixture defect:

- status: **`FAIL_NEW_DEFECT`**
- causal error: `new row for relation "anonymous_write_grants" violates check constraint "anonymous_write_grants_expiry_order"`
- source: `security-tests/sec05-isolated/template/tests/004_sec05_track_state_machine.sql:135-137`
- cause: V05 sets `expires_at` to one minute before current time, which is earlier than the grant's existing `issued_at` and violates the production expiry-order constraint before cleanup can be characterized
- second clean run: **`NOT_RUN`**, because the first rerun was not `FULL_PASS`
- final evidence groups for structure, privilege/RLS, R01-R17, T01-T14, C01-C05, V05, and oracle: **`NOT_RUN`**
- cleanup: isolated TEMP, project containers, and project volumes all zero

No production migration, runtime code, runner, bootstrap, config, helper script, or V05 fixture change occurred in this limited RETURNING remediation.

## 20. Historical limitations (superseded)

- Actual PostgreSQL concurrency and V05 behavior remain unverified because pgTAP now stops at the V05 fixture's expiry-order constraint violation.
- The PUBLIC direct-ACL assertion, R13 CTE, and T10 CTE are now PostgreSQL-valid, but the V05 fixture requires a separately authorized correction before the full harness can complete.
- The harness does not validate the full production migration chain or application routes.

## 21. Historical next verification step (superseded)

Under a separate V05 fixture correction task, create an expired test grant without violating the expiry-order constraint, retain the cleanup characterization contract, and rerun this isolated harness twice. Independent review and the SEC-05 commit gate remain pending both clean runs.

## 22. Historical conclusion (superseded)

The BOM and causal-error capture defects in the runner are corrected, the production migration's reserved-alias syntax defect is fixed with a contract-preserving rename, the PUBLIC direct-ACL assertion is PostgreSQL-valid, and R13/T10 now return valid CTE result sets. The next rerun exposed a separate, out-of-scope V05 fixture defect. Overall result is **`FAIL_NEW_DEFECT`**. No second run or unexecuted security scenario was treated as passed, and no runtime or remote production change was made.

## 26. Prior remediation record (superseded by section 27)

Sol's independent commit gate found four Medium issues and two adjacent Low coverage gaps despite the prior two-run report. The production migration now rejects NULL or malformed mandatory identifiers in `complete_anonymous_write_grant` and `fail_anonymous_write_grant` with the established `22023` / `anonymous_write_grant_claim_invalid` contract. Their stored binding comparisons now use `IS DISTINCT FROM`, so principal, resource type, resource ID, and operation cannot bypass mismatch handling through SQL three-valued logic. Function signatures, return types, state transitions, lease/expiry behavior, RLS/ACL, indexes, and cleanup behavior remain unchanged. The resulting migration SHA-256 is `10552DD1A65005D4CE74301546BF0F925BFF1AE8F24A4EB90D3429CA8E0370F4`.

`003_sec05_result_state_machine.sql` now has `plan(23)`. R15 verifies both the exact SQLSTATE and message. R18-R23 cover complete/fail NULL principal, both resource fields, and operation inputs; each checks that the use remains `in_progress` after the expected exception. `004_sec05_track_state_machine.sql` remains `plan(13)`: V05 requires exactly one captured related grant-use before cleanup and deletion of both the expired grant and that captured use after an explicitly ordered cleanup call.

The concurrency runner writes a temporary sanitized structured result and the outer evidence retains it before cleanup. C03/C04 retain only worker index, classification, exit/timeout flags, UUID and command-tag counts, and sanitized error category. The final evidence requires eight workers, one winner, seven no-ops, zero invalid/timed-out/non-zero workers, and linked-row counts of `0 -> 1`; raw worker stdout/stderr and SQL remain TEMP-only and are removed.

The final actual oracle now executes only after project-scoped cleanup. It validates plans, scenario coverage, C03/C04 worker aggregates and per-worker consistency, cleanup status, and zero TEMP/container/volume/raw-artifact/intermediate-evidence residue. A normal post-migration assertion failure continues to independent suites and remains an aggregate failure. A worker, worker-group, or DB-dependent timeout records structured `TIMEOUT`, prevents later DB-dependent work, preserves cleanup, and makes the final oracle fail.

The first post-remediation execution exposed only a runner V05 record-shape omission: a passing V05 record did not populate `PassedScenarioIds`, so the final oracle correctly rejected it. The record was completed without changing the test contract. After the worker-timeout propagation and V05 captured-use precondition remediation, two new clean isolated runs passed local start, staged source/hash verification, migration apply, Structure `15/15`, Privilege/RLS `23/23`, Result `R01-R23`, Track `13/13` including V05, C01-C05 plus T11/T12, cleanup, and the cleanup-after final oracle. In both sanitized evidence files, C03 and C04 recorded worker count `8`, winner `1`, no-op `7`, invalid `0`, timeout `0`, non-zero exit `0`, linked rows `0 -> 1`, and no secret pattern.

This remains isolated local SEC-05 validation only. It does not replay the full production migration history, test application routes, access a linked project, or apply anything to remote/production databases. The final harness result is **`FULL_PASS`**; a new independent Sol commit gate remains required before any commit.

### V05 fixture and suite-evidence persistence remediation

The V05 fixture changed only its timestamp relationship. After creating and claiming the paired grant, it now sets `issued_at = now() - interval '2 hours'` and `expires_at = now() - interval '1 hour'`. This preserves the intended expired in-progress cleanup target while satisfying `anonymous_write_grants_expiry_order` (`issued_at < expires_at < now()`). No production constraint, cleanup function, lease contract, scenario expectation, or pgTAP plan changed.

The focused time-fixture inventory found no other direct timestamp assignment that violates the grant expiry order. The 003 helper defaults and R01 pair use `issued_at = now()` with `expires_at = now() + interval '1 hour'`; the 004 helper uses the same relationship. R16 exercises stale-lease behavior through the production RPC rather than a conflicting timestamp fixture.

The runner now executes each pgTAP suite independently and writes a sanitized structured record immediately before and after the suite. Records include suite status, start/completion state, process exit code, planned/observed/pass/fail assertion counts, scenario IDs, completed/failed/not-run scenario IDs when a numbered pgTAP failure is available, and a sanitized first causal error. The final summary has run-level and cleanup status, remains outside the deleted raw workdir, and contains no raw stdout/stderr, connection URL, key, JWT, or password. The evidence oracle consumes this structured suite data plus the separate concurrency evidence, so a later failure cannot overwrite an earlier completed suite as `NOT_RUN`.

The first rerun after these corrections reached the result state-machine suite:

- `STRUCTURE`: **PASS** (15/15)
- `PRIVILEGE_RLS`: **PASS** (23/23)
- `RESULT_STATE_MACHINE`: **FAIL** at R15, `not ok 15 - R15 malformed identifier fails closed with the contract SQLSTATE`; the ordered pgTAP evidence retains R01-R14 as completed/pass, R15 as failed, and R16-R17 as not run
- `TRACK_STATE_MACHINE`, `CONCURRENCY`, `V05`, and `TEST_ORACLE`: **NOT_RUN** because execution stopped at R15
- cleanup: **PASS**; isolated workdir, container, and volume residue were zero
- second clean run: **NOT_RUN**, because the first run was not `FULL_PASS`

R15 calls `claim_anonymous_write_grant(NULL, ...)` and expects SQLSTATE `22023`. The production input guard uses nullable predicate expressions such as `p_jti_hash !~ ...`; with a NULL argument, the PL/pgSQL `IF` condition does not necessarily enter the exception branch. This is a newly exposed contract/test mismatch outside the V05 fixture and evidence-persistence scope. It was not modified. The overall harness result remains **`FAIL_NEW_DEFECT`**.

## 23. Historical status update (superseded)

The V05 fixture is now constraint-valid, and per-suite evidence persistence is confirmed by the retained Structure and Privilege/RLS PASS records plus the R01-R14/R15/R16-R17 split after the later R15 failure. V05 cleanup behavior itself remains **NOT_RUN** in this run because Track did not start. Before a second clean run, a separate security-contract decision is required: either make the production claim RPC reject NULL malformed identifiers with `22023`, or correct R15 to the documented fail-closed result if SQLSTATE is not part of that contract. Do not change this production behavior or test expectation as part of the V05/evidence remediation.

## 24. Historical claim-guard and aggregation remediation (superseded)

The R15 contract was confirmed as a production input-validation defect, not a pgTAP transaction failure. `claim_anonymous_write_grant` now rejects NULL for each of its mandatory claim inputs in the existing malformed-input guard. The existing regex and fixed-value checks, function signature, SQLSTATE `22023`, and message `anonymous_write_grant_claim_invalid` are unchanged.

The isolated runner now separates environment fail-fast from post-migration test aggregation. Config validation, local start, migration reset/apply, source/staged migration hash mismatch, timeout, and cleanup failures remain fail-fast. After a successful migration apply, Structure, Privilege/RLS, Result, Track/V05, concurrency, and the actual evidence oracle are each invoked even if an earlier independent suite fails. Their failures are retained and produce a final non-zero aggregate failure; no failed or not-run suite is treated as passed.

`Get-PgtapSuiteEvidence` now parses every actual TAP `ok N` and `not ok N` line plus the emitted plan. It records observed, passed, failed, and missing assertion numbers and derives per-scenario PASS/FAIL/NOT_RUN from those numbers. A synthetic parser check verified that `ok 1`, `not ok 2`, `ok 3`, and `1..3` records scenarios 1 and 3 as PASS, scenario 2 as FAIL, and no scenario as NOT_RUN.

The first diagnostic run after these changes did not reach migration application because Docker Desktop's Linux engine pipe was unavailable. The runner confirmed a no-BOM rendered config, then failed at local `supabase start` with a redacted Docker connection error. All test suites, V05, concurrency, and the actual oracle are **NOT_RUN** for this attempt; the second clean run is **NOT_RUN** because the first run was not FULL_PASS. The isolated TEMP workdir and raw logs were removed. Docker was unavailable during stop and residue inspection, so cleanup evidence is **FAIL** rather than claiming container/volume verification.

Overall status for this attempt is **`EXECUTION_ENVIRONMENT_FAILURE`**. No remote access, production/staging DB write, runtime application change, template test/helper change, or production migration apply occurred. Once Docker is available, rerun the isolated harness to collect the intended R16-R17, T01-T14, V05, C01-C05, and actual-oracle evidence.

## 25. Historical V05 and concurrency-accounting remediation (superseded)

The production SEC-05 migration was not changed. The local forensic run proved that cleanup deleted the V05 fixture grant and its reachable use row, but the former pgTAP expression allowed its uncorrelated `NOT EXISTS` check to run before the cleanup function. V05 now calls `cleanup_anonymous_write_grants(now())` in a separate `DO ... PERFORM` statement and then performs the unchanged grant-deletion assertion. The fixture timestamps, target grant, plan of 13, top-level assertion count of 13, and V05 description are unchanged.

The runner no longer promotes a passing TAP description containing `SQLSTATE` to a causal error. For pgTAP failures it prioritizes the lowest-numbered actual `not ok` line, then a TAP bailout, then explicit PostgreSQL stderr errors, and only then a sanitized fallback. A synthetic regression check confirmed that `ok 12` mentioning SQLSTATE followed by `not ok 13` reports the latter; an all-pass TAP suite retains an empty causal error.

The concurrency runner now returns worker exit code, timeout, stdout, and stderr separately. C03 and C04 classify stdout line by line: exactly one UUID plus `INSERT 0 1` is the winner; `INSERT 0 0` without a UUID is a no-op; every other combination is invalid. Both scenarios require one winner, seven no-ops, zero invalid workers, zero starting linked rows, and the existing final database postconditions. C01, C02, and C05 retain their original state-result assertions while additionally rejecting failed worker transport.

Historical run note: two earlier isolated local runs passed the then-current R01-R17 contract before the later R01-R23, worker-timeout, and V05 captured-use coverage hardening. They are not evidence for the current canonical contract. The current contract requires a new two-run execution after this remediation.

## 27. Current canonical status

The current isolated SEC-05 contract is Result `R01-R23`, Track/V05 `13/13`, `T01-T14` with T11/T12 covered by C04/C05, and C01-C05. V05 requires one pre-cleanup captured grant-use and post-cleanup absence of both that use and its grant. The current production migration SHA-256 is `10552DD1A65005D4CE74301546BF0F925BFF1AE8F24A4EB90D3429CA8E0370F4`; source and staged copies matched on both new runs.

Worker timeouts are recorded as `TIMEOUT` rather than ordinary failure or invalid-worker evidence. The current scenario is retained, later DB-dependent concurrency scenarios are `NOT_RUN`, cleanup still runs, and the cleanup-after oracle rejects the finalized evidence. A TEMP-only regression launched a short-lived child process and confirmed `TimedOut=true`, `Classification=TIMEOUT`, `SanitizedErrorCode=WORKER_TIMEOUT`, top-level timeout evidence, and outer-runner timeout recognition.

Both clean runs passed no-BOM config validation, migration apply, Structure `15/15`, Privilege/RLS `23/23`, Result `23/23`, Track `13/13`, V05, C01-C05, cleanup, and the finalized actual oracle. C03/C04 each retained eight sanitized workers with one winner, seven no-ops, zero invalid, zero timeouts, zero non-zero exits, and linked rows `0 -> 1`. Retained evidence contains no credential pattern; project-scoped TEMP, containers, volumes, raw logs, and intermediate JSON had zero residue. No remote or production database was accessed or changed.

This is an isolated local SEC-05 harness result only. It is not a full historical migration replay, application-route test, remote verification, production deployment, or commit approval. A new Sol independent security review and commit gate remains required; this task did not commit.

The final isolated-harness status is **`FULL_PASS`**. This remains an isolated SEC-05 database verification, not a replay of the complete production migration history or an application-route test. No remote access, production/staging DB write, production migration apply, or runtime application change occurred. Independent review and the commit gate remain separate work.

## 28. Final concurrency-oracle contradiction remediation

The former final oracle could accept contradictory sanitized concurrency evidence when outer suite fields reported PASS while structured evidence reported a failing overall state or a basic scenario retained a timeout/non-zero-exit count. The oracle now independently requires structured `OverallStatus = PASS`, boolean `HasTimeout = false`, an empty-array `TimeoutScenarioIds`, and the exact C01-C05/T11/T12 scenario set with no duplicate or unknown IDs. Missing, null, scalar-in-place-of-array, or incorrectly typed fields fail rather than being defaulted or normalized.

C01, C02, and C05 now require their existing producer metrics: C01 requires one claim and one use; C02 requires one owner completion and one stale denial; C05 requires one boundary claim and used count 24. Each also requires its expected worker count plus zero timeout and non-zero-exit counts. C03/C04 retain their prior worker-detail validation. TEMP-only N01-N16 contradictory-evidence cases, plus cleanup failure, missing worker, and malformed aggregate regressions, must return a non-zero oracle result; the matching P01 evidence returns `TEST_ORACLE=FULLY_OBSERVED`.

This hardening changes only the local evidence consumer. It does not change the production migration, concurrency producer, runner control flow, scenario expectations, worker count, or remote/production database state. A new two-run isolated execution and Sol commit gate remain required before commit.

After this remediation, two clean isolated runs passed no-BOM configuration, source/staged migration hash verification, migration apply, Structure `15/15`, Privilege/RLS `23/23`, Result `R01-R23`, Track/V05 `13/13`, C01-C05 plus T11/T12, cleanup, and the cleanup-after final oracle. Both finalized evidence files recorded concurrency `OverallStatus = PASS`, boolean `HasTimeout = false`, an empty `TimeoutScenarioIds` array, C01/C02/C05's expected zero timeout/non-zero-exit counts and metrics, and C03/C04 worker `8/1/7/0/0` with linked rows `0 -> 1`. Both retained evidence files had zero credential-pattern matches and zero project-scoped residue. No linked or remote project was accessed, and no commit was made.

## 29. Final evidence type-coercion remediation

The oracle formerly used direct PowerShell status and lifecycle comparisons for ordinary suites, V05, and cleanup. That allowed type coercion such as boolean `true` being accepted as `PASS`, or string `"false"` being treated as a truthy completion state. The oracle now requires property presence and non-null values, then checks exact JSON-derived string, boolean, integer, array, or object types before evaluating values. Suites and V05 require string `PASS`, boolean `Started`/`Completed`, integer exit and assertion values, and exact assertion/scenario arrays; cleanup requires string `CleanupStatus = PASS` and integer zero residue counters. Run-level `OverallStatus` is an exact string `RUNNING` during oracle invocation or `PASS` in retained fully passed evidence.

The bounded type regression matrix rejects T01-T28, including boolean/numeric/array status substitutions, string booleans and integers, scalar/object/null collections, null or absent required properties, and floating-point counts. P01 and P02 producer-compatible evidence pass, including supported JSON integer CLR representations. N01-N16 contradictory concurrency cases and the cleanup, missing-worker, malformed-aggregate, timeout, and ordinary-failure regressions remain fail-closed. Two subsequent clean isolated runs passed all suites, cleanup-after oracle, strict evidence revalidation, and credential-pattern scans. This remains local isolated-harness evidence only; it is not remote or production verification and still requires a new Sol commit gate before commit.

## 30. TAP PANIC fail-closed remediation

The pgTAP suite completeness detector formerly rejected explicit `ERROR:` and `FATAL:` rows but omitted `PANIC:`, so an exit-zero process with a complete passing TAP stream and a separate PostgreSQL panic row could be accepted. The detector now treats line-start `ERROR:`, `FATAL:`, and `PANIC:` markers, including the existing `psql:` wrapper form, as explicit SQL/parser failure evidence. Leading whitespace is accepted; the same words inside an ordinary `ok N` description are not error rows. The failure-summary order remains earliest actual `not ok`, bailout, explicit PostgreSQL error row, then sanitized fallback.

TEMP-only Panic-N01/N02 checks rejected direct and whitespace-prefixed panic rows with non-zero validation results and retained a sanitized panic cause. Panic-P01/P02 accepted complete passing TAP where `PANIC` or `PANIC:` appeared only in assertion descriptions. Existing ERROR/FATAL, earliest-not-ok, SQLSTATE-description, bailout, plan mismatch, duplicate/missing assertion-number, and process-exit/TAP-conflict regressions also passed.

Two clean isolated runs then passed migration apply, Structure `15/15`, Privilege/RLS `23/23`, Result `R01-R23`, Track/V05 `13/13`, T01-T14, C01-C05, cleanup, and the cleanup-after final oracle. Each C03/C04 retained eight workers with one winner, seven no-ops, zero invalid workers, zero timeouts, zero non-zero exits, and linked rows `0 -> 1`. Both new evidence files independently returned `TEST_ORACLE=FULLY_OBSERVED`, had zero credential-pattern matches, and recorded zero project-scoped residue. The production migration was unchanged at SHA-256 `10552DD1A65005D4CE74301546BF0F925BFF1AE8F24A4EB90D3429CA8E0370F4`. No remote or production database was accessed or changed, and no commit was made. A new Sol independent commit gate remains required.
