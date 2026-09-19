#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildSurveyInputContract } from "../packages/shared/src/survey-input-contract.js";

const surveyFlow = await readFile(new URL("../components/onboarding/SurveyFlow.js", import.meta.url), "utf8");
const analyzeRoute = await readFile(new URL("../app/api/analyze/route.js", import.meta.url), "utf8");
const resultPage = await readFile(new URL("../app/result/page.js", import.meta.url), "utf8");
const diagnosisStep = await readFile(new URL("../components/result/free-v2/FreeResultV2DiagnosisStep.jsx", import.meta.url), "utf8");

assert.match(surveyFlow, /id:\s*"primaryConcern"[\s\S]*?required:\s*true/);
assert.match(surveyFlow, /id:\s*"recentSkinChange"[\s\S]*?required:\s*true/);
assert.doesNotMatch(surveyFlow, /id:\s*"recentlyChangedProduct"/);

assert.match(analyzeRoute, /const resolvedPrimaryConcern =/);
assert.match(analyzeRoute, /const prioritizedMainConcerns = resolvedPrimaryConcern/);
assert.match(analyzeRoute, /mainConcerns:\s*prioritizedMainConcerns\.length \? prioritizedMainConcerns : undefined/);

assert.match(resultPage, /function buildFreeSurveyContext\(/);
assert.match(resultPage, /surveyContext:\s*buildFreeSurveyContext\(form, result, locale\)/);
assert.match(diagnosisStep, /FreeResultV2SurveyContextCard/);
assert.match(diagnosisStep, /설문 답변이 이렇게 반영됐어요/);

const futurePremiumCompatible = buildSurveyInputContract({
  skinType: "combination",
  sensitivity: "medium",
  mainConcerns: ["pores", "dehydration"],
  primaryConcern: "pores",
  recentSkinChange: "no",
  recentlyChangedProduct: "yes",
  cleansingFrequency: "twice",
  preferredTexture: "lotion",
  postWashFeeling: "comfortable",
  afternoonSkinChange: "mostly_same",
  mostDislikedFeel: "sticky",
  genderPreference: "unspecified",
  sunscreenPreferenceState: "answered"
});

assert.equal(futurePremiumCompatible.safety.recentlyChangedProduct, "yes");
assert.equal(futurePremiumCompatible.goals.primaryConcern, "pores");

console.log("Free survey decision intake: PASS");
