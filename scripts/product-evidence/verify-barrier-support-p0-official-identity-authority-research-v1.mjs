#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";

const STAGE="V2.1-8H-R9";
const TERMINAL="BARRIER_SUPPORT_P0_OFFICIAL_IDENTITY_RESEARCH_READY3_HOLD2";
const ROOT="evidence/product-decision-axis-non-numeric-shadow-v2";
const RESEARCH=`${ROOT}/barrier-support-p0-official-identity-authority-research-v1.json`;
const LEDGER=`${ROOT}/barrier-support-p0-official-identity-decision-ledger-v1.json`;
const R8=`${ROOT}/barrier-support-coverage-recovery-prioritization-summary-v1.json`;
const DOC="docs/evidence/v21-8h-r9-barrier-p0-official-identity-authority-research-v1.md";
let assertions=0;
const eq=(a,b,m)=>{assert.deepEqual(a,b,m);assertions+=1};
const ok=(v,m)=>{assert.ok(v,m);assertions+=1};
const read=p=>fs.readFileSync(p,"utf8");
const json=p=>JSON.parse(read(p));
const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==="object"?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
const canonical=p=>`${JSON.stringify(stable(json(p)))}\n`;

const research=json(RESEARCH), ledger=json(LEDGER), r8=json(R8);
eq(research.stage,STAGE,"research stage");
eq(ledger.stage,STAGE,"ledger stage");
eq(ledger.primary_terminal_outcome,TERMINAL,"terminal");
eq(r8.primary_terminal_outcome,"BARRIER_SUPPORT_COVERAGE_RECOVERY_PRIORITIZATION_FROZEN","R8 terminal");
eq(r8.p0_wave.count,5,"R8 P0 count");

const expectedP0=[
  "b1f6b527-679f-48f3-9b58-5d28ec095f2f",
  "418e2bc1-7d6c-4334-9058-7af7ce159c6c",
  "7a98b5e7-2c1f-441a-afee-dd1c592d95bc",
  "e15a1f7e-29b3-49fd-aae4-297bf9ada4ed",
  "06d1ad4b-2291-4b73-8bf4-f1f3c0226fea"
];
eq(new Set(research.products.map(x=>x.product_id)),new Set(expectedP0),"exact P0 five");
eq(ledger.counts,{selected:5,ready:3,hold:2,subject_writes:0,product_fact_writes:0},"counts");
eq(ledger.ready_product_ids,[
  "b1f6b527-679f-48f3-9b58-5d28ec095f2f",
  "e15a1f7e-29b3-49fd-aae4-297bf9ada4ed",
  "06d1ad4b-2291-4b73-8bf4-f1f3c0226fea"
],"READY3");
eq(ledger.hold_product_ids,[
  "418e2bc1-7d6c-4334-9058-7af7ce159c6c",
  "7a98b5e7-2c1f-441a-afee-dd1c592d95bc"
],"HOLD2");

for(const p of research.products){
  ok(["READY","HOLD"].includes(p.decision),`${p.product_id}: decision enum`);
  ok(Array.isArray(p.first_party_sources)&&p.first_party_sources.length>=1,`${p.product_id}: first-party source captured`);
  eq(p.market,"KR",`${p.product_id}: KR market`);
  if(p.decision==="READY"){
    eq(p.reason_code,"FIRST_PARTY_EXACT_PRESENTATION_ESTABLISHED",`${p.product_id}: ready authority`);
    eq(p.unresolved,[],`${p.product_id}: no unresolved identity blockers`);
    ok(p.first_party_sources.some(s=>s.observed_size_ml===p.catalog_size_ml),`${p.product_id}: exact first-party size`);
  }
}

const atopalm=research.products.find(x=>x.product_id==="418e2bc1-7d6c-4334-9058-7af7ce159c6c");
eq(atopalm.decision,"HOLD","ATOPALM hold");
eq(atopalm.reason_code,"BUNDLE_PRESENTATION_SCOPE_UNRESOLVED","ATOPALM bundle scope");
eq(atopalm.catalog_size_ml,200,"ATOPALM catalog 200");
ok(atopalm.first_party_sources.some(x=>x.presentation_kind==="single_unit"&&x.observed_size_ml===100),"ATOPALM 100ml single");
ok(atopalm.first_party_sources.some(x=>x.presentation_kind==="bundle"&&x.observed_unit_size_ml===100&&x.observed_unit_count===2&&x.observed_total_ml===200),"ATOPALM 2x100 bundle");

const zeroid=research.products.find(x=>x.product_id==="7a98b5e7-2c1f-441a-afee-dd1c592d95bc");
eq(zeroid.decision,"HOLD","ZEROID hold");
eq(zeroid.reason_code,"FIRST_PARTY_PRESENTATION_SIZE_UNCONFIRMED","ZEROID size gap");
ok(zeroid.first_party_sources.some(x=>x.observed_formula==="FULL_INGREDIENT_LIST_VISIBLE"),"ZEROID official formula captured");
ok(!zeroid.first_party_sources.some(x=>x.observed_size_ml===40),"ZEROID first-party 40ml not asserted");
ok(zeroid.secondary_sources.some(x=>x.observed_size_ml===40),"ZEROID secondary 40ml only");

eq(research.authority_policy.secondary_source_may_corroborate_but_cannot_close_missing_first_party_presentation_scope,true,"secondary cannot close");
eq(research.authority_policy.bundle_total_must_not_be_silently_treated_as_single_unit_size,true,"bundle total rule");
for(const key of ["subject_registration_authorized","product_fact_write_authorized"]) eq(research.authority_policy[key],false,`policy ${key}`);
for(const key of ["subject_registration_authorized","evidence_research_started","product_fact_adjudication_started","product_fact_write_authorized","recommendation_activation","public_activation"]) eq(ledger.authority_boundary[key],false,`boundary ${key}`);
eq(ledger.authority_boundary.missing_implies_false,false,"missing != false");
eq(ledger.next_gate.stage,"V2.1-8H-R10_BARRIER_SUPPORT_P0_READY3_SUBJECT_IDENTITY_PREFLIGHT","next gate");
eq(ledger.next_gate.ready_product_count,3,"next READY3");
eq(ledger.next_gate.hold_product_count,2,"next HOLD2");
eq(ledger.next_gate.status,"RECOMMENDED_NOT_EXECUTED","R10 not executed");

for(const p of [RESEARCH,LEDGER]) eq(read(p),canonical(p),`${p}: canonical bytes`);
const doc=read(DOC);
for(const token of [TERMINAL,"READY 3","HOLD 2","BUNDLE_PRESENTATION_SCOPE_UNRESOLVED","FIRST_PARTY_PRESENTATION_SIZE_UNCONFIRMED","V2.1-8H-R10"]) ok(doc.includes(token),`doc token ${token}`);
console.log(JSON.stringify({status:"PASS",stage:STAGE,terminal:TERMINAL,assertions,ready:3,hold:2}));
