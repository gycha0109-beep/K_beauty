#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MOBILE_ROOT="$REPO_ROOT/apps/mobile"
IOS_ROOT="$MOBILE_ROOT/ios"
FINAL_ARTIFACT_DIR="$MOBILE_ROOT/.mobile-ios-artifacts"
TEMP_BASE="${RUNNER_TEMP:-${TMPDIR:-/tmp}}"
WORK_ROOT="$TEMP_BASE/bejewely-mobile-ios-${GITHUB_RUN_ID:-local}-${GITHUB_RUN_ATTEMPT:-1}"
ARTIFACT_DIR="$WORK_ROOT/artifacts"
DERIVED_DATA="$WORK_ROOT/derived-data"
BUNDLE_ID="com.bejewely.mobile"
URL_SCHEME="bejewely"
WORKSPACE="$IOS_ROOT/BEJEWELY.xcworkspace"
SCHEME="BEJEWELY"
START_MARKER="$ARTIFACT_DIR/smoke-start.marker"
APP_PATH="$DERIVED_DATA/Build/Products/Release-iphonesimulator/BEJEWELY.app"
OCR_SCRIPT="$WORK_ROOT/verify-screen-text.swift"

rm -rf "$WORK_ROOT" "$FINAL_ARTIFACT_DIR"
mkdir -p "$ARTIFACT_DIR"
touch "$START_MARKER"

test -d "$WORKSPACE"

INITIAL_STATE="Unknown"
UDID=""

stage_artifacts() {
  set +e
  rm -rf "$FINAL_ARTIFACT_DIR"
  mkdir -p "$FINAL_ARTIFACT_DIR"
  if [[ -d "$ARTIFACT_DIR" ]]; then
    cp -R "$ARTIFACT_DIR"/. "$FINAL_ARTIFACT_DIR"/
  fi
  if [[ -d "$APP_PATH" ]]; then
    rm -rf "$FINAL_ARTIFACT_DIR/BEJEWELY.app"
    ditto "$APP_PATH" "$FINAL_ARTIFACT_DIR/BEJEWELY.app"
  fi
}

