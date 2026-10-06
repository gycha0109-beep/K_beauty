# Face Lab V2 G-E3 Local Wave Runner v1

> Track: Face Lab / face-research  
> Stage: G-E3 Full Calibration  
> Shape: 12 intents × 2 generations = 24 outputs  
> Execution: 3 waves × 8 outputs  
> Paid execution: precheck → one-image canary → explicit human approval → checkpointed resume

## Evaluation-plan correction

G-E3 must not slice the target registry in declaration order.

The previous registry-order grouping put visually adjacent targets such as `natural`, `clear_soft`, and `soft` into the same wave while also varying presentation preference, scope, and change tolerance. That made the generated outputs poor evidence for target-style contrast.

G-E3 now uses the frozen evaluation plan:

### Wave 1

- `natural`
- `cute_playful`
- `mature_calm`
- `defined`

### Wave 2

- `clear_soft`
- `sophisticated`
- `statement_glam`
- `classic`

### Wave 3

- `soft`
- `chic`
- `minimal`
- `trendy`

Each wave contains four deliberately separated target vectors instead of four adjacent registry entries.

All 12 targets appear exactly once across the three waves.

## Fixed calibration survey profile

Every G-E3 target uses the same evaluation conditions so differences are attributable to target style rather than survey noise.

Frozen profile:

- presentation preference: `masculine_examples`
- change tolerance: `moderate`
- recommendation priority: `target_forward`
- styling scope:
  - hair
  - brow grooming
  - makeup
  - color
  - eyewear
  - accessories
  - facial hair
- facial hair is explicitly disabled for this calibration source
- hair change allowance: large
- hair dye: allowed
- makeup intensity: medium
- daily styling budget: 30 minutes
- monetary budget band: standard
- maintenance tolerance: medium

The male calibration source is therefore not evaluated with randomly mixed masculine/feminine/neutral presentation examples.

## Plan binding

Every G-E3 manifest/checkpoint records:

- evaluation-plan version
- survey-profile version
- exact four target keys for the wave

Checkpoint reuse is permitted only when all three match the current frozen plan.

An older checkpoint created under the previous registry-order plan is intentionally rejected and is never reused as evidence for the corrected campaign.

A Wave 1 precheck automatically starts a fresh campaign if the previously recorded campaign state belongs to an older evaluation-plan version. Existing old output directories are left untouched as historical evidence.

## Why waves exist

G-E3 runs:

- 4 targets per wave
- 2 generations per target
- 8 outputs per wave
- 24 outputs total

Each target still receives two independent generations for repeatability review.

A wave has a hard total cap of 8 outputs. A separate new-output budget limits how many **new paid provider outputs** one process may create.

## Safety model

- `FACE_LAB_E2E_MAX_OUTPUTS=8`: total wave cap.
- `FACE_LAB_E2E_NEW_OUTPUT_BUDGET`: new paid outputs allowed in the current process.
- checkpoint reuse does not consume the new-output budget.
- automatic PR/push CI does not execute the paid image provider.
- G-E3 paid execution is localhost/loopback only.

## Commands

### Wave 1 precheck — zero paid calls

```bash
npm run run:face-lab-v2-g-e3-wave -- 1 precheck
```

Expected precheck output includes:

- current campaign ID
- wave ID
- exact target keys
- `masculine_examples`
- `moderate`
- provider calls = 0

### Wave 1 canary — one new paid output maximum

```bash
npm run run:face-lab-v2-g-e3-wave -- 1 canary
```

After one successful generation:

- `manifest.checkpoint.json` remains partial
- exactly one case is persisted
- `manifest.json` must not exist
- `canary-gate.json` is written
- process stops with `FACE_LAB_G_E3_CANARY_READY_FOR_REVIEW`

### Human review

```text
http://localhost:3001/face-lab-test/pilot-review
```

### Approve or reject — zero paid calls

```bash
npm run run:face-lab-v2-g-e3-wave -- 1 approve
npm run run:face-lab-v2-g-e3-wave -- 1 reject
```

### Resume

```bash
npm run run:face-lab-v2-g-e3-wave -- 1 resume
```

Resume reuses all valid persisted cases and pays only for missing cases.

## Later waves

```bash
npm run run:face-lab-v2-g-e3-wave -- 2 precheck
npm run run:face-lab-v2-g-e3-wave -- 2 canary
npm run run:face-lab-v2-g-e3-wave -- 2 approve
npm run run:face-lab-v2-g-e3-wave -- 2 resume

npm run run:face-lab-v2-g-e3-wave -- 3 precheck
npm run run:face-lab-v2-g-e3-wave -- 3 canary
npm run run:face-lab-v2-g-e3-wave -- 3 approve
npm run run:face-lab-v2-g-e3-wave -- 3 resume
```

Wave 2 and Wave 3 must continue the same plan-compatible campaign.

## Local state

Outputs remain under:

`private/face-lab-g-e3/<campaign-id>/wave-0N`

Relevant files:

- `manifest.checkpoint.json`: partial generation progress
- `canary-gate.json`: exact reviewed-canary binding
- `manifest.json`: complete 8-case wave
- `private/face-lab-g-e3/current-campaign.json`: active campaign and evaluation-plan binding

All generated images remain local and ignored by Git.

## Required invariants

1. All 12 target styles occur exactly once across the three waves.
2. Each wave contains four contrastive targets rather than registry-adjacent targets.
3. Every G-E3 case uses the same masculine, moderate, target-forward calibration profile.
4. Precheck, approve, and reject make zero image-provider calls.
5. Canary creates at most one new paid output.
6. Resume is blocked unless the canary binding is explicitly approved.
7. Old evaluation-plan checkpoints are rejected before reuse.
8. Partial success is checkpointed after every successful paid generation.
9. No wave can exceed eight total outputs.
10. PR/push CI never automatically invokes the paid image provider.
