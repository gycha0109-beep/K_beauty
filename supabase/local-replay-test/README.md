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
- The seed contains exactly five synthetic products using UUID and final enum contracts.
- The generated workspace uses isolated ports `56320` through `56322`.
- Browser roles receive only product SELECT access in the local runtime adapter.

Do not run link, push, pull, or remote SQL commands from the generated workspace.

## Adapter model

### `00000000_local_replay_predecessor.sql`

Creates only the four predecessor relations required by the tracked chain:

- `public.products`
- `public.product_candidates`
- `public.source_rankings`
- `public.recommendation_logs`

The six product fields converted by the first tracked migration use their replay input representation (`text`) rather than copying their current enum/array post-state.

### `20260524054048_local_replay_category_mapper_preconditions.sql`

Runs immediately before `20260524054049_reclassify_existing_moisturizers.sql`.

It adds the three enum labels required by that tracked migration and drops the old `map_product_category(text)` function before the tracked migration changes its argument name.

### `20260525_local_replay_untracked_product_columns.sql`

Runs immediately before `20260526_moisturizer_lotion_emulsion_insert.sql` and adds only the product columns consumed by that tracked insert but absent from earlier tracked migrations.

This is an execution bridge, not a historical provenance claim.

### `99999999_local_replay_runtime_contract.sql`

Runs after the tracked chain and restores the local product read boundary needed by the application runtime:

- external source identity unique index
- products RLS
- `REVOKE ALL` from `public`, `anon`, and `authenticated`
- anon/authenticated SELECT-only policy
- service-role access

It does not recreate analysis guard or anonymous write-grant objects because those remain owned by their tracked migrations.

## Static verification

```bash
npm run db:replay:verify
```

The verifier checks:

- the adapter directory contains exactly the four expected local-only SQL files
- no local adapter appears in `supabase/migrations`
- core predecessor tables use UUID keys
- tracked post-state fields are not smuggled into the predecessor
- both compatibility adapters are immediately before their tracked anchors
- the bridge matches the tracked anchor's actual CTE columns
- product runtime access is SELECT-only for browser roles
- the seed contains exactly the five expected synthetic UUIDs and no external URLs
- the workflow uses pinned Supabase CLI, sanitized diagnostics, exact read cardinality, write-denial probes, and non-hidden successful cleanup

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

`replay-manifest.json` records SHA-256 hashes for every copied tracked migration and each local adapter in execution order.

## Local execution gate

After static verification and workspace preparation:

```bash
supabase start --workdir tmp/local-supabase-replay
supabase db reset --workdir tmp/local-supabase-replay
supabase db reset --workdir tmp/local-supabase-replay
supabase db lint --local --workdir tmp/local-supabase-replay
```

The GitHub Actions gate additionally requires:

1. exactly five synthetic products are anonymously readable
2. every returned row belongs to normalized brand `replay lab`
3. anonymous POST, PATCH, and DELETE are denied with `401` or `403`
4. successful-path cleanup completes without being ignored
5. failure artifacts contain only sanitized diagnostics
6. no hosted database or Provider image call occurs

A replay failure must be fixed in the local adapter layer or the tracked migration that owns the defect. Do not patch the hosted schema or weaken the production contract to make the gate pass.
