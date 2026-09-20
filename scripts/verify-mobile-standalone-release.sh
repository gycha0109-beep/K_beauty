#!/usr/bin/env bash
set -euo pipefail

APK="${1:-apps/mobile/android/app/build/outputs/apk/release/app-release.apk}"
PACKAGE="com.bejewely.mobile"

test -f "$APK"
adb install -r "$APK"
adb shell am force-stop "$PACKAGE"
adb shell monkey -p "$PACKAGE" -c android.intent.category.LAUNCHER 1 >/dev/null
sleep 8

pid="$(adb shell pidof "$PACKAGE" | tr -d '\r')"
test -n "$pid"
adb shell uiautomator dump /sdcard/bejewely-release.xml >/dev/null
adb pull /sdcard/bejewely-release.xml apps/mobile/.mobile-release-smoke.xml >/dev/null
grep -Eq 'BEJEWELY|Home|홈|분석|Analyze' apps/mobile/.mobile-release-smoke.xml

printf 'MOBILE_STANDALONE_RELEASE_LAUNCH=PASS pid=%s\n' "$pid"
