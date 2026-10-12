#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import { inspectR16ISources, inspectR16ISource, R16I_SOURCE_REFRESH_VERSION }
  from "../../lib/product-intelligence/r16i-live-source-inspection.mjs";

const response = (body, status = 200, headers = { "content-type":"text/html; charset=utf-8" }) =>
  new Response(body, { status, headers });
let calls=[];
const accessible = async (url,opts) => {
  calls.push({url,opts});
  return response("<!doctype html><title>확인할 상품</title><p>상품 페이지</p>");
};
const ok = await inspectR16ISources(accessible,"2026-10-12T14:00:00+09:00");
assert.equal(ok.version,R16I_SOURCE_REFRESH_VERSION);
assert.equal(ok.sources.length,2);
assert.deepEqual(ok.sources.map(x=>x.state),["HTML_VISIBLE_UNVERIFIED","HTML_VISIBLE_UNVERIFIED"]);
assert.ok(ok.sources.every(x=>x.rawHtmlSha256?.length===64));
assert.ok(ok.sources.every(x=>x.selectedOptionVerified===false && x.checkoutPriceVerified===false));
assert.ok(ok.sources.every(x=>x.approvedPrice===null && x.productMutationAuthorized===false));
assert.equal(ok.checkoutVerified,false);
assert.equal(ok.commercialFactsApproved,false);
assert.equal(ok.productWriteAuthorized,false);
assert.equal(calls.length,2);
assert.ok(calls.every(x=>x.opts.method==="GET" && x.opts.redirect==="manual" &&
  x.opts.cache==="no-store" && x.opts.credentials==="omit"));
assert.ok(calls.some(x=>x.url.startsWith("https://www.snature.kr/")));
assert.ok(calls.some(x=>x.url.startsWith("https://www.hwahae.co.kr/")));
const forbiddenPrice = await inspectR16ISources(async ()=>
  response("<!DOCTYPE html><title>상품 29900원</title><p>할인특가</p>"));
assert.equal(forbiddenPrice.sources[0].approvedPrice,null);
assert.equal(forbiddenPrice.sources[1].checkoutPriceVerified,false);
const bot=await inspectR16ISources(async()=>response("<html><title>Checking your browser</title><p>captcha</p></html>"));
assert.ok(bot.sources.every(x=>x.state==="ACCESS_RESTRICTED"));
const err=await inspectR16ISources(async()=>response("blocked",403));
assert.ok(err.sources.every(x=>x.state==="ACCESS_RESTRICTED"));
const badType=await inspectR16ISources(async()=>response("{}",200,{"content-type":"application/json"}));
assert.ok(badType.sources.every(x=>x.state==="UNEXPECTED_CONTENT_TYPE"));
const tooLarge=await inspectR16ISources(async()=>response("ok",200,{"content-type":"text/html","content-length":"9900000"}));
assert.ok(tooLarge.sources.every(x=>x.state==="PAGE_TOO_LARGE"));
const failing=await inspectR16ISources(async()=>{throw Error("fetch failure")});
assert.ok(failing.sources.every(x=>x.state==="NETWORK_OR_TIMEOUT_ERROR"));
const redirect=await inspectR16ISources(async()=>response(null,302,{"location":"https://example.com/internal"}));
assert.ok(redirect.sources.every(x=>x.state==="REDIRECT_BLOCKED"));
let redirected=0;
const allowedRedirect=await inspectR16ISources(async(url)=>{
  if(url.includes("www.snature.kr") && redirected++===0)
    return response(null,302,{"location":"https://m.snature.kr/product/detail.html?product_no=151"});
  return response("<html><title>Product</title></html>");
});
assert.equal(allowedRedirect.sources[0].state,"HTML_VISIBLE_UNVERIFIED");
const source=fs.readFileSync("lib/product-intelligence/r16i-live-source-inspection.mjs","utf8");
const api=fs.readFileSync("app/api/admin/products/r16i-correction-review/source-refresh/route.js","utf8");
const ui=fs.readFileSync("app/admin/products/r16i-correction-review/R16IR4D8RefreshControls.js","utf8");
const parent=fs.readFileSync("app/admin/products/r16i-correction-review/R16ICorrectionEvidenceWorkbench.js","utf8");
assert.match(api,/requireAdminCapability\(ADMIN_CAPABILITIES\.PRODUCTS_REVIEW\)/);
assert.ok(api.indexOf("requireAdminCapability(")<api.indexOf("inspectR16ISources()"));
assert.match(api,/private, no-store/);
assert.match(api,/export async function GET\(\)/);
assert.doesNotMatch(api,/export async function (POST|PUT|PATCH|DELETE)\(/);
assert.doesNotMatch(source,/process\.env|createSupabaseAdminClient|localStorage/);
assert.doesNotMatch(source,/\.insert\s*\(|\.upsert\s*\(|\.delete\s*\(|\.rpc\s*\(/);
assert.doesNotMatch(source,/\.from\(["\x27](?:products|product_offers|product_fact_subjects)["\x27]\)/);
assert.match(source,/SOURCES\.includes\(source\)/);
assert.match(source,/MAX_BYTES = 512 \* 1024/);
assert.match(ui,/const DB_ENDPOINT = "\/api\/admin\/products\/r16i-correction-review"/);
assert.match(ui,/const SOURCE_ENDPOINT = "\/api\/admin\/products\/r16i-correction-review\/source-refresh"/);
assert.match(ui,/DB 새로고침/);
assert.match(ui,/판매처 정보 조회/);
assert.match(ui,/method: "GET"/);
assert.match(ui,/cache: "no-store"/);
assert.match(ui,/R16I_D8_LIVE_DB_REFRESH_FAILED/);
assert.match(ui,/onReview\(\{ decision: "BLOCKED"/);
assert.doesNotMatch(ui,/method: "(POST|PATCH|PUT|DELETE)"/);
assert.doesNotMatch(ui,/localStorage|sessionStorage|indexedDB/);
assert.match(parent,/const \[review, setReview\] = useState\(initialReview\)/);
assert.match(parent,/<R16IR4D8RefreshControls onReview=\{setReview\}/);
assert.match(parent,/const rows = blocked \? \[\]/);
assert.match(parent,/approved_after_values:null/);
console.log(JSON.stringify({status:"PASS",stage:"R16I-R4-D8A",
  fixed_origins:2,mock_http_checks:8,db_refresh:"GET_AND_FAIL_CLOSED",
  seller_refresh:"REAL_HTTP_REACHABILITY_NO_PRICE_AUTHORITY",
  writes:0,approvals:0}));
