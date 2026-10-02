#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";

const root = "evidence/product-fact-catalog-expansion-v1";
const paths = {
  contract: `${root}/v21-8g2-0-registry-v1-research-contract-v1.json`,
  A: `${root}/v21-8g2-a-required-fact-research-v1.json`,
  B: `${root}/v21-8g2-b-required-fact-research-v1.json`,
  C: `${root}/v21-8g2-c-required-fact-research-v1.json`,
  closeout: `${root}/v21-8g2-wave1-required-fact-research-closeout-v1.json`,
};
const read = (p) => JSON.parse(fs.readFileSync(p,"utf8"));
const contract = read(paths.contract);
const A = read(paths.A);
const B = read(paths.B);
const C = read(paths.C);
const d = read(paths.closeout);

assert.equal(d.version,"v21-8g2-wave1-required-fact-research-closeout-v1");
assert.equal(d.stage,"V2.1-8G2-CLOSE");
assert.equal(d.source_main_sha,"35b15a1c70389f21951e1b61450da9ff1e7d8588");
assert.equal(d.integration_main_sha,"5d92695eda8e47d3e6cbb727b5d904327ffb8fe0");
assert.equal(d.registry.version,"product-fact-registry-cross-category-v1");
assert.equal(d.registry.registry_checksum,"79d41ac13de8080df5199543e31ad7bbc1c1763836ef776313613b7547b79575");
assert.equal(d.registry.identity_serializer_version,"product-fact-subject-identity-v1");

assert.deepEqual(d.totals,{products:8,subjects:8,tasks:16,direct:6,insufficient:10,blocked:0});
assert.equal(d.handoff_contract.evidence_ingest_authorized,false);
assert.equal(d.handoff_contract.fact_instance_write_authorized,false);
assert.equal(d.handoff_contract.confirmation_authorized,false);
assert.equal(d.handoff_contract.recommendation_activation_authorized,false);
assert.equal(d.handoff_contract.direct_is_not_fact,true);
assert.equal(d.handoff_contract.direct_is_not_ready_for_confirmation,true);
assert.equal(d.handoff_contract.insufficient_false_inference_forbidden,true);

assert.equal(A.task_results.length,6);
assert.equal(B.task_results.length,6);
assert.equal(C.task_results.length,4);
const all = [
  ...A.task_results.map(x=>({...x,wave:"A"})),
  ...B.task_results.map(x=>({...x,wave:"B"})),
  ...C.task_results.map(x=>({...x,wave:"C"})),
];
assert.equal(all.length,16);
assert.equal(new Set(all.map(x=>x.task_id)).size,16);

const direct = all.filter(x=>x.outcome==="DIRECT_EVIDENCE_FOUND");
const insufficient = all.filter(x=>x.outcome==="EVIDENCE_INSUFFICIENT");
const blocked = all.filter(x=>x.outcome==="IDENTITY_OR_SCOPE_BLOCKED");
assert.equal(direct.length,6);
assert.equal(insufficient.length,10);
assert.equal(blocked.length,0);

const contractByTask = new Map(contract.tasks.map(x=>[x.task_id,x]));
assert.equal(contractByTask.size,16);
for (const r of all) {
  const t = contractByTask.get(r.task_id);
  assert.ok(t,`${r.task_id}: missing from 8G2-0 contract`);
  assert.equal(t.registry_version,"product-fact-registry-cross-category-v1");
  assert.equal(t.state,"RESEARCH_PENDING");
  assert.equal(t.attempt_count,0);
  assert.equal(t.last_research_at,null);
  assert.equal(t.source_locator,null);
  assert.equal(t.source_content_digest,null);
  assert.equal(t.definition_checksum,r.definition_checksum);
  assert.equal(t.product_id,r.product_id);
  assert.equal(t.subject_id,r.subject_id);
  assert.equal(t.market_applicability,"KR");
}

const directByTask = new Map(d.direct_candidates.map(x=>[x.task_id,x]));
const insufficientByTask = new Map(d.insufficient_tasks.map(x=>[x.task_id,x]));
assert.equal(directByTask.size,6);
assert.equal(insufficientByTask.size,10);
assert.deepEqual(new Set(directByTask.keys()),new Set(direct.map(x=>x.task_id)));
assert.deepEqual(new Set(insufficientByTask.keys()),new Set(insufficient.map(x=>x.task_id)));

