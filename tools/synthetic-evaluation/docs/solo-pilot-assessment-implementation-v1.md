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

## Implementation review corrections

1. authoritative T7 fixture IDs preserve their exact source form, including condition prefixes
2. T11 CLI helpers are isolated from the T5 judgment module path
3. package-root exports expose orchestration and integrity verification, not raw assessment constructors
4. architecture tests prohibit Provider, browser, database, shell, upload, production, T5/T6, T8-mutation, and T9-dataset execution paths
5. caller-provided target relations, retry permission, and promotion fields remain ineffective or invalid

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

## Authoritative verification

Workflow run: `30775646864`

Verified implementation head:

`495539ed2e7988ddfc7f05a36e2a893169e3243a`

### Node 20

- synthetic tests: `187/187` PASS
- synthetic verify: `185/185` PASS
- architecture guard: PASS
- production build: PASS
- diff hygiene: PASS

### Node 24

- synthetic tests: `187/187` PASS
- synthetic verify: `185/185` PASS
- diff hygiene: PASS

## Final review

- Critical: 0 open
- Important: 0 open
- Minor: 0 open

## Non-goals

- actual Gemini generation
- actual T4 Provider observation
- automatic campaign stage mutation
- automatic T7 checkpoint approval
- independent human consensus
- Gold or locked dataset creation
- production route, UI, database, auth, payment, or deployment changes
