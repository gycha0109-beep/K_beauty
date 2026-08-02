# ADR 0008: Purpose-specific alignment without aggregate scoring

## Status

Accepted for Toolkit Track `#T5` design.

## Context

A synthetic candidate may satisfy capture controls while missing the intended skin cue, or match a target value while being too filtered or poorly posed to support the judgment. A single weighted score can hide a critical mismatch.

The current contracts also have explicit limits:

- T4 skin observation does not prove absence from signal zero alone.
- T4 skin area is coarser than the generation region contract.
- T4 does not provide blemish counts.
- Feature value enums overlap with T2, but feature cue strength is not independently measured.
- Same-person identity preservation is outside the observation contract.
- `mixed_control_pilot` is not an approved default production dataset purpose.

## Decision

1. Alignment uses versioned gate, target, and diagnostic axes.
2. #T5 v1 does not calculate an aggregate numerical quality score.
3. Critical gate or target mismatches cannot be offset by unrelated matches.
4. `unavailable`, `uncertain`, and unsupported evidence do not match an intended absence target.
5. Blind human judgment supplies conservative enums for absence, blemish count bands, and detailed target regions.
6. Face feature value alignment uses exact enum equality. `mixed` and `uncertain` do not match.
7. Feature cue strength remains unverifiable in v1 and is not silently inferred from the value.
8. Purpose policies are separate for `capture_control`, `skin_cue_control`, `face_feature_control`, `mixed_control_pilot`, and `paired_skin_edit`.
9. `mixed_control_pilot` may produce diagnostic alignment but is not promotion-review eligible in v1.
10. `paired_skin_edit` may assess skin mutation and lineage, but same-person preservation remains `not_assessed_v1`; it cannot receive overall `aligned` or promotion-review eligibility.
11. #T5 may derive append-only `G2_OBSERVED` and `G3_CONSENSUS_VALIDATED` records.
12. G3 means consensus on visible values, not agreement with generation intent.
13. `G4_SYNTHETIC_GOLD` and `G5_LOCKED_HOLDOUT` remain the responsibility of a later promotion and dataset-lock Track.

## Consequences

### Positive

- Critical failures remain visible and auditable.
- Overshoot, undershoot, wrong region, and unverifiable evidence are distinguishable.
- A candidate can be consensus-valid but intentionally misaligned, preserving useful negative examples.
- Current contract limits are represented explicitly instead of being filled with inference.
- Paired-image claims do not overstate identity verification.

### Negative

- There is no convenient single ranking number.
- Human review must record more structured fields.
- Some candidates remain unverifiable even when they look approximately correct.
- Feature strength and pair preservation require future contracts before they can be promoted as verified properties.

## Rejected alternatives

### Weighted score from 0 to 100

Rejected because high capture scores could conceal a failed target cue and because weights would imply precision unsupported by the contracts.

### Treating `signals.redness = 0` or `signals.acne = 0` as confirmed absence

Rejected because zero may represent unsupported evidence, especially under quality or eligibility limitations.

### Inferring blemish count from acne signal level

Rejected because the observation contract does not define a count mapping.

### Using visual similarity as same-person verification

Rejected because identity recognition and same-person guarantees are outside the approved scope.

### Promoting directly from an alignment pass

Rejected because licensing/provenance holds, duplicates, dataset balance, split contamination, and lock policy still require a separate promotion decision.

## Implementation constraints

- Alignment policies are immutable, versioned registries.
- Every axis result records intended value, judged value, role, verdict, and reason code.
- The overall verdict follows deterministic precedence: integrity block, consensus block, gate mismatch, gate unverifiable, target mismatch, target unverifiable, paired limitation, diagnostic drift, aligned.
- Promotion handoff must preserve block reasons and must not create G4/G5.
- Tests must include positive, negative, overshoot, uncertain, mixed-feature, paired-unverified, and fixture-rejected cases.
