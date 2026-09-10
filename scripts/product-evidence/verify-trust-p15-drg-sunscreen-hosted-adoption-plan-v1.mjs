#!/usr/bin/env node
import fs from "node:fs";
import assert from "node:assert/strict";
import {C,buildCore,canonical,digest} from "./trust-p15-drg-sunscreen-hosted-adoption-plan-v1.mjs";

const frozen=JSON.parse(fs.readFileSync("evidence/product-fact-adoption-v1/trust-p15-drg-sunscreen-hosted-adoption-plan-v1.json","utf8"));
const p14=JSON.parse(fs.readFileSync(C.p14Path,"utf8"));
const core=buildCore(p14);

assert.equal(frozen.version,C.version);
assert.equal(frozen.stage,"TRUST-P15");
assert.equal(frozen.phase,"A_DETERMINISTIC_PLAN_FREEZE");
assert.equal(frozen.source_main_sha,C.sourceMain);
assert.equal(frozen.authority.upstream_p14_merge_sha,C.p14Merge);
assert.equal(frozen.authority.upstream_p14_blob_sha,C.p14Blob);
assert.deepEqual(frozen.subjects,[core.subject]);
assert.deepEqual(frozen.source_observation,core.sourceObservation);
assert.deepEqual(frozen.sources,[core.source]);
assert.deepEqual(frozen.propositions,core.propositions);
assert.equal(core.subject.subject_semantic_key,"5cf97a1d61279faaa9b5ae9368a287dd700a68ea9724aaa07b9c012bcc8489df");
assert.equal(core.source.content_digest,"4f3a80e7068b714d486173bd92438b79279a473e4bffe7dfefe7bebd6b76a81c");
assert.equal(core.propositions[0].proposition_key,"81fe34c1a59057a8fcba46a733500208600f04370e3faa106c0fc6f520db1da6");
assert.equal(core.propositions[0].canonical_evidence_digest,"6d52a9f1b7b4f1db7fb9ffb1f8fe884fadb87d5c678e569d79b83c839431286a");
assert.equal(core.propositions[1].proposition_key,"1035e763996ca2532e2c4e2a511bc01df623f945f440c5af91df5830330ad6b6");
assert.equal(core.propositions[1].canonical_evidence_digest,"5e467c95dce1dbfdeac648ed44370b0a49ba3c16dd987700efe420926ea413a6");
assert.equal(frozen.phase_a_expected_writes,0);
assert.equal(frozen.phase_b_execution_authorized,false);
assert.equal(frozen.phase_b_contract.binding_state,"equivalent_presentation_match");
assert.equal(frozen.phase_b_contract.scope_relation,"equivalent");
assert.equal(frozen.phase_b_contract.all_planned_confirmation_preflights_before_any_confirm,true);
assert.equal(frozen.hosted_prestate.target_subjects,0);
assert.equal(frozen.hosted_prestate.subject_semantic_key_rows,0);
assert.equal(frozen.hosted_prestate.source_identity_rows,0);
assert.equal(frozen.hosted_prestate.spf_proposition_current,0);
assert.equal(frozen.hosted_prestate.uva_proposition_current,0);
assert.equal(frozen.hosted_prestate.spf_evidence_digest_rows,0);
assert.equal(frozen.hosted_prestate.uva_evidence_digest_rows,0);
const {plan_content_sha256,...withoutPlanDigest}=frozen;
assert.equal(digest(withoutPlanDigest),plan_content_sha256);
assert.equal(plan_content_sha256,"d515a8172644aa727ef836ed5ec68e69e5d73e73dbe369141d45154a9473e0a4");
assert.equal(digest(frozen.source_observation),frozen.sources[0].content_digest);
assert.deepEqual(frozen.next_gate.eligible_fact_keys,["spf_value","uva_label"]);

console.log(JSON.stringify({ok:true,stage:frozen.stage,subject_key:core.subject.subject_semantic_key,source_digest:core.source.content_digest,spf_proposition:core.propositions[0].proposition_key,uva_proposition:core.propositions[1].proposition_key,phase_a_writes:frozen.phase_a_expected_writes,plan_content_sha256:frozen.plan_content_sha256},null,2));
