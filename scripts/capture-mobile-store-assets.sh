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
UI_DUMP_RETRY_LIMIT=4
ADB_READY_RETRY_LIMIT=45
APP_FOREGROUND_RETRY_LIMIT=15
APP_LAUNCH_RETRY_LIMIT=3
STORE_SCROLL_UP_START_Y=1420
STORE_SCROLL_UP_END_Y=680
EN_FRAME_POSITION_LIMIT=6
EN_FRAME_ADJUST_START_Y=1100
EN_FRAME_ADJUST_UP_END_Y=1000
EN_FRAME_ADJUST_DOWN_END_Y=1200
KO_FRAME_POSITION_LIMIT=5
KO_FRAME_ADJUST_START_Y=1100
KO_FRAME_ADJUST_UP_END_Y=1000
KO_FRAME_ADJUST_DOWN_END_Y=1200

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

adb_diagnostics() {
  echo "--- ADB diagnostics ---" >&2
  adb devices -l >&2 || true
  printf 'adb_state=%s\n' "$(adb get-state 2>/dev/null || true)" >&2
  printf 'sys.boot_completed=%s\n' "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r' || true)" >&2
  adb shell dumpsys activity activities 2>/dev/null | grep -m1 'mResumedActivity' >&2 || true
  adb shell dumpsys activity top 2>/dev/null | grep -m1 'ACTIVITY' >&2 || true
  adb shell dumpsys window windows 2>/dev/null | grep -m1 'mCurrentFocus' >&2 || true
  adb shell dumpsys window displays 2>/dev/null | grep -Em1 'mCurrentFocus|mFocusedApp' >&2 || true
}

wait_for_adb_ready() {
  local attempt state boot_completed
  for attempt in $(seq 1 "$ADB_READY_RETRY_LIMIT"); do
    state="$(adb get-state 2>/dev/null || true)"
    boot_completed="$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r' || true)"
    if [[ "$state" == "device" && "$boot_completed" == "1" ]]; then
      printf 'MOBILE_STORE_ADB_READY=PASS attempt=%s\n' "$attempt"
      return 0
    fi
    if [[ "$state" == "offline" ]]; then
      adb reconnect offline >/dev/null 2>&1 || true
    fi
    sleep 2
  done
  echo "ADB device did not become ready within bounded retry window" >&2
  adb_diagnostics
  return 1
}

foreground_ui_owned_by_app() {
  local hierarchy=""
  hierarchy="$(adb shell uiautomator dump /sdcard/bejewely-foreground-window.xml >/dev/null 2>&1 && adb exec-out cat /sdcard/bejewely-foreground-window.xml 2>/dev/null || true)"
  [[ "$hierarchy" == *"package=\"$PACKAGE_ID\""* ]]
}

app_is_foreground() {
  local resumed focus top_activity focused_display
  resumed="$(adb shell dumpsys activity activities 2>/dev/null | grep -m1 'mResumedActivity' || true)"
  focus="$(adb shell dumpsys window windows 2>/dev/null | grep -m1 'mCurrentFocus' || true)"
  top_activity="$(adb shell dumpsys activity top 2>/dev/null | grep -m1 'ACTIVITY' || true)"
  focused_display="$(adb shell dumpsys window displays 2>/dev/null | grep -Em1 'mCurrentFocus|mFocusedApp' || true)"
  if [[ "$resumed" == *"$PACKAGE_ID"* || "$focus" == *"$PACKAGE_ID"* || "$top_activity" == *"$PACKAGE_ID"* || "$focused_display" == *"$PACKAGE_ID"* ]]; then
    return 0
  fi
  if foreground_ui_owned_by_app; then
    printf 'MOBILE_STORE_APP_FOREGROUND_UI_FALLBACK=PASS\n'
    return 0
  fi
  return 1
}

dismiss_quickstep_anr_if_needed() {
  dump_ui || true
  if [[ ! -s "$UI_DUMP" ]] || ! ui_has_text "Quickstep isn't responding"; then
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
  return 0
}

