#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { captureR16D, R16D_CAPTURE_CONTRACT, R16D_FIXED_TARGETS, reviewOfficialProductIdentity } from "./capture-barrier-support-p1-r16d-official-sources-v1.mjs";

assert.equal(R16D_FIXED_TARGETS.length, 2);
assert.deepEqual(R16D_FIXED_TARGETS.map(x=>x.product_id), [
  "b72b0570-ee3f-4692-b45f-633b46ae3b64",
  "5848640c-84ca-4079-9d9e-8f3113159fe1",
]);
const a=R16D_FIXED_TARGETS[0],b=R16D_FIXED_TARGETS[1];
assert.equal(a.size_ml,40);
assert.equal(b.size_ml,80);
for(const t of R16D_FIXED_TARGETS){
 assert.equal(t.allowed_hosts.includes(new URL(t.url).hostname),true);
 assert.equal(new URL(t.url).protocol,"https:");
 assert.equal(t.artifact_stem.includes("/"),false);
}
const htmlA=Buffer.from('<!doctype html><html><head><meta charset="utf-8"><title>비자 시카 밤 EX(40mL) | 이니스프리</title></head><body><h1>비자 시카 밤 EX</h1><p>40mL</p></body></html>');
const htmlB=Buffer.from('<!doctype html><html><head><title>아쿠아 오아시스 수분 젤크림 80ml | S.NATURE</title></head><body><h1>아쿠아 오아시스 수분 젤크림</h1></body></html>');
const mockMap=new Map([[a.url,htmlA],[b.url,htmlB]]);
const tmp=await fs.mkdtemp(path.join(os.tmpdir(),"r16d-failclosed-"));
try{
 const positive=await captureR16D({
  outputDir:path.join(tmp,"positive"),
  fetchBytes:async url=>({bytes:mockMap.get(url),finalUrl:url,contentType:"text/html; charset=utf-8"}),
  observedAt:()=>"2026-10-09T00:00:00Z",
  context:{github_head_sha:"a".repeat(40),github_run_id:"123",github_run_attempt:"1"},
 });
 assert.equal(positive.contract,R16D_CAPTURE_CONTRACT);
 assert.equal(positive.execution.github_head_sha,"a".repeat(40));
 assert.deepEqual(positive.summary,{attempted:2,raw_sources_captured:2,raw_sources_blocked:0,identity_title_collocation:2,identity_structured_collocation:0,registerable:0,production_writes:0});
 for(const [i,t] of positive.targets.entries()){
  assert.equal(t.source_bytes_captured,true);
  assert.equal(t.decision,"RAW_SOURCE_CAPTURED_IDENTITY_REVIEW_REQUIRED");
  assert.equal(t.content_digest,createHash("sha256").update(mockMap.get(R16D_FIXED_TARGETS[i].url)).digest("hex"));
  assert.equal(t.source_bytes_length,mockMap.get(R16D_FIXED_TARGETS[i].url).length);
  const stored=await fs.readFile(path.join(tmp,"positive",t.artifact_path));
  assert.equal(Buffer.compare(stored,mockMap.get(R16D_FIXED_TARGETS[i].url)),0);
  assert.equal(t.identity_observation.title_size_collocated,true);
  assert.equal(t.subject_registration_authorized,false);
  assert.equal(t.formulation_revision_key,null);
  assert.equal(t.subject_semantic_key,null);
 }
 assert.equal(positive.policy.source_digest_is_not_formulation_revision_key,true);
 assert.equal(positive.policy.production_writes,0);
 assert.equal(positive.policy.subject_registration_authorized,false);
 assert.equal(positive.policy.product_fact_adjudication_authorized,false);
 assert.equal(JSON.parse(await fs.readFile(path.join(tmp,"positive","manifest.json"),"utf8")).targets.length,2);
 const jsonLdB=Buffer.from('<html><head><title>S.NATURE | 아쿠아 오아시스 수분 젤크림</title><script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"아쿠아 오아시스 수분 젤크림 80ml","sku":"cafe24_smasteri_1_99","offers":{"url":"https://www.snature.kr/product/아쿠아-오아시스-수분-젤크림-80ml/99/"}}</script></head><body><h1>아쿠아 오아시스 수분 젤크림</h1></body></html>');
 const structured=reviewOfficialProductIdentity(jsonLdB,"text/html",b);
 assert.equal(structured.title_size_collocated,false);
 assert.equal(structured.structured_product_and_presentation,true);
 assert.equal(structured.structured_product_sku,"cafe24_smasteri_1_99");
 assert.equal(structured.status,"STRUCTURED_PRODUCT_AND_PRESENTATION_OBSERVED");
 const spacedClosingTag=Buffer.from(jsonLdB.toString("utf8").replace("</script>","</script >"));
 const spacedStructured=reviewOfficialProductIdentity(spacedClosingTag,"text/html",b);
 assert.equal(spacedStructured.structured_product_and_presentation,true);
 assert.equal(spacedStructured.structured_product_sku,"cafe24_smasteri_1_99");
 assert.equal(spacedStructured.status,"STRUCTURED_PRODUCT_AND_PRESENTATION_OBSERVED");
 const nonstandardClose=Buffer.from(jsonLdB.toString("utf8").replace("</script>", "</script\t\n bar>"));
 const malformedReview=reviewOfficialProductIdentity(nonstandardClose,"text/html",b);
 assert.equal(malformedReview.structured_product_and_presentation,true);
 assert.equal(malformedReview.structured_product_sku,"cafe24_smasteri_1_99");
 assert.equal(malformedReview.status,"STRUCTURED_PRODUCT_AND_PRESENTATION_OBSERVED");
 const quotedGreaterThan=Buffer.from(jsonLdB.toString("utf8").replace('type="application/ld+json"', 'data-attribute="foo > bar" type="application/ld+json"'));
 assert.equal(reviewOfficialProductIdentity(quotedGreaterThan,"text/html",b).structured_product_and_presentation,true);
 const noClosingTag=Buffer.from(jsonLdB.toString("utf8").replace("</script>", ""));
 assert.equal(reviewOfficialProductIdentity(noClosingTag,"text/html",b).structured_product_and_presentation,false);
 const scriptOnly=Buffer.from('<html><script>const fake="아쿠아 오아시스 수분 젤크림 80ml";</script\t\n bar></html>');
 assert.equal(reviewOfficialProductIdentity(scriptOnly,"text/html",b).product_name_found,false);
 assert.equal(reviewOfficialProductIdentity(scriptOnly,"text/html",b).structured_product_and_presentation,false);
 assert.equal(structured.subject_registration_authorized,false);
 const wrongSku=Buffer.from(jsonLdB.toString("utf8").replaceAll("cafe24_smasteri_1_99","cafe24_smasteri_1_199").replaceAll("80ml/99/","80ml/199/"));
 assert.equal(reviewOfficialProductIdentity(wrongSku,"text/html",b).structured_product_and_presentation,false);
 const nameOnly=Buffer.from("<html><title>비자 시카 밤 EX</title><body>대용량 옵션 70ml 제공, 이 상품의 정식 용량은 이 페이지에서 명시하지 않습니다. 상세한 용량 고시가 없어 판정을 보류합니다.</body></html>");
 const partial=reviewOfficialProductIdentity(nameOnly,"text/html",a);
 assert.equal(partial.product_name_found,true);
 assert.equal(partial.title_size_collocated,false);
 assert.equal(partial.status,"PRESENTATION_NOT_OBSERVED");
 const blocked=await captureR16D({
  outputDir:path.join(tmp,"blocked"),
  fetchBytes:async url=>{if(url===a.url)throw new Error("getaddrinfo EAI_AGAIN m.innisfree.com");return {bytes:htmlB,finalUrl:"https://example.org/product",contentType:"text/html"};},
 });
 assert.equal(blocked.summary.raw_sources_captured,0);
 assert.equal(blocked.summary.raw_sources_blocked,2);
 assert.equal(blocked.targets[0].failure_code,"TRANSIENT_FAILURE:dns_resolution");
 assert.equal(blocked.targets[1].failure_code,"SOURCE_BLOCKED:cross_brand_redirect");
 assert.deepEqual(blocked.targets.map(t=>t.content_digest),[null,null]);
 assert.deepEqual(blocked.targets.map(t=>t.formulation_revision_key),[null,null]);
 assert.deepEqual(blocked.targets.map(t=>t.subject_semantic_key),[null,null]);
 const missing=await captureR16D({
  outputDir:path.join(tmp,"missing"),
  fetchBytes:async url=>({bytes:url===a.url?nameOnly:htmlB,finalUrl:url,contentType:"text/html"}),
 });
 assert.equal(missing.summary.raw_sources_captured,2);
 assert.equal(missing.summary.registerable,0);
 assert.equal(missing.targets[0].identity_observation.status,"PRESENTATION_NOT_OBSERVED");
 assert.equal(missing.targets[0].decision,"RAW_SOURCE_CAPTURED_IDENTITY_GAP");
 for(const txt of [await fs.readFile("scripts/product-evidence/capture-barrier-support-p1-r16d-official-sources-v1.mjs","utf8")]){
  for(const banned of ["createClient(", ".rpc(", ".insert(", ".upsert(", "service_role", "SUPABASE_SERVICE_ROLE_KEY"]) assert.equal(txt.includes(banned),false,banned);
 }
 const evidence=JSON.parse(await fs.readFile("evidence/product-decision-axis-non-numeric-shadow-v2/barrier-support-p1-r16d-official-source-capture-preflight-v1.json","utf8"));
 const upstream=JSON.parse(await fs.readFile(evidence.upstream.path,"utf8"));
 const wf=await fs.readFile(".github/workflows/taxonomy-ai-r16d-source-capture.yml","utf8");
 const doc=await fs.readFile("docs/evidence/v21-8h-r16d-p1-official-source-capture-protocol-v1.md","utf8");
 assert.equal(evidence.stage,"V2.1-8H-R16D_P1_OFFICIAL_SOURCE_CAPTURE_AND_IDENTITY_MATERIALIZATION_PREFLIGHT");
 assert.equal(evidence.upstream.decision,upstream.terminal);
 assert.deepEqual(evidence.upstream.target_product_ids,upstream.scope.allowed_product_ids);
 assert.equal(evidence.targets.length,2);
 assert.deepEqual(evidence.targets.map(t=>t.product_id),R16D_FIXED_TARGETS.map(t=>t.product_id));
 assert.deepEqual(evidence.targets.map(t=>t.official_url),R16D_FIXED_TARGETS.map(t=>t.url));
 assert.equal(evidence.capture_protocol.name,R16D_CAPTURE_CONTRACT);
 assert.equal(evidence.capture_protocol.fixed_target_count,2);
 assert.equal(evidence.capture_protocol.max_html_response_bytes,2097152);
 assert.equal(evidence.capture_protocol.artifact_retention_days,7);
 assert.equal(evidence.capture_protocol.source_capture_not_product_fact_confirmation,true);
 assert.equal(evidence.capture_protocol.source_digest_not_equivalent_to_formulation_revision_key,true);
 assert.equal(evidence.capture_protocol.subject_semantic_key_not_generated_from_page_hash,true);
 assert.equal(evidence.capture_protocol.production_write_authorized,false);
 assert.equal(evidence.local_probe.attempts.length,2);
 assert.ok(evidence.local_probe.attempts.every(a=>a.result==="DNS_NAME_RESOLUTION_ERROR" && a.bytes_obtained===false && a.actual_sha256===null));
 for(const t of evidence.targets){assert.equal(t.source_bytes_captured_locally,false);assert.equal(t.source_content_digest,null);assert.equal(t.formulation_revision_key,null);assert.equal(t.subject_semantic_key,null);assert.equal(t.subject_registration_authorized,false);}
 assert.equal(evidence.source_capture_outcome,"LOCAL_CAPTURE_BLOCKED_WAITING_FOR_HOSTED_RUN_ARTIFACT");
 assert.equal(evidence.next_gate.service_role_subject_registration_authorized,false);
 assert.equal(evidence.next_gate.production_cutover_authorized,false);
 assert.equal(evidence.invariance.production_writes,0);
 assert.equal(evidence.invariance.candidate_products*evidence.invariance.scenarios,evidence.invariance.evaluations);
 assert.equal(evidence.invariance.evaluations,1968);
 assert.equal(evidence.invariance.zeroid_hold_released,false);
 assert.equal(evidence.invariance.anua_hold_released,false);
 assert.equal(evidence.invariance.esnature_bundle_hold_released,false);
 assert.equal(evidence.invariance.public_activation,false);
 for(const token of ["pull_request:","timeout-minutes: 5","retention-days: 7","contents: read","upload-artifact@v7","--output-dir tmp/r16d-source-capture","R16D_EXACT_CHECKOUT_SHA","R16D exact checkout SHA provenance mismatch"])assert.ok(wf.includes(token),token);
 const workflowRegistry=JSON.parse(await fs.readFile("docs/ci/workflow-responsibilities/taxonomy-ai-r16d-source-capture.yml.json","utf8"));
 assert.equal(workflowRegistry.workflow,"taxonomy-ai-r16d-source-capture.yml");
 assert.equal(workflowRegistry.primaryResponsibility,"catalog-taxonomy");
 assert.equal(workflowRegistry.watchtowerTrackBinding,"static:taxonomy-ai");
 assert.equal(workflowRegistry.preservationPolicy,"preserve-until-equivalence-proven");
 assert.ok(wf.includes("scripts/product-evidence/verify-barrier-support-p1-r16d-official-source-capture-v1.mjs"));
 const audit=JSON.parse(await fs.readFile("evidence/product-decision-axis-non-numeric-shadow-v2/barrier-support-p1-r16d-hosted-raw-artifact-audit-v1.json","utf8"));
 assert.equal(audit.stage,"V2.1-8H-R16D-R1_HOSTED_RAW_SOURCE_ARTIFACT_AUDIT");
 assert.equal(audit.products.length,2);
 assert.deepEqual(audit.products.map(x=>x.product_id),R16D_FIXED_TARGETS.map(x=>x.product_id));
 assert.equal(audit.source.artifact_id,11572854459);
 assert.equal(audit.source.manifest_sha_matches_pr_head,false);
 assert.notEqual(audit.source.reported_manifest_github_head_sha,audit.source.pr_head_sha_at_run);
 assert.equal(audit.manual_recomputed_from_extracted_raw_bytes,true);
 assert.deepEqual(audit.products.map(x=>x.raw_bytes),[553877,248632]);
 assert.deepEqual(audit.products.map(x=>x.sha256_recomputed),[
  "f85c16714bf53bb14f29f85bf2766190b8e34f909720a55d64d1b6adc8d391cd",
  "6a69b5f2c3cf7371ceabe7a41ba65de2dcad1d49858607e110a389bc88472112"
 ]);
 assert.equal(audit.products[1].identity_evidence.sku,"cafe24_smasteri_1_99");
 for(const x of audit.products){assert.equal(x.matches_manifest,true);assert.equal(x.variant_revision_confirmed,false);assert.equal(x.subject_semantic_key,null);assert.equal(x.registration_authorized,false);}
 assert.equal(audit.next_gate.requires_new_run,true);
 assert.equal(audit.next_gate.production_subject_registration_authorized,false);
 const recapture=JSON.parse(await fs.readFile("evidence/product-decision-axis-non-numeric-shadow-v2/barrier-support-p1-r16d-exact-head-recapture-audit-v1.json","utf8"));
 assert.equal(recapture.stage,"V2.1-8H-R16D-R2_EXACT_HEAD_RECAPTURE_AUDIT");
 assert.equal(recapture.previous.path,"evidence/product-decision-axis-non-numeric-shadow-v2/barrier-support-p1-r16d-hosted-raw-artifact-audit-v1.json");
 assert.equal(recapture.hosted_run.pr_number,1175);
 assert.equal(recapture.hosted_run.artifact_id,11574787645);
 assert.equal(recapture.hosted_run.manifest_sha_matches_exact_head,true);
 assert.equal(recapture.hosted_run.manifest_head_sha,recapture.hosted_run.head_sha);
 assert.equal(recapture.summary.raw_source_captured,2);
 assert.equal(recapture.summary.raw_sha256_verified,2);
 assert.equal(recapture.summary.exact_head_provenance_verified,true);
 assert.equal(recapture.summary.official_exact_product_identification,2);
 assert.equal(recapture.summary.formulation_revision_confirmed,0);
 assert.equal(recapture.summary.semantic_keys_materialized,0);
 assert.equal(recapture.summary.registerable,0);
 assert.equal(recapture.summary.production_writes,0);
 assert.deepEqual(recapture.products.map(x=>x.product_id),R16D_FIXED_TARGETS.map(x=>x.product_id));
 assert.deepEqual(recapture.products.map(x=>x.byte_count),[553319,248632]);
 assert.deepEqual(recapture.products.map(x=>x.raw_sha256),[
   "a4640eea1c5c13800951c129d11839da91876afb7b50f05f15f7ff93fb4e0e9d",
   "f051b4e8b395d2957724bbb4cdaba16a3c8e3cb10d04d629147dfbf7fa4e8139"
 ]);
 assert.equal(recapture.products[1].identity_evidence.structured_exact_product_id,"cafe24_smasteri_1_99");
 for(const x of recapture.products){assert.equal(x.matches_original_manifest,true);assert.equal(x.formulation_revision_established,false);assert.equal(x.subject_semantic_key,null);assert.equal(x.registration_authorized,false);}
 assert.equal(recapture.next_gate.subject_registration_authorized,false);
 assert.equal(recapture.terminal,"R16D_RAW_SOURCE_AND_EXACT_HEAD_PROVENANCE_PASS_FORMULATION_REVISION_AND_SEMANTIC_KEY_HOLD");
 const phaseB=JSON.parse(await fs.readFile("docs/ci/consolidation-audits/phase-b-policy.json","utf8"));
 assert.ok(phaseB.approvedAddedWorkflows.includes("taxonomy-ai-r16d-source-capture.yml"));
 assert.equal(phaseB.baselineWorkflowCount+phaseB.approvedAddedWorkflows.length-phaseB.approvedRetiredWorkflows.length,70);
 assert.equal(phaseB.clusters["taxonomy-ai-r16d-p1-official-source"].primaryResponsibility,"catalog-taxonomy");
 assert.equal(phaseB.clusters["taxonomy-ai-r16d-p1-official-source"].watchtowerTrackBinding,"static:taxonomy-ai");
 assert.equal(audit.invariance.production_writes,0);
 assert.equal(audit.invariance.frozen_candidates*audit.invariance.frozen_scenarios,audit.invariance.frozen_evaluations);
 for(const token of ["R16D_CAPTURE_PROTOCOL_IMPLEMENTED_LOCAL_DNS_BLOCKED_HOSTED_PROBE_PENDING","이니스프리","에스네이처","Subject","1,968"])assert.ok(doc.includes(token),token);
 console.log(JSON.stringify({status:"PASS",stage:"R16D",offline_cases:["exact2","DNS+cross_host","missing_size"],raw_digests_only_from_bytes:true,subject_registration_authorized:false,production_writes:0}));
}finally{
 await fs.rm(tmp,{recursive:true,force:true});
}
