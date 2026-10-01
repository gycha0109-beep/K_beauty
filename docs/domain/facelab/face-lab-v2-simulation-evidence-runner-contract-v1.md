# Face Lab V2 Simulation Evidence Runner Contract v1

> Track: Face Lab / Gate G-B
> Status: privacy-safe evidence packet foundation
> Provider invocation: none
> Production authority: none

## 1. Purpose

Gate G-A defined how evaluation evidence is adjudicated.

Gate G-B defines how one real simulation run is converted into a reproducible, repository-safe evidence packet without committing the user's source face image or generated image.

The packet is a trace and evaluation carrier. It does not create visual judgments by itself.

## 2. Exact intent binding

A quality review is meaningful only when it is bound to the exact Render Spec used for generation.

The simulation endpoint therefore returns:

- simulation version,
- instruction version,
- Route ID,
- Look ID,
- Render Spec SHA-256,
- current fidelity status.

The Render Spec itself remains server-authoritative and is not accepted from the browser.

The evidence runner rebuilds canonical Face Lab state from:

- authoritative observation analysis,
- Face Lab V2 user state,
- locale.

It then rebuilds the canonical Look and Render Spec using the same shared Render Authority functions as the simulation endpoint.

The reconstructed Render Spec SHA-256 must exactly equal the digest returned by the simulation response.

A mismatch invalidates the packet.

## 3. Image handling

The local runner may read:

- the original local source image,
- the generated simulation image.

The source image is canonicalized through the same image canonicalization boundary used by the simulation endpoint before hashing.

The output image is hashed as the exact returned bytes.

The output packet contains only SHA-256 values.

It must not contain:

- raw image bytes,
- base64 image data,
- source/output local paths,
- data URLs.

## 4. Analysis and state privacy

The runner needs analysis and Face Lab V2 state to deterministically reconstruct Render Authority.

The output packet does not copy those structures.

It stores:

- `analysisSha256`
- `faceLabV2StateSha256`

plus a bounded Render Intent summary needed for later evaluation.

## 5. Render Intent summary

The packet may expose only the evaluation-relevant operation surface:

- identity lock,
- operation ID,
- slot key,
- source mode,
- target regions,
- color fidelity state.

It does not expose provider payload, prompts, source image data, or product binding internals.

## 6. Pending evaluation state

Gate G-B does not manufacture visual judgments.

When no checks are supplied, the packet creates:

- Identity Preservation → NOT_EVALUATED
- Route Adherence → NOT_EVALUATED
- Edit Scope → NOT_EVALUATED
- Color Fidelity → NOT_EVALUATED when color intent exists
- Color Fidelity → NOT_APPLICABLE when no color intent exists

The overall verdict therefore remains NOT_EVALUATED until Gate G-C/G-D evidence is supplied.

## 7. CLI input

The local operator input JSON has this shape:

~~~json
{
  "caseId": "G-001",
  "locale": "ko",
  "sourceImagePath": "./private/source.jpg",
  "sourceMimeType": "image/jpeg",
  "outputImagePath": "./private/output.png",
  "analysis": {},
  "faceLabV2State": {},
  "responseMeta": {
    "simulationVersion": "face-lab-ai-simulation-v1",
    "instructionVersion": "face-lab-simulation-instruction-v1",
    "routeId": "route-id",
    "lookId": "look-id",
    "renderSpecSha256": "64-hex"
  }
}
~~~

The image paths are operator-local input only and are never copied into output.

## 8. CLI execution

~~~bash
node scripts/build-face-lab-v2-simulation-evidence-packet.mjs ./private/gate-g-input.json
~~~

or:

~~~bash
FACE_LAB_SIMULATION_EVIDENCE_INPUT=./private/gate-g-input.json \
node scripts/build-face-lab-v2-simulation-evidence-packet.mjs
~~~

The command writes the packet to stdout.

It does not persist images or upload anything.

## 9. Invalid packet conditions

The runner must reject at minimum:

- missing case ID,
- missing image bytes,
- invalid canonical Face Lab state,
- uncommitted Route,
- unavailable canonical Look,
- unavailable Render Spec,
- stale/wrong simulation version,
- Route or Look mismatch,
- malformed Render Spec digest,
- reconstructed Render Spec digest mismatch,
- invalid Gate G-A evidence.

## 10. Authority separation

The browser remains unable to submit:

- Render Spec,
- canonical Look,
- appearance handoff,
- prompt,
- provider payload.

Gate G-B does not change recommendation or product authority.

The response trace proves which server-authoritative Render Spec the generated image was associated with; it does not make the browser an authority.

## 11. Next gates

Gate G-C produces Identity Preservation and Edit Scope evidence.

Gate G-D produces Route Adherence and Color Fidelity evidence.

Only after calibrated evidence exists may the current simulation `fidelity: not_evaluated` status be considered for promotion.
