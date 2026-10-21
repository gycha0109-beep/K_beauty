import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(join(root, path), "utf8");
const dictionary = read("apps/mobile/lib/skin-state-i18n.ts");
const diary = read("apps/mobile/features/my/NativeMyDiaryView.tsx");
const saved = read("apps/mobile/features/reports/NativeSavedReport.tsx");
const shared = read("apps/mobile/features/reports/NativePublicResult.tsx");

assert.match(dictionary, /function getLocalizedSkinState\(/);
assert.match(dictionary, /return lookup\[text\.toLowerCase\(\)\] \|\| text/);
for (const group of ["skinTypes", "sensitivities", "concerns"]) {
  assert.equal((dictionary.match(new RegExp(`\\b${group}:\\s*\\{`, "g")) || []).length, 2, `${group} must have ko/en values`);
}
assert.match(diary, /getLocalizedSkinState\(profile\?\.skin_type, "skinTypes", locale\)/);
assert.match(diary, /getLocalizedSkinState\(concern, "concerns", locale\)/);
assert.match(diary, /getLocalizedSkinState\(profile\?\.sensitivity_level, "sensitivities", locale\)/);
assert.match(saved, /getLocalizedSkinState\(result\.skinType, "skinTypes", locale\)/);
assert.match(saved, /getLocalizedSkinState\(value, "concerns", locale\)/);
assert.match(shared, /getLocalizedSkinState\(text\(result\.skinType\), "skinTypes", locale\)/);
assert.match(shared, /getLocalizedSkinState\(value, "concerns", locale\)/);
assert.match(diary, /checkin\.memo \|\|/);
assert.ok(!diary.includes("getLocalizedSkinState(checkin.memo"), "user-authored diary text must stay untouched");
console.log("I18N_KO_EN_M3_PROFILE=PASS");
