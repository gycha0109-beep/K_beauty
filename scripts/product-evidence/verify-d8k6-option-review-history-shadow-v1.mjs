#!/usr/bin/env node
// D8K-6: synthetic audit, not a hosted DB reader or authoritative seller evidence.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { selectLatestOptionReviewHistoryShadow as evaluate } from
  "../../lib/commerce/product-offer-review-history-shadow-v1.mjs";

const id=n=>"00000000-0000-4000-8000-"+n.toString(16).padStart(12,"0");
const digest="c".repeat(64), changedDigest="d".repeat(64);
const nowIso="2026-10-15T04:00:00.000Z",maxAgeMs=86400000;
const t1="2026-10-15T00:00:00.000Z", t2="2026-10-15T01:00:00.000Z",
      t3="2026-10-15T02:00:00.000Z", t4="2026-10-15T03:00:00.000Z";
const obs=(n,changes={})=>({
 observationId:id(100+n),productId:id(1),offerId:id(2),sellerOptionKey:"choice-a",
 observedAt:n===1?t1:t2,recordedAt:n===1?t2:t3,
 collectorActorKey:"ingester-a",sourceEvidenceDigest:digest,...changes
});
const rev=(n,obsId=id(101),changes={})=>({
 reviewId:id(200+n),observationId:obsId,verdict:"verified",
 reviewerActorKey:"auditor-b",evidenceDigest:digest,
 reviewedAt:n===1?t2:t3,createdAt:n===1?t3:t4,...changes
});
const run=(observations,reviews,opts={})=>evaluate({
 observations,reviews,nowIso,maxAgeMs,...opts
});
let checks=0;
const eq=(a,b,msg)=>{assert.deepEqual(a,b,msg);checks++;};
const st=(out,s,reason)=>{eq(out.optionSlots[0].state,s);eq(out.optionSlots[0].reason,reason);
 eq(out.pricePublicationAuthorized,false);eq(out.purchaseCtaAuthorized,false);};
const latestMatch="SERVER_REVIEW_IDENTITY_AND_SOURCE_NOT_PROVEN";
const older=obs(1),newer=obs(2);
const reviewedOld=rev(1), reviewedNew=rev(2,newer.observationId);
let r=run([older],[reviewedOld]);
eq(r.status,"AUDIT_SHADOW_ONLY");
eq(r.latestEligibleOptionCount,1);
st(r,"STRUCTURAL_REVIEW_MATCH",latestMatch);
eq(r.optionSlots[0].observedPrice,null);
eq(r.optionSlots[0].shippingCost,null);
eq(r.optionSlots[0].ctaHref,null);
eq(r.actualReviewerIndependenceVerified,false);

r=run([older,newer],[reviewedOld]);
st(r,"HOLD","NO_LATEST_OBSERVATION_REVIEW");
eq(r.optionSlots[0].latestObservationId,newer.observationId);
eq(r.latestEligibleOptionCount,0);
r=run([newer,older],[reviewedNew,reviewedOld]);
st(r,"STRUCTURAL_REVIEW_MATCH",latestMatch);
eq(r.optionSlots[0].latestReviewId,reviewedNew.reviewId);
const rejected=rev(3,newer.observationId,{
 reviewedAt:t4,createdAt:t4,verdict:"rejected"
});
r=run([older,newer],[reviewedOld,reviewedNew,rejected]);
st(r,"HOLD","LATEST_REVIEW_REVOKED");
eq(r.optionSlots[0].latestReviewId,rejected.reviewId);
eq(r.latestEligibleOptionCount,0);
const reverified=rev(4,newer.observationId,{
 reviewedAt:"2026-10-15T03:20:00.000Z",createdAt:"2026-10-15T03:30:00.000Z"
});
r=run([older,newer],[reviewedOld,reviewedNew,rejected,reverified]);
st(r,"STRUCTURAL_REVIEW_MATCH",latestMatch);

