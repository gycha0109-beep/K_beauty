#!/usr/bin/env bash
set -euo pipefail

PACKAGE_ID="com.bejewely.mobile"
REPO_ROOT="$(pwd)"
MOBILE_ROOT="$REPO_ROOT/apps/mobile"
ARTIFACT_DIR="$MOBILE_ROOT/.mobile-store-artifacts"
UI_DUMP="$ARTIFACT_DIR/scenario-window.xml"
METRO_LOG="$ARTIFACT_DIR/store-scenarios-metro.log"
LOGCAT_PATH="$ARTIFACT_DIR/store-scenarios-logcat.txt"
METRO_PID=""
METRO_NODE_PATH="$MOBILE_ROOT/node_modules:$REPO_ROOT/node_modules"
UI_DUMP_RETRY_LIMIT=4

mkdir -p "$ARTIFACT_DIR"

cleanup() {
  status=$?
  adb logcat -d > "$LOGCAT_PATH" 2>&1 || true
  adb shell wm size reset >/dev/null 2>&1 || true
  if [[ -n "$METRO_PID" ]] && kill -0 "$METRO_PID" 2>/dev/null; then
    kill "$METRO_PID" 2>/dev/null || true
  fi
  if [[ "$status" -ne 0 ]]; then
    echo "--- Store scenario Metro log ---" >&2
    cat "$METRO_LOG" >&2 2>/dev/null || true
    echo "--- Store scenario UI hierarchy ---" >&2
    cat "$UI_DUMP" >&2 2>/dev/null || true
  fi
  trap - EXIT
  exit "$status"
}
trap cleanup EXIT

EXPO_BIN="$REPO_ROOT/node_modules/.bin/expo"
if [[ ! -x "$EXPO_BIN" ]]; then
  EXPO_BIN="$MOBILE_ROOT/node_modules/.bin/expo"
fi
if [[ ! -x "$EXPO_BIN" ]]; then
  echo "Expo CLI binary not found after npm ci" >&2
  exit 1
fi

dump_ui() {
  local attempt
  for attempt in $(seq 1 "$UI_DUMP_RETRY_LIMIT"); do
    rm -f "$UI_DUMP"
    if adb shell uiautomator dump /sdcard/bejewely-store-scenario-window.xml >/dev/null 2>&1 && \
       adb pull /sdcard/bejewely-store-scenario-window.xml "$UI_DUMP" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  echo "Store scenario UI dump failed after $UI_DUMP_RETRY_LIMIT attempts" >&2
  return 1
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

wait_for_text() {
  local expected="$1"
  for _ in $(seq 1 45); do
    dump_ui || true
    if [[ -s "$UI_DUMP" ]] && ui_has_text "$expected"; then
      return 0
    fi
    sleep 2
  done
  echo "Store scenario UI text not found: $expected" >&2
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
print(f"MOBILE_STORE_SCENARIO_PNG=PASS path={path} size={width}x{height}")
PY
}

open_store_scenario() {
  local scenario="$1"
  local expected="$2"
  local filename="$3"
  local uri="bejewely://store-capture?scenario=$scenario"

  adb shell am force-stop "$PACKAGE_ID" >/dev/null 2>&1 || true
  adb reverse tcp:8081 tcp:8081 >/dev/null
  adb shell am start -W \
    -n "$PACKAGE_ID/.MainActivity" \
    -a android.intent.action.VIEW \
    -d "$uri" >/dev/null

  wait_for_text "$expected"
  sleep 1
  capture_png "$filename"
  printf 'MOBILE_STORE_SCENARIO_CAPTURE=PASS scenario=%s file=%s\n' "$scenario" "$filename"
}

adb shell cmd uimode night no >/dev/null
adb shell wm size 1080x1920 >/dev/null
adb shell wm density 420 >/dev/null 2>&1 || true
adb reverse tcp:8081 tcp:8081 >/dev/null

# MOBILE-20B store scenarios render the real runtime components with deterministic,
# DEV-only fixtures. The switch is unavailable in release builds and never calls /api/analyze.
(
  cd "$MOBILE_ROOT"
  CI=1 \
  EXPO_NO_TELEMETRY=1 \
  EXPO_OFFLINE=1 \
  EXPO_UNSTABLE_HEADLESS=1 \
  EXPO_PUBLIC_STORE_CAPTURE_MODE=1 \
  NODE_PATH="$METRO_NODE_PATH" \
  "$EXPO_BIN" start --localhost --port 8081
) > "$METRO_LOG" 2>&1 &
METRO_PID=$!

for _ in $(seq 1 90); do
  if metro_port_ready; then
    printf 'MOBILE_STORE_SCENARIO_METRO_READY=PASS\n'
    break
  fi
  if ! kill -0 "$METRO_PID" 2>/dev/null; then
    echo "Store scenario Metro exited before opening port 8081" >&2
    cat "$METRO_LOG" >&2 || true
    exit 1
  fi
  sleep 1
done

if ! metro_port_ready; then
  echo "Store scenario Metro did not open port 8081" >&2
  exit 1
fi

adb shell input keyevent KEYCODE_WAKEUP >/dev/null 2>&1 || true
adb shell wm dismiss-keyguard >/dev/null 2>&1 || true

open_store_scenario "results-en" "Your skin routine, made clear" "03-results-en-1080x1920.png"
open_store_scenario "diary-en" "Active skin profile" "04-diary-en-1080x1920.png"
open_store_scenario "results-ko" "내 피부에 맞는 루틴을 한눈에" "03-results-ko-1080x1920.png"
open_store_scenario "diary-ko" "현재 피부 프로필" "04-diary-ko-1080x1920.png"

printf 'MOBILE_20B_RESULTS_CAPTURE=PASS locales=en,ko\n'
printf 'MOBILE_20B_DIARY_CAPTURE=PASS locales=en,ko\n'
printf 'MOBILE_20B_STORE_SCENARIOS=PASS size=1080x1920\n'
