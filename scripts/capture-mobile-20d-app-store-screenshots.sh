#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MOBILE_ROOT="$REPO_ROOT/apps/mobile"
IOS_ROOT="$MOBILE_ROOT/ios"
WORKSPACE="$IOS_ROOT/BEJEWELY.xcworkspace"
SCHEME="BEJEWELY"
BUNDLE_ID="com.bejewely.mobile"
URL_SCHEME="bejewely"
FINAL_DIR="$MOBILE_ROOT/.mobile-20d-app-store-package"
TEMP_BASE="${RUNNER_TEMP:-${TMPDIR:-/tmp}}"
WORK_ROOT="$TEMP_BASE/bejewely-mobile-20d-${GITHUB_RUN_ID:-local}-${GITHUB_RUN_ATTEMPT:-1}"
DERIVED_DATA="$WORK_ROOT/derived-data"
METRO_LOG="$WORK_ROOT/metro.log"
APP_PATH="$DERIVED_DATA/Build/Products/Debug-iphonesimulator/BEJEWELY.app"
FINAL_WIDTH=1290
FINAL_HEIGHT=2796
METRO_PID=""
UDID=""

rm -rf "$WORK_ROOT" "$FINAL_DIR"
mkdir -p "$WORK_ROOT" "$FINAL_DIR/en-US" "$FINAL_DIR/ko"

test -d "$WORKSPACE"

cleanup() {
  status=$?
  if [[ -n "$METRO_PID" ]] && kill -0 "$METRO_PID" 2>/dev/null; then
    kill "$METRO_PID" >/dev/null 2>&1 || true
  fi
  if [[ -n "$UDID" ]]; then
    xcrun simctl shutdown "$UDID" >/dev/null 2>&1 || true
    xcrun simctl delete "$UDID" >/dev/null 2>&1 || true
  fi
  if [[ "$status" -ne 0 ]]; then
    printf '%s\n' '--- MOBILE-20D Metro log ---' >&2
    tail -n 250 "$METRO_LOG" >&2 2>/dev/null || true
  fi
  trap - EXIT
  exit "$status"
}
trap cleanup EXIT

select_runtime_and_device_type() {
  local runtime_id
  runtime_id="$(xcrun simctl list runtimes available -j | python3 -c '
import json, re, sys
payload=json.load(sys.stdin)
c=[]
for r in payload.get("runtimes",[]):
    ident=str(r.get("identifier", ""))
    if "SimRuntime.iOS-" not in ident or not r.get("isAvailable", False):
        continue
    m=re.search(r"iOS-([0-9-]+)$", ident)
    version=tuple(int(x) for x in m.group(1).split("-")) if m else ()
    c.append((version, ident))
if not c: raise SystemExit("No available iOS runtime")
print(max(c)[1])
')"

  local device_type=""
  for candidate in \
    "com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro-Max" \
    "com.apple.CoreSimulator.SimDeviceType.iPhone-16-Pro-Max" \
    "com.apple.CoreSimulator.SimDeviceType.iPhone-15-Pro-Max" \
    "com.apple.CoreSimulator.SimDeviceType.iPhone-14-Pro-Max"; do
    if xcrun simctl list devicetypes -j | python3 -c 'import json,sys; p=json.load(sys.stdin); target=sys.argv[1]; raise SystemExit(0 if any(d.get("identifier")==target for d in p.get("devicetypes",[])) else 1)' "$candidate"; then
      device_type="$candidate"
      break
    fi
  done
  test -n "$device_type"
  printf '%s\n%s\n' "$runtime_id" "$device_type"
}

SELECTION="$(select_runtime_and_device_type)"
RUNTIME_ID="$(printf '%s\n' "$SELECTION" | sed -n '1p')"
DEVICE_TYPE="$(printf '%s\n' "$SELECTION" | sed -n '2p')"
test -n "$RUNTIME_ID"
test -n "$DEVICE_TYPE"
UDID="$(xcrun simctl create "BEJEWELY MOBILE-20D" "$DEVICE_TYPE" "$RUNTIME_ID")"
test -n "$UDID"

