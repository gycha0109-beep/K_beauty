import assert from "node:assert/strict";
import fs from "node:fs";

import { buildSharedSkinDecisionContext } from "../../lib/shared-skin-decision-context-v4.js";
import {
  EXFOLIATION_NORMATIVE_POLICY_SKIN_MATCH_CONTEXT_ADAPTER_VERSION,
  buildExfoliationNormativePolicySkinMatchContext
} from "../../lib/exfoliation-normative-policy-skin-match-context-adapter.js";

function makeReport({ pores = 47, barrier = 20, currentProducts = null } = {}) {
  return {
    freeResult: {
      answers: {
        skinType: "oily",
        sensitivity: "low",
        primaryConcern: "pores",
        mainConcerns: ["pores"],
        recentSkinChange: "no",
        recentlyChangedProduct: "no",
        postWashFeeling: "comfortable",
        afternoonSkinChange: "mostly_same",
        cleansingFrequency: "twice"
      },
      priority: { axis: "pores", score: pores },
      scoring: {
        concernScores: {
          pores,
          barrier,
          oiliness: 12,
          redness: 2,
          acne: 3,
          dehydration: 0
        }
      }
    },
    currentProducts
  };
}

function activeCurrentProducts() {
  return {
    selections: [
      {
        status: "selected",
        productId: "v21-9i-active-current-product",
        category: "treatment",
        productSnapshot: {
          id: "v21-9i-active-current-product",
          category: "treatment",
          irritation_risk: "low",
          sensitivity_safe: true,
          ingredient_signals: {
            functional: [{ label: "whitening", count: 1 }]
          }
        }
      }
    ]
  };
}

const legacyAuto = buildSharedSkinDecisionContext(makeReport()).context;
assert.equal(legacyAuto.skinState.concernScores.pores, 47);
assert.deepEqual(legacyAuto.safetyState.highSensitiveAxes, []);
assert.equal(legacyAuto.safetyState.sensitiveBurden, false);

const rawAboveForty = buildExfoliationNormativePolicySkinMatchContext(makeReport());
assert.equal(rawAboveForty.skinState.concernScores.pores, 47);
assert.deepEqual(rawAboveForty.safetyState.highSensitiveAxes, ["barrier"]);
assert.equal(rawAboveForty.safetyState.sensitiveBurden, true);
assert.equal(rawAboveForty.metadata.concernScoreScale, "skin_match_raw");
assert.equal(
  rawAboveForty.metadata.adapterVersion,
  EXFOLIATION_NORMATIVE_POLICY_SKIN_MATCH_CONTEXT_ADAPTER_VERSION
);

const rawBelowForty = buildExfoliationNormativePolicySkinMatchContext(
  makeReport({ pores: 39, barrier: 20 })
);
assert.deepEqual(rawBelowForty.safetyState.highSensitiveAxes, ["barrier"]);
assert.equal(rawBelowForty.safetyState.sensitiveBurden, true);

const rawBelowBoundary = buildExfoliationNormativePolicySkinMatchContext(
  makeReport({ pores: 80, barrier: 17 })
);
assert.equal(rawBelowBoundary.safetyState.highSensitiveAxes.includes("barrier"), false);

const rawAtBoundary = buildExfoliationNormativePolicySkinMatchContext(
  makeReport({ pores: 80, barrier: 18 })
);
assert.equal(rawAtBoundary.safetyState.highSensitiveAxes.includes("barrier"), true);

const activeLegacy = buildSharedSkinDecisionContext(
  makeReport({ currentProducts: activeCurrentProducts() })
).context;
const activeRaw = buildExfoliationNormativePolicySkinMatchContext(
  makeReport({ currentProducts: activeCurrentProducts() })
);
assert.equal(activeLegacy.productExposureState.activeExposurePresent, true);
assert.equal(activeLegacy.safetyState.level, "stable");
assert.equal(activeRaw.productExposureState.activeExposurePresent, true);
assert.equal(activeRaw.safetyState.activeBurden, true);
assert.equal(activeRaw.safetyState.level, "stabilize_first");
assert.equal(
  activeRaw.evidenceLedger.find((row) => row.key === "safety_level")?.value,
  "stabilize_first"
);

const observerSource = fs.readFileSync(
  new URL("../../lib/exfoliation-normative-policy-production-shadow-observer.js", import.meta.url),
  "utf8"
);
assert.match(observerSource, /buildExfoliationNormativePolicySkinMatchContext/);
assert.doesNotMatch(observerSource, /buildSharedSkinDecisionContext\s*\(/);

console.log(
  JSON.stringify(
    {
      verifier: "v21-9i-shared-context-score-scale-v1",
      adapterVersion: EXFOLIATION_NORMATIVE_POLICY_SKIN_MATCH_CONTEXT_ADAPTER_VERSION,
      legacyAutoBehaviorPreserved: true,
      rawScoreAboveFortyDiscontinuityRemoved: true,
      existingHighBoundary: 18,
      activeBurdenBoundaryValidated: true,
      observerUsesRawScoreAdapter: true,
      status: "PASS"
    },
    null,
    2
  )
);
