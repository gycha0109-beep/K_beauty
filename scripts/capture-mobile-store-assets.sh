#!/usr/bin/env bash
set -euo pipefail

PACKAGE_ID="com.bejewely.mobile"
REPO_ROOT="$(pwd)"
MOBILE_ROOT="$REPO_ROOT/apps/mobile"
APK_PATH="$MOBILE_ROOT/android/app/build/outputs/apk/debug/app-debug.apk"
ARTIFACT_DIR="$MOBILE_ROOT/.mobile-store-artifacts"
UI_DUMP="$ARTIFACT_DIR/window.xml"
METRO_LOG="$ARTIFACT_DIR/metro.log"
METRO_PID=""
METRO_NODE_PATH="$MOBILE_ROOT/node_modules:$REPO_ROOT/node_modules"
QUICKSTEP_RECOVERY_COUNT=0
QUICKSTEP_RECOVERY_LIMIT=2

mkdir -p "$ARTIFACT_DIR"

cleanup() {
  status=$?
  adb logcat -d > "$ARTIFACT_DIR/logcat.txt" 2>&1 || true
  adb shell uiautomator dump /sdcard/bejewely-store-window.xml >/dev/null 2>&1 || true
  adb pull /sdcard/bejewely-store-window.xml "$ARTIFACT_DIR/final-window.xml" >/dev/null 2>&1 || true
  adb shell wm size reset >/dev/null 2>&1 || true
  if [[ -n "$METRO_PID" ]] && kill -0 "$METRO_PID" 2>/dev/null; then
    kill "$METRO_PID" 2>/dev/null || true
  fi
  if [[ "$status" -ne 0 ]]; then
    echo "--- Store capture Metro log ---" >&2
    cat "$METRO_LOG" >&2 2>/dev/null || true
    echo "--- Store capture final UI hierarchy ---" >&2
    cat "$ARTIFACT_DIR/final-window.xml" >&2 2>/dev/null || true
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

dump_ui() {
  adb shell uiautomator dump /sdcard/bejewely-store-window.xml >/dev/null
  adb pull /sdcard/bejewely-store-window.xml "$UI_DUMP" >/dev/null
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
matches = []
for node in root.iter("node"):
    if node.attrib.get("text") != target and node.attrib.get("content-desc") != target:
        continue
    match = re.fullmatch(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", node.attrib.get("bounds", ""))
    if not match:
        continue
    x1, y1, x2, y2 = map(int, match.groups())
    matches.append((node.attrib.get("clickable") == "true", (x1 + x2) // 2, (y1 + y2) // 2))
if not matches:
    raise SystemExit(f"tap target not found: {target}")
matches.sort(reverse=True)
_, x, y = matches[0]
print(x, y)
PY
)"
  read -r x y <<< "$coords"
  adb shell input tap "$x" "$y"
}

tap_text_until_gone() {
  local target="$1"
  local attempts="${2:-8}"
  for _ in $(seq 1 "$attempts"); do
    dump_ui || true
    if [[ -f "$UI_DUMP" ]] && ! ui_has_text "$target"; then
      printf 'MOBILE_STORE_TRANSITION=PASS target=%s\n' "$target"
      return 0
    fi
    tap_text "$target" || true
    sleep 1
  done
  dump_ui || true
  if [[ -f "$UI_DUMP" ]] && ! ui_has_text "$target"; then
    printf 'MOBILE_STORE_TRANSITION=PASS target=%s\n' "$target"
    return 0
  fi
  echo "UI transition did not dismiss target: $target" >&2
  return 1
}

text_center_y() {
  local target="$1"
  python - "$UI_DUMP" "$target" <<'PY'
import re
import sys
import xml.etree.ElementTree as ET
path, target = sys.argv[1], sys.argv[2]
try:
    root = ET.parse(path).getroot()
except (ET.ParseError, OSError):
    raise SystemExit(1)
for node in root.iter("node"):
    if node.attrib.get("text") != target and node.attrib.get("content-desc") != target:
        continue
    match = re.fullmatch(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", node.attrib.get("bounds", ""))
    if match:
        _, y1, _, y2 = map(int, match.groups())
        print((y1 + y2) // 2)
        raise SystemExit(0)
raise SystemExit(1)
PY
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
  printf 'MOBILE_STORE_QUICKSTEP_ANR_RECOVERY=PASS count=%d\n' "$QUICKSTEP_RECOVERY_COUNT"
  sleep 2
  adb shell am start -W -n "$PACKAGE_ID/.MainActivity" >/dev/null
  printf 'MOBILE_STORE_DIRECT_ACTIVITY_RESTART=PASS\n'
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

scroll_text_into_store_frame() {
  local expected="$1"
  local min_y="${2:-360}"
  local max_y="${3:-1050}"
  local max_scrolls="${4:-8}"
  for _ in $(seq 1 "$max_scrolls"); do
    dump_ui || true
    if recover_quickstep_if_needed; then
      continue
    else
      recovery_status=$?
      if [[ "$recovery_status" -eq 2 ]]; then
        return 1
      fi
    fi
    if [[ -f "$UI_DUMP" ]] && ui_has_text "$expected"; then
      local y
      y="$(text_center_y "$expected" 2>/dev/null || true)"
      if [[ "$y" =~ ^[0-9]+$ ]] && (( y >= min_y && y <= max_y )); then
        printf 'MOBILE_STORE_VIEWPORT_TEXT=PASS target=%s center_y=%s\n' "$expected" "$y"
        return 0
      fi
      if [[ "$y" =~ ^[0-9]+$ ]] && (( y > 0 && y < min_y )); then
        adb shell input swipe 540 760 540 1180 300 >/dev/null 2>&1 || true
      else
        adb shell input swipe 540 1580 540 680 350 >/dev/null 2>&1 || true
      fi
    else
      adb shell input swipe 540 1580 540 680 350 >/dev/null 2>&1 || true
    fi
    sleep 1
  done
  dump_ui || true
  local final_y=""
  if [[ -f "$UI_DUMP" ]]; then
    final_y="$(text_center_y "$expected" 2>/dev/null || true)"
  fi
  echo "UI text was not positioned inside the store capture viewport: $expected center_y=${final_y:-missing}" >&2
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

capture_png() {
  local filename="$1"
  local output="$ARTIFACT_DIR/$filename"
  adb exec-out screencap -p > "$output"
  python - "$output" <<'PY'
import struct
import sys
path = sys.argv[1]
with open(path, "rb") as handle:
    signature = handle.read(24)
if signature[:8] != b"\x89PNG\r\n\x1a\n":
    raise SystemExit(f"not a PNG: {path}")
width, height = struct.unpack(">II", signature[16:24])
if (width, height) != (1080, 1920):
    raise SystemExit(f"unexpected dimensions {width}x{height}: {path}")
print(f"MOBILE_STORE_PNG=PASS path={path} size={width}x{height}")
PY
}

adb shell cmd uimode night no >/dev/null
adb shell wm size 1080x1920 >/dev/null
adb shell wm density 420 >/dev/null 2>&1 || true
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
    printf 'MOBILE_STORE_METRO_READY=PASS\n'
    break
  fi
  if ! kill -0 "$METRO_PID" 2>/dev/null; then
    echo "Metro exited before opening port 8081" >&2
    cat "$METRO_LOG" >&2 || true
    exit 1
  fi
  sleep 1
done

if ! metro_port_ready; then
  echo "Metro did not open port 8081" >&2
  exit 1
fi

adb install -r "$APK_PATH" >/dev/null
adb shell pm clear "$PACKAGE_ID" >/dev/null
adb shell pm grant "$PACKAGE_ID" android.permission.CAMERA >/dev/null
adb shell input keyevent KEYCODE_WAKEUP >/dev/null 2>&1 || true
adb shell wm dismiss-keyguard >/dev/null 2>&1 || true
adb reverse tcp:8081 tcp:8081 >/dev/null
adb shell am start -W -n "$PACKAGE_ID/.MainActivity" >/dev/null

wait_for_text "BEJEWELY"
wait_for_text "Find what fits your skin today"
capture_png "01-home-en-1080x1920.png"

tap_text "Analyze"
wait_for_text "SKIN ANALYSIS"
wait_for_text "Camera ready"
tap_text "Take photo"
wait_for_text "CAPTURED PHOTO"
wait_for_text "Use photo"
tap_text_until_gone "Use photo" 8
scroll_text_into_store_frame "Skin survey before analysis" 360 1050 8
capture_png "02-analyze-en-1080x1920.png"

tap_text "Home"
wait_for_text "BEJEWELY"
tap_text "locale-ko"
wait_for_text "오늘 내 피부에 맞는 루틴 찾기"
capture_png "01-home-ko-1080x1920.png"

tap_text "분석"
wait_for_text "피부 분석"
wait_for_text "카메라 준비 완료"
tap_text "사진 촬영"
wait_for_text "촬영한 사진"
wait_for_text "이 사진 사용"
tap_text_until_gone "이 사진 사용" 8
scroll_text_into_store_frame "분석 전 피부 설문" 360 1050 8
capture_png "02-analyze-ko-1080x1920.png"

printf 'MOBILE_20A_HOME_CAPTURE=PASS locales=en,ko\n'
printf 'MOBILE_20A_ANALYZE_CAPTURE=PASS locales=en,ko\n'
printf 'MOBILE_20A_STORE_CAPTURE=PASS size=1080x1920\n'
