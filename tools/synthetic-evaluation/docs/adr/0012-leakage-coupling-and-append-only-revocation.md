# ADR 0012: Leakage coupling and append-only revocation

## Status

Accepted for Toolkit Track `#T6` design.

## Context

Synthetic evaluation candidates frequently share framing, background, prompt structure, campaign membership, and visually similar facial structure. Exact duplicate and near-duplicate handling must prevent downstream evaluation leakage without pretending that visual similarity proves identity.

A promoted artifact may also become unsuitable after approval because rights, provenance, mark, duplicate, or conflicting-evidence issues are discovered later. Rewriting or deleting a prior promotion would erase audit history.

## Decision

### 1. Exact and perceptual duplicate policy remain separate

- exact canonical duplicate: deterministic SHA-256 relation
- perceptual neighbor: review input only until a calibrated policy exists

No dHash distance threshold automatically promotes, rejects, or declares two images to be the same person.

### 2. One exact-canonical representative per claim scope

For the same canonical SHA and equivalent purpose/claim scope:

- one candidate may be selected as the active G4 representative;
- additional candidates are retained as non-Gold aliases;
- conflicting claim sets on the same canonical image block promotion and require upstream evidence review.

### 3. Leakage coupling is expressed as keys, not identity claims

T6 may emit split-coupling keys for:

- canonical SHA
- campaign series
- reference lineage
- manually reviewed visual similarity

These keys mean “must not be separated across future evaluation splits.” They do not mean same person, same identity, or biological equivalence.

### 4. T6 does not assign a split

T6 records coupling inputs only. T9 decides train/validation/holdout placement and must place all records sharing any coupling key in the same split family.

### 5. Promotion lifecycle is append-only

Promotion decision and grade artifacts are immutable. Later state changes are represented by `PromotionStatusEventV1`:

- `activated`
- `revoked`
- `superseded`

A status event references the exact grade record and predecessor event. It never edits the prior artifact.

### 6. Revocation is fail-closed

An active G4 is revoked when authoritative evidence establishes:

- rights denial or scope withdrawal
- visible external mark/provenance conflict
- artifact integrity failure
- exact duplicate conflicting claims
- newly discovered leakage conflict
- newer consensus conflict
- explicit reviewed policy revocation

Uncertain evidence produces hold/review, not silent continued eligibility.

### 7. Downstream consumers resolve active status

T9 and later report/regression tooling may consume only a G4 record with a valid event chain whose current state is active and not superseded or revoked.

## Consequences

### Positive

- Duplicate leakage is handled conservatively without unsupported identity inference.
- Historical promotion decisions remain auditable.
- Rights or provenance discoveries can disable use without deleting evidence.
- T9 receives explicit coupling constraints.

### Negative

- Active status requires event-chain resolution.
- Perceptual similarity requires manual review until calibration exists.
- Alias candidates remain stored even when not independently promoted.

## Implementation constraints

- Coupling keys are canonicalized, deduplicated, and sorted before digesting.
- Exact-canonical representative selection is scoped to purpose and claim-values digest.
- A candidate with unresolved perceptual review cannot receive G4.
- Event chains reject cycles, missing predecessors, duplicate sequence positions, and grade mismatches.
- Revoked records are never physically deleted by T6.
- Tests must prove that shared coupling keys cannot be interpreted as split assignments or identity labels.
