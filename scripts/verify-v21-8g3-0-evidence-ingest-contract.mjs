#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";

const ROOT="evidence/product-fact-catalog-expansion-v1";
const input=JSON.parse(fs.readFileSync(`${ROOT}/v21-8g2-wave1-required-fact-research-closeout-v1.json`,"utf8"));
const d=JSON.parse(fs.readFileSync(`${ROOT}/v21-8g3-0-evidence-ingest-contract-v1.json`,"utf8"));

const stable=(v)=>{
  if(Array.isArray(v)) return v.map(stable);
  if(v && typeof v==="object") return Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])]));
  return v;
};
const digest=(v)=>crypto.createHash("sha256").update(JSON.stringify(stable(v))).digest("hex");
const exactKeys=(obj,keys)=>assert.deepEqual(Object.keys(obj).sort(),[...keys].sort());

assert.equal(d.version,"v21-8g3-0-evidence-ingest-contract-v1");
assert.equal(d.stage,"V2.1-8G3-0");
assert.equal(d.source_main_sha,"f5f49f1cabfcea951688d7d0a30feee193a512fe");
assert.equal(d.integration_main_sha,"7faafd3571cf047ba299f12db0e66f2c64578f08");
assert.equal(d.input_authority.research_closeout_git_blob_sha,"d58495d6463a55ab39037d8f65c564308aff462e");
assert.equal(d.input_authority.research_closeout_decision,"V21_8G2_WAVE1_RESEARCH_CLOSEOUT_PASS_DIRECT6_INSUFFICIENT10");
assert.equal(d.input_authority.registry_version,"product-fact-registry-cross-category-v1");
assert.equal(d.input_authority.registry_checksum,"79d41ac13de8080df5199543e31ad7bbc1c1763836ef776313613b7547b79575");
assert.equal(d.input_authority.proposition_serializer_version,"product-fact-proposition-pilot-v1");
assert.equal(d.input_authority.subject_identity_resolution_version,"v21-8g1-official-identity-v1");

assert.equal(input.direct_candidates.length,6);
assert.equal(d.candidates.length,6);
assert.equal(d.sources.length,4);
assert.equal(d.bindings.length,4);
assert.equal(new Set(d.sources.map(x=>x.source_ref)).size,4);
assert.equal(new Set(d.bindings.map(x=>x.binding_ref)).size,4);
assert.equal(new Set(d.candidates.map(x=>x.task_id)).size,6);
assert.equal(new Set(d.candidates.map(x=>x.request_id)).size,6);
assert.deepEqual(
  new Set(d.candidates.map(x=>x.task_id)),
  new Set(input.direct_candidates.map(x=>x.task_id))
);

assert.deepEqual(d.execution_plan,{
  candidates:6,
  unique_sources:4,
  unique_bindings:4,
  evidence_records:6,
  review_assignments:0,
  fact_instances:0,
  product_fact_current_writes:0,
  committed_writes_in_8g3_0:0,
  transaction_mode_for_8g3_a:"controlled_rpc_only",
  evidence_ingest_authorized_for_8g3_a:true,
  review_preparation_authorized:false,
  confirmation_preflight_authorized:false,
  confirmation_authorized:false,
  recommendation_activation_authorized:false,
  public_activation:false
});

const expectedFunctions={
  admin_ingest_function_sha256:"c5bf2429801f3f5811c41d3c39fbddff3eca2914bccb59f100321f369264b481",
  admin_prepare_review_function_sha256:"9d0992369021a37a83c96561f8ad3d9e9b505a61771b7b5312fa35fc424dbff1",
  admin_preflight_confirmation_function_sha256:"7d9ce38e47468fb1a419528256857e399a3d7e50e719f7bd449034c96019f59e",
  controlled_build_preflight_function_sha256:"b736e373ebbcf577f332626e9fab2d8715c87c8a69a931de2ba3727bcc102f16",
  registry_write_admissibility_function_sha256:"0234789969fd824b975d58e166125220ff24e83717e12186723c58a5628a1743",
  canonical_json_function_sha256:"01420646597cd144a594c2eef7cdf46c13b1d67da0188c77e01d628664be27a5",
  sha256_json_function_sha256:"53d8226a25f3573d9e8f6f86fc4a2eb83938cfee6ea55f3a61fa0430595ca7ce"
};
for(const [k,v] of Object.entries(expectedFunctions)) assert.equal(d.runtime_contract[k],v);
assert.equal(d.runtime_contract.service_role_execute_only,true);
assert.equal(d.runtime_contract.active_review_actor,true);
assert.equal(d.runtime_contract.actor_user_id,"e1a59349-fe13-43ff-86ce-078c2dce0d99");
assert.equal(d.runtime_contract.required_capability,"admin.products.review");

