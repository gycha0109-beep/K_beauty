import assert from "node:assert/strict";
import { buildPremiumSessionReportSource } from "../lib/premium-session-payload.js";

const freeResult = { priority: { axis: "barrier" } };
const premiumReport = {
  topPickDetailedReason: "authoritative premium reason",
  supportingProducts: [{ id: "supporting-product" }]
};

const preferred = buildPremiumSessionReportSource({
  premiumReport,
  decision: { topPick: { reason: "ignored fallback" } },
  freeResult
});
assert.equal(preferred.topPickDetailedReason, "authoritative premium reason");
assert.deepEqual(preferred.freeResult, freeResult);

const fallback = buildPremiumSessionReportSource({
  premiumReport: null,
  decision: {
    topPick: { reason: "server decision reason" },
    supportingConcerns: ["barrier"],
    explanationProducts: [{ id: "explained-product" }],
    routineStructure: { type: "barrier_first" },
    photoObservations: { summary: "server observation" },
    morning: ["morning step"],
    night: ["night step"],
    avoid: ["avoid step"],
    altPicks: [{ id: "alternative-product" }]
  },
  freeResult
});
assert.equal(fallback.topPickDetailedReason, "server decision reason");
assert.deepEqual(fallback.supportingProducts, [{ id: "explained-product" }]);
assert.deepEqual(fallback.fullRoutine, { morning: ["morning step"], night: ["night step"] });
assert.deepEqual(fallback.freeResult, freeResult);
assert.equal(
  buildPremiumSessionReportSource({ premiumReport: null, decision: null, freeResult }),
  null
);

console.log("premium session payload boundary verification passed");