const waveDoc = {A,B,C};
for (const r of all) {
  const agg = r.outcome==="DIRECT_EVIDENCE_FOUND"
    ? directByTask.get(r.task_id)
    : insufficientByTask.get(r.task_id);
  const t = contractByTask.get(r.task_id);
  assert.ok(agg);
  assert.equal(agg.wave,r.wave);
  assert.equal(agg.product_id,r.product_id);
  assert.equal(agg.subject_id,r.subject_id);
  assert.equal(agg.subject_semantic_key,t.subject_semantic_key);
  assert.equal(agg.formulation_revision_key,t.formulation_revision_key);
  assert.equal(agg.market_applicability,t.market_applicability);
  assert.equal(agg.fact_key,r.fact_key);
  assert.equal(agg.definition_checksum,r.definition_checksum);
  assert.equal(agg.outcome,r.outcome);
  assert.deepEqual(agg.proposed_value,r.proposed_value);
  assert.deepEqual(agg.evidence_class,r.evidence_class);
  assert.equal(agg.identity_match,true);
  assert.equal(agg.market_match,true);
  assert.equal(agg.formulation_match,true);

  const srcMap = new Map(waveDoc[r.wave].source_captures.map(s=>[s.source_id,s]));
  assert.equal(agg.sources.length,r.source_ids.length);
  for (const source of agg.sources) {
    const child = srcMap.get(source.source_id);
    assert.ok(child,`${r.task_id}: source missing from child artifact`);
    assert.equal(source.source_locator,child.source_locator);
    assert.equal(source.authority_kind,child.authority_kind);
    assert.equal(source.publisher,child.publisher);
    assert.equal(source.market,child.market);
    assert.equal(source.canonical_capture_digest,child.canonical_capture_digest);
  }

  if (r.outcome==="DIRECT_EVIDENCE_FOUND") {
    assert.equal(agg.eligible_for_8g3,true);
    assert.notEqual(agg.proposed_value,null);
    assert.ok(agg.evidence_class);
  } else {
    assert.equal(agg.eligible_for_8g3,false);
    assert.equal(agg.false_inference_forbidden,true);
    assert.equal(agg.proposed_value,null);
    assert.equal(agg.evidence_class,null);
  }
}

const exactDirect = new Map([
  ["66f0d4df-c1a8-4b67-869a-8ef8b5528779",{fact:"low_ph",value:true,evidence:"product_claim"}],
  ["f133d067-a5f6-44fc-a3f5-6b8706d35c9a",{fact:"barrier_support_claim",value:true,evidence:"measurement"}],
  ["b1ee9a58-538d-4032-a0fe-690c1e82f751",{fact:"primary_use_role",value:"local_area",evidence:"usage_instruction"}],
  ["1b2062c6-9a3d-4fe4-b192-4c1ac06dda2c",{fact:"product_format",value:"liquid",evidence:"physical_characteristic"}],
  ["cf143b70-f9ba-4d57-aa30-2e13da39de25",{fact:"barrier_support_claim",value:true,evidence:"product_claim"}],
  ["46f6bd75-3c64-4edb-ab38-92c1b5897b90",{fact:"primary_use_role",value:"multi_area",evidence:"usage_instruction"}],
]);
assert.deepEqual(new Set(directByTask.keys()),new Set(exactDirect.keys()));
for (const [taskId,e] of exactDirect) {
  const x=directByTask.get(taskId);
  assert.equal(x.fact_key,e.fact);
  assert.deepEqual(x.proposed_value,e.value);
  assert.equal(x.evidence_class,e.evidence);
}
assert.notEqual(
  directByTask.get("b1ee9a58-538d-4032-a0fe-690c1e82f751").proposed_value,
  directByTask.get("46f6bd75-3c64-4edb-ab38-92c1b5897b90").proposed_value,
  "ATOPALM local_area must remain distinct from Dr.G multi_area"
);

assert.deepEqual(d.production_preflight,{
  product_fact_current:95,
  registry_v1_tasks:16,
  pristine_registry_v1_tasks:16,
  registry_v2_tasks:0,
  ready_evidence_records:0,
  ready_fact_instances:0,
  claim_gpt_catalog_research_tasks_v1_exists:false,
  ingest_gpt_catalog_product_v1_exists:false
});

assert.equal(d.decision,"V21_8G2_WAVE1_RESEARCH_CLOSEOUT_PASS_DIRECT6_INSUFFICIENT10");
assert.equal(d.next_gate,"V2.1-8G3-0_EVIDENCE_INGEST_CONTRACT_PREFLIGHT");

console.log(JSON.stringify({
  status:"PASS",
  stage:"V2.1-8G2-CLOSE",
  products:8,
  tasks:16,
  direct:6,
  insufficient:10,
  blocked:0,
  handoffCandidates:6,
  currentFacts:95,
  evidenceWrites:0,
  factInstanceWrites:0,
  decision:d.decision
},null,2));
