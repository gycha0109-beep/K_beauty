import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(join(repoRoot, path), "utf8");

const copy = read("apps/mobile/lib/copy.ts");
const home = read("apps/mobile/app/index.tsx");
const analyze = read("apps/mobile/app/analyze.tsx");
const shell = read("apps/mobile/components/ScreenShell.tsx");
const androidSmoke = read("scripts/verify-mobile-android-smoke.sh");

for (const forbidden of [
  "Native shell ready",
  "Android gate · prebuild / APK / emulator launch",
  "The native shell now runs beside the existing Web client",
  "Native skin photo capture",
  "shared survey contract",
  "server-authoritative and separate",
  "Mobile auth is not configured in this build.",
  "네이티브 셸 준비 완료",
  "Android 게이트 · prebuild / APK / emulator launch",
  "기존 Web 클라이언트와 서버 권한은 그대로 유지",
  "네이티브 피부 사진 촬영",
  "이 빌드에는 모바일 인증 환경값이 설정되지 않았습니다."
]) {
  assert.equal(copy.includes(forbidden), false, `Development-facing copy leaked into MOBILE_COPY: ${forbidden}`);
}

assert.match(copy, /Skincare matched to your skin/);
assert.match(copy, /Start skin analysis/);
assert.match(copy, /내 피부에 맞는 스킨케어/);
assert.match(copy, /피부 분석 시작/);
assert.match(copy, /Your final photo and survey are sent only when you tap Run skin analysis/);
assert.match(copy, /최종 사진과 설문은 ‘피부 분석 실행’을 누를 때만 전송됩니다/);

assert.equal(home.includes("FACE_CAPTURE_STATES"), false, "Home must not expose face-capture implementation state counts");
assert.equal(home.includes("SUPPORTED_LOCALES"), false, "Home must not expose supported-locale diagnostics");
assert.match(home, /router\.push\("\/analyze"\)/, "Home CTA must open the Analyze route");
assert.match(home, /accessibilityLabel="start-skin-analysis"/);

assert.match(analyze, /eyebrow=\{copy\.eyebrow\}/);
assert.match(analyze, /description=\{copy\.description\}/);
assert.match(analyze, /\{copy\.notice\}/);
assert.equal(analyze.includes("/api/analyze"), false, "Analyze UI must not expose internal API paths");
assert.equal(analyze.includes("Face Lab"), false, "Analyze UI must not expose internal engine names");
assert.equal(analyze.includes("server authority"), false, "Analyze UI must not expose architecture terminology");

assert.match(shell, /toUserFacingEyebrow/);
assert.match(shell, /MOBILE-\[0-9\/\]\+/);
assert.match(shell, /visibleEyebrow/);

for (const expected of [
  "Skincare matched to your skin",
  "Start with your skin",
  "TAKE A CLEAR SKIN PHOTO",
  "My skin & diary",
  "내 피부에 맞는 스킨케어"
]) {
  assert.match(androidSmoke, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}
assert.equal(androidSmoke.includes("Native shell ready"), false);
assert.equal(androidSmoke.includes("BEJEWELY Mobile"), false);
assert.equal(androidSmoke.includes("테마 · 라이트"), false);
assert.equal(androidSmoke.includes("테마 · 다크"), false);

console.log("MOBILE_17_PRODUCTION_COPY=PASS");
