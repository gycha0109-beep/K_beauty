# Face Lab V2 Simulation Pilot Case Runner Contract v1

> Track: Face Lab / Gate G-E2A-3
> Status: local one-command orchestration
> Provider invocation: none
> Server-side image persistence: none
> Production authority: none

## 1. Purpose

Gate G-E2A-2 captures one reviewed simulation into the ignored local `private/` boundary.

Gate G-E2A-3 converts that completed capture into the two artifacts needed by the calibration pipeline:

```text
Private Pilot Capture
→ G-B Evidence Packet
→ G-E Calibration Case
```

The runner does not generate a new image and does not ask a reviewer to judge the image again.

## 2. Run spec

The operator creates one JSON file directly under the repository's ignored `private/` directory.

Example:

```json
{
  "captureManifestPath": "./case-001.evidence-input.json",
  "campaignId": "G-E-PILOT-001",
  "intentGroupId": "intent-001",
  "generationIndex": 1,
  "changeIntensity": "moderate",
  "routeSelectionState": "user_selected"
}
```

The campaign fields have the same meaning as the existing G-E calibration case contract.

Allowed `changeIntensity` values remain:

- `minimal`
- `light`
- `moderate`
- `high`

Allowed `routeSelectionState` values remain:

- `user_selected`
- `single_route_auto`

## 3. Execution

```bash
node scripts/run-face-lab-v2-simulation-pilot-case.mjs   ./private/case-001.pilot-case-run.json
```

Or:

```bash
FACE_LAB_SIMULATION_PILOT_CASE_INPUT=./private/case-001.pilot-case-run.json node scripts/run-face-lab-v2-simulation-pilot-case.mjs
```

The run spec itself must be directly inside a directory named `private`.

The capture manifest and every referenced source/output/review file must remain in the same `private/` directory. Path traversal outside that directory is rejected.

## 4. Inputs

The runner consumes the G-E2A-2 capture set:

```text
<caseId>.source.<ext>
<caseId>.output.<ext>
<caseId>.identity-scope.review.json
<caseId>.route-color.review.json
<caseId>.evidence-input.json
```

The source image is canonicalized through the same image canonicalization boundary as the existing G-B evidence runner.

The output image must have a recognized image signature.

The review set must contain exactly one G-C artifact and one G-D artifact.

## 5. Outputs

A successful run writes exactly:

```text
<caseId>.evidence-packet.json
<caseId>.calibration-case.json
```

to the same local `private/` directory.

The evidence packet is built through the existing `buildFaceLabSimulationEvidencePacket` authority.

The calibration case is built through the existing `buildFaceLabSimulationCalibrationCase` authority.

The runner therefore owns orchestration only. It does not create a second evaluation or calibration implementation.

## 6. Binding requirements

The run fails closed when any required binding is invalid, including:

- capture contract version
- case ID
- source/output bytes
- Render Spec binding
- simulation/instruction/provider runtime binding
- G-C review contract and digest
- G-D review contract and digest
- campaign metadata
- intent group metadata
- generation index
- change intensity
- route selection state

The resulting calibration case must retain the same Case ID as the capture.

## 7. Privacy

The runner may read raw source/output images and reviewer artifacts because it executes only inside the local ignored `private/` boundary.

Its generated G-B packet and G-E case contain no raw image bytes or local absolute paths.

The command stdout reports only relative output filenames and non-personal calibration identifiers.

It must not print:

- raw image bytes
- base64/data URLs
- review ticket
- simulation authority token
- API key
- provider request payload
- prompt text
- absolute private path

## 8. Write semantics

Both output filenames are deterministic for the Case ID.

The runner writes JSON through temporary files and renames them into place.

The calibration case is written after the evidence packet.

Re-running an unchanged capture and run spec replaces the same two output files with equivalent deterministic artifacts.

## 9. Relationship to existing CLIs

The existing CLIs remain supported:

- `build-face-lab-v2-simulation-evidence-packet.mjs`
- `build-face-lab-v2-simulation-calibration-case.mjs`
- `aggregate-face-lab-v2-simulation-calibration.mjs`

G-E2A-3 is an operator convenience and reproducibility bridge. It does not replace those lower-level tools.

## 10. Next gate

Gate G-E2B uses the completed capture/runner path for the first controlled pilot:

```text
4 intents × 2 generations = 8 outputs
```

All eight cases must remain under one frozen `campaignRuntime` binding before campaign aggregation.
