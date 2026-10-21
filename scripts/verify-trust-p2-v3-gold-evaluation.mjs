#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import {createHash} from "node:crypto";
import {evaluateP2V3GoldReadiness,validateP2V3CandidatePanel}
  from "../lib/trust/p2-v3-evaluation-gold-gate-v1.mjs";
import {reportP2V3GoldEvaluation} from "./report-trust-p2-v3-gold-evaluation.mjs";
const read=p=>JSON.parse(fs.readFileSync(p,"utf8"));
const panel=read("evidence/trust/p2v3-real-catalog-evaluation-panel-20261021.json");
const stress=read("evidence/trust/p2d-five-brand-cohort-v2.json");
const empty=read("evidence/trust/p2v3-independent-gold-ledger-v1.json");
const evalGold=(p=panel,s=stress,l=empty,opt={})=>
  evaluateP2V3GoldReadiness(p,s,l,opt);
const original=reportP2V3GoldEvaluation();
assert.deepEqual(original,evalGold());
assert.deepEqual(original.sample,{
  candidateCount:20,categoryCount:10,catalogSourceUrlPresent:14,
  missingCatalogQuantity:4,stressHoldoutCount:5,
});
assert.deepEqual(original.sample,validateP2V3CandidatePanel(panel,stress));
assert.equal(original.scorableIndependentlyAttestedClaims,0);
assert.equal(original.unreviewedCandidateProducts,20);
assert.equal(original.claimAccuracyOnAttempted,null);
assert.equal(original.coverageOnGold,null);
assert.equal(original.officialExactSkuConfirmed,0);
assert.equal(original.externalSourceAuthenticityProvenByCode,false);
assert.equal(original.reviewerIndependenceProvenByCode,false);
assert.equal(original.dbWrites+original.sourceBindingWrites+original.subjectWrites+
  original.factWrites+original.officialSiteRequests+original.aiApiCalls,0);
const copy=x=>structuredClone(x);
const brokenPanel=(fn,reason)=>{
  const p=copy(panel);fn(p);
  assert.throws(()=>evalGold(p),reason);
};
brokenPanel(p=>p.records[0].productId=stress.targets[0].productId,
  /INVALID_OR_LEAKED_CANDIDATE/);
brokenPanel(p=>p.records[1].productId=p.records[0].productId,
  /INVALID_OR_LEAKED_CANDIDATE/);
brokenPanel(p=>p.records[0].catalogAssertionUnverified=false,
  /INVALID_OR_LEAKED_CANDIDATE/);
brokenPanel(p=>p.records[0].catalogSizeMl=0,
  /INVALID_OR_LEAKED_CANDIDATE/);
brokenPanel(p=>p.records[0].category="different-category",
  /CATEGORY_QUOTA_NOT_MET/);
brokenPanel(p=>p.operationalSafety.dbWrites=1,/INVALID_CANDIDATE_PANEL/);
brokenPanel(p=>p.operationalSafety.firstPartyNetworkRequests=1,
  /INVALID_CANDIDATE_PANEL/);
assert.throws(()=>evalGold(panel,{...stress,targets:[...stress.targets,
  stress.targets[0]]}),/INVALID_STRESS_HOLDOUT|INVALID_CANDIDATE_PANEL/);
// Entirely synthetic in-memory positive lane tests mechanism only.
// No reviewer names, simulated excerpt or synthetic gold are committed.
const productId=panel.records[0].productId;
const dimension="PHYSICAL_UNIT_CAPACITY",value="CATALOG_MATCH";
const files=new Map();
const store=(path,data)=>{
  const bytes=Buffer.from(JSON.stringify(data),"utf8");
  files.set(path,bytes);
  return {ref:path,sha256:createHash("sha256").update(bytes).digest("hex")};
};
const source=store("evidence/trust/p2v3-review/synthetic-source.json",{
  contract:"trust-p2-v3-reviewable-source-excerpt-v1",
  productId,dimension,sourceKind:"LICENSED_FIRST_PARTY_EXCERPT",
  sourceUrl:"https://example.test/official/physical-unit-255",
  reviewScope:"synthetic 255ml unit only; source validity not established",
  observedClaim:"simulated 255ml single physical bottle",
});
function reviewer(id){
  return {reviewerId:id,...store(
    "evidence/trust/p2v3-review/synthetic-"+id+".json",{
      contract:"trust-p2-v3-human-claim-review-v1",
      reviewerId:id,productId,dimension,adjudicatedValue:value,
      sourceSha256:source.sha256,blindToModelOutput:true,
    })};
}
const two=[reviewer("test_review_a"),reviewer("test_review_b")];
const oneRecord={productId,dimension,goldValue:value,source,reviewers:two};
const ledger={...empty,records:[oneRecord]};
const readBytes=ref=>files.get(ref);
const checked=evalGold(panel,stress,ledger,{readBytes});
assert.equal(checked.scorableIndependentlyAttestedClaims,1);
assert.equal(checked.unreviewedCandidateProducts,19);
assert.equal(checked.claimAccuracyOnAttempted,null);
assert.equal(checked.coverageOnGold,0);
const pred=(v)=>[{productId,dimension,value:v}];
assert.equal(evalGold(panel,stress,ledger,{
  readBytes,predictions:pred(value)}).claimAccuracyOnAttempted,1);
