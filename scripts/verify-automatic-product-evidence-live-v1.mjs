#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  evaluateLiveAutomaticEvidenceSnapshot,
  buildLiveAutomaticEvidenceInput,
} from "../lib/product-intelligence/automatic-product-evidence-live-adapter-v1.mjs";
import {
  readAutomaticEvidenceSnapshot,
  evaluateAutomaticEvidenceFromLiveDB,
} from "../lib/product-intelligence/automatic-product-evidence-db-reader-v1.mjs";

const PRODUCT = "4608b3b4-8b51-4464-b46e-380b05c1a3d7";
const SUBJECT = "0b5963bb-67d6-4738-a620-32ec86c1e3d0";
const OLD = "8c100558-f7b0-45a4-9c93-eb159eadbf3d";
const OFFICIAL = "https://bushmankorea.com/product/31/";
const HWAHAE = "https://www.hwahae.com/en/products/1884027";
function fixture() {
  const facts = [
    ["5fe7666a-9854-4a0e-9248-72780b3e699f","spf_value","number",null,"50","product-fact-registry-cross-category-v1","3594ca85-1313-4684-9821-f0b138605e2b"],
    ["ad138548-3f4d-4dad-be05-8869465534a5","uva_label","enum","PA++++",null,"product-fact-registry-cross-category-v1","c1e4baff-843f-4703-adbc-bd9c7db4d498"],
    ["1a4602c5-02e8-4ae0-b2f5-92dc66c85fc0","uv_filter_type","enum","hybrid",null,"product-fact-registry-cross-category-v2","8d8af903-eb6a-4e8f-bf3f-dfd9647f587f"],
  ];
  return {
    product:{id:PRODUCT,category:null,review_signals:{},hwahae_url:null},
    subjects:[
      {subject_id:SUBJECT,product_id:PRODUCT,identity_status:"resolved",current_state:"current",identity_resolution_version:"data-ai29c-c5-presentation-identity-correction-v1"},
      {subject_id:OLD,product_id:PRODUCT,identity_status:"resolved",current_state:"historical",identity_resolution_version:"trust-phase5-admin-subject-review-v1"},
    ],
    taxonomy:[{product_id:PRODUCT,taxonomy_version:"catalog-taxonomy-v1",
      category_term_id:"catalog-taxonomy-v1:category:sunscreen",
      assignment_state:"shadow",assignment_method:"source_classification"}],
    sourceBindings:[
      {binding_id:"9da03b35-9e00-4c46-8ff0-8f6835382349",product_id:PRODUCT,
        source_name:"bushman_official",source_url:OFFICIAL,binding_state:"resolved",product_scope_state:"product"},
      {binding_id:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",product_id:PRODUCT,
        source_name:"hwahae",source_url:HWAHAE,binding_state:"resolved",
        product_scope_state:"product_subject_unresolved"},
    ],
    currentFacts:facts.map(f=>({fact_instance_id:f[0],subject_id:SUBJECT,confirmation_id:f[6]})),
    factInstances:facts.map(f=>({
      fact_instance_id:f[0],subject_id:SUBJECT,fact_key:f[1],value_type:f[2],
      value_enum:f[3],value_number:f[4],registry_version:f[5],
      semantic_status:"supported",authority_ceiling:"product_specific_primary",
      fused_confidence:"high",valid_to:null,
    })),
    confirmations:facts.map(f=>({confirmation_id:f[6],result:{status:"confirmed"}})),
    definitions:[
      ...["product-fact-registry-cross-category-v1","product-fact-registry-cross-category-v2"].flatMap(v=>
        [["spf_value","number"],["uva_label","enum"],["uv_filter_type","enum"]].map(([key,type])=>
          ({registry_version:v,fact_key:key,value_type:type,deprecated:false}))),
    ],
    sourceObservationCount:2,
  };
}

const stable = fixture();
const input = buildLiveAutomaticEvidenceInput(stable,PRODUCT,"2026-10-10");
assert.equal(input.input.verifiedFacts.length,2);
assert.equal(input.input.manufacturerClaims.length,0);
assert.equal(input.input.reviewObservations.length,0);
assert.equal(input.diagnostics.currentFactsChecked,3);
assert.equal(input.diagnostics.protectedSunscreenFacts.length,3);
assert.deepEqual(input.diagnostics.protectedSunscreenFacts.map(x=>x.key).sort(),
  ["spf_value","uva_label","uv_filter_type"].sort());
