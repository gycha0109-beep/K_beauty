# FACE LAB CURRENT STATE

> Updated: 2026-08-12
> Implementation baseline reviewed: `9361fc100bd5770f4ccf95999b561f8738cbd3a2`
> The documentation commit that adds this file may advance `main` without changing the implementation baseline below.
> Current code and current component contracts override older dated progress notes.

## 1. Executive state

Face Lab has a strong observation and evaluation foundation, plus a recovered deterministic archetype shadow scorer. The final product engine is not complete because archetype calibration and downstream styling layers are not yet production-authoritative.

```text
Eligibility / quality                 ✅ implemented
Unified Face Lab observations         ✅ implemented
Canonical analysis container          ✅ implemented
Archetype registry                    ✅ shadow / rubric-ready
Deterministic archetype scoring       ✅ shadow
Archetype decision / hold             ✅ shadow, production blocked
Archetype calibration                 ❌ not ready
Canonical archetype promotion         ❌ not wired
Style Identity                        ❌ not implemented
Core / Alternative strategy           ❌ not implemented
Color final engine                    ❌ not implemented
Hair final engine                     ❌ not implemented
Makeup final engine                   ❌ not implemented
Face Style final engine               ❌ not implemented
Look Composer                         ❌ not implemented
Final canonical Free/Premium result   ❌ incomplete
Synthetic evaluation infrastructure   ✅ implemented
Controlled skin-cue pilot             ✅ official alignment complete / closeout pending
Real human archetype calibration set  ❌ not established
```

## 2. Current production analysis path

The current product has a shared Vision observation boundary. Face Lab and Skin Match consume the same image-bearing analysis call rather than independently re-analyzing the image.

The Face Lab observation contract already supports structured quality, pose/occlusion, outline, vertical proportions, eyes, feature layout, visual language, and color-appearance observations with field-level evidence and confidence.

Vision is contractually prohibited from directly deciding the archetype or final styling recommendations.

## 3. Canonical Face Lab bundle

`face-lab-canonical-v1` exists.

Current canonical bundle behavior is still observation-first:

```text
analysis       = populated
archetype      = null
styleIdentity  = null
strategies     = null
color          = null
hair           = null
makeup         = null
faceStyle      = null
looks          = null
```

Therefore the canonical container exists, but the final Face Lab decision/styling result has not been assembled.

The current sanitizer also intentionally recreates the canonical bundle from the validated observation analysis, so unapproved downstream fields cannot silently survive as current canonical authority.

## 4. Archetype engine

### 4.1 Implemented on current main

The recovered FACE-ENGINE-1 shadow layer includes:

- versioned archetype registry,
- seven rubric candidates,
- positive and negative indicators,
- weighted deterministic scoring,
- evidence-required contribution handling,
- evidence coverage,
- contradiction count,
- contribution ledger,
- deterministic ranking,
- fail-closed hold reasons,
- shadow decision adapter.

Current rubric keys are:

```text
wolf
cat
puppy
deer
tofu
potato
dino
```

These are not production-final taxonomy authority.

### 4.2 Current lifecycle

The registry is intentionally:

```text
lifecycle = rubric_ready
calibrationStatus = not_ready
```

Each archetype is likewise unvalidated for production calibration.

Decision-policy thresholds are not populated as production values:

- minimum evidence coverage,
- minimum top score,
- minimum top margin,
- maximum contradictions.

The shadow decision layer therefore returns:

```text
productionEligible = false
status = held
decision = null
```

until taxonomy and calibration readiness are explicitly promoted.

### 4.3 What is still missing

- validated human evaluation data,
- calibrated rubric weights,
- calibrated decision thresholds,
- bias/coverage evaluation across relevant presentation variation,
- production activation decision,
- canonical bundle wiring.

## 5. Styling domain status

`face-lab-archetype-styling-contract-v1.md` exists and preserves the product philosophy and target data boundaries for:

- representative archetype and similarity language,
- Style Identity,
- Core / Alternative strategies,
- Color,
- Hair,
- Makeup,
- Face Style,
- Core / Alternative Looks.

However the contract itself states that classification weights and thresholds are not validated, and it does not constitute implementation of those downstream engines.

Current final-engine status:

| Domain | Contract/design | Production implementation |
|---|---|---|
| Style Identity | defined conceptually | not implemented |
| Core Strategy | defined conceptually | not implemented |
| Alternative Strategy | defined conceptually | not implemented |
| Color | target boundary defined | final engine not implemented |
| Hair | target boundary defined | final engine not implemented |
| Makeup | target boundary defined | final engine not implemented |
| Face Style | target boundary defined | final engine not implemented |
| Look Composer | target boundary defined | not implemented |