xcrun simctl boot "$UDID"
xcrun simctl bootstatus "$UDID" -b
xcrun simctl ui "$UDID" appearance light || true

preapprove_scheme() {
  local approval_domain="com.apple.launchservices.schemeapproval"
  local approval_key="com.apple.CoreSimulator.CoreSimulatorBridge-->$URL_SCHEME"
  xcrun simctl spawn "$UDID" defaults write "$approval_domain" "$approval_key" -string "$BUNDLE_ID"
}
preapprove_scheme

EXPO_BIN="$REPO_ROOT/node_modules/.bin/expo"
[[ -x "$EXPO_BIN" ]] || EXPO_BIN="$MOBILE_ROOT/node_modules/.bin/expo"
[[ -x "$EXPO_BIN" ]] || { echo "Expo CLI not found" >&2; exit 1; }

(
  cd "$MOBILE_ROOT"
  CI=1 EXPO_NO_TELEMETRY=1 EXPO_OFFLINE=1 EXPO_UNSTABLE_HEADLESS=1 EXPO_PUBLIC_STORE_CAPTURE_MODE=1 \
    "$EXPO_BIN" start --localhost --port 8081
) >"$METRO_LOG" 2>&1 &
METRO_PID=$!

python3 - <<'PY'
import socket,time
for _ in range(90):
    try:
        with socket.create_connection(("localhost",8081),timeout=1):
            print("MOBILE_20D_METRO_READY=PASS")
            raise SystemExit(0)
    except OSError:
        time.sleep(1)
raise SystemExit("Metro did not open port 8081")
PY

set -o pipefail
EXPO_PUBLIC_STORE_CAPTURE_MODE=1 xcodebuild \
  -workspace "$WORKSPACE" \
  -scheme "$SCHEME" \
  -configuration Debug \
  -sdk iphonesimulator \
  -destination "platform=iOS Simulator,id=$UDID" \
  -derivedDataPath "$DERIVED_DATA" \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  build 2>&1 | tee "$WORK_ROOT/xcodebuild.log"

test -d "$APP_PATH"
xcrun simctl install "$UDID" "$APP_PATH"
preapprove_scheme

warm_runtime_bundle() {
  local log_start attempt
  log_start="$(wc -l < "$METRO_LOG" | tr -d ' ')"
  xcrun simctl launch --terminate-running-process "$UDID" "$BUNDLE_ID" >/dev/null 2>&1 || true
  sleep 2
  xcrun simctl openurl "$UDID" "$URL_SCHEME://analyze" >/dev/null 2>&1 || true

  for attempt in $(seq 1 90); do
    if tail -n "+$((log_start + 1))" "$METRO_LOG" | grep -Eqi '(^|[[:space:]])(iOS|ios)[[:space:]]+Bundled|Bundled.*(expo-router|virtual-metro-entry)'; then
      sleep 5
      xcrun simctl terminate "$UDID" "$BUNDLE_ID" >/dev/null 2>&1 || true
      printf 'MOBILE_20D_RUNTIME_WARMUP=PASS attempt=%s\n' "$attempt"
      return 0
    fi
    sleep 1
  done

  echo "Metro did not finish the first iOS bundle before screenshot capture" >&2
  tail -n 250 "$METRO_LOG" >&2 2>/dev/null || true
  return 1
}

warm_runtime_bundle

set_locale() {
  local locale="$1"
  local language region
  if [[ "$locale" = "ko" ]]; then
    language="ko"
    region="ko_KR"
  else
    language="en"
    region="en_US"
  fi
  xcrun simctl terminate "$UDID" "$BUNDLE_ID" >/dev/null 2>&1 || true
  xcrun simctl spawn "$UDID" defaults write NSGlobalDomain AppleLanguages -array "$language"
  xcrun simctl spawn "$UDID" defaults write NSGlobalDomain AppleLocale -string "$region"
  xcrun simctl shutdown "$UDID"
  xcrun simctl boot "$UDID"
  xcrun simctl bootstatus "$UDID" -b
  xcrun simctl ui "$UDID" appearance light || true
  preapprove_scheme
}

