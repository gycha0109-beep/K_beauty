#!/usr/bin/env node
// D8K-13 non-mutating source/runtime contract. All IDs and records synthetic.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {randomUUID} from "node:crypto";
import {
 listR16ID8C,createR16IProposal,validateR16IVerdict,r16iBaselineDigest
} from "../../lib/product-intelligence/r16i-correction-approval-ledger.mjs";
import {R16I_PRODUCT_ID} from "../../lib/product-offer-r16i-r4-d4-live-review.mjs";

let n=0;
const eq=(a,b)=>{assert.deepEqual(a,b);n++};
const yes=x=>{assert.ok(x);n++};
const has=(s,re)=>{assert.match(s,re);n++};
const lacks=(s,re)=>{assert.doesNotMatch(s,re);n++};
const evidence1=randomUUID(),evidence2=randomUUID();
const verdict1=randomUUID(),verdict2=randomUUID();
const snapshot1=randomUUID(),snapshot2=randomUUID();
const now=new Date().toISOString();
const review={
 decision:"REVIEW_REQUIRED",product_id:R16I_PRODUCT_ID,
 product_revision:"2026-09-10T00:32:38.713599Z",live_read_verified:true,
 revision_matches:true,collision_free:true,
 reviewed_fields:Array.from({length:20},(_,i)=>({
  entity:i<5?"products":"other",
  field:i===0?"size_ml":i===1?"price_min":i===2?"price_max":
   i===3?"unit_price_per_10ml":i===4?"buy_link":"field_"+i,
  before:i===0?160:i===1||i===2?29900:
   i===3?1868.75:i===4?"https://www.hwahae.co.kr/goods/45194":null
 }))
};
const historicEvent=(evidenceId,verdictId,snapshotId,sequence)=>({
 event_sequence:sequence,evidence_id:evidenceId,current_verdict_id:verdictId,
 verdict:"LEGACY_QUARANTINED",origin:"D8K13_LEGACY_RECONCILIATION",
 legacy_snapshot_id:snapshotId,reason:"Historic self-review quarantined",
 recorded_at:now
});
const original={
 admin_product_correction_evidence_verdicts_v1:[
  {verdict_id:verdict1,evidence_id:evidence1,verdict:"REJECTED",
   reason:"Original self-review before quarantine",reviewed_at:now},
  {verdict_id:verdict2,evidence_id:evidence2,verdict:"REJECTED",
   reason:"Original self-review before quarantine",reviewed_at:now}
 ],
 admin_product_correction_evidence_review_events_v2:[
  historicEvent(evidence1,verdict1,snapshot1,2),
  historicEvent(evidence2,verdict2,snapshot2,1)
 ],
 admin_product_correction_proposals_v1:[],
 admin_product_correction_decisions_v1:[],
 admin_product_correction_evidence_v1:[
  {evidence_id:evidence1,product_id:R16I_PRODUCT_ID,
   source_key:"official_single",
   source_url:"https://www.snature.kr/product/detail.html?product_no=151"},
  {evidence_id:evidence2,product_id:R16I_PRODUCT_ID,
   source_key:"hwahae_bundle",
   source_url:"https://www.hwahae.co.kr/goods/45194"}
 ]
};
function mock({changeEvent=null,firstCurrent=null,dropEvent=false}={}){
 const rows=structuredClone(original);
 if(changeEvent)Object.assign(rows.admin_product_correction_evidence_review_events_v2[0],changeEvent);
 if(firstCurrent)rows.admin_product_correction_evidence_verdicts_v1[0].verdict=firstCurrent;
 if(dropEvent)rows.admin_product_correction_evidence_review_events_v2.shift();
 return {
  from(table){
   if(!Object.hasOwn(rows,table))throw Error("Unexpected read "+table);
   const filters=[];
   const q={
    select(){return q;},
    order(){return q;},
    eq(k,v){filters.push(row=>row[k]===v);return q;},
    in(k,vs){filters.push(row=>vs.includes(row[k]));return q;},
    limit:async()=>({
     data:rows[table].filter(x=>filters.every(fn=>fn(x))),
     error:null
    })
   };
   return q;
  }
 };
}
let x=await listR16ID8C(mock(),review);
eq(x.verdicts.length,2);
eq(x.verdicts.map(x=>x.verdict),["LEGACY_QUARANTINED","LEGACY_QUARANTINED"]);
eq(x.reviewHistory.map(x=>x.origin),[
 "D8K13_LEGACY_RECONCILIATION","D8K13_LEGACY_RECONCILIATION"
]);
eq(x.releaseReady,false);
eq(x.writeAuthorized,false);
const submit={
 strategy:"A_PRODUCT_ANCHOR_REUSE_AND_OFFER_SEPARATION",
 baselineSha256:r16iBaselineDigest(review),
 productRevision:review.product_revision,
 fieldChanges:[{field:"products.size_ml",before:160,after:80}],
 evidenceIds:[evidence1,evidence2],requestId:randomUUID(),
 rationale:"Quarantined legacy captures must never create a product change"
};
await assert.rejects(()=>createR16IProposal(mock(),submit,randomUUID(),review),
 /R16I_D8C_EVIDENCE_NOT_VERIFIED/);n++;
