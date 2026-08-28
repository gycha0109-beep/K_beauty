#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  SURVEY_FIELD_SCHEMA,
  SURVEY_INITIAL_FORM,
  SURVEY_INPUT_CONTRACT_VERSION,
  SURVEY_OPTIONAL_DEFAULTS,
  SURVEY_OPTION_SETS,
  SURVEY_VALUE_SETS,
  buildSurveyInputContract,
  normalizeSurveyAnswers
} from "../packages/shared/src/survey-input-contract.js";
import {
  INITIAL_FORM as WEB_INITIAL_FORM,
  OPTIONAL_DEFAULTS as WEB_OPTIONAL_DEFAULTS,
  OPTION_SETS as WEB_OPTION_SETS
} from "../components/onboarding/constants.js";
import { buildSurveyInputContract as buildWebSurveyInputContract } from "../lib/survey-input-contract.js";

const FIXED_TIME = "2026-08-28T00:00:00.000Z";

function legacyNormalizeSurveyAnswers(form = {}) {
  const mainConcerns = Array.isArray(form.mainConcerns)
    ? form.mainConcerns.filter(Boolean)
    : form.mainConcern
      ? [form.mainConcern]
      : [];
  const unknownFlagValues = new Set(["yes", "no", "unknown"]);
  const genderPreferenceValues = new Set(["female", "male", "unspecified"]);
  const sunscreenPreferenceStateValues = new Set(["answered", "skipped", "unknown"]);
  const optionalDefaults = {
    cleansingFrequency: "twice",
    preferredTexture: "lotion",
    postWashFeeling: "comfortable",
    afternoonSkinChange: "mostly_same",
    environmentExposure: [],
    mostDislikedFeel: "sticky",
    genderPreference: "unspecified"
  };

  return {
    ...form,
    mainConcern: form.mainConcern || mainConcerns[0] || "",
    mainConcerns,
    primaryConcern: mainConcerns.includes(form.primaryConcern) ? form.primaryConcern : "",
    recentSkinChange: unknownFlagValues.has(form.recentSkinChange) ? form.recentSkinChange : "unknown",
    recentlyChangedProduct: unknownFlagValues.has(form.recentlyChangedProduct)
      ? form.recentlyChangedProduct
      : "unknown",
    cleansingFrequency: form.cleansingFrequency || optionalDefaults.cleansingFrequency,
    preferredTexture: form.preferredTexture || optionalDefaults.preferredTexture,
    postWashFeeling: form.postWashFeeling || optionalDefaults.postWashFeeling,
    afternoonSkinChange: form.afternoonSkinChange || optionalDefaults.afternoonSkinChange,
    mostDislikedFeel: form.mostDislikedFeel || optionalDefaults.mostDislikedFeel,
    genderPreference: genderPreferenceValues.has(form.genderPreference)
      ? form.genderPreference
      : optionalDefaults.genderPreference,
    whiteCastHate: Boolean(form.whiteCastHate),
    toneUpWanted: Boolean(form.toneUpWanted),
    makeupUse: Boolean(form.makeupUse),
    eyeSensitive: Boolean(form.eyeSensitive),
    sunscreenPreferenceState: sunscreenPreferenceStateValues.has(form.sunscreenPreferenceState)
      ? form.sunscreenPreferenceState
      : "unknown",
    environmentExposure: Array.isArray(form.environmentExposure)
      ? form.environmentExposure
      : optionalDefaults.environmentExposure
  };
}

assert.equal(SURVEY_INPUT_CONTRACT_VERSION, "survey-input-contract-v1");
assert.deepEqual(SURVEY_INITIAL_FORM, WEB_INITIAL_FORM);
assert.deepEqual(SURVEY_OPTIONAL_DEFAULTS, WEB_OPTIONAL_DEFAULTS);
assert.deepEqual(SURVEY_OPTION_SETS, WEB_OPTION_SETS);
assert.deepEqual(SURVEY_VALUE_SETS.skinType, ["oily", "dry", "combination", "not_sure"]);
assert.deepEqual(SURVEY_FIELD_SCHEMA.sunscreenPreferenceState.values, ["answered", "skipped", "unknown"]);

