#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import {
  SUNSCREEN_ACTIVATION_REDESIGN_VERSION,
  SUNSCREEN_RECOMMENDATION_SEMANTIC_BUNDLE_VERSION,
  SUNSCREEN_INITIAL_ADMISSION_POLICY_VERSION,
  SUNSCREEN_REQUIRED_SEMANTIC_FIELDS,
  evaluateSunscreenActivationRedesign
} from "../lib/sunscreen-activation-redesign.mjs";

const path =
  "evidence/product-fact-catalog-expansion-v1/data-ai29c-d-r1-staged-sunscreen-activation-redesign-v1.json";
const snapshot = JSON.parse(fs.readFileSync(path, "utf8"));
const result = evaluateSunscreenActivationRedesign(snapshot);

assert.equal(
  SUNSCREEN_ACTIVATION_REDESIGN_VERSION,
  "data-ai29c-d-r1-staged-sunscreen-activation-redesign-v1",
);
assert.equal(
  SUNSCREEN_RECOMMENDATION_SEMANTIC_BUNDLE_VERSION,
  "sunscreen-recommendation-semantic-bundle-v1",
);
assert.equal(
  SUNSCREEN_INITIAL_ADMISSION_POLICY_VERSION,
  "sunscreen-initial-admission-grant-policy-v1",
);

assert.deepEqual(SUNSCREEN_REQUIRED_SEMANTIC_FIELDS, [
  "category",
  "skin_types",
  "concerns",
  "texture",
  "finish",
  "sensitivity_safe",
  "irritation_risk",
  "tone_up",
  "white_cast",
  "eye_sting",
  "pilling_risk"
]);

assert.equal(result.protectionAxisReady, true);
assert.deepEqual(result.readyProtectionAxes, ["spf", "uva"]);
assert.equal(result.waterRequiredForSpfUvaProgression, false);
assert.equal(result.waterActivationReady, false);
assert.equal(result.genericAdmissionSupportsSunscreen, false);

assert.equal(result.primaryProductCount, 5);
assert.equal(result.semanticBundleReadyCount, 0);
assert.equal(result.uvFilterReadyCount, 3);
assert.ok(
  result.products.every((product) => product.protectionFactsReady === true),
);
assert.ok(
  result.products.every(
    (product) => product.missingRawSemanticFields.length === 11,
  ),
);

assert.equal(result.stages.D0, "PASS");
assert.equal(result.stages.D1, "BLOCKED_DATA_ENRICHMENT");
assert.equal(result.stages.D2, "BLOCKED_BY_D1");
assert.equal(result.stages.D3, "BLOCKED_BY_D2");
assert.equal(result.stages.D4, "BLOCKED_BY_D3");
assert.equal(result.stages.D5, "NOT_AUTHORIZED");

assert.equal(result.overall, "BLOCKED_BEFORE_INTEGRATED_SHADOW");
assert.deepEqual(result.blockers, [
  "C6_PRIMARY_RECOMMENDATION_SEMANTICS_NOT_REVIEWED",
  "C6_PRIMARY_UV_FILTER_TYPE_INCOMPLETE",
  "SUNSCREEN_INITIAL_ADMISSION_AUTHORITY_NOT_DEFINED",
  "SUNSCREEN_RECOMMENDATION_SEMANTIC_AUTHORITY_NOT_ESTABLISHED"
]);
assert.equal(
  result.nextStage,
  "DATA-AI29C-D1-SUNSCREEN-SEMANTIC-AUTHORITY",
);
assert.ok(Object.values(result.limits).every((value) => value === false));

assert.equal(snapshot.activation_policy.axis_specific, true);
assert.equal(snapshot.activation_policy.spf_uva_may_progress_without_water, true);
assert.equal(snapshot.activation_policy.water_independent_hold, true);
assert.equal(snapshot.integrated_shadow_acceptance.rejected_candidate_resurrection_forbidden, true);
assert.equal(snapshot.semantic_authority.product_column_write_required, false);
assert.equal(snapshot.semantic_authority.projection_only, true);

console.log("DATA_AI29C_D_R1_STAGED_ACTIVATION_REDESIGN=PASS");
console.log("D0=PASS D1=BLOCKED_DATA_ENRICHMENT next=D1-semantic-authority");
