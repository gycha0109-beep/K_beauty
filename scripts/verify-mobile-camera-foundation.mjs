import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mobileRoot = join(repoRoot, "apps", "mobile");

const mobilePackage = JSON.parse(readFileSync(join(mobileRoot, "package.json"), "utf8"));
const appConfig = JSON.parse(readFileSync(join(mobileRoot, "app.json"), "utf8"));
const cameraSource = readFileSync(join(mobileRoot, "features", "camera", "NativeFaceCamera.tsx"), "utf8");
const analyzeSource = readFileSync(join(mobileRoot, "app", "analyze.tsx"), "utf8");
const copySource = readFileSync(join(mobileRoot, "lib", "copy.ts"), "utf8");
const nativeShellWorkflow = readFileSync(join(repoRoot, ".github", "workflows", "mobile-native-shell.yml"), "utf8");
const cameraWorkflow = readFileSync(join(repoRoot, ".github", "workflows", "mobile-camera.yml"), "utf8");
const androidSmokeSource = readFileSync(join(repoRoot, "scripts", "verify-mobile-android-smoke.sh"), "utf8");

assert.equal(
  mobilePackage.dependencies?.["expo-camera"],
  "~57.0.3",
  "MOBILE-5 must use the Expo SDK 57 camera compatibility range"
);

const cameraPlugin = appConfig.expo?.plugins?.find(
  (plugin) => Array.isArray(plugin) && plugin[0] === "expo-camera"
);
assert.ok(cameraPlugin, "expo-camera config plugin is required");
assert.equal(cameraPlugin[1]?.recordAudioAndroid, false, "MOBILE-5 is photo-only and must not request Android audio recording");
assert.equal(cameraPlugin[1]?.barcodeScannerEnabled, false, "MOBILE-5 does not use barcode scanning");
assert.match(cameraPlugin[1]?.cameraPermission || "", /camera/i, "Camera permission copy must remain explicit");

assert.match(cameraSource, /from "expo-camera"/, "Native camera must use expo-camera");
assert.match(cameraSource, /\bCameraView\b/, "Native camera preview is missing");
assert.match(cameraSource, /\buseCameraPermissions\b/, "Native camera permission hook is missing");
assert.match(cameraSource, /\buseFocusEffect\b/, "Camera must unmount its preview when Analyze loses focus");
assert.match(cameraSource, /facing="front"/, "MOBILE-5 must default to the front camera");
assert.match(cameraSource, /mode="picture"/, "MOBILE-5 must remain photo-only");
assert.match(cameraSource, /onCameraReady=/, "Capture must be gated on camera readiness");
assert.match(cameraSource, /takePictureAsync\(/, "Native photo capture is missing");
assert.match(cameraSource, /base64:\s*false/, "MOBILE-5 must not inflate the captured photo into base64");
assert.match(cameraSource, /capturedPhoto\.uri/, "Captured cache URI must drive local preview");
assert.match(cameraSource, /setCapturedPhoto\(null\)/, "Retake must discard the previous local capture");
assert.match(cameraSource, /Linking\.openSettings\(\)/, "Permanent permission denial must have a recoverable settings path");
assert.match(cameraSource, /textTransform:\s*"uppercase"/, "Captured section label casing is part of the rendered Android smoke contract");

assert.match(analyzeSource, /NativeFaceCamera/, "Analyze route must render the native camera foundation");
assert.match(analyzeSource, /copy\.camera/, "Analyze route must keep camera copy locale-aware");
assert.match(copySource, /ANALYZE · MOBILE-5/, "MOBILE-5 copy marker is missing");
assert.match(copySource, /로컬 캐시/, "Korean local-only capture disclosure is missing");
assert.match(copySource, /local cache/i, "English local-only capture disclosure is missing");

assert.match(
  nativeShellWorkflow,
  /-camera-front emulated/,
  "Android native smoke must boot with an emulated front camera"
);
assert.match(
  nativeShellWorkflow,
  /pre-emulator-launch-script: \|\n\s+config=.*; test -f "\$config";.*hw\.camera\.front=emulated.*MOBILE_ANDROID_FRONT_CAMERA_AVD_CONFIG=PASS/,
  "Android native smoke must configure the AVD front camera in one pre-launch shell command"
);
assert.match(
  cameraWorkflow,
  /scripts\/verify-mobile-android-smoke\.sh/,
  "Camera gate must rerun when the Android camera smoke changes"
);
assert.match(
  cameraWorkflow,
  /\.github\/workflows\/mobile-native-shell\.yml/,
  "Camera gate must rerun when native-shell camera wiring changes"
);
assert.match(
  cameraWorkflow,
  /bash -n scripts\/verify-mobile-android-smoke\.sh/,
  "Camera gate must validate Android smoke shell syntax before native build"
);
assert.match(
  androidSmokeSource,
  /wait_for_text_with_scroll\(\)/,
  "Android camera smoke must support viewport-aware status discovery"
);
assert.match(
  androidSmokeSource,
  /wait_for_text_with_scroll "Camera ready" up 4/,
  "Android camera smoke must find the ready state below the preview"
);
assert.match(
  androidSmokeSource,
  /wait_for_text_with_scroll "CAPTURED PHOTO" down 4/,
  "Android camera smoke must verify the rendered captured-state label after scrolling back"
);
assert.match(
  androidSmokeSource,
  /wait_for_text_with_scroll "Retake" up 4/,
  "Android camera smoke must find and exercise the retake control"
);

const forbiddenPatterns = [
  /@mediapipe\//,
  /skin-match-decision-engine/,
  /face-lab/i,
  /premium/i,
  /@supabase\//,
  /\bfetch\s*\(/,
  /XMLHttpRequest/,
  /FormData/,
  /\bwindow\./,
  /\bdocument\./,
  /navigator\.mediaDevices/,
  /<video\b/i,
  /recommend/i
];

for (const pattern of forbiddenPatterns) {
  assert.doesNotMatch(
    cameraSource,
    pattern,
    `MOBILE-5 camera acquisition must not absorb browser/server/recommendation authority: ${pattern}`
  );
}

console.log("MOBILE_CAMERA_FOUNDATION=PASS");