wait_for_app_foreground() {
  local attempt recovery_status
  for attempt in $(seq 1 "$APP_FOREGROUND_RETRY_LIMIT"); do
    if app_is_foreground; then
      printf 'MOBILE_STORE_APP_FOREGROUND=PASS attempt=%s\n' "$attempt"
      return 0
    fi
    if dismiss_quickstep_anr_if_needed; then
      printf 'MOBILE_STORE_APP_FOREGROUND_QUICKSTEP_RECOVERY=PASS attempt=%s\n' "$attempt"
      return 3
    else
      recovery_status=$?
      if [[ "$recovery_status" -eq 2 ]]; then
        return 2
      fi
    fi
    sleep 2
  done
  echo "BEJEWELY app did not become foreground within bounded retry window" >&2
  adb_diagnostics
  return 1
}

launch_app_and_wait() {
  local attempt package_path
  package_path="$(adb shell pm path "$PACKAGE_ID" 2>/dev/null | tr -d '\r' || true)"
  if [[ "$package_path" != package:* ]]; then
    echo "BEJEWELY package is not installed: $PACKAGE_ID" >&2
    adb_diagnostics
    return 1
  fi
  for attempt in $(seq 1 "$APP_LAUNCH_RETRY_LIMIT"); do
    local foreground_status=0
    adb shell input keyevent KEYCODE_WAKEUP >/dev/null 2>&1 || true
    adb shell wm dismiss-keyguard >/dev/null 2>&1 || true
    if adb shell am start -W -n "$PACKAGE_ID/.MainActivity" >/dev/null 2>&1; then
      if wait_for_app_foreground; then
        printf 'MOBILE_STORE_APP_LAUNCH=PASS attempt=%s\n' "$attempt"
        return 0
      else
        foreground_status=$?
        if [[ "$foreground_status" -eq 2 ]]; then
          return 1
        fi
        if [[ "$foreground_status" -eq 3 ]]; then
          printf 'MOBILE_STORE_APP_LAUNCH_RETRY_AFTER_QUICKSTEP=PASS attempt=%s\n' "$attempt"
        fi
      fi
    fi
    sleep 2
  done
  echo "BEJEWELY app launch failed after bounded retries" >&2
  adb_diagnostics
  return 1
}

dump_ui() {
  local attempt
  for attempt in $(seq 1 "$UI_DUMP_RETRY_LIMIT"); do
    rm -f "$UI_DUMP"
    if [[ "$(adb get-state 2>/dev/null || true)" != "device" ]]; then
      adb reconnect offline >/dev/null 2>&1 || true
      sleep 2
      continue
    fi
    if adb shell uiautomator dump /sdcard/bejewely-store-window.xml >/dev/null 2>&1 && \
       adb pull /sdcard/bejewely-store-window.xml "$UI_DUMP" >/dev/null 2>&1; then
      if (( attempt > 1 )); then
        printf 'MOBILE_STORE_UI_DUMP_RECOVERY=PASS attempt=%s\n' "$attempt"
      fi
      return 0
    fi
    printf 'UI dump attempt %s/%s failed\n' "$attempt" "$UI_DUMP_RETRY_LIMIT" >&2
    sleep 1
  done
  printf 'UI dump failed after %s attempts\n' "$UI_DUMP_RETRY_LIMIT" >&2
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

tap_text_from_current_ui() {
  local target="$1"
  if [[ ! -s "$UI_DUMP" ]]; then
    echo "Current UI hierarchy missing for tap target: $target" >&2
    return 1
  fi
  local coords
  if ! coords="$(python - "$UI_DUMP" "$target" <<'PY'
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
    raise SystemExit(f"tap target not found in current UI: {target}")
matches.sort(reverse=True)
_, x, y = matches[0]
print(x, y)
PY
)"; then
    echo "Failed to resolve current UI tap coordinates: $target" >&2
    return 1
  fi
  read -r x y <<< "$coords"
  if [[ ! "$x" =~ ^[0-9]+$ || ! "$y" =~ ^[0-9]+$ ]]; then
    echo "Invalid current UI tap coordinates: target=$target coords=${coords:-missing}" >&2
    return 1
  fi
  adb shell input tap "$x" "$y"
  printf 'MOBILE_STORE_CURRENT_UI_TAP=PASS target=%s x=%s y=%s\n' "$target" "$x" "$y"
}

