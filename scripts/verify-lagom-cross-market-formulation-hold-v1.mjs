#!/usr/bin/env node
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {spawnSync} from "node:child_process";
const base="evidence/trust/";
const ledger=JSON.parse(await readFile(base+"lagom-cross-market-formulation-research-20261023-v1.json","utf8"));
const leads=JSON.parse(await readFile(base+"cleanser-public-official-research-leads-20261023-v1.json","utf8"));
const footprint=JSON.parse(await readFile(base+"cleanser-authority-next-actions-20261023.json","utf8"));
assert.equal(ledger.version,"lagom-cross-market-formulation-research-v1");
assert.equal(ledger.source_type,"PUBLIC_BRAND_RESEARCH_ONLY");
assert.equal(ledger.precision,"PUBLIC_PAGE_CANDIDATE_NOT_GOVERNED_SNAPSHOT");
assert.equal(ledger.manufacturer_contact_confirmed,false);
assert.equal(ledger.full_inci_transcribed,false);
assert.equal(ledger.records.length,2);
assert.equal(new Set(ledger.records.map(x=>x.product_id)).size,2);
const expected=new Map([
 ["e3ebe3ff-8fe8-4aa7-9d6f-2fb6af5069bf",{"KR":220,"GLOBAL_UNSPECIFIED":170,"US":170}],
 ["fa793e6b-9fa6-441d-9b24-9bcc9a111e8c",{"KR":150,"GLOBAL_UNSPECIFIED":120,"US":120}]
]);
for(const x of ledger.records){
  assert.ok(expected.has(x.product_id));
  assert.ok(footprint.expected_product_ids.includes(x.product_id));
  assert.equal(x.exact_sku_confirmed,false);
  assert.equal(x.governed_source_subject_binding_id,null);
  assert.equal(x.source_snapshot_digest,null);
  assert.equal(x.current_fact_reuse,false);
  assert.equal(x.formulation_equivalence,"FORMULA_UNRESOLVED");
  assert.equal(x.recommendation_granted,false);
  assert.deepEqual(x.review_needed,[
    "EXACT_KR_AND_GLOBAL_SKU_OR_GTIN",
    "DISPENSER_PACKAGING_BATCH_AND_SELLING_WINDOW",
    "FULL_INCI_VERSION_AND_MARKET_COMPARISON",
    "MANUFACTURER_SAME_FORMULA_ATTESTATION"
  ]);
  assert.ok(x.sources.length>=3&&x.sources.length<=5);
  const quantities=new Map();
  for(const s of x.sources){
    const host=new URL(s.url);
    assert.equal(host.protocol,"https:");
    assert.equal(host.username,"");
    assert.equal(host.password,"");
    assert.ok(["lagom.kr","www.lagom.kr","www.lagom-global.com","lagom-global.com","lagom-usa.com"].includes(host.hostname));
    assert.ok(["PUBLIC_BRAND_PAGE_UNREVIEWED","PUBLIC_REGION_BRAND_PAGE_UNREVIEWED"].includes(s.source_status));
    assert.ok(s.selected_ingredient_markers.length>=2);
    assert.ok(s.selected_ingredient_markers.length<=3);
    quantities.set(s.market,s.quantity_ml);
  }
  const scopes=expected.get(x.product_id);
  for(const [market,quantity] of Object.entries(scopes))
    assert.equal(quantities.get(market),quantity,"branded source quantity per market must be preserved");
  assert.equal(x.domestic.amount,scopes.KR);
  assert.equal(x.catalog.amount,scopes.GLOBAL_UNSPECIFIED);
  const lead=leads.records.find(y=>y.product_id===x.product_id);
  assert.equal(lead.brand_hosted_catalog_size_evidence,true);
  assert.equal(lead.cross_market_alternate_volume_confirmed,true);
  assert.equal(lead.formulation_equivalence,"FORMULA_UNRESOLVED");
  assert.equal(lead.admission_authorized,false);
}
const gel=ledger.records.find(x=>x.catalog.amount===170);
assert.equal(gel.sources.filter(x=>x.market==="GLOBAL_UNSPECIFIED"&&x.quantity_ml===170).length,2);
const first=gel.sources.find(x=>x.url.endsWith("/503/"));
const other=gel.sources.find(x=>x.url.endsWith("/10/"));
assert.ok(first.selected_ingredient_markers.includes("Polyglyceryl-6 Caprylate"));
assert.ok(other.selected_ingredient_markers.includes("Dimethicone"));
assert.ok(!first.selected_ingredient_markers.includes("Dimethicone"));
const cli=spawnSync(process.execPath,["scripts/run-cleanser-review-worklist-v1.mjs"],{encoding:"utf8",maxBuffer:1024*1024});
assert.equal(cli.status,0,cli.stderr);
const result=JSON.parse(cli.stdout);
assert.equal(result.total,10);
const lagomItems=result.products.filter(x=>x.lagom_regional_variants!==null);
assert.equal(lagomItems.length,2);
for(const p of lagomItems){
  assert.equal(p.lagom_regional_variants.formulation_status,"FORMULA_UNRESOLVED");
  assert.equal(p.lagom_regional_variants.official_formula_equivalence_confirmed,false);
  assert.equal(p.manufacturer_public_research.approved_formulation,false);
}
assert.equal(result.summary.admission_grants,0);
assert.equal(result.summary.official_sku_formulation_review,10);
assert.equal(result.summary.public_manufacturer_display_differs,2);
console.log("Lagom cross-market maker-page review: PASS (2 products, 170/120 global, 220/150 KR, conflicting 170 ingredient leads, no authority)");