// Failed review of the newest observation never falls back to verified older.
r=run([older,newer],[reviewedOld,
 rev(5,newer.observationId,{verdict:"rejected"})]);
st(r,"HOLD","LATEST_REVIEW_REVOKED");

// Distinct seller options under one real parent Offer stay independent.
const otherOption=obs(10,{sellerOptionKey:"choice-b",observedAt:t2,recordedAt:t3});
r=run([newer,otherOption],[rejected,reviewedNew,
  rev(6,otherOption.observationId,{reviewedAt:t3,createdAt:t4})]);
eq(r.optionSlots.length,2);
eq(r.latestEligibleOptionCount,1);
eq(r.optionSlots.map(x=>x.state),["HOLD","STRUCTURAL_REVIEW_MATCH"]);

// Cross-reviewer and evidence-hash mismatch reject price publication.
r=run([newer],[rev(7,newer.observationId,{reviewerActorKey:"ingester-a"})]);
st(r,"HOLD","REVIEWER_EQUALS_COLLECTOR");
r=run([newer],[rev(8,newer.observationId,{evidenceDigest:changedDigest})]);
st(r,"HOLD","REVIEW_DIGEST_MISMATCH");
r=run([newer],[rev(9,newer.observationId,{reviewedAt:t1,createdAt:t3})]);
st(r,"HOLD","REVIEW_PREDATES_OBSERVATION");
r=run([newer],[]);
st(r,"HOLD","NO_LATEST_OBSERVATION_REVIEW");
// A newer unverified observation, even if recorded earlier, suppresses old.
r=run([older,newer],[reviewedOld]);
st(r,"HOLD","NO_LATEST_OBSERVATION_REVIEW");
// An older observation imported later must NOT supersede a truly newer quote.
const backfilled=obs(11,{observedAt:t1,recordedAt:t4,
 sellerOptionKey:"choice-a"});
r=run([backfilled,newer],[rev(10,backfilled.observationId)]);
eq(r.optionSlots[0].latestObservationId,newer.observationId);
st(r,"HOLD","NO_LATEST_OBSERVATION_REVIEW");

r=run([older],[reviewedOld],{nowIso:"2026-10-17T03:00:00.000Z"});
st(r,"HOLD","LATEST_OBSERVATION_STALE");
r=run([newer],[rev(12,newer.observationId,{reviewedAt:
 "2026-10-17T00:00:00.000Z",createdAt:"2026-10-17T00:00:00.000Z"})]);
eq(r.reason,"REVIEW_EVENT_INVALID_OR_ORPHANED");
r=run([newer],[rev(12,id(999))]);
eq(r.reason,"REVIEW_EVENT_INVALID_OR_ORPHANED");
r=run([newer],[rev(13,newer.observationId,{verdict:"approved"})]);
eq(r.reason,"REVIEW_EVENT_INVALID_OR_ORPHANED");
r=run([newer],[rev(14,newer.observationId,{evidenceDigest:"bad"})]);
eq(r.reason,"REVIEW_EVENT_INVALID_OR_ORPHANED");
r=run([newer],[rev(15,newer.observationId,{reviewerActorKey:"bad user"})]);
eq(r.reason,"REVIEW_EVENT_INVALID_OR_ORPHANED");
r=run([newer],[rev(15,newer.observationId,{
 reviewedAt:t3,createdAt:t2})]);