tap_text() {
  local target="$1"
  dump_ui
  local coords
  if ! coords="$(python - "$UI_DUMP" "$target" <<'PY'
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
)"; then
    echo "Failed to resolve tap coordinates: $target" >&2
    return 1
  fi
  read -r x y <<< "$coords"
  if [[ ! "$x" =~ ^[0-9]+$ || ! "$y" =~ ^[0-9]+$ ]]; then
    echo "Invalid tap coordinates: target=$target coords=${coords:-missing}" >&2
    return 1
  fi
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
  local recovery_status=0
  if dismiss_quickstep_anr_if_needed; then
    :
  else
    recovery_status=$?
    return "$recovery_status"
  fi
  if ! launch_app_and_wait; then
    echo "Quickstep recovery could not restore BEJEWELY foreground state" >&2
    return 2
  fi
  printf 'MOBILE_STORE_DIRECT_ACTIVITY_RESTART=PASS\n'
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
        adb shell input swipe 540 "$STORE_SCROLL_UP_START_Y" 540 "$STORE_SCROLL_UP_END_Y" 350 >/dev/null 2>&1 || true
      fi
    else
      adb shell input swipe 540 "$STORE_SCROLL_UP_START_Y" 540 "$STORE_SCROLL_UP_END_Y" 350 >/dev/null 2>&1 || true
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

position_en_analyze_store_frame() {
  local attempt
  local open_camera_y=""
  local main_concern_y=""
  for attempt in $(seq 1 "$EN_FRAME_POSITION_LIMIT"); do
    dump_ui
    open_camera_y="$(text_center_y "Open camera" 2>/dev/null || true)"
    main_concern_y="$(text_center_y "Main concern" 2>/dev/null || true)"
    if [[ "$open_camera_y" =~ ^[0-9]+$ ]] && [[ "$main_concern_y" =~ ^[0-9]+$ ]] && \
       (( open_camera_y >= 350 && open_camera_y <= 650 && main_concern_y >= 1300 && main_concern_y <= 1600 )); then
      printf 'MOBILE_STORE_EN_ANALYZE_FRAME=PASS attempt=%s open_camera_y=%s main_concern_y=%s\n' "$attempt" "$open_camera_y" "$main_concern_y"
      return 0
    fi
    if [[ ! "$open_camera_y" =~ ^[0-9]+$ ]]; then
      adb shell input swipe 540 "$EN_FRAME_ADJUST_START_Y" 540 "$EN_FRAME_ADJUST_DOWN_END_Y" 220 >/dev/null 2>&1 || true
      printf 'MOBILE_STORE_EN_FRAME_CORRECTION=DOWN attempt=%s open_camera_y=%s main_concern_y=%s\n' "$attempt" "${open_camera_y:-missing}" "${main_concern_y:-missing}"
      sleep 1
      continue
    fi
    if [[ ! "$main_concern_y" =~ ^[0-9]+$ ]] || (( open_camera_y > 650 )) || \
       ([[ "$main_concern_y" =~ ^[0-9]+$ ]] && (( main_concern_y > 1600 ))); then
      adb shell input swipe 540 "$EN_FRAME_ADJUST_START_Y" 540 "$EN_FRAME_ADJUST_UP_END_Y" 220 >/dev/null 2>&1 || true
      printf 'MOBILE_STORE_EN_FRAME_CORRECTION=UP attempt=%s open_camera_y=%s main_concern_y=%s\n' "$attempt" "$open_camera_y" "${main_concern_y:-missing}"
      sleep 1
      continue
    fi
    if (( open_camera_y < 350 )) || \
       ([[ "$main_concern_y" =~ ^[0-9]+$ ]] && (( main_concern_y < 1300 ))); then
      adb shell input swipe 540 "$EN_FRAME_ADJUST_START_Y" 540 "$EN_FRAME_ADJUST_DOWN_END_Y" 220 >/dev/null 2>&1 || true
      printf 'MOBILE_STORE_EN_FRAME_CORRECTION=DOWN attempt=%s open_camera_y=%s main_concern_y=%s\n' "$attempt" "$open_camera_y" "$main_concern_y"
      sleep 1
      continue
    fi
    break
  done
  echo "English analysis frame could not be positioned: open_camera_y=${open_camera_y:-missing} main_concern_y=${main_concern_y:-missing}" >&2
  return 1
}

