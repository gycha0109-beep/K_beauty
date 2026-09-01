import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mobileRoot = join(repoRoot, "apps", "mobile");
const moduleRoot = join(mobileRoot, "modules", "bejewely-face-guide");

const moduleConfig = JSON.parse(readFileSync(join(moduleRoot, "expo-module.config.json"), "utf8"));
const gradleSource = readFileSync(join(moduleRoot, "android", "build.gradle"), "utf8");
const kotlinSource = readFileSync(
  join(moduleRoot, "android", "src", "main", "java", "expo", "modules", "bejewelyfaceguide", "BejewelyFaceGuideModule.kt"),
  "utf8"
);
const bridgeSource = readFileSync(join(moduleRoot, "src", "BejewelyFaceGuideModule.ts"), "utf8");
const evaluatorSource = readFileSync(join(mobileRoot, "features", "camera", "NativeFaceGuidance.ts"), "utf8");
const cameraSource = readFileSync(join(mobileRoot, "features", "camera", "NativeFaceCamera.tsx"), "utf8");
const copySource = readFileSync(join(mobileRoot, "lib", "copy.ts"), "utf8");
const workflowSource = readFileSync(join(repoRoot, ".github", "workflows", "mobile-face-guidance.yml"), "utf8");

assert.deepEqual(moduleConfig.platforms, ["android"], "MOBILE-6 native guidance must remain Android-only in this slice");
assert.deepEqual(
  moduleConfig.android?.modules,
  ["expo.modules.bejewelyfaceguide.BejewelyFaceGuideModule"],
  "MOBILE-6 local Expo module registration is missing"
);
assert.match(gradleSource, /expo-module-gradle-plugin/, "Local guidance module must use Expo Modules API");
assert.match(
  gradleSource,
  /com\.google\.mlkit:face-detection:16\.1\.7/,
  "MOBILE-6 must pin the bundled ML Kit face detector for deterministic offline availability"
);
assert.doesNotMatch(
  gradleSource,
  /play-services-mlkit-face-detection/,
  "MOBILE-6 must not depend on a dynamically downloaded Play Services face model"
);

assert.match(kotlinSource, /PERFORMANCE_MODE_FAST/, "Guidance detector must prefer ML Kit fast mode");
assert.match(kotlinSource, /LANDMARK_MODE_NONE/, "MOBILE-6 only needs bounded box/pose guidance, not landmark payload retention");
assert.match(kotlinSource, /CONTOUR_MODE_NONE/, "MOBILE-6 must avoid unnecessary contour processing");
assert.match(kotlinSource, /CLASSIFICATION_MODE_NONE/, "MOBILE-6 must avoid unrelated face classifications");
assert.match(kotlinSource, /setMinFaceSize\(0\.15f\)/, "Minimum face size contract is missing");
assert.match(kotlinSource, /InputImage\.fromFilePath/, "Guidance must process only the local camera sample URI");
assert.match(kotlinSource, /face\.boundingBox/, "Native detector must expose face bounds");
assert.match(kotlinSource, /headEulerAngleX/, "Native detector must expose pitch");
assert.match(kotlinSource, /headEulerAngleY/, "Native detector must expose yaw");
assert.match(kotlinSource, /headEulerAngleZ/, "Native detector must expose roll");
assert.match(kotlinSource, /deleteAfterRead/, "Guidance sample deletion contract is missing");
assert.match(kotlinSource, /File\(path\)\.delete\(\)/, "Local guidance samples must be deleted after detection");
assert.match(kotlinSource, /detector\?\.close\(\)/, "ML Kit detector must close with module lifecycle");

assert.match(bridgeSource, /requireOptionalNativeModule/, "Non-Android platforms must fail open without crashing the native shell");
assert.match(bridgeSource, /BejewelyFaceGuide/, "Native guidance bridge module name is missing");
assert.match(bridgeSource, /detectFacesAsync/, "Native guidance bridge function is missing");

