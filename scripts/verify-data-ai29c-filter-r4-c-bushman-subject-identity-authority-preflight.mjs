#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import {
 BUSHMAN_MIXED_REGISTRY_TARGET,
 evaluateBushmanMixedRegistryCompatibility,
} from "../lib/sunscreen-mixed-registry-admission-compatibility-contract.mjs";
import {
 SUNSCREEN_INITIAL_ADMISSION_ACCEPTED_SUBJECT_RESOLUTION_VERSIONS,
} from "../lib/sunscreen-initial-admission-grant-policy.mjs";
import {
 D5E_F_AUTHENTICATED_BETA_PRODUCT_IDS,
} from "../lib/sunscreen-d5e-f-authenticated-beta-contract.mjs";

const evidence = JSON.parse(fs.readFileSync("evidence/product-fact-catalog-expansion-v1/data-ai29c-filter-r4-c-bushman-subject-identity-authority-preflight-v1.json","utf8"));
const r4a = JSON.parse(fs.readFileSync(
 "evidence/product-fact-catalog-expansion-v1/data-ai29c-filter-r4-a-bushman-mixed-registry-admission-compatibility-preflight-v1.json","utf8"));
const r4b = JSON.parse(fs.readFileSync(
 "evidence/product-fact-catalog-expansion-v1/data-ai29c-filter-r4-b-bushman-mixed-registry-compatibility-contract-v1.json","utf8"));
const r33 = JSON.parse(fs.readFileSync(
 "evidence/product-fact-catalog-expansion-v1/data-ai29c-filter-r3-r3-bushman-governed-source-refresh-confirmation-closeout-v1.json","utf8"));
const legacyUpgradeSQL = fs.readFileSync(
 "supabase/migrations/20261006110000_data_ai29c_d5e_d_r3_subject_identity_authority_upgrade_v1.sql","utf8");

assert.equal(evidence.stage,"DATA-AI29C-FILTER-R4-C");
assert.equal(evidence.decision,"FILTER_R4_C_HOLD_UNSUPPORTED_SUBJECT_LINEAGE_AND_OFFICIAL_CATALOG_SOURCE");
assert.equal(evidence.mode,"PRODUCTION_READ_ONLY_SUBJECT_AUTHORITY_RECOVERY_PREFLIGHT");
assert.equal(r4b.decision,evidence.prerequisite.priorDecision);
assert.equal(evidence.target.productId,BUSHMAN_MIXED_REGISTRY_TARGET.productId);
assert.equal(evidence.target.subjectId,BUSHMAN_MIXED_REGISTRY_TARGET.subjectId);
assert.equal(evidence.target.subjectSemanticKey,BUSHMAN_MIXED_REGISTRY_TARGET.subjectSemanticKey);
assert.equal(evidence.target.formulationRevisionKey,BUSHMAN_MIXED_REGISTRY_TARGET.formulationRevisionKey);
assert.equal(evidence.target.productId,r4a.target.productId);
assert.equal(evidence.target.subjectId,r4a.target.subjectId);
assert.equal(evidence.target.subjectId,r33.target.subjectId);
assert.equal(evidence.catalog.existingFirstPartyProductFactSource.sourceId,r33.governedSource.sourceId);
assert.equal(evidence.catalog.existingFirstPartyProductFactSource.bindingId,r33.governedSource.bindingId);

assert.equal(evidence.subjectAuthority.actual,r4a.frozenProduction.subject.identityResolutionVersion);
assert.equal(evidence.subjectAuthority.admissionRequires,SUNSCREEN_INITIAL_ADMISSION_ACCEPTED_SUBJECT_RESOLUTION_VERSIONS[0]);
assert.equal(evidence.subjectAuthority.subjectSemanticKeyCalculatedEqualsStored,true);
assert.equal(evidence.subjectAuthority.currentApplicabilitySubjectCount,1);
assert.equal(evidence.subjectAuthority.oldPlanAcceptsActualLineage,false);
assert.equal(evidence.subjectAuthority.oldPlanAcceptsMachineLineage,true);
assert.equal(evidence.subjectAuthority.subjectUpgradeAuditCount,0);
assert.equal(evidence.subjectAuthority.serviceRoleDirectSubjectUpdate,false);
assert.equal(evidence.subjectAuthority.deployedPreflightName,"admin_preflight_product_fact_subject_identity_authority_upgrade");
assert.equal(evidence.subjectAuthority.deployedUpgradePlanName,"product_fact_subject_identity_authority_upgrade_plan_v1");
assert.ok(legacyUpgradeSQL.includes("create or replace function public.product_fact_subject_identity_authority_upgrade_plan_v1("));
assert.ok(legacyUpgradeSQL.includes("'gpt-catalog-machine-subject-v1'"));
assert.ok(legacyUpgradeSQL.includes("'trust-phase5-admin-subject-review-v1'"));
assert.ok(!legacyUpgradeSQL.includes(evidence.subjectAuthority.actual));
assert.ok(legacyUpgradeSQL.includes("v_official_digest !~ '^[0-9a-f]{64}$'"));
assert.ok(legacyUpgradeSQL.includes("v_subject.identity_resolution_version not in ("));

