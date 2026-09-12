#!/usr/bin/env node
import fs from "node:fs";
import crypto from "node:crypto";
import assert from "node:assert/strict";

const PATH="evidence/product-fact-adoption-v1/trust-p24-isntree-kr-sunscreen-hosted-adoption-execution-v1.json";
const x=JSON.parse(fs.readFileSync(PATH,"utf8"));
function stable(v) {
  if (Array.isArray(v)) return v.map(stable);
  if (v && typeof v === "object") return Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])]));
  return v;
}
function digest(v) {
  return crypto.createHash("sha256").update(JSON.stringify(stable(v))).digest("hex");
}
assert.equal(x.version,"trust-p24-isntree-kr-sunscreen-hosted-adoption-execution-v1");
assert.equal(x.stage,"TRUST-P24");
assert.equal(x.phase,"B_CONTROLLED_PRODUCTION_EXECUTION_CLOSEOUT");
assert.equal(x.status,"PRODUCTION_CONFIRMED");
assert.equal(x.authority.plan_merge_sha,"cfc6fe9d4a306579b4ad9a0c75bf4746e6c69c3d");
assert.equal(x.authority.plan_content_sha256,"68a7e27d6e0ee5e000fae54287a30bd33d1014b5343194eee1d51291286e2941");
assert.equal(x.target.subject_semantic_key,"31b72283f5cd817d0dd41f62ef8ae4eb149ad8393cdd40810f2e0ad4eb797cd0");
assert.equal(x.execution_policy.controlled_rpc_only,true);
assert.equal(x.execution_policy.direct_table_dml,false);
assert.equal(x.execution_policy.runtime_ids,"server_returned_only");
assert.equal(x.execution_policy.all_planned_confirmation_preflights_ready_before_any_confirm,true);
assert.equal(x.execution_policy.confirmations_executed_in_one_sql_statement,true);
assert.equal(x.execution_policy.confirmation_atomicity,"same_statement_transaction");
assert.deepEqual(x.counts.poststate,{subjects:25,sources:26,bindings:26,evidence:58,fact_instances:58,evidence_links:58,review_assignments:58,confirmations:58,current:58,target_subjects:1,target_current:2,target_spf_current:1,target_uva_current:1,target_confirmed_assignments:2});
assert.deepEqual(x.counts.planned_delta,{subjects:1,sources:1,bindings:1,evidence:2,fact_instances:2,evidence_links:2,review_assignments:2,confirmations:2,current:2});
assert.equal(x.runtime.subject_id,"2f2377dd-b6d2-4a23-a680-733444bf40fc");
assert.equal(x.runtime.source_id,"2e75ba01-7ecb-4824-b712-d7e5d707782d");
assert.equal(x.runtime.binding_id,"597c8303-9c9d-43af-9fc6-806b4541630f");
assert.equal(x.runtime.spf_value.fact_instance_id,"6afcc847-3018-4ec4-94a1-c53c26ee5e66");
assert.equal(x.runtime.spf_value.confirmation_id,"ef66c5a9-0ea5-4947-bb85-a4baeb11e672");
assert.equal(x.runtime.uva_label.fact_instance_id,"c34ed8a5-45a5-44e0-a3b0-8f5cb401ea1a");
assert.equal(x.runtime.uva_label.confirmation_id,"f7e459ec-bffd-46ae-b926-b0d58c423afb");
assert.equal(x.closure.result,"TRUST_P24_PRODUCTION_ADOPTION_CONFIRMED");
const {execution_content_sha256,...body}=x;
assert.equal(digest(body),execution_content_sha256);
assert.equal(execution_content_sha256,"8bcb5affd80a204a3c7e2585026884b5fa2cb336c089a9c4cccbdc7821846c82");
console.log(JSON.stringify({ok:true,stage:x.stage,result:x.closure.result,execution_content_sha256},null,2));
