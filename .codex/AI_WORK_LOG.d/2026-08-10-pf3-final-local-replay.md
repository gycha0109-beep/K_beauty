# PF-3 final governed local replay evidence

- Authority and boundary: exact main `a73be5619e171dcb3dd29d7d3d0ea8b7fd63cb61` in isolated worktree `C:\Users\hun\Documents\K-beauty-AI-pf3-final`, branch `test/product-fact-final-local-replay`. This was a local-only verification. Hosted, Production, and existing developer databases were not accessed.
- Toolchain: Supabase CLI `2.82.0`; Docker Engine `29.6.1` / Docker Desktop `4.81.0`; disposable database image `public.ecr.aws/supabase/postgres:15.8.1.085`. Local ports were `127.0.0.1:57420-57422` (database `57422`); no credentials are recorded.
- PF-3B gate: `node --check scripts/verify-product-fact-replay-baseline-v1.mjs` passed. The focused verifier passed with baseline digest `aa2e877cbcd3d40d0cbda4a959b8befcc2879c7b43cfdc5faf1ba7035489f158`, 35 pre-PF2 migrations, three bridges, and LF/CRLF mutation guards `17/17` each.

## Clean replay

- A first fresh stack applied the governed predecessor, all three approved compatibility bridges, and all 35 tracked pre-PF2 migrations. Immediately before PF-2, Product Fact object count was `0`.
- The exact canonical `supabase/migrations/20260809115932_product_fact_storage_v1.sql` was applied once with fail-fast `psql` semantics. The installed CLI's prepared-query path rejected the multi-statement file before execution (`SQLSTATE 42601`); catalog inspection confirmed zero Product Fact objects, and the unchanged canonical bytes were then applied through the disposable local PostgreSQL container.
- Post-PF2: Product Fact tables `12/12`; RLS `12/12`; policies `0`; direct browser-role writes `0`; direct `PUBLIC` writes `0`; `service_role` writes `0`; `service_role` SELECT grants `12/12`; total Product Fact rows `0`.
- Direct catalog inspection confirmed the exact current-pointer composite FK and proposition-key check, confirmation request/result constraints, semantic-status/value-type/typed-value constraints, review-event target/kind checks, and the append-only review-event contract comment. Governed legacy relations remained present and were not replaced.
- Result: `PRODUCT_FACT_LOCAL_CLEAN_REPLAY_VERIFIED = YES`. The Clean stack, containers, volumes, listeners, and runtime workspace were removed.

## Upgrade replay

- A second fresh stack reconstructed pre-PF2 repository authority `0a0c11b0ee8c64766b730f70a859f2348b79cb5e`: tracked migrations `35/35`, bridges `3/3`, Product Fact objects `0`.
- Before PF-2: schema fingerprint `fc06629e9d9b841842e174a15c8cc01443199413cad3f448e82692bd1579756a`; sentinel fingerprint `4fec93aa21308d9ed1de6a7c6c495d477b8be25e43c7a15d446f7bbb91e24c71`; migration-ledger fingerprint `130a474f7b718a1e468473078467b1798314f91b281f2fdd900a9b9ffde65446`.
- After exact canonical PF-2: the governed legacy schema fingerprint and sentinel fingerprint were byte-identical; all five fixed sentinel rows and all four governed zero-row Admin relations were unchanged; Product Fact tables `12/12`; Product Fact rows `0`; RLS/grants/constraint results matched Clean replay.
- Result: `PRODUCT_FACT_LOCAL_UPGRADE_REPLAY_VERIFIED = YES`. The Upgrade stack, containers, volumes, listeners, and runtime workspace were removed.

## Rollback / atomicity replay

- A third fresh stack reconstructed the same approved R2 prestate. Before failure: legacy schema fingerprint `fc06629e9d9b841842e174a15c8cc01443199413cad3f448e82692bd1579756a`; legacy data fingerprint `4fec93aa21308d9ed1de6a7c6c495d477b8be25e43c7a15d446f7bbb91e24c71`; Product Fact objects `0`.
- A runtime-only copy preserved the canonical `BEGIN` and injected exactly one `pf3_intentional_rollback_probe` after the final table comment and immediately before the final `COMMIT`. Fail-fast execution exited `1` with the expected exception (`SQLSTATE P0001`). The tracked migration was not modified.
- After failure: Product Fact relations `0`, tables `0`, indexes `0`, constraints `0`, policies `0`, privileges `0`, comments `0`, and types `0`. Legacy schema and data fingerprints were exactly unchanged.
- Canonical PF-2 remained raw SHA-256 `1d23c706efa220d65cba98983636dd3d0ebb26a035593267a4a7c72cc52c8b4a`, Git blob `676afbc56bf90443a1198f93427382f067d19407`.
- Result: `PRODUCT_FACT_LOCAL_ROLLBACK_VERIFIED = YES`. The Rollback stack, containers, volumes, listeners, fault copy, and runtime workspace were removed.

## Final state and cleanup

- `PF3_LOCAL_DB_REPLAY_VERIFIED = YES`.
- `PRODUCT_FACT_LOCAL_MIGRATION_REPLAY_NOT_VERIFIED = RESOLVED`.
- Existing developer DB touched: `NO`. Hosted touched: `NO`. Production touched: `NO`.
- Remaining PF-3 containers: `0`; volumes: `0`; listeners on `57420-57422`: `0`; temporary replay workspaces/files: `0`.
- Scope ceiling preserved: no Hosted migration, PF-4, Admin Product Fact runtime, catalog import/backfill, Decision Axis, or Recommendation activation work was performed.
