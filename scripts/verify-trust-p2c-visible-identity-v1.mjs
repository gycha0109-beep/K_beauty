#!/usr/bin/env node
import assert from "node:assert/strict";
import { inspectTrustVisibleProductIdentity } from "../lib/trust/official-visible-identity-v1.mjs";
import { classifyTrustOfficialCandidatePage } from "../lib/trust/official-product-discovery-p2-v1.mjs";
import { prepareTrustP2BObservations } from "../lib/trust/official-discovery-observation-store-v1.mjs";

const target={id:"08b85f37-b1fa-42d7-893a-0d4facb17878",name:"다이브인 무기자차 마일드 선크림"};
const origin="https://www.torriden.com";
const text="<title>토리든 공식몰</title>";
const strict=html=>classifyTrustOfficialCandidatePage(Buffer.from(html),target);
const named=target.name;
const strong=strict(text+"<main><h1>"+named+" 60ml</h1><p>로션 기획전</p></main>");
assert.equal(strong.status,"SCOPED_HEADING_CANDIDATE");
assert.equal(strong.identitySurface,"product_heading");
assert.equal(strong.identityAuthority,"NONE");
assert.equal(strong.marketVerified,false);
assert.equal(strong.subjectCreationAuthorized,false);
assert.equal(strong.factConfirmationAuthorized,false);
const classic=strict(text+'<div class="item_tit_detail"><strong>'+named+"</strong></div>");
assert.equal(classic.status,"SCOPED_HEADING_CANDIDATE");
const incidental=strict(text+"<article>이벤트: "+named+" 지금 확인</article>");
assert.equal(incidental.status,"BODY_NAME_MENTION_ONLY");
assert.equal(incidental.identitySurface,"visible_body_mention");
assert.equal(incidental.factConfirmationAuthorized,false);
const navigation=strict(text+'<a href="/products/other">'+named+"</a>");
assert.equal(navigation.status,"IDENTITY_UNRESOLVED");
const script=strict(text+"<script>window.name='"+named+"'</script>");
assert.equal(script.status,"IDENTITY_UNRESOLVED");
const related=strict(text+"<h1>다이브인 무기자차 마일드 로션</h1><p>관련 상품: "+named+"</p>");
assert.equal(related.status,"BODY_NAME_MENTION_ONLY");
const generic=strict(text+'<div class="goods_name">타 상품 '+named+" 세일</div>");
assert.equal(generic.status,"BODY_NAME_MENTION_ONLY");
const note=inspectTrustVisibleProductIdentity(Buffer.from(text+"<p>"+named+"</p>"),target);
assert.equal(note.authorized,false);
const fixed=strict("<title>"+named+" 60ml - 토리든</title><p>다른 상품</p>");
assert.equal(fixed.status,"TITLE_NAME_CANDIDATE");
const structured=strict(text+'<script type="application/ld+json">{"@type":"Product","name":"'+named+'"}</script>');
assert.equal(structured.status,"STRUCTURED_NAME_CANDIDATE");
const run=(status,surface)=>({
 readOnly:true,officialProductEvidenceConfirmed:false,
 subjectCreationAuthorized:false,marketVerified:false,formulationVerified:false,
 factWrites:0,recommendationWrites:0,aiApiCalls:0,
 productId:target.id,intakeId:"0b5963bb-67d6-4738-a620-32ec86c1e3d0",
 sites:[{origin,status:"CANDIDATES_DISCOVERED",
 pages:[{url:origin+"/goods/goods_view.php?goodsNo=136",
 status,identitySurface:surface,sha256:"c".repeat(64)}]}],
});
for(const [state,surface] of [
 ["SCOPED_HEADING_CANDIDATE","product_heading"],
 ["BODY_NAME_MENTION_ONLY","visible_body_mention"],
]){
 const rows=prepareTrustP2BObservations(run(state,surface));
 assert.equal(rows.length,2);
 const item=rows.find(x=>x.observation_kind==="page_candidate");
 assert.equal(item.disposition,state);
 assert.equal(item.identity_surface,surface);
 assert.equal(item.content_digest,"c".repeat(64));
}
assert.throws(()=>prepareTrustP2BObservations(
 run("BODY_NAME_MENTION_ONLY","product_heading")),/TRUST_P2C_SURFACE_MISMATCH/);
console.log("TRUST_P2C_VISIBLE_IDENTITY_CANDIDATES_PASS");
