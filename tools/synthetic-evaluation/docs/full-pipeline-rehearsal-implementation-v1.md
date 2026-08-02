# Synthetic Evaluation Toolkit #T10

# Full-pipeline Rehearsal Implementation v1

## 1. Result

The isolated composed rehearsal is implemented and executed on Node 20 and Node 24.

```text
real T7 20-slot control flow
+ isolated T3–T6 evidence-domain probes
+ real T8 fixed-denominator derivation
+ isolated T9 lock/activation lifecycle
→ canonical rehearsal report
→ all temporary roots deleted
```

This is deliberately not one authoritative candidate lineage. Joining fake transport output and fixture reviewer decisions into a real promotion lineage would violate the T4–T6 authority contracts. The harness instead exercises each authority domain in an isolated temporary root and proves the operational boundaries between them.

## 2. Implemented modules

### Scenario matrix

`rehearsal/scenario-matrix.mjs`

- exactly 20 scenarios
- A/B/C/D remain five slots each
- T7 campaign terminals are authority-safe technical placeholders
- semantic promotion/hold/block outcomes are exercised in separate T3–T6 evidence probes

### Rehearsal runner

`rehearsal/run-full-rehearsal.mjs`

- creates one main OS temporary root
- tracks every helper-created temporary root
- snapshots `.synthetic-local/` before, during, and after execution
- replaces global `fetch` with a fail-closed network guard
- restores global `fetch` in `finally`
- deletes every tracked root in `finally`
- finalizes the report only after cleanup and local-boundary verification

### Canonical report

`rehearsal/report.mjs`

- stable semantic identity
- timestamp excluded from identity
- exact zero counters for external Provider calls, network attempts, production writes, actual human reviews, and persistent authoritative G4/G5
- explicit `singleArtifactLineageEndToEnd: false`
- explicit composed-rehearsal authority limitation

## 3. Exercised paths

### T7

- fixed 20-slot campaign compile
- Wave 1/2/3 issue in 4/8/8 order
- Wave 2 rejection before Wave 1 checkpoint
- wave issue idempotency
- technical generation retry
- non-technical retry rejection
- two checkpoint approvals
- 20 terminal outcomes retained
- campaign closeout

### T3–T6 evidence domains

- eight aligned G4 preparation probes without registration
- three provider-bounded valid-ineligible observation probes using deterministic in-process fake transport
- one bounded Provider-failure registration probe
- two consensus-valid misaligned negative controls
- rights-uncertain hold
- visible-external-mark block
- exact-duplicate alias retention
- perceptual-neighbor hold
- one temporary G4 activation/revocation probe, deleted with its root

### T8

- exact 20 derived rows
- A/B/C/D five rows each
- deterministic metric-set identity

### T9

- leakage graph
- deterministic component split
- explicit lock review
- locked-incomplete publication
- activation publication
- temporary holdout G5 construction
- activation idempotency
- source tamper rejection
- coupled-component split rejection
- holdout materialization rejection without authorization
- append-only dataset retirement and terminal transition rejection

## 4. Failure matrix

The authoritative report records ten passing probes:

1. repeated Wave issue is idempotent
2. Wave 2 before checkpoint is rejected
3. non-technical retry is rejected
4. promotion preparation is semantically idempotent
5. current G4 revocation is detected
6. dataset activation is idempotent
7. source snapshot tampering is rejected
8. coupled-component split is infeasible
9. holdout materialization without authorization is rejected
10. inactive dataset cannot transition again

## 5. Rehearsal report

Authoritative report digest:

`93ca9141c2fca4528956004333b10b2de062f1341b05f7335cd90a19a5e0cb13`

Both Node 20 and Node 24 produced byte-equivalent JSON reports.

Key values:

```text
slotsTotal: 20
conditionCounts: A=5, B=5, C=5, D=5
waveSchedule: 4/8/8
T7 terminal placeholders: candidate_import_failed=18, generation_failed_no_asset=2
T3–T6 evidence probes: 18
T8 rows: 20
T9 temporary members: 5
temporary G5 records: 1
providerCalls: 0
networkAttempts: 0
productionWrites: 0
authoritativeHumanReviews: 0
persistentAuthoritativeG4Created: 0
persistentAuthoritativeG5Created: 0
temporaryRootsCreated: 20
temporaryRootsDeleted: 20
cleanupVerified: true
localDataBoundaryUnchanged: true
```

## 6. Important discovered defect

The rehearsal exposed a pre-existing T7 multi-checkpoint read defect:

```js
checkpoints.every(verifyPilotCheckpointApprovalIntegrity)
```

`Array.prototype.every` passed the array index as the verifier's optional second `projection` argument. The first checkpoint passed because index `0` was falsey; a second checkpoint failed because index `1` was treated as a projection object.

The implementation now wraps the call:

```js
checkpoints.every((approval) => verifyPilotCheckpointApprovalIntegrity(approval))
```

The full 4/8/8 rehearsal is a regression test for this correction.

## 7. Boundaries

- no paid Provider call
- no socket or browser execution
- no production route, UI, Auth, Payment, database, or storage mutation
- no `.synthetic-local/` mutation
- no real-person image
- no actual human judgment
- no retained rehearsal image or holdout material
- no retained authoritative G4/G5
- no merge
