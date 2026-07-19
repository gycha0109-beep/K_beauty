# Local Supabase Replay Baseline

## 1. Status

- Scope: isolated local migration replay only
- Production migration changes: none
- Hosted database changes: none
- Provider image calls: none
- Historical DDL claim: none
- Implementation state: local replay adapter and static guard implemented
- Dynamic gate: local Supabase reset still required

## 2. Problem

The tracked migration chain starts with `20260410_safe_review_and_promotion_layer.sql`, but that file alters `public.products` and `public.product_candidates` and creates a view over `public.source_rankings` without creating those relations.

A later tracked operational insert, `20260526_moisturizer_lotion_emulsion_insert.sql`, also consumes nine product columns that are present in the hosted schema but have no earlier tracked creation migration.

The existing `supabase/local-shadow-test` bootstrap cannot be reused as evidence because it uses simplified test contracts such as text product identifiers. The runtime and later migrations require UUID-compatible product and candidate identities.

The safe schema dump established the current hosted DDL, but it did not establish the exact pre-20260410 types, the execution path of noncanonical early SQL, or the introduction date of all untracked columns. Copying the current schema wholesale into timestamp zero would therefore invert tracked migration ownership.

## 3. Decision

The historical-authoritative baseline remains unresolved. Instead, this change introduces a separately named **replay-equivalent local predecessor contract**.

The contract has one purpose:

```text
empty isolated local Supabase
→ local predecessor adapter
→ actual tracked production migrations, byte-identical
→ local runtime read adapter
→ synthetic seed
```

It is not a production migration and is not a replacement for future provenance recovery.

## 4. Adapter boundaries

### 4.1 Predecessor adapter

`00000000_local_replay_predecessor.sql` creates only:

- `public.products`
- `public.product_candidates`
- `public.source_rankings`
- `public.recommendation_logs`

Key decisions:

- product and candidate IDs are UUID with `gen_random_uuid()` defaults
- the six product fields converted by the first tracked migration begin as text
- product normalized fields, signal fields, product form, ranking linkage, SEC-01, and SEC-05 objects are excluded
- recommendation logs reproduce the exact pre-SEC-05 current contract captured by the safe schema dump
- core table creation does not use `IF NOT EXISTS`; unexpected drift must fail visibly

### 4.2 Untracked dependency bridge

`20260525_local_replay_untracked_product_columns.sql` adds only the nine columns required by the following tracked 20260526 insert:

- `is_mens`
- `recommendation_tier`
- `size_ml`
- `unit_price_per_10ml`
- `hwahae_url`
- `external_source`
- `external_type`
- `external_id`
- `source_url`

The adapter uses an eight-digit version because the repository already contains mixed eight-digit and fourteen-digit migration versions. Its filename sorts immediately before the eight-digit 20260526 file under the same lexical convention used by the existing chain.

### 4.3 Runtime read adapter

`99999999_local_replay_runtime_contract.sql` runs after the tracked chain and adds only the hosted product read boundary required by the application:

- external identity partial unique index
- products RLS
- anon/authenticated SELECT
- service-role access
- public read policy

Analysis guard and anonymous write-grant objects are not reimplemented. Their tracked migrations remain authoritative.

## 5. Workspace generation

`scripts/prepare-local-supabase-replay.mjs` builds a disposable project under `tmp/local-supabase-replay`.

Safety controls:

- output is restricted to repository `tmp/`
- an ownership marker is required before an existing output directory can be removed
- only SQL files from `supabase/migrations` are copied
- copied production migrations are SHA-256 compared with their sources
- linked project metadata is never copied
- a generated manifest records each file, origin, order, and hash
- the script prepares files only and does not execute Supabase commands

## 6. Seed contract

The project seed contains five synthetic products covering:

- cleanser
- toner/essence
- serum
- moisturizer
- sunscreen

The rows use UUID identifiers and the final tracked enum/array contracts. No hosted row, customer data, image, external product URL, or provider payload is copied.

## 7. Static guard

`scripts/verify-local-supabase-replay-baseline.mjs` verifies:

- local adapters remain outside production migrations
- four core predecessor tables exist with UUID keys
- tracked post-state fields are excluded from timestamp zero
- the 20260525 bridge still corresponds to actual 20260526 dependencies
- the first tracked migration still depends on predecessor tables
- the final product boundary remains read-only for browser roles
- seed rows remain synthetic and idempotent
- workspace preparation retains marker, tmp-boundary, and hash controls
- mixed migration filename ordering stays correct

Commands:

```bash
npm run db:replay:verify
npm run db:replay:prepare
```

## 8. Review corrections applied

The implementation was reviewed against migration ownership, runtime security, and destructive-path safety.

Corrections incorporated before completion:

1. Rejected current-schema wholesale copying and retained historical provenance uncertainty.
2. Rejected the existing text-ID shadow schema as a production replay source.
3. Split timestamp-zero predecessor objects from the 20260526 untracked dependency bridge.
4. Moved hosted product RLS/policy restoration to a final local-only adapter rather than timestamp zero.
5. Used fail-visible core table DDL instead of `CREATE TABLE IF NOT EXISTS`.
6. Added byte-for-byte hash verification for copied tracked migrations.
7. Restricted generated output to ignored `tmp/` and required an ownership marker for cleanup.
8. Kept all seed data synthetic and external-link free.
9. Added a static dependency guard so later migration edits cannot silently invalidate the bridge.

## 9. Validation plan

Static gate:

```bash
npm ci
npm run db:replay:verify
npm run db:replay:prepare
npm run architecture:guard
npm run build
git diff --check
```

Dynamic local gate:

```bash
supabase start --workdir tmp/local-supabase-replay
supabase db reset --workdir tmp/local-supabase-replay
supabase db reset --workdir tmp/local-supabase-replay
supabase db lint --local --workdir tmp/local-supabase-replay
```

The two consecutive resets are mandatory. A single successful reset is insufficient because the workspace and seed must be deterministic.

## 10. Provider smoke resume gate

PR #50 remains Draft until all of the following are confirmed against the generated local project:

1. two consecutive clean resets pass
2. synthetic products are readable through the local anon key
3. analysis guard verification passes
4. anonymous write-grant verification passes
5. `/api/analyze` can complete without a hosted database dependency

Only then may the existing Lane B and Lane A image budgets be used. No additional image-bearing provider attempt is authorized by this DB task.

## 11. Remaining risk

The local replay adapter proves migration-chain executability and runtime compatibility. It does not prove the exact historical pre-20260410 schema.

The remaining external validation is local Supabase execution. Until that result exists, the DB Gate is `IMPLEMENTED_PENDING_LOCAL_RESET`, not PASS.