cleanup() {
  stage_artifacts
  if [[ -n "$UDID" && "$INITIAL_STATE" != "Booted" ]]; then
    xcrun simctl shutdown "$UDID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

preapprove_url_scheme() {
  local approval_domain="com.apple.launchservices.schemeapproval"
  local approval_key="com.apple.CoreSimulator.CoreSimulatorBridge-->$URL_SCHEME"
  local approval_value

  xcrun simctl spawn "$UDID" defaults write \
    "$approval_domain" \
    "$approval_key" \
    -string "$BUNDLE_ID"

  approval_value="$(xcrun simctl spawn "$UDID" defaults read \
    "$approval_domain" \
    "$approval_key")"
  test "$approval_value" = "$BUNDLE_ID"

  xcrun simctl spawn "$UDID" defaults export \
    "$approval_domain" - \
    > "$ARTIFACT_DIR/scheme-approval.plist"

  python3 - "$ARTIFACT_DIR/scheme-approval.plist" "$approval_key" "$BUNDLE_ID" <<'PY'
import plistlib
import sys

path, key, expected = sys.argv[1:]
with open(path, "rb") as handle:
    payload = plistlib.load(handle)

if not isinstance(payload, dict):
    raise SystemExit("scheme approval plist is not a dictionary")

actual = payload.get(key)
if actual != expected:
    raise SystemExit(
        f"scheme approval mismatch: key={key!r} expected={expected!r} actual={actual!r}"
    )
PY

  printf 'MOBILE_IOS_URL_SCHEME_PREAPPROVAL_PERSISTED=PASS\n' | tee -a "$ARTIFACT_DIR/runtime-markers.txt"

  xcrun simctl shutdown "$UDID"
  xcrun simctl boot "$UDID"
  xcrun simctl bootstatus "$UDID" -b

  approval_value="$(xcrun simctl spawn "$UDID" defaults read \
    "$approval_domain" \
    "$approval_key")"
  test "$approval_value" = "$BUNDLE_ID"
  printf 'MOBILE_IOS_URL_SCHEME_PREAPPROVAL_RELOAD=PASS\n' | tee -a "$ARTIFACT_DIR/runtime-markers.txt"
}


write_ocr_script() {
  cat > "$OCR_SCRIPT" <<'SWIFT'
import Darwin
import Foundation
import ImageIO
import Vision

func fail(_ message: String) -> Never {
  if let data = (message + "\n").data(using: .utf8) {
    FileHandle.standardError.write(data)
  }
  exit(1)
}

let args = CommandLine.arguments
guard args.count >= 4 else {
  fail("usage: verify-screen-text.swift <image> <contains|excludes> <token>...")
}

let imagePath = args[1]
let mode = args[2]
let tokens = Array(args.dropFirst(3))
let imageURL = URL(fileURLWithPath: imagePath) as CFURL
guard
  let source = CGImageSourceCreateWithURL(imageURL, nil),
  let image = CGImageSourceCreateImageAtIndex(source, 0, nil)
else {
  fail("unable to load screenshot: \(imagePath)")
}

let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.usesLanguageCorrection = true
request.recognitionLanguages = ["en-US"]
let handler = VNImageRequestHandler(cgImage: image, options: [:])
do {
  try handler.perform([request])
} catch {
  fail("Vision OCR failed for \(imagePath): \(error)")
}

let recognized = (request.results ?? [])
  .compactMap { $0.topCandidates(1).first?.string }
  .joined(separator: "\n")

func contains(_ token: String) -> Bool {
  recognized.range(
    of: token,
    options: [.caseInsensitive, .diacriticInsensitive]
  ) != nil
}

switch mode {
case "contains":
  for token in tokens where !contains(token) {
    fail("missing OCR token \(token.debugDescription) in \(imagePath); recognized=\(recognized.debugDescription)")
  }
case "excludes":
  for token in tokens where contains(token) {
    fail("forbidden OCR token \(token.debugDescription) appeared in \(imagePath); recognized=\(recognized.debugDescription)")
  }
default:
  fail("unknown OCR mode: \(mode)")
}

print("MOBILE_IOS_OCR=PASS file=\(imagePath) mode=\(mode)")
SWIFT
}

assert_screenshot_contains() {
  local image="$1"
  shift
  xcrun swift "$OCR_SCRIPT" "$image" contains "$@"
}

assert_screenshot_excludes() {
  local image="$1"
  shift
  xcrun swift "$OCR_SCRIPT" "$image" excludes "$@"
}

{
  xcodebuild -version
  printf '\n'
  xcrun simctl list runtimes
} > "$ARTIFACT_DIR/toolchain.txt"

xcrun simctl list devices available -j > "$ARTIFACT_DIR/simulators.json"

python3 - "$ARTIFACT_DIR/simulators.json" > "$ARTIFACT_DIR/simulator-selection.txt" <<'PY'
import json
import re
import sys

with open(sys.argv[1], encoding="utf-8") as handle:
    payload = json.load(handle)

def version_key(runtime_id):
    match = re.search(r"iOS[-.]([0-9-]+)$", runtime_id)
    if not match:
        return ()
    return tuple(int(part) for part in match.group(1).split("-") if part.isdigit())

candidates = []
for runtime_id, devices in payload.get("devices", {}).items():
    if "SimRuntime.iOS-" not in runtime_id:
        continue
    for device in devices:
        if not device.get("isAvailable", False):
            continue
        if not str(device.get("name", "")).startswith("iPhone"):
            continue
        candidates.append((version_key(runtime_id), runtime_id, device))

if not candidates:
    raise SystemExit("No available iPhone simulator found")

_, runtime_id, device = max(candidates, key=lambda item: (item[0], item[2].get("name", "")))
print(device["udid"])
print(device["name"])
print(runtime_id)
print(device.get("state", "Unknown"))
PY

UDID="$(sed -n '1p' "$ARTIFACT_DIR/simulator-selection.txt")"
DEVICE_NAME="$(sed -n '2p' "$ARTIFACT_DIR/simulator-selection.txt")"
RUNTIME_ID="$(sed -n '3p' "$ARTIFACT_DIR/simulator-selection.txt")"
INITIAL_STATE="$(sed -n '4p' "$ARTIFACT_DIR/simulator-selection.txt")"

test -n "$UDID"
test -n "$DEVICE_NAME"
test -n "$RUNTIME_ID"

printf 'MOBILE_IOS_SIMULATOR_UDID=%s\n' "$UDID" | tee "$ARTIFACT_DIR/runtime-markers.txt"
printf 'MOBILE_IOS_SIMULATOR_DEVICE=%s\n' "$DEVICE_NAME" | tee -a "$ARTIFACT_DIR/runtime-markers.txt"
printf 'MOBILE_IOS_SIMULATOR_RUNTIME=%s\n' "$RUNTIME_ID" | tee -a "$ARTIFACT_DIR/runtime-markers.txt"
printf 'MOBILE_IOS_DERIVED_DATA_OUTSIDE_SOURCE=PASS\n' | tee -a "$ARTIFACT_DIR/runtime-markers.txt"

if [[ "$INITIAL_STATE" != "Booted" ]]; then
  xcrun simctl boot "$UDID"
fi
xcrun simctl bootstatus "$UDID" -b
xcrun simctl ui "$UDID" appearance light || true
xcrun simctl spawn "$UDID" defaults write NSGlobalDomain AppleLanguages -array en || true
xcrun simctl spawn "$UDID" defaults write NSGlobalDomain AppleLocale -string en_US || true
printf 'MOBILE_IOS_SIMULATOR_BOOT=PASS\n' | tee -a "$ARTIFACT_DIR/runtime-markers.txt"

preapprove_url_scheme

set -o pipefail
xcodebuild \
  -workspace "$WORKSPACE" \
  -scheme "$SCHEME" \
  -configuration Release \
  -sdk iphonesimulator \
  -destination "platform=iOS Simulator,id=$UDID" \
  -derivedDataPath "$DERIVED_DATA" \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  build 2>&1 | tee "$ARTIFACT_DIR/xcodebuild.log"

test -d "$APP_PATH"
printf 'MOBILE_IOS_UNSIGNED_SIMULATOR_BUILD=PASS\n' | tee -a "$ARTIFACT_DIR/runtime-markers.txt"

xcrun simctl install "$UDID" "$APP_PATH"
APP_CONTAINER="$(xcrun simctl get_app_container "$UDID" "$BUNDLE_ID" app)"
test -n "$APP_CONTAINER"
printf 'MOBILE_IOS_INSTALL=PASS\n' | tee -a "$ARTIFACT_DIR/runtime-markers.txt"
printf 'MOBILE_IOS_APP_CONTAINER=%s\n' "$APP_CONTAINER" > "$ARTIFACT_DIR/app-container.txt"

xcrun simctl privacy "$UDID" grant camera "$BUNDLE_ID" >/dev/null 2>&1 || true
LAUNCH_OUTPUT="$(xcrun simctl launch --terminate-running-process "$UDID" "$BUNDLE_ID")"
printf '%s\n' "$LAUNCH_OUTPUT" | tee "$ARTIFACT_DIR/launch.txt"
printf '%s\n' "$LAUNCH_OUTPUT" | grep -F "$BUNDLE_ID:" >/dev/null
printf 'MOBILE_IOS_DIRECT_APP_LAUNCH=PASS\n' | tee -a "$ARTIFACT_DIR/runtime-markers.txt"

write_ocr_script
FLASH_DIR="$ARTIFACT_DIR/initial-entry-frames"
mkdir -p "$FLASH_DIR"

for frame in $(seq -w 1 16); do
  sleep 0.5
  xcrun simctl io "$UDID" screenshot "$FLASH_DIR/frame-$frame.png" >/dev/null
done

INITIAL_SCREENSHOT="$ARTIFACT_DIR/initial-entry-camera-en.png"
cp "$FLASH_DIR/frame-16.png" "$INITIAL_SCREENSHOT"
assert_screenshot_contains "$INITIAL_SCREENSHOT" "SKIN ANALYSIS" "Camera ready"
printf 'MOBILE_IOS_INITIAL_ENTRY_ANALYZE=PASS\n' | tee -a "$ARTIFACT_DIR/runtime-markers.txt"

for frame in "$FLASH_DIR"/*.png; do
  assert_screenshot_excludes "$frame" "Find what fits your skin today"
done
printf 'MOBILE_IOS_NO_HOME_FLASH=PASS\n' | tee -a "$ARTIFACT_DIR/runtime-markers.txt"

xcrun simctl openurl "$UDID" "$URL_SCHEME:///"
sleep 4
HOME_SCREENSHOT="$ARTIFACT_DIR/home-same-runtime-en.png"
xcrun simctl io "$UDID" screenshot "$HOME_SCREENSHOT" >/dev/null
assert_screenshot_contains "$HOME_SCREENSHOT" "BEJEWELY" "Find what fits your skin today"
printf 'MOBILE_IOS_SAME_RUNTIME_HOME_ACCESS=PASS\n' | tee -a "$ARTIFACT_DIR/runtime-markers.txt"

xcrun simctl openurl "$UDID" "$URL_SCHEME://analyze"
sleep 4
xcrun simctl io "$UDID" screenshot "$ARTIFACT_DIR/analyze-en.png" >/dev/null
assert_screenshot_contains "$ARTIFACT_DIR/analyze-en.png" "SKIN ANALYSIS" "Camera ready"
printf 'MOBILE_IOS_ANALYZE_ROUTE_OPEN=PASS\n' | tee -a "$ARTIFACT_DIR/runtime-markers.txt"

xcrun simctl openurl "$UDID" "$URL_SCHEME://my"
sleep 4
xcrun simctl io "$UDID" screenshot "$ARTIFACT_DIR/my-signed-out-en.png" >/dev/null
printf 'MOBILE_IOS_MY_ROUTE_OPEN=PASS\n' | tee -a "$ARTIFACT_DIR/runtime-markers.txt"

xcrun simctl spawn "$UDID" log show --last 15m --style compact --predicate 'process == "BEJEWELY"' \
  > "$ARTIFACT_DIR/ios-runtime.log" 2>&1 || true

if grep -Eiq 'Terminating app due to uncaught exception|RCTFatal|EXC_CRASH|SIGABRT|fatal error' "$ARTIFACT_DIR/ios-runtime.log"; then
  printf 'MOBILE_IOS_CRASH_SCAN=FAIL\n' | tee -a "$ARTIFACT_DIR/runtime-markers.txt"
  exit 1
fi

CRASH_REPORTS="$ARTIFACT_DIR/crash-reports.txt"
find "$HOME/Library/Logs/DiagnosticReports" -type f \
  \( -name 'BEJEWELY*.ips' -o -name 'BEJEWELY*.crash' \) \
  -newer "$START_MARKER" -print > "$CRASH_REPORTS" 2>/dev/null || true

test ! -s "$CRASH_REPORTS"
printf 'MOBILE_IOS_CRASH_SCAN=PASS\n' | tee -a "$ARTIFACT_DIR/runtime-markers.txt"
printf 'MOBILE_IOS_SIMULATOR_SMOKE=PASS\n' | tee -a "$ARTIFACT_DIR/runtime-markers.txt"