assert.equal(evidence.catalog.candidateCount,1);
assert.equal(evidence.catalog.eligibleFirstPartyIdentityCandidates,0);
assert.equal(evidence.catalog.candidate.matchedProductId,evidence.target.productId);
assert.equal(evidence.catalog.candidate.reviewStatus,"promoted");
assert.equal(evidence.catalog.candidate.identityResolutionState,"resolved");
assert.equal(evidence.catalog.candidate.sourceLocator,"https://www.hwahae.com/en/products/1884027");
assert.equal(evidence.catalog.candidate.sourceIsFirstPartyBushman,false);
assert.equal(evidence.catalog.candidate.officialContentDigest,null);
assert.equal(evidence.catalog.candidate.officialContentDigestValid,false);
assert.equal(evidence.catalog.candidate.productFactWriteAllowed,false);
assert.equal(evidence.catalog.existingFirstPartyProductFactSource.automaticallyPromotableToCatalogIdentity,false);

assert.deepEqual(evidence.dependentAuthority,{
 currentFacts:3,factInstances:3,researchTasks:4,governedSourceBindings:4,
 evidenceRecords:3,currentSemanticReviews:0
});
assert.equal(evidence.reviewedGate.subjectSemanticIdentityConsistent,true);
for(const key of [
 "identityUpgradePolicyReady","officialCatalogCandidateReady",
 "authenticatedAdminAttestationPresent","productionPreflightExecuted",
 "upgradeConfirmationExecuted","recommendationAdmissionReevaluated"
])assert.equal(evidence.reviewedGate[key],false,key);

const semanticNames=[
 "category_slot","skin_types","concerns","texture","finish","uv_filter_type",
 "sensitivity_safe","irritation_risk","tone_up","white_cast","eye_sting","pilling_risk"
];
const input={
 product:{id:evidence.target.productId,canonicalProduct:true},
 taxonomy:structuredClone(r4a.frozenProduction.taxonomy),
 subject:structuredClone(r4a.frozenProduction.subject),
 subjectScope:{
  subjectSemanticKey:evidence.target.subjectSemanticKey,
  formulationRevisionKey:evidence.target.formulationRevisionKey,
  market:evidence.target.market
 },
 exactCurrentSubjectCount:1,
 registrySnapshots:{
  [r4a.frozenProduction.registryV1.registryVersion]:structuredClone(r4a.frozenProduction.registryV1),
  [r4a.frozenProduction.registryV2.registryVersion]:structuredClone(r4a.frozenProduction.registryV2)
 },
 currentFacts:structuredClone(r4a.frozenProduction.facts),
 semanticReviewCount:0,
 semanticBundle:{
  contractVersion:"sunscreen-recommendation-semantic-bundle-v1",
  productId:evidence.target.productId,subjectId:evidence.target.subjectId,
  subjectCount:1,fields:Object.fromEntries(semanticNames.map(n=>[n,{state:"not_reviewed",value:null,confidence:"unknown"}]))
 }
};
const validation=evaluateBushmanMixedRegistryCompatibility(input,{now:new Date("2026-10-08T09:00:00Z")});
assert.equal(validation.lineageCompatible,true);
assert.equal(validation.subjectAuthorityReady,false);
assert.equal(validation.semanticEnvelopeReady,false);
assert.equal(validation.admissionGranted,false);
assert.equal(D5E_F_AUTHENTICATED_BETA_PRODUCT_IDS.length,4);
assert.equal(D5E_F_AUTHENTICATED_BETA_PRODUCT_IDS.includes(evidence.target.productId),false);
assert.equal(evidence.nextGate.automaticSubjectUpgrade,false);
assert.equal(evidence.nextGate.automaticAdmission,false);
for(const [k,v] of Object.entries(evidence.writeBoundary)){
 if(typeof v==="number")assert.equal(v,0,k);
 else if(typeof v==="boolean")assert.equal(v,false,k);
}
console.log(JSON.stringify({
 status:"PASS",stage:evidence.stage,decision:evidence.decision,
 subjectIdentityConsistent:true,governedUpgradeWriterReady:false,
 firstPartyCatalogIdentityCandidates:0,
 readOnly:true,productionWrites:0,admissionGranted:false,
 nextGate:evidence.nextGate.stage
},null,2));
