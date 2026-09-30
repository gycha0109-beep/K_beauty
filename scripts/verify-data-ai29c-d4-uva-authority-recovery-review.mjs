#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  SUNSCREEN_UVA_AUTHORITY_RECOVERY_REVIEW_VERSION,
  evaluateUvaAuthorityRecoveryReview,
} from "../lib/sunscreen-uva-authority-recovery-review.mjs";

const legacy = JSON.parse(
  fs.readFileSync(
    "fixtures/data-ai29c-d3r2-legacy-sunscreen-runtime-v1.json",
    "utf8",
  ),
);
const d2 = JSON.parse(
  fs.readFileSync(
    "fixtures/data-ai29c-d2-sunscreen-initial-admission-v1.json",
    "utf8",
  ),
);
const d1b = JSON.parse(
  fs.readFileSync(
    "fixtures/data-ai29c-d1b-sunscreen-semantic-projection-v1.json",
    "utf8",
  ),
);
const recovery = JSON.parse(
  fs.readFileSync(
    "fixtures/data-ai29c-d3r3-semantic-authority-recovery-v1.json",
    "utf8",
  ),
);
const protection = JSON.parse(
  fs.readFileSync(
    "evidence/product-fact-catalog-expansion-v1/data-ai29c-c6g-prospective-protection-shadow-input-v1.json",
    "utf8",
  ),
);
const uvaReview = JSON.parse(
  fs.readFileSync(
    "fixtures/data-ai29c-d4-uva-authority-recovery-review-v1.json",
    "utf8",
  ),
);
const p18 = JSON.parse(
  fs.readFileSync(
    "evidence/product-fact-adoption-v1/trust-p18-skin1004-uv-us-spf-hosted-adoption-plan-v1.json",
    "utf8",
  ),
);

const result = evaluateUvaAuthorityRecoveryReview({
  legacyProducts: legacy.products,
  authorityRows: d2.products,
  semanticBundles: d1b.products,
  recoveryFixture: recovery,
  protectionRecords: protection.records,
  uvaRecoveryReview: uvaReview,
});

assert.equal(
  SUNSCREEN_UVA_AUTHORITY_RECOVERY_REVIEW_VERSION,
  "data-ai29c-d4-uva-authority-recovery-review-v1",
);

// D4-UVA-R1: the mixed comparison frame is unchanged from D3R3.
assert.equal(result.comparableCorpusCount, 14);
assert.deepEqual(result.coverage, {
  eligibleCount: 12,
  totalCount: 14,
  complete: false,
  missingProductIds: [
    "9983f167-24e7-4223-bd86-446ce6ced31b",
    "fdf06871-db8e-4e73-a48c-c057c5ce925d",
  ],
});
assert.deepEqual(result.missingProductIds, [
  "9983f167-24e7-4223-bd86-446ce6ced31b",
  "fdf06871-db8e-4e73-a48c-c057c5ce925d",
]);

// D4-UVA-R2: no value is fabricated for either missing exact Subject.
assert.equal(uvaReview.recovery.confirmedFactsWritten, 0);
assert.equal(uvaReview.recovery.evidenceRecordsWritten, 0);
assert.equal(uvaReview.recovery.reviewAssignmentsWritten, 0);
assert.equal(
  uvaReview.currentHistoricalUvaPfDeclaredInstanceCount,
  0,
);
assert.ok(
  uvaReview.targets.every(
    (target) =>
      target.currentUvaFact === false &&
      target.candidateValue === null &&
      target.decision.startsWith("HOLD_"),
  ),
);

