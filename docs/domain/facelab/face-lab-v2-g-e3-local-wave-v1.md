# Face Lab V2 G-E3 Local Wave Runner v1

> Track: Face Lab / face-research
> Stage: G-E3 Full Calibration
> Shape: 12 intents × 2 generations = 24 outputs
> Execution: 3 waves × 8 outputs
> Paid execution: precheck → one-image canary → explicit human approval → checkpointed resume

## Why waves exist

G-E3 keeps the 12-intent calibration split into:

- wave 1: intents 01-04,
- wave 2: intents 05-08,
- wave 3: intents 09-12.

Each intent still receives exactly two generations.

A wave has a hard total cap of 8 outputs. The launcher also applies a separate **new-output budget** so a single process cannot accidentally pay for the entire wave before the first result is reviewed.

## Safety model

Two different caps are intentionally preserved:

- `FACE_LAB_E2E_MAX_OUTPUTS=8`: total wave shape may never exceed eight outputs.
- `FACE_LAB_E2E_NEW_OUTPUT_BUDGET`: maximum number of **new paid provider outputs in this process**.

Reused checkpoint cases do not consume the new-output budget.

Automatic PR/push CI does not execute the paid provider path.

G-E3 paid execution is local-first and fails closed unless the base URL is localhost / loopback.

## Commands

### 1. Precheck — zero paid image calls

```bash
npm run run:face-lab-v2-g-e3-wave -- 1 precheck
```

Precheck validates:

- local environment secrets,
- source image availability,
- localhost base URL,
- current campaign continuity,
- existing checkpoint / canary-gate shape.

It does not call the image provider.

For a fresh wave 1 it creates or reuses the current G-E3 campaign identity in the ignored private state.

### 2. Canary — exactly one new paid output

```bash
npm run run:face-lab-v2-g-e3-wave -- 1 canary
```

The provider runner still targets the full 8-case wave, but the process receives:

```text
FACE_LAB_E2E_MAX_OUTPUTS=8
FACE_LAB_E2E_NEW_OUTPUT_BUDGET=1
```

After the first successful output:

- `manifest.checkpoint.json` remains `status: partial`,
- `manifest.json` must not exist,
- `canary-gate.json` is written with exact source/output/runtime/provider bindings,
- the launcher exits successfully with `FACE_LAB_G_E3_CANARY_READY_FOR_REVIEW`.

A second paid image call in the same canary execution is a contract failure.

### 3. Human review

Open the existing local review board:

```text
http://localhost:3001/face-lab-test/pilot-review
```

Review the canary output before continuing.

### 4. Explicit approval — zero paid image calls

Approve the exact reviewed canary:

```bash
npm run run:face-lab-v2-g-e3-wave -- 1 approve
```

Or reject it:

```bash
npm run run:face-lab-v2-g-e3-wave -- 1 reject
```

Approval is bound to:

- campaign ID,
- wave ID,
- case ID/name,
- source SHA-256,
- output SHA-256,
- render-spec SHA-256,
- simulation version,
- instruction version,
- provider config version/fingerprint.

If any binding changes, resume fails before another paid provider call.

### 5. Resume

```bash
npm run run:face-lab-v2-g-e3-wave -- 1 resume
```

Resume requires an approved canary gate.

The existing canary is reused and does not consume the new-output budget. The launcher derives the remaining paid budget from the checkpoint:

```text
remaining = 8 - persisted_case_count
```

If execution stops after additional successful outputs, those cases remain in `manifest.checkpoint.json`. The next resume reuses them and pays only for still-missing cases.

When all eight cases are present, the provider runner writes the final `manifest.json` and removes the checkpoint.

## Later waves

Wave 2 and wave 3 reuse the same campaign and follow the exact same gate:

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

A specific campaign ID may be supplied as the fourth CLI argument when recovery requires it:

```bash
npm run run:face-lab-v2-g-e3-wave -- 2 resume G-E3-CAL-YYYYMMDDHHMMSS
```

## Frozen bindings

The launcher fails closed if campaign continuity changes:

- source image hash,
- simulation version,
- instruction version,
- Render Spec version when present,
- provider config version,
- provider config fingerprint.

The three waves therefore remain one calibration campaign rather than unrelated experiments.

## Local state

Wave outputs remain under:

`private/face-lab-g-e3/<campaign-id>/wave-0N`

Relevant files:

- `manifest.checkpoint.json`: partial persisted progress.
- `canary-gate.json`: human-gate binding and approval state.
- `manifest.json`: complete 8-case wave only.
- `private/face-lab-g-e3/current-campaign.json`: campaign/wave continuation state.

All generated calibration images remain local and ignored by Git.

## Required invariants

1. Precheck, approve and reject make zero image-provider calls.
2. Canary creates at most one new paid output.
3. Resume is impossible without an approved canary binding.
4. Reused outputs never consume the new paid-output budget.
5. Partial success is checkpointed after every successful paid generation.
6. Re-running a partial wave pays only for missing outputs.
7. No mode can exceed eight total outputs for one wave.
8. CI/push paths never automatically execute paid image generation.
