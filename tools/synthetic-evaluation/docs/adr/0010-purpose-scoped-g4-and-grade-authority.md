# ADR 0010: Purpose-scoped G4 and grade authority separation

## Status

Accepted for Toolkit Track `#T6` design.

## Context

T5 produces:

- `G2_OBSERVED`
- purpose-scoped `G3_CONSENSUS_VALIDATED`
- intent alignment

T5 deliberately keeps `promotionReviewEligible=false` and adds `promotion_policy_pending_t6`. A naive T6 could still create two problems:

1. treat `aligned` as candidate-global Gold;
2. create both G4 and G5, overlapping with the later locked-dataset track.

A synthetic candidate may support one exact evaluation claim while not supporting other claims. For example, a skin-control candidate may have valid redness labels but no basis for archetype, face-feature strength, identity preservation, or public-release rights.

## Decision

### 1. G4 is purpose- and claim-scoped

`G4_SYNTHETIC_GOLD` binds:

- one candidate
- one validated GenerationSpec purpose
- one sorted required-axis set
- one sealed consensus claim-value set
- one policy version
- one internal-use scope
- explicit excluded claims

The claim values come from sealed blind consensus. Generation intent selects the axes and must match them, but it is not the Gold-label source.

### 2. G4 is not a global image quality status

A candidate may have:

- G4 for capture control;
- G4 for a skin cue scope;
- no G4 for face-feature strength;
- no G4 for paired identity preservation.

The grade record cannot be interpreted outside its exact scope.

### 3. T6 owns G4 only

T6 may emit:

- `promoted_g4`
- `retained_g3_negative_control`
- `held`
- `rejected`

T6 does not assign dataset splits and does not emit `G5_LOCKED_HOLDOUT`.

### 4. T9 owns G5 and lock semantics

T9 may consume only active, non-revoked G4 records and must independently enforce:

- leakage-coupled split placement
- dataset snapshot identity
- lock immutability
- regression/holdout usage
- no cross-split duplicate family

### 5. Purpose policy v1

- `capture_control`: G4 allowed for capture/appearance claims
- `skin_cue_control`: G4 allowed for capture and exact skin claims
- `face_feature_control`: G4 allowed for exact feature enum values; strength excluded
- `paired_skin_edit`: G4 prohibited in v1
- `mixed_control_pilot`: G4 prohibited in v1

### 6. Negative controls remain non-Gold

A consensus-valid but `misaligned` candidate may be retained as `retained_g3_negative_control`. It does not receive G4 under v1.

## Consequences

### Positive

- Gold claims remain auditable and narrow.
- Generation intent is not promoted into ground truth.
- G4 cannot be mistaken for real-world representativeness or all-purpose quality.
- T6 and T9 have non-overlapping authority.
- Paired identity and mixed-control uncertainty remain explicit.

### Negative

- One candidate may have multiple scoped grade records.
- Downstream consumers must read the complete scope rather than a single grade token.
- Dataset lock tooling must resolve active G4 status and coupling keys.

## Implementation constraints

- G4 identity includes purpose, claim axes, claim-values digest, policy digest, and use scope.
- `recordedAt` does not participate in semantic identity.
- G4 verification rejects missing or duplicate claim axes.
- Claim values must be reconstructed from the referenced consensus.
- Package/root scripts must expose no G5 or split command in T6.
- Tests must prove that the same candidate cannot use one G4 scope as evidence for another purpose.