for(const bad of [
 {changeEvent:{origin:"D8K12_HUMAN_REVIEW"}},
 {changeEvent:{legacy_snapshot_id:null}},
 {changeEvent:{verdict:"VERIFIED"}},
 {changeEvent:{current_verdict_id:randomUUID()}},
 {firstCurrent:"VERIFIED"},
 {dropEvent:true}
]){
 await assert.rejects(()=>listR16ID8C(mock(bad),review),
 /R16I_D8K13_LEGACY_PROVENANCE_INVALID|R16I_D8K12_CURRENT_VERDICT_HISTORY_MISMATCH/);
 n++;
}
assert.throws(()=>validateR16IVerdict({
 evidenceId:evidence1,verdict:"LEGACY_QUARANTINED",
 reason:"Forged legacy provenance",requestId:randomUUID()
}),/R16I_D8C_INVALID_EVIDENCE_REVIEW/);n++;

const migration=readFileSync(
 "supabase/migrations/20261015185000_taxonomy_ai_r16i_d8k12_owner_review_revocation_v1.sql","utf8");
const d8dv2Migration=readFileSync(
 "supabase/migrations/20261014150000_taxonomy_ai_r16i_d8d_v2_owner_gated_dual_offer.sql","utf8");
const ledger=readFileSync(
 "lib/product-intelligence/r16i-correction-approval-ledger.mjs","utf8");
const ui=readFileSync(
 "app/admin/products/r16i-correction-review/R16IR4D8CorrectionApproval.js","utf8");
const runner=readFileSync(
 "scripts/product-evidence/run-d8k13-local-pg17.mjs","utf8");
const seed=readFileSync(
 "tests/fixtures/r16i-d8k13/00_legacy_self_review_pg17.sql","utf8");
const fixture=readFileSync(
 "tests/fixtures/r16i-d8k13/10_quarantine_runtime_pg17.sql","utf8");