const expectedPolicyDigests={
  low_ph:"e5550958e3c121ca855d5e1fa267e709a7841020850f1641e964607588dcf2fc",
  barrier_support_claim:"6f3cbd77ba4501100cc637c2ac1300ccc0591563973a50c8d28a4b70503c6f6e",
  primary_use_role:"1ee29792af7acddc521916fedef250944d10e2a4c0a55ef75ba46a9d3ca03e46",
  product_format:"73fa5003af5d5591c2a99d3215b1ec7a3c845a17742db03995c2d39bc264bf61"
};
for(const [factKey,policyDigest] of Object.entries(expectedPolicyDigests)){
  assert.equal(d.registry_write_policy[factKey].policy_digest,policyDigest);
  assert.equal(d.registry_write_policy[factKey].new_lineage_allowed,true);
  assert.equal(d.registry_write_policy[factKey].existing_lineage_allowed,true);
}
assert.equal(d.registry_write_policy.policy_version,"data-ai29c-uva-r3d-registry-coexistence-v1");
assert.equal(d.registry_write_policy.policy_state,"active");

const sourceByRef=new Map(d.sources.map(x=>[x.source_ref,x.payload]));
const bindingBySource=new Map(d.bindings.map(x=>[x.source_ref,x.payload]));
const inputByTask=new Map(input.direct_candidates.map(x=>[x.task_id,x]));

const sourceKeys=[
  "canonical_locator","publisher","source_kind","source_metadata","content_digest",
  "external_snapshot_reference","market","region","locale","published_at","accessed_at","observed_at"
];
const bindingKeys=[
  "product_id","subject_id","binding_state","scope_relation","presentation_metadata",
  "identity_resolution_version","reviewed_at"
];
const evidenceKeys=[
  "registry_version","fact_key","proposition_key","proposition_serializer_version",
  "proposition_value_identity","parent_proposition_key","evidence_class","evidence_authority",
  "confidence","support_direction","negative_admissibility","market","region","locale",
  "valid_from","valid_to","qualifier","canonical_evidence_digest","supersedes_evidence_id"
];

const exactExpected=new Map([
  ["66f0d4df-c1a8-4b67-869a-8ef8b5528779",{source:"beplain_product",fact:"low_ph",value:true,evidence:"product_claim",proposition:"ebf267ec813986fb282ff61eb30846e35e1eaa1222b8243bde5b8e8cd4f5d1e7",evidenceDigest:"e1b294d1f02395521f4e5783532f2ab42ea93a52e1a16d24bc88c0162f88a623"}],
  ["f133d067-a5f6-44fc-a3f5-6b8706d35c9a",{source:"atopalm_product",fact:"barrier_support_claim",value:true,evidence:"measurement",proposition:"776518f7ef5cc2079623a67bd3ea387acac89afbc9bcda107878b7da3e058590",evidenceDigest:"6a03fa1643bec33fc43550e60c9b0303dff73aa56935e37cce0a91b2bdb0433b"}],
  ["b1ee9a58-538d-4032-a0fe-690c1e82f751",{source:"atopalm_product",fact:"primary_use_role",value:"local_area",evidence:"usage_instruction",proposition:"5ef27cd2a45dd0bc8d450b09532b761b5df093b91829222ac368578dd38f01ba",evidenceDigest:"c45129bb8002d956f7622a1c4e1cea465d45100713f76815207522aba05b5885"}],
  ["1b2062c6-9a3d-4fe4-b192-4c1ac06dda2c",{source:"dr20_category",fact:"product_format",value:"liquid",evidence:"physical_characteristic",proposition:"730ffbc3483c2e02c57b3381a4101be73525fe1a96e103a0660a27eb301adebd",evidenceDigest:"8f6fed4df0d48b88bc139e003b71b3e16123211ae39bb71a8e813e75df85625c"}],
  ["cf143b70-f9ba-4d57-aa30-2e13da39de25",{source:"drg_product",fact:"barrier_support_claim",value:true,evidence:"product_claim",proposition:"21699978665834b197081ffe419ca6aa6a6aca12698a4f55ddfbd6cdd59008e0",evidenceDigest:"baeac7d059ca991c72673e9ccfc92a30411a05bfcf80d87e90a4321e12deb750"}],
  ["46f6bd75-3c64-4edb-ab38-92c1b5897b90",{source:"drg_product",fact:"primary_use_role",value:"multi_area",evidence:"usage_instruction",proposition:"638768a54ec7dfc7082f522241d53d896c21b07ffb4f1e00ff89e5e2821a80d6",evidenceDigest:"9fc611e224400af8014a9ce32908664a0d4cde322f31f3d6587f01eed309539e"}]
]);

