import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  preserveReportNarrative,
  preserveReportRoutineSteps,
  reportDisplayText
} from "../lib/full-report-locale-fidelity.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const web = readFileSync(join(root, "app/result/full-report/page.js"), "utf8");

const source = {
  topPickDetailedReason: "자극을 줄이기 위해 다른 액티브는 보류합니다.",
  fullRoutine: {
    morning: ["물 세안만 유지"],
    night: ["저녁 각질 제거는 주 2회 이하"],
    morningSteps: [{
      order: 1,
      stepName: "아침 관리",
      productRole: "클렌저",
      instruction: "피부 상태가 괜찮을 때만 사용",
      frequency: "필요할 때만",
      caution: "자극 시 즉시 보류"
    }],
    nightSteps: [{
      order: 2,
      instruction: { ko: "주 2회 사용", en: "Use twice per week" },
      frequency: { ko: "주 2회", en: "Twice per week" },
      caution: { ko: "붉어지면 중단", en: "Stop if redness appears" }
    }]
  },
  routineVariants: [{ key: "sensitive_day", items: ["각질 제거 보류"] }],
  avoidCombinations: ["레티놀 + 강한 각질 제거제"]
};
const before = structuredClone(source);
const output = preserveReportNarrative(source, "en");

assert.deepEqual(source, before, "rendering must not mutate authoritative report");
assert.equal(output.topPickDetailedReason, before.topPickDetailedReason);
assert.deepEqual(output.fullRoutine.morning, before.fullRoutine.morning);
assert.deepEqual(output.fullRoutine.night, before.fullRoutine.night);
assert.deepEqual(output.routineVariants, before.routineVariants);
assert.deepEqual(output.avoidCombinations, before.avoidCombinations);
assert.deepEqual(preserveReportNarrative({}, "en").routineVariants, [], "missing narratives must not be invented");
assert.deepEqual(preserveReportNarrative({}, "en").avoidCombinations, [], "missing cautions must not be invented");

const [morningStep] = preserveReportRoutineSteps(source.fullRoutine.morningSteps, [], "morning", "en");
assert.equal(morningStep.frequency, "필요할 때만", "must not rewrite conditional frequency as daily");
assert.equal(morningStep.caution, "자극 시 즉시 보류", "must keep source stop warning");
assert.equal(morningStep.instruction, "피부 상태가 괜찮을 때만 사용");
assert.equal(morningStep.order, 1);
const [nightStep] = preserveReportRoutineSteps(source.fullRoutine.nightSteps, [], "night", "en");
assert.equal(nightStep.frequency, "Twice per week");
assert.equal(nightStep.instruction, "Use twice per week");
assert.equal(nightStep.caution, "Stop if redness appears");
assert.equal(nightStep.order, 2);
assert.equal(reportDisplayText({ ko: "보류", en: "Hold" }, "en"), "Hold");
assert.equal(reportDisplayText({ ko: "보류" }, "en"), "보류");
assert.equal(reportDisplayText("주 2회", "en"), "주 2회");
assert.deepEqual(source, before, "nested source step data must remain unchanged");

const [fallback] = preserveReportRoutineSteps([], ["밤 사용 금지"], "night", "en");
assert.equal(fallback.instruction, "밤 사용 금지");
assert.equal(fallback.frequency, "");
assert.equal(fallback.caution, "");

const englishBranch = web.split("function localizeFullReportForLocale(")[1]?.split("function TopPickHeroCard(")[0] || "";
const stepAdapter = web.split("function localizeRoutineStepsForEnglish(")[1]?.split("function localizeRoutineStepsForKorean(")[0] || "";
const reasonBlocks = web.split("function buildTopPickReasonBlocks(")[1]?.split("function getTopPickOperationLabels(")[0] || "";
assert.ok(englishBranch.includes('preserveReportNarrative(report, "en")'));
assert.ok(englishBranch.includes("sourceNarrative.fullRoutine"));
assert.ok(!englishBranch.includes("buildEnglishRoutineVariants(result)"));
assert.ok(!englishBranch.includes("buildEnglishAvoidCombinations(result)"));
assert.ok(!englishBranch.includes('morning: ["Start with a light, repeatable'));
assert.ok(stepAdapter.includes("preserveReportRoutineSteps("));
assert.ok(!stepAdapter.includes("Every morning"));
assert.ok(!stepAdapter.includes("buildEnglishRoutineInstruction"));
assert.ok(!stepAdapter.includes("buildEnglishRoutineCaution"));
assert.ok(reasonBlocks.includes('if (locale === "en")'));
assert.ok(reasonBlocks.includes('addBlock("why", whySentences.join(" "));'));
assert.ok(!reasonBlocks.includes('locale !== "en" || !hasKoreanText(block.body)'));
console.log("I18N_KO_EN_M2_FIDELITY=PASS");