position_ko_analyze_store_frame() {
  local attempt
  local title_y=""
  local sensitivity_y=""
  for attempt in $(seq 1 "$KO_FRAME_POSITION_LIMIT"); do
    dump_ui
    title_y="$(text_center_y "피부 분석" 2>/dev/null || true)"
    sensitivity_y="$(text_center_y "민감도" 2>/dev/null || true)"
    if [[ "$title_y" =~ ^[0-9]+$ ]] && [[ "$sensitivity_y" =~ ^[0-9]+$ ]] && \
       (( title_y >= 300 && title_y <= 600 && sensitivity_y >= 900 && sensitivity_y <= 1450 )); then
      printf 'MOBILE_STORE_KO_ANALYZE_FRAME=PASS attempt=%s title_y=%s sensitivity_y=%s\n' "$attempt" "$title_y" "$sensitivity_y"
      return 0
    fi
    if [[ ! "$title_y" =~ ^[0-9]+$ ]] && [[ "$sensitivity_y" =~ ^[0-9]+$ ]]; then
      adb shell input swipe 540 "$KO_FRAME_ADJUST_START_Y" 540 "$KO_FRAME_ADJUST_DOWN_END_Y" 220 >/dev/null 2>&1 || true
      printf 'MOBILE_STORE_KO_FRAME_CORRECTION=DOWN attempt=%s reason=title-missing title_y=%s sensitivity_y=%s\n' "$attempt" "${title_y:-missing}" "$sensitivity_y"
      sleep 1
      continue
    fi
    if [[ "$title_y" =~ ^[0-9]+$ ]] && [[ ! "$sensitivity_y" =~ ^[0-9]+$ ]]; then
      adb shell input swipe 540 "$KO_FRAME_ADJUST_START_Y" 540 "$KO_FRAME_ADJUST_UP_END_Y" 220 >/dev/null 2>&1 || true
      printf 'MOBILE_STORE_KO_FRAME_CORRECTION=UP attempt=%s reason=sensitivity-missing title_y=%s sensitivity_y=%s\n' "$attempt" "$title_y" "${sensitivity_y:-missing}"
      sleep 1
      continue
    fi
    if [[ "$title_y" =~ ^[0-9]+$ ]] && [[ "$sensitivity_y" =~ ^[0-9]+$ ]] && \
       (( title_y > 600 || sensitivity_y > 1450 )); then
      adb shell input swipe 540 "$KO_FRAME_ADJUST_START_Y" 540 "$KO_FRAME_ADJUST_UP_END_Y" 220 >/dev/null 2>&1 || true
      printf 'MOBILE_STORE_KO_FRAME_CORRECTION=UP attempt=%s title_y=%s sensitivity_y=%s\n' "$attempt" "$title_y" "$sensitivity_y"
      sleep 1
      continue
    fi
    if [[ "$title_y" =~ ^[0-9]+$ ]] && [[ "$sensitivity_y" =~ ^[0-9]+$ ]] && \
       (( title_y < 300 || sensitivity_y < 900 )); then
      adb shell input swipe 540 "$KO_FRAME_ADJUST_START_Y" 540 "$KO_FRAME_ADJUST_DOWN_END_Y" 220 >/dev/null 2>&1 || true
      printf 'MOBILE_STORE_KO_FRAME_CORRECTION=DOWN attempt=%s title_y=%s sensitivity_y=%s\n' "$attempt" "$title_y" "$sensitivity_y"
      sleep 1
      continue
    fi
    break
  done

  dump_ui
  title_y="$(text_center_y "피부 분석" 2>/dev/null || true)"
  sensitivity_y="$(text_center_y "민감도" 2>/dev/null || true)"
  if [[ "$title_y" =~ ^[0-9]+$ ]] && [[ "$sensitivity_y" =~ ^[0-9]+$ ]] && \
     (( title_y >= 300 && title_y <= 600 && sensitivity_y >= 900 && sensitivity_y <= 1450 )); then
    printf 'MOBILE_STORE_KO_ANALYZE_FRAME=PASS attempt=post-correction title_y=%s sensitivity_y=%s\n' "$title_y" "$sensitivity_y"
    return 0
  fi

  echo "Korean analysis frame could not be positioned: title_y=${title_y:-missing} sensitivity_y=${sensitivity_y:-missing}" >&2
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
  local transport_status=0
  if adb exec-out screencap -p > "$output"; then
    transport_status=0
  else
    transport_status=$?
  fi
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
  if (( transport_status != 0 )); then
    printf 'MOBILE_STORE_SCREENSHOT_TRANSPORT_RECOVERY=PASS status=%s path=%s\n' "$transport_status" "$output"
  fi
}

