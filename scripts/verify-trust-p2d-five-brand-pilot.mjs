#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  assertTrustP2DCohort,cohortToTrustedDiscoveryRow,
  assessTrustP2DDiscovery,runTrustP2DFiveBrandPilot,
  summarizeTrustP2D,runTrustP2DCli,
} from "./trust-p2d-five-brand-pilot.mjs";
const cohort=JSON.parse(fs.readFileSync("evidence/trust/p2d-five-brand-cohort-v1.json","utf8"));
assert.equal(assertTrustP2DCohort(cohort),true);
assert.equal(cohort.targets.length,5);
assert.equal(new Set(cohort.targets.map(t=>t.brand)).size,5);
assert.equal(new Set(cohort.targets.map(t=>new URL(t.officialPeerUrl).origin)).size,5);
for(const target of cohort.targets){
  const row=cohortToTrustedDiscoveryRow(target);
  assert.equal(row.discoveryOrigins.length,1);
  assert.equal(row.discoveryOrigins[0].evidenceRefs.length,1);
  assert.equal(row.discoveryOrigins[0].evidenceRefs[0].peerOfficialLocator,target.officialPeerUrl);
  assert.equal(row.subjectCreationAuthorized,false);
  assert.equal(row.marketVerified,false);
}
const duplicate=structuredClone(cohort);
duplicate.targets[1].brand=duplicate.targets[0].brand;
assert.throws(()=>assertTrustP2DCohort(duplicate),/P2D_INVALID_OR_DUPLICATE_BRAND/);
const authority=structuredClone(cohort);
authority.targets[0].peerKind="hwahae_review";
assert.throws(()=>assertTrustP2DCohort(authority),/P2D_INVALID_IDENTITY_SNAPSHOT/);

const BASE={
  readOnly:true,subjectCreationAuthorized:false,officialProductEvidenceConfirmed:false,
  factWrites:0,recommendationWrites:0,aiApiCalls:0,marketVerified:false,
  formulationVerified:false,
};
const page=(status,url="https://www.torriden.com/goods/goods_view.php?goodsNo=808")=>
  ({url,status,sha256:"f".repeat(64)});
function assessed(siteStatus,pages){
  return assessTrustP2DDiscovery({...BASE,sites:[{
    status:siteStatus,pages,origin:"https://www.torriden.com",
  }]});
}
assert.equal(assessed("ROBOTS_UNAVAILABLE",[]).state,"SOURCE_POLICY_HOLD");
assert.equal(assessed("ROBOTS_DISALLOWED",[]).state,"SOURCE_POLICY_HOLD");
assert.equal(assessed("NO_SAFE_CANDIDATE",[]).state,"NO_PRODUCT_PAGE");
// The live diagnostic path preserves only locator/status/title/digest; no raw pages.
const diagnosticMock={
  fetchRobots:async()=>({bytes:Buffer.from("User-agent: *\\nAllow: /\\n")}),
  fetchSitemap:async url=>({bytes:Buffer.from(url.endsWith("sitemap.xml")?
    '<urlset><url><loc>https://neopharmshop.co.kr/product/mle-%EB%A1%9C%EC%85%98/3000</loc></url></urlset>':
    "<urlset></urlset>"),finalUrl:url}),
  fetchPage:async url=>({bytes:Buffer.from("<title>MLE 로션 - 아토팜</title>"),finalUrl:url}),
};
const diagnosticCohort=structuredClone(cohort);
diagnosticCohort.targets[0].officialPeerUrl="https://neopharmshop.co.kr/product/peer/2166";
// The other 4 domains are intentionally not contacted in this deterministic fixture.
const mock=await runTrustP2DFiveBrandPilot({execute:true,cohort,fetchers:diagnosticMock});
assert.equal(mock.items.length,5);
assert.equal(mock.items[0].assessment.sourceDiagnostics.length,1);
assert.ok(Array.isArray(mock.items[0].assessment.sourceDiagnostics[0].pages));
assert.equal(JSON.stringify(mock).includes("<title>"),false);
assert.equal(mock.summary.dbWrites,0);
assert.equal(assessed("CANDIDATES_DISCOVERED",[page("SCOPED_HEADING_CANDIDATE")]).state,
 "IDENTITY_CANDIDATE_REVIEW_REQUIRED");