const clientNormalizationFixtures = [
  {
    skinType: "oily",
    sensitivity: "high",
    mainConcern: "acne",
    primaryConcern: "acne",
    recentSkinChange: "invalid",
    recentlyChangedProduct: "yes",
    genderPreference: "invalid",
    whiteCastHate: "",
    toneUpWanted: 1,
    makeupUse: 0,
    eyeSensitive: null,
    sunscreenPreferenceState: "invalid",
    environmentExposure: "mask"
  },
  {
    skinType: "dry",
    sensitivity: "low",
    mainConcerns: ["redness", "acne"],
    primaryConcern: "acne",
    recentSkinChange: "no",
    recentlyChangedProduct: "unknown",
    cleansingFrequency: "once",
    preferredTexture: "cream",
    postWashFeeling: "tight",
    afternoonSkinChange: "more_dry",
    mostDislikedFeel: "greasy",
    genderPreference: "female",
    whiteCastHate: true,
    toneUpWanted: false,
    makeupUse: true,
    eyeSensitive: false,
    sunscreenPreferenceState: "answered",
    environmentExposure: ["heat", "aircon"]
  }
];

for (const fixture of clientNormalizationFixtures) {
  assert.deepEqual(normalizeSurveyAnswers(fixture), legacyNormalizeSurveyAnswers(fixture));
}

const completeInput = {
  skinType: "oily",
  sensitivity: "high",
  mainConcerns: ["acne", "redness", "acne", "invalid"],
  primaryConcern: "redness",
  recentSkinChange: "yes",
  recentlyChangedProduct: "no",
  cleansingFrequency: "twice",
  preferredTexture: "gel",
  postWashFeeling: "tight",
  afternoonSkinChange: "red_or_irritated",
  environmentExposure: ["heat", "mask", "invalid", "heat"],
  mostDislikedFeel: "sticky",
  genderPreference: "female",
  whiteCastHate: true,
  toneUpWanted: false,
  makeupUse: true,
  eyeSensitive: false,
  sunscreenPreferenceState: "answered"
};
const completeContract = buildSurveyInputContract(completeInput, {
  source: "characterization_complete",
  generatedAt: FIXED_TIME
});

assert.deepEqual(completeContract.skinState, {
  skinType: "oily",
  sensitivity: "high",
  postWashFeeling: "tight",
  afternoonSkinChange: "red_or_irritated"
});
assert.deepEqual(completeContract.goals, {
  primaryConcern: "redness",
  secondaryConcerns: ["acne"],
  concernSource: "explicit",
  unresolvedPrimaryConcern: false
});
assert.deepEqual(completeContract.safety, {
  recentSkinChange: "yes",
  recentlyChangedProduct: "no",
  sensitivityRisk: "high",
  drynessRisk: "high",
  rednessRisk: "high"
});
assert.deepEqual(completeContract.behavior, {
  cleansingFrequency: "twice",
  environmentExposure: ["heat", "mask"]
});
assert.deepEqual(completeContract.preferences, {
  preferredTexture: "gel",
  mostDislikedFeel: "sticky"
});
assert.deepEqual(completeContract.sunscreen, {
  whiteCastHate: true,
  toneUpWanted: false,
  makeupUse: true,
  eyeSensitive: false,
  sourceCompleteness: "answered"
});
assert.deepEqual(completeContract.profile, { genderPreference: "female" });
assert.deepEqual(completeContract.metadata, {
  contractVersion: "survey-input-contract-v1",
  generatedAt: FIXED_TIME,
  source: "characterization_complete",
  missingFields: [],
  warnings: ["mainConcerns_invalid_values_excluded", "environmentExposure_invalid_values_excluded"]
});

