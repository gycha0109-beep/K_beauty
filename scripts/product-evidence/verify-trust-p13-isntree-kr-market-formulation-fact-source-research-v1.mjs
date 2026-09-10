#!/usr/bin/env node
import fs from "node:fs";
import crypto from "node:crypto";
import assert from "node:assert/strict";

const P="evidence/product-fact-subject-coverage-v1/trust-p13-isntree-kr-market-formulation-fact-source-research-v1.json";
const P6="evidence/product-fact-subject-coverage-v1/trust-p6-sunscreen-product-fact-subject-coverage-v1.json";
const a=JSON.parse(fs.readFileSync(P,"utf8"));
const p6=JSON.parse(fs.readFileSync(P6,"utf8"));
const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==="object"?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
const digest=v=>crypto.createHash("sha256").update(JSON.stringify(stable(v))).digest("hex");

assert.equal(a.version,"trust-p13-isntree-kr-market-formulation-fact-source-research-v1");
assert.equal(a.stage,"TRUST-P13");
assert.equal(a.authority.source_main_sha,"223ee33b5f68992c4f858b7ddcd8ac2aa07decf7");
const {research_content_sha256,...withoutDigest}=a;
assert.equal(digest(withoutDigest),research_content_sha256);
assert.equal(research_content_sha256,"b769de2dd9858191fe14723aed4e284406f8f2e000c95b14d8bd60d1a0183a52");

assert.equal(p6.version,"trust-p6-sunscreen-product-fact-subject-coverage-v1");
const prior=p6.uncovered_products.find(x=>x.product_id===a.product.product_id);
assert.ok(prior,"P6 Isntree row missing");
assert.equal(prior.status,"MARKET_SCOPE_REVIEW_REQUIRED");
assert.equal(a.product.p6_prior_disposition,prior.status);
assert.equal(a.product.product_id,"336bb533-0fe4-4380-8b9f-ab16fb24b807");
assert.deepEqual(a.allowed_fact_keys,["spf_value","uva_label"]);

assert.equal(a.production_prestate.target_subjects,0);
assert.equal(a.production_prestate.target_current,0);
assert.deepEqual({subjects:a.production_prestate.subjects,sources:a.production_prestate.sources,bindings:a.production_prestate.bindings,evidence:a.production_prestate.evidence,fact_instances:a.production_prestate.fact_instances,evidence_links:a.production_prestate.evidence_links,review_assignments:a.production_prestate.review_assignments,confirmations:a.production_prestate.confirmations,current:a.production_prestate.current},{subjects:20,sources:21,bindings:21,evidence:49,fact_instances:49,evidence_links:49,review_assignments:49,confirmations:49,current:49});

assert.equal(a.sources.length,3);
const krCat=a.sources.find(x=>x.source_kind==="official_category_page"&&x.market==="KR");
const krDetail=a.sources.find(x=>x.source_kind==="official_product_page"&&x.market==="KR");
const global=a.sources.find(x=>x.publisher==="Isntree Global");
assert.ok(krCat&&krDetail&&global,"source set");
assert.equal(krCat.identity_support,true);
assert.equal(krCat.formulation_support,false);
assert.equal(krCat.machine_verifiable_fact_support,false);
assert.deepEqual(krCat.direct_spf_claims,[]);
assert.deepEqual(krCat.direct_pa_claims,[]);
assert.ok(krCat.observed_claims.includes("히아루론산 워터리 선 젤 50ml"));
assert.equal(krDetail.access_state,"current_official_category_link_discovered_direct_fetch_cache_miss");
assert.equal(global.identity_support,true);
assert.equal(global.formulation_support,true);
assert.equal(global.machine_verifiable_fact_support,false);
assert.deepEqual(global.direct_spf_claims,[]);
assert.deepEqual(global.direct_pa_claims,[]);
assert.ok(global.observed_claims.includes("Hyaluronic Acid Watery Sun Gel 50ml"));
assert.ok(global.observed_claims.includes("full ingredient list exposed"));

assert.equal(a.adjudication.kr_market_identity.status,"resolved");
assert.equal(a.adjudication.cross_market_formulation_bridge.status,"not_established");
assert.equal(a.adjudication.spf_value.status,"fact_source_recovery_required");
assert.equal(a.adjudication.uva_label.status,"fact_source_recovery_required");
assert.equal(a.adjudication.subject_registration.status,"blocked");
assert.equal(a.adjudication.disposition,"KR_MARKET_IDENTITY_RESOLVED_FORMULATION_AND_FACT_SOURCE_RECOVERY_REQUIRED");

assert.equal(a.invariants.hosted_product_fact_writes,0);
assert.equal(a.invariants.direct_product_fact_writes,0);
assert.equal(a.invariants.subject_creation_authorized,false);
assert.equal(a.invariants.fact_ingest_authorized,false);
assert.equal(a.invariants.confirmation_authorized,false);
assert.equal(a.invariants.third_party_positive_fact_support_used,0);
assert.equal(a.invariants.spf_inference_from_product_category_or_reviews,false);
assert.equal(a.invariants.pa_inference_from_product_category_or_reviews,false);
assert.equal(a.invariants.cross_market_formulation_equivalence_inferred,false);
assert.equal(a.invariants.recommendation_or_ranking_changes,0);
assert.equal(a.next_gate.required,"first_party_formulation_bridge_and_direct_spf_pa_source_recovery");
assert.equal(a.next_gate.writes_before_gate,0);

console.log(JSON.stringify({ok:true,stage:a.stage,product_id:a.product.product_id,disposition:a.adjudication.disposition,kr_market_identity:a.adjudication.kr_market_identity.status,formulation_bridge:a.adjudication.cross_market_formulation_bridge.status,spf:a.adjudication.spf_value.status,uva:a.adjudication.uva_label.status,production_writes:0,research_content_sha256:a.research_content_sha256},null,2));
