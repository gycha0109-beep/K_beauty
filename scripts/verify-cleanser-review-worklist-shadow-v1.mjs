#!/usr/bin/env node
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {readFile} from "node:fs/promises";
import {buildCleanserReviewWorklistV1 as build}
  from "../lib/trust/cleanser-review-worklist-shadow-v1.mjs";
const fixture=JSON.parse(await readFile(
  "evidence/trust/cleanser-authority-next-actions-20261023.json","utf8"));
assert.equal(fixture.rows.length,10);
const input={rows:fixture.rows,expected_product_ids:fixture.expected_product_ids,as_of:fixture.as_of};
const result=build(input);
assert.equal(result.products_count,10);
assert.equal(result.missing_official_identity_count,10);
assert.equal(result.missing_hwahae_capture_count,3);
assert.equal(result.missing_approved_recommendation_metadata_count,10);
assert.equal(result.research_queue_mismatch_count,0);
assert.equal(result.admission_grants,0);
assert.equal(result.production_writes,0);
assert.deepEqual(result.products.map(x=>x.product_id),[...fixture.expected_product_ids].sort());
assert.ok(result.products.every(x=>x.next_action==="P1_VERIFY_OFFICIAL_SKU_SUBJECT_SOURCE"));
assert.ok(result.products.every(x=>x.inventory.existing_research_tasks===2));
assert.ok(result.products.every(x=>x.inventory.approved_recommendation_metadata_fields===0));
assert.ok(result.products.every(x=>x.recommendation_admission_granted===false));
const hwahaeMissing=result.products.filter(x=>
  x.actions.includes("P2_RESEARCH_HWAHAE_EXACT_PRODUCT_CAPTURE"));
assert.deepEqual(hwahaeMissing.map(x=>x.product_id).sort(),
  ["4f918d80-be34-4857-817b-6ad88ddf1bee",
   "e3ebe3ff-8fe8-4aa7-9d6f-2fb6af5069bf",
   "fa793e6b-9fa6-441d-9b24-9bcc9a111e8c"].sort());
const mass=result.products.filter(x=>x.special_size_review.includes("130G_IS_NOT_130ML"));
assert.equal(mass.length,3);
assert.equal(result.products.filter(x=>x.special_size_review.includes("UNVERIFIED_RESEARCH_LEAD_120_TO_150ML")).length,1);
assert.equal(result.products.filter(x=>x.special_size_review.includes("UNVERIFIED_RESEARCH_LEAD_170_TO_220ML")).length,1);
assert.equal(result.products.filter(x=>x.special_size_review.includes("UNVERIFIED_OFFICIAL_240ML")).length,1);
// The order of DB SELECT rows does not change a review worklist.
assert.deepEqual(build({...input,rows:[...input.rows].reverse()}),result);
// Presence of catalog URL, hwahae review counts or a new seller offer
// is never source-to-Subject authority or Fact evidence.
const sourceLinkOnly=structuredClone(input);
sourceLinkOnly.rows.forEach(x=>{x.source_link_present=true;x.hwahae_link_equal=true;
  x.hwahae_signals_present=true;x.offers=3});
const changed=build(sourceLinkOnly);
assert.equal(changed.missing_official_identity_count,10);
assert.equal(changed.admission_grants,0);
const stale=structuredClone(input);
stale.rows[0].research_tasks=1;
assert.equal(build(stale).research_queue_mismatch_count,1);
assert.ok(build(stale).products[0].actions.includes("P0_RECONCILE_EXISTING_RESEARCH_TASKS"));
for(const update of [
  x=>x.rows.pop(),
  x=>x.rows[0].id=x.rows[1].id,
  x=>x.rows[0].source_link_present="confirmed",
  x=>x.rows[0].subjects=-1,
  x=>x.expected_product_ids.pop(),
  x=>x.rows[0].category="serum"
]){
  const x=structuredClone(input);update(x);
  assert.throws(()=>build(x),TypeError);
}
const cli=spawnSync(process.execPath,["scripts/run-cleanser-review-worklist-v1.mjs"],
  {encoding:"utf8",maxBuffer:1024*1024});
assert.equal(cli.status,0,cli.stderr);
const human=JSON.parse(cli.stdout);
assert.equal(human.total,10);
assert.equal(human.summary.official_sku_formulation_review,10);
assert.equal(human.summary.hwahae_product_capture_review,3);
assert.equal(human.summary.recommendation_metadata_review,10);
assert.equal(human.summary.admission_grants,0);
assert.ok(human.products.every(x=>x.next_step.includes("제조사 원본")));
const cliDenied=spawnSync(process.execPath,["scripts/run-cleanser-review-worklist-v1.mjs","--allow-production"],
  {encoding:"utf8",maxBuffer:1024*1024});
assert.notEqual(cliDenied.status,0);
console.log("Cleanser exact-ten authorized next-actions Shadow: PASS (real redacted SELECT flags, 10 source reviews / 3 Hwahae / 10 metadata, grants=0)");
