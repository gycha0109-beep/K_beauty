#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

const root = "evidence/product-decision-axis-non-numeric-shadow-v2/";
const basePath = root + "barrier-support-p0-remaining-ready-official-evidence-research-v1.json";
const currentPath = root + "barrier-support-p0-remaining-targeted-official-gap-recovery-v1.json";
const reportPath = "docs/evidence/v21-8h-r15b-p0-targeted-official-evidence-gap-recovery-v1.md";
const before = JSON.parse(fs.readFileSync(basePath, "utf8"));
const after = JSON.parse(fs.readFileSync(currentPath, "utf8"));
const report = fs.readFileSync(reportPath, "utf8");
const blob = p => execFileSync("git", ["hash-object", p], {encoding:"utf8"}).trim();

assert.equal(after.stage, "V2.1-8H-R15B_P0_TARGETED_OFFICIAL_EVIDENCE_GAP_RECOVERY");
assert.equal(after.parent_authority.stage, "V2.1-8H-R15A");
assert.equal(after.parent_authority.artifact, basePath);
assert.equal(blob(basePath), after.parent_authority.git_blob_sha);
assert.equal(before.stage, "V2.1-8H-R15A");
assert.equal(before.task_results.length, 4);
assert.equal(after.production_project, before.production_project);

const fields = ["barrier_support_claim", "primary_use_role"];
const taskMap = new Map(before.task_results.map(t => [t.task_id, t]));
assert.equal(taskMap.size, 4);
assert.equal(after.task_results.length, 4);
assert.equal(new Set(after.task_results.map(t=>t.task_id)).size, 4);
assert.deepEqual(new Set(after.task_results.map(t => t.task_id)), new Set(taskMap.keys()));

const subjectMap = new Map(before.subjects.map(s=>[s.product_id,s]));
assert.equal(after.subjects.length, 2);
assert.deepEqual(new Set(after.subjects.map(s=>s.product_id)), new Set(subjectMap.keys()));
for (const s of after.subjects) {
  const prev = subjectMap.get(s.product_id);
  assert.equal(s.subject_id, prev.subject_id);
  assert.equal(s.market, "KR");
  assert.equal(s.size_ml, prev.size_ml);
  assert.equal(s.identity_status, "resolved");
  assert.equal(s.current_state, "current");
}
const sources = new Map(after.new_source_captures.map(s=>[s.source_id,s]));
assert.equal(sources.size, after.new_source_captures.length);
assert.equal(sources.size, 4);
for (const s of sources.values()) {
  assert.ok(subjectMap.has(s.product_id));
  assert.ok(["brand_operated_first_party","brand_operated_first_party_bundle","brand_authored_public_answer","brand_operated_product_page"].includes(s.origin));
  const domain = new URL(s.locator).hostname;
  assert.ok(["manyo.us","theharnay.co.kr"].includes(domain), domain);
  assert.equal(s.fact_bearing_for_target, false);
  assert.equal(s.content_digest, null, "do not invent raw content hashes");
  assert.equal(s.content_bytes_captured, false);
  assert.ok(s.observations.length > 0);
  assert.ok(s.disqualification.length > 0);
  assert.ok(s.source_capture_date);
  if (domain==="manyo.us") {
    assert.equal(s.market, "US");
    assert.equal(s.kr_formulation_lineage_verified, false);
  }
}
assert.equal(sources.get("theharnay_brand_qna_3025").current_formulation_lineage_verified, false);
for (const t of after.task_results) {
  const old = taskMap.get(t.task_id);
  assert.equal(t.product_id, old.product_id);
  assert.equal(t.subject_id, old.subject_id);
  assert.equal(t.fact_key, old.fact_key);
  assert.ok(fields.includes(t.fact_key));
  assert.equal(old.outcome, "EVIDENCE_INSUFFICIENT");
  assert.equal(old.proposed_value, null);
  assert.equal(t.outcome, "EVIDENCE_INSUFFICIENT");
  assert.equal(t.proposed_value, null);
  assert.equal(t.explicit_negative_established, false);
  assert.equal(t.direct_product_specific_fact_evidence, false);
  assert.equal(t.db_task_state_unmodified, true);
  assert.ok(t.reason_code);
  assert.ok(t.reason);
  assert.ok(t.source_ids.length > 0);
  for (const sourceId of t.source_ids) {
    const s = sources.get(sourceId);
    assert.ok(s, "missing source " + sourceId);
    assert.equal(s.product_id, t.product_id);
  }
}
assert.deepEqual(new Set(after.scope.allowed_fact_keys), new Set(fields));
assert.equal(after.scope.products, 2);
assert.equal(after.scope.tasks, 4);
for (const field of [
  "research_db_write_authorized","evidence_ingest_authorized","confirmation_authorized",
  "registry_change_authorized","recommendation_activation_authorized",
  "public_activation","production_cutover_authorized","outdoor_rankable_signal_authorized"
]) assert.equal(after.scope[field], false, field);

const p=after.production_readback;
assert.equal(p.read_only,true);
assert.equal(p.subjects_resolved_current,2);
for (const f of ["evidence_records_for_target_facts","fact_instances_for_target_facts",
 "current_facts_for_target_subjects","review_assignments_for_target_facts"])assert.equal(p[f],0,f);
assert.equal(p.research_tasks,4);
assert.equal(p.research_task_state,"RESEARCH_PENDING");
assert.equal(p.research_task_attempt_count,0);

const inv=after.invariance;
assert.equal(inv.candidate_products_frozen,164);
assert.equal(inv.user_scenarios_frozen,12);
assert.equal(inv.evaluations_frozen,1968);
assert.equal(inv.candidate_products_frozen*inv.user_scenarios_frozen,inv.evaluations_frozen);
for(const f of ["numeric_contribution_delta","ranking_effect_delta","eligibility_effect_delta","candidate_policy_delta","production_db_writes"])assert.equal(inv[f],0,f);
for(const f of ["registry_changed","recommendation_activation","outdoor_rankable_signal_authorized","public_activation","zeroid_hold_released"])assert.equal(inv[f],false,f);
assert.equal(inv.non_numeric_barrier_pda,true);

assert.equal(after.summary.new_first_party_leads,4);
assert.equal(after.summary.direct_evidence_found,0);
assert.equal(after.summary.evidence_insufficient,4);
assert.equal(after.summary.identity_or_scope_blocked,0);
assert.equal(after.summary.proposed_values,0);
assert.equal(after.summary.production_writes,0);
assert.equal(after.decision,"R15B_TARGETED_RESEARCH_COMPLETE_FOUR_FACTS_STILL_UNESTABLISHED");
assert.equal(after.next_gate.evidence_ingest_authorized,false);
assert.equal(after.next_gate.confirmation_authorized,false);
assert.equal(after.next_gate.no_repeat_without_new_source,true);
assert.equal(after.next_gate.zeroid_separate_hold_maintained,true);
for(const marker of ["R15B_TARGETED_RESEARCH_COMPLETE_FOUR_FACTS_STILL_UNESTABLISHED","EVIDENCE_INSUFFICIENT","2021-03-19","1,968","RESEARCH_PENDING","DB write"])assert.ok(report.includes(marker),marker);
console.log(JSON.stringify({status:"PASS",stage:after.stage,targets:2,tasks:4,new_sources:4,direct_evidence:0,insufficient:4,production_writes:0,activation:false}));
