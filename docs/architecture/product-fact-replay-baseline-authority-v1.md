# Product Fact Replay Baseline Authority v1

Status: **PF-3 local replay authority decision — design only, no baseline SQL, no replay evidence**

Authority reviewed for this decision:

```text
repository: gycha0109-beep/K_beauty
authoritative main: 300c21ec51450395da57186f4f4299137f5fb133
authoritative pre-PF2 tree: 0a0c11b0ee8c64766b730f70a859f2348b79cb5e
PF-2 migration: supabase/migrations/20260809115932_product_fact_storage_v1.sql
baseline authority version: product-fact-local-replay-baseline-v1
```

This document decides what repository-owned authority is sufficient for PF-3 Clean Replay, Upgrade Replay, and Rollback Verification when exact historical predecessor DDL is unavailable. It does not implement that authority package and does not claim Hosted or Production schema identity.

References:

- [Product Fact Storage / Admin Review Architecture v1](product-fact-storage-admin-review-v1.md)
- [Product Fact Subject / Formulation Scope v1](product-fact-subject-formulation-scope-v1.md)
- [Product Fact Registry Cross-Category v1](product-fact-registry-cross-category-v1.md)

---

## 1. Frozen evidence and honesty boundary

The repository and local Git object database were exhaustively audited before this decision:

```text
local refs searched: 142
SQL history and deleted/renamed SQL searched: YES
unreachable commits inspected: 95
unreachable blobs inspected: 1,270
canonical historical predecessor DDL found: NO
```

Exact historical authority is unavailable for:

```text
public.products
public.product_candidates
public.source_rankings
public.recommendation_logs
```

Unknown historical details include original types, defaults, constraints, indexes, RLS, grants, and creation order.

The only repository-owned predecessor SQL found is:

```text
commit: 8c1f093c1b9fc2a9af9c86174093759bcdd700a5
path: supabase/local-replay-test/adapters/00000000_local_replay_predecessor.sql
expanded replay package: a3cb2c1a923974e4e448a3bc4e1ea0c53381b20e
```

That artifact correctly identifies itself as a local-only replay-equivalent contract and explicitly disclaims exact historical DDL identity. This distinction is frozen:

```text
Historical Baseline
!= Replay Baseline

Replay Baseline
= local test authority
+ migration prerequisite model
+ verification contract
!= historical Production DDL
!= historical Hosted schema
!= original migration history
```

No PF-3 report may shorten `replay-equivalent` to `historically equivalent`, `Production equivalent`, or `exact schema reconstruction`.

---

## 2. What PF-3 must prove

The upstream architecture separates these gates:

```text
Clean Replay
→ complete tracked migration-chain compatibility from a fresh disposable database

Upgrade Replay
→ deterministic pre-PF2 repository-state contract + bounded legacy data
→ PF-2 apply
→ inspected legacy schema/data unchanged

Rollback Verification
→ PF-2 prerequisite-compatible local prestate
→ deterministic failure inside the PF-2 transaction
→ no partial Product Fact objects and legacy sentinel unchanged
```

PF-3 does not need to prove that an empty local database can recreate the unknown byte-for-byte historical Production predecessor schema. It must remain honest about the lower fidelity of a governed test baseline.

The three gates do not require identical authority fidelity.

---

## 3. Decision matrix

| Criterion | Option A — exact history only | Option B — one replay-equivalent baseline for all gates | Option C — split authority by replay type |
| --- | --- | --- | --- |
| Semantic correctness | Potentially highest, but unavailable | Good for chain execution | High when each gate has a purpose-specific contract |
| Historical honesty | High | High only with strict disclaimer | High; fidelity tier is explicit per result |
| Migration-defect detection | High in theory | Medium; one permissive fixture can mask drift | High with separate inventory, fingerprints, and mutation guards |
| False-confidence risk | Low claim risk, but permanent blockage | High for Upgrade if Clean authority is over-promoted | Lowest practical risk |
| Clean replay usefulness | None while provenance is absent | High | High |
| Upgrade fidelity | Unavailable | Insufficient by itself | Strong deterministic pre-PF2 schema/data contract |
| Rollback validity | Blocked unnecessarily | Sufficient if PF-2 prerequisites are present | Sufficient with a smaller atomicity authority |
| Determinism | Cannot be constructed | Achievable | Achievable and independently reviewable |
| Future maintenance | Permanent external dependency | Simple but overly broad | More explicit artifacts, safer invalidation |
| Hosted independence | No | Yes | Yes |
| Production safety | No access, but no progress | Local-only | Local-only |

