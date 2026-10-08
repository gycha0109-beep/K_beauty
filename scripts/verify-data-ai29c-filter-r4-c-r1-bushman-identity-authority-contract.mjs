#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import { BUSHMAN_MIXED_REGISTRY_TARGET } from "../lib/sunscreen-mixed-registry-admission-compatibility-contract.mjs";
import { SUNSCREEN_INITIAL_ADMISSION_ACCEPTED_SUBJECT_RESOLUTION_VERSIONS } from "../lib/sunscreen-initial-admission-grant-policy.mjs";
import { D5E_F_AUTHENTICATED_BETA_PRODUCT_IDS } from "../lib/sunscreen-d5e-f-authenticated-beta-contract.mjs";
const e=JSON.parse(fs.readFileSync("evidence/product-fact-catalog-expansion-v1/data-ai29c-filter-r4-c-r1-bushman-identity-authority-contract-v1.json","utf8"));
const c=JSON.parse(fs.readFileSync("evidence/product-fact-catalog-expansion-v1/data-ai29c-filter-r4-c-bushman-subject-identity-authority-preflight-v1.json","utf8"));
const r3=JSON.parse(fs.readFileSync("evidence/product-fact-catalog-expansion-v1/data-ai29c-filter-r3-r3-bushman-governed-source-refresh-confirmation-closeout-v1.json","utf8"));
const old=fs.readFileSync("supabase/migrations/20261006110000_data_ai29c_d5e_d_r3_subject_identity_authority_upgrade_v1.sql","utf8");
const HEX=/^[0-9a-f]{64}$/;
assert.equal(e.stage,"DATA-AI29C-FILTER-R4-C-R1");
assert.equal(e.decision,"R4_C_R1_SOURCE_BRIDGE_DESIGN_COMPLETE_IDENTITY_UPGRADE_HOLD");
assert.equal(e.predecessor.decision,c.decision);
assert.equal(e.target.productId,BUSHMAN_MIXED_REGISTRY_TARGET.productId);
assert.equal(e.target.subjectId,BUSHMAN_MIXED_REGISTRY_TARGET.subjectId);
assert.equal(e.target.subjectSemanticKey,BUSHMAN_MIXED_REGISTRY_TARGET.subjectSemanticKey);
assert.equal(e.target.formulationRevisionKey,BUSHMAN_MIXED_REGISTRY_TARGET.formulationRevisionKey);
assert.equal(e.target.currentIdentityAuthority,c.subjectAuthority.actual);
assert.equal(e.target.expectedAuthority,SUNSCREEN_INITIAL_ADMISSION_ACCEPTED_SUBJECT_RESOLUTION_VERSIONS[0]);
assert.equal(e.catalogCandidate.id,c.catalog.candidate.id);
assert.equal(e.sourceBridge.productSource.bindingId,r3.governedSource.catalogSourceBindingId);
assert.equal(e.sourceBridge.evidenceSources.find(s=>s.sourceId===r3.governedSource.sourceId).bindingId,r3.governedSource.bindingId);
assert.equal(e.sourceBridge.evidenceSources.find(s=>s.sourceId===r3.governedSource.sourceId).digest,r3.governedSource.contentDigest);
assert.ok(old.includes("'gpt-catalog-machine-subject-v1'"));
assert.ok(!old.includes(e.target.currentIdentityAuthority));
assert.equal(D5E_F_AUTHENTICATED_BETA_PRODUCT_IDS.length,4);
assert.equal(D5E_F_AUTHENTICATED_BETA_PRODUCT_IDS.includes(e.target.productId),false);

