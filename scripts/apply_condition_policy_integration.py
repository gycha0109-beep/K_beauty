from pathlib import Path

p = Path(__file__).resolve().parents[1] / "lib/shared-skin-decision-context.js"
s = p.read_text(encoding="utf-8")

if "shared-skin-decision-context-v3" not in s:
    s = s.replace('const CONTEXT_VERSION = "shared-skin-decision-context-v2";', 'const CONTEXT_VERSION = "shared-skin-decision-context-v3";', 1)

if "function buildConditionSignalState" not in s:
    marker = "function buildEvidenceLedger("
    index = s.find(marker)
    if index < 0:
        raise RuntimeError("buildEvidenceLedger marker missing")
    helper = '''function yesNoUnknown(value) {
  const normalized = normalizeText(value).toLowerCase();
  if (value === true || ["yes", "true", "1"].includes(normalized)) return "yes";
  if (value === false || ["no", "false", "0"].includes(normalized)) return "no";
  return "unknown";
}

function buildConditionSignalState(surveyAnswers = {}) {
  const afternoon = normalizeText(surveyAnswers.afternoonSkinChange).toLowerCase();
  const postWash = normalizeText(surveyAnswers.postWashFeeling).toLowerCase();
  const breakoutIncrease = yesNoUnknown(surveyAnswers.breakoutIncrease || surveyAnswers.recentBreakoutIncrease);
  const flakingIncrease = yesNoUnknown(surveyAnswers.flakingIncrease || surveyAnswers.recentFlakingIncrease);
  const productReaction = yesNoUnknown(surveyAnswers.productReaction || surveyAnswers.recentProductReaction);
  const recentSkinChange = yesNoUnknown(surveyAnswers.recentSkinChange);
  const recentProductChange = yesNoUnknown(surveyAnswers.recentlyChangedProduct);
  const knownCount = [
    afternoon,
    postWash,
    breakoutIncrease,
    flakingIncrease,
    productReaction,
    recentSkinChange,
    recentProductChange
  ].filter((value) => value && value !== "unknown").length;

  return {
    rednessOrIrritation: afternoon === "red_or_irritated" ? "yes" : afternoon ? "no" : "unknown",
    drynessOrTightness: postWash === "tight" || afternoon === "more_dry" ? "yes" : postWash || afternoon ? "no" : "unknown",
    oilinessIncrease: afternoon === "more_oily" ? "yes" : afternoon ? "no" : "unknown",
    breakoutIncrease,
    flakingIncrease,
    productReaction,
    recentSkinChange,
    recentProductChange,
    completeness: knownCount >= 4 ? "complete" : knownCount ? "partial" : "minimal"
  };
}

'''
    s = s[:index] + helper + s[index:]

s = s.replace(
    "function buildEvidenceLedger({ priority, concernScores, productExposureState, safetyState, routineBurdenState })",
    "function buildEvidenceLedger({ priority, concernScores, productExposureState, safetyState, routineBurdenState, conditionSignalState })",
    1
)
if 'key: "condition_signals"' not in s:
    s = s.replace(
        '{ key: "routine_burden", source: "shared_context", value: routineBurdenState }',
        '{ key: "routine_burden", source: "shared_context", value: routineBurdenState },\n    { key: "condition_signals", source: "survey", value: conditionSignalState }',
        1
    )
if "const conditionSignalState = buildConditionSignalState" not in s:
    s = s.replace(
        "  const environmentState = buildEnvironmentState(surveyAnswers);",
        "  const environmentState = buildEnvironmentState(surveyAnswers);\n  const conditionSignalState = buildConditionSignalState(surveyAnswers);",
        1
    )
if "    conditionSignalState,\n    photoObservations" not in s:
    s = s.replace("    environmentState,\n    photoObservations", "    environmentState,\n    conditionSignalState,\n    photoObservations", 1)
if "    conditionSignalState,\n    evidenceLedger" not in s:
    s = s.replace("    environmentState,\n    evidenceLedger", "    environmentState,\n    conditionSignalState,\n    evidenceLedger", 1)
if "      conditionSignalState\n    })" not in s:
    s = s.replace("      safetyState,\n      routineBurdenState\n    })", "      safetyState,\n      routineBurdenState,\n      conditionSignalState\n    })", 1)

required = [
    "shared-skin-decision-context-v3",
    "function buildConditionSignalState",
    "const conditionSignalState = buildConditionSignalState",
    "conditionSignalState,\n    evidenceLedger",
    'key: "condition_signals"'
]
missing = [item for item in required if item not in s]
if missing:
    raise RuntimeError(f"shared context patch incomplete: {missing}")

p.write_text(s, encoding="utf-8")
