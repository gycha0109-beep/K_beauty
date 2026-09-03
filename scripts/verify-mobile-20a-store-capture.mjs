import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function fail(label) {
  console.error(`MOBILE_20A_STORE_CAPTURE=FAIL ${label}`);
  process.exit(1);
}

function assert(condition, label) {
  if (!condition) fail(label);
}

const listing = JSON.parse(read("docs/store/mobile-store-listing-final.json"));
const result = read("apps/mobile/features/analyze/NativeAnalyzeResult.tsx");
const capture = read("scripts/capture-mobile-store-assets.sh");
const workflow = read(".github/workflows/mobile-20a-store-capture.yml");

assert(listing.screenshotPlan?.sourceOfTruth === "production mobile runtime after MOBILE-17A", "production-runtime-source");
assert(listing.googlePlay?.phoneScreenshots?.targetPortraitSize === "1080x1920", "google-play-target-size");
assert(listing.googlePlay?.phoneScreenshots?.targetCount === 4, "google-play-target-count");
assert(Array.isArray(listing.screenshotPlan?.targetFrames) && listing.screenshotPlan.targetFrames.length === 4, "four-frame-plan");

for (const id of ["home", "analyze", "results", "diary"]) {
  assert(listing.screenshotPlan.targetFrames.some((frame) => frame.id === id), `frame:${id}`);
}

assert(!result.includes("MOBILE-7 · SERVER RESULT"), "no-internal-release-label");
assert(!result.includes("Premium and Face Lab engines are not duplicated in the native app."), "no-internal-engine-boundary-en");
assert(!result.includes("Premium 및 Face Lab 엔진은 네이티브 앱으로 복제하지 않습니다."), "no-internal-engine-boundary-ko");
assert(result.includes("PERSONALIZED SKIN-CARE ROUTINE"), "consumer-result-kicker-en");
assert(result.includes("맞춤 스킨케어 루틴"), "consumer-result-kicker-ko");
assert(result.includes("everyday cosmetic skin-care guidance"), "cosmetic-boundary-en");
assert(result.includes("일상적인 화장품·스킨케어 가이드"), "cosmetic-boundary-ko");

for (const marker of [
  "adb shell wm size 1080x1920",
  'capture_png "01-home-en-1080x1920.png"',
  'capture_png "02-analyze-en-1080x1920.png"',
  'capture_png "01-home-ko-1080x1920.png"',
  'capture_png "02-analyze-ko-1080x1920.png"',
  "if (width, height) != (1080, 1920)",
  'if adb exec-out screencap -p > "$output"; then',
  "local transport_status=0",
  "MOBILE_STORE_SCREENSHOT_TRANSPORT_RECOVERY=PASS",
  "QUICKSTEP_RECOVERY_COUNT=0",
  "QUICKSTEP_RECOVERY_LIMIT=2",
  "recover_quickstep_if_needed()",
  "Quickstep isn't responding",
  "MOBILE_STORE_QUICKSTEP_ANR_RECOVERY=PASS",
  "MOBILE_STORE_DIRECT_ACTIVITY_RESTART=PASS",
  "UI_DUMP_RETRY_LIMIT=4",
  'for attempt in $(seq 1 "$UI_DUMP_RETRY_LIMIT"); do',
  'rm -f "$UI_DUMP"',
  "MOBILE_STORE_UI_DUMP_RECOVERY=PASS",
  "UI dump failed after %s attempts",
  "tap_text_from_current_ui()",
  'tap_text_from_current_ui "Take photo"',
  'tap_text_from_current_ui "사진 촬영"',
  "MOBILE_STORE_CURRENT_UI_TAP=PASS",
  'tap_text "Open camera" || true',
  'tap_text "카메라 열기" || true',
  "MOBILE_STORE_CAMERA_ENTRY=PASS",
  "tap_text_until_gone()",
  'tap_text_until_gone "Use photo" 8',
  'tap_text_until_gone "이 사진 사용" 8',
  "scroll_text_into_store_frame()",
  'scroll_text_into_store_frame "Skin survey before analysis" 360 1050 8',
  'scroll_text_into_store_frame "분석 전 피부 설문" 360 1050 8',
  "STORE_SCROLL_UP_START_Y=1420",
  "STORE_SCROLL_UP_END_Y=680",
  "reset_store_capture_session()",
  'adb shell am force-stop "$PACKAGE_ID"',
  "MOBILE_STORE_LOCALE_SESSION_RESET=PASS locale=ko",
  "MOBILE_STORE_TRANSITION=PASS",
  "MOBILE_STORE_VIEWPORT_TEXT=PASS",
  "MOBILE_20A_HOME_CAPTURE=PASS",
  "MOBILE_20A_ANALYZE_CAPTURE=PASS",
  "MOBILE_20A_STORE_CAPTURE=PASS"
]) {
  assert(capture.includes(marker), `capture-marker:${marker}`);
}

