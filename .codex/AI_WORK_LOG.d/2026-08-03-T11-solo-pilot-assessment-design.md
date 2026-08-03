# 2026-08-03 — T11 Solo Pilot Assessment Design

## Scope

- base branch: `main`
- exact base SHA: `3ef41e41109d948fd1c66c63f0fee454b01f6f08`
- design branch: `design/T11-solo-pilot-assessment`
- documentation-only design
- implementation, Provider execution, Pilot execution, and production changes excluded

## Problem

The T1–T10 Toolkit is merged to main. T7 can orchestrate a real 20-slot Pilot, but T5/T6 correctly require multiple independent human roles. The project currently has one operator. The next operating layer must allow structured solo learning without creating fake reviewer identities or weakening G3/G4/G5 authority.

## Design

```text
verified T7 issued Wave
+ verified T3 candidate
+ T4 observation when available
→ image-only target-withheld screening
→ T4 reveal/comparison when available
→ verified T2 intent reveal
→ deterministic target relation
→ solo operational assessment
→ exact Wave assessment set
→ non-authoritative solo Wave brief
→ separate T7 checkpoint
→ optional digest link
```

## Authority boundary

- T11 authority: `operator_exploratory_assessment`
- operator count: exactly 1
- T5 submission/consensus reuse: prohibited
- G2/G3/G4/G5 creation: prohibited
- T7 checkpoint mutation: prohibited
- T8 metric mutation: prohibited
- T9 dataset participation: prohibited

## Review findings resolved

1. Multiple reviewer IDs for one person were rejected.
2. Target-withheld was used instead of falsely claiming blind review.
3. Image-only screening was separated from T4 observation reveal to avoid anchoring.
4. Synthetic provenance was assigned to verified T3 source, not human pixel judgment.
5. T4 terminal observation failure with a valid canonical image remains assessable but is labeled T4-unavailable.
6. Intent-source conflict fails preflight instead of becoming a target relation.
7. Existing T5 consensus blocks a new weaker T11 session.
8. All issued Wave slots remain in the denominator.
9. T11 decision does not automatically create a T7 checkpoint.
10. Existing T7 `observation_failed` terminal checkpoint readiness inconsistency was identified for a narrow implementation correction.

## Documents

- `tools/synthetic-evaluation/docs/solo-pilot-assessment-v1.md`
- `tools/synthetic-evaluation/docs/adr/0032-solo-assessment-authority-without-fake-consensus.md`
- `tools/synthetic-evaluation/docs/adr/0033-target-withheld-screening-before-intent-reveal.md`
- `tools/synthetic-evaluation/docs/adr/0034-fixed-wave-denominator-and-checkpoint-link.md`
- `tools/synthetic-evaluation/docs/adr/0035-t7-terminal-compatibility-and-observation-failure-checkpoint.md`
- `tools/synthetic-evaluation/docs/adr/0036-solo-assessment-source-and-phase-corrections.md`

ADR 0036 supersedes the listed conflicting portions of the main design and is authoritative for implementation.

## Final design review

- Critical: 0 open
- Important: 0 open
- Minor: 0 open
- status: `READY_FOR_IMPLEMENTATION_REVIEW`

## Boundaries

- actual Gemini generation: 0
- actual T4 Provider calls: 0
- actual solo assessment: 0
- actual campaign writes: 0
- actual T5/T6/T8/T9 operation: 0
- production changes: 0
- merge: not performed
