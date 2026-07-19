# Local Supabase Replay Baseline

## 1. Status

- Scope: isolated local migration replay only
- Production migration changes: none
- Hosted database changes: none
- Provider image calls: none
- Historical DDL claim: none
- Contract type: replay-equivalent local predecessor contract
- PR: `#66`
- Previous successful dynamic baseline: `e04f1ddf38f2ca150f63cc75af4ea321270369b6`, workflow run `29678512889`
- Hardened implementation validation: `49a8df58f84074f15ff7ef8f0b65c38b33b7cd9f`, workflow run `29681667668`, job `88178791673`, `SUCCESS`
- Final documentation-only attestation head must retain the same successful gate before merge approval

The historical pre-20260410 DDL provenance remains unresolved. This work does not promote the local adapter into an authoritative production schema.

## 2. Problem

The tracked migration chain starts with `20260410_safe_review_and_promotion_layer.sql`, but that migration alters `public.products` and `public.product_candidates` and reads `public.source_rankings` without creating those relations.

A later tracked operational insert, `20260526_moisturizer_lotion_emulsion_insert.sql`, also consumes nine product columns that have no earlier tracked creation migration in the repository.

The existing `supabase/local-shadow-test` bootstrap is not suitable evidence because it uses simplified contracts such as text product identifiers. Later migrations and runtime paths require UUID-compatible identities.

The safe schema dump establishes current hosted DDL, not the exact historical pre-20260410 schema or the introduction time of every untracked column. Copying the current schema wholesale into timestamp zero would invert tracked migration ownership.

## 3. Decision

The local replay contract is:

```text
empty isolated local Supabase
→ local-only predecessor adapter
→ tracked production migrations copied byte-for-byte
→ local-only compatibility adapters at explicit anchors
→ local-only runtime read adapter
→ synthetic seed
```

It exists only to prove that the tracked migration chain can execute against an explicit replay predecessor and provide the database boundary required by the Unified Vision Provider smoke.

It is not:

- a production migration
- a hosted schema mutation
- a reconstruction of exact historical DDL
- a copy of hosted rows
- a substitute for future provenance recovery

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
- fields owned by later tracked migrations are excluded
- recommendation logs begin behind RLS with browser roles revoked and service-role access granted
- core table creation does not use `CREATE TABLE IF NOT EXISTS`; unexpected drift must fail visibly

### 4.2 Category mapper preconditions

`20260524054048_local_replay_category_mapper_preconditions.sql` runs immediately before `20260524054049_reclassify_existing_moisturizers.sql`.

It adds only the enum values required by the tracked replacement migration:

- `toner_pad`
- `ampoule`
- `essence`

It also drops the existing `public.map_product_category(text)` because the tracked replacement changes the function argument name from `value` to `input`, which PostgreSQL rejects under `CREATE OR REPLACE FUNCTION` unless the prior function is removed.

### 4.3 Untracked dependency bridge

`20260525_local_replay_untracked_product_columns.sql` runs immediately before `20260526_moisturizer_lotion_emulsion_insert.sql` and adds only:

- `is_mens`
- `recommendation_tier`
- `size_ml`
- `unit_price_per_10ml`
- `hwahae_url`
- `external_source`
- `external_type`
- `external_id`
- `source_url`

This is an execution bridge, not a claim that all nine columns were introduced together historically.

### 4.4 Runtime read adapter

`99999999_local_replay_runtime_contract.sql` runs after the tracked chain and adds only the local product read boundary required by the application:

- external identity partial unique index
- products RLS
- `REVOKE ALL` from `public`, `anon`, and `authenticated`
- SELECT-only grant for `anon` and `authenticated`
- service-role access
- SELECT-only public read policy

Analysis request guard and anonymous write-grant objects are not reimplemented. Their tracked migrations remain authoritative.

## 5. Workspace generation

`scripts/prepare-local-supabase-replay.mjs` builds a disposable project only under `tmp/local-supabase-replay`.

Safety controls:

- output must remain below repository `tmp/`
- symlink components in the output path are rejected
- an ownership marker is required before an existing output directory can be removed
- only SQL files from `supabase/migrations` are copied
- copied tracked migrations are SHA-256 compared with their sources
- local adapters remain outside `supabase/migrations`
- linked metadata, `.supabase`, environment files, and credentials are not copied
- the generated manifest records ordered files, origins, and hashes
- preparation executes no Supabase or remote command

## 6. Seed contract

The seed contains exactly five synthetic rows:

- cleanser
- toner/essence
- serum
- moisturizer
- sunscreen

The rows use fixed UUIDs, the normalized brand `replay lab`, final enum/array contracts, and `ON CONFLICT ... DO NOTHING`.

The seed contains no hosted row, customer data, image, provider payload, or external URL.

## 7. Final independent review findings and corrections

The final review found five Important assurance gaps.

### 7.1 Exact seed cardinality

