# AHR-2 Hosted Activation Static Migration Audit

## Verdict

`READY_FOR_STAGING_REHEARSAL_WITH_EXECUTION_GUARDS`

This verdict authorizes only a non-production rehearsal. It does not authorize a hosted production migration, administrator bootstrap, product confirmation, role mutation, deployment, or merge.

## Frozen scope

- Repository: `gycha0109-beep/K_beauty`
- Integration PR: `#166`
- Base branch: `main`
- Base SHA: `4202bd2c9a83f276436e226aee9d9bbc9ace2a8f`
- Integration branch: `integration/admin-product-current-main`
- Audited exact head: `4efa74c8ce4c89b03cc592e7edbf93b20c6fd687`
- Hosted project ref: `bygrczggxfuisupcevaz`
- Hosted PostgreSQL: `17.6`
- Hosted migration ledger tip observed during AHR-1: `20260717031925_premium_saved_report_snapshot_immutability`
- Hosted write operations during AHR-2: `0`

## Exact missing migration sequence

Repository history and the hosted ledger establish the following complete missing chain. No unrelated repository migration was found between the hosted tip and the Admin Product integration migrations.

1. `20260730152900_admin_access_foundation.sql`
2. `20260804233000_admin_product_candidate_reviews.sql`
3. `20260804233100_admin_product_candidate_reviews_hardening.sql`
4. `20260804233200_admin_product_candidate_reviews_security_hardening.sql`
5. `20260804233300_admin_product_review_import_confirm.sql`

The order is mandatory.

## Dependency audit

| Migration | Requires | Creates or transforms | First application |
| --- | --- | --- | --- |
| Admin Access Foundation | `auth.users`, `gen_random_uuid()` | memberships, audit ledger, role/capability functions, owner bootstrap | PASS |
| Product Candidate Reviews | foundation, product candidate/review tables, promotion RPC | single-review ledger, preflight and confirm RPCs | PASS |
| Product Review Hardening | immediately preceding base review RPCs | renames base RPCs to `_unsafe_v1`; installs serialized wrappers | PASS |
| Product Security Hardening | foundation audit RPC and hardened preflight | renames audit/preflight internals; installs sensitive-payload and identity checks | PASS |
| Import Confirm | all preceding Admin Product functions, `pgcrypto`, product foundations | batch ledger, canonical hashing, exact retry lookup, atomic batch confirm | PASS |

Hosted prerequisite inspection found the expected product tables, columns, enums, normalization functions, and `promote_product_candidate(uuid,text)` RPC.

## Replay-safety audit

The chain is transactional but not manually idempotent as a set.

| Migration | Replay characteristic | Operational classification |
| --- | --- | --- |
| Foundation | `IF NOT EXISTS` tables plus `CREATE OR REPLACE` functions can overwrite later hardened wrappers if replayed out of sequence | ledger-only, exactly once |
| Candidate Reviews | base functions use `CREATE OR REPLACE`; replay after hardening can downgrade current wrappers | ledger-only, exactly once |
| Review Hardening | function renames collide after successful application | one-shot, fail-fast |
| Security Hardening | function renames collide after successful application | one-shot, fail-fast |
| Import Confirm | confirmation table is created without `IF NOT EXISTS` | one-shot, fail-fast |

### Required execution guard

- Apply by exact migration version through the migration ledger workflow.
- Never paste and rerun the SQL chain manually.
- Before execution, assert all five versions are absent from the hosted ledger.
- Before execution, assert all Admin objects introduced by this chain are absent.
- After any abnormal partial result, stop. Do not retry the whole chain. Reconcile schema and migration history explicitly.
- Do not use migration-history repair merely to silence a mismatch. Verify the physical schema first.

## Privilege and RLS audit

### Foundation

- `admin_memberships`: RLS enabled.
- Authenticated users receive table `SELECT`, constrained to their own active membership.
- Service role receives membership CRUD for controlled administrative operations.
- `admin_audit_logs`: RLS enabled.
- Authenticated access is constrained to actors holding `admin.audit.read`.
- Service role receives audit `SELECT`; inserts occur through the capability-validating audit RPC.
- First-owner bootstrap and audit-write RPCs are service-role-only.

### Candidate review operations

- Single-review and batch confirmation ledgers enable RLS and expose no direct browser write grant.
- `anon` and `authenticated` are denied execution of preflight, confirm, lookup, and batch-confirm RPCs.
- Unsafe renamed functions are denied to `PUBLIC`, `anon`, `authenticated`, and `service_role`.
- Only hardened entry points are granted to `service_role`.
- Migration assertions fail if browser-role exposure or unsafe service-role execution is detected.

### Existing hosted boundary

- `product_candidates` and `candidate_promotion_reviews` are RLS-enabled and inaccessible to `anon` and `authenticated`.
- `promote_product_candidate(uuid,text)` is `SECURITY DEFINER`, denied to browser roles, and executable by `service_role`.
- The `public` schema grants `USAGE` but not `CREATE` to `PUBLIC`, `anon`, `authenticated`, or `service_role`. This prevents those roles from shadowing referenced objects in the current `public, pg_temp` function search path.

## Static transaction and concurrency audit

- Every migration is wrapped in `BEGIN` and `COMMIT`.
- Single-review confirmation uses row locks, optimistic fingerprints, unique request IDs, and request-scoped advisory locking after hardening.
- Batch confirmation uses request and export-batch advisory locks.
- Candidate and review rows are locked in deterministic candidate-ID order.
- Confirmation ledgers enforce exact retry and reject conflicting request or batch reuse.
- Approval, candidate/review updates, promotion, audit insertion, and confirmation insertion execute in one database transaction.

## Residual risks and staging obligations

### 1. Service-role actor binding

The database functions validate the supplied actor UUID against active membership and capability, but a service-role caller supplies that UUID. Staging must prove the server route derives it from the verified user session and ignores client-controlled actor identity.

### 2. `SECURITY DEFINER` search path

Functions use a bounded `public, pg_temp` search path and the hosted `public` schema is not creatable by untrusted roles. This is acceptable for rehearsal. A future hardening change may use an empty search path with fully qualified object references.

### 3. Bootstrap evidence

The first owner cannot be recorded through the ordinary Admin audit RPC because no administrator exists yet. Production bootstrap therefore requires an external change record containing the approved identity, UUID, operator, time, command/result hash, and rollback decision.

### 4. Data rollback after confirmation

A generic schema teardown cannot reverse product inserts, product merges, candidate/review transitions, or appended notes after a real confirmation. Any post-confirm rollback must be a separately approved data-compensation operation derived from ledgers and audit evidence.

## Staging entry conditions

AHR-3 may begin only when all conditions below hold:

- PR `#166` still points to exact head `4efa74c8ce4c89b03cc592e7edbf93b20c6fd687`, or the audit is repeated for the new head.
- Hosted production remains untouched.
- A disposable or non-production Supabase target is available.
- The five migrations are applied in the exact order above.
- Synthetic identities and candidates are used.
- No real administrator or real product batch is used.
- Privilege, RLS, exact retry, stale snapshot, conflict, audit, and rollback checks are run after migration.

## Protected operations not performed

- Production migration: `0`
- Production SQL write: `0`
- Administrator membership mutation: `0`
- Auth mutation: `0`
- Product confirmation: `0`
- Main merge: `0`
- Production deployment: `0`

## Conclusion

The hosted baseline is structurally compatible with the five-migration chain, and no blocking schema or privilege collision was found. The chain is suitable for an isolated staging rehearsal only when treated as an ordered, exactly-once migration sequence. Manual replay and generic post-confirm teardown are prohibited.