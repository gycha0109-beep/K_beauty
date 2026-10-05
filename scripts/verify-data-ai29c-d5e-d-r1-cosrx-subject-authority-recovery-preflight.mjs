#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  buildTrustSubjectIdentityProposal,
  canonicalTrustSubjectJson,
} from "../lib/admin/trust-subject-identity.js";

const evidence = JSON.parse(
  fs.readFileSync(
    "evidence/product-fact-catalog-expansion-v1/data-ai29c-d5e-d-r1-cosrx-subject-authority-recovery-preflight-v1.json",
    "utf8",
  ),
);
const upstream = JSON.parse(
  fs.readFileSync(
    "evidence/product-fact-catalog-expansion-v1/data-ai29c-d5e-d-cosrx-admission-mixed-shadow-v1.json",
    "utf8",
  ),
);

assert.equal(evidence.stage, "DATA-AI29C-D5E-D-R1");
assert.equal(
  evidence.decision,
  "D5E_D_R1_COSRX_SUBJECT_AUTHORITY_RECOVERY_PREFLIGHT_HOLD_EXISTING_PATH_SEMANTIC_KEY_CONFLICT",
);
assert.equal(
  upstream.decision,
  "D5E_D_COSRX_ADMISSION_HOLD_SUBJECT_IDENTITY_AUTHORITY_LINEAGE_MISMATCH",
);

const target=evidence.target;
const lineage=evidence.currentCatalogLineage;
const snapshot={
  task:{
    id:"e5b6276b-f16a-4441-9a61-f7f9767064eb",
    intake_id:lineage.intakeId,
    product_id:target.productId,
    subject_id:target.subjectId,
    fact_key:"spf_value",
    registry_version:"product-fact-registry-cross-category-v1",
    state:"EVIDENCE_CANDIDATE",
    blocker_code:null,
    updated_at:"2026-10-02T20:19:48.245101+09:00",
  },
  intake:{
    id:lineage.intakeId,
    product_id:target.productId,
    source_candidate_id:lineage.sourceCandidateId,
    market:"KR",
    subject_id:target.subjectId,
    identity_state:lineage.intakeIdentityState,
    trust_state:lineage.intakeTrustState,
    updated_at:"2026-10-02T19:23:59.869316+09:00",
  },
  product:{
    id:target.productId,
    brand:"COSRX",
    name:"Ultra-Light Invisible Sunscreen SPF50 PA++++",
    category:null,
    product_form:null,
  },
  candidate:{
    id:lineage.sourceCandidateId,
    matched_product_id:target.productId,
    review_status:lineage.candidateReviewStatus,
    identity_resolution_state:lineage.candidateIdentityResolutionState,
    identity_resolution_version:lineage.candidateIdentityResolutionVersion,
    identity_resolution_evidence:{
      authority_boundary:{product_fact_write_allowed:false},
    },
    promotion_payload:{
      recommendation_admission_allowed:false,
      product_fact_confirmation_allowed:false,
    },
    updated_at:"2026-10-02T19:23:59.869316+09:00",
  },
  tasks:[
    {
      id:"e5b6276b-f16a-4441-9a61-f7f9767064eb",
      fact_key:"spf_value",
      state:"EVIDENCE_CANDIDATE",
      blocker_code:null,
      subject_id:target.subjectId,
      updated_at:"2026-10-02T20:19:48.245101+09:00",
    },
    {
      id:"42524102-1b42-4a20-a9ec-bcfa1477bd72",
      fact_key:"uva_label",
      state:"EVIDENCE_CANDIDATE",
      blocker_code:null,
      subject_id:target.subjectId,
      updated_at:"2026-10-02T20:19:48.245101+09:00",
    },
    {
      id:"21d949c7-3ace-4691-a018-e8465018b160",
      fact_key:"uv_filter_type",
      state:"EVIDENCE_CANDIDATE",
      blocker_code:null,
      subject_id:target.subjectId,
      updated_at:"2026-10-02T19:30:17.61413+09:00",
    },
  ],
};

