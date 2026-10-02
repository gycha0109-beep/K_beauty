#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";

const artifactPath="evidence/product-fact-catalog-expansion-v1/v21-8g3-0-r1-gpt-worker-coexistence-v1.json";
const d=JSON.parse(fs.readFileSync(artifactPath,"utf8"));
const orchestratorPath="scripts/trust-gpt-catalog-intake.mjs";
const migrationPath="supabase/migrations/20261001183000_trust_gpt_catalog_intake_pipeline_v1.sql";
const orchestrator=fs.readFileSync(orchestratorPath,"utf8");
const migration=fs.readFileSync(migrationPath,"utf8");

const gitBlob=(text)=>{
  const body=Buffer.from(text);
  return crypto.createHash("sha1").update(Buffer.concat([
    Buffer.from(`blob ${body.length}\0`),body
  ])).digest("hex");
};

assert.equal(d.version,"v21-8g3-0-r1-gpt-worker-coexistence-v1");
assert.equal(d.stage,"V2.1-8G3-0-R1");
assert.equal(d.source_main_sha,"c058d2cce2d8e04e3fb13f590765881f132be6a4");
assert.equal(d.parent_contract.decision,"V21_8G3_0_EVIDENCE_INGEST_CONTRACT_PREFLIGHT_PASS");

assert.equal(d.production_drift.migration_version,"20261001183000");
assert.equal(d.production_drift.migration_name,"trust_gpt_catalog_intake_pipeline_v1");
assert.equal(d.production_drift.claim_rpc_exists,true);
assert.equal(d.production_drift.ingest_rpc_exists,true);
assert.equal(d.production_drift.claim_function_sha256,"2349b1d3e4593c89f9198d7b5302ecbc44d81b763efe7a8b2d37387447de551b");
assert.equal(d.production_drift.ingest_function_sha256,"6d78cb35d8e3663987755876ff07a481c47bfce8750c8c494c3a4d25825eed12");
assert.equal(d.production_drift.service_role_only,true);
assert.equal(gitBlob(orchestrator),d.production_drift.source_authority.orchestrator_git_blob_sha);
assert.equal(gitBlob(migration),d.production_drift.source_authority.migration_git_blob_sha);

for(const marker of [
  'const productId = ingest?.product_id ?? null;',
  'ingest?.state !== "TRUST_RESEARCH_READY"',
  '"claim_gpt_catalog_research_tasks_v1"',
  'p_product_id: productId'
]) assert.ok(orchestrator.includes(marker),`orchestrator marker missing: ${marker}`);

const readinessGate=orchestrator.indexOf('ingest?.state !== "TRUST_RESEARCH_READY"');
const claimCall=orchestrator.indexOf('"claim_gpt_catalog_research_tasks_v1"');
assert.ok(readinessGate>=0 && claimCall>readinessGate,"claim must follow ingest readiness gate");

for(const marker of [
  "where rt.product_id = p_product_id",
  "revoke all on function public.claim_gpt_catalog_research_tasks_v1(uuid,integer,integer)",
  "grant execute on function public.claim_gpt_catalog_research_tasks_v1(uuid,integer,integer)",
  "to service_role;",
  "'state','BLOCKED_DUPLICATE'",
  "'blocker_code','NORMALIZED_PRODUCT_ALREADY_EXISTS'"
]) assert.ok(migration.includes(marker),`migration marker missing: ${marker}`);

const duplicateGate=migration.indexOf("'state','BLOCKED_DUPLICATE'");
const candidateInsert=migration.indexOf("insert into public.product_candidates",duplicateGate);
assert.ok(duplicateGate>=0 && candidateInsert>duplicateGate,"duplicate block must precede product creation");

assert.deepEqual(d.automatic_interference_analysis,{
  orchestrator_claim_source:"ingest_returned_product_id_only",
  claim_requires_ingest_state:"TRUST_RESEARCH_READY",
  existing_normalized_product_ingest_state:"BLOCKED_DUPLICATE",
  existing_product_automatic_claim_reachable:false,
  claim_rpc_product_scoped:true,
  cross_product_sweep:false,
  automatic_confirmation:false
});

assert.equal(d.privileged_manual_risk.direct_service_role_claim_can_target_existing_product_id,true);
assert.equal(d.privileged_manual_risk.risk_class,"privileged_manual_operation_only");
assert.ok(d.privileged_manual_risk.mitigation.includes("8G3-A must not invoke claim_gpt_catalog_research_tasks_v1"));

assert.deepEqual(d.production_readback,{
  ready_gpt_intake_runs:0,
  ready_v1_tasks_total:16,
  ready_v1_tasks_pristine:16,
  max_ready_task_updated_at:"2026-10-02T15:43:44.136807+09:00",
  product_fact_current:95,
  ready_evidence:0,
  ready_fact_instances:0,
  target_sources:0,
  target_bindings:0,
  target_evidence:0,
  probe_admin_audits:0
});

assert.equal(d.authority_boundary.evidence_ingest_authorized_for_8g3_a,true);
assert.equal(d.authority_boundary.research_worker_claim_authorized_for_8g3_a,false);
assert.equal(d.authority_boundary.review_preparation_authorized,false);
assert.equal(d.authority_boundary.confirmation_preflight_authorized,false);
assert.equal(d.authority_boundary.confirmation_authorized,false);
assert.equal(d.authority_boundary.recommendation_activation_authorized,false);
assert.equal(d.authority_boundary.public_activation,false);

assert.equal(d.decision,"V21_8G3_0_R1_GPT_WORKER_COEXISTENCE_PASS");
assert.equal(d.next_gate,"V2.1-8G3-A_CONTROLLED_EVIDENCE_INGEST");

console.log(JSON.stringify({
  status:"PASS",
  stage:d.stage,
  automaticWorkerInterference:false,
  privilegedManualClaimRisk:true,
  frozenTasks:"16/16 pristine",
  currentFacts:95,
  targetEvidence:0,
  decision:d.decision
},null,2));
