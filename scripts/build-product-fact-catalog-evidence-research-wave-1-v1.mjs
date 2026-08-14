#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {AUTHORITY,EXPECTED_PRODUCT_IDS,buildResearch,buildMaterialization,pretty,sha256} from './product-evidence/product-fact-catalog-evidence-research-wave-1-v1.mjs';

const HERE=path.dirname(fileURLToPath(import.meta.url));
const REPO=path.resolve(HERE,'..');
const arg=(name,def=null)=>{const i=process.argv.indexOf(name);return i>=0?process.argv[i+1]:def;};
const OUT=path.resolve(arg('--out-root',process.env.V21_8G_OUTPUT_ROOT||REPO));
const skip=process.argv.includes('--skip-upstream-hash-check')||process.env.V21_8G_SKIP_UPSTREAM_HASH_CHECK==='1';
const selection=path.join(REPO,'evidence/product-fact-catalog-expansion-v1/coverage-expansion-wave-1-selection-v1.json');
const selectionMd=path.join(REPO,'docs/evidence/product-fact-catalog-expansion-wave-1-selection-v1.md');
const fileSha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
if(!skip){
  if(fileSha(selection)!==AUTHORITY.selection_json_sha256)throw new Error('V2.1-8F selection JSON SHA mismatch');
  if(fileSha(selectionMd)!==AUTHORITY.selection_md_sha256)throw new Error('V2.1-8F selection MD SHA mismatch');
  const s=JSON.parse(fs.readFileSync(selection,'utf8'));
  const ids=s.selected_products.map(x=>x.product_id);
  const expected=EXPECTED_PRODUCT_IDS;
  if(JSON.stringify(ids)!==JSON.stringify(expected))throw new Error('V2.1-8F exact batch mismatch');
  if(s.selection_policy?.version!==undefined && s.selection_policy.version!=='catalog-expansion-selection-policy-v1')throw new Error('selection policy mismatch');
}
const research=buildResearch();
if(JSON.stringify(research.batch.exact_product_ids)!==JSON.stringify(EXPECTED_PRODUCT_IDS))throw new Error('frozen research exact batch mismatch');
const materialization=buildMaterialization(research);
const md=renderMarkdown(research,materialization);
const files=[
 ['evidence/product-evidence-expansion-v1/catalog-evidence-research-wave-1-v1.json',pretty(research)],
 ['evidence/product-fact-adoption-v1/catalog-evidence-research-wave-1-materialization-v1.json',pretty(materialization)],
 ['docs/evidence/product-fact-catalog-evidence-research-wave-1-v1.md',md]
];
for(const [rel,content] of files){const p=path.join(OUT,rel);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,content);}
console.log(JSON.stringify({status:'PASS',products:research.summary.researched_products,slots:research.summary.target_fact_slots_terminal,supported_products:research.summary.supported_product_count,supported_propositions:research.summary.supported_proposition_count,research_sha256:sha256(pretty(research)),materialization_sha256:sha256(pretty(materialization)),docs_sha256:sha256(md),hosted_writes:0}));

function renderMarkdown(r,m){
  const L=[];
  L.push('# V2.1-8G — Catalog Evidence Research Wave 1','',
  '> Exact V2.1-8F 12-product batch. Official-source research freeze only. Hosted Product Fact writes = 0. V2.1-8H NOT STARTED.','',
  '## Authority','',
  `- source main: \`${r.authority.actual_start_main}\``,
  `- 8F selection JSON SHA256: \`${r.authority.upstream_selection_json_sha256}\``,
  `- 8F selection MD SHA256: \`${r.authority.upstream_selection_md_sha256}\``,
  `- Registry: \`${r.authority.registry_version}\``,
  `- Subject serializer: \`${r.authority.subject_serializer_version}\``,
  `- Proposition serializer: \`${r.authority.proposition_serializer_version}\``,
  `- Fusion: \`${r.authority.fusion_policy_version}\``,'',
  '## Research result','',
  `- researched products: ${r.summary.researched_products}/12`,
  `- terminal target Fact slots: ${r.summary.target_fact_slots_terminal}/45`,
  `- supported products: ${r.summary.supported_product_count}`,
  `- supported propositions: ${r.summary.supported_proposition_count}`,
  `- proposition collisions: ${r.summary.proposition_collision_count}`,
  `- disposition counts: \`${JSON.stringify(r.summary.disposition_counts)}\``,
  `- Hosted Product Fact writes: 0`,'',
  '## Product closure','',
  '| product_id | brand | product | category | identity | closure | supported propositions | blocked target slots |',
  '|---|---|---|---|---|---|---:|---:|');
  for(const p of r.products)L.push(`| ${p.product_id} | ${p.brand} | ${p.product} | ${p.category} | ${p.identity_status} | ${p.product_level_closure_state} | ${p.supported_fact_count} | ${p.blocked_target_count} |`);
  L.push('','## Fact-slot adjudication','',
  '| product_id | fact_key | disposition | normalized value | authority | confidence | reason |',
  '|---|---|---|---|---|---|---|');
  for(const s of r.fact_slots)L.push(`| ${s.product_id} | ${s.fact_key} | ${s.disposition} | ${s.normalized_value===null?'—':JSON.stringify(s.normalized_value)} | ${s.authority} | ${s.confidence} | ${s.reason.replaceAll('|','/')} |`);
  L.push('','## Supported propositions','',
  '| product_id | subject semantic key | fact_key | value | scope | proposition key | source | authority | confidence |',
  '|---|---|---|---|---|---|---|---|---|');
  for(const f of r.supported_propositions)L.push(`| ${f.product_id} | ${f.subject_semantic_key} | ${f.fact_key} | ${JSON.stringify(f.value)} | ${JSON.stringify(f.scope)} | ${f.proposition_key} | ${f.source} | ${f.authority} | ${f.confidence} |`);
  L.push('','## Future V2.1-8H materialization envelope','',
  `- future_new_subjects: ${m.summary.future_new_subjects}`,
  `- future_new_sources: ${m.summary.future_new_sources}`,
  `- future_new_bindings: ${m.summary.future_new_bindings}`,
  `- future_new_evidence: ${m.summary.future_new_evidence}`,
  `- future_new_fact_instances: ${m.summary.future_new_fact_instances}`,
  `- future_new_evidence_links: ${m.summary.future_new_evidence_links}`,
  `- future_new_review_assignments: ${m.summary.future_new_review_assignments}`,
  `- future_new_confirmations: ${m.summary.future_new_confirmations}`,
  `- future_new_current: ${m.summary.future_new_current}`,
  `- projected adopted products: ${m.summary.projected_adopted_product_count}`,
  `- projected Current facts: ${m.summary.projected_current_fact_count}`,'',
  'Blocked or uncertain slots create zero Confirmation and zero Current candidates. This is a dry-run planning envelope only; no Product Fact RPC or table mutation is performed.','',
  '## Lifecycle','',
  '- V2.1-8G research freeze only',
  '- V2.1-8H NOT STARTED',
  '- Product Fact Hosted writes = 0',
  '- production recommendation consumption = unchanged / disabled','');
  return L.join('\n');
}