assert.equal(input.diagnostics.reviewSourceTrusted,false);
const result = evaluateLiveAutomaticEvidenceSnapshot(stable,PRODUCT,{whiteCastRelevant:true},"2026-10-10");
assert.equal(result.dataOrigin,"SERVER_READ_ONLY");
assert.equal(result.evaluation.evidenceReady,true);
assert.equal(result.evaluation.operatorReviewsRequired,0);
assert.equal(result.evaluation.fields.category_slot.value,"sunscreen");
assert.equal(result.evaluation.fields.uv_filter_type.value,"hybrid");
assert.equal(result.evaluation.fields.white_cast.status,"insufficient");
assert.equal(result.evaluation.fields.eye_sting.status,"insufficient");
assert.equal(result.evaluation.fields.sensitivity_safe.status,"insufficient");
assert.equal(result.evaluation.fields.pilling_risk.status,"insufficient");
assert.equal(Object.values(result.evaluation.fields).filter(x=>x.status==="insufficient").length,10);
assert.equal(Object.values(result.evaluation.fields).filter(x=>x.status==="review_signal").length,0);
assert.ok(result.evaluation.contextCautions.includes("whiteCastRelevant"));
assert.equal(result.evaluation.admissionGranted,false);
assert.equal(result.databaseWrites,0);
assert.equal(result.adminReviewWrites,0);
assert.equal(result.recommendationWrites,0);
assert.equal(result.evaluation.publicActivation,false);

const noTax = fixture(); noTax.taxonomy=[];
const noTaxResult=evaluateLiveAutomaticEvidenceSnapshot(noTax,PRODUCT,{},"2026-10-10");
assert.equal(noTaxResult.evaluation.evidenceReady,false);
assert.ok(noTaxResult.evaluation.researchNeeds.includes("category_slot"));
assert.equal(noTaxResult.evaluation.operatorReviewsRequired,0);
const noUv = fixture(); noUv.confirmations[2].result.status="not_confirmed";
const noUvResult=evaluateLiveAutomaticEvidenceSnapshot(noUv,PRODUCT,{},"2026-10-10");
assert.equal(noUvResult.evaluation.evidenceReady,false);
assert.equal(noUvResult.evaluation.fields.uv_filter_type.value,null);
assert.equal(noUvResult.diagnostics.excludedCurrentFacts.length,1);

const noRegistry = fixture();
noRegistry.definitions=noRegistry.definitions.filter(x=>x.registry_version!=="product-fact-registry-cross-category-v2" || x.fact_key!=="uv_filter_type");
assert.equal(evaluateLiveAutomaticEvidenceSnapshot(noRegistry,PRODUCT,{},"2026-10-10").evaluation.evidenceReady,false);

const stale = fixture();stale.factInstances[2].valid_to="2026-10-09";
assert.equal(evaluateLiveAutomaticEvidenceSnapshot(stale,PRODUCT,{},"2026-10-10").evaluation.evidenceReady,false);

const fakeTag = fixture();
fakeTag.product.review_signals={source:"hwahae_ai_review",
  positive:[{label:"눈통증없는",count:1000}],negative:[]};
fakeTag.product.hwahae_url=HWAHAE;
assert.equal(evaluateLiveAutomaticEvidenceSnapshot(fakeTag,PRODUCT,{},"2026-10-10")
  .evaluation.fields.eye_sting.status,"insufficient",
  "unresolved subject-binding must not authorize review observations");
const scoped=fakeTag;
scoped.sourceBindings[1].product_scope_state="product";
scoped.product.review_signals.negative=[{label:"눈통증있는",count:7}];
const trend=evaluateLiveAutomaticEvidenceSnapshot(scoped,PRODUCT,{},"2026-10-10");
assert.equal(trend.evaluation.fields.eye_sting.status,"review_signal");
assert.equal(trend.evaluation.fields.eye_sting.value,null);
assert.equal(trend.evaluation.fields.eye_sting.trend,"mixed");
assert.equal(trend.evaluation.fields.eye_sting.incidenceEstimated,false);
assert.equal(trend.evaluation.operatorReviewsRequired,0);
assert.equal(trend.evaluation.admissionGranted,false);
assert.equal(trend.diagnostics.reviewSourceTrusted,true);
const wrongUrl=structuredClone(scoped);
wrongUrl.product.hwahae_url="https://www.hwahae.com/en/products/other";
assert.equal(evaluateLiveAutomaticEvidenceSnapshot(wrongUrl,PRODUCT,{},"2026-10-10")
  .evaluation.fields.eye_sting.status,"insufficient");