const EXPECTED=new Map([
 ["76cc7f5b-d5dc-4d72-bb1c-ab2a899211c1","c8b91f9b-a1b1-4b26-a435-b390672bf73f"],
 ["94b32b8d-8340-4b91-9e62-646794fd4f41","2b554836-0c57-4829-ac01-2631f34267d2"],
 ["9b98d800-66c3-4a40-880c-4c99f415a920","09650eb5-db97-474b-995c-5f5aeb706467"],
 ["f25f3fc4-07b3-45e9-a0a8-12f0d1b37f06","a19156b9-8a1c-4af5-8a8b-d9f58ae9b17d"]
]);
function evaluate(x){
 const errors=[],s=x.target,b=x.sourceBridge,p=b.productSource,r=b.sourceReview,es=b.evidenceSources;
 if(s.productId!==BUSHMAN_MIXED_REGISTRY_TARGET.productId||s.subjectId!==BUSHMAN_MIXED_REGISTRY_TARGET.subjectId||
 s.subjectSemanticKey!==BUSHMAN_MIXED_REGISTRY_TARGET.subjectSemanticKey||s.formulationRevisionKey!==BUSHMAN_MIXED_REGISTRY_TARGET.formulationRevisionKey||
 s.market!=="KR"||s.exactCurrentCount!==1||s.semanticKeyRecomputedMatch!==true||s.variantKey!==null||s.region!==null||
 s.validFrom!==null||s.validTo!==null)errors.push("SUBJECT_SCOPE");
 if(s.currentIdentityAuthority!=="data-ai29c-c5-presentation-identity-correction-v1")errors.push("AUTHORITY_LINEAGE");
 if(p.bindingId!=="9da03b35-9e00-4c46-8ff0-8f6835382349"||p.productId!==s.productId||p.sourceUrl!==b.url||
 p.market!=="KR"||p.state!=="resolved"||p.method!=="trust_official_source_review_v1"||
 p.scope!=="product"||p.sourceName!=="bushman_official")errors.push("PRODUCT_BINDING");
 if(r.reviewId!=="067e861d-2e61-4ec2-a3f7-660d78be468d"||r.bindingId!==p.bindingId||
 r.productId!==s.productId||r.subjectId!==s.subjectId||r.formulationRevisionKey!==s.formulationRevisionKey||
 r.scopeRelation!=="equivalent"||r.sourceKind!=="brand_official_product_page"||r.market!=="KR"||
 r.sourceMarket!=="KR"||r.reviewVersion!=="trust-official-source-review-v1"||r.subjectAuthorityAttestation!==false)
 errors.push("SOURCE_REVIEW");
 if(typeof b.url!=="string"||!b.url.startsWith("https://bushmankorea.com/product/"))errors.push("OFFICIAL_LOCATOR");
 if(!Array.isArray(es)||es.length!==4||new Set(es.map(z=>z.sourceId)).size!==4||
 new Set(es.map(z=>z.bindingId)).size!==4)errors.push("SOURCE_CARDINALITY");
 for(const z of es){
 if(EXPECTED.get(z.sourceId)!==z.bindingId||!HEX.test(String(z.digest))||z.url!==b.url||
 z.market!=="KR"||z.region!==null||z.bindingState!=="exact_subject_match"||z.scopeRelation!=="equivalent"||
 !["brand_official_product_page","official_product_page"].includes(z.kind)||
 !["bushman_official","주식회사 부쉬맨 / BUSHMAN"].includes(z.publisher))errors.push("EVIDENCE_SOURCE_PROVENANCE");
 }
 if(x.catalogCandidate.source!=="hwahae"||x.catalogCandidate.firstPartyCandidate!==false||
 x.catalogCandidate.noReclassification!==true)errors.push("CATALOG_RECLASSIFICATION");
 return [...new Set(errors)].sort();
}
assert.deepEqual(evaluate(e),[]);
const cases=[
 ["product",x=>x.target.productId="other","SUBJECT_SCOPE"],
 ["subject",x=>x.target.subjectId="other","SUBJECT_SCOPE"],
 ["semantic_key",x=>x.target.subjectSemanticKey="0".repeat(64),"SUBJECT_SCOPE"],
 ["formulation",x=>x.target.formulationRevisionKey="wrong","SUBJECT_SCOPE"],
 ["market",x=>x.target.market="US","SUBJECT_SCOPE"],
 ["current_count",x=>x.target.exactCurrentCount=2,"SUBJECT_SCOPE"],
 ["identity_version",x=>x.target.currentIdentityAuthority="unknown","AUTHORITY_LINEAGE"],
 ["official_binding",x=>x.sourceBridge.productSource.bindingId="other","PRODUCT_BINDING"],
 ["binding_market",x=>x.sourceBridge.productSource.market="US","PRODUCT_BINDING"],
 ["binding_method",x=>x.sourceBridge.productSource.method="unknown","PRODUCT_BINDING"],
 ["review_subject",x=>x.sourceBridge.sourceReview.subjectId="other","SOURCE_REVIEW"],
 ["review_formulation",x=>x.sourceBridge.sourceReview.formulationRevisionKey="other","SOURCE_REVIEW"],
 ["review_scope",x=>x.sourceBridge.sourceReview.scopeRelation="different","SOURCE_REVIEW"],
 ["review_false_grant",x=>x.sourceBridge.sourceReview.subjectAuthorityAttestation=true,"SOURCE_REVIEW"],
 ["official_url",x=>x.sourceBridge.url="https://unknown.example","OFFICIAL_LOCATOR"],
 ["source_removed",x=>x.sourceBridge.evidenceSources.pop(),"SOURCE_CARDINALITY"],
 ["source_duplicate",x=>x.sourceBridge.evidenceSources[0].sourceId=x.sourceBridge.evidenceSources[1].sourceId,"SOURCE_CARDINALITY"],
 ["source_digest",x=>x.sourceBridge.evidenceSources[0].digest="bad","EVIDENCE_SOURCE_PROVENANCE"],
 ["source_binding",x=>x.sourceBridge.evidenceSources[0].bindingId="other","EVIDENCE_SOURCE_PROVENANCE"],
 ["source_publisher",x=>x.sourceBridge.evidenceSources[0].publisher="unknown","EVIDENCE_SOURCE_PROVENANCE"],
 ["source_scope",x=>x.sourceBridge.evidenceSources[0].scopeRelation="different","EVIDENCE_SOURCE_PROVENANCE"],
 ["candidate_relabel",x=>x.catalogCandidate.firstPartyCandidate=true,"CATALOG_RECLASSIFICATION"]
];
for(const [name,mutation,reason] of cases){const x=structuredClone(e);mutation(x);assert.ok(evaluate(x).includes(reason),name)}
assert.equal(e.identityDiscrepancy.subjectLabel,"BUSHMAN Waterproof Pro Suncream 50g");
assert.equal(e.identityDiscrepancy.officialUrlToken,"50ml");
assert.equal(e.identityDiscrepancy.adminSkuFormulationEquivalenceAttested,false);
assert.equal(e.contract.implemented,false);
assert.equal(e.contract.preflightWriteCount,0);
assert.equal(e.contract.confirmationNotAuthorizedInR1,true);
assert.equal(e.contract.confirmationSeparateExplicitApproval,true);
assert.equal(e.contract.confirmationRechecksPrestateDigest,true);
assert.equal(e.contract.confirmationStrictIdempotency,true);
assert.deepEqual(e.contract.confirmationExpectedWriteSet,{product_fact_subjects:1,product_fact_review_events:1,admin_audit_logs:1});
for(const key of ["identityAttestationPresent","unitMismatchResolved","upgradeRpcDeployed","preflightExecuted","subjectUpgraded","semanticReviewed12","admissionGranted"])assert.equal(e.gates[key],false,key);
for(const [k,v] of Object.entries(e.safety)){if(typeof v==="number")assert.equal(v,0,k);else if(typeof v==="boolean")assert.equal(v,false,k)}
console.log(JSON.stringify({status:"PASS",stage:e.stage,structuralSource:"PASS",negativeTests:cases.length,authority:"HOLD",productionWrites:0,next:e.nextGate.stage},null,2));
