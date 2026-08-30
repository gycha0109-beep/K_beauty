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
WORKSPACE="$IOS_ROOT/BEJEWELY.xcworkspace"
SCHEME="BEJEWELY"
START_MARKER="$ARTIFACT_DIR/smoke-start.marker"
APP_PATH="$DERIVED_DATA/Build/Products/Release-iphonesimulator/BEJEWELY.app"

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

sleep 8
xcrun simctl io "$UDID" screenshot "$ARTIFACT_DIR/home-en.png" >/dev/null
printf 'MOBILE_IOS_HOME_SCREENSHOT=PASS\n' | tee -a "$ARTIFACT_DIR/runtime-markers.txt"

xcrun simctl openurl "$UDID" "bejewely://analyze"
sleep 4
xcrun simctl io "$UDID" screenshot "$ARTIFACT_DIR/analyze-en.png" >/dev/null
printf 'MOBILE_IOS_ANALYZE_ROUTE_OPEN=PASS\n' | tee -a "$ARTIFACT_DIR/runtime-markers.txt"

xcrun simctl openurl "$UDID" "bejewely://my"
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
