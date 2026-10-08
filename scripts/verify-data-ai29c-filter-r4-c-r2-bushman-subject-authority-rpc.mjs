#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
const e=JSON.parse(fs.readFileSync("evidence/product-fact-catalog-expansion-v1/data-ai29c-filter-r4-c-r2-bushman-subject-authority-rpc-implementation-v1.json","utf8"));
const prior=JSON.parse(fs.readFileSync("evidence/product-fact-catalog-expansion-v1/data-ai29c-filter-r4-c-r1-bushman-identity-authority-contract-v1.json","utf8"));
const sql=fs.readFileSync("supabase/migrations/20261009003000_data_ai29c_filter_r4_c_r2_bushman_subject_auth_v1.sql","utf8");
const expected=prior.sourceBridge.evidenceSources.map(s=>({source_id:s.sourceId,binding_id:s.bindingId,content_digest:s.digest})).sort((a,b)=>a.source_id.localeCompare(b.source_id));
const checks=[
 ["stage",()=>assert.equal(e.stage,"DATA-AI29C-FILTER-R4-C-R2")],
 ["decision",()=>assert.equal(e.decision,"R4_C_R2_BOUNDED_RPC_IMPLEMENTED_NOT_DEPLOYED")],
 ["source_count",()=>assert.equal(expected.length,4)],
 ["source_frozen",()=>assert.deepEqual(e.frozenOfficialSourcePairs,expected)],
 ["sql_source_frozen",()=>assert.ok(sql.includes(JSON.stringify(expected)))],
 ["product",()=>assert.ok(sql.includes(e.target.productId))],
 ["subject",()=>assert.ok(sql.includes(e.target.subjectId))],
 ["semantic_key",()=>assert.ok(sql.includes(e.target.subjectSemanticKey))],
 ["authority_from",()=>assert.ok(sql.includes(e.target.fromAuthority))],
 ["authority_to",()=>assert.ok(sql.includes(e.target.toAuthority))],
 ["source_binding",()=>assert.ok(sql.includes(prior.sourceBridge.productSource.bindingId))],
 ["source_review",()=>assert.ok(sql.includes(prior.sourceBridge.sourceReview.reviewId))],
 ["attestation_table",()=>assert.ok(sql.includes("create table public.bushman_subject_identity_attestations_v1"))],
 ["attestation_risk_boundary",()=>assert.equal(e.review.independentAttestationIssuerImplemented,false)],
 ["no_fake_attestation",()=>assert.ok(!sql.toLowerCase().includes("insert into public.bushman_subject_identity_attestations_v1"))],
 ["force_rls",()=>assert.ok(sql.includes("force row level security"))],
 ["revoke_table",()=>assert.ok(sql.includes("revoke all on public.bushman_subject_identity_attestations_v1"))],
 ["internal_plan",()=>assert.ok(sql.includes("create or replace function public.bushman_identity_auth_plan_v1"))],
 ["read_only_preflight",()=>assert.ok(sql.includes("create or replace function public.admin_pf_bushman_identity_auth_v1"))],
 ["explicit_confirmation",()=>assert.ok(sql.includes("create or replace function public.admin_confirm_bushman_identity_auth_v1"))],
 ["acl_restrict",()=>assert.ok(sql.includes("revoke all on function public.bushman_identity_auth_plan_v1"))],
 ["service_role_wrapper",()=>assert.ok(sql.includes("grant execute on function public.admin_confirm_bushman_identity_auth_v1"))],
 ["actor_capability",()=>assert.ok(sql.includes("admin_require_product_review_actor(p_actor_user_id,'admin.products.review')"))],
 ["current_subject_cardinality",()=>assert.ok(sql.includes("r4c_r2_competing_subject"))],
 ["official_source_cardinality",()=>assert.ok(sql.includes("jsonb_array_length(official_rows)<>4"))],
 ["required_admin_attestation",()=>assert.ok(sql.includes("r4c_r2_attestation_missing_or_invalid"))],
 ["50g_50ml_review",()=>assert.ok(sql.includes("same_product_verified")&&sql.includes("50ml"))],
 ["fresh_receipt",()=>assert.ok(sql.includes("fresh_observed_at<now()-interval '90 days'"))],
 ["stale_guard",()=>assert.ok(sql.includes("r4c_r2_stale_preflight"))],
 ["digest",()=>assert.ok(sql.includes("product_fact_controlled_sha256_json_v1(snapshot)"))],
 ["advisory_lock",()=>assert.ok(sql.includes("pg_advisory_xact_lock"))],
 ["row_lock",()=>assert.ok(sql.includes("for update"))],
 ["attestation_share_lock",()=>assert.ok(sql.includes("for share"))],
 ["idempotent",()=>assert.ok(sql.includes("r4c_r2_request_reuse_conflict"))],
 ["review_event",()=>assert.ok(sql.includes("insert into public.product_fact_review_events"))],
 ["audit_event",()=>assert.ok(sql.includes("record_admin_audit_event(p_actor_user_id"))],
 ["only_subject_update",()=>assert.equal((sql.match(/update public\.product_fact_subjects/g)||[]).length,1)],
 ["no_cosrx_mutation",()=>assert.ok(!sql.includes("create or replace function public.product_fact_subject_identity_authority_upgrade_plan_v1"))],
 ["no_production_deployment",()=>assert.equal(e.validation.productionMigrationApplied,false)],
 ["no_sql_runtime_claim",()=>assert.equal(e.validation.sqlRuntimeCompiledOrExecuted,false)]
];
for(const [name,fn] of checks){try{fn()}catch(err){throw new Error(name+": "+err.message)}}
assert.deepEqual(e.contracts.writeSetIfFutureApproved,{
 product_fact_subjects:1,product_fact_review_events:1,admin_audit_logs:1
});
console.log(JSON.stringify({status:"PASS",stage:e.stage,checks:checks.length,
 frozenOfficialSources:expected.length,sqlRuntimeVerified:false,
 productionWrites:0,decision:e.decision},null,2));
