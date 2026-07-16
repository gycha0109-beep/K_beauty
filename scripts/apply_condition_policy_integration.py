from pathlib import Path

p = Path(__file__).resolve().parents[1] / "lib/shared-skin-decision-context.js"
s = p.read_text(encoding="utf-8")

def once(old, new):
    global s
    if s.count(old) != 1:
        raise RuntimeError(f"shared context match count {s.count(old)} for {old[:60]!r}")
    s = s.replace(old, new, 1)

once('const CONTEXT_VERSION = "shared-skin-decision-context-v2";', 'const CONTEXT_VERSION = "shared-skin-decision-context-v3";')

marker = 'function buildEvidenceLedger({ priority, concernScores, productExposureState, safetyState, routineBurdenState }) {'
insert = '''function yesNoUnknown(value) {
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
  const knownCount = [afternoon, postWash, breakoutIncrease, flakingIncrease, productReaction]
    .filter((value) => value && value !== "unknown").length;

  return {
    rednessOrIrritation: afternoon === "red_or_irritated" ? "yes" : afternoon ? "no" : "unknown",
    drynessOrTightness: postWash === "tight" || afternoon === "more_dry" ? "yes" : postWash || afternoon ? "no" : "unknown",
    oilinessIncrease: afternoon === "more_oily" ? "yes" : afternoon ? "no" : "unknown",
    breakoutIncrease,
    flakingIncrease,
    productReaction,
    recentSkinChange: yesNoUnknown(surveyAnswers.recentSkinChange),
    recentProductChange: yesNoUnknown(surveyAnswers.recentlyChangedProduct),
    completeness: knownCount >= 4 ? "complete" : knownCount ? "partial" : "minimal"
  };
}

function buildEvidenceLedger({ priority, concernScores, productExposureState, safetyState, routineBurdenState, conditionSignalState }) {'''
once(marker, insert)
once('    { key: "routine_burden", source: "shared_context", value: routineBurdenState }\n', '    { key: "routine_burden", source: "shared_context", value: routineBurdenState },\n    { key: "condition_signals", source: "survey", value: conditionSignalState }\n')
once('  const environmentState = buildEnvironmentState(surveyAnswers);\n', '  const environmentState = buildEnvironmentState(surveyAnswers);\n  const conditionSignalState = buildConditionSignalState(surveyAnswers);\n')
once('    environmentState,\n    photoObservations\n', '    environmentState,\n    conditionSignalState,\n    photoObservations\n')
once('    environmentState,\n    evidenceLedger: buildEvidenceLedger({\n', '    environmentState,\n    conditionSignalState,\n    evidenceLedger: buildEvidenceLedger({\n')
once('      safetyState,\n      routineBurdenState\n', '      safetyState,\n      routineBurdenState,\n      conditionSignalState\n')
p.write_text(s, encoding="utf-8")