assert.equal(evalGold(panel,stress,ledger,{
  readBytes,predictions:pred("CATALOG_CONFLICT")}).claimAccuracyOnAttempted,0);
assert.equal(evalGold(panel,stress,ledger,{
  readBytes,predictions:pred(value)}).coverageOnGold,1);
assert.equal(evalGold(panel,stress,ledger,{
  readBytes,predictions:pred("ABSTAIN")}).claimAccuracyOnAttempted,null);
assert.throws(()=>evalGold(panel,stress,ledger),/REVIEW_ARTIFACT_UNAVAILABLE/);
const unretainedFiles=new Map(files);
const unretainedSource=JSON.parse(unretainedFiles.get(source.ref).toString("utf8"));
unretainedSource.sourceKind="REVIEWER_AUTHORIZED_PACKAGING_PHOTO_NOT_STORED";
const unretainedBytes=Buffer.from(JSON.stringify(unretainedSource));
unretainedFiles.set(source.ref,unretainedBytes);
const unretainedLedger=copy(ledger);
unretainedLedger.records[0].source.sha256=
  createHash("sha256").update(unretainedBytes).digest("hex");
assert.throws(()=>evalGold(panel,stress,unretainedLedger,{
  readBytes:p=>unretainedFiles.get(p)}),/SOURCE_ARTIFACT_SCOPE_INVALID/);
const badLedger=(fn,reason)=>{
  const l=copy(ledger);fn(l);
  assert.throws(()=>evalGold(panel,stress,l,{readBytes}),reason);
};
badLedger(l=>l.records[0].goldValue="INDETERMINATE",/INVALID_ADJUDICATION_RECORD/);
badLedger(l=>l.records[0].reviewers[1].reviewerId="test_review_a",
  /TWO_DISTINCT_REVIEWS_REQUIRED/);
badLedger(l=>l.records[0].reviewers[1].ref=l.records[0].reviewers[0].ref,
  /TWO_DISTINCT_REVIEWS_REQUIRED/);
badLedger(l=>l.records[0].source.sha256="f".repeat(64),/REVIEW_ARTIFACT_HASH_MISMATCH/);
badLedger(l=>l.records.push(copy(l.records[0])),/INVALID_ADJUDICATION_RECORD/);
badLedger(l=>l.records[0].productId=stress.targets[0].productId,
  /INVALID_ADJUDICATION_RECORD/);
assert.throws(()=>evalGold(panel,stress,ledger,{readBytes,
  predictions:[...pred(value),...pred(value)]}),/DUPLICATE_PREDICTION/);
assert.throws(()=>evalGold(panel,stress,empty,{
  predictions:[{productId,dimension,value:"UNLICENSED"}]}),
  /INVALID_PREDICTION/);
const alternateFiles=new Map(files);
const changed=JSON.parse(alternateFiles.get(two[1].ref).toString("utf8"));
changed.blindToModelOutput=false;
alternateFiles.set(two[1].ref,Buffer.from(JSON.stringify(changed)));
assert.throws(()=>evalGold(panel,stress,ledger,{
  readBytes:p=>alternateFiles.get(p)}),/REVIEW_ARTIFACT_HASH_MISMATCH/);
console.log("TRUST_P2_V3_REAL_20_CANDIDATES_5_DIAGNOSTICS_GOLD_GATE_OFFLINE_PASS");
