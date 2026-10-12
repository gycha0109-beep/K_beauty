#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  classifyTrustIntakeIdentityReadiness as classify,
  summarizeTrustIntakeReadiness as summarize,
  TRUST_INTAKE_IDENTITY_READINESS_VERSION,
} from "../lib/trust/intake-identity-readiness-v1.mjs";

const PRODUCT="4608b3b4-8b51-4464-b46e-380b05c1a3d7";
const INTAKE="0b5963bb-67d6-4738-a620-32ec86c1e3d0";
const CANDIDATE="8c100558-f7b0-45a4-9c93-eb159eadbf3d";
const intake={
  id:INTAKE,product_id:PRODUCT,source_candidate_id:null,
  market:null,subject_id:null,identity_state:"SUBJECT_CREATION_REQUIRED",
  trust_state:"REVIEW_REQUIRED",identity_resolution_detail:{},
};
const hwahae={product_id:PRODUCT,binding_state:"resolved",source_name:"hwahae"};
const baseline={intake,taskCount:3,candidate:null,subjects:[],sourceBindings:[hwahae]};
const first=classify(baseline);
assert.equal(first.nextAction,"MARKET_EVIDENCE_REQUIRED");
assert.deepEqual(first.blockers,[
  "MARKET_EVIDENCE_REQUIRED",
  "CATALOG_IDENTITY_AUTHORITY_REQUIRED",
  "OFFICIAL_SOURCE_EVIDENCE_REQUIRED",
  "FORMULATION_ATTESTATION_REQUIRED",
]);
assert.equal(first.thirdPartyBindingCount,1);
assert.equal(first.subjectCreationAuthorized,false);
assert.equal(first.productFactWrites,0);
assert.equal(first.recommendationWrites,0);

const withMarket=classify({...baseline,intake:{...intake,market:"KR"}});
assert.equal(withMarket.nextAction,"CATALOG_IDENTITY_AUTHORITY_REQUIRED");

const candidate={
  id:CANDIDATE,matched_product_id:PRODUCT,review_status:"promoted",
  identity_resolution_state:"resolved",
  identity_resolution_evidence:{authority_boundary:{product_fact_write_allowed:false}},
};
const withCandidate=classify({...baseline,intake:{...intake,market:"KR",source_candidate_id:CANDIDATE},candidate});
assert.equal(withCandidate.nextAction,"OFFICIAL_SOURCE_EVIDENCE_REQUIRED");
// Resolved third-party link and apparent official-looking string never assert authority.
const spoof=classify({...baseline,intake:{...intake,market:"KR",source_candidate_id:CANDIDATE},
  candidate,sourceBindings:[{...hwahae,source_name:"brand_official_product_page"}]});
assert.ok(spoof.blockers.includes("OFFICIAL_SOURCE_EVIDENCE_REQUIRED"));
// New explicit, qualified authorities remain only preview, NEVER registration.
const ready=classify({...baseline,intake:{...intake,market:"KR",source_candidate_id:CANDIDATE},
  candidate,qualifiedOfficialEvidence:true,formulationAttested:true});
assert.equal(ready.nextAction,"GOVERNED_SUBJECT_PREFLIGHT_REQUIRED");
assert.equal(ready.subjectCreationAuthorized,false);
const subject=classify({...baseline,intake:{...intake,market:"KR",source_candidate_id:CANDIDATE},
  candidate,subjects:[{product_id:PRODUCT,identity_status:"resolved",current_state:"current"}]});
assert.equal(subject.nextAction,"SUBJECT_ALREADY_EXISTS");
assert.throws(()=>classify({...baseline,sourceBindings:[{...hwahae,product_id:INTAKE}]}),
  /TRUST_READINESS_SCOPE_MISMATCH/);
assert.throws(()=>classify({...baseline,intake:{...intake,identity_state:"EXACT_SUBJECT_FOUND"}}),
  /TRUST_READINESS_NOT_SUBJECT_CREATION_BACKLOG/);
assert.throws(()=>classify({...baseline,taskCount:0}),
  /TRUST_READINESS_INVALID_INPUT/);
const report=summarize([first]);
assert.equal(report.version,TRUST_INTAKE_IDENTITY_READINESS_VERSION);
assert.equal(report.products,1);
assert.equal(report.blockedTasks,3);
assert.equal(report.productsWithResolvedBindings,1);
assert.equal(report.eligibleForAutomaticSubjectCreation,0);
assert.throws(()=>summarize([first,first]),/TRUST_READINESS_DUPLICATE_PRODUCT/);

const server=fs.readFileSync("lib/admin/trust-intake-readiness.js","utf8");
const page=fs.readFileSync("app/admin/products/trust/identity-readiness/page.js","utf8");
const nav=fs.readFileSync("app/admin/AdminNavigation.js","utf8");
assert.match(server,/^import "server-only";/);
for(const table of ["catalog_trust_intake","product_fact_research_tasks",
  "product_source_bindings","product_fact_subjects","product_candidates","products"])
  assert.ok(server.includes('"'+table+'"'),"reader missing "+table);
for(const marker of ["qualifiedOfficialEvidence:false","formulationAttested:false",
  "READINESS_INTAKE_LIMIT_EXCEEDED","READINESS_TASK_MISSING"])
  assert.ok(server.includes(marker),"reader safety marker missing "+marker);
for(const invalid of [".insert(",".update(",".upsert(",".delete(",".rpc(","fetch(","openai","gemini"])
  assert.ok(!server.toLowerCase().includes(invalid.toLowerCase()),
    "reader must be read only/no AI: "+invalid);
assert.match(page,/requireAdminCapability\(ADMIN_CAPABILITIES.PRODUCTS_REVIEW\)/);
assert.match(page,/if\(!access.allowed \|\| !access.userId\) notFound\(\)/);
assert.match(page,/loadTrustIntakeReadiness\(\)/);
assert.match(page,/조회에 실패했습니다/);
assert.match(page,/상품·Subject 생성이나 Fact 승인을 실행하지 않습니다/);
assert.match(page,/slice\(0,60\)/);
assert.match(nav,/href: "\/admin\/products\/trust\/identity-readiness"/);
assert.match(nav,/capability: ADMIN_CAPABILITIES.PRODUCTS_REVIEW/);
console.log(JSON.stringify({status:"PASS",phase:"TRUST_IDENTITY_READINESS_P0_P1",
  subjectMutation:0,factMutation:0,recommendationMutation:0,aiApiCalls:0},null,2));
