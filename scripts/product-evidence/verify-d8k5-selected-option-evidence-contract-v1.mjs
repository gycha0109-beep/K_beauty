#!/usr/bin/env node
// D8K-5 draft schema and selected-option DTO tests; synthetic only.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  SELECTED_OPTION_EVIDENCE_READ_VERSION,
  inspectSelectedOptionEvidenceResponse, readSelectedOptionEvidenceTransport
} from "../../lib/commerce/product-offer-selected-option-evidence-v1.mjs";
const id = n => "00000000-0000-4000-8000-" + n.toString(16).padStart(12,"0");
const sha = "b".repeat(64);
const now = "2026-10-15T02:00:00.000Z";
const option = (n,extras={}) => ({
  product_id:id(1),offer_id:id(2),observation_id:id(100+n),review_id:id(200+n),
  seller_key:"official",seller_name:"Official store",listing_id:"listingA",
  seller_option_key:"option"+n,variant_id:"sku80",option_kind:"single",
  unit_size:80,size_unit:"ml",quantity:1,gifts:[],
  selected_option_price_krw:24500,shipping_price_krw:null,
  currency_code:"KRW",observed_at:"2026-10-15T00:30:00.000Z",
  reviewed_at:"2026-10-15T00:45:00.000Z",evidence_sha256:sha,
  ...extras
});
const envelope = options => ({
  read_contract_version:SELECTED_OPTION_EVIDENCE_READ_VERSION,
  status:"AUTHORITY_RESOLVED",options
});
const input = (options,overrides={}) => ({
 requestedProductIds:[id(1)],response:envelope(options),nowIso:now,
 maxAgeMs:86400000,...overrides
});
let checks=0;
function eq(a,b,msg){assert.deepEqual(a,b,msg);checks++;}
function held(args,reason){const x=inspectSelectedOptionEvidenceResponse(args);
 eq(x.status,"HOLD");eq(x.reason,reason);
 eq(x.selectedOptionPriceDisplayAuthorized,false);
 eq(x.directCtaAuthorized,false);
 eq(x.optionsByProduct,{});
}
let view=inspectSelectedOptionEvidenceResponse(input([option(1)]));
eq(view.status,"STRUCTURALLY_VALID_PRIVATE_CANDIDATES");
eq(view.optionRowCount,1);
eq(view.optionsByProduct[id(1)][0].observedPrice,24500);
eq(view.optionsByProduct[id(1)][0].shippingCost,null);
eq(view.optionsByProduct[id(1)][0].ctaEnabled,false);
eq(view.selectedOptionPriceDisplayAuthorized,false);
eq(view.authenticatedServerReaderProven,false);
eq(view.observationEvidenceIndependentlyRechecked,false);
eq(view.productionReleaseAuthorized,false);
const one=view.optionsByProduct[id(1)][0];
for(const forbidden of ["listing_url","href","ctaUrl","buy_link","stockVerified","verified"]) {
 eq(Object.hasOwn(one,forbidden),false,forbidden);
}
// Two independent selected options under the SAME real seller listing.
// Existing product_offers UNIQUE seller+listing still remains one parent.
view=inspectSelectedOptionEvidenceResponse(input([
  option(1),option(2,{seller_option_key:"option2",variant_id:"sku80x2",
    option_kind:"kit",quantity:2,gifts:[{skuId:"serum10",quantity:1}],
    shipping_price_krw:3000,selected_option_price_krw:29900})
]));
eq(view.optionRowCount,2);
eq(view.optionsByProduct[id(1)][1].optionKind,"kit");
eq(view.optionsByProduct[id(1)][1].packComposition.quantity,2);
eq(view.optionsByProduct[id(1)][1].packComposition.gifts,[{skuId:"serum10",quantity:1}]);
eq(view.optionsByProduct[id(1)][1].shippingCost,3000);
eq(view.optionsByProduct[id(1)][0].listingId,view.optionsByProduct[id(1)][1].listingId);
eq(view.selectedOptionPriceDisplayAuthorized,false);
view=inspectSelectedOptionEvidenceResponse(input([option(1,{shipping_price_krw:0})]));
eq(view.optionsByProduct[id(1)][0].shippingCost,0);
view=inspectSelectedOptionEvidenceResponse(input([
  option(1,{gifts:[],option_kind:"single"}),
  option(3,{seller_key:"hwahae",listing_id:"listingB",
    variant_id:"sku80x2",option_kind:"kit",quantity:2,
    gifts:[{skuId:"serum10",quantity:1}],shipping_price_krw:3000})
]));
eq(view.optionRowCount,2);

