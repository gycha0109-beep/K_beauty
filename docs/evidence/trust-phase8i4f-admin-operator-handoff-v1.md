# TRUST Phase 8I-4F — Admin Grouped Relocation Operator Handoff v1

## Purpose

Phase 8I-4F connects a real latest `READY_FOR_8I4` evaluation to the existing Phase 8I-4E database authority boundary through an explicit human Admin operation.

The operator surface must never turn `READY_FOR_8I4` into automatic relocation authority.

## Runtime sequence

```text
latest READY_FOR_8I4
  -> server-side DB grouped preflight
  -> server-side JS grouped preflight
  -> digest parity gate
  -> operator reviews old/replacement + complete grouped lineage
  -> explicit confirm
  -> server recomputes all preflight state
  -> preflight hash equality gate
  -> admin_confirm_trust_official_source_grouped_relocation_v1
  -> immutable grouped lineage readback
```

## Access boundary

Both mutation endpoints require:

- same-origin Admin mutation policy,
- authenticated Admin account,
- `admin.products.review`,
- server-side service-role execution.

The browser may send only the relocation identities and the non-authoritative preflight hash:

- `caseId`
- `evaluationId`
- `preflightHash`

The browser must never construct or submit the grouped confirmation authority payload.

## Queue boundary

The Admin queue contains only evaluations that are:

1. `READY_FOR_8I4`,
2. accepted by the database grouped preflight,
3. accepted by the JS grouped preflight,
4. digest-identical across both implementations,
5. not already present in the grouped relocation ledger.

A HOLD or stale evaluation is not displayed as confirmable.

## Dual-preflight parity

The application must fail closed unless DB and JS agree on:

- case/evaluation/Product/Subject,
- qualified historical-source anchor,
- complete source and incident membership,
- old binding/review/locator,
- replacement locator/external ID,
- qualification digest,
- grouped prestate digest,
- grouped plan digest,
- Phase 8H anchor prestate digest,
- Phase 8H anchor relocation-plan digest.

## Explicit confirmation

The UI must require a fresh preflight action before enabling confirmation.

At confirmation time the server re-runs both preflights and rebuilds the canonical nested Phase 8H request. A stale preflight hash blocks mutation.

Already-confirmed grouped relocations are returned as an idempotent readback without attempting a second mutation.

## Permanent authority invariants

Phase 8I-4F may confirm only source-binding relocation and grouped provenance.

It must not directly mutate or resolve:

- Product Fact Instance,
- Product Fact Current,
- Product Fact Confirmation,
- historical Evidence Source identity/content,
- Recommendation authority/log,
- semantic SAME/CHANGED.

No scheduler or transport worker may call the grouped confirmation RPC.

## Production gate

At implementation time Production contains no `READY_FOR_8I4` evaluation and no grouped relocation row.

Therefore Phase 8I-4F can be deployed and exercised in read-only/empty-queue mode. No real Production relocation is executed until a genuine latest `READY_FOR_8I4` evaluation exists and an authorized Admin explicitly confirms it.
