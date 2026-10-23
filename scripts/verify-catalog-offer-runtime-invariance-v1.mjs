#!/usr/bin/env node
/**
 * R5 read-only runtime test. Run the real 164-product Skin Match decision
 * engine for every frozen scenario, then project synthetic commercial offers
 * only through the existing read path. No live seller data or DB operations.
 */
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {register} from "node:module";
register("./node-next-alias-loader.mjs",import.meta.url);
globalThis.fetch=async()=>{throw new Error("R5_NETWORK_FORBIDDEN")};
const [
  {buildRecommendationProductFromSource},
  {buildSkinMatchDecisionBundle},
  {projectRecommendationDecisionWithOffers,collectRecommendationProductIds}
]=await Promise.all([
  import("../lib/product-source.js"),
  import("../lib/skin-match-decision-engine.js"),
  import("../lib/product-offer-read-path.js")
]);
const [productsFixture,scenariosFixture]=await Promise.all([
  readFile("fixtures/recommendation-metadata/products-v1.json","utf8").then(JSON.parse),
  readFile("fixtures/recommendation-metadata/user-scenarios-v1.json","utf8").then(JSON.parse)
]);
assert.equal(productsFixture.productCount,164);
assert.equal(scenariosFixture.scenarioCount,12);
const products=[...productsFixture.products].sort((a,b)=>
  String(a.category).localeCompare(String(b.category),"en")||
  String(a.brand).localeCompare(String(b.brand),"en")||
  String(a.name).localeCompare(String(b.name),"en")||
  String(a.id).localeCompare(String(b.id),"en")).map(buildRecommendationProductFromSource);
const getId=x=>typeof x==="string"?x:x?.id||x?.product?.id||null;
const scoreRows=arr=>arr.map(p=>({
  id:p.id,engine_score:p.engine_score??null,score:p.score??null,
  score_breakdown:p.score_breakdown??null,decision_meta:p.decision_meta??null
}));
function semanticSnapshot(bundle){
  const scored=bundle?.diagnostics?.candidateSource?.products||[];
  return JSON.stringify({
    ranked:scoreRows(scored),
    top1:getId(bundle.topPick),
    top3:scored.slice(0,3).map(x=>x.id),
    altPicks:(bundle.altPicks||[]).map(getId),
    categoryPicks:bundle.categoryPicks,
    productScores:scoreRows(bundle.products||[])
  },(key,value)=>key==="buy_link"||key==="price_min"||key==="price_max"||key==="price_range"?undefined:value);
}
function offer(id,n,price=10000,seller="oliveyoung"){
  return {
    offer_id:"synthetic-"+n,product_id:id,
    seller_key:seller,seller_name:seller,
    source_name:"legacy_product_buy_link_v1",
    listing_id:"A"+String(n).padStart(12,"0"),
    listing_url:"https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A"+String(n).padStart(12,"0"),
    price_amount:price,currency_code:"KRW",
    availability_state:"in_stock",market_code:"KR",
    offer_state:"current",product_scope_state:"product_subject_unresolved",
    link_health_state:"healthy",last_observed_at:"2026-10-23T00:00:00Z"
  };
}

function commerceSnapshot(bundle) {
  const entries=[];
  const seen=new WeakSet();
  const visit=(value,depth=0,key="")=>{
    if(!value||typeof value!=="object"||depth>24||key==="diagnostics"||seen.has(value))return;
    seen.add(value);
    if(Array.isArray(value)){value.forEach(x=>visit(x,depth+1));return}
    if(typeof value.id==="string"&&typeof value.brand==="string"&&
       typeof value.name==="string"&&Object.hasOwn(value,"buy_link"))
      entries.push([value.id,value.buy_link,value.price_min,value.price_max,value.price_range]);
    for(const [k,v] of Object.entries(value))visit(v,depth+1,k);
  };
  visit(bundle);
  return entries;
}

let scenarios=0,comparedPublicProductSlots=0, verifiedCommerceProjections=0;
for (const item of [...scenariosFixture.scenarios].sort((a,b)=>a.id.localeCompare(b.id,"en"))){
  const bundle=await buildSkinMatchDecisionBundle(item.answers,{
    products,locale:"ko",includeCandidateSourceDiagnostics:true
  });
  assert.equal(bundle?.diagnostics?.candidateSource?.products?.length,164);
  const before=semanticSnapshot(bundle);
  const ids=collectRecommendationProductIds(bundle);
  assert.ok(ids.length>0,item.id+": no actual public recommendation products");
  const prices=ids.map((id,n)=>offer(id,n,17900));
  const cases=[
    prices,
    ids.map((id,n)=>offer(id,n,35900)),
    ids.map((id,n)=>offer(id,n,17900,"alternate_seller")),
    ids.map((id,n)=>({...offer(id,n,17900),components:[
      {role:"PRIMARY",quantity:2,unit:{amount:150,unit:"ml"}},
    ]})),
    ids.map((id,n)=>({...offer(id,n,17900),components:[
      {role:"PRIMARY",quantity:1,unit:{amount:150,unit:"ml"}},
      {role:"GIFT",product_id:null,quantity:1,unit:{amount:10,unit:"ml"}}
    ]}))
  ];
  const originalCommerce=commerceSnapshot(bundle);
  assert.ok(originalCommerce.length>0,item.id+": no commerce nodes to verify");
  const allProjected=[];
  for(const offers of cases) {
    const projected=projectRecommendationDecisionWithOffers(bundle,offers);
    assert.equal(semanticSnapshot(projected),before,item.id+": seller offer changed skin semantics");
    assert.equal(projected?.diagnostics,bundle?.diagnostics);
    const rows=commerceSnapshot(projected);
    assert.equal(rows.length,originalCommerce.length,item.id+": commerce nodes lost");
    // Existing policy does not authorize synthetic offer prices as catalog prices.
    rows.forEach((r,n)=>assert.deepEqual(r.slice(2),originalCommerce[n].slice(2),
      item.id+": untrusted offer price contaminated product prices"));
    allProjected.push(rows);
  }
  // Positive control: the trusted seller offer must be accepted, not simply ignored.
  const active=allProjected[0], differentSeller=allProjected[2];
  assert.ok(active.some((r,n)=>r[1]!==originalCommerce[n][1]),
    item.id+": valid offer never reached the commerce projection");
  assert.ok(active.some(r=>typeof r[1]==="string"&&r[1].includes("www.oliveyoung.co.kr/store/goods/getGoodsDetail")),
    item.id+": no valid direct seller URL projected");
  assert.ok(differentSeller.every(r=>r[1]===""),
    item.id+": untrusted seller's offer should suppress stale direct links");
  assert.deepEqual(allProjected[0],allProjected[1],
    item.id+": unsupported seller price authority changed display unexpectedly");
  assert.deepEqual(allProjected[0],allProjected[3],
    item.id+": BOGO composition leaked into commerce projection without validation");
  assert.deepEqual(allProjected[0],allProjected[4],
    item.id+": gift composition leaked into commerce projection without validation");
  verifiedCommerceProjections+=active.length;
  comparedPublicProductSlots+=ids.length;
  scenarios++;
}
assert.equal(scenarios,12);
console.log("R5 actual Skin Match runtime offers shadow: PASS products=164 scenarios=12 variants=5 compared_public_slots="+comparedPublicProductSlots+" verified_commerce_projections="+verifiedCommerceProjections+" (synthetic offers, zero DB writes)");
