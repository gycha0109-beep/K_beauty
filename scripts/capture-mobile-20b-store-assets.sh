#!/usr/bin/env bash
set -euo pipefail

PACKAGE_ID="com.bejewely.mobile"
REPO_ROOT="$(pwd)"
MOBILE_ROOT="$REPO_ROOT/apps/mobile"
APK_PATH="$MOBILE_ROOT/android/app/build/outputs/apk/debug/app-debug.apk"
ARTIFACT_DIR="$MOBILE_ROOT/.mobile-20b-store-artifacts"
METRO_LOG="$ARTIFACT_DIR/metro.log"
METRO_PID=""
MOBILE_NODE_PATH="$MOBILE_ROOT/node_modules${NODE_PATH:+:$NODE_PATH}"

mkdir -p "$ARTIFACT_DIR"
rm -f "$ARTIFACT_DIR"/*.png "$ARTIFACT_DIR"/*.xml "$ARTIFACT_DIR"/capture-manifest.json

cleanup() {
  status=$?
  adb logcat -d > "$ARTIFACT_DIR/logcat.txt" 2>&1 || true
  if [[ -n "$METRO_PID" ]] && kill -0 "$METRO_PID" 2>/dev/null; then kill "$METRO_PID" 2>/dev/null || true; fi
  trap - EXIT
  exit "$status"
}
trap cleanup EXIT

[[ -f "$APK_PATH" ]] || { echo "Missing debug APK: $APK_PATH" >&2; exit 1; }
EXPO_BIN="$REPO_ROOT/node_modules/.bin/expo"
[[ -x "$EXPO_BIN" ]] || EXPO_BIN="$MOBILE_ROOT/node_modules/.bin/expo"
[[ -x "$EXPO_BIN" ]] || { echo "Expo CLI not found" >&2; exit 1; }

NODE_PATH="$MOBILE_NODE_PATH" node -e 'console.log(`MOBILE_20B_EXPO_ROUTER_CTX=${require.resolve("expo-router/_ctx-shared")}`)'

adb wait-for-device
adb install -r "$APK_PATH" >/dev/null
adb shell cmd uimode night no >/dev/null 2>&1 || true
adb shell wm size 1080x1920 >/dev/null
adb shell wm density 420 >/dev/null 2>&1 || true
adb shell settings put global window_animation_scale 0 >/dev/null
adb shell settings put global transition_animation_scale 0 >/dev/null
adb shell settings put global animator_duration_scale 0 >/dev/null
adb logcat -c || true
adb reverse tcp:8081 tcp:8081 >/dev/null

(
  cd "$MOBILE_ROOT"
  CI=1 EXPO_NO_TELEMETRY=1 EXPO_OFFLINE=1 EXPO_UNSTABLE_HEADLESS=1 EXPO_PUBLIC_STORE_CAPTURE_MODE=1 NODE_PATH="$MOBILE_NODE_PATH" "$EXPO_BIN" start --localhost --port 8081
) >"$METRO_LOG" 2>&1 &
METRO_PID=$!

python - <<'PY'
import socket, time
for _ in range(90):
    try:
        with socket.create_connection(("localhost", 8081), timeout=1):
            print("MOBILE_20B_METRO_READY=PASS")
            raise SystemExit(0)
    except OSError:
        time.sleep(1)
raise SystemExit("Metro did not open port 8081")
PY

capture() {
  local scenario="$1" expected="$2" png="$3" xml="$4"
  adb shell am force-stop "$PACKAGE_ID" >/dev/null 2>&1 || true
  adb shell pm clear "$PACKAGE_ID" >/dev/null
  adb reverse tcp:8081 tcp:8081 >/dev/null
  adb shell am start -W -a android.intent.action.VIEW -d "bejewely://store-capture?scenario=$scenario" "$PACKAGE_ID" >/dev/null
  local found=0
  for _ in $(seq 1 45); do
    adb shell uiautomator dump /sdcard/window.xml >/dev/null 2>&1 || true
    adb pull /sdcard/window.xml "$ARTIFACT_DIR/$xml" >/dev/null 2>&1 || true
    if [[ -s "$ARTIFACT_DIR/$xml" ]] && grep -Fq "$expected" "$ARTIFACT_DIR/$xml"; then found=1; break; fi
    sleep 2
  done
  [[ "$found" -eq 1 ]] || { echo "Required marker not visible for $scenario: $expected" >&2; cat "$ARTIFACT_DIR/$xml" >&2 || true; exit 1; }
  adb exec-out screencap -p > "$ARTIFACT_DIR/$png"
  python - "$ARTIFACT_DIR/$png" <<'PY'
import struct, sys
with open(sys.argv[1], "rb") as f: h=f.read(24)
assert h[:8] == b"\x89PNG\r\n\x1a\n"
assert struct.unpack(">II", h[16:24]) == (1080, 1920)
PY
}

capture "results-en" "Skin analysis result" "03-results-en-1080x1920.png" "03-results-en-window.xml"
capture "diary-en" "Latest saved report" "04-diary-en-1080x1920.png" "04-diary-en-window.xml"
capture "results-ko" "피부 분석 결과" "03-results-ko-1080x1920.png" "03-results-ko-window.xml"
capture "diary-ko" "최근 저장 리포트" "04-diary-ko-1080x1920.png" "04-diary-ko-window.xml"

node scripts/verify-mobile-20b-store-capture.mjs artifact "$ARTIFACT_DIR"
printf 'MOBILE_20B_STORE_CAPTURE=PASS\n'
