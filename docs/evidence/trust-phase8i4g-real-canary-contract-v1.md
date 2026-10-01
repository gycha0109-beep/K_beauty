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

### Activation signal

When the read-only scheduled snapshot changes to
`REAL_READY_DETECTED_REQUIRES_ADMIN_PREFLIGHT`, CI may emit one bounded warning
and summary so the operator does not miss the first real candidate.

The activation signal may expose only bounded identifiers, source/incident
counts, the snapshot digest, and the fact that Admin attention is required. It
must not expose the replacement locator, raw evaluation payload, browser
authority payload, or any confirmation token.

The activation signal is not preflight and is not approval.

### Admin stale-state revalidation

Opening the Admin workbench or rerunning preflight must not trust the scheduled
snapshot as authority. The server must re-read the current case state and
require the selected evaluation to still be the latest evaluation for that
case, still be `READY_FOR_8I4`, still have eligible scheduled Phase 8I-3E
provenance, still be ungrouped, and still be the first eligible real canary.

If the selected evaluation has been superseded or the latest evaluation is no
longer READY, the candidate becomes:

`STALE_REAL_CANARY_REQUIRES_REEVALUATION`

This is a pre-mutation HOLD and performs zero relocation mutation.

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

For the first-real canary, the explicit Admin action is presented as **Relocation confirm + canary verification**. After the first governed confirmation succeeds, the server immediately replays the exact same grouped-confirmation request with the same request ID and canonical payload while the original preflight payload is still available in memory.

The replay must return the same group and relocation identities with `idempotent = true` and create no additional relocation, group, source-lineage, incident-lineage, binding, review, Product Fact, Evidence Source, Recommendation, or semantic authority rows.

The automated scheduler never performs this replay. It is part of the explicit human-authorized first-real canary confirmation/verification action only.

## Canary closure audit and fail-closed gate

The first-real canary must write one Admin audit closure event after post-confirm verification.

Audit action:

`trust.phase8i4g.first_real_canary_verification`

The audit stores only bounded counts, digests, verification results, group/relocation identities, and the next state. It must not store raw browser payloads or semantic authority decisions.

A PASS audit opens later grouped confirmations.

The Admin response for the first real canary also returns one bounded closure
pack containing only the closure state, group/relocation/evaluation identities,
PASS/FAIL verification summaries, audit status, and whether the next grouped
confirmation is allowed. The closure pack never carries raw protected-state
snapshots or semantic authority decisions.

If the first grouped relocation exists but there is no PASS closure audit, all new non-idempotent grouped confirmations are blocked with a canary-closure-required conflict. Existing confirmed-group readback remains idempotent and readable.

A verification or audit failure therefore leaves the first relocation visible but fail-closes further grouped mutation until reviewed.

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

## Operational readiness closeout — 2026-10-01

The post-DNS-fix scheduled Production validation completed successfully in GitHub Actions run `36821532775`.

Observed scheduled path:

- Phase 8I-2B full transport rollout: PASS.
- 34 effective transport targets / 54 source identities observed.
- Results: 29 `HEALTHY`, 2 `REDIRECTED`, 3 `TRANSIENT`.
- Hard-blocked transport results: 0.
- New transport incidents created by the run: 0.
- Phase 8I-3E scheduled drift step: PASS.
- Both existing drift cases remained stable `HOLD` and were skipped with `HOLD_STABLE_UNTIL_POLICY_OR_NEW_CASE`.
- Phase 8I-4G read-only activation remained `WAITING_FOR_REAL_READY_FOR_8I4` with zero candidates.
- No automatic or human Production grouped relocation confirmation occurred.

The DNS outage regression fixed by PR #981 is therefore validated on the natural scheduled Production path: safe public-host DNS lookup outages degrade to `TRANSIENT` without starving the scheduled drift pipeline, while unsafe/private targets remain fail-closed.

Implementation and operational-readiness work for this phase is closed while no real scheduled `READY_FOR_8I4` candidate exists. This is **not** a claim that the first-real canary lifecycle itself has completed.

Checked-in evidence:

`docs/evidence/trust-phase8i4g-operational-readiness-closeout-v1.json`

Canonical dormant state:

`EVENT_DRIVEN_WAITING_FOR_REAL_READY_FOR_8I4`

The phase reopens only when the governed scheduled path produces a real eligible `READY_FOR_8I4` candidate. At that point the operator may perform read-only candidate/preflight review and must stop before mutation until an explicit human Admin confirmation is given.

