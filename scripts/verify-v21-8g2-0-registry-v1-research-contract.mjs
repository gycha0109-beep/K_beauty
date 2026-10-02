#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";

const contractPath = "evidence/product-fact-catalog-expansion-v1/v21-8g2-0-registry-v1-research-contract-v1.json";
const contract = JSON.parse(fs.readFileSync(contractPath,"utf8"));

assert.equal(contract.version,"v21-8g2-0-registry-v1-research-contract-v1");
assert.equal(contract.stage,"V2.1-8G2-0");
assert.equal(contract.source_main_sha,"cdb9bd85e515616778c1971569d18586610f5066");

assert.equal(contract.scope.ready_products,8);
assert.equal(contract.scope.exact_tasks,16);
assert.equal(contract.scope.hold_products_excluded,4);
assert.equal(contract.scope.replacement_products,0);
assert.equal(contract.scope.research_started,false);

assert.equal(contract.registry.pinned_version,"product-fact-registry-cross-category-v1");
assert.equal(contract.registry.pinned_checksum,"79d41ac13de8080df5199543e31ad7bbc1c1763836ef776313613b7547b79575");
assert.equal(contract.registry.identity_serializer_version,"product-fact-subject-identity-v1");
assert.equal(contract.registry.candidate_v2_version,"product-fact-registry-cross-category-v2");
assert.equal(contract.registry.v2_write_policy_expected,"POLICY_MISSING_FAIL_CLOSED");
assert.equal(contract.registry.definitions.length,6);
assert.equal(contract.registry.v2_definition_checksums.length,6);

const expectedChecksums = new Map(Object.entries({
  barrier_support_claim:"108ad711469c9018bc06560fce20257f05d32d3a4ed57571a4df5f653abc850d",
  contains_active:"7b6f785309dc34f6cd4042ebc7b108b49e118c364e633457c3baf53c77dcb7b3",
  deep_cleansing:"43e03202518cb69cbf63f08f8494f8f0aabf252dcf942a241c6aac636ed91fd7",
  low_ph:"2c695147eda6da905207cfa5d4c32e756ff0fa7726e04882f5da5a6f3f29bdcf",
  primary_use_role:"7e12fb3509c5978f01ab1e7d53ec8a86311de4fa6ead83f0391237abe0044dca",
  product_format:"f04ee27fd5526ce0866693d146811324f0da4c323fd55f82e91c38ef9273fcc4",
}));

for (const d of contract.registry.definitions) {
  assert.equal(d.definition_checksum,expectedChecksums.get(d.fact_key));
  assert.equal(d.policy_state,"active");
  assert.equal(d.new_lineage_allowed,true);
  assert.equal(d.existing_lineage_allowed,true);
  assert.equal(d.positive_evidence_requirement,"product-specific evidence");
  assert.equal(d.negative_evidence_requirement,"explicit_negative_only");
  assert.ok(Array.isArray(d.permitted_evidence_classes));
  assert.ok(d.permitted_evidence_classes.length >= 1);
}

const v2Map = new Map(contract.registry.v2_definition_checksums.map(x=>[x.fact_key,x.definition_checksum]));
for (const [factKey,v1Checksum] of expectedChecksums) {
  assert.ok(v2Map.has(factKey));
  assert.notEqual(v2Map.get(factKey),v1Checksum);
}

assert.deepEqual(contract.wave_task_counts,{A:6,B:6,C:4});
assert.equal(contract.tasks.length,16);
assert.equal(new Set(contract.tasks.map(x=>x.task_id)).size,16);
assert.equal(new Set(contract.tasks.map(x=>x.product_id)).size,8);
assert.equal(new Set(contract.tasks.map(x=>x.subject_id)).size,8);

const waveCounts={A:0,B:0,C:0};
for (const t of contract.tasks) {
  waveCounts[t.wave] += 1;
  assert.equal(t.registry_version,"product-fact-registry-cross-category-v1");
  assert.equal(t.research_policy_version,"product-fact-required-policy-v1");
  assert.equal(t.state,"RESEARCH_PENDING");
  assert.equal(t.attempt_count,0);
  assert.equal(t.last_research_at,null);
  assert.equal(t.source_locator,null);
  assert.equal(t.source_content_digest,null);
  assert.equal(t.market_applicability,"KR");
  assert.equal(t.definition_checksum,expectedChecksums.get(t.fact_key));
}
assert.deepEqual(waveCounts,{A:6,B:6,C:4});

assert.deepEqual(contract.research_contract.allowed_outcomes,[
  "DIRECT_EVIDENCE_FOUND",
  "EVIDENCE_INSUFFICIENT",
  "IDENTITY_OR_SCOPE_BLOCKED",
]);
assert.equal(contract.research_contract.missing_implies_false,false);
assert.equal(contract.research_contract.negative_requires_explicit_negative,true);
assert.equal(contract.research_contract.official_source_first,true);
assert.equal(contract.research_contract.product_subject_scope_transfer,false);
assert.equal(contract.research_contract.evidence_write_authorized,false);
assert.equal(contract.research_contract.fact_instance_write_authorized,false);
assert.equal(contract.research_contract.confirmation_authorized,false);
assert.equal(contract.research_contract.recommendation_activation_authorized,false);

assert.equal(contract.worker_interference.claim_rpc_exists,false);
assert.equal(contract.worker_interference.ingest_rpc_exists,false);
assert.equal(contract.worker_interference.all_attempt_count_zero,true);
assert.equal(contract.worker_interference.all_last_research_at_null,true);
assert.equal(contract.worker_interference.all_research_pending,true);

assert.equal(contract.production_invariants.product_fact_current_total,95);
assert.equal(contract.production_invariants.ready_v2_tasks,0);
assert.equal(contract.production_invariants.ready_evidence_records,0);
assert.equal(contract.production_invariants.ready_fact_instances,0);
assert.equal(contract.production_invariants.public_activation,false);

assert.equal(contract.next_gate,"V2.1-8G2-A_REQUIRED_FACT_RESEARCH_BEPLAIN_DR20_ATOPALM_6_TASKS");

console.log(JSON.stringify({
  status:"PASS",
  stage:"V2.1-8G2-0",
  registry:"product-fact-registry-cross-category-v1",
  definitions:6,
  tasks:16,
  waves:contract.wave_task_counts,
  workerInterference:false,
  productFactCurrent:95,
  evidenceWrites:0,
  factInstanceWrites:0,
  decision:"V21_8G2_0_REGISTRY_V1_RESEARCH_CONTRACT_PASS"
},null,2));
