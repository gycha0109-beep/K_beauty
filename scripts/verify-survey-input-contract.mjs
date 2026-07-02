import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  appendSurveyInputContractDevAuditEvent,
  SURVEY_INPUT_CONTRACT_RUNTIME_AUDIT_EVENTS_FILE
} from "../lib/survey-input-contract-dev-audit.js";
import { buildSurveyInputContract } from "../lib/survey-input-contract.js";

const COMPLETE_FORM = {
  skinType: "combination",
  sensitivity: "medium",
  primaryConcern: "barrier",
  mainConcerns: ["barrier", "redness", "dehydration"],
  postWashFeeling: "comfortable",
  afternoonSkinChange: "mostly_same",
  cleansingFrequency: "twice",
  environmentExposure: ["mask", "aircon"],
  preferredTexture: "lotion",
  mostDislikedFeel: "greasy",
  whiteCastHate: true,
  toneUpWanted: true,
  makeupUse: true,
  eyeSensitive: true,
  sunscreenPreferenceState: "answered",
  genderPreference: "female",
  recentSkinChange: "no",
  recentlyChangedProduct: "yes"
};

function build(form, options = {}) {
  return buildSurveyInputContract(form, {
    generatedAt: "2026-07-02T00:00:00.000Z",
    ...options
  });
}

function hasWarning(contract, warning) {
  return contract.metadata.warnings.includes(warning);
}

function withNodeEnv(value, callback) {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = value;

  try {
    return callback();
  } finally {
    if (previous === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previous;
    }
  }
}

{
  const contract = build(COMPLETE_FORM, { source: "verify" });

  assert.equal(contract.metadata.contractVersion, "survey-input-contract-v1");
  assert.equal(contract.metadata.generatedAt, "2026-07-02T00:00:00.000Z");
  assert.equal(contract.metadata.source, "verify");
  assert.deepEqual(contract.skinState, {
    skinType: "combination",
    sensitivity: "medium",
    postWashFeeling: "comfortable",
    afternoonSkinChange: "mostly_same"
  });
  assert.deepEqual(contract.goals, {
    primaryConcern: "barrier",
    secondaryConcerns: ["redness", "dehydration"],
    concernSource: "explicit",
    unresolvedPrimaryConcern: false
  });
  assert.deepEqual(contract.behavior.environmentExposure, ["mask", "aircon"]);
  assert.equal(contract.sunscreen.sourceCompleteness, "answered");
  assert.equal(hasWarning(contract, "primaryConcern_missing_fallback_used"), false);
  assert.equal(hasWarning(contract, "sunscreen_boolean_false_ambiguous"), false);
  assert.equal(contract.profile.genderPreference, "female");
}

{
  const contract = build(COMPLETE_FORM, { source: "api_analyze_parallel" });

  assert.equal(contract.metadata.source, "api_analyze_parallel");
  assert.equal(Object.hasOwn(contract, "surveyInputContract"), false);
  assert.equal(Object.hasOwn(contract, "contract"), false);
  assert.equal(Object.hasOwn(contract, "debugContract"), false);
}

{
  const auditDir = path.join(process.cwd(), "tmp", "survey-input-contract-runtime-audit-verify");
  rmSync(auditDir, { recursive: true, force: true });

  const contract = build(COMPLETE_FORM, { source: "api_analyze_parallel" });
  const result = withNodeEnv("development", () =>
    appendSurveyInputContractDevAuditEvent(contract, {
      auditDir,
      timestamp: "2026-07-02T00:00:00.000Z",
      hasImage: true,
      requestId: "verify-request"
    })
  );
  const eventsPath = path.join(auditDir, SURVEY_INPUT_CONTRACT_RUNTIME_AUDIT_EVENTS_FILE);
  const event = JSON.parse(readFileSync(eventsPath, "utf8").trim());

  assert.equal(result.ok, true);
  assert.equal(result.skipped, false);
  assert.equal(event.source, "api_analyze_parallel");
  assert.equal(event.primaryConcern, "barrier");
  assert.equal(event.hasImage, true);
  assert.equal(event.requestId, "verify-request");
  assert.equal(Object.hasOwn(event, "genderPreference"), false);
  assert.equal(Object.hasOwn(event, "form"), false);
  assert.equal(Object.hasOwn(event, "image"), false);
}

