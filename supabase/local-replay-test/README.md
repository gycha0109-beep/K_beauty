# Local Supabase Replay Test

## Status

This directory implements a **local-only replay-equivalent predecessor contract** for the tracked Supabase migration chain.

It does not claim to reconstruct the exact historical SQL that originally created the hosted database. It exists because the tracked chain begins by altering `public.products` and `public.product_candidates`, and by reading `public.source_rankings`, without first creating those relations.

Nothing in this directory belongs in `supabase/migrations`.

## Safety boundary

- The generated project is written only under `tmp/local-supabase-replay/`.
- The preparation script does not execute Supabase commands.
- Linked project metadata is not copied.
- Tracked production migration files are copied byte-for-byte and hashed.
- Hosted rows, Auth users, images, and provider payloads are not copied.
- The seed contains five synthetic products using production-compatible UUID and enum contracts.
- The generated workspace uses isolated ports `56320` through `56322`.

Do not run link, push, pull, or remote SQL commands from the generated workspace.

## Adapter model

### `00000000_local_replay_predecessor.sql`

Creates only the four predecessor relations required by the tracked chain:

- `public.products`
- `public.product_candidates`
- `public.source_rankings`
- `public.recommendation_logs`

The six product fields converted by the first tracked migration use their replay input representation (`text`) rather than copying their current enum/array post-state.

### `20260525_local_replay_untracked_product_columns.sql`

Adds only the product columns consumed by the tracked `20260526_moisturizer_lotion_emulsion_insert.sql` but absent from earlier tracked migrations.

This is a chronology bridge, not a historical provenance claim.

### `99999999_local_replay_runtime_contract.sql`

Runs after the tracked chain and restores the current product read boundary needed by the application runtime:

- external source identity unique index
- products RLS
- anon/authenticated read-only policy
- service-role access

It does not recreate analysis guard or anonymous write-grant objects because those remain owned by their tracked migrations.

## Static verification

```bash
npm run db:replay:verify
```

The verifier checks:

- adapters remain outside production migrations
- core predecessor tables use UUID keys
- tracked post-state fields are not smuggled into the predecessor
- the 20260525 bridge still matches actual 20260526 dependencies
- product runtime access is read-only for browser roles
- seed data is synthetic and idempotent
- mixed eight-digit and fourteen-digit migration names preserve the intended order

## Build the disposable workspace

```bash
npm run db:replay:prepare
```

Generated output:

```text
tmp/local-supabase-replay/
├─ .kbeauty-local-replay-workspace
├─ replay-manifest.json
└─ supabase/
   ├─ config.toml
   ├─ seed.sql
   └─ migrations/
```

`replay-manifest.json` records SHA-256 hashes for every copied tracked migration and each local adapter.

## Local execution gate

After static verification and workspace preparation:

```bash
supabase start --workdir tmp/local-supabase-replay
supabase db reset --workdir tmp/local-supabase-replay
supabase db reset --workdir tmp/local-supabase-replay
supabase db lint --local --workdir tmp/local-supabase-replay
```

Required result before resuming the unified Vision provider smoke:

1. Two consecutive clean resets pass.
2. `public.products`, `public.product_candidates`, `public.source_rankings`, and `public.recommendation_logs` exist.
3. The five synthetic products are readable through the local anon key.
4. Analysis guard and anonymous write-grant verifiers pass against the generated local project.
5. No hosted database or provider image call occurs during this gate.

A failure in the replay project must be fixed in the local adapter layer or the tracked migration that owns the defect. Do not patch the hosted schema or weaken the production contract to make the smoke test pass.
