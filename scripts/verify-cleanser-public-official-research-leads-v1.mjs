#!/usr/bin/env node
/** Treat public manufacturer pages as RESEARCH LEADS, never governed Fact. */
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const p="evidence/trust/cleanser-public-official-research-leads-20261023-v1.json";
const f=JSON.parse(await readFile(p,"utf8"));
assert.equal(f.version,"cleanser-public-official-research-leads-20261023-v1");
assert.equal(f.authority,"RESEARCH_LEAD_ONLY_NOT_OFFICIAL_EVIDENCE");
assert.equal(f.reviewed_by,null);
assert.equal(f.protected_source_binding_written,false);
assert.equal(f.product_ids_preserved,10);
assert.equal(f.records.length,10);
assert.equal(new Set(f.records.map(x=>x.product_id)).size,10);
const original=JSON.parse(await readFile("evidence/trust/cleanser-authority-next-actions-20261023.json","utf8"));
assert.deepEqual([...f.records.map(x=>x.product_id)].sort(),[...original.expected_product_ids].sort());
const counts={match:0,different:0,unknown:0};
for(const row of f.records){
  assert.equal(row.public_manufacturer_page.source_status,"PUBLIC_NOT_FROZEN_OR_REVIEWED");
  assert.equal(row.public_manufacturer_page.observation,"PUBLIC_PRODUCT_PAGE_RESEARCH_LEAD");
  assert.equal(row.seller_sku,null);
  assert.equal(row.governed_source_id,null);
  assert.equal(row.source_snapshot_digest,null);
  assert.equal(row.subject_id,null);
  assert.equal(row.formulation_equivalence,"FORMULA_UNRESOLVED");
  assert.equal(row.fact_reuse_authorized,false);
  assert.equal(row.admission_authorized,false);
  const origin=new URL(row.public_manufacturer_page.url);
  assert.equal(origin.protocol,"https:");
  assert.equal(origin.username,"");
  assert.equal(origin.password,"");
  assert.equal(origin.hash,"");
  if(row.public_retailer_lead_url)assert.equal(new URL(row.public_retailer_lead_url).protocol,"https:");
  const hint=row.catalog_quantity_hint;
  const official=row.public_manufacturer_page.observed_quantity;
  assert.ok(Number.isFinite(hint.amount)&&hint.amount>0);
  assert.ok(["g","ml"].includes(hint.unit));
  if(!official){
    assert.equal(row.quantity_comparison,"OFFICIAL_QUANTITY_NOT_EXPLICIT");
    counts.unknown++;
  }else{
    assert.ok(Number.isFinite(official.amount)&&official.amount>0);
    assert.ok(["g","ml"].includes(official.unit));
    const same=official.amount===hint.amount&&official.unit===hint.unit;
    assert.equal(row.quantity_comparison,same?
      "MANUFACTURER_QUANTITY_MATCHES_CATALOG_HINT":
      "MANUFACTURER_QUANTITY_DIFFERS_FROM_CATALOG_HINT");
    counts[same?"match":"different"]++;
  }
}
assert.deepEqual(counts,{match:7,different:2,unknown:1});
const differing=f.records.filter(x=>x.quantity_comparison==="MANUFACTURER_QUANTITY_DIFFERS_FROM_CATALOG_HINT");
assert.deepEqual(differing.map(x=>[x.catalog_quantity_hint.amount,x.public_manufacturer_page.observed_quantity.amount]),[[170,220],[120,150]]);
const zeroid=f.records.find(x=>x.brand==="제로이드");
assert.equal(zeroid.catalog_quantity_hint.amount,240);
assert.equal(zeroid.public_manufacturer_page.observed_quantity,null);
assert.ok(f.records.filter(x=>x.brand==="휩드").every(x=>x.public_manufacturer_page.observed_quantity.unit==="g"));
assert.ok(f.records.every(x=>x.formulation_equivalence==="FORMULA_UNRESOLVED"));
console.log("Official public research lead audit: PASS 10 products, matched 7, differ 2, unknown 1, authority grants 0");