reset_store_capture_session() {
  wait_for_adb_ready
  adb shell am force-stop "$PACKAGE_ID" >/dev/null 2>&1 || true
  adb shell pm clear "$PACKAGE_ID" >/dev/null
  adb shell pm grant "$PACKAGE_ID" android.permission.CAMERA >/dev/null
  adb reverse tcp:8081 tcp:8081 >/dev/null
  launch_app_and_wait
  printf 'MOBILE_STORE_LOCALE_SESSION_RESET=PASS locale=ko\n'
}

wait_for_adb_ready
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
  EXPO_PUBLIC_STORE_CAPTURE_MODE=1 \
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

wait_for_adb_ready
adb install -r "$APK_PATH" >/dev/null
adb shell pm clear "$PACKAGE_ID" >/dev/null
adb shell pm grant "$PACKAGE_ID" android.permission.CAMERA >/dev/null
adb shell input keyevent KEYCODE_WAKEUP >/dev/null 2>&1 || true
adb shell wm dismiss-keyguard >/dev/null 2>&1 || true
adb reverse tcp:8081 tcp:8081 >/dev/null
launch_app_and_wait

wait_for_text "BEJEWELY"
wait_for_text "Find what fits your skin today"
capture_png "01-home-en-1080x1920.png"

tap_text "Analyze"
wait_for_text "SKIN ANALYSIS"
tap_text "Open camera" || true
wait_for_text "Camera ready"
printf 'MOBILE_STORE_CAMERA_ENTRY=PASS locale=en\n'
tap_text_from_current_ui "Take photo"
wait_for_text "CAPTURED PHOTO"
wait_for_text "Use photo"
tap_text_until_gone "Use photo" 8
scroll_text_into_store_frame "Skin survey before analysis" 360 1050 8
position_en_analyze_store_frame
capture_png "02-analyze-en-1080x1920.png"

reset_store_capture_session
wait_for_text "BEJEWELY"
wait_for_text "Find what fits your skin today"
tap_text "locale-ko"
wait_for_text "오늘 내 피부에 맞는 루틴 찾기"
capture_png "01-home-ko-1080x1920.png"

tap_text "분석"
wait_for_text "피부 분석"
tap_text "카메라 열기" || true
wait_for_text "카메라 준비 완료"
printf 'MOBILE_STORE_CAMERA_ENTRY=PASS locale=ko\n'
tap_text_from_current_ui "사진 촬영"
wait_for_text "촬영한 사진"
wait_for_text "이 사진 사용"
tap_text_until_gone "이 사진 사용" 8
scroll_text_into_store_frame "분석 전 피부 설문" 360 1050 8
position_ko_analyze_store_frame
capture_png "02-analyze-ko-1080x1920.png"

printf 'MOBILE_20A_HOME_CAPTURE=PASS locales=en,ko\n'
printf 'MOBILE_20A_ANALYZE_CAPTURE=PASS locales=en,ko\n'
printf 'MOBILE_20A_STORE_CAPTURE=PASS size=1080x1920\n'