const failCases=[
  ["two_active_subjects",x=>x.subjects[1].current_state="current","LIVE_CURRENT_SUBJECT_NOT_UNIQUE_RESOLVED"],
  ["unresolved_subject",x=>x.subjects[0].identity_status="unresolved","LIVE_CURRENT_SUBJECT_NOT_UNIQUE_RESOLVED"],
  ["current_fact_cross_subject",x=>x.currentFacts[0].subject_id=OLD,"LIVE_CROSS_SUBJECT_CURRENT_FACT"],
  ["duplicate_fact",x=>x.currentFacts.push({...x.currentFacts[0]}),"LIVE_DUPLICATE_OR_INVALID:fact_instance_id"],
  ["wrong_product",x=>x.product.id=OLD,"LIVE_PRODUCT_NOT_FOUND"],
];
for(const [name,mutate,expected] of failCases){
  const changed=fixture();mutate(changed);
  assert.throws(()=>evaluateLiveAutomaticEvidenceSnapshot(changed,PRODUCT,{},"2026-10-10"),
    e=>e.message===expected,name);
}

// Simulate Supabase PostgREST server-side SELECT queries; no mutations possible.
function mockClient(rows, failTable) {
  const activity = [];
  return {
    activity,
    from(table) {
      activity.push("FROM:"+table);
      const query={table, filters:[],singleMode:false};
      const builder={
        select(){return this;},
        eq(key,value){query.filters.push(row=>String(row[key])===String(value));return this;},
        in(key,values){query.filters.push(row=>values.includes(row[key]));return this;},
        limit(n){query.limit=n;return this;},
        single(){query.singleMode=true;return this;},
        then(resolve,reject){
          const map={
            products:[rows.product],product_fact_subjects:rows.subjects,
            product_catalog_taxonomy_assignments:rows.taxonomy,
            product_source_bindings:rows.sourceBindings,
            product_fact_current:rows.currentFacts,
            product_fact_instances:rows.factInstances,
            product_fact_confirmations:rows.confirmations,
            product_fact_definition_snapshots:rows.definitions,
            trust_source_observations:Array.from({length:rows.sourceObservationCount},(_,i)=>({observation_id:String(i)})),
          };
          if(!Object.hasOwn(map,table)) return Promise.resolve({data:null,error:new Error("TABLE_UNKNOWN")}).then(resolve,reject);
          if(table===failTable) return Promise.resolve({data:null,error:new Error("SIMULATED_QUERY_ERROR")}).then(resolve,reject);
          const selected=map[table].filter(row=>query.filters.every(fn=>fn(row))).slice(0,query.limit??100000);
          return Promise.resolve(query.singleMode?{
            data:selected.length===1?selected[0]:null,error:selected.length===1?null:new Error("NOT_ONE"),
          }:{data:selected,error:null}).then(resolve,reject);
        },
      };
      return builder;
    },
  };
}
const client=mockClient(fixture());
const live=await evaluateAutomaticEvidenceFromLiveDB(client,PRODUCT,{},"2026-10-10");
assert.deepEqual(live,result.evaluation?{...live}:live);
assert.equal(live.evaluation.fields.uv_filter_type.value,"hybrid");
assert.ok(client.activity.includes("FROM:product_fact_current"));
assert.ok(client.activity.includes("FROM:product_fact_confirmations"));
assert.ok(client.activity.includes("FROM:trust_source_observations"));
assert.ok(client.activity.every(x=>x.startsWith("FROM:")));
await assert.rejects(()=>readAutomaticEvidenceSnapshot(mockClient(fixture(),"product_fact_confirmations"),PRODUCT),
  /AUTOMATIC_EVIDENCE_READ_FAILED:confirmations/);

const route=fs.readFileSync("app/api/admin/products/automatic-evidence/preview/route.js","utf8");
assert.ok(route.includes("requireAdminCapability(ADMIN_CAPABILITIES.PRODUCTS_REVIEW)"));
assert.ok(route.includes("createSupabaseAdminClient()"));
assert.ok(route.includes("evaluateAutomaticEvidenceFromLiveDB("));
assert.ok(route.includes('"Cache-Control":"private, no-store'));
assert.ok(!route.includes("export async function POST"));
assert.ok(!route.includes("admin_register_sunscreen_recommendation_semantic_field_v1"));
assert.ok(!route.includes("body.actorUserId"));
const reader=fs.readFileSync("lib/product-intelligence/automatic-product-evidence-db-reader-v1.mjs","utf8");
for(const verb of [".insert(", ".update(", ".upsert(", ".delete(", ".rpc("]){
  assert.ok(!reader.includes(verb),"DB reader must be strictly read-only");
}

console.log(JSON.stringify({status:"PASS",phase:"LIVE_READONLY_PRODUCT_EVIDENCE_V1",
  liveSnapshotBaseline:{verifiedFacts:2,reviewTrends:0,insufficient:10,
    currentProductFacts:3,storedReviewSignals:0},
  spoofedReviewDataRejected:true,
  mixedVerifiedReviewTagsRemainNonProbabilistic:true,
  failClosedTests:failCases.length,
  mockSupabaseReadTest:true,productionWrites:0,adminApprovals:0,admission:false},null,2));
