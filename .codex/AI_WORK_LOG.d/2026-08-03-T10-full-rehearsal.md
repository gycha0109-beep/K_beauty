# 2026-08-03 — Toolkit #T10 Full-pipeline Rehearsal

## Scope

- design an isolated pre-pilot rehearsal
- implement composed T2–T9 operational drills
- execute Node 20 and Node 24 CI
- review failures, correct defects, and rerun
- keep all PRs Draft and unmerged

## Design

Branch: `design/T10-full-pipeline-rehearsal`

Draft PR: GitHub #131

The design fixed OS temporary roots, no-network execution, 20-slot A/B/C/D balance, 4/8/8 waves, failure injection, cleanup verification, and an explicit non-authoritative rehearsal report.

## Implementation

Branch: `feature/T10-full-pipeline-rehearsal`

Draft PR: GitHub #132

Implemented:

- fixed scenario matrix
- T7 three-wave drill
- isolated T3–T6 evidence probes
- T8 20-row derivation
- T9 lock/activation/retirement drill
- ten failure and idempotency probes
- canonical report and cleanup checks

## Review corrections

1. Replaced impossible direct T7 `promoted_g4` terminals with authority-safe technical placeholders.
2. Corrected checkpoint reason code to the frozen campaign registry.
3. Removed an invalid resume call from an already active campaign.
4. Found and fixed the inherited T7 multi-checkpoint verifier callback defect.
5. Corrected evidence-probe count from 17 to 18.
6. Corrected CI artifact paths for workspace-relative report output.
7. Finalized reports only after actual temporary-root deletion and `.synthetic-local/` comparison.
8. Recorded that the rehearsal is composed and does not claim one authoritative artifact lineage.

## Verification contract

The final implementation pull request records the authoritative workflow run and report digest because report identity includes the CI source checkout SHA.

Required checks:

- Node 20 rehearsal: PASS
- Node 20 synthetic test: PASS
- Node 20 synthetic verify: PASS
- architecture guard: PASS
- production build: PASS
- Node 24 rehearsal: PASS
- Node 24 synthetic test: PASS
- Node 24 synthetic verify: PASS
- report artifact upload: PASS
- Node 20 and Node 24 report bytes: identical

## Boundaries

- Provider calls: 0
- network attempts: 0
- production writes: 0
- actual human reviews: 0
- persistent authoritative G4: 0
- persistent authoritative G5: 0
- temporary roots created/deleted: 20/20
- `.synthetic-local/` changed: no
- merge: not performed
