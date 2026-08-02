# ADR 0015: Fixed Pilot Matrix, Waves, and Anti-Cherry-Picking

## Status

Accepted for #T7 design.

## Context

The first pilot is intended to test the complete T2–T6 path for the four T2 skin-control fixtures:

- A: clean
- B: redness only
- C: blemishes only
- D: combined

The source planning note proposes a 20-image pilot before a 100-image campaign. If 20 is interpreted as a target number of successful Gold samples, operators could regenerate failed or misaligned candidates until the desired yield appears. That would erase the actual failure distribution.

Generating all 20 before any checkpoint also risks replicating one systemic prompt, Provider, mark, or import failure across the full pilot.

## Decision

The first campaign plan contains exactly 20 primary slots:

- 5 A
- 5 B
- 5 C
- 5 D

The slots are issued in three balanced waves:

- Wave 1: 1 per condition, total 4
- Wave 2: 2 per condition, total 8
- Wave 3: 2 per condition, total 8

Twenty is the primary slot denominator, not a G4 quota.

Once T3 registers a candidate to a slot, that slot cannot be replaced because of quality, ineligibility, mismatch, disagreement, hold, or rejection.

Technical retry is allowed only before successful candidate registration and only for an allowlisted no-asset or unusable-transfer reason. The campaign has:

- 20 primary generation attempts
- 10 technical retry reserve attempts
- 30 total generation attempts maximum
- 2 attempts maximum per slot

A later wave requires a checkpoint bound to the previous wave's exact projection digest.

## Consequences

### Positive

- Yield denominators remain honest.
- Negative controls and failed outcomes remain visible.
- Systemic problems can stop the pilot before all 20 slots are issued.
- Conditions remain balanced across waves.

### Negative

- The final G4 count may be low.
- A valid but poor candidate consumes its slot.
- Stopped runs can finish with fewer than 20 issued candidates, with the unissued slots explicitly cancelled.

## Rejected alternatives

### Continue until 20 G4 records exist

Rejected as direct selection bias.

### Replace every T4-ineligible or T5-misaligned candidate

Rejected because these are valid pipeline outcomes, not technical failures.

### Generate all 20 in one wave

Rejected because it amplifies systemic failure and wastes human-review budget.

### Rebalance unused retry reserve into new primary slots

Rejected because it changes the frozen denominator.

## Verification implications

Implementation tests must prove:

- exact 5/5/5/5 matrix
- exact 4/8/8 wave allocation
- checkpoint required before Wave 2 and Wave 3
- registered candidate replacement fails closed
- retry reserve cannot be used for quality or judgment outcomes
- generation attempt hard caps are enforced
- stopped unissued slots receive explicit terminal outcomes
