#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import { buildR16IR4D4LiveReview } from "../../lib/product-offer-r16i-r4-d4-live-review.mjs";

const read = x=>fs.readFileSync(x,"utf8");
const page=read("app/admin/products/r16i-correction-review/page.js");
const ui=read("app/admin/products/r16i-correction-review/R16ICorrectionEvidenceWorkbench.js");
const route=read("app/api/admin/products/r16i-correction-review/route.js");
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
assert.match(ui,/review\.decision/);
assert.match(ui,/20개 항목/);
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