for (const state of [
  "no_face",
  "multiple_faces",
  "too_far",
  "too_close",
  "off_center",
  "not_frontal",
  "stabilizing",
  "ready",
  "unavailable"
]) {
  assert.match(evaluatorSource, new RegExp(`"${state}"`), `Native guidance state is missing: ${state}`);
}
assert.match(evaluatorSource, /Math\.max\(previewRect\.width \/ imageWidth, previewRect\.height \/ imageHeight\)/, "Face bounds must map through object-cover geometry");
assert.match(evaluatorSource, /mirrored/, "Front-camera geometry must remain mirror-aware");
assert.match(evaluatorSource, /Math\.abs\(face\.headEulerAngleX\)/, "Pitch gate is missing");
assert.match(evaluatorSource, /Math\.abs\(face\.headEulerAngleY\)/, "Yaw gate is missing");
assert.match(evaluatorSource, /Math\.abs\(face\.headEulerAngleZ\)/, "Roll gate is missing");
assert.match(evaluatorSource, /NATIVE_FACE_GUIDANCE_SAMPLE_INTERVAL_MS = 1400/, "Guidance sampling must stay throttled");
assert.match(evaluatorSource, /NATIVE_FACE_GUIDANCE_STABLE_SAMPLES = 2/, "Ready state must require consecutive stable samples");

assert.match(cameraSource, /detectNativeFacesAsync/, "Native camera must consume the isolated face-guidance adapter");
assert.match(cameraSource, /testID="native-face-guidance-status"/, "Rendered guidance status evidence hook is missing");
assert.match(cameraSource, /accessibilityLiveRegion="polite"/, "Guidance updates must remain accessible");
assert.match(cameraSource, /quality:\s*0\.2/, "Guidance samples must use bounded low-quality capture");
assert.match(cameraSource, /shutterSound:\s*false/, "Guidance sampling must not emit repeated shutter audio");
assert.match(cameraSource, /detectNativeFacesAsync\(sample\.uri, true\)/, "Guidance samples must request deletion after native detection");
assert.match(cameraSource, /guidanceInFlightRef/, "Guidance sampling must forbid overlapping detector work");
assert.match(cameraSource, /finalCaptureLockRef/, "Final capture must exclude guidance sampling");
assert.match(cameraSource, /await pendingGuidance\.catch/, "Final capture must drain an in-flight guidance sample before taking the user photo");
assert.match(cameraSource, /quality:\s*0\.85/, "MOBILE-5 final capture quality contract must remain intact");
assert.match(cameraSource, /type:\s*"image\/jpeg"/, "MOBILE-5 final JPEG descriptor must remain intact");
assert.match(cameraSource, /skipProcessing:\s*false/, "Final capture must retain orientation processing");

assert.match(copySource, /eyebrow:\s*"SKIN ANALYSIS"/, "Analyze copy must expose the production skin-analysis marker");
assert.match(copySource, /Camera-guidance images stay on your device/, "English local-only guidance disclosure is missing");
assert.match(copySource, /촬영 가이드용 이미지는 기기에만 유지/, "Korean local-only guidance disclosure is missing");
assert.match(copySource, /Face guidance is unavailable\. You can still take the photo manually\./, "Guidance failure must fail open to manual capture");

const protectedAuthorityPatterns = [
  /@supabase\//,
  /\bfetch\s*\(/,
  /XMLHttpRequest/,
  /FormData/,
  /face-lab/i,
  /premium/i,
  /recommend/i,
  /\/api\/analyze/i
];
const boundedSources = [cameraSource, evaluatorSource, bridgeSource, kotlinSource];
for (const source of boundedSources) {
  for (const pattern of protectedAuthorityPatterns) {
    assert.doesNotMatch(source, pattern, `MOBILE-6 must not absorb server/protected/later-phase authority: ${pattern}`);
  }
}

assert.match(workflowSource, /node scripts\/verify-mobile-face-guidance\.mjs/, "MOBILE-6 workflow must execute its contract verifier");
assert.match(workflowSource, /npm run mobile:typecheck/, "MOBILE-6 workflow must typecheck the mobile client");
assert.match(workflowSource, /npm run mobile:prebuild:android/, "MOBILE-6 workflow must exercise Expo native autolinking");
assert.match(workflowSource, /npm run verify:mobile-native/, "MOBILE-6 workflow must verify the generated Android shell");

console.log("MOBILE_FACE_GUIDANCE_NATIVE_MODULE=PASS");
console.log("MOBILE_FACE_GUIDANCE_MLKIT_BUNDLED=PASS");
console.log("MOBILE_FACE_GUIDANCE_STATE_CONTRACT=PASS");
console.log("MOBILE_FACE_GUIDANCE_SAMPLING=PASS");
console.log("MOBILE_FACE_GUIDANCE_MOBILE5_CAPTURE_REGRESSION=PASS");
console.log("MOBILE_6_FACE_CAPTURE_GUIDANCE=PASS");