image_dimensions() {
  local file="$1"
  local width height
  width="$(sips -g pixelWidth "$file" | awk '/pixelWidth/{print $2}')"
  height="$(sips -g pixelHeight "$file" | awk '/pixelHeight/{print $2}')"
  printf '%sx%s\n' "$width" "$height"
}

assert_native_capture_size() {
  local file="$1"
  local dims
  dims="$(image_dimensions "$file")"
  case "$dims" in
    1260x2736|1290x2796|1320x2868) ;;
    *) echo "Unsupported native App Store capture size: $dims ($file)" >&2; exit 1 ;;
  esac
  printf 'MOBILE_20D_NATIVE_SCREEN_SIZE=PASS file=%s size=%s\n' "$(basename "$file")" "$dims"
}

assert_submission_size() {
  local file="$1"
  local dims
  dims="$(image_dimensions "$file")"
  test "$dims" = "${FINAL_WIDTH}x${FINAL_HEIGHT}" || {
    echo "App Store screenshot must be exactly ${FINAL_WIDTH}x${FINAL_HEIGHT}: $dims ($file)" >&2
    exit 1
  }
  test "$(stat -f%z "$file")" -gt 20000
  printf 'MOBILE_20D_SCREEN_SIZE=PASS file=%s size=%s\n' "$(basename "$file")" "$dims"
}

capture_jpeg() {
  local locale="$1" order="$2" frame="$3" url="$4"
  local dir="$FINAL_DIR/$locale"
  local out="$dir/${order}-${frame}.jpg"
  local raw="$WORK_ROOT/${locale}-${order}-${frame}.png"
  local normalized="$WORK_ROOT/${locale}-${order}-${frame}-1290x2796.png"
  if [[ -z "$url" ]]; then
    xcrun simctl launch --terminate-running-process "$UDID" "$BUNDLE_ID" >/dev/null
  else
    xcrun simctl launch --terminate-running-process "$UDID" "$BUNDLE_ID" >/dev/null
    sleep 2
    xcrun simctl openurl "$UDID" "$url"
  fi
  sleep 7
  xcrun simctl io "$UDID" screenshot "$raw" >/dev/null
  assert_native_capture_size "$raw"
  sips -z "$FINAL_HEIGHT" "$FINAL_WIDTH" "$raw" --out "$normalized" >/dev/null
  sips -s format jpeg "$normalized" --out "$out" >/dev/null
  rm -f "$raw" "$normalized"
  assert_submission_size "$out"
}

capture_locale() {
  local locale="$1"
  local scenario_suffix
  if [[ "$locale" = "ko" ]]; then scenario_suffix="ko"; else scenario_suffix="en"; fi
  set_locale "$locale"
  capture_jpeg "$locale" "01" "home" ""
  capture_jpeg "$locale" "02" "analyze" "$URL_SCHEME://analyze"
  capture_jpeg "$locale" "03" "results" "$URL_SCHEME://store-capture?scenario=results-$scenario_suffix"
  capture_jpeg "$locale" "04" "diary" "$URL_SCHEME://store-capture?scenario=diary-$scenario_suffix"
}

capture_locale "en-US"
capture_locale "ko"

cp "$WORK_ROOT/xcodebuild.log" "$FINAL_DIR/xcodebuild.log"
printf '%s\n' "$RUNTIME_ID" > "$FINAL_DIR/simulator-runtime.txt"
printf '%s\n' "$DEVICE_TYPE" > "$FINAL_DIR/simulator-device-type.txt"

node "$REPO_ROOT/scripts/verify-mobile-20d-app-store-screenshots.mjs" artifact "$FINAL_DIR"
printf 'MOBILE_20D_APP_STORE_SCREENSHOT_PACKAGE=PASS\n'
