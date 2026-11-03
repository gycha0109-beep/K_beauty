#!/usr/bin/env node
/**
 * Existing 10 cleaner records: exact scorer replay in AUTHORIZED server memory.
 * Uses existing review_signals and existing computeReviewSignalScore, never new
 * reviewer/timestamp/sample_count approval fields.
 *
 * Do not schedule on public CI or transmit Supabase keys there.
 * Requires SUPABASE_URL and server-only SUPABASE_SERVICE_ROLE_KEY.
 * GET-only PostgREST transport, no crawl, no writes, no raw reviews/URLs output.
 */
import {readFile} from "node:fs/promises";
import {createClient} from "@supabase/supabase-js";
import {createCleanserSelectOnlyFetchV1} from "../lib/trust/cleanser-hosted-select-only-transport-v1.mjs";
import {evaluateCleanserExistingHwahaeScoreShadowV1 as evaluate}
  from "../lib/trust/cleanser-hwahae-existing-score-shadow-v1.mjs";

if(process.argv.length!==2)throw new Error("NO_RUNTIME_FLAGS_OR_G2_AUTHORITY_ALLOWED");
const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key)throw new Error("AUTHORIZED_SERVER_CREDENTIALS_REQUIRED");
const snapshot=JSON.parse(await readFile(
  "evidence/trust/cleanser-existing-hwahae-signal-footprint-20261024-v1.json","utf8"));
if(snapshot.version!=="cleanser-existing-hwahae-signal-footprint-v1"||
  snapshot.records?.length!==10)
  throw new Error("TEN_REDACTED_FOOTPRINT_REQUIRED");
const actualScoreBaseline=JSON.parse(await readFile(
  "evidence/trust/cleanser-actual-review-score-replay-20261024-v1.json","utf8"
));
if(actualScoreBaseline.version!=="cleanser-actual-existing-review-score-replay-v1"||
   actualScoreBaseline.products?.length!==10)
  throw new Error("PINNED_CANONICAL_SCORE_BASELINE_REQUIRED");
const scoreById=new Map(actualScoreBaseline.products.map(x=>[x.product_id,x]));
if(scoreById.size!==10)throw new Error("UNIQUE_BASELINE_PRODUCTS_REQUIRED");
const ids=snapshot.records.map(x=>x.product_id);
if(new Set(ids).size!==10)throw new Error("TEN_UNIQUE_PRODUCTS_REQUIRED");
const sb=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},
  global:{fetch:createCleanserSelectOnlyFetchV1({baseUrl:url,fetchImpl:fetch})}});
const {data,error}=await sb.from("products")
  .select("id,brand,name,category,product_form,hwahae_url,review_signals,market_signals,ingredient_signals")
  .in("id",ids).limit(11);
if(error||!Array.isArray(data))throw new Error("READONLY_PRODUCT_SELECT_FAILED:"+(error?.code||"UNKNOWN"));
if(data.length!==10||data.some(x=>!ids.includes(x.id)))throw new Error("EXACT_TEN_SCOPE_DRIFT");
const byId=new Map(data.map(x=>[x.id,x]));
if(byId.size!==10)throw new Error("DUPLICATE_CATALOG_ROWS");
const results=snapshot.records.map(row=>{
 const original=byId.get(row.product_id);
 const actual=evaluate({product:original});
 const match=actual.status===row.review_scorer_input_status;
 // Fail closed instead of publishing a silent stale fixture or a false PASS.
 if(!match)throw new Error("REDACTED_SNAPSHOT_SCORE_READINESS_DRIFT:"+row.product_id);
 const baseline=scoreById.get(row.product_id);
 if(!baseline||baseline.status!==actual.status||
   JSON.stringify(baseline.score_profiles)!==JSON.stringify(actual.score_profiles))
   throw new Error("PINNED_LIVE_CANONICAL_REVIEW_SCORE_DRIFT:"+row.product_id);
 if(actual.review_signal_date!==row.review_signal_date)throw new Error("REVIEW_CAPTURE_DATE_DRIFT:"+row.product_id);
 if(actual.capture_url_string_match!==row.captured_page_matches_link)
   throw new Error("REVIEW_SOURCE_CAPTURE_LINK_DRIFT:"+row.product_id);
 // Do not reveal raw review labels, direct source URLs, product INCI or keys.
 return Object.freeze({product_id:row.product_id,
   product_name:row.brand+" "+row.product_name,
   status:actual.status,
   review_summary_entry_count:actual.review_summary_entry_count,
   mapped_top_three_count:actual.top_three_mapped_entries,
   market_review_count:actual.market_review_count,
   ingredient_signal_recorded:actual.ingredient_signal_recorded,
   review_signal_score_by_skin_context:actual.score_profiles,
   score_type:actual.score_type,
   limited_production_recommendation_admitted:false,
   low_ph:actual.low_ph,deep_cleansing:actual.deep_cleansing,
   official_product_fact_proven:false,
   g2_grant_issued:false,production_writes:0});
});
const result={
 version:"cleanser-existing-hwahae-live-review-score-replay-v1",
 snapshot_as_of:snapshot.as_of,authority:"READ_ONLY_CANONICAL_REVIEW_SCORE_ONLY",
 products_count:results.length,
 captured_score_input_candidates:results.filter(x=>x.status==="REVIEW_SCORE_INPUT_CANDIDATE").length,
 captured_unmapped:results.filter(x=>x.status==="NO_TOP_THREE_MAPPED_REVIEW_TAGS").length,
 missing_capture:results.filter(x=>x.status==="NO_HWAHAE_REVIEW_CAPTURE").length,
 raw_review_labels_exported:false,
 full_skin_match_score_recomputed:false,
 manufacturer_formulation_reply_required:false,
 g2_grants:0,production_writes:0,
 products:results
};
if(result.captured_score_input_candidates!==6||result.captured_unmapped!==1||
result.missing_capture!==3)throw new Error("EXPECTED_SIX_ONE_THREE_DRIFT");
process.stdout.write(JSON.stringify(result,null,2)+"\n");