Decision:

```text
OPTION C — SPLIT AUTHORITY BY REPLAY TYPE
```

Option A is rejected as a PF-3 requirement because it makes repository-only verification permanently dependent on unavailable evidence. Option B is rejected because Clean chain executability is not strong enough authority for legacy-preserving Upgrade claims.

---

## 4. Frozen D1 authority decision

```text
D1 — FROZEN

Exact historical predecessor DDL is NOT required for PF-3 Clean Replay
or PF-3 Rollback Verification.

Clean Replay accepts a governed replay-equivalent predecessor contract.
Rollback Verification accepts a PF-2 prerequisite-compatible governed prestate.

Upgrade Replay requires a stronger deterministic pre-PF2 schema/data contract
derived from the authoritative pre-PF2 repository tree. It does not require
the unknown original creation DDL and must not claim historical identity.
```

---

## 5. Clean Replay authority

Selected model:

```text
C3 — repository migration chain from a frozen governed predecessor contract
```

Clean means a newly created disposable local database with no retained developer state. The governed predecessor package is then applied as an explicit test precondition before every tracked production migration is applied in canonical order.

Clean Replay proves:

- the approved predecessor contract is sufficient and no broader local state is required;
- every tracked production migration is applied in order and exactly once;
- PF-2 can be reached through the complete tracked chain;
- no tracked migration or Product Fact migration is edited to make replay pass.

Clean Replay does not prove:

- exact historical Production reconstruction;
- Hosted schema parity;
- that compatibility bridges describe original creation history;
- Upgrade preservation of every legacy object.

Approved state:

```text
PF3_CLEAN_REPLAY_BASELINE_AUTHORITY_APPROVED = YES
```

Evidence cannot be declared until the governed package is implemented, digested, mutation-tested, and replayed.

---

## 6. Upgrade Replay authority

Selected model:

```text
U2 — deterministic schema/data contract derived from authoritative pre-PF2
repository state, not exact original creation DDL
```

The Upgrade authority is a materialized and frozen pre-PF2 contract at:

```text
0a0c11b0ee8c64766b730f70a859f2348b79cb5e
```

It must be constructed reproducibly from:

1. the approved governed predecessor package;
2. an explicit ordered manifest of every local-only compatibility bridge;
3. the exact tracked migrations present at the pre-PF2 repository tree;
4. a complete deterministic catalog fingerprint for the governed legacy schema surface;
5. bounded synthetic legacy sentinels with deterministic row fingerprints;
6. an exact migration-ledger fingerprint ending immediately before PF-2;
7. proof that all 12 Product Fact tables and other Product Fact objects are absent.

The Upgrade authority is the resulting pre-PF2 contract, not the initial predecessor adapter by itself. At minimum its preservation surface must cover:

- `products`, including the sentinel primary key and `cleansing_profile` where present;
- `product_metadata_field_reviews`;
- inspected Admin v1/v2 persistence relations;
- selected row counts, deterministic row serialization, constraints, columns, types, and privileges;
- the exact pre-PF2 migration ledger.

The contract may truthfully be called `repository-derived pre-PF2 replay state`. It may not be called historical Production state or Hosted-equivalent state.

Approved state:

```text
PF3_UPGRADE_REPLAY_BASELINE_AUTHORITY_APPROVED = YES
```

This approves the authority model only. The materialized contract and its fingerprint do not yet exist.

---

## 7. Rollback Verification authority

Selected model:

```text
R2 — minimal PF-2 prerequisite-compatible governed local prestate
```

PF-2 rollback verification proves transaction atomicity, absence of partial Product Fact objects, preservation of a bounded legacy sentinel, and successful canonical reapply after the intentional failure.

The minimum authority requires:

- disposable local PostgreSQL/Supabase infrastructure;
- local Supabase-owned roles and `auth.users` contract required by PF-2 FKs;
- the `extensions` schema and locally available `pgcrypto` extension contract;
- `public.products(id)` with a UUID-compatible unique/primary-key target;
- zero pre-existing Product Fact objects;
- a bounded legacy schema/data fingerprint that must remain unchanged;
- exact canonical PF-2 migration bytes.

Exact pre-20260410 predecessor DDL is irrelevant to whether PostgreSQL rolls back the PF-2 transaction atomically. The stronger Upgrade prestate should be reused when available, but it is not logically required for the Rollback result.

Approved state:

```text
PF3_ROLLBACK_BASELINE_AUTHORITY_APPROVED = YES
```

---

## 8. Minimum predecessor contract

### 8.1 `public.products`

Required for migration execution:

- UUID-compatible `id` with a PK/unique constraint usable by later FKs;
- `name`, `brand`, `category`, `price_min`, `price_max`, `buy_link`, `image_url`, and `created_at`;
- legacy input representations for `skin_types`, `concerns`, `texture`, `finish`, and `irritation_risk` that the first migration converts;
- `sensitivity_safe` compatible with the first migration's NOT NULL contract;
- no columns that the first tracked migration is responsible for creating.

Required for Upgrade preservation:

- bounded synthetic product rows;
- deterministic values and serialization;
- complete governed pre-PF2 column/type/constraint fingerprint.

Incidental historical detail:

- unknown original default expression names;
- unknown non-required historical indexes;
- unknown historical RLS/policy/grant choices unless admitted separately into the governed contract.

### 8.2 `public.product_candidates`

Required for migration execution:

- UUID-compatible `id` with later-FK compatibility;
- `source_name`, `category_path`, `normalized_name`, `normalized_brand`, and `created_at` used by the first migration's indexes/view;
- raw name/brand, status, and timestamp fields required by later tracked candidate ingestion and promotion migrations;
- no review/product-form/external identity columns owned by later tracked migrations.

Required for Upgrade preservation:

- a bounded candidate sentinel only when all FK/input prerequisites are constructable;
- deterministic schema and row fingerprints.

Incidental historical detail:

- unused original defaults, status history, and indexes not required by tracked migration execution or the approved sentinel.

### 8.3 `public.source_rankings`

Required for migration execution:

- UUID-compatible identity;
- `source_name`, `category_path`, `rank_position`, `product_name`, `brand_name`, and `collected_at` used by the first migration's evidence view;
- fields required by later ranking snapshot migration inputs;
- no `snapshot_id`, `candidate_id`, or `raw_item` columns owned by later tracked migrations.

Required for Upgrade preservation:

- deterministic schema fingerprint;
- sentinel rows only if they add preservation coverage without external data.

Incidental historical detail:

- optional ranking metadata not read or altered by the tracked chain.

### 8.4 `public.recommendation_logs`

Required for migration execution:

- the relation must exist before `20260711032649_sec_05_anonymous_write_grants.sql`;
- it must accept the migration-owned `anonymous_write_grant_use_id` UUID FK and unique index;
- the later-owned column must not pre-exist.

Required for Upgrade preservation:

- an explicitly governed bounded legacy row/schema fingerprint if recommendation-log preservation is claimed.

Incidental historical detail:

- logging fields, legacy indexes, RLS, grants, and policies not required for migration execution unless separately admitted and justified by the governed contract.

### 8.5 Mid-chain compatibility gaps

The expanded replay package identifies two independent tracked-chain gaps:

```text
20260524054048_local_replay_category_mapper_preconditions.sql
→ enum input labels and function parameter replacement compatibility

20260525_local_replay_untracked_product_columns.sql
→ product columns consumed by the tracked 20260526 insert but absent from prior tracked migrations
```

These are governed compatibility bridges, not predecessor history. They must have separate manifest entries, derivation evidence, anchors, digests, and mutation guards. They must never be silently folded into the initial baseline or described as tracked production migrations.

The post-chain `99999999_local_replay_runtime_contract.sql` is not part of PF-3 baseline authority. It may be tested separately as a local runtime contract but cannot influence Clean, Upgrade, or Rollback acceptance.