Any current face-shape/color/hair wording produced by transition projectors must not be mistaken for these final domain engines.

## 6. Free / Premium status

The product already has evidence-gated Face Lab output paths and Premium-safe summary/storage behavior, but they are transitional rather than the target Face Lab architecture.

The target remains:

```text
one canonical Face Lab result
→ Free projection
→ Premium projection
→ permitted stored snapshot
```

Current Free/Premium behavior must not be treated as proof that Style Identity, Core/Alternative, domain styling engines, or Look Composer are complete.

## 7. Synthetic evaluation infrastructure

The repository contains a non-production synthetic evaluation workspace with executable tracks for:

- candidate import,
- blind observation,
- judgment,
- consensus,
- intent alignment,
- purpose-scoped promotion,
- campaign orchestration,
- reporting/export,
- dataset lock/baseline,
- full-pipeline rehearsal,
- Solo assessment,
- cue-level alignment diagnostics.

The production application does not depend on this toolkit.

The core authority boundary is preserved:

```text
generation intent ≠ observation ≠ judgment ≠ promotion
```

## 8. Controlled skin-cue pilot status

The diversified skin-cue pilot's official reveal/alignment phase was completed operationally in the local synthetic-data workspace. These artifacts are intentionally not tracked as production application data. Operator decision, checkpoint, and campaign closeout remain pending.

Campaign:

`crun_140d7a156fb69f754db7a780`

Solo session:

`solo_08235338b490f242e7b4ebc3`

Final official alignment state reported by the operator:

- official reveal receipts: 8/8 valid,
- cue alignments: 8/8 valid,
- wave alignment report: valid,
- report digest: `ff3a76910cf0b044a5cf9b7355f77d6b3b8181681383ae7b7bed0b3fcfc53c1a`,
- Provider calls during reveal/alignment: 0,
- retries/recovery: 0/0,
- operator decision: 0,
- checkpoint: 0.

### Pilot findings that matter for future work

- Human redness was intentionally `unverifiable` because the single reviewer could not reliably classify subtle redness. It must not be counted as a target mismatch.
- Blemish-negative controls were clearly separable to the human reviewer.
- Positive blemish cues were often subtle/ambiguous.
- One human-reviewable positive case exposed a possible T4 observation miss.
- The pilot demonstrated that the evaluation machinery can preserve uncertainty instead of forcing a success/failure label.

This pilot alignment validates the evaluation process, not the production archetype taxonomy. Administrative/operational closeout is still separate.

## 9. Historical documents and authority

The following historical files contain valuable rationale but no longer define current implementation status:

- `face lab은 무엇인가 0716.txt`
- `Face_Lab_구현_명세_0716_수정본.md`
- `face_lab_진행상황_0727.txt`
- `bejewely-face-analyze-pipeline-07-30.txt`

The July 27 progress snapshot correctly described the then-current gap, but statements such as “archetype scoring is not implemented” are now superseded by the recovered shadow scorer on current main.

The July 16 product architecture and July 30 generation/judgment separation remain substantially valid and have been consolidated into the new MASTER and EVALUATION documents.

## 10. Current blockers before production archetype activation

The next production gate is not “add more archetype labels” and not “generate a large synthetic dataset.”

The blockers are:

1. define the archetype calibration protocol against the current rubric/observation contract,
2. distinguish synthetic stress evidence from real human annotation authority,
3. build a human labeling/consensus evaluation set with ambiguity preserved,
4. use synthetic controlled sets to stress-test the rubric and observation layer,
5. calibrate weights and hold/decision thresholds,
6. evaluate stability, coverage, and bias,
7. only then activate a production archetype decision and wire it into the canonical bundle.

## 11. Next recommended implementation sequence

```text
FACE-EVAL-A  Archetype calibration protocol
→ FACE-EVAL-B  Human labeling / consensus dataset contract
→ FACE-EVAL-C  Synthetic archetype stress campaign
→ FACE-ENGINE-2  Weight + threshold calibration
→ FACE-ENGINE-3  Production-safe ArchetypeDecision
→ FACE-STYLE-1  Style Identity
→ FACE-STYLE-2  Core / Alternative Strategy
→ FACE-STYLE-3  Color / Hair / Makeup / Face Style
→ FACE-LOOK-1  Look Composer
→ FACE-PRODUCT-1  Canonical Free / Premium integration
```

The exact names may change. The dependency order should not be bypassed without an explicit contract change.