assert(capture.split("if recover_quickstep_if_needed; then").length - 1 === 2, "bounded-recovery-in-both-waits");
assert(capture.includes("if (( QUICKSTEP_RECOVERY_COUNT >= QUICKSTEP_RECOVERY_LIMIT )); then"), "bounded-recovery-limit-enforced");
assert(!capture.includes("wait_for_text_with_scroll"), "no-hierarchy-only-survey-visibility");
assert(!capture.includes("dump_ui() {\n  adb shell uiautomator dump"), "no-one-shot-ui-dump");
assert(!capture.includes('wait_for_text "Camera ready"\ntap_text "Take photo"'), "no-camera-preview-redump-en");
assert(!capture.includes('wait_for_text "카메라 준비 완료"\ntap_text "사진 촬영"'), "no-camera-preview-redump-ko");
assert(capture.split("tap_text_from_current_ui \"").length - 1 === 2, "two-current-ui-camera-taps");
assert(capture.split("MOBILE_STORE_CAMERA_ENTRY=PASS locale=").length - 1 === 2, "two-camera-entry-race-guards");
assert(capture.split('adb shell input swipe 540 "$STORE_SCROLL_UP_START_Y" 540 "$STORE_SCROLL_UP_END_Y" 350').length - 1 === 2, "two-scroll-up-gestures-inside-content-viewport");
assert(!capture.includes("adb shell input swipe 540 1580 540 680 350"), "no-scroll-gesture-from-below-content-viewport");
assert(capture.split('adb shell pm clear "$PACKAGE_ID"').length - 1 === 2, "two-clean-localized-capture-sessions");
assert(capture.split("MOBILE_STORE_LOCALE_SESSION_RESET=PASS locale=ko").length - 1 === 1, "one-locale-session-reset");

const screenshotTransportAttempt = capture.indexOf('if adb exec-out screencap -p > "$output"; then');
const screenshotDimensionValidation = capture.indexOf("if (width, height) != (1080, 1920)", screenshotTransportAttempt);
const screenshotTransportRecovery = capture.indexOf("MOBILE_STORE_SCREENSHOT_TRANSPORT_RECOVERY=PASS", screenshotDimensionValidation);
assert(screenshotTransportAttempt >= 0, "screenshot-transport-attempt-is-guarded");
assert(screenshotDimensionValidation > screenshotTransportAttempt, "screenshot-png-validation-after-transport-attempt");
assert(screenshotTransportRecovery > screenshotDimensionValidation, "screenshot-transport-recovery-only-after-png-validation");
assert(!capture.includes('adb exec-out screencap -p > "$output"\n  python - "$output"'), "no-unbounded-screenshot-transport-exit");

const enAnalyzeCapture = capture.indexOf('capture_png "02-analyze-en-1080x1920.png"');
const localeSessionReset = capture.indexOf("reset_store_capture_session\n", enAnalyzeCapture);
const koLocaleSwitch = capture.indexOf('tap_text "locale-ko"', localeSessionReset);
const koHomeCapture = capture.indexOf('capture_png "01-home-ko-1080x1920.png"', koLocaleSwitch);
assert(enAnalyzeCapture >= 0 && localeSessionReset > enAnalyzeCapture, "locale-session-reset-after-en-analyze");
assert(koLocaleSwitch > localeSessionReset, "ko-locale-switch-after-session-reset");
assert(koHomeCapture > koLocaleSwitch, "ko-home-after-clean-locale-switch");
assert(!capture.includes('capture_png "02-analyze-en-1080x1920.png"\n\ntap_text "Home"'), "no-stateful-en-to-ko-tab-transition");

for (const forbidden of [
  "saved-report-signed-out-en.png",
  "premium-signed-out-en.png",
  "public-result-deep-link-invalid-en.png"
]) {
  assert(!capture.includes(forbidden), `no-placeholder-store-asset:${forbidden}`);
}

assert(workflow.includes("Checkout exact candidate SHA"), "exact-sha-checkout");
assert(workflow.includes("Attest exact checked-out SHA"), "exact-sha-attestation");
assert(workflow.includes("bash scripts/capture-mobile-store-assets.sh"), "capture-runtime-step");
assert(workflow.includes("apps/mobile/.mobile-store-artifacts/**"), "artifact-upload-path");
assert(workflow.includes("ReactiveCircus/android-emulator-runner@a421e43855164a8197daf9d8d40fe71c6996bb0d"), "pinned-emulator-runner");
assert(workflow.includes('key="hw.camera.$camera"'), "dual-camera-avd-loop");
assert(workflow.includes('grep -q "^${key}=emulated$" "$config"'), "dual-camera-avd-attestation");
assert(workflow.includes("MOBILE_20A_DUAL_CAMERA_AVD_CONFIG=PASS"), "dual-camera-avd-marker");
assert(workflow.includes("-camera-front emulated -camera-back emulated"), "dual-camera-emulator-options");
assert(!workflow.includes("-camera-back none"), "no-disabled-back-camera");

console.log("MOBILE_20A_RESULT_SURFACE=PASS");
console.log("MOBILE_20A_CAPTURE_DIMENSIONS=PASS");
console.log("MOBILE_20A_SCREENSHOT_TRANSPORT_RECOVERY=PASS");
console.log("MOBILE_20A_QUICKSTEP_RECOVERY=PASS");
console.log("MOBILE_20A_UI_DUMP_RETRY_GUARD=PASS");
console.log("MOBILE_20A_CURRENT_UI_CAMERA_TAP=PASS");
console.log("MOBILE_20A_CAMERA_ENTRY_RACE_GUARD=PASS");
console.log("MOBILE_20A_TRANSITION_GUARD=PASS");
console.log("MOBILE_20A_VIEWPORT_GUARD=PASS");
console.log("MOBILE_20A_SCROLL_VIEWPORT_GUARD=PASS");
console.log("MOBILE_20A_LOCALE_SESSION_ISOLATION=PASS");
console.log("MOBILE_20A_PLACEHOLDER_EXCLUSION=PASS");
console.log("MOBILE_20A_DUAL_CAMERA_CONTRACT=PASS");
console.log("MOBILE_20A_EXACT_HEAD_WORKFLOW=PASS");
console.log("MOBILE_20A_STORE_CAPTURE=PASS");