Previous CI queried `products?select=id&limit=5`. A database containing six or more rows could still return five and pass.

Correction:

- query the synthetic namespace with `normalized_brand = 'replay lab'` and no `limit`
- require exactly five matching rows
- require every returned row to carry the synthetic normalized brand
- do not require the entire `products` table to contain only five rows, because byte-identical tracked operational migrations legitimately insert their own rows during replay

### 7.2 Browser write denial

Previous dynamic CI proved anonymous SELECT but did not exercise denied writes.

Correction:

- strengthen the local runtime adapter to `REVOKE ALL` before granting SELECT
- dynamically require POST, PATCH, and DELETE to return `401` or `403`
- statically reject non-SELECT browser grants and non-SELECT product policies

### 7.3 Failure diagnostic secret exposure

`supabase start` output can include local anon/service-role keys and other local credentials. The previous workflow retained raw start/reset logs and uploaded them on a later failure.

Correction:

- raw logs are temporary and deleted after each command
- only failure excerpts are written to the diagnostics directory
- credential-bearing lines and connection-string passwords are removed before console output or artifact upload
- the artifact path contains only sanitized diagnostics

### 7.4 Cleanup result integrity

The previous cleanup step used unconditional `continue-on-error`, so a cleanup failure after otherwise successful validation could still produce a successful job.

Correction:

- successful-path cleanup is mandatory and may fail the job
- after a prior failure or cancellation, cleanup is best-effort so it cannot obscure the primary failure

### 7.5 Verifier soundness

The previous verifier relied heavily on normalized substring checks and did not inspect the actual adapter directory as an exact set. Some checks could be satisfied by comments or unrelated text, and the bridge ordering check did not require immediate adjacency.

Correction:

- strip SQL comments before contract inspection
- require the exact four-adapter set
- inspect the actual combined migration filename order
- require both compatibility adapters to be immediately before their tracked anchors
- parse the tracked bridge anchor CTE column list
- verify exact synthetic UUID and brand sets
- verify the workflow's pinned CLI, static gates, exact read, write-denial checks, sanitized diagnostics, and cleanup split

### 7.6 Review-gate self-corrections

The hardened checks were themselves exercised fail-closed before final acceptance.

- The first structural seed check counted both `brand` and `normalized_brand` occurrences and rejected the valid five-row seed. It was replaced with row-boundary checks for each fixed UUID, product name, display brand, and normalized brand.
- The first dynamic cardinality check queried the whole `products` table. That correctly exposed that tracked operational migrations add their own rows, but it was not the intended synthetic seed assertion. The gate now filters the explicit synthetic namespace and requires exactly five matching rows without weakening tracked migration replay.
- Verifier and anonymous-boundary failures are retained only as non-secret diagnostic codes; raw keys and connection credentials are not persisted.

## 8. Static validation

Required commands:

```bash
npm ci
npm run db:replay:verify
npm run db:replay:prepare
npm run architecture:guard
npm run build
git diff --check
```

The GitHub Actions workflow executes these gates on the PR merge ref before starting the local database.

## 9. Dynamic database gate

The latest PR head must pass:

```text
Local Supabase start
→ clean migration reset 1
→ clean migration reset 2 in the same workspace
→ DB lint
→ exact anonymous read of five synthetic products
→ anonymous INSERT denied
→ anonymous UPDATE denied
→ anonymous DELETE denied
→ mandatory successful-path cleanup
```

The previous implementation head `e04f1ddf38f2ca150f63cc75af4ea321270369b6` passed start, two resets, lint, anonymous read, and cleanup in run `29678512889`. That run is historical evidence only.

The hardened implementation head `49a8df58f84074f15ff7ef8f0b65c38b33b7cd9f` passed the complete static and dynamic gate in run `29681667668`, job `88178791673`, including exact synthetic read, anonymous write denial, and mandatory cleanup. A later documentation-only attestation commit must also pass because the workflow is path-scoped to this document.

## 10. Security and scope attestation

```text
Production migration changes: 0
Hosted Supabase access or mutation: 0
Remote schema changes: 0
Hosted product/user rows copied: 0
Provider image calls: 0
PR #50 changes: 0
Vision runtime changes: 0
Feature-code changes: 0
```

The workflow uses only the generated local project and pinned Supabase CLI `2.82.0`.

## 11. Provider smoke resume gate

PR #50 Provider smoke may resume only after PR #66's latest head passes the full static and dynamic gate.

PR #66 passing does not authorize:

- merging PR #66 without user approval
- changing PR #50 Draft state
- running Lane A or Lane B
- making another image-bearing Provider attempt

After user-approved merge of PR #66, PR #50 may be aligned to the updated base and then proceed through its separately budgeted Provider gates.

## 12. Remaining risk

The replay adapter proves migration-chain executability and local runtime compatibility. It does not prove the exact historical schema before `20260410_safe_review_and_promotion_layer.sql`.

That provenance uncertainty remains explicit and must not be silently converted into a production contract.