// D4-UVA-R3: SKIN1004's current Product Fact Subject is the US formulation.
// The previously frozen TRUST-P18 authority explicitly forbids converting
// Broad Spectrum to PA or transferring PA across formulations.
const skin1004 = uvaReview.targets.find(
  (target) =>
    target.productId === "fdf06871-db8e-4e73-a48c-c057c5ce925d",
);
assert.equal(skin1004.market, "US");
assert.equal(
  skin1004.subjectSemanticKey,
  p18.propositions[0].subject_semantic_key,
);
assert.equal(
  skin1004.variantKey,
  "HYALU_CICA_WATER_FIT_SUN_SERUM_UV_US_50ML",
);
assert.equal(
  p18.source_observation.uva_boundary.observed_claim,
  "Broad Spectrum",
);
assert.equal(
  p18.source_observation.uva_boundary.registry_admissible,
  false,
);
assert.equal(
  p18.source_observation.uva_boundary.broad_spectrum_to_pa_conversion,
  false,
);
assert.equal(
  p18.source_observation.uva_boundary.cross_formula_pa_transfer,
  false,
);
assert.equal(p18.invariants.uva_label_adoption_planned, false);
assert.ok(
  skin1004.forbiddenConversions.includes(
    "GLOBAL_PA++++_TO_US_FORMULATION",
  ),
);
assert.notDeepEqual(
  skin1004.exactSubjectActiveIngredients,
  skin1004.globalFormulaUvFilters,
);

// D4-UVA-R4: LRP's exact Subject is KR. High-PPD claims observed on the UK
// UVMune product cannot become KR Product Fact authority without exact
// formulation equivalence.
const lrp = uvaReview.targets.find(
  (target) =>
    target.productId === "9983f167-24e7-4223-bd86-446ce6ced31b",
);
assert.equal(lrp.market, "KR");
assert.equal(lrp.variantKey, "ANTHELIOS_SUN_FLUID_KR_50ML");
assert.ok(
  lrp.forbiddenConversions.includes(
    "UK_HIGH_PPD_TO_KR_UVA_LABEL",
  ),
);

// D4-UVA-R5: UVA-PF-declared is an allowed registry enum and projection bucket,
// but there is no governed historical/current instance to establish that
// Broad Spectrum or a generic UVA mark should be interpreted as this enum.
assert.ok(uvaReview.allowedValues.includes("UVA-PF-declared"));
assert.equal(
  uvaReview.projection["UVA-PF-declared"],
  "uva_medium_high",
);
assert.equal(
  uvaReview.currentHistoricalUvaPfDeclaredInstanceCount,
  0,
);
assert.ok(
  result.nextGate.forbiddenPaths.includes(
    "Broad Spectrum to PA conversion",
  ),
);
assert.ok(
  result.nextGate.forbiddenPaths.includes(
    "missing authority treated as low protection",
  ),
);

// D4-UVA-R6: therefore D4-UVA remains HOLD and Production stays frozen.
assert.deepEqual(result.gates, {
  mixedCorpusStillBounded: true,
  currentCoverageStillIncomplete: true,
  exactMissingTargets: true,
  allTargetsHeld: true,
  noGovernedWrites: true,
  uvaPfDeclaredUnused: true,
  noForbiddenConversion: true,
  productionStillFrozen: true,
});
assert.equal(result.holdRequired, true);
assert.equal(
  result.decision,
  "UVA_AXIS_D4_HOLD_EXACT_SUBJECT_AUTHORITY_INCOMPLETE",
);
assert.deepEqual(result.limits, {
  productFactWritten: false,
  registryChanged: false,
  productionCandidateAdmissionWired: false,
  productionRankingChanged: false,
  productionCutoverAuthorized: false,
  outdoorRankableSignalAuthorized: false,
  publicActivation: false,
  uvaActivated: false,
  waterResistanceApplied: false,
  persistence: false,
});

const source = fs.readFileSync(
  "lib/sunscreen-uva-authority-recovery-review.mjs",
  "utf8",
);
assert.ok(
  source.includes("evaluateAuthorityCompleteMixedSubsetShadow"),
);
assert.equal(source.includes("admin_confirm_product_fact_v1"), false);

console.log(
  JSON.stringify({
    status: "PASS",
    stage: "DATA-AI29C-D4-UVA-RECOVERY",
    comparableCorpusCount: result.comparableCorpusCount,
    uvaCoverage: result.coverage,
    governedWrites: uvaReview.recovery,
    decision: result.decision,
  }),
);
