# 2026-10-12 / taxonomy-ai — Repository ↔ Supabase candidate migration inventory

> Watchtower-Track: taxonomy-ai
> **Result: CANDIDATE-ONLY / HOLD.** This is not a verified Production server project and not applied-SQL equivalence.
> Input repository: `gycha0109-beep/K_beauty`, pinned `main@12b329fbe1dee3da716e95fc983d49fe336ea766`.
> Input Supabase: connected **candidate** project `bygrczggxfuisupcevaz`; Supabase official `list_migrations` **metadata read**.
> Same investigation run: repository file listing fetched by pinned SHA, then candidate metadata fetched read-only. Counts are not reusable as future current-state authority.

## Results

| Classification | Count |
| --- | ---: |
| Repository `supabase/migrations/*.sql` | 145 files |
| Unique repository versions | 144 |
| Candidate `list_migrations` records / unique versions | 173 / 173 |
| Repository files with a matching candidate version | 101 |
| Repository files lacking a direct version counterpart | 44 |
| Candidate rows lacking a direct version counterpart | 72 |
| Unique normalized-name **candidate pairs** among unmatched records | **39** |
| Repository files remaining unmatched after name-candidate review | **5** |
| Candidate rows remaining unmatched after name-candidate review | **33** |
| Ambiguous duplicated-name candidate groups in this comparison | 0 |
| Repository duplicate version groups | **1**: `20260824` (2 distinct SQL files) |

Conservation check: `101 + 44 = 145`, `101 + 72 = 173`; and `44 - 39 = 5`, `72 - 39 = 33`. Every named candidate pair is a **name-only hypothesis**, not verified applied SQL. These counts are separately recomputed from this run; they are **not** a recombination of the 2026-10-10 143/171/37 snapshot or previous 144-file main.

### Repository-side unresolved 5

1. `20260824_backfill_product_english_display_names.sql` — legacy `20260824` version collides with `20260824_add_product_localized_names.sql`. Do not rename/replay.
2. `20260913202500_data_taxonomy2_candidate_manual_classification_v1.sql` — 29 candidate-only historical taxonomy entries require semantic and object-level reconstruction.
3. `20261001103000_data_ai29c_uva_r3d_registry_coexistence_v1.sql` — Registry/privilege side effects require owned review.
4. `20261009003000_data_ai29c_filter_r4_c_r2_bushman_subject_auth_v1.sql` — source marked `NOT DEPLOYED` in prior audit, never auto-apply.
5. `20261009043000_data_ai29c_filter_r4_c_r3_bushman_replay_digest_guard_v1.sql` — depends on preceding R2, never replay independently.

### Candidate-side remaining 33

- 29 entries in the `data_taxonomy2_*` family; historic expansion does not automatically equal repository's combined SQL.
- `v21_admission_g3a_emergency_revoke_exposed_runtime_password`: security-sensitive prior revoke; do not reverse or replay without Security review.
- Three `trust_phase8h3_relocation_*` verification/identity/research-hardening entries; TRUST lineage audit needed.

### New name-only candidate examples since earlier snapshot

- Repository `20261011013000_taxonomy_ai_automatic_evidence_history_store_v1.sql` and candidate `20261011055506_taxonomy_ai_automatic_evidence_history_store_v1`.
- Repository `20261012043000_taxonomy_ai_automatic_evidence_run_events_v1.sql` and candidate `20261012124047_taxonomy_ai_automatic_evidence_run_events_v1`.

The timestamps differ even though names align; no statement about identical SQL bytes or actual object state follows.

## Authority boundaries

- **taxonomy-ai:** data governance, migration inventory reconciliation and unresolved historical evidence; preserve `HOLD`.
- **face-research:** Face Lab required columns/functions and application behavior, not the whole database's schema authority.
- **security:** effective `GRANT`/RLS/SECURITY DEFINER analysis, password revoke lineage, dependency/security gate remediation.
- **platform/DB operations:** confirm server runtime Supabase Production identity, authorize any object readback/migration application.
- The existing `scripts/verify-database-integration-authority.mjs` checks static repository inventory, known collision policy and local target safety. The #1209 comparison module adds read-only cross-manifest candidate classification and must **not** be duplicated or used to trigger a migration.

## Execution inventory

- Official Supabase **`list_migrations`** called (metadata only).
- GitHub pinned source directory listing read.
- SQL statements executed: **0**; migration apply: **0**; database row reads: **0**; production writes: **0**; grant/RLS changes: **0**; runtime env/keys read: **0**.
- Production identity and installed object state: **not verified**, no claim of production readiness.
- Next authoritative step: Platform-approved server identity check, then same-date official migration readback and Security-reviewed object metadata evidence. Retain current mismatch until confirmed.

Related: [Issue #1213](https://github.com/gycha0109-beep/K_beauty/issues/1213), [PR #1209](https://github.com/gycha0109-beep/K_beauty/pull/1209), [ownership and supplier handoff #1229](https://github.com/gycha0109-beep/K_beauty/pull/1229).
