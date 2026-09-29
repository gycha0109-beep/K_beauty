# TRUST Phase 8I-4G — FIRST_REAL_READY_FOR_8I4_CANARY v1

## Purpose

Phase 8I-4G proves the first real Production lifecycle from an organically produced `READY_FOR_8I4` evaluation through explicit human Admin grouped relocation confirmation and post-confirmation verification.

Phase 8I-4G does **not** manufacture a READY evaluation and does **not** grant automatic relocation authority.

## Entry state

The implementation baseline is:

- Phase 8I-3E first scheduled Production observation: PASS.
- Phase 8I-4F Admin operator handoff: deployed and closed.
- Production `READY_FOR_8I4 = 0`.
- Production grouped relocation rows = 0.
- Existing Phase 8H relocation rows = 1.

When no real candidate exists, the canonical state is:

`WAITING_FOR_REAL_READY_FOR_8I4`

## Real candidate provenance

The first-real canary accepts only a latest `READY_FOR_8I4` evaluation produced by the governed scheduled Phase 8I-3E path.

Its request identity must match the scheduled worker lineage:

`phase8i3:phase8i3e-scheduled-<github-run-id>-<attempt>:<case-id>`

Synthetic, rollback, probe, manually injected, and Phase 8I-3D manual-record evaluations are not 8I-4G real-canary authority.

Detection is read-only. Detection is not approval.

## Candidate state machine

```text
WAITING_FOR_REAL_READY_FOR_8I4
  -> REAL_READY_DETECTED_REQUIRES_ADMIN_PREFLIGHT
  -> ADMIN_DUAL_PREFLIGHT_READY
  -> EXPLICIT_HUMAN_CONFIRMATION
  -> GROUPED_RELOCATION_CONFIRMED
  -> POST_CONFIRM_CANARY_VERIFICATION
  -> PASS | HOLD | FAIL
```

`READY_FOR_8I4`, detection, preflight, and parity PASS are each non-authoritative until the Admin explicitly confirms.

## Single-canary blast radius

Before the first real grouped relocation is closed, exactly one eligible real candidate is designated as the canary candidate.

Other READY candidates may be visible, but they are queued behind the first canary and must not be used as the 8I-4G first-real canary until the first candidate is completed.

The canonical first candidate is the oldest eligible scheduled real READY evaluation after excluding an already-confirmed grouped relocation.

## Read-only scheduled detection

The existing scheduled TRUST workflow may execute a read-only canary snapshot after Phase 8I-3E evaluation.

The snapshot may read:

- drift evaluations and their request provenance,
- drift cases,
- case-to-source/incident lineage,
- grouped relocation existence,
- global authority-surface counts.

The scheduled path must never call:

- `admin_preflight_trust_official_source_grouped_relocation_v1` with an invented Admin actor,
- `admin_confirm_trust_official_source_grouped_relocation_v1`,
- `admin_confirm_trust_official_source_relocation_v1`.

No scheduler or worker may approve relocation.

## Pre-confirmation snapshot

Immediately before an authorized human confirmation, capture the candidate's authority snapshot.

It must preserve:

- case/evaluation/Product/Subject,
- qualified historical source,
- complete historical source IDs,
- complete incident IDs,
- old binding/review/locator,
- replacement locator,
- qualification digest,
- grouped prestate and plan digests,
- Phase 8H anchor prestate and relocation-plan digests,
- protected Product Fact, Evidence Source, Recommendation state.

## Allowed mutation

A successful canary confirmation may cause only the governed relocation lifecycle:

- old reviewed binding: `resolved -> retired`,
- replacement binding: create-or-reuse `resolved`,
- replacement official-source review: create-or-reuse,
- exactly one Phase 8H relocation authority row for the old binding,
- exactly one grouped relocation header,
- complete grouped source lineage,
- complete grouped incident lineage,
- Admin audit event.

## Forbidden mutation

Phase 8I-4G must not directly mutate or resolve:

- Product Fact Instance,
- Product Fact Current,
- Product Fact Confirmation,
- historical Product Evidence Source identity, locator, or content digest,
- Product Evidence Source subject binding,
- Recommendation authority or Recommendation log,
- semantic SAME/CHANGED.

Source relocation is not Product Fact semantic authority.

## Grouped lineage completeness

For a confirmed canary:

```text
case historical source set
==
pre-confirmation source set
==
grouped relocation source set
```

and

```text
case incident set
==
pre-confirmation incident set
==
grouped relocation incident set
```

No missing or extra source/incident identity is permitted.

## Idempotent replay

The same already-confirmed canary may be replayed only to verify idempotency.

The replay must return the same group and relocation identities with `idempotent = true` and create no additional relocation, group, source-lineage, incident-lineage, binding, review, Product Fact, Evidence Source, Recommendation, or semantic authority rows.

The automated scheduler never performs this replay; it is an explicit canary verification action after the human confirmation.

## Phase 8H-3 downstream handoff

After grouped relocation confirmation, downstream revalidation remains owned by the existing Phase 8H-3 relocation-aware lifecycle.

8I-4G verifies that the confirmed relocation can be handed to Phase 8H-3 without granting automatic semantic SAME/CHANGED authority.

8I-4G must not duplicate the Phase 8H-3 Product Fact adjudication engine.

## Result

- `PASS`: one real scheduled READY candidate, explicit human confirmation, exactly one governed relocation, complete grouped lineage, idempotent replay, protected authority surfaces unchanged, downstream Phase 8H-3 handoff valid.
- `HOLD`: candidate exists but confirmation is blocked before mutation by provenance, freshness, preflight, parity, or stale-state checks.
- `FAIL`: post-confirmation invariant, lineage, idempotency, or downstream handoff violation.

A FAIL halts further grouped canary confirmations until reviewed.

## Current Production state

At this contract's creation there is no real READY candidate. Therefore implementation and scheduled read-only detection are allowed, but no Production grouped confirmation is executed.

Canonical state: `WAITING_FOR_REAL_READY_FOR_8I4`.
