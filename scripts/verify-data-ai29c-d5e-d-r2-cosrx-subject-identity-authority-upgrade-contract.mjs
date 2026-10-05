#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  buildTrustSubjectIdentityProposal,
} from "../lib/admin/trust-subject-identity.js";

const contract=JSON.parse(
  fs.readFileSync(
    "evidence/product-fact-catalog-expansion-v1/data-ai29c-d5e-d-r2-cosrx-subject-identity-authority-upgrade-contract-v1.json",
    "utf8",
  ),
);
const r1=JSON.parse(
  fs.readFileSync(
    "evidence/product-fact-catalog-expansion-v1/data-ai29c-d5e-d-r1-cosrx-subject-authority-recovery-preflight-v1.json",
    "utf8",
  ),
);

assert.equal(contract.stage,"DATA-AI29C-D5E-D-R2");
assert.equal(
  contract.decision,
  "D5E_D_R2_SUBJECT_IDENTITY_AUTHORITY_UPGRADE_CONTRACT_READY_DESIGN_ONLY",
);
assert.equal(
  r1.decision,
  "D5E_D_R1_COSRX_SUBJECT_AUTHORITY_RECOVERY_PREFLIGHT_HOLD_EXISTING_PATH_SEMANTIC_KEY_CONFLICT",
);

assert.equal(contract.onlyMutableSubjectField,"identity_resolution_version");
assert.deepEqual(contract.allowedTransition,{
  from:"gpt-catalog-machine-subject-v1",
  to:"trust-phase5-admin-subject-review-v1",
  exactSubjectRequired:true,
  sameSemanticKeyRequired:true,
  sameFormulationRequired:true,
  sameMarketRequired:true,
  identityStatusRequired:"resolved",
  currentStateRequired:"current",
});

assert.equal(contract.capability.required,"admin.products.review");
assert.equal(contract.capability.anonymousExecute,false);
assert.equal(contract.capability.authenticatedExecute,false);
assert.equal(contract.capability.directServiceRoleTableWrite,false);

assert.equal(contract.proposedApi.preflight.writeCount,0);
assert.equal(contract.proposedApi.confirm.requiresExplicitConfirmation,true);
assert.equal(contract.proposedApi.confirm.advisoryLock,"subject_id");

const snapshot={
  task:{
    id:"e5b6276b-f16a-4441-9a61-f7f9767064eb",
    intake_id:"f78e9366-6709-4c3e-8c36-4c643c805b56",
    product_id:contract.target.productId,
    subject_id:contract.target.subjectId,
    fact_key:"spf_value",
    registry_version:"product-fact-registry-cross-category-v1",
    state:"EVIDENCE_CANDIDATE",
    blocker_code:null,
    updated_at:"2026-10-02T20:19:48.245101+09:00",
  },
  intake:{
    id:"f78e9366-6709-4c3e-8c36-4c643c805b56",
    product_id:contract.target.productId,
    source_candidate_id:contract.target.sourceCandidateId,
    market:"KR",
    subject_id:contract.target.subjectId,
    identity_state:"EXACT_SUBJECT_FOUND",
    trust_state:"RESEARCH_PENDING",
    updated_at:"2026-10-02T19:23:59.869316+09:00",
  },
  product:{
    id:contract.target.productId,
    brand:"COSRX",
    name:"Ultra-Light Invisible Sunscreen SPF50 PA++++",
    category:null,
    product_form:null,
  },
  candidate:{
    id:contract.target.sourceCandidateId,
    matched_product_id:contract.target.productId,
    review_status:"promoted",
    identity_resolution_state:"resolved",
    identity_resolution_version:"crawler-identity-resolution-v1",
    identity_resolution_evidence:{
      authority_boundary:{product_fact_write_allowed:false},
    },
    promotion_payload:{
      recommendation_admission_allowed:false,
      product_fact_confirmation_allowed:false,
    },
    updated_at:"2026-10-02T19:23:59.869316+09:00",
  },
  tasks:[],
};

const proposal=buildTrustSubjectIdentityProposal(
  snapshot,
  contract.reviewedIdentity,
  {requireInitialReviewState:false},
);
assert.equal(
  proposal.payload.subject_semantic_key,
  contract.target.subjectSemanticKey,
);
assert.equal(
  proposal.payload.identity_resolution_version,
  contract.target.toIdentityResolutionVersion,
);

assert.deepEqual(contract.exactProductionPrestate,{
  productFactCurrent:3,
  productFactInstances:3,
  researchTasks:3,
  sourceBindings:2,
  evidenceRecords:3,
  currentSemanticReviews:12,
  exactCurrentApplicabilitySubjectCount:1,
});

assert.deepEqual(
  contract.writeSet.productFactSubjects.columns.sort(),
  ["identity_resolution_version","updated_at"].sort(),
);
assert.equal(contract.writeSet.productFactSubjects.rows,1);
assert.equal(contract.writeSet.productFactReviewEvents.rows,1);
assert.equal(contract.writeSet.adminAuditLogs.rows,1);

for(const key of [
  "productFacts",
  "evidence",
  "sourceBindings",
  "researchTasks",
  "semanticReviews",
  "taxonomy",
  "recommendations",
]){
  assert.equal(contract.writeSet[key],0,key);
}

for(const forbidden of [
  "subject_id",
  "subject_semantic_key",
  "formulation_revision_key",
  "market_applicability",
  "Product Fact rows",
  "Recommendation admission",
  "D5C/D5D allowlist",
]){
  assert.ok(contract.explicitForbiddenMutations.includes(forbidden),forbidden);
}

assert.equal(
  contract.implementationPlan.productionExecutionAuthorizedInR2,
  false,
);
assert.equal(
  contract.implementationPlan.admissionReevaluationAuthorizedInR2,
  false,
);
assert.equal(
  contract.implementationPlan.mixedShadowAuthorizedInR2,
  false,
);
assert.equal(
  contract.implementationPlan.nextGate,
  "DATA-AI29C-D5E-D-R3_COSRX_SUBJECT_IDENTITY_AUTHORITY_UPGRADE_IMPLEMENTATION",
);

const eventsMigration=fs.readFileSync(
  "supabase/migrations/20260810174410_product_fact_subject_registration_v1.sql",
  "utf8",
);
assert.ok(eventsMigration.includes("admin_require_product_review_actor"));
assert.ok(eventsMigration.includes("record_admin_audit_event"));
assert.ok(eventsMigration.includes("product_fact_subject_registration_direct_write_exposed"));

console.log(JSON.stringify({
  status:"PASS",
  stage:contract.stage,
  decision:contract.decision,
  onlyMutableSubjectField:contract.onlyMutableSubjectField,
  plannedSubjectRows:contract.writeSet.productFactSubjects.rows,
  productionExecutionAuthorized:
    contract.implementationPlan.productionExecutionAuthorizedInR2,
  nextGate:contract.implementationPlan.nextGate,
},null,2));
