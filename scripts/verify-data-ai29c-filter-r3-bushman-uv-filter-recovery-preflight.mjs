#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";

const r2 = JSON.parse(fs.readFileSync(
  "evidence/product-fact-catalog-expansion-v1/data-ai29c-filter-r2-roundlab-exact-kr-formulation-closeout-v1.json",
  "utf8",
));
const d5e = JSON.parse(fs.readFileSync(
  "evidence/product-fact-catalog-expansion-v1/data-ai29c-d5e-f-authenticated-beta-allowlist-expansion-closeout-v1.json",
  "utf8",
));
const r3 = JSON.parse(fs.readFileSync(
  "evidence/product-fact-catalog-expansion-v1/data-ai29c-filter-r3-bushman-uv-filter-recovery-preflight-v1.json",
  "utf8",
));

assert.equal(d5e.decision, "D5E_F_AUTHENTICATED_BETA_ALLOWLIST_EXPANSION_PASS");
assert.equal(d5e.disposition.d5eComplete, true);
assert.equal(
  r2.decision,
  "FILTER_R2_ROUNDLAB_CLOSEOUT_PASS_WATCH_ON_CHANGE_NO_ADMISSIBLE_EXACT_KR_FILTER_AUTHORITY",
);
assert.equal(r3.stage, "DATA-AI29C-FILTER-R3");
assert.equal(r3.mode, "ZERO_WRITE_PREFLIGHT");
assert.equal(
  r3.decision,
  "FILTER_R3_BUSHMAN_HYBRID_RECOVERY_PREFLIGHT_PASS_WRITE_NOT_AUTHORIZED",
);
assert.equal(r3.target.productId, "4608b3b4-8b51-4464-b46e-380b05c1a3d7");
assert.equal(r3.target.subjectId, "0b5963bb-67d6-4738-a620-32ec86c1e3d0");
assert.equal(r3.target.identityStatus, "resolved");
assert.equal(r3.target.market, "KR");
assert.equal(r3.target.currentAdmissionFacts.spf_value, 50);
assert.equal(r3.target.currentAdmissionFacts.uva_label, "PA++++");
assert.equal(r3.target.currentAdmissionFacts.uv_filter_type, null);
assert.equal(r3.target.historicalResearchTask.state, "BLOCKED");
assert.equal(r3.target.historicalResearchTask.blockerCode, "EVIDENCE_INSUFFICIENT");
assert.equal(r3.registryContract.registryVersion, "product-fact-registry-cross-category-v2");
assert.deepEqual(r3.registryContract.allowedValues, ["mineral","organic","hybrid"]);
assert.ok(r3.registryContract.permittedEvidenceClasses.includes("composition_identity"));
assert.equal(r3.governedSourceBaseline.bindingState, "exact_subject_match");
assert.equal(r3.governedSourceBaseline.scopeRelation, "equivalent");
assert.equal(r3.liveOfficialObservation.fullIngredientListExposed, true);
assert.ok(r3.liveOfficialObservation.inorganicFilterMarkers.includes("징크옥사이드"));
assert.ok(r3.liveOfficialObservation.inorganicFilterMarkers.includes("티타늄디옥사이드"));
assert.ok(r3.liveOfficialObservation.organicFilterMarkers.includes("디에칠아미노하이드록시벤조일헥실벤조에이트"));
assert.ok(r3.liveOfficialObservation.organicFilterMarkers.includes("비스-에칠헥실옥시페놀메톡시페닐트리아진"));
assert.ok(r3.liveOfficialObservation.organicFilterMarkers.includes("에칠헥실트리아존"));
assert.equal(r3.liveOfficialObservation.proposedUvFilterType, "hybrid");
assert.equal(r3.liveOfficialObservation.evidenceClass, "composition_identity");
assert.equal(r3.liveOfficialObservation.proposedAuthority, "product_specific_primary");
assert.equal(r3.liveOfficialObservation.proposedConfidence, "high");
const selected = r3.frontier.remainingCandidates.filter(
  (row) => row.disposition === "SELECTED_FILTER_RECOVERY_PREFLIGHT",
);
assert.equal(selected.length, 1);
assert.equal(selected[0].productId, r3.target.productId);
for (const value of Object.values(r3.writeBoundary)) assert.equal(value, false);
assert.equal(
  r3.nextGate,
  "DATA-AI29C-FILTER-R3-R1_BUSHMAN_GOVERNED_SOURCE_REFRESH_AND_CONFIRMATION",
);
console.log(JSON.stringify({
  status:"PASS",
  stage:r3.stage,
  decision:r3.decision,
  selectedProduct:r3.target.name,
  proposedUvFilterType:r3.liveOfficialObservation.proposedUvFilterType,
  nextGate:r3.nextGate,
}, null, 2));