---

## 9. Existing adapter verdict

```text
ADAPTER_REQUIRES_REVISION
```

Positive findings:

- it covers all four known predecessor relations;
- it uses pre-conversion scalar input forms for the first migration;
- it does not claim historical fidelity;
- it excludes several columns that tracked migrations own;
- the expanded package places known compatibility bridges immediately before their failing anchors.

Reasons it cannot be approved unchanged:

1. it is not present on authoritative main;
2. it has no immutable PF-3 baseline version or deterministic package digest;
3. its columns, constraints, indexes, RLS, and grants are not independently classified as execution-required, preservation-required, or incidental;
4. the full replay depends on two mid-chain bridges that can mask migration-history gaps if treated as ordinary baseline state;
5. the post-chain runtime adapter is mixed into the old package even though it is outside PF-3 baseline authority;
6. there are no required negative mutation guards proving each prerequisite is meaningful;
7. it does not produce the stronger pre-PF2 schema/data fingerprint required for Upgrade Replay.

The existing SQL is evidence and a design input. It must not be copied unchanged and relabeled as authoritative.

---

## 10. Governed baseline package contract

The implementation task must create a versioned package with this logical manifest:

```text
baseline_version
scope
predecessor_objects
predecessor_fixture_paths
ordered_compatibility_bridges
bridge_anchor_migrations
source_evidence
known_non_historical
canonical_sha256
source_git_blob_ids
compatible_first_migration
compatible_last_pre_pf2_migration
pre_pf2_repository_sha
last_reviewed_main
```

Frozen requirements:

- local/test only;
- never placed in `supabase/migrations`;
- no historical or Hosted identity claim;
- exact predecessor object allowlist;
- no backward leakage of post-migration objects or columns;
- bridge files separated from predecessor state and anchored explicitly;
- immutable after evidence is collected;
- any semantic change creates a new version;
- baseline changes invalidate evidence and require re-review;
- generated temporary Supabase config remains isolated and local-only.

Recommended identity:

```text
product-fact-local-replay-baseline-v1
```

---

## 11. Versioning and digest

The package must record both Git provenance and a platform-independent SHA-256 digest.

Canonical digest algorithm:

1. sort package files by repository-relative POSIX path;
2. normalize text to UTF-8 with LF line endings;
3. reject BOMs, symlinks, duplicate paths, and files outside the allowlist;
4. hash a length-delimited sequence of path bytes and normalized content bytes;
5. include the canonical manifest, predecessor SQL, bridge SQL, and bounded sentinel definitions;
6. record each source file's Git blob ID separately;
7. print no credentials or connection strings.

Once a replay result cites `baseline_version + canonical_sha256`, any digest change is a new authority review, not an in-place correction.

---

## 12. Circularity controls and mutation guards

Passing replay is not evidence that the baseline is correct merely because the baseline was written to make replay pass. Approval requires all of these independent controls:

- a frozen migration-precondition inventory separate from fixture SQL;
- an exact object/column allowlist;
- static rejection of post-migration columns in predecessor fixtures;
- an ordered bridge manifest separate from tracked production migrations;
- baseline and bridge digests computed before runtime replay;
- independent review of the contract before execution results are accepted;
- negative mutations with expected failure migration, statement context, and SQLSTATE class.

Required mutations:

| Mutation | Expected result |
| --- | --- |
| remove `products` | first migration fails with missing relation |
| remove each converted `products` input column class | first migration fails at the owning ALTER/UPDATE |
| replace legacy category input representation with post-state enum/array leakage | static baseline verifier rejects it |
| remove `product_candidates.created_at` or normalized/source fields | first migration index/view fails |
| remove a required `source_rankings` field | first migration evidence view fails |
| remove `recommendation_logs` | SEC-05 migration fails with missing relation |
| pre-create `anonymous_write_grant_use_id` | static ownership guard rejects post-migration leakage |
| remove required category labels bridge | anchored migration fails rather than silently remapping |
| remove the mapper function compatibility action | anchored migration reproduces the PostgreSQL function replacement failure |
| remove one untracked product-column bridge field | 20260526 migration fails with missing column |
| change bridge order or anchor | manifest/order verifier fails before DB execution |
| add an unexpected object/file | exact allowlist verifier fails |
| change any fixture or manifest byte | digest verification fails and prior evidence is invalid |

