#!/usr/bin/env bash
set -euo pipefail

PACKAGE_ID="com.bejewely.mobile"
REPO_ROOT="$(pwd)"
MOBILE_ROOT="$REPO_ROOT/apps/mobile"
APK_PATH="$MOBILE_ROOT/android/app/build/outputs/apk/debug/app-debug.apk"
ARTIFACT_DIR="$MOBILE_ROOT/.mobile-native-artifacts"
UI_DUMP="$ARTIFACT_DIR/window.xml"
METRO_LOG="$ARTIFACT_DIR/metro.log"
METRO_PID=""
METRO_READY=0
METRO_NODE_PATH="$MOBILE_ROOT/node_modules:$REPO_ROOT/node_modules"
QUICKSTEP_RECOVERY_COUNT=0
QUICKSTEP_RECOVERY_LIMIT=2

mkdir -p "$ARTIFACT_DIR"

cleanup() {
  status=$?
  adb logcat -d > "$ARTIFACT_DIR/logcat.txt" 2>&1 || true
  adb shell uiautomator dump /sdcard/bejewely-window.xml >/dev/null 2>&1 || true
  adb pull /sdcard/bejewely-window.xml "$ARTIFACT_DIR/final-window.xml" >/dev/null 2>&1 || true
  if [[ "$status" -ne 0 ]]; then
    echo "--- Metro log ---" >&2
    cat "$METRO_LOG" >&2 2>/dev/null || true
    echo "--- Final UI hierarchy ---" >&2
    cat "$ARTIFACT_DIR/final-window.xml" >&2 2>/dev/null || true
  fi
  if [[ -n "$METRO_PID" ]] && kill -0 "$METRO_PID" 2>/dev/null; then
    kill "$METRO_PID" 2>/dev/null || true
  fi
  trap - EXIT
  exit "$status"
}
trap cleanup EXIT

if [[ ! -f "$APK_PATH" ]]; then
  echo "Missing debug APK: $APK_PATH" >&2
  exit 1
fi

EXPO_BIN="$REPO_ROOT/node_modules/.bin/expo"
if [[ ! -x "$EXPO_BIN" ]]; then
  EXPO_BIN="$MOBILE_ROOT/node_modules/.bin/expo"
fi
if [[ ! -x "$EXPO_BIN" ]]; then
  echo "Expo CLI binary not found after npm ci" >&2
  exit 1
fi

if ! NODE_PATH="$METRO_NODE_PATH" node -e "require.resolve('expo-router/_ctx-shared')" >/dev/null 2>&1; then
  echo "Expo Router workspace module resolution failed before Metro startup" >&2
  NODE_PATH="$METRO_NODE_PATH" node - <<'NODE' >&2 || true
const path = require('node:path');
for (const candidate of [
  'expo-router/package.json',
  'expo-router/_ctx-shared',
  '@expo/router-server/package.json',
]) {
  try {
    console.error(`${candidate} -> ${require.resolve(candidate)}`);
  } catch (error) {
    console.error(`${candidate} -> unresolved (${error.code ?? error.message})`);
  }
}
console.error(`NODE_PATH=${process.env.NODE_PATH}`);
console.error(`cwd=${process.cwd()}`);
console.error(`mobileNodeModules=${path.join(process.cwd(), 'apps/mobile/node_modules')}`);
NODE
  exit 1
fi

dump_ui() {
  adb shell uiautomator dump /sdcard/bejewely-window.xml >/dev/null
  adb pull /sdcard/bejewely-window.xml "$UI_DUMP" >/dev/null
}

ui_has_text() {
  local target="$1"
  python - "$UI_DUMP" "$target" <<'PY'
import sys
import xml.etree.ElementTree as ET

path, target = sys.argv[1], sys.argv[2]
try:
    root = ET.parse(path).getroot()
except (ET.ParseError, OSError):
    raise SystemExit(1)

for node in root.iter("node"):
    if node.attrib.get("text") == target or node.attrib.get("content-desc") == target:
        raise SystemExit(0)
raise SystemExit(1)
PY
}