assert.equal(assessed("CANDIDATES_DISCOVERED",[page("BODY_NAME_MENTION_ONLY")]).state,
 "BODY_MENTION_REVIEW_REQUIRED");
assert.equal(assessed("CANDIDATES_DISCOVERED",[page("IDENTITY_UNRESOLVED")]).state,
 "NO_MATCHING_PRODUCT_IDENTITY");
assert.equal(assessed("CANDIDATES_DISCOVERED",[
 page("STRUCTURED_NAME_CANDIDATE"),page("SCOPED_HEADING_CANDIDATE"),
]).distinctCandidateLocators,1);
assert.throws(()=>assessTrustP2DDiscovery({...BASE,factWrites:1,sites:[]}),
 /P2D_UNSAFE_DISCOVERY_RESULT/);
const plan=await runTrustP2DFiveBrandPilot({execute:false,cohort});
assert.equal(plan.summary.processedProducts,5);
assert.equal(plan.summary.officialPagesFetched,0);
assert.equal(plan.summary.aiApiCalls,0);
assert.equal(plan.summary.dbWrites,0);
assert.equal(plan.summary.identityCandidateProducts,0);
assert.equal(plan.mode,"PLAN_ONLY_NO_NETWORK");
assert.equal(plan.items.every(x=>x.subjectCreationAuthorized===false),true);
const five=cohort.targets.map((t,i)=>({
  productId:t.productId,assessment:i===0
    ?assessed("CANDIDATES_DISCOVERED",[page("SCOPED_HEADING_CANDIDATE")])
    :i===1
      ?assessed("CANDIDATES_DISCOVERED",[page("BODY_NAME_MENTION_ONLY")])
      :i===2?assessed("CANDIDATES_DISCOVERED",[page("IDENTITY_UNRESOLVED")])
        :assessed("ROBOTS_UNAVAILABLE",[]),
}));
const summary=summarizeTrustP2D(five);
assert.equal(summary.identityCandidateProducts,1);
assert.equal(summary.productIdentificationRate,0.2);
assert.equal(summary.falsePositiveVerifiedCount,undefined);
assert.equal(summary.zeroFalsePositiveAssertionNotMade,true);
assert.equal(summary.factWrites,0);
assert.throws(()=>summarizeTrustP2D(five.slice(0,4)),/P2D_INVALID_REPORT_ROWS/);
const previous=process.env.TRUST_P2D_FIVE_BRAND_LIVE_ENABLED;
delete process.env.TRUST_P2D_FIVE_BRAND_LIVE_ENABLED;
try{
  await assert.rejects(()=>runTrustP2DCli(["--execute"]),/P2D_LIVE_DISABLED/);
}finally{
  if(previous===undefined)delete process.env.TRUST_P2D_FIVE_BRAND_LIVE_ENABLED;
  else process.env.TRUST_P2D_FIVE_BRAND_LIVE_ENABLED=previous;
}
const source=fs.readFileSync("scripts/trust-p2d-five-brand-pilot.mjs","utf8");
for(const forbidden of [".insert(", ".update(", ".upsert(", ".delete(", ".rpc(",
 "SUPABASE_SERVICE_ROLE_KEY","openai","gemini"]){
  assert.ok(!source.toLowerCase().includes(forbidden.toLowerCase()),"P2D forbidden call "+forbidden);
}
assert.match(source,/runTrustP2Discovery/);
assert.match(source,/trustP2LiveFetchers/);
assert.match(source,/zeroFalsePositiveAssertionNotMade:true/);
console.log("TRUST_P2D_FIVE_BRAND_COHORT_AND_ASSESSMENT_PASS");