Mutations must never edit tracked production migrations. They operate on runtime temporary copies or bounded test fixtures.

---

## 13. Re-review and invalidation matrix

| Trigger | Classification | Consequence |
| --- | --- | --- |
| any tracked production migration before PF-2 changes | `HARD_INVALIDATE` | Clean and Upgrade evidence invalid; regenerate manifests/fingerprints and replay |
| PF-2 migration bytes change | `HARD_INVALIDATE` | all PF-3 evidence invalid |
| predecessor object or required-column contract changes | `HARD_INVALIDATE` | new baseline version and full review |
| `products` prerequisite contract changes | `HARD_INVALIDATE` | all three gate authorities re-reviewed |
| `product_candidates` prerequisite contract changes | `HARD_INVALIDATE` | Clean/Upgrade re-reviewed; Rollback if its prestate uses it |
| `source_rankings` prerequisite contract changes | `HARD_INVALIDATE` | Clean/Upgrade re-reviewed |
| `recommendation_logs` prerequisite contract changes | `HARD_INVALIDATE` | Clean/Upgrade re-reviewed |
| compatibility bridge content/order/anchor changes | `HARD_INVALIDATE` | Clean/Upgrade evidence invalid |
| baseline fixture or manifest digest changes | `HARD_INVALIDATE` | prior evidence cannot be reused |
| authoritative pre-PF2 SHA changes | `HARD_INVALIDATE` | Upgrade contract must be regenerated |
| Supabase CLI or PostgreSQL major compatibility changes | `REVIEW_REQUIRED` | prior evidence remains scoped to its recorded toolchain; rerun before claiming new-toolchain support |
| migration strictly after PF-2 changes | `REVIEW_REQUIRED` | current-target Clean chain replays; PF-2 Upgrade/Rollback evidence remains separately scoped |
| prose-only clarification with unchanged manifest/digest | `NO_REVIEW` | no replay invalidation |

`HARD_INVALIDATE` means old evidence remains an historical record but cannot support the current authority version.

---

## 14. Reporting and state boundaries

Every future PF-3 result must report:

```text
baseline_version
baseline_canonical_sha256
source Git blob IDs
pre-PF2 repository SHA
Supabase CLI version
PostgreSQL image/version
local host/port without credentials
authority tier: CLEAN | UPGRADE | ROLLBACK
historical identity claimed: NO
```

This decision authorizes only these design states:

```text
PF3_REPLAY_BASELINE_AUTHORITY_DECIDED = YES
PF3_CLEAN_REPLAY_BASELINE_AUTHORITY_APPROVED = YES
PF3_UPGRADE_REPLAY_BASELINE_AUTHORITY_APPROVED = YES
PF3_ROLLBACK_BASELINE_AUTHORITY_APPROVED = YES
```

It does not authorize replay success:

```text
PRODUCT_FACT_LOCAL_CLEAN_REPLAY_VERIFIED = NO
PRODUCT_FACT_LOCAL_UPGRADE_REPLAY_VERIFIED = NO
PRODUCT_FACT_LOCAL_ROLLBACK_VERIFIED = NO
PF3_LOCAL_DB_REPLAY_VERIFIED = NO

PRODUCT_FACT_LOCAL_MIGRATION_REPLAY_NOT_VERIFIED
= UNRESOLVED
```

It also does not authorize Hosted migration, Production DB access/write, Admin Product Fact implementation, catalog adoption/backfill, Phase 3B import, Decision Axis work, Recommendation activation, or PF-4.

---

## 15. Implementation gate

The authority model is decided, but no governed package exists on authoritative main.

Current blocker:

```text
PF3_REPLAY_BASELINE_NOT_IMPLEMENTED
```

Next single task:

```text
PF-3B — Implement Governed Local Replay Baseline v1
```

That task may implement only the approved local/test package, manifest, digest verifier, mutation guards, and deterministic pre-PF2 contract. It must not automatically execute PF-3 full replay or start PF-4.
