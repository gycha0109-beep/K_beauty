# Face Lab V2 Simulation Private Pilot Capture Contract v1

> Track: Face Lab / Gate G-E2A-2
> Status: local private capture bridge
> Provider invocation: none beyond the existing UAT simulation call
> Server-side image persistence: forbidden
> Production authority: none

## 1. Purpose

Gate G-E2A-2 closes the gap between the browser UAT review flow and the existing Gate G-B local evidence runner.

The operator flow is:

```text
/face-lab-test
→ simulation output
→ G-C / G-D review submit
→ Private Pilot Capture
→ local private/ files
→ Gate G-B evidence packet
→ Gate G-E calibration case
```

The capture bridge does not create new evaluation authority. It only materializes the already-bound browser artifacts into a local-only file set.

## 2. No server persistence

The capture bridge must not add:

- a database table for face images,
- a server upload bucket,
- a server filesystem write,
- a background image retention job,
- a new face-image storage API.

The source image already exists in the operator browser as the selected File. The simulation output already exists in the browser as the exact response Blob.

Both are written only after an explicit operator directory selection.

## 3. Required local directory

The browser must use the File System Access API and accept only a directory whose final name is exactly:

```text
private
```

This is an operator safety gate, not a security sandbox.

The repository already ignores `private`. The operator should choose the local repository's ignored `private/` directory.

## 4. Capture admission

Capture is available only after:

- a source image exists,
- a generated simulation Blob exists,
- the simulation response trace exists,
- a committed Face Lab V2 state exists,
- G-C Identity / Edit Scope review is submitted,
- G-D Route / Color review is submitted,
- both review artifacts belong to the same review case,
- the selected Route matches the response Route,
- provider config fingerprint and Render Spec SHA are valid SHA-256 values.

The browser must not capture an expired or unrelated review ticket as evidence.

The review ticket itself is never written into the capture files.

## 5. File set

One admitted case produces exactly five files.

```text
<caseId>.source.<ext>
<caseId>.output.<ext>
<caseId>.identity-scope.review.json
<caseId>.route-color.review.json
<caseId>.evidence-input.json
```

Supported image extensions are derived from MIME type:

- image/jpeg → jpg
- image/png → png
- image/webp → webp

The case ID is restricted to a path-safe identifier so capture cannot create nested paths.

## 6. Evidence input manifest

`<caseId>.evidence-input.json` is directly consumable by:

```bash
node scripts/build-face-lab-v2-simulation-evidence-packet.mjs   ./private/<caseId>.evidence-input.json
```

Shape:

```json
{
  "captureVersion": "face-lab-simulation-pilot-capture-v1",
  "caseId": "case-id",
  "locale": "ko",
  "sourceImagePath": "./case-id.source.jpg",
  "sourceMimeType": "image/jpeg",
  "outputImagePath": "./case-id.output.png",
  "analysis": {},
  "faceLabV2State": {},
  "responseMeta": {
    "simulationVersion": "face-lab-ai-simulation-v1",
    "instructionVersion": "face-lab-simulation-instruction-v1",
    "providerConfigVersion": "face-lab-simulation-provider-config-v1",
    "providerConfigFingerprint": "64-hex",
    "routeId": "route-id",
    "lookId": "look-id",
    "renderSpecSha256": "64-hex"
  },
  "checkEvidencePaths": [
    "./case-id.identity-scope.review.json",
    "./case-id.route-color.review.json"
  ]
}
```

Paths are relative to the manifest directory. No absolute local path is stored.

## 7. Write order

The browser writes in this order:

1. source image,
2. output image,
3. G-C review JSON,
4. G-D review JSON,
5. evidence input manifest.

The manifest is written last so its presence represents the completion marker for the capture attempt.

Re-running the same case overwrites the same deterministic filenames.

## 8. Privacy boundary

The local private capture may contain the source face image, generated face image, structured observation analysis, Face Lab state, and reviewer reference because those are required to build the evidence packet.

Those artifacts must remain under the ignored local `private/` boundary.

The repository-safe G-B packet continues to strip:

- raw image bytes,
- local paths,
- reviewer reference,
- raw analysis,
- raw Face Lab state.

## 9. Forbidden material

The capture descriptor and manifest must not persist:

- signed simulation authority token,
- signed review ticket,
- API key,
- provider request payload,
- prompt text,
- data URL / base64 image payload.

## 10. Next gate

G-E2A-3 may add a one-command local runner that takes the completed private capture and produces:

```text
G-B evidence packet
→ G-E calibration case
```

Gate G-E2A-2 itself does not invoke a provider, aggregate a campaign, or define promotion thresholds.