tap_text() {
  local target="$1"
  dump_ui
  local coords
  coords="$(python - "$UI_DUMP" "$target" <<'PY'
import re
import sys
import xml.etree.ElementTree as ET

path, target = sys.argv[1], sys.argv[2]
root = ET.parse(path).getroot()
for node in root.iter("node"):
    if node.attrib.get("text") != target and node.attrib.get("content-desc") != target:
        continue
    match = re.fullmatch(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", node.attrib.get("bounds", ""))
    if not match:
        continue
    x1, y1, x2, y2 = map(int, match.groups())
    print((x1 + x2) // 2, (y1 + y2) // 2)
    raise SystemExit(0)
raise SystemExit(f"tap target not found: {target}")
PY
)"
  read -r x y <<< "$coords"
  adb shell input tap "$x" "$y"
}

recover_quickstep_if_needed() {
  if [[ ! -f "$UI_DUMP" ]] || ! ui_has_text "Quickstep isn't responding"; then
    return 1
  fi
  if (( QUICKSTEP_RECOVERY_COUNT >= QUICKSTEP_RECOVERY_LIMIT )); then
    echo "Quickstep ANR persisted beyond scoped recovery limit" >&2
    return 2
  fi
  if ! tap_text "Close app"; then
    echo "Quickstep ANR detected but its Close app action was unavailable" >&2
    return 2
  fi
  QUICKSTEP_RECOVERY_COUNT=$((QUICKSTEP_RECOVERY_COUNT + 1))
  printf 'MOBILE_ANDROID_QUICKSTEP_ANR_RECOVERY=PASS count=%d\n' "$QUICKSTEP_RECOVERY_COUNT"
  sleep 2
  adb shell am start -W -n "$PACKAGE_ID/.MainActivity" >/dev/null
  printf 'MOBILE_ANDROID_DIRECT_ACTIVITY_RESTART=PASS\n'
  sleep 2
  return 0
}

wait_for_text() {
  local expected="$1"
  for _ in $(seq 1 45); do
    dump_ui || true
    if [[ -f "$UI_DUMP" ]] && ui_has_text "$expected"; then
      return 0
    fi
    if recover_quickstep_if_needed; then
      continue
    else
      recovery_status=$?
      if [[ "$recovery_status" -eq 2 ]]; then
        return 1
      fi
    fi
    sleep 2
  done
  echo "UI text not found: $expected" >&2
  return 1
}

wait_for_text_with_scroll() {
  local expected="$1"
  local direction="${2:-up}"
  local max_scrolls="${3:-4}"
  local scrolls=0

  for _ in $(seq 1 45); do
    dump_ui || true
    if [[ -f "$UI_DUMP" ]] && ui_has_text "$expected"; then
      printf 'MOBILE_ANDROID_SCROLL_SEARCH=PASS target=%s direction=%s scrolls=%d\n' "$expected" "$direction" "$scrolls"
      return 0
    fi
    if recover_quickstep_if_needed; then
      continue
    else
      recovery_status=$?
      if [[ "$recovery_status" -eq 2 ]]; then
        return 1
      fi
    fi

    if (( scrolls < max_scrolls )); then
      if [[ "$direction" == "up" ]]; then
        adb shell input swipe 540 1800 540 800 350 >/dev/null 2>&1 || true
      elif [[ "$direction" == "down" ]]; then
        adb shell input swipe 540 800 540 1800 350 >/dev/null 2>&1 || true
      else
        echo "Unsupported scroll direction: $direction" >&2
        return 1
      fi
      scrolls=$((scrolls + 1))
      sleep 1
    fi
    sleep 1
  done

  echo "UI text not found after viewport-aware scroll: $expected" >&2
  return 1
}

metro_port_ready() {
  python - <<'PY'
import socket

try:
    with socket.create_connection(("localhost", 8081), timeout=1):
        pass
except OSError:
    raise SystemExit(1)
PY
}

adb shell cmd uimode night no >/dev/null
adb reverse tcp:8081 tcp:8081 >/dev/null

(
  cd "$MOBILE_ROOT"
  CI=1 \
  EXPO_NO_TELEMETRY=1 \
  EXPO_OFFLINE=1 \
  EXPO_UNSTABLE_HEADLESS=1 \
  NODE_PATH="$METRO_NODE_PATH" \
  "$EXPO_BIN" start --localhost --port 8081
) > "$METRO_LOG" 2>&1 &
METRO_PID=$!

for _ in $(seq 1 90); do
  if metro_port_ready; then
    METRO_READY=1
    printf 'MOBILE_METRO_TCP_READY=PASS\n'
    break
  fi
  if ! kill -0 "$METRO_PID" 2>/dev/null; then
    echo "Metro exited before opening port 8081" >&2
    cat "$METRO_LOG" >&2 || true
    exit 1
  fi
  sleep 1
done

if [[ "$METRO_READY" -ne 1 ]]; then
  echo "Metro did not open port 8081 within 90 seconds" >&2
  ss -ltnp >&2 2>/dev/null || true
  cat "$METRO_LOG" >&2 || true
  exit 1
fi

adb install -r "$APK_PATH" >/dev/null
adb shell pm clear "$PACKAGE_ID" >/dev/null
adb shell pm grant "$PACKAGE_ID" android.permission.CAMERA >/dev/null
printf 'MOBILE_ANDROID_CAMERA_PERMISSION_GRANT=PASS\n'
adb shell input keyevent KEYCODE_WAKEUP >/dev/null 2>&1 || true
adb shell wm dismiss-keyguard >/dev/null 2>&1 || true
adb reverse tcp:8081 tcp:8081 >/dev/null
adb shell am start -W -n "$PACKAGE_ID/.MainActivity" >/dev/null
printf 'MOBILE_ANDROID_DIRECT_ACTIVITY_START=PASS\n'

wait_for_text "BEJEWELY Mobile"
wait_for_text "Native shell ready"
adb exec-out screencap -p > "$ARTIFACT_DIR/home-light-en.png"

tap_text "Analyze"
wait_for_text "NATIVE SKIN PHOTO CAPTURE"
wait_for_text "Camera ready"
adb exec-out screencap -p > "$ARTIFACT_DIR/analyze-camera-ready-en.png"
tap_text "Take photo"
wait_for_text "CAPTURED PHOTO"
adb exec-out screencap -p > "$ARTIFACT_DIR/analyze-camera-captured-en.png"
wait_for_text "Retake"
tap_text "Retake"
wait_for_text "Camera ready"
tap_text "Close camera"
wait_for_text "Open camera"
printf 'MOBILE_ANDROID_CAMERA_CAPTURE_SMOKE=PASS\n'
printf 'MOBILE_ANDROID_CAMERA_FULLSCREEN_EXIT=PASS\n'

tap_text "My"
wait_for_text "Native My & Skin Diary"
tap_text "Home"
wait_for_text "BEJEWELY Mobile"

tap_text "locale-ko"
wait_for_text "BEJEWELY 모바일"
wait_for_text "테마 · 라이트"
adb exec-out screencap -p > "$ARTIFACT_DIR/home-light-ko.png"

adb shell cmd uimode night yes >/dev/null
wait_for_text "테마 · 다크"
adb exec-out screencap -p > "$ARTIFACT_DIR/home-dark-ko.png"

adb shell dumpsys activity activities | grep -F "$PACKAGE_ID/.MainActivity" > "$ARTIFACT_DIR/activity.txt"
printf 'MOBILE_ANDROID_EMULATOR_SMOKE=PASS\n'
