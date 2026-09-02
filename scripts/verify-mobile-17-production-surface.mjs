import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const files = [
  "apps/mobile/lib/copy.ts",
  "apps/mobile/app/_layout.tsx",
  "apps/mobile/app/index.tsx",
  "apps/mobile/app/analyze.tsx",
  "apps/mobile/app/my.tsx",
  "apps/mobile/features/analyze/NativeAnalyzeSurvey.tsx"
];

const source = Object.fromEntries(
  files.map((path) => [path, readFileSync(join(repoRoot, path), "utf8")])
);
const combined = Object.values(source).join("\n");

const forbiddenUserSurfaceFragments = [
  "MOBILE-1",
  "MOBILE-3",
  "MOBILE-5",
  "MOBILE-6",
  "MOBILE-7",
  "Native shell ready",
  "native shell",
  "Native My",
  "Native skin photo capture",
  "server authority",
  "server-authoritative",
  "Native Bearer",
  "Web cookie",
  "Supabase redirect allow-list",
  "/api/analyze",
  "existing server-side Skin Match engine",
  "서버의 기존 Skin Match 엔진",
  "in this build",
  "이 빌드"
];

for (const fragment of forbiddenUserSurfaceFragments) {
  assert.equal(
    combined.includes(fragment),
    false,
    `production mobile surface still exposes internal implementation copy: ${fragment}`
  );
}

const copy = source["apps/mobile/lib/copy.ts"];
assert.match(copy, /eyebrow: "SKIN MATCH"/);
assert.match(copy, /title: "BEJEWELY"/);
assert.match(copy, /cta: "Start skin analysis"/);
assert.match(copy, /cta: "피부 분석 시작하기"/);
assert.match(copy, /title: "Skin analysis"/);
assert.match(copy, /title: "피부 분석"/);
assert.match(copy, /title: "My · Skin Diary"/);
assert.match(copy, /title: "마이 · 스킨 다이어리"/);
assert.match(copy, /Sign-in is temporarily unavailable\. Please try again later\./);
assert.match(copy, /현재 로그인을 사용할 수 없습니다\. 잠시 후 다시 시도해 주세요\./);

const layout = source["apps/mobile/app/_layout.tsx"];
assert.match(layout, /function HomeTabIcon/);
assert.match(layout, /function AnalyzeTabIcon/);
assert.match(layout, /function MyTabIcon/);
assert.match(layout, /tabBarIcon: \(\{ color, size \}\) => <HomeTabIcon color=\{color\} size=\{size\} \/>/);
assert.match(layout, /tabBarIcon: \(\{ color, size \}\) => <AnalyzeTabIcon color=\{color\} size=\{size\} \/>/);
assert.match(layout, /tabBarIcon: \(\{ color, size \}\) => <MyTabIcon color=\{color\} size=\{size\} \/>/);

const home = source["apps/mobile/app/index.tsx"];
assert.match(home, /testID="mobile-home-start-analysis"/);
assert.match(home, /router\.push\("\/analyze"\)/);

const analyze = source["apps/mobile/app/analyze.tsx"];
assert.match(analyze, /<ScreenShell eyebrow=\{copy\.eyebrow\}/);
assert.match(analyze, /skin-care guidance and product recommendations/i);

const survey = source["apps/mobile/features/analyze/NativeAnalyzeSurvey.tsx"];
assert.match(survey, /Your answers help match your skin profile, product picks, and routine more accurately\./);
assert.match(survey, /답변은 피부 프로필과 맞춤 제품, 루틴을 더 정확하게 맞추는 데 사용됩니다\./);

const my = source["apps/mobile/app/my.tsx"];
assert.match(my, /<ScreenShell eyebrow=\{copy\.eyebrow\}/);
assert.match(my, /Record what changed today so you can compare your skin over time\./);

console.log("MOBILE_17_HOME_CONSUMER_SURFACE=PASS");
console.log("MOBILE_17_ANALYZE_CONSUMER_COPY=PASS");
console.log("MOBILE_17_MY_CONSUMER_COPY=PASS");
console.log("MOBILE_17_TAB_ICON_SURFACE=PASS");
console.log("MOBILE_17_INTERNAL_IMPLEMENTATION_COPY_REMOVED=PASS");
