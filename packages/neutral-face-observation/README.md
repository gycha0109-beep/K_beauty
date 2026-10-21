# @myeongha/neutral-face-observation

Saju-owned standalone ESM package, `0.1.0-research.0`. Research-only.
Independent of the full Saju reading engine and MediaPipe runtime. No
external dependencies, standalone Node 20+ testing.

## API

`consumeNeutralFaceObservation({faceLandmarks,faceCount,coordinateSpace,onFrame})`

Provider data is **not** fetched: pass one already-detected 468/478-point
MediaPipe FaceLandmarker observation in EXIF-oriented, non-mirrored original
image coordinates. Validate *all* x/y/z values; supply a 468-point immutable
x/y frame plus seven named image-space anchor proxies to a **synchronous**
callback. The callback must not retain or transmit images/landmarks.

Returns a redacted fail-closed receipt. No biometric persistence, patient
diagnosis, skin-colour measurement, anatomical zygion/laterality evidence,
photometric calibration or morphology/traditional semantics are provided.

Release state: package-format candidate, private. It is **not** published to
npm or activated in any Saju/MyeongHa production service. To promote as a
stable cross-repository SDK, add independent review, release governance,
semantic-version policy, integrity pins and real dataset validation.

`npm test` runs only synthetic observations.