{
  const auditDir = path.join(process.cwd(), "tmp", "survey-input-contract-runtime-audit-verify-production");
  rmSync(auditDir, { recursive: true, force: true });

  const contract = build(COMPLETE_FORM, { source: "api_analyze_parallel" });
  const result = withNodeEnv("production", () =>
    appendSurveyInputContractDevAuditEvent(contract, {
      auditDir,
      hasImage: true,
      requestId: "verify-production-request"
    })
  );

  assert.equal(result.ok, true);
  assert.equal(result.skipped, true);
  assert.equal(existsSync(auditDir), false);
}

{
  const auditParent = path.join(process.cwd(), "tmp", "survey-input-contract-runtime-audit-verify-error");
  const auditDir = path.join(auditParent, "not-a-directory");
  rmSync(auditParent, { recursive: true, force: true });
  mkdirSync(auditParent, { recursive: true });
  writeFileSync(auditDir, "file blocks directory creation", "utf8");

  const contract = build(COMPLETE_FORM, { source: "api_analyze_parallel" });
  const result = withNodeEnv("development", () =>
    appendSurveyInputContractDevAuditEvent(contract, {
      auditDir,
      hasImage: true
    })
  );

  assert.equal(result.ok, false);
  assert.equal(result.skipped, false);
}

{
  const contract = build({
    ...COMPLETE_FORM,
    sunscreenPreferenceState: undefined,
    primaryConcern: "",
    mainConcerns: ["acne", "pores", "oiliness"]
  });

  assert.equal(contract.goals.primaryConcern, "acne");
  assert.deepEqual(contract.goals.secondaryConcerns, ["pores", "oiliness"]);
  assert.equal(contract.goals.concernSource, "fallback_first_selected");
  assert.equal(contract.goals.unresolvedPrimaryConcern, true);
  assert.equal(hasWarning(contract, "primaryConcern_missing_fallback_used"), true);
}

{
  const contract = build({
    ...COMPLETE_FORM,
    sunscreenPreferenceState: undefined,
    primaryConcern: "",
    mainConcerns: []
  });

  assert.equal(contract.goals.primaryConcern, null);
  assert.deepEqual(contract.goals.secondaryConcerns, []);
  assert.equal(contract.goals.unresolvedPrimaryConcern, true);
  assert.equal(hasWarning(contract, "primaryConcern_missing"), true);
  assert.equal(contract.metadata.missingFields.includes("primaryConcern"), true);
}

{
  const contract = build({
    ...COMPLETE_FORM,
    sunscreenPreferenceState: undefined,
    primaryConcern: "",
    mainConcerns: ["redness", "invalid_concern", "barrier"]
  });

  assert.equal(contract.goals.primaryConcern, "redness");
  assert.deepEqual(contract.goals.secondaryConcerns, ["barrier"]);
  assert.equal(hasWarning(contract, "mainConcerns_invalid_values_excluded"), true);
}

{
  const contract = build({
    ...COMPLETE_FORM,
    sunscreenPreferenceState: undefined,
    whiteCastHate: false,
    toneUpWanted: false,
    makeupUse: false,
    eyeSensitive: false
  });

  assert.deepEqual(
    {
      whiteCastHate: contract.sunscreen.whiteCastHate,
      toneUpWanted: contract.sunscreen.toneUpWanted,
      makeupUse: contract.sunscreen.makeupUse,
      eyeSensitive: contract.sunscreen.eyeSensitive
    },
    {
      whiteCastHate: false,
      toneUpWanted: false,
      makeupUse: false,
      eyeSensitive: false
    }
  );
  assert.equal(contract.sunscreen.sourceCompleteness, "ambiguous_boolean_defaults");
  assert.equal(hasWarning(contract, "sunscreen_boolean_false_ambiguous"), true);
}

