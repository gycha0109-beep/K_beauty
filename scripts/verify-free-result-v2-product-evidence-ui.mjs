import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { buildProductEvidencePresentationProjection } from "../lib/product-evidence-presentation-contract.js";
import {
  FREE_RESULT_V2_PRODUCT_EVIDENCE_FEATURES,
  buildFreeResultV2ProductEvidenceItems
} from "../lib/free-result-v2-product-evidence.js";

const expectedFeatures = ["eye_sting", "white_cast", "pilling_risk", "finish"];
assert.deepEqual(FREE_RESULT_V2_PRODUCT_EVIDENCE_FEATURES, expectedFeatures);

function projection(featureKey, overrides = {}) {
  return buildProductEvidencePresentationProjection({
    featureKey,
    factRef: `fact:${featureKey}:v1`,
    axisRef: `axis:${featureKey}:v1`,
    knowledgeState: "supported",
    dominantFamily: "official",
    independentSupport: "multiple",
    recency: "current",
    agreement: "consistent",
    evidenceRefs: [`evidence:${featureKey}:1`, `evidence:${featureKey}:2`],
    ...overrides
  });
}

function entry(featureKey, overrides = {}) {
  const built = projection(featureKey, overrides.projectionOverrides);
  return {
    projection: built,
    valueLabel: overrides.valueLabel ?? `${featureKey} canonical value`,
    valueSourceRef: overrides.valueSourceRef ?? built.axisRef
  };
}

const pilot = expectedFeatures.map((featureKey) => entry(featureKey));
const pilotItems = buildFreeResultV2ProductEvidenceItems(pilot, "ko");
assert.deepEqual(pilotItems.map((item) => item.featureKey), expectedFeatures);
assert.equal(pilotItems.every((item) => item.valueSourceRef === `axis:${item.featureKey}:v1`), true);
assert.equal(pilotItems.every((item) => !Object.hasOwn(item, "confidence")), true);

const englishItems = buildFreeResultV2ProductEvidenceItems(pilot, "en");
assert.equal(englishItems.length, 4);
assert.equal(englishItems[0].featureLabel, "Eye sting");

assert.deepEqual(
  buildFreeResultV2ProductEvidenceItems([entry("texture")], "ko"),
  [],
  "features outside the sunscreen pilot must fail closed"
);

assert.deepEqual(
  buildFreeResultV2ProductEvidenceItems([
    entry("eye_sting", { projectionOverrides: { knowledgeState: "evidence_conflict" } })
  ]),
  [],
  "conflict must never become a positive UI assertion"
);

assert.deepEqual(
  buildFreeResultV2ProductEvidenceItems([
    entry("white_cast", { projectionOverrides: { knowledgeState: "evidence_insufficient" } })
  ]),
  [],
  "insufficient evidence must not be presented as a supported product value"
);

assert.deepEqual(
  buildFreeResultV2ProductEvidenceItems([
    {
      projection: projection("pilling_risk"),
      valueLabel: "",
      valueSourceRef: "axis:pilling_risk:v1"
    }
  ]),
  [],
  "a projection without a canonical value label must stay hidden"
);

assert.deepEqual(
  buildFreeResultV2ProductEvidenceItems([
    {
      projection: projection("finish"),
      valueLabel: "canonical finish",
      valueSourceRef: "axis:other:v1"
    }
  ]),
  [],
  "display value must bind to the projection Fact or Axis ref"
);

assert.deepEqual(
  buildFreeResultV2ProductEvidenceItems([
    {
      projection: buildProductEvidencePresentationProjection({
        featureKey: "eye_sting",
        knowledgeState: "supported",
        dominantFamily: "official",
        independentSupport: "multiple",
        recency: "current",
        agreement: "consistent",
        evidenceRefs: []
      }),
      valueLabel: "untraceable value",
      valueSourceRef: "fact:missing:v1"
    }
  ]),
  [],
  "untraceable supported input must stay hidden"
);

const duplicated = buildFreeResultV2ProductEvidenceItems([entry("eye_sting"), entry("eye_sting")]);
assert.equal(duplicated.length, 1, "duplicate feature rows must not stack evidence presentation");

const reviewPattern = projection("eye_sting", {
  factRef: "fact:eye_sting:review:v1",
  axisRef: null,
  dominantFamily: "review_experience",
  independentSupport: "multiple",
  agreement: "consistent"
});
const reviewItems = buildFreeResultV2ProductEvidenceItems([
  {
    projection: reviewPattern,
    valueLabel: "review-bound value",
    valueSourceRef: reviewPattern.factRef
  }
]);
assert.equal(reviewItems.length, 1);
assert.match(reviewItems[0].evidenceCopy, /사용 경험/);

const adapterSource = await readFile(new URL("../lib/free-result-v2-product-evidence.js", import.meta.url), "utf8");
const componentSource = await readFile(new URL("../components/result/free-v2/FreeResultV2ProductEvidence.jsx", import.meta.url), "utf8");
const guideSource = await readFile(new URL("../components/result/free-v2/FreeResultV2RecommendationGuideStep.jsx", import.meta.url), "utf8");
const scoringSource = await readFile(new URL("../lib/recommendation-scoring.ts", import.meta.url), "utf8");
const decisionEngineSource = await readFile(new URL("../lib/skin-match-decision-engine.js", import.meta.url), "utf8");

assert.match(guideSource, /productEvidencePresentation/);
assert.match(guideSource, /FreeResultV2ProductEvidence/);
for (const forbiddenDerivation of [
  "preview.product.eye_sting",
  "preview.product.white_cast",
  "preview.product.pilling_risk",
  "preview.product.finish"
]) {
  assert.equal(guideSource.includes(forbiddenDerivation), false, `UI must not derive evidence from ${forbiddenDerivation}`);
}

for (const forbiddenCopy of ["Confidence", "confidence", "신뢰도", "근거 점수", "Evidence Count", "Source Agreement"]) {
  assert.equal(componentSource.includes(forbiddenCopy), false, `numeric/score-like trust UI is forbidden: ${forbiddenCopy}`);
}

assert.match(componentSource, /if \(!items\.length\) return null/);
assert.match(adapterSource, /recommendationUse !== "explanation_only"/);
assert.match(adapterSource, /valueSourceRef === projection\.factRef \|\| valueSourceRef === projection\.axisRef/);

for (const productionSource of [scoringSource, decisionEngineSource]) {
  assert.equal(productionSource.includes("free-result-v2-product-evidence"), false);
  assert.equal(productionSource.includes("FreeResultV2ProductEvidence"), false);
}

console.log("Free Result V2 Product Evidence UI contract verified.");