for(const re of [
 /D8K12_EXISTING_VERDICTS_REQUIRE_EXPLICIT_RECONCILIATION/,
 /current_setting\('app\.d8k13_release_ticket',true\)/,
 /current_setting\('app\.d8k13_expected_manifest',true\)/,
 /observed_manifest IS DISTINCT FROM expected_manifest/,
 /D8K13_UNEXPECTED_LEGACY_SCHEMA/,
 /D8K13_UNEXPECTED_LEGACY_SHAPE/,
 /SHARE ROW EXCLUSIVE MODE/,
 /CREATE TABLE public\.admin_product_correction_legacy_verdict_quarantine_v1/,
 /original_verdict text NOT NULL CHECK\(original_verdict='VERIFIED'\)/,
 /original_reason text NOT NULL/,
 /original_reviewer_id uuid NOT NULL/,
 /original_submitted_by uuid NOT NULL/,
 /original_request_id uuid NOT NULL/,
 /original_reviewed_at timestamptz NOT NULL/,
 /D8K13_IMMUTABLE_LEGACY_AUDIT/,
 /LEGACY_QUARANTINED/,
 /D8K13_LEGACY_RECONCILIATION/,
 /SET verdict='REJECTED'/,
 /D8K13_LEGACY_QUARANTINE_POSTCONDITION_FAILED/,
 /D8K13_UNEXPECTED_D8DV2_ACTIVITY/,
 /D8K13_UNEXPECTED_D8DV2_SCHEMA/,
 /D8K13_UNEXPECTED_D8DV2_SECURITY/,
 /r16i_d8d_rollback_v2\(uuid,uuid,uuid\)'\)\) IS DISTINCT FROM true/,
 /has_function_privilege\('service_role'/,
 /has_function_privilege\('anon'/,
 /has_function_privilege\('authenticated'/,
 /pg_catalog\.pg_advisory_xact_lock\(195721,16\)/,
 /LOCK TABLE public\.admin_r16i_d8d_v2_gate/,
 /pg_catalog\.cardinality\(actual_columns\)/,
 /SELECT x\.val FROM unnest\(actual_columns\)/,
 /SELECT y\.val FROM unnest\(expected_columns\)/,
 /D8K13_UNEXPECTED_D8DV2_SCHEMA table=% actual=% expected=%/,
 /relrowsecurity/,
 /REVOKE ALL ON public\.admin_product_correction_evidence_verdicts_v1/,
 /GRANT SELECT ON public\.admin_product_correction_evidence_verdicts_v1/,
 /e\.submitted_by=p_actor_id/,
 /D8K12_PREVIOUS_VERDICT_IS_TERMINAL_OR_UNAUDITED/
])has(migration,re);
for(const re of [
 /R16I_D8K13_LEGACY_PROVENANCE_INVALID/,
 /verdict==="LEGACY_QUARANTINED"\?"REJECTED"/,
 /reviewHistory/,
 /origin:event\.origin/,
 /event\.current_verdict_id!==entry\.verdict_id/
])has(ledger,re);
for(const re of [/과거 자기 승인 — 효력 격리/,/과거 자기 승인 — 격리/])has(ui,re);
for(const re of [
 /D8K13_D8DV2_REAL_ORDER_CHAIN_ACCEPTANCE_PASS/,
 /D8K13_D8DV2_DRIFT_REFUSAL_AND_ROLLBACK_PASS/,
 /D8K13_PG17_FINAL_TCP_READY/,
 /PG17_FINAL_TCP_SERVER_NOT_READY/,
 /pg_isready","-q","-h","127\.0\.0\.1"/,
 /PGPASSWORD=disposable-local-only/,
 /--network=none/,
 /d8k13_v2_gate_on/,
 /d8k13_v2_authorization/,
 /d8k13_v2_column_drift/,
 /d8k13_v2_rpc_escalation/,
 /d8k13_v2_rollback_security_drift/,
 /d8k13_v2_public_rollback_exec/,
 /d8k13_v2_missing_service_role_exec/,
 /d8k13_v2_anon_read/,
 /d8k13_v2_missing_event_table/,
 /D8K13_PG17_LEGACY_TWO_ROW_QUARANTINE_PASS/,
 /D8K13_PG17_DRIFT_REFUSAL_AND_ROLLBACK_PASS/,
 /D8K13_LOCAL_DOCKER_PG17_PASS/,
 /d8k13_no_ticket/,
 /d8k13_one_verdict/,
 /d8k13_existing_proposal/,
 /d8k13_gate_on/,
 /d8k13_v2_schema/
])has(runner,re);
for(const re of [
 /CREATE TABLE public\.admin_r16i_d8d_v2_gate/,
 /CREATE TABLE public\.admin_r16i_d8d_v2_events/,
 /CREATE FUNCTION public\.r16i_d8d_apply_v2\([\s\S]*?\) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER/,
 /CREATE FUNCTION public\.r16i_d8d_rollback_v2\([\s\S]*?\) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER/
])has(d8dv2Migration,re);
for(const re of [/admin_product_correction_evidence_verdicts_v1/,/000000000101/,/000000000102/])has(seed,re);
for(const re of [
 /D8K13_ORIGINAL_AUDIT_NOT_PRESERVED/,
 /D8K13_ORIGINAL_DECISION_DETAILS_CHANGED/,
 /D8K13_NEW_INDEPENDENT_REVIEW_REGRESSION/,
 /D8K13_IMMUTABLE_LEGACY_AUDIT/
])has(fixture,re);
lacks(migration,/\b(?:INSERT|UPDATE|DELETE)\s+(?:public\.)?(?:products|product_offers|product_fact_subjects)\b/i);
console.log(JSON.stringify({
 status:"PASS",stage:"D8K13_LEGACY_SELF_REVIEW_RECONCILIATION_CONTRACT",
 assertions:n,syntheticOnly:true,hostedDatabaseWrites:0,
 nativePostgreSQLExecuted:false,productionReleaseAuthorized:false
}));
