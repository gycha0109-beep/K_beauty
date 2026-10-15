import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const path = "lib/skin-observation-projector.js";
const text = readFileSync(path, "utf8");
const start = text.indexOf("function buildAlignment(");
const end = text.indexOf("\n}\n", start);
assert(start >= 0 && end > start && end - start < 4000, "bounded existing alignment function required");

const evalFn = runInNewContext("(" + text.slice(start, end + 2) + ")", {
  getPrimaryConcern: (input = {}) => input.primaryConcern || input.mainConcern || input.mainConcerns?.[0] || null,
  getCopy: () => ({ alignment: { aligned: "aligned", mixed: "mixed", conflict: "conflict", unknown: "unknown" } }),
  Number,
  Math,
  Array
});
const base = (value, confidence = "medium", key = "redness") => ({
  status: "available",
  signals: { redness: value },
  observations: [{ key, confidence }]
});
const decision = skin => evalFn(skin, { primaryConcern: "redness" }, "ko");
assert.equal(decision(base(5)).status, "aligned", "well supported high score remains aligned");
assert.equal(decision(base(3, "high")).status, "aligned");
assert.equal(decision(base(2, "medium")).status, "mixed");
assert.equal(decision(base(1, "high")).status, "conflict", "reliably observed low signal may disagree");
assert.equal(decision(base(0, "high")).status, "conflict", "observed low is not unobserved");
assert.equal(decision(base(5, "low")).status, "unknown", "low confidence cannot assert alignment");
assert.equal(decision(base(0, "low")).status, "unknown", "unreliable zero is not survey conflict");
assert.equal(decision(base(5, "unknown")).status, "unknown");
assert.equal(decision(base(5, "medium", "pores")).status, "unknown", "other-axis cue is not concern evidence");
assert.equal(decision({ status: "available", signals: { redness: 5 }, observations: [] }).status, "unknown");
assert.equal(decision({ status: "available", signals: {}, observations: [{ key: "redness", confidence: "high" }] }).status, "unknown", "missing numeric signal is unknown");
assert.equal(decision({ status: "available", signals: { redness: "5" }, observations: [{ key: "redness", confidence: "high" }] }).status, "unknown", "do not convert malformed score to positive");
assert.equal(decision({ status: "insufficient_evidence", signals: { redness: 5 }, observations: [{ key: "redness", confidence: "high" }] }).status, "unknown");
assert.equal(evalFn(base(5), {}, "ko").status, "unknown", "no survey concern means unknown");
assert.equal(text.includes("signals: { ...skin.signals }"), true, "photo score carrier is unchanged");
assert.equal(text.includes("imageEligibility: eligibility"), true, "global eligibility remains unchanged");
console.log("verify-face-lab-skin-s0-alignment-evidence: PASS (synthetic no-photo-sending)");