for(const candidate of d.candidates){
  const expected=exactExpected.get(candidate.task_id);
  const frozen=inputByTask.get(candidate.task_id);
  assert.ok(expected);
  assert.ok(frozen);
  assert.equal(candidate.source_ref,expected.source);
  assert.equal(candidate.proposition_key,expected.proposition);
  assert.equal(candidate.canonical_evidence_digest,expected.evidenceDigest);

  exactKeys(candidate.rpc_payload,["source","binding","evidence"]);
  exactKeys(candidate.rpc_payload.source,sourceKeys);
  exactKeys(candidate.rpc_payload.binding,bindingKeys);
  exactKeys(candidate.rpc_payload.evidence,evidenceKeys);
  assert.deepEqual(candidate.rpc_payload.source,sourceByRef.get(candidate.source_ref));
  assert.deepEqual(candidate.rpc_payload.binding,bindingBySource.get(candidate.source_ref));

  const e=candidate.rpc_payload.evidence;
  const b=candidate.rpc_payload.binding;
  const s=candidate.rpc_payload.source;
  assert.equal(b.product_id,frozen.product_id);
  assert.equal(b.subject_id,frozen.subject_id);
  assert.equal(b.presentation_metadata.subject_semantic_key,frozen.subject_semantic_key);
  assert.equal(b.presentation_metadata.formulation_revision_key,frozen.formulation_revision_key);
  assert.equal(b.binding_state,"exact_subject_match");
  assert.equal(b.scope_relation,"equivalent");
  assert.equal(b.identity_resolution_version,"v21-8g1-official-identity-v1");
  assert.equal(s.market,"KR");

  assert.equal(e.registry_version,"product-fact-registry-cross-category-v1");
  assert.equal(e.fact_key,expected.fact);
  assert.deepEqual(e.proposition_value_identity,expected.value);
  assert.equal(e.evidence_class,expected.evidence);
  assert.equal(e.evidence_authority,"product_specific_primary");
  assert.equal(e.confidence,"high");
  assert.equal(e.support_direction,"supports");
  assert.equal(e.negative_admissibility,"not_applicable");
  assert.equal(e.market,"KR");
  assert.equal(e.region,null);
  assert.equal(e.locale,null);
  assert.equal(e.parent_proposition_key,null);
  assert.deepEqual(e.qualifier,{});
  assert.equal(e.supersedes_evidence_id,null);

  const propositionIdentity={
    serializer_version:"product-fact-proposition-pilot-v1",
    subject_semantic_key:frozen.subject_semantic_key,
    registry_version:"product-fact-registry-cross-category-v1",
    fact_key:expected.fact,
    value_identity:expected.value,
    scope:{market:"KR"},
    qualifier:{},
    parent_proposition_key:null
  };
  assert.equal(digest(propositionIdentity),expected.proposition);

  const evidenceIdentity={
    digest_contract:"v21-8g3-evidence-v1",
    task_id:candidate.task_id,
    source_content_digest:s.content_digest,
    subject_semantic_key:frozen.subject_semantic_key,
    registry_version:"product-fact-registry-cross-category-v1",
    fact_key:expected.fact,
    proposition_key:expected.proposition,
    proposition_value_identity:expected.value,
    evidence_class:expected.evidence,
    evidence_authority:"product_specific_primary",
    confidence:"high",
    support_direction:"supports",
    negative_admissibility:"not_applicable",
    scope:{market:"KR"},
    qualifier:{}
  };
  assert.equal(digest(evidenceIdentity),expected.evidenceDigest);
}

const dr20=d.candidates.find(x=>x.task_id==="1b2062c6-9a3d-4fe4-b192-4c1ac06dda2c");
assert.equal(dr20.source_ref,"dr20_category");
assert.ok(inputByTask.get(dr20.task_id).sources.some(x=>x.source_id==="dr20_product"));
assert.ok(inputByTask.get(dr20.task_id).sources.some(x=>x.source_id==="dr20_category"));

assert.equal(d.rollback_probe.decision,"V21_8G3_0_ROLLBACK_PROBE_PASS");
assert.equal(d.rollback_probe.rpc_calls_attempted,6);
assert.equal(d.rollback_probe.rpc_calls_accepted,6);
assert.equal(d.rollback_probe.transaction_rolled_back,true);
assert.deepEqual(d.rollback_probe.residue,{
  product_fact_current:95,
  target_sources:0,
  target_bindings:0,
  target_evidence:0,
  probe_admin_audits:0,
  probe_review_events:0
});

assert.deepEqual(d.production_prestate,{
  product_fact_current:95,
  ready_v1_tasks:16,
  pristine_ready_v1_tasks:16,
  ready_v2_tasks:0,
  ready_evidence_records:0,
  ready_fact_instances:0,
  exact_target_sources:0,
  exact_target_bindings:0,
  exact_target_evidence:0,
  claim_gpt_catalog_research_tasks_v1_exists:false,
  ingest_gpt_catalog_product_v1_exists:false
});

assert.equal(d.decision,"V21_8G3_0_EVIDENCE_INGEST_CONTRACT_PREFLIGHT_PASS");
assert.equal(d.next_gate,"V2.1-8G3-A_CONTROLLED_EVIDENCE_INGEST");

console.log(JSON.stringify({
  status:"PASS",
  stage:"V2.1-8G3-0",
  candidates:6,
  sources:4,
  bindings:4,
  evidenceRecords:6,
  rollbackProbe:"6/6 accepted, residue 0",
  committedWrites:0,
  currentFacts:95,
  decision:d.decision
},null,2));
