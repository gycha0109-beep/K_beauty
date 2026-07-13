# SEC-05 Isolated Local Database Harness

This harness is only for local verification of the SEC-05 anonymous write grant migration. It is not a production baseline, not a replacement for the repository migration chain, and must never be used with a linked or remote project.

`run.ps1` creates a unique work directory under the operating system TEMP directory, stages immutable copies of the required production migrations after SHA-256 verification, starts a distinct local Supabase project, runs pgTAP and multi-connection checks, removes its own stack, volumes, and TEMP files, then runs the final evidence oracle against the cleanup-complete sanitized evidence.

The bootstrap includes only the pre-SEC-05 `recommendation_logs` contract that the SEC-05 migration alters. The existing `20260424_align_analysis_results_share_schema.sql` source migration is staged unchanged to provide `analysis_requests` and `analysis_results`. SEC-01 is intentionally not staged because SEC-05 does not reference its tables or functions.

Run only from the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File security-tests/sec05-isolated/run.ps1
```

The runner uses no `--linked`, `--db-url`, `--all`, remote database command, or repository-root migration directory. Result coverage is R01-R23: R15 requires the exact claim SQLSTATE and message, while R18-R23 verify complete/fail NULL binding rejections without a state transition. Track remains plan 13; V05 requires exactly one related grant-use capture before cleanup and verifies deletion of both that grant and use afterward. T11/T12 are covered by C04/C05 concurrency.

The pgTAP parser rejects explicit PostgreSQL `ERROR:`, `FATAL:`, and `PANIC:` rows, allowing leading whitespace but requiring the error marker at the start of the row. Ordinary passing TAP descriptions that merely contain `PANIC` or `PANIC:` remain valid. Failure summaries continue to prefer the earliest actual `not ok`, then bailout, then an explicit PostgreSQL error row, then the sanitized fallback.

Post-migration assertion failures are aggregated so independent suites remain observable. A worker or worker-group timeout is retained as structured `TIMEOUT` evidence, marks later DB-dependent concurrency scenarios `NOT_RUN`, performs cleanup, and causes the final oracle to fail. It is never downgraded to ordinary `FAIL` or `INVALID`.

The retained sanitized evidence includes final cleanup counters and C03/C04 worker classifications and aggregate counts. It never includes worker stdout/stderr, SQL text, credentials, local URLs, generated keys, or JWTs.

The final oracle independently requires concurrency `OverallStatus` to be the string `PASS`, `HasTimeout` to be boolean `false`, and `TimeoutScenarioIds` to be an empty array. It requires the exact C01-C05/T11/T12 scenario set with no duplicate or unknown IDs. C01, C02, and C05 must retain zero timeout/non-zero-exit counts and their claimed, denial, use, and state metrics; C03/C04 retain the stricter eight-worker evidence. Contradictory status, timeout, exit, aggregate, or metric evidence fails the oracle rather than being normalized.

The oracle also enforces exact JSON types for the final evidence fields it consumes. Required suite and V05 records use string statuses, boolean lifecycle fields, integer exit/count fields, and arrays for assertion and scenario collections; cleanup requires string `CleanupStatus = PASS` and integer zero residue counters. Worker flags remain booleans. The run-level `OverallStatus` is an exact string: `RUNNING` while the cleanup-complete oracle is executing or `PASS` in retained fully passed evidence. Booleans, numeric strings, scalar-for-array substitutions, nulls, and missing properties are rejected. TEMP-only N01-N16 contradiction checks and T01-T28 type-coercion checks must fail closed; P01/P02 producer-compatible evidence must pass.