const fallbackContract = buildSurveyInputContract({
  skinType: "combination",
  sensitivity: "medium",
  mainConcerns: "[\"dehydration\",\"barrier\"]",
  recentSkinChange: "0",
  recentlyChangedProduct: "true",
  cleansingFrequency: "once",
  preferredTexture: "lotion",
  postWashFeeling: "comfortable",
  afternoonSkinChange: "mostly_same",
  environmentExposure: "[\"aircon\",\"outdoor\"]",
  mostDislikedFeel: "heavy",
  genderPreference: "unspecified",
  whiteCastHate: false,
  toneUpWanted: false,
  makeupUse: false,
  eyeSensitive: false,
  sunscreenPreferenceState: "skipped"
}, {
  source: "characterization_fallback",
  generatedAt: FIXED_TIME
});

assert.deepEqual(fallbackContract.goals, {
  primaryConcern: "dehydration",
  secondaryConcerns: ["barrier"],
  concernSource: "fallback_first_selected",
  unresolvedPrimaryConcern: true
});
assert.deepEqual(fallbackContract.safety, {
  recentSkinChange: "no",
  recentlyChangedProduct: "yes",
  sensitivityRisk: "medium",
  drynessRisk: "low",
  rednessRisk: "low"
});
assert.deepEqual(fallbackContract.metadata.missingFields, []);
assert.deepEqual(fallbackContract.metadata.warnings, [
  "primaryConcern_missing_fallback_used",
  "sunscreen_preference_skipped"
]);
assert.equal(fallbackContract.sunscreen.sourceCompleteness, "skipped");

const emptyContract = buildSurveyInputContract({}, {
  source: "characterization_empty",
  generatedAt: FIXED_TIME
});
assert.deepEqual(emptyContract.metadata.missingFields, [
  "skinType",
  "sensitivity",
  "postWashFeeling",
  "afternoonSkinChange",
  "primaryConcern",
  "cleansingFrequency",
  "preferredTexture",
  "mostDislikedFeel",
  "genderPreference",
  "recentSkinChange",
  "recentlyChangedProduct"
]);
assert.deepEqual(emptyContract.metadata.warnings, [
  "primaryConcern_missing",
  "sunscreen_boolean_false_ambiguous"
]);
assert.deepEqual(emptyContract.goals, {
  primaryConcern: null,
  secondaryConcerns: [],
  concernSource: "missing",
  unresolvedPrimaryConcern: true
});

assert.deepEqual(
  buildWebSurveyInputContract(completeInput, { source: "web_facade", generatedAt: FIXED_TIME }),
  buildSurveyInputContract(completeInput, { source: "web_facade", generatedAt: FIXED_TIME })
);

const sharedRuntimeSource = await readFile(
  new URL("../packages/shared/src/survey-input-contract.js", import.meta.url),
  "utf8"
);
const forbiddenImports = [
  /from\s+["']next(?:\/|["'])/,
  /from\s+["']react(?:\/|["'])/,
  /from\s+["']expo(?:-|\/|["'])/,
  /from\s+["']@supabase\//,
  /require\(\s*["'](?:next|react|expo(?:-|\/)|@supabase\/)/,
  /skin-match-decision-engine/,
  /process\.env/,
  /window\./,
  /document\./,
  /node:/
];
for (const forbiddenPattern of forbiddenImports) {
  assert.doesNotMatch(
    sharedRuntimeSource,
    forbiddenPattern,
    `shared survey runtime must remain platform-neutral: ${forbiddenPattern}`
  );
}

const webFacadeSource = await readFile(new URL("../lib/survey-input-contract.js", import.meta.url), "utf8");
assert.match(webFacadeSource, /from "@bejewely\/shared\/survey"/);

const nativeBridgeSource = await readFile(new URL("../apps/mobile/lib/survey-contract.ts", import.meta.url), "utf8");
assert.match(nativeBridgeSource, /from "@bejewely\/shared\/survey"/);
assert.equal(nativeBridgeSource.includes("skin-match-decision-engine"), false);
assert.equal(nativeBridgeSource.includes("supabase"), false);

console.log("Shared survey contract characterization: PASS");
