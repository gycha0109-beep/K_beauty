import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const files = [
  "apps/mobile/lib/copy.ts",
  "apps/mobile/app/index.tsx",
  "apps/mobile/app/analyze.tsx",
  "apps/mobile/app/my.tsx",
  "apps/mobile/app/premium.tsx",
  "apps/mobile/app/saved-report.tsx",
  "apps/mobile/app/r/[shareId].tsx",
  "apps/mobile/features/analyze/NativeAnalyzeResult.tsx",
  "apps/mobile/features/premium/NativeCurrentProductsSelector.tsx",
  "apps/mobile/features/reports/NativeSavedReport.tsx",
  "apps/mobile/features/reports/NativePublicResult.tsx"
];

const sourceByFile = new Map(files.map((path) => [path, readFileSync(path, "utf8")]));
const userFacingSource = [...sourceByFile.values()].join("\n");

const forbidden = [
  /MOBILE-\d/i,
  /native shell/i,
  /server authority/i,
  /server-authoritative/i,
  /server-side access/i,
  /Bearer/,
  /Web cookie/i,
  /\/api\/analyze/i,
  /Supabase redirect allow-list/i,
  /DB product/i,
  /server snapshot/i,
  /server-published/i,
  /existing BEJEWELY (?:analysis )?server/i,
  /this mobile slice/i,
  /entitlement mutation/i,
  /Face Lab engine/i
];

for (const pattern of forbidden) {
  assert.doesNotMatch(userFacingSource, pattern, `Production-facing mobile copy exposes internal implementation language: ${pattern}`);
}

const copy = sourceByFile.get("apps/mobile/lib/copy.ts");
assert.match(copy, /PERSONALIZED K-BEAUTY/);
assert.match(copy, /Skincare that fits your skin/);
assert.match(copy, /맞춤 K-뷰티/);
assert.match(copy, /내 피부에 맞는 스킨케어/);
assert.match(copy, /Sign-in is temporarily unavailable\. Please try again later\./);
assert.match(copy, /지금은 로그인을 사용할 수 없습니다\. 잠시 후 다시 시도해 주세요\./);

const home = sourceByFile.get("apps/mobile/app/index.tsx");
assert.match(home, /testID="mobile-home-start-analysis"/);
assert.match(home, /router\.push\("\/analyze"\)/);
assert.match(home, /Start skin analysis/);
assert.match(home, /피부 분석 시작/);

const analyze = sourceByFile.get("apps/mobile/app/analyze.tsx");
assert.match(analyze, /personalized BEJEWELY analysis/);
assert.match(analyze, /맞춤 피부 분석/);
assert.doesNotMatch(analyze, /Product Fact|Face Lab|server authority|\/api\/analyze/i);

const result = sourceByFile.get("apps/mobile/features/analyze/NativeAnalyzeResult.tsx");
assert.match(result, /PERSONALIZED RESULT/);
assert.match(result, /Review your product picks and routine/);

const my = sourceByFile.get("apps/mobile/app/my.tsx");
assert.match(my, /<ScreenShell eyebrow="MY"/);
assert.doesNotMatch(my, /My \/ Skin Diary API|server diary|Web/i);

const premium = sourceByFile.get("apps/mobile/app/premium.tsx");
assert.match(premium, /eyebrow: "PREMIUM"/);
assert.doesNotMatch(premium, /server-prepared|server-side|mobile slice|entitlement mutation/i);

const saved = sourceByFile.get("apps/mobile/app/saved-report.tsx");
assert.match(saved, /eyebrow: "REPORTS"/);
assert.match(saved, /eyebrow: "리포트"/);

const publicScreen = sourceByFile.get("apps/mobile/app/r/[shareId].tsx");
assert.match(publicScreen, /kicker: "PUBLIC RESULT"/);
assert.match(publicScreen, /kicker: "공개 결과"/);

const androidSmoke = readFileSync("scripts/verify-mobile-android-smoke.sh", "utf8");
assert.match(androidSmoke, /wait_for_text "Skincare that fits your skin"/);
assert.match(androidSmoke, /wait_for_text "Start with your skin"/);
assert.match(androidSmoke, /wait_for_text "SKIN PHOTO"/);
assert.match(androidSmoke, /wait_for_text "내 피부에 맞는 스킨케어"/);
assert.match(androidSmoke, /wait_for_text "화면 모드 · 라이트"/);
assert.match(androidSmoke, /wait_for_text "화면 모드 · 다크"/);
assert.doesNotMatch(androidSmoke, /wait_for_text "(?:BEJEWELY Mobile|Native shell ready|NATIVE SKIN PHOTO CAPTURE|BEJEWELY 모바일|테마 · (?:라이트|다크))"/);

console.log("MOBILE_17A_INTERNAL_COPY_REMOVED=PASS");
console.log("MOBILE_17A_HOME_PRODUCT_COPY=PASS");
console.log("MOBILE_17A_ANALYZE_PRODUCT_COPY=PASS");
console.log("MOBILE_17A_MY_PREMIUM_REPORT_COPY=PASS");
console.log("MOBILE_17A_ANDROID_SMOKE_COPY_SYNC=PASS");