held(input([option(1)],{maxAgeMs:null}),"FRESHNESS_POLICY_NOT_SET");
held(input([option(1)],{nowIso:null}),"FRESHNESS_POLICY_NOT_SET");
held(input([option(1)],{requestedProductIds:["bad"]}),"PRODUCT_ID_REQUEST_INVALID");
held(input([option(1,{product_id:id(3)})]),"OPTION_IDENTITY_OR_REVIEW_INVALID");
held(input([option(1,{offer_id:"fake"})]),"OPTION_IDENTITY_OR_REVIEW_INVALID");
held(input([option(1,{evidence_sha256:null})]),"OPTION_IDENTITY_OR_REVIEW_INVALID");
held(input([option(1,{seller_option_key:"bad option"})]),"OPTION_IDENTITY_OR_REVIEW_INVALID");
held(input([option(1,{variant_id:"bad variant"})]),"OPTION_IDENTITY_OR_REVIEW_INVALID");
held(input([option(1,{currency_code:"USD"})]),"OPTION_IDENTITY_OR_REVIEW_INVALID");
held(input([option(1,{listing_id:null})]),"OPTION_IDENTITY_OR_REVIEW_INVALID");
held(input([option(1,{gifts:{}})]),"OPTION_IDENTITY_OR_REVIEW_INVALID");
held(input([option(1,{gifts:[{skuId:"same",quantity:1},{skuId:"same",quantity:2}]})]),"OPTION_IDENTITY_OR_REVIEW_INVALID");
held(input([option(1,{option_kind:"single",quantity:2})]),"OPTION_IDENTITY_OR_REVIEW_INVALID");
held(input([option(1,{option_kind:"kit",gifts:[]})]),"OPTION_IDENTITY_OR_REVIEW_INVALID");
held(input([option(1,{option_kind:"multipack",quantity:1})]),"OPTION_IDENTITY_OR_REVIEW_INVALID");
for(const price of [null,0,-1,2.5,"24000",Infinity,1000000001]) {
 held(input([option(1,{selected_option_price_krw:price})]),"OPTION_PRICE_INVALID");
}
for(const shipping of [-1,"0",Infinity,1000000001]) {
 held(input([option(1,{shipping_price_krw:shipping})]),"OPTION_PRICE_INVALID");
}
held(input([option(1,{observed_at:"2026-09-01T00:00:00.000Z"})]),"OPTION_PRICE_OR_REVIEW_STALE");
held(input([option(1,{reviewed_at:"2026-10-16T00:00:00.000Z"})]),"OPTION_PRICE_OR_REVIEW_STALE");
held(input([option(1,{reviewed_at:"2026-10-14T00:00:00.000Z"})]),"OPTION_PRICE_OR_REVIEW_STALE");
held(input([option(1,{observed_at:"bad"})]),"OPTION_PRICE_OR_REVIEW_STALE");
held(input([option(1),option(2,{seller_option_key:"option1"})]),"DUPLICATE_OPTION_OBSERVATION_OR_REVIEW");
held(input([option(1),option(2,{observation_id:id(101)})]),"DUPLICATE_OPTION_OBSERVATION_OR_REVIEW");
held(input([option(1),option(2,{review_id:id(201)})]),"DUPLICATE_OPTION_OBSERVATION_OR_REVIEW");
held(input([option(1)],{response:{...envelope([option(1)]),status:"NO_AUTHORITY"}}),"READ_AUTHORITY_UNRESOLVED");
held(input([option(1)],{response:{...envelope([option(1)]),read_contract_version:"wrong"}}),"READ_CONTRACT_MISMATCH");
held(input(Array.from({length:257},(_,i)=>option(i+1))),"OPTION_ROW_LIMIT_OR_SHAPE_INVALID");
const empty=inspectSelectedOptionEvidenceResponse(input([]));
eq(empty.status,"STRUCTURALLY_VALID_PRIVATE_CANDIDATES");
eq(empty.optionRowCount,0);eq(empty.selectedOptionPriceDisplayAuthorized,false);

