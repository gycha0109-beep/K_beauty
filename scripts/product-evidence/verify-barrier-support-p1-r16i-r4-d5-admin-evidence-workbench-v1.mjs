#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import { buildR16IR4D4LiveReview } from "../../lib/product-offer-r16i-r4-d4-live-review.mjs";

const read = x=>fs.readFileSync(x,"utf8");
const page=read("app/admin/products/r16i-correction-review/page.js");
const ui=read("app/admin/products/r16i-correction-review/R16ICorrectionEvidenceWorkbench.js");
const route=read("app/api/admin/products/r16i-correction-review/route.js");
const navigation=read("app/admin/AdminNavigation.js");
const d4=JSON.parse(read("evidence/product-decision-axis-non-numeric-shadow-v2/barrier-support-p1-r16i-r4-readonly-prestate-20261010.json"));
const snapshot={
  observed_at:"2026-10-12T10:15:00+09:00",
  product:d4.product,bindings:d4.bindings,
  offers_by_product:[],offers_by_listing:[],offers_by_url:[],
  subjects:[],intakes:d4.intakes
};
const live=buildR16IR4D4LiveReview(snapshot);
assert.equal(live.decision,"REVIEW_REQUIRED");
assert.equal(live.reviewed_fields.length,20);
assert.ok(live.reviewed_fields.every(x=>x.after===null && x.field_approved===false));
assert.equal(live.production_writes_authorized,false);
assert.equal(live.proposed_offer.price_amount,null);
assert.equal(live.current_live_checkout_price,null);
assert.equal(live.operator_decision,null);
const drift=structuredClone(snapshot);drift.product.updated_at="2026-10-12T10:16:00+09:00";
assert.equal(buildR16IR4D4LiveReview(drift).decision,"BLOCKED");

assert.match(page,/requireAdminCapability\(ADMIN_CAPABILITIES\.PRODUCTS_REVIEW\)/);
assert.match(page,/if \(!access\.allowed \|\| !access\.userId\) notFound\(\)/);
assert.ok(page.indexOf("requireAdminCapability(")<page.indexOf("createSupabaseAdminClient()"));
assert.match(page,/dynamic = "force-dynamic"/);
assert.match(page,/revalidate = 0/);
assert.match(page,/readR16IR4D4Review\(client\)/);
assert.doesNotMatch(page,/(createServerAction|use server|export async function (POST|PUT|PATCH|DELETE))\b/);

assert.match(ui,/"use client"/);
assert.match(ui,/review\?\.decision/);
assert.match(ui,/DB 필드 20개/);
assert.match(ui,/판매처별 실제 정보 확인/);
assert.match(ui,/판매 정보 정정안 미리보기/);
assert.match(ui,/확인한 원본 근거 기록/);
assert.match(ui,/최종 검토 · 승인 전/);
assert.match(ui,/<details/);
assert.match(ui,/<summary/);
assert.match(ui,/disabled aria-disabled="true"/);
assert.match(ui,/review\?\.decision !== "REVIEW_REQUIRED"/);
assert.match(ui,/const rows = blocked \? \[\]/);
assert.match(ui,/80ml 단품 가격으로 옮기거나/);
assert.match(ui,/정정 이슈 #1204/);
assert.match(ui,/fields\.map/);
assert.match(ui,/selected|option|옵션/);
assert.match(ui,/navigator\.clipboard\.writeText/);
assert.match(ui,/UNVERIFIED_NOT_APPROVED/);
assert.match(ui,/approved_after_values:null/);
assert.match(ui,/production_write_authorized:false/);
assert.match(ui,/operator_approval:false/);
assert.match(ui,/useState/);
assert.match(ui,/setNotes/);
assert.match(ui,/role="alert"/);
assert.match(ui,/role="status"/);
assert.match(ui,/target="_blank" rel="noopener noreferrer"/);
assert.doesNotMatch(ui,/(localStorage|sessionStorage|indexedDB|fetch\(|axios|WebSocket|sendBeacon|formAction|method="post")/);
assert.doesNotMatch(ui,/\b(approve|승인 완료|실제 반영)\s*\(/);

assert.match(navigation,/href: "\/admin\/products\/r16i-correction-review",\s*capability: ADMIN_CAPABILITIES\.PRODUCTS_REVIEW/);
assert.match(navigation,/!grantedCapabilities\.has\(item\.capability\)/);
assert.match(route,/admin\.products|PRODUCTS_REVIEW/);
for(const [name,source] of [["page",page],["UI",ui],["API",route]]){
  assert.doesNotMatch(source,/\.insert\s*\(|\.upsert\s*\(|\.update\s*\(|\.delete\s*\(|\.rpc\s*\(/,name);
}
console.log(JSON.stringify({
  status:"PASS",stage:"R16I-R4-D5",
  admin_guard:true,display_fields:live.reviewed_fields.length,
  evidence_notes:7,local_only_draft:true,
  db_writes:0,approval_actions:0
}));
