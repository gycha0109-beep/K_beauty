#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  RECOMMENDATION_CATEGORY_AUTHORITY_SHADOW_CONTRACT_VERSION,
  RECOMMENDATION_CATEGORY_AUTHORITY_STATUS,
  evaluateRecommendationCategoryAuthorityShadow,
} from "../lib/recommendation-category-authority-shadow-contract.mjs";

const evidence=JSON.parse(fs.readFileSync(
  "evidence/recommendation-governance/v21-admission-g4-f0-category-authority-shadow-contract-v1.json",
  "utf8",
));
const fixture=JSON.parse(fs.readFileSync(
  "fixtures/recommendation-governance/g4f0-category-authority-shadow-v1.json",
  "utf8",
));
const g40=JSON.parse(fs.readFileSync(
  "evidence/recommendation-governance/v21-admission-g4-0-nonlegacy-frontier-design-v1.json",
  "utf8",
));
const g4r1=JSON.parse(fs.readFileSync(
  "evidence/recommendation-governance/v21-admission-g4-b-r1-fation-formulation-authority-recovery-v1.json",
  "utf8",
));

assert.equal(evidence.stage,"V2.1-ADMISSION-G4-F0");
assert.equal(
  evidence.decision,
  "V21_ADMISSION_G4_F0_CATEGORY_AUTHORITY_SHADOW_CONTRACT_READY",
);
assert.equal(
  RECOMMENDATION_CATEGORY_AUTHORITY_SHADOW_CONTRACT_VERSION,
  "recommendation-category-authority-shadow-v1",
);
assert.equal(
  g4r1.adjudication.formulation_revision_resolved,
  false,
);
assert.equal(
  g4r1.adjudication.subject_registration_allowed,
  false,
);
assert.match(
  g40.frozen_architecture.category_bridge_rule,
  /product-scoped reviewed grant/,
);

const {product,assignment,reviewedGrant}=fixture.target;
const valid=evaluateRecommendationCategoryAuthorityShadow({
  product,
  assignment,
  grant:reviewedGrant,
});
assert.equal(valid.status,RECOMMENDATION_CATEGORY_AUTHORITY_STATUS.RESOLVED);
assert.equal(valid.authority.category,"treatment");
assert.equal(
  valid.authority.assignmentSnapshotDigest,
  "eaed6cb9dd58b0f1e08bc5b35da817a72887b81ee497e0d144fcb5018b108d39",
);
assert.equal(valid.recommendationAdmissionMutated,false);
assert.equal(valid.productionCutoverAuthorized,false);

const noGrant=evaluateRecommendationCategoryAuthorityShadow({
  product,assignment,grant:null,
});
assert.equal(noGrant.status,RECOMMENDATION_CATEGORY_AUTHORITY_STATUS.NONE);
assert.equal(noGrant.reason,"REVIEWED_CATEGORY_GRANT_MISSING");

const digestDrift=evaluateRecommendationCategoryAuthorityShadow({
  product,
  assignment:{...assignment,assignmentSnapshotDigest:"a".repeat(64)},
  grant:reviewedGrant,
});
assert.equal(digestDrift.status,RECOMMENDATION_CATEGORY_AUTHORITY_STATUS.NONE);
assert.equal(digestDrift.reason,"GRANT_ASSIGNMENT_SNAPSHOT_DRIFT");

const sunscreen=evaluateRecommendationCategoryAuthorityShadow({
  product,
  assignment:{
    ...assignment,
    categoryTermId:"catalog-taxonomy-v1:category:sunscreen",
  },
  grant:{
    ...reviewedGrant,
    categoryTermId:"catalog-taxonomy-v1:category:sunscreen",
  },
});
assert.equal(sunscreen.status,RECOMMENDATION_CATEGORY_AUTHORITY_STATUS.NONE);
assert.equal(sunscreen.reason,"INITIAL_ADMISSION_CATEGORY_UNSUPPORTED");

const projection=evaluateRecommendationCategoryAuthorityShadow({
  product,
  assignment:{...assignment,legacyProjectionKey:"legacy:treatment"},
  grant:reviewedGrant,
});
assert.equal(projection.status,RECOMMENDATION_CATEGORY_AUTHORITY_STATUS.NONE);
assert.equal(projection.reason,"LEGACY_PROJECTION_PRESENT");

const globalDrift=evaluateRecommendationCategoryAuthorityShadow({
  product,
  assignment:{...assignment,taxonomyAuthorityMode:"active"},
  grant:reviewedGrant,
});
assert.equal(globalDrift.status,RECOMMENDATION_CATEGORY_AUTHORITY_STATUS.NONE);
assert.equal(globalDrift.reason,"TAXONOMY_GLOBAL_AUTHORITY_DRIFT");

const revoked=evaluateRecommendationCategoryAuthorityShadow({
  product,
  assignment,
  grant:{...reviewedGrant,isCurrent:false},
});
assert.equal(revoked.status,RECOMMENDATION_CATEGORY_AUTHORITY_STATUS.NONE);
assert.equal(revoked.reason,"GRANT_NOT_CURRENT_ESTABLISHED");

assert.equal(evidence.architecture.product_fact_subject_dependency,false);
assert.equal(evidence.architecture.products_category_backfill_forbidden,true);
assert.equal(evidence.architecture.existing_assignment_mutation_forbidden,true);
assert.equal(evidence.architecture.g3_runtime_cutover_in_f0,false);

for(const value of Object.values(evidence.authority_boundary)){
  assert.equal(value,false);
}

assert.equal(
  evidence.next_gate,
  "V2.1-ADMISSION-G4-F1_CATEGORY_AUTHORITY_LEDGER_AND_PROTECTED_READER",
);

console.log(JSON.stringify({
  status:"PASS",
  stage:evidence.stage,
  decision:evidence.decision,
  validShadowCategory:valid.authority.category,
  assignmentSnapshotDigest:valid.authority.assignmentSnapshotDigest,
  recommendationAdmissionMutated:valid.recommendationAdmissionMutated,
  productionCutoverAuthorized:valid.productionCutoverAuthorized,
  nextGate:evidence.next_gate,
},null,2));
