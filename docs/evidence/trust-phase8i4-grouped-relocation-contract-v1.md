# TRUST Phase 8I-4A/B — Qualified Exact Grouped Replacement Lifecycle Contract v1

## 1. Purpose

Phase 8I-4 extends the governed Phase 8H relocation lifecycle for the case where multiple immutable historical Evidence Source identities share one reviewed old official-source binding.

The motivating Production shape is Beauty of Joseon Relief Sun Rice + Probiotics:

- historical Evidence Source IDs:
  - `4f74de41-9515-495c-8c93-19ab1cd3cf6d`
  - `60a55f19-a71d-4063-9ea5-13775193c940`
  - `f55720c7-0252-49b8-967c-8d77f4dfe6d6`
- one reviewed old binding:
  - `0dae6fce-111e-4d5b-9b6e-d87f95e9a40c`
- one reviewed old review:
  - `4db8f51b-6fa2-48ba-853d-8d2e65c7bfda`

The existing Phase 8H relocation ledger intentionally keeps `old_binding_id` unique. Phase 8I-4 must preserve that invariant instead of creating one relocation row per historical source.

## 2. Authority boundary

`READY_FOR_8I4` is a handoff state only.

It is not:

- relocation confirmation,
- semantic SAME,
- semantic CHANGED,
- Product Fact Current authority,
- Product Fact confirmation authority,
- recommendation authority.

Phase 8I-4A/B is read-only. No Production binding, relocation, Evidence Source, Product Fact, Current pointer, Confirmation, recommendation, or semantic state may be mutated.

## 3. Grouped lifecycle invariant

One reviewed old binding may produce at most one confirmed relocation authority row.

All historical source and transport incident lineage from the originating Phase 8I-3 case must remain attached to that one relocation through a separate grouped-lineage layer.

Required shape:

```text
Phase 8I-3 case
  ├─ historical source A
  ├─ historical source B
  ├─ historical source C
  ├─ incident 1..N
  └─ one reviewed old binding
           │
           └─ READY_FOR_8I4
                    │
             grouped preflight
                    │
            explicit Admin confirm
                    │
              one relocation
                    │
             grouped lineage
              ├─ source A
              ├─ source B
              ├─ source C
              └─ incident 1..N
```

The existing `trust_official_source_relocations.old_binding_id UNIQUE` constraint remains authoritative.

## 4. Phase 8I-4B preflight contract

Input contract:

`trust-phase8i4-grouped-relocation-preflight-input-v1`

Output contract:

`trust-phase8i4-grouped-relocation-preflight-v1`

Ready status:

`READY_FOR_ADMIN_GROUPED_RELOCATION_CONFIRMATION`

Hold status:

`HOLD`

Ready authority:

`PREFLIGHT_ONLY_REQUIRES_EXPLICIT_ADMIN_GROUPED_CONFIRMATION`

Mutation policy:

`READ_ONLY_GROUPED_PREFLIGHT_NO_PRODUCTION_WRITE`

The preflight is deterministic and database-free. A future database Admin RPC must independently reconstruct and revalidate the same lineage from authoritative tables.

## 5. Required ready conditions

A ready result requires all of the following:

1. Evaluation belongs to the exact drift case and has `result_kind=READY_FOR_8I4`.
2. Evaluation policy version, qualification digest, input digest, and result digest are valid.
3. Replacement locator is HTTPS, differs from the historical locator, and exactly matches the qualified candidate locator.
4. The evaluation preserves `qualified_historical_source_id` from the exact qualification that produced `READY_FOR_8I4`, and that source is a member of the complete grouped historical source set.
5. The case contains at least two distinct historical Evidence Source IDs.
6. The supplied historical source set exactly equals the case historical source set.
7. Incident IDs are non-empty and unique.
8. Every historical source remains bound to the same Product and Subject with `exact_subject_match` and `equivalent|narrower`.
9. Every historical source resolves to the same reviewed old binding and reviewed old review.
10. Every historical source canonical locator matches the reviewed old binding source URL.
11. The reviewed old binding is still `resolved`, product-scoped, and governed by `trust_official_source_review_v1`.
12. The reviewed old review still matches the governed Subject, market, variant, formulation, and source-kind lineage.
13. The governed Subject remains `resolved/current`.
14. Source/review/replacement market and locale remain coherent.

Any failure produces `HOLD`.

## 6. Canonical grouped digests

The preflight must sort `historical_source_ids[]`, historical-source snapshots, and `incident_ids[]` before hashing.

Therefore source or incident input ordering must not change:

- `group_prestate_digest`
- `group_plan_digest`

A missing or additional source/incident must change the digest or block readiness.

## 7. Database target model

The future deployable migration may add:

- `trust_official_source_relocation_groups`
- `trust_official_source_relocation_group_sources`
- `trust_official_source_relocation_group_incidents`

The group header binds exactly one:

- Phase 8I-3 case,
- `READY_FOR_8I4` evaluation,
- exact qualified historical-source anchor,
- existing Phase 8H relocation row,
- old binding,
- replacement binding,
- grouped prestate digest,
- grouped plan digest.

The source and incident membership tables preserve complete historical lineage without rewriting historical Evidence.

## 8. Security requirements

Any new `public` table must:

- enable RLS,
- revoke client write access,
- be append-only,
- grant only the minimum server-side read path required.

The singular `historical_source_id` required by the existing Phase 8H relocation row must be the exact `qualified_historical_source_id` that produced `READY_FOR_8I4`. It must never be selected arbitrarily from the grouped source set.

Any future privileged Admin RPC must:

- require `admin.products.review`,
- use an empty or pinned `search_path`,
- schema-qualify privileged relations,
- revoke EXECUTE from `PUBLIC`, `anon`, and `authenticated`,
- grant only the established server-side role,
- independently re-read all mutable prestate before mutation.

## 9. Production gate

Current Production Phase 8I-3 evaluations are `HOLD`.

Therefore Phase 8I-4 may implement and verify contract, blueprint, and synthetic dry-run behavior, but must not execute a Production relocation confirmation until a real case has a current `READY_FOR_8I4` evaluation.

## 10. Exit criteria for 8I-4A/B

8I-4A/B is complete when:

1. grouped authority and lineage contracts are frozen,
2. the preflight engine is brand-agnostic,
3. a three-source shared-binding synthetic fixture returns ready,
4. source/incident reorder preserves digests,
5. source omission, duplicate lineage, mixed binding, non-ready evaluation, or stale scope fail closed,
6. the implementation contains no database write client or mutation RPC,
7. exact-head CI is green,
8. Production remains unchanged.
