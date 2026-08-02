# Synthetic Evaluation Toolkit #T10

# Full-pipeline Rehearsal v1

## 1. Purpose

#T10 proves that the T2–T9 operational chain can be exercised safely before a paid 20-slot pilot.

The rehearsal is not a quality evaluation and does not create authoritative G4/G5 data. It verifies orchestration, failure handling, idempotency, evidence linkage, cleanup, and production isolation.

```text
isolated temporary root
→ fixed 20-slot campaign
→ deterministic local images and bounded fake transport
→ T3–T9 authority-path exercise
→ expected failure injections
→ immutable rehearsal report
→ temporary root deletion
```

## 2. Hard boundaries

- External Provider calls: 0
- Browser/network/database/shell execution from the rehearsal runtime: 0
- Production routes, UI, Auth, Payment, and Storage changes: 0
- `.synthetic-local/` writes: 0
- Real-person images: 0
- Actual human review claims: 0
- Authoritative G4/G5 publication: 0
- Dataset activation outside the temporary root: 0

All persistent exercise artifacts must live under an OS temporary directory created for one rehearsal run. The directory is deleted after the report is sealed.

## 3. Rehearsal authority model

T4 `fixture_replay` remains non-authoritative and cannot be promoted. #T10 therefore uses a bounded in-process fake transport that returns schema-valid Provider responses while preserving the same `provider_bounded` code path. No socket or remote request is allowed.

Human decisions are marked `rehearsal_only` and are accepted only by the rehearsal harness. They must never be registered into a non-rehearsal root or represented as actual human review.

The rehearsal report records that generated artifacts are operational test evidence only.

## 4. Fixed scenario matrix

The denominator remains exactly 20 slots, A/B/C/D five each, with the T7 4/8/8 wave schedule.

The default scenario allocation is:

| Scenario | Count |
|---|---:|
| aligned promotion path | 8 |
| valid but observation-ineligible | 3 |
| generation technical failure | 2 |
| observation technical failure | 1 |
| consensus-valid misaligned negative control | 2 |
| rights hold | 1 |
| visible external mark block | 1 |
| exact duplicate alias | 1 |
| reviewed perceptual leakage hold | 1 |

The allocation is deterministic and included in the rehearsal identity.

## 5. Execution phases

### Phase A — environment guard

- Resolve a newly created OS temporary root.
- Reject any root equal to or contained by the configured production/toolkit data root.
- Reject symbolic links in the root path.
- Snapshot `.synthetic-local/` existence and digest state for post-run comparison.
- Install a no-network guard for the rehearsal process.

### Phase B — campaign compilation

- Compile the real T7 20-slot plan.
- Issue Wave 1 only.
- Verify Wave 2 issue fails before checkpoint approval.
- Complete Wave 1 scenarios and submit the exact checkpoint.
- Issue Wave 2, checkpoint, then Wave 3.

### Phase C — candidate and evidence exercise

For every applicable slot:

- create a deterministic local PNG
- register a safe generation handoff
- run T3 import in the temporary root
- execute T4 through bounded fake transport
- create rehearsal-only T5 submissions and consensus
- derive alignment
- run T6 policy paths without representing the result as actual reviewed Gold
- bind every artifact back to its T7 slot

### Phase D — closeout and reporting

- Close the 20-slot T7 campaign.
- Run T8 source preflight and derive the exact 20-row denominator.
- Build internal review/export artifacts in the temporary root.
- Verify terminal and hold outcomes are preserved.

### Phase E — dataset lock exercise

- Build a T9 source universe only from rehearsal-scoped artifacts.
- Exercise leakage components, deterministic split, sticky exposure, locked-incomplete state, activation ordering, G5 holdout scope, and revocation paths.
- The resulting dataset is tagged `rehearsal_only` and destroyed with the temporary root.

### Phase F — failure matrix

The harness must prove rejection of:

1. Wave 2 before checkpoint
2. registered-candidate replacement
3. non-technical generation retry
4. tampered artifact digest
5. split of one leakage component across partitions
6. activation after G4 revocation/current-authority loss
7. holdout materialization without authorization
8. duplicate status successor
9. resume from an interrupted event ledger
10. repeated identical command causing duplicate publication

### Phase G — sealing and cleanup

- Seal a canonical `RehearsalReportV1`.
- Delete the temporary root.
- Verify the root no longer exists.
- Verify `.synthetic-local/` state is unchanged.
- Publish only the report as a CI artifact and repository test output; never publish images or holdout material.

## 6. Rehearsal report

```text
RehearsalReportV1
- schemaVersion
- toolkitTrack: T10
- sourceHeadSha
- scenarioMatrixDigest
- temporaryRootDigest
- slotsTotal: 20
- conditions: A/B/C/D = 5 each
- waveSchedule: 4/8/8
- providerCalls: 0
- networkAttempts: 0
- productionWrites: 0
- authoritativeHumanReviews: 0
- authoritativeG4Created: 0
- authoritativeG5Created: 0
- scenarioResults[]
- failureInjectionResults[]
- cleanupVerified
- localDataBoundaryUnchanged
- reportDigest
```

Timestamps are operational metadata and excluded from semantic identity.

## 7. Pass criteria

A rehearsal passes only when:

- all 20 slots remain in the denominator
- each condition has five slots
- Wave order is 4/8/8 with exact checkpoint gating
- every expected outcome count matches the scenario matrix
- all failure injections fail closed
- all idempotency checks succeed
- external Provider/network calls equal zero
- production writes equal zero
- authoritative review/G4/G5 counts equal zero
- the temporary root is deleted
- `.synthetic-local/` remains unchanged
- Node 20 and Node 24 produce equivalent semantic reports

## 8. Non-goals

- measuring image quality
- deciding which Provider is better
- collecting real human labels
- approving rights or legal status
- producing production Gold data
- retaining a rehearsal dataset
- changing T2–T9 authority contracts
