# T11 Solo Pilot Assessment Implementation v1

## Status

- Track: `#T11`
- Base: `design/T11-solo-pilot-assessment`
- Authority: `operator_exploratory_assessment`
- Actual Pilot execution: 0
- Provider execution: 0
- Human assessment execution: 0
- G2/G3/G4/G5 creation: 0

## Implemented flow

```text
verified T7 issued wave
+ verified T3 candidate and canonical bytes
+ verified T4 run/object when present
+ verified T2 finalized spec and compiled prompt
→ private slot-to-review mapping
→ target-withheld review item
→ immutable screening claim
→ structured screening seal
→ verified intent reveal
→ deterministic target relation
→ solo operational assessment
→ exact 4/8/8 Wave set
→ non-authoritative Wave brief
→ optional separate T7 checkpoint link
```

## Authority boundaries

- one pseudonymous operator only
- no fake reviewer aliases
- no T5 submission, consensus, or adjudication reuse
- no G2/G3/G4/G5 derivation
- no T6 promotion input
- no T8 metric mutation
- no T9 source-universe or split participation
- no same-slot quality regeneration
- existing sealed T5 consensus blocks opening a weaker T11 session

## Source verification

`preflightSoloWaveSource()` revalidates:

- T7 plan, run, slots, event ledger, and projection
- issued Wave and exact `4 / 8 / 8` denominator
- T3 candidate manifest and canonical image SHA-256
- T2 finalized GenerationSpec and compiled prompt digests
- A/B/C/D intended skin-cue mapping
- T4 observation run and object binding when present
- technical and cancelled terminal classifications

The target-withheld review item excludes slot, condition, fixture, prompt, spec, intended cue, and Provider-generation metadata. The private mapping is stored separately and never enters the Wave brief.

## Artifacts

- `SoloAssessmentPolicyV1`
- `SoloWaveSessionV1`
- `TargetWithheldReviewItemV1`
- `SoloScreeningClaimV1`
- `SoloTargetWithheldScreeningV1`
- `SoloIntentRevealReceiptV1`
- `SoloIntentAssessmentV1`
- `SoloWaveAssessmentRowV1`
- `SoloWaveAssessmentSetV1`
- `SoloWaveBriefV1`
- `SoloCheckpointLinkV1`

All artifacts are strict-shape, content-addressed, immutable, and local-only.

## T7 compatibility correction

A terminal `observation_failed` slot was valid but could remain checkpoint-unready. Checkpoint authorization now treats that exact terminal outcome as technical-ready without adding a Provider retry, checkpoint automation, or new terminal authority.

## CLI

```bash
npm run synthetic:solo -- --request <relative-request.json> --preflight
npm run synthetic:solo -- --request <relative-request.json> --confirm
```

Supported actions:

- `prepare_wave`
- `claim`
- `screen`
- `reveal`
- `assess`
- `brief`
- `link_checkpoint`

Request files remain under `.synthetic-local/requests/`.

## Verification scope

- strict contract and digest verification
- target-field withholding
- caller target-relation override rejection
- fake Gold/promotion field rejection
- existing T5 consensus rejection
- exact Wave denominator
- append-only/idempotent storage
- exhausted observation-failure checkpoint regression
- full existing synthetic test and verify suites
- Node 20 and Node 24
- architecture guard and production build on Node 20

## Non-goals

- actual Gemini generation
- actual T4 Provider observation
- automatic campaign stage mutation
- automatic T7 checkpoint approval
- independent human consensus
- Gold or locked dataset creation
- production route, UI, database, auth, payment, or deployment changes
