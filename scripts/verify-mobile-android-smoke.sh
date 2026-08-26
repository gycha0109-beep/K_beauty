#!/usr/bin/env bash
set -euo pipefail

PACKAGE_ID="com.bejewely.mobile"
APK_PATH="apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk"
ARTIFACT_DIR="apps/mobile/.mobile-native-artifacts"
UI_DUMP="$ARTIFACT_DIR/window.xml"
METRO_PID=""

mkdir -p "$ARTIFACT_DIR"

cleanup() {
  status=$?
  adb logcat -d > "$ARTIFACT_DIR/logcat.txt" 2>&1 || true
  adb shell uiautomator dump /sdcard/bejewely-window.xml >/dev/null 2>&1 || true
  adb pull /sdcard/bejewely-window.xml "$ARTIFACT_DIR/final-window.xml" >/dev/null 2>&1 || true
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

dump_ui() {
  adb shell uiautomator dump /sdcard/bejewely-window.xml >/dev/null
  adb pull /sdcard/bejewely-window.xml "$UI_DUMP" >/dev/null
}

wait_for_text() {
  local expected="$1"
  for _ in $(seq 1 45); do
    dump_ui || true
    if [[ -f "$UI_DUMP" ]] && grep -Fq "$expected" "$UI_DUMP"; then
      return 0
    fi
    sleep 2
  done
  echo "UI text not found: $expected" >&2
  return 1
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

adb shell cmd uimode night no >/dev/null
adb reverse tcp:8081 tcp:8081

CI=1 EXPO_NO_TELEMETRY=1 npm run start --workspace @bejewely/mobile -- --localhost > "$ARTIFACT_DIR/metro.log" 2>&1 &
METRO_PID=$!

for _ in $(seq 1 60); do
  if curl --silent --fail http://127.0.0.1:8081/status | grep -Fq "packager-status:running"; then
    break
  fi
  if ! kill -0 "$METRO_PID" 2>/dev/null; then
    echo "Metro exited before becoming ready" >&2
    exit 1
  fi
  sleep 1
done

curl --silent --fail http://127.0.0.1:8081/status | grep -Fq "packager-status:running"
adb install -r "$APK_PATH" >/dev/null
adb shell pm clear "$PACKAGE_ID" >/dev/null
adb reverse tcp:8081 tcp:8081
adb shell monkey -p "$PACKAGE_ID" -c android.intent.category.LAUNCHER 1 >/dev/null

wait_for_text "BEJEWELY Mobile"
wait_for_text "Native shell ready"
adb exec-out screencap -p > "$ARTIFACT_DIR/home-light-en.png"

tap_text "Analyze"
wait_for_text "Native analysis entry"
tap_text "My"
wait_for_text "Native account space"
tap_text "Home"
wait_for_text "BEJEWELY Mobile"

tap_text "KO"
wait_for_text "BEJEWELY 모바일"
wait_for_text "테마 · 라이트"
adb exec-out screencap -p > "$ARTIFACT_DIR/home-light-ko.png"

adb shell cmd uimode night yes >/dev/null
wait_for_text "테마 · 다크"
adb exec-out screencap -p > "$ARTIFACT_DIR/home-dark-ko.png"

adb shell dumpsys activity activities | grep -F "$PACKAGE_ID/.MainActivity" > "$ARTIFACT_DIR/activity.txt"
printf 'MOBILE_ANDROID_EMULATOR_SMOKE=PASS\n'
