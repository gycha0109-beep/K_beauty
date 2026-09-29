# TRUST Phase 8I-4C — Grouped Relocation Confirmation Request Contract v1

## 1. Scope

Phase 8I-4C prepares an explicit Admin confirmation request for a grouped official-source relocation after Phase 8I-4B has produced a read-only ready preflight.

This phase does not execute a Production relocation.

Input authority remains:

`READY_FOR_8I4` → read-only grouped preflight → explicit Admin confirmation request.

No scheduler, transport worker, drift evaluator, or preflight may call the future confirmation RPC automatically.

## 2. Contract

Request contract:

`trust-phase8i4-grouped-relocation-confirmation-request-v1`

The request must contain:

- `case_id`
- `evaluation_id`
- `product_id`
- `subject_id`
- `qualified_historical_source_id`
- complete sorted `historical_source_ids[]`
- complete sorted `incident_ids[]`
- `expected_group_prestate_digest`
- `group_plan_digest`
- `qualification_contract`
- `qualification_digest`
- `old_binding_id`
- `old_review_id`
- `old_locator`
- replacement source identity
- explicit authority string
- explicit mutation scope
- explicit forbidden mutation list

## 3. Qualified historical source anchor

The existing Phase 8H relocation ledger requires one singular `historical_source_id`.

For a grouped 8I-4 relocation, that value is not arbitrary.

It must be exactly the `qualified_historical_source_id` preserved from the Phase 8I-3 `QUALIFIED_EXACT` result that produced the immutable `READY_FOR_8I4` evaluation.

The anchor must also be a member of the complete grouped historical source set.

All other historical sources remain immutable and are preserved in the grouped source-membership ledger.

## 4. Request authority

Authority:

`ADMIN_GROUPED_CONFIRMATION_REQUEST_REQUIRES_DATABASE_REVALIDATION`

A request object is not a relocation confirmation and grants no mutation authority by itself.

The future database Admin RPC must independently reconstruct and revalidate:

- current drift case,
- latest/current `READY_FOR_8I4` evaluation,
- exact qualified source anchor,
- complete source set,
- complete incident set,
- governed subject,
- reviewed old binding/review,
- replacement candidate,
- grouped prestate digest,
- grouped plan digest.

Any mismatch must fail closed before mutation.

## 5. Allowed mutation scope after future explicit Admin confirmation

Only the future database confirmation transaction may perform:

1. `CREATE_OR_REUSE_REPLACEMENT_PRODUCT_SOURCE_BINDING`
2. `CREATE_OR_REUSE_REPLACEMENT_OFFICIAL_SOURCE_REVIEW`
3. `RETIRE_OLD_REVIEWED_BINDING_ONCE`
4. `APPEND_SINGLE_RELOCATION_AUTHORITY_ROW`
5. `APPEND_GROUPED_RELOCATION_HEADER`
6. `APPEND_COMPLETE_GROUPED_SOURCE_LINEAGE`
7. `APPEND_COMPLETE_GROUPED_INCIDENT_LINEAGE`
8. `APPEND_ADMIN_AUDIT_EVENT`

The existing `trust_official_source_relocations.old_binding_id UNIQUE` invariant remains unchanged.

## 6. Forbidden mutations

The request and future grouped relocation lifecycle must not directly mutate:

- `PRODUCT_EVIDENCE_SOURCE_CANONICAL_LOCATOR`
- `PRODUCT_EVIDENCE_SOURCE_CONTENT_DIGEST`
- `PRODUCT_EVIDENCE_SOURCE_SUBJECT_BINDING`
- `PRODUCT_FACT_INSTANCE`
- `PRODUCT_FACT_CURRENT`
- `PRODUCT_FACT_CONFIRMATION`
- `RECOMMENDATION_AUTHORITY`
- `RECOMMENDATION_LOG`
- `SEMANTIC_SAME_CHANGED_RESOLUTION`

A confirmed relocation is provenance for a source-location lifecycle. It is not semantic SAME/CHANGED authority.

## 7. Idempotency and canonicalization

The request builder must consume the same grouped preflight engine used by Phase 8I-4B.

Source and incident ordering must not alter the ready preflight digests or request identity fields.

Tampering with:

- source membership,
- incident membership,
- qualified source anchor,
- replacement locator,
- old binding lineage,
- evaluation state,

must make the request unbuildable.

## 8. Production gate

Current Production Phase 8I-3 evaluations are `HOLD`.

Therefore this phase may merge the request contract and deterministic request builder, but no Production grouped relocation confirmation may run until an actual current evaluation is `READY_FOR_8I4`.

## 9. Next boundary

After this contract is sealed, the next implementation boundary is the database migration and privileged Admin preflight/confirmation RPC pair.

That migration must be generated through the repository's normal Supabase migration workflow and must not use an invented migration timestamp.
