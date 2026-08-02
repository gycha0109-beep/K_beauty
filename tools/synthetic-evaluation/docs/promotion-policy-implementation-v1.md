# Synthetic Evaluation Toolkit #T6

# Promotion Policy Implementation v1

## Status

- Toolkit Track: `#T6`
- Branch: `feature/T6-promotion-policy`
- Base: `design/T6-promotion-policy`
- Production integration: none
- Provider, browser, network, database execution: none
- Actual human review: none
- G5, dataset split, holdout lock: excluded

## Runtime flow

```text
stored T3/T4/T5 evidence
→ source preflight
→ PromotionSourceSnapshot
→ operator re-attestation
→ rights review
→ canonical-image asset-policy review
→ exact/perceptual leakage review
→ PromotionEvidenceBundle
→ independent promotion review
→ append-only decision
→ optional purpose-scoped G4 and activation event
```

## Authority boundaries

T6 does not trust a caller-supplied candidate projection, G2/G3 reference, consensus value, alignment result, or G4 source.

Source preflight reloads and verifies:

- current T3 candidate manifest and finalized generation artifacts
- synthetic-only, real-person-reference, and rights-review import attestations
- full candidate projection, operator hints, and duplicate references
- canonical image bytes against the stored SHA-256
- authoritative T4 run and observation object
- stored T5 alignment, consensus, G2, G3, submissions, and judgment actors
- purpose-required agreed consensus values

Gold claim values are copied from the sealed blind consensus. Generation intent selects the purpose scope but is not the Gold-label source.

## Three-stage write boundary

### Source preflight

- reads stored evidence
- creates an in-memory source snapshot
- persistent writes: 0

### Policy-review preflight

- finalizes structured review drafts against the exact source snapshot
- evaluates deterministic policy outcome
- creates an in-memory final evidence bundle
- persistent writes: 0

### Confirmation

- requires an independent promotion reviewer
- derives an append-only decision
- writes a G4 record and activation event only for approved eligible evidence
- held, rejected, and retained-negative-control decisions create no G4

## Promotion outcomes

```text
eligible_for_promotion_review
retained_g3_negative_control
held_policy_review
blocked
```

A confirmation decision records one of:

```text
promoted_g4
retained_g3_negative_control
held
rejected
```

## G4 scope

G4 is scoped by:

- candidate
- purpose
- agreed claim axes
- agreed claim-value digest
- internal-evaluation-only use scope
- explicit excluded claims
- promotion policy version
- source evidence digests
- split-coupling-key digest

G4 does not grant training, public-release, diagnosis, population-representativeness, identity-preservation, archetype, or feature-strength claims.

## Leakage policy

- exact canonical duplicates require one representative or non-Gold alias disposition
- conflicting exact-duplicate claims block promotion
- perceptual neighbors require explicit review; no generic automatic threshold is used
- coupling keys are split-leakage controls, not identity claims

## Append-only status

A promotion key may have one activation root. Status successors use an immutable predecessor claim so concurrent or later conflicting successors cannot branch the status chain.

Revocation reloads and verifies:

- the stored G4 record
- its derived promotion key
- the stored activation event
- the activation claim

Caller-stated identifiers alone cannot revoke a promotion.

## Implementation review corrections

1. Fixed G4 identity verification so `gradeRecordId` is excluded from its own digest input.
2. Added source-bound G4 verification so a recomputed outer digest cannot hide changed claim scope or source digests.
3. Reconstructed and validated the complete T3 promotion projection, including import attestations and duplicate-reference shape.
4. Added exact cross-link verification among snapshot, reviews, bundle, promotion review, decision, G4, and activation event.
5. Added one activation root per promotion key and one immutable successor per status event.
6. Changed revocation from caller-trusted identifiers to stored G4 and activation authority verification.
7. Strengthened status projection against duplicate, mixed, disconnected, cyclic, and branched event chains.
8. Added tests for semantic tampering, weakened attestations, conflicting revocation, role separation, idempotency, and non-Gold retention.

## Non-goals

- automatic generation or import batches
- automated legal judgment
- automatic perceptual-distance rejection
- same-person verification
- G5 creation
- dataset splitting or locking
- production application dependency
- database, API route, UI, Auth, Payment, or Storage integration
