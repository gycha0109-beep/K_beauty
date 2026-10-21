import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  getAnalysisResultSourceLocale,
  getConcernLabels,
  getSkinTypeLabel,
  serializePublicAnalysisResult,
  serializeOwnerAnalysisResult
} from "../lib/analysis-results.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(join(root, path), "utf8");
const dictionary = read("apps/mobile/lib/skin-state-i18n.ts");
const diary = read("apps/mobile/features/my/NativeMyDiaryView.tsx");
const saved = read("apps/mobile/features/reports/NativeSavedReport.tsx");
const shared = read("apps/mobile/features/reports/NativePublicResult.tsx");
const premiumApi = read("app/api/full-report/route.js");
const webReport = read("app/result/full-report/page.js");
const webShared = read("components/result/SharedResultLoader.jsx");
const resultSerializer = read("lib/analysis-results.js");

assert.match(dictionary, /function getLocalizedSkinState\(/);
assert.match(dictionary, /return lookup\[canonical\] \|\| text/);
assert.match(dictionary, /LEGACY_KO_ALIASES\[group\]\[text\] \|\| text\.toLowerCase\(\)/);
assert.match(dictionary, /"복합성": "combination"/);
assert.match(dictionary, /"트러블": "acne"/);
const localeLabels = dictionary.split("const LEGACY_KO_ALIASES")[0];
for (const group of ["skinTypes", "sensitivities", "concerns"]) {
  assert.equal((localeLabels.match(new RegExp(`\\b${group}:\\s*\\{`, "g")) || []).length, 2, `${group} must have ko/en values`);
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
assert.match(saved, /locale === "en" && \(reportLocale === "ko" \|\| containsKoreanGuidance\)/);
assert.match(shared, /locale === "en" && \(result\.sourceLocale === "ko" \|\| containsKoreanGuidance\)/);
assert.match(saved, /Some saved guidance is shown in Korean/);
assert.match(shared, /Some saved guidance is shown in Korean/);

assert.match(premiumApi, /sourceLocale: locale/);
assert.match(premiumApi, /displayLocale: locale/);
assert.match(premiumApi, /displayLocale: displayLocale === "en" \? "en" : "ko"/);
assert.match(premiumApi, /const savedLocale = resolvePremiumReportLocale\(savedPremiumReport\)/);
assert.match(premiumApi, /"saved-report"/);
assert.match(premiumApi, /buildPremiumReportSnapshot\(savedPremiumReport\)/);
assert.match(webReport, /report\?\.meta\?\.sourceLocale \|\| report\?\.meta\?\.locale/);
assert.match(saved, /premiumMeta\?\.sourceLocale/);
assert.match(saved, /\? value\.result\.sourceLocale/);
assert.match(saved, /normalizeText\(product\.name_en\)/);
assert.match(saved, /normalizeText\(product\.brand_en\)/);
assert.match(shared, /text\(product\.name_en\)/);
assert.match(shared, /text\(product\.brand_en\)/);
assert.match(saved, /const containsKoreanGuidance = guidanceLines\.some/);
assert.match(saved, /Object\.hasOwn\(record, "ko"\) \|\| Object\.hasOwn\(record, "en"\)/);
assert.match(saved, /return collectDisplayLines\(localized, limit, depth \+ 1, locale\)/);
assert.match(saved, /hasDisplayText\(preferred\) \? preferred : fallback/);
assert.match(dictionary, /barrier: "Barrier support"/);
assert.match(saved, /collectDisplayLines\(report\.fullRoutine, 10, 0, locale\)/);
assert.match(saved, /collectDisplayLines\(report\.functionalDecisions, 10, 0, locale\)/);

assert.match(shared, /const containsKoreanGuidance = \[summary, product\?\.reason, \.\.\.am, \.\.\.pm\]/);
// Runtime DTO regression: legacy locale compatibility is retained, while source
// provenance is null when the original language was never recorded.
const sample = Object.freeze({
  share_id: "AbCdEfGhIjKlMnOpQrStUv",
  is_public: true,
  skin_type: "dry",
  summary: "원문 설명",
  routine_am: ["주 2회"],
  routine_pm: [],
  recommended_products: [],
  main_concerns: ["acne"],
  result_json: { result: { summary: "원문 설명" } }
});
assert.equal(getAnalysisResultSourceLocale(sample), null);
const unknown = serializePublicAnalysisResult(sample);
assert.equal(unknown.locale, "ko", "legacy display fallback remains unchanged");
assert.equal(unknown.sourceLocale, null, "an unknown source language is not claimed to be KO");
assert.equal(unknown.summary, "원문 설명");
assert.equal(getSkinTypeLabel("복합성", "en"), "Combination");
assert.equal(getSkinTypeLabel("dry", "en"), "Dry");
assert.deepEqual(getConcernLabels(["트러블", "붉은기", "unknown"], "en"), ["Breakouts", "Redness", "unknown"]);
assert.deepEqual(getConcernLabels(["acne"], "ko"), ["트러블"]);

assert.equal(unknown.topPick, null);
assert.equal(serializeOwnerAnalysisResult({ ...sample, is_public: false }).sourceLocale, null);
assert.equal(getAnalysisResultSourceLocale({ ...sample, locale: "en" }), "en");
assert.equal(getAnalysisResultSourceLocale({ ...sample, result_json: { locale: "ko" }, locale: "en" }), "ko");
assert.equal(getAnalysisResultSourceLocale({ ...sample, result_json: { locale: "fr" }, locale: "en" }), null);
assert.equal(serializePublicAnalysisResult({ ...sample, result_json: { locale: "en", result: { summary: "Hello" } } }).sourceLocale, "en");
const publicShape = Object.keys(unknown).sort();
assert.deepEqual(Object.keys(serializeOwnerAnalysisResult({ ...sample, is_public: false })).sort(), [...publicShape, "isPublic"].sort());
assert.ok(!publicShape.includes("user_id"), "public response must not expose owner identifiers");

// The shared-result language switch is a presentation operation, not a new read
// or result-generation request. Verify original share access remains guarded.
assert.match(resultSerializer, /sourceLocale: getAnalysisResultSourceLocale\(row\)/);
assert.match(resultSerializer, /return stored === "ko" \|\| stored === "en" \? stored : null/);
assert.match(webShared, /const displayLocale = requestedDisplayLocale \|\| result\.locale/);
assert.match(webShared, /const sourceNoteVisible = displayLocale === "en"/);
assert.match(webShared, /locale=\{displayLocale\}/);
assert.match(webShared, /onClick=\{\(\) => setRequestedDisplayLocale\(option\)\}/);
assert.match(webShared, /\}, \[shareId\]\)/);
assert.equal((webShared.match(/fetch\(\`\/api\/results\//g) || []).length, 1, "shared locale switch must not create extra API reads");
assert.match(webShared, /Original advice is preserved/);
console.log("I18N_KO_EN_M3_PROFILE=PASS");
