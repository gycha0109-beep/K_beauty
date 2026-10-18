import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { projectSavedPremiumCanonicalSections } from "../../../apps/mobile/features/reports/saved-premium-canonical-projection.ts";

// Research synthetic only; no private saved report, account, network, photo or scoring.
const example = {
  routinePlan: {
    morningSteps: [{ order: 1, title: "Cleanser", status: "Fixed", action: "Use the saved amount.", adjustment: "Pause on discomfort" }],
    nightSteps: [{ order: 1, title: "Moisturizer", status: "Fixed", action: "Use after cleansing." }]
  },
  functionalPlan: {
    planMode: "HOLD",
    primaryConcern: "Redness",
    planSummary: "Maintain the existing gentle routine.",
    whyPriority: "Saved audit note",
    direction: "Avoid adding active products.",
    baseApproach: "Continue the baseline."
  },
  conditionPlan: {
    responses: [
      { responseKey: "c1", status: "reduce", title: "Irritation", summary: "Reduce intensity.", reasons: ["Saved reason"], action: "Pause new actives." },
      { responseKey: "c2", status: "not_evaluated", title: "Unsupported", summary: "Must not promote." }
    ],
    globalNotice: "Use the saved plan only."
  },
  // Legacy values must never override canonical saved judgments.
  fullRoutine: {summary: "Conflicting legacy routine"},
  functionalDecisions: [{title: "START now"}],
  conditionResponses: [{title: "Legacy maintain"}]
};
const input = JSON.parse(JSON.stringify(example));
const projected = projectSavedPremiumCanonicalSections(example, "en");
assert.deepEqual(example, input, "read-only adapter must not mutate original payload");
assert.deepEqual(projectSavedPremiumCanonicalSections(example, "en"), projected);
assert.equal(projected.routine.canonicalPresent, true);
assert(projected.routine.lines.some(x => x.includes("Morning · Cleanser") && x.includes("Use the saved amount.")));
assert(projected.routine.lines.some(x => x.includes("Evening · Moisturizer")));
assert(projected.functional.lines.some(x => x.includes("Plan status · HOLD")));
assert(!projected.functional.lines.some(x => x.includes("START now")));
assert(projected.condition.lines.some(x => x.includes("Reduce · Irritation")));
assert(!projected.condition.lines.some(x => x.includes("Unsupported")));
assert(projected.condition.lines.some(x => x.includes("Notice · Use the saved plan only.")));
assert(!JSON.stringify(projected).includes("Conflicting legacy"));

const nested = projectSavedPremiumCanonicalSections({decisionBundle: {
  routinePlan: example.routinePlan, functionalPlan: example.functionalPlan,
  conditionPlan: example.conditionPlan
}}, "ko");
assert(nested.routine.lines.some(x => x.includes("아침 · Cleanser")));
assert(nested.functional.lines.some(x => x.includes("실행 상태 · HOLD")));
assert(nested.condition.lines.some(x => x.includes("강도 줄이기 · Irritation")));

// Canonical absence must allow the old saved report path; malformed canonical
// presence must never be replaced with possibly contradictory legacy advice.
const legacy = projectSavedPremiumCanonicalSections({fullRoutine: {summary:"legacy"}}, "ko");
assert.equal(legacy.routine.canonicalPresent, false);
assert.equal(legacy.functional.canonicalPresent, false);
assert.equal(legacy.condition.canonicalPresent, false);
const emptyCanonical = projectSavedPremiumCanonicalSections({
  routinePlan: { morningSteps: [{ title:"Incomplete" }] },
  functionalPlan: { planMode:"UNKNOWN", planSummary: 45 },
  conditionPlan: { responses: [{status:"maintain",title:"Missing summary"}] }
}, "en");
assert.deepEqual(emptyCanonical.routine, { canonicalPresent: true, lines: [] });
assert.deepEqual(emptyCanonical.functional, { canonicalPresent: true, lines: [] });
assert.deepEqual(emptyCanonical.condition, { canonicalPresent: true, lines: [] });

const excessive = projectSavedPremiumCanonicalSections({routinePlan: {
  morningSteps: Array.from({length:100},(_,i)=>({title:"T"+i,action:"x".repeat(3000)})),
  nightSteps: Array.from({length:100},(_,i)=>({title:"N"+i,action:"safe"}))
}}, "en");
assert.equal(excessive.routine.lines.length, 12);
assert(excessive.routine.lines.every(x => x.length < 800));
assert.deepEqual(projectSavedPremiumCanonicalSections(null,"en"), {
  routine:{canonicalPresent:false,lines:[]},functional:{canonicalPresent:false,lines:[]},condition:{canonicalPresent:false,lines:[]}
});

const component = readFileSync("apps/mobile/features/reports/NativeSavedReport.tsx","utf8");
assert(component.includes('import { projectSavedPremiumCanonicalSections } from "./saved-premium-canonical-projection";'));
assert(component.includes('const canonical = projectSavedPremiumCanonicalSections(report, locale);'));
assert(component.includes('canonical.routine.canonicalPresent'));
assert(component.includes('canonical.functional.canonicalPresent'));
assert(component.includes('canonical.condition.canonicalPresent'));
assert(component.includes('collectDisplayLines(report.fullRoutine, 10)'));
assert(component.includes('collectDisplayLines(report.functionalDecisions, 10)'));
assert(component.includes('collectDisplayLines(report.conditionResponses, 10)'));
assert(component.includes('canonicalUnavailable'));
assert(!component.includes('fetch('), "display only, no new server calls");
console.log("verify-face-lab-skin-s4-canonical-saved-projection: PASS (canonical-first, legacy compat, HOLD/no inference, bounded)");