const proposal=buildTrustSubjectIdentityProposal(
  snapshot,
  evidence.reviewedIdentityForExistingSubject,
  {requireInitialReviewState:false},
);

assert.equal(
  proposal.payload.subject_semantic_key,
  target.subjectSemanticKey,
);
assert.equal(
  proposal.payload.identity_resolution_version,
  target.requiredAdmissionIdentityResolutionVersion,
);
assert.equal(
  evidence.proposalProbe.semanticKeyMatchesExisting,
  true,
);

const existingPayload={
  product_id:target.productId,
  subject_semantic_key:target.subjectSemanticKey,
  subject_identity_serializer_version:
    target.subjectIdentitySerializerVersion,
  variant_key:target.variantKey,
  formulation_revision_key:target.formulationRevisionKey,
  formulation_label:target.formulationLabel,
  identity_status:target.identityStatus,
  identity_resolution_version:target.currentIdentityResolutionVersion,
  current_state:target.currentState,
  market_applicability:target.marketApplicability,
  region_applicability:target.regionApplicability,
  valid_from:target.validFrom,
  valid_to:target.validTo,
  predecessor_subject_id:null,
  supersession_kind:null,
};

const proposedPayload=proposal.payload;
const differingKeys=Object.keys(existingPayload)
  .filter(
    (key)=>canonicalTrustSubjectJson(existingPayload[key]) !==
      canonicalTrustSubjectJson(proposedPayload[key]),
  )
  .sort();

assert.deepEqual(
  differingKeys,
  evidence.proposalProbe.payloadDifferenceKeys,
);
assert.deepEqual(differingKeys, ["identity_resolution_version"]);

assert.equal(evidence.databaseGuards.subjectSemanticKeyUnique,true);
assert.equal(evidence.databaseGuards.currentApplicabilityUnique,true);
assert.equal(evidence.databaseGuards.serviceRoleDirectSubjectWrites,0);

assert.deepEqual(evidence.dependentAuthorityRows,{
  productFactCurrent:3,
  productFactInstances:3,
  researchTasks:3,
  sourceBindings:2,
  evidenceRecords:3,
  currentSemanticReviews:12,
});

for (const key of [
  "directSubjectUpdateAllowed",
  "duplicateSameSemanticSubjectAllowed",
  "secondSameApplicabilityCurrentSubjectAllowed",
  "existingRegistrationPathReusableForAuthorityUpgrade",
  "rebindExistingFactsToNewSubjectAuthorized",
  "admissionPolicyBypassAuthorized",
]) {
  assert.equal(evidence.recoveryAssessment[key],false,key);
}
assert.equal(
  evidence.recoveryAssessment.safeRecoveryRequiresNewGovernedAuthorityUpgradeContract,
  true,
);

const writer=fs.readFileSync(
  "supabase/migrations/20260810174410_product_fact_subject_registration_v1.sql",
  "utf8",
);
assert.ok(writer.includes("product_fact_subject_semantic_key_conflict"));
assert.ok(
  writer.includes(
    "v_existing.identity_resolution_version <> v_identity_resolution_version",
  ),
);
assert.ok(writer.includes("product_fact_subject_registration_direct_write_exposed"));

assert.equal(
  evidence.nextGate,
  "DATA-AI29C-D5E-D-R2_COSRX_SUBJECT_IDENTITY_AUTHORITY_UPGRADE_CONTRACT",
);
assert.equal(evidence.nextGateMode,"DESIGN_ONLY");

console.log(JSON.stringify({
  status:"PASS",
  stage:evidence.stage,
  semanticKeyMatchesExisting:
    evidence.proposalProbe.semanticKeyMatchesExisting,
  differingKeys,
  existingPathCanUpgrade:
    evidence.existingRegistrationPath.existingPathCanUpgradeAuthorityInPlace,
  productionWrites:0,
  nextGate:evidence.nextGate,
},null,2));