// Injected-reader transport is a private shape test, NOT a hosted RPC call.
let readerCalls=[];
const transport=await readSelectedOptionEvidenceTransport({
 productIds:[id(1),id(1).toUpperCase()],
 invokeAuthorizedRead:batch=>{
   readerCalls.push(batch);
   return envelope([option(1)]);
 },
 nowIso:now,maxAgeMs:86400000
});
eq(readerCalls,[[id(1)]]);
eq(transport.status,"PRIVATE_OPTION_EVIDENCE_SHADOW");
eq(transport.optionRowCount,1);
eq(transport.selectedOptionPriceDisplayAuthorized,false);
eq(transport.authenticatedServerReaderProven,false);
eq(transport.optionsByProduct[id(1)][0].observedPrice,24500);
const missingReader=await readSelectedOptionEvidenceTransport({
 productIds:[id(1)],nowIso:now,maxAgeMs:86400000
});
eq(missingReader.reason,"AUTHORIZED_SERVER_READER_NOT_CONFIGURED");
const failedReader=await readSelectedOptionEvidenceTransport({
 productIds:[id(1)],nowIso:now,maxAgeMs:86400000,
 invokeAuthorizedRead:()=>{throw Error("never reveal secret");}
});
eq(failedReader.reason,"PRIVATE_OPTION_READ_FAILED");
eq(JSON.stringify(failedReader).includes("never reveal secret"),false);
eq(failedReader.optionsByProduct,{});
const ids65=Array.from({length:65},(_,i)=>id(i+1));
readerCalls=[];
const twoBatch=await readSelectedOptionEvidenceTransport({
 productIds:ids65,nowIso:now,maxAgeMs:86400000,
 invokeAuthorizedRead:batch=>{
   readerCalls.push(batch);
   return envelope(batch.map((pid,i)=>option(i+1,{
     product_id:pid,offer_id:id(1000+Number.parseInt(pid.slice(-12),16)),
     observation_id:id(2000+Number.parseInt(pid.slice(-12),16)),
     review_id:id(3000+Number.parseInt(pid.slice(-12),16))
   })));
 }
});
eq(twoBatch.status,"PRIVATE_OPTION_EVIDENCE_SHADOW");
eq(readerCalls.map(batch=>batch.length),[64,1]);
eq(twoBatch.optionRowCount,65);
eq(twoBatch.rpcBatchCount,2);
const laterError=await readSelectedOptionEvidenceTransport({
 productIds:ids65,nowIso:now,maxAgeMs:86400000,
 invokeAuthorizedRead:batch=>
   batch.length===1?{...envelope([]),status:"NO_AUTHORITY"}:envelope([option(1)])
});
eq(laterError.status,"HOLD");
eq(laterError.optionsByProduct,{});
const tooMany=await readSelectedOptionEvidenceTransport({
 productIds:ids65,nowIso:now,maxAgeMs:86400000,
 invokeAuthorizedRead:batch=>envelope(batch.flatMap((pid,i)=>
   Array.from({length:4},(_,j)=>option(i*4+j+1,{
     product_id:pid,
     offer_id:id(9000+Number.parseInt(pid.slice(-12),16)),
     seller_option_key:"choice"+j,
     observation_id:id(10000+Number.parseInt(pid.slice(-12),16)*4+j),
     review_id:id(20000+Number.parseInt(pid.slice(-12),16)*4+j)
   }))))
});
eq(tooMany.reason,"AGGREGATE_OPTION_CAPACITY_EXCEEDED");
eq(tooMany.optionsByProduct,{});
const noProducts=await readSelectedOptionEvidenceTransport({
 productIds:[],invokeAuthorizedRead:()=>{throw Error("not called");}
});
eq(noProducts.status,"EMPTY");

const schema=readFileSync("docs/taxonomy-ai/sql/d8k5-selected-option-evidence-schema-review-only.sql","utf8");
const reader=readFileSync("docs/taxonomy-ai/sql/d8k5-selected-option-private-read-review-only.sql","utf8");
const js=readFileSync("lib/commerce/product-offer-selected-option-evidence-v1.mjs","utf8");
assert.match(schema,/references public\.product_offers\(offer_id\)/);checks++;
assert.match(schema,/unique \(offer_id, seller_option_key, observed_at\)/);checks++;
assert.match(schema,/create table public\.product_offer_option_reviews/);checks++;
assert.match(schema,/observation_id uuid not null\\s+references public\\.product_offer_option_observations/);checks++;
assert.match(schema,/unique \\(observation_id, reviewed_at\\)/);checks++;
assert.match(schema,/offer_option_reviews_latest_idx/);checks++;
assert.match(schema,/enable row level security/g);checks++;
assert.match(schema,/revoke all on public\.product_offer_option_observations/);checks++;
assert.match(schema,/revoke all on public\.product_offer_option_reviews/);checks++;
assert.match(reader,/product_offer_presentation_reader_owner/);checks++;
assert.match(reader,/to recommendation_admission_runtime/);checks++;
assert.match(reader,/row_number\(\) over/);checks++;
assert.match(reader,/ranked\.option_rank = 1/);checks++;
assert.match(reader,/latest_review as \\(/);checks++;
assert.match(reader,/partition by r\\.observation_id/);checks++;
assert.match(reader,/r\\.review_rank = 1/);checks++;
assert.doesNotMatch(schema,/where verdict = 'verified'/);checks++;
assert.match(reader,/r\.verdict = 'verified'/);checks++;
assert.match(reader,/from public, anon, authenticated, service_role/);checks++;
assert.doesNotMatch(reader,/grant execute[^;]*to\s+anon|grant execute[^;]*to\s+authenticated|grant execute[^;]*to\s+service_role/);checks++;
assert.doesNotMatch(js,/fetch\(|createClient\(|\.rpc\(|process\.env/);checks++;
assert.match(js,/selectedOptionPriceDisplayAuthorized: false/);checks++;
console.log(JSON.stringify({status:"PASS",stage:"D8K5_OPTION_EVIDENCE_SCHEMA_AND_DTO_SHADOW",
 assertions:checks,syntheticOnly:true,
 schemaDraftOnly:true,sqlExecuted:false,realSellerEvidence:false,
 authorizedDbReaderConnected:false,uiPricePublished:false,
 productWrites:0,offerWrites:0,apiChanged:false,releaseAuthorized:false}));