eq(r.reason,"REVIEW_EVENT_INVALID_OR_ORPHANED");
r=run([newer],[reviewedNew,reviewedNew]);
eq(r.reason,"DUPLICATE_REVIEW_EVENT");
r=run([newer],[reviewedNew,rev(99,newer.observationId)]);
eq(r.reason,"DUPLICATE_REVIEW_EVENT");
r=run([newer,newer],[]);
eq(r.reason,"DUPLICATE_OBSERVATION_HISTORY");
r=run([newer,obs(14,{observedAt:newer.observedAt})],[]);
eq(r.reason,"DUPLICATE_OBSERVATION_HISTORY");
r=run([newer,{...newer,observationId:"wrong"}],[]);
eq(r.reason,"OBSERVATION_IDENTITY_OR_SOURCE_INVALID");
r=run([obs(20,{sourceEvidenceDigest:"none"})],[]);
eq(r.reason,"OBSERVATION_IDENTITY_OR_SOURCE_INVALID");
r=run([obs(20,{collectorActorKey:"a name"})],[]);
eq(r.reason,"OBSERVATION_IDENTITY_OR_SOURCE_INVALID");
r=run([obs(20,{recordedAt:t1,observedAt:t2})],[]);
eq(r.reason,"OBSERVATION_IDENTITY_OR_SOURCE_INVALID");
r=run([obs(20,{recordedAt:"2026-10-16T00:00:00Z"})],[]);
eq(r.reason,"OBSERVATION_IDENTITY_OR_SOURCE_INVALID");
r=run([newer],[reviewedNew],{maxAgeMs:null});
eq(r.reason,"FRESHNESS_BOUNDARY_NOT_DEFINED");
r=run([newer],[reviewedNew],{maxAgeMs:2592000001});
eq(r.reason,"FRESHNESS_BOUNDARY_NOT_DEFINED");
r=run(Array.from({length:513},(_,i)=>obs(i+30,{
 sellerOptionKey:"k"+i,observedAt:t2,recordedAt:t3
})),[]);
eq(r.reason,"AUDIT_INPUT_LIMIT_OR_SHAPE");
r=run([newer],Array.from({length:2049},(_,i)=>rev(i+300,newer.observationId,{
 reviewedAt:t3,createdAt:t4
})));
eq(r.reason,"AUDIT_INPUT_LIMIT_OR_SHAPE");

const sql=readFileSync("docs/taxonomy-ai/sql/d8k5-selected-option-private-read-review-only.sql","utf8");
const schema=readFileSync("docs/taxonomy-ai/sql/d8k5-selected-option-evidence-schema-review-only.sql","utf8");
const source=readFileSync("lib/commerce/product-offer-review-history-shadow-v1.mjs","utf8");
for(const [txt,pattern] of [
 [schema,/unique \(observation_id, reviewed_at\)/],
 [schema,/offer_option_reviews_latest_idx/],
 [schema,/source_evidence_sha256 text not null/],
 [schema,/collector_actor_key text not null/],
 [schema,/reviewer_actor_key text not null/],
 [sql,/latest_review as \(/],
 [sql,/partition by r.observation_id/],
 [sql,/r.review_rank = 1/],
 [sql,/r.verdict = 'verified'/],
 [sql,/r.evidence_sha256 = ranked.source_evidence_sha256/],
 [sql,/r.reviewer_actor_key <> ranked.collector_actor_key/],
 [sql,/from public, anon, authenticated, service_role/],
 [source,/pricePublicationAuthorized:false/],
 [source,/serverDbRoleAuthorized:false/]
]) {assert.match(txt,pattern);checks++;}
assert(sql.indexOf("r.review_rank = 1") < sql.indexOf("r.verdict = 'verified'"));checks++;
assert(sql.indexOf("ranked.option_rank = 1") < sql.indexOf("r.verdict = 'verified'"));checks++;
assert.doesNotMatch(source,/fetch\(|\.rpc\(|process.env|createClient\(/);checks++;
console.log(JSON.stringify({status:"PASS",stage:"D8K6_LATEST_REVIEW_REVOCATION_AND_SOURCE_SEPARATION_SHADOW",
 assertions:checks,latestReviewRevokes:true,oldVerifiedPriceFallback:false,
 distinctReviewActorsRequired:true,matchingSourceDigestRequired:true,
 realSqlExecution:false,actualSellerData:false,pricePublished:false,
 productionReleaseAuthorized:false}));