{
  const contract = build({
    ...COMPLETE_FORM,
    primaryConcern: "pores",
    mainConcerns: ["acne", "redness"],
    sunscreenPreferenceState: "answered"
  });

  assert.equal(contract.goals.primaryConcern, "acne");
  assert.deepEqual(contract.goals.secondaryConcerns, ["redness"]);
  assert.equal(contract.goals.concernSource, "fallback_first_selected");
  assert.equal(contract.goals.unresolvedPrimaryConcern, true);
  assert.equal(hasWarning(contract, "primaryConcern_invalid_excluded"), true);
  assert.equal(hasWarning(contract, "primaryConcern_missing_fallback_used"), true);
}

{
  const answered = build({
    ...COMPLETE_FORM,
    whiteCastHate: false,
    toneUpWanted: false,
    makeupUse: false,
    eyeSensitive: false,
    sunscreenPreferenceState: "answered"
  });
  const skipped = build({
    ...COMPLETE_FORM,
    sunscreenPreferenceState: "skipped"
  });

  assert.equal(answered.sunscreen.sourceCompleteness, "answered");
  assert.equal(hasWarning(answered, "sunscreen_boolean_false_ambiguous"), false);
  assert.equal(skipped.sunscreen.sourceCompleteness, "skipped");
  assert.equal(hasWarning(skipped, "sunscreen_preference_skipped"), true);
}

{
  const yesNo = build({
    ...COMPLETE_FORM,
    recentSkinChange: "yes",
    recentlyChangedProduct: "no"
  });
  const unknowns = build({
    ...COMPLETE_FORM,
    recentSkinChange: "unknown",
    recentlyChangedProduct: "unknown"
  });

  assert.equal(yesNo.safety.recentSkinChange, "yes");
  assert.equal(yesNo.safety.recentlyChangedProduct, "no");
  assert.equal(unknowns.safety.recentSkinChange, "unknown");
  assert.equal(unknowns.safety.recentlyChangedProduct, "unknown");
}

{
  const contract = build({
    ...COMPLETE_FORM,
    sensitivity: "high",
    primaryConcern: "",
    mainConcerns: ["redness", "barrier"]
  });

  assert.equal(contract.safety.sensitivityRisk, "high");
  assert.equal(contract.safety.rednessRisk, "high");
}

{
  const contract = build({
    ...COMPLETE_FORM,
    postWashFeeling: "tight",
    afternoonSkinChange: "more_dry"
  });

  assert.equal(contract.safety.drynessRisk, "high");
}

{
  const contract = build(COMPLETE_FORM);

  assert.equal(contract.profile.genderPreference, "female");
  assert.equal(Object.hasOwn(contract, "genderPreference"), false);
  assert.equal(Object.hasOwn(contract.goals, "genderPreference"), false);
  assert.equal(Object.hasOwn(contract.safety, "genderPreference"), false);
  assert.equal(Object.hasOwn(contract.behavior, "genderPreference"), false);
}

{
  const contract = build({
    ...COMPLETE_FORM,
    recentSkinChange: undefined,
    recentlyChangedProduct: undefined
  });

  assert.equal(contract.safety.recentSkinChange, "unknown");
  assert.equal(contract.safety.recentlyChangedProduct, "unknown");
  assert.equal(contract.metadata.missingFields.includes("recentSkinChange"), true);
  assert.equal(contract.metadata.missingFields.includes("recentlyChangedProduct"), true);
}

{
  const fromString = build({
    ...COMPLETE_FORM,
    environmentExposure: "outdoor"
  });
  const fromArray = build({
    ...COMPLETE_FORM,
    environmentExposure: ["heat", "invalid_environment", "mask"]
  });
  const fromNull = build({
    ...COMPLETE_FORM,
    environmentExposure: null
  });

  assert.deepEqual(fromString.behavior.environmentExposure, ["outdoor"]);
  assert.deepEqual(fromArray.behavior.environmentExposure, ["heat", "mask"]);
  assert.equal(hasWarning(fromArray, "environmentExposure_invalid_values_excluded"), true);
  assert.deepEqual(fromNull.behavior.environmentExposure, []);
}

console.log("verify-survey-input-contract: ok");
