#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {A,buildPlan,pretty,renderDocs} from './product-evidence/product-fact-catalog-hosted-adoption-wave-1-v1.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const OUT=path.resolve(process.env.V21_8H_OUTPUT_ROOT||ROOT);
const fileSha=rel=>crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,rel))).digest('hex');
const textSha=text=>crypto.createHash('sha256').update(text).digest('hex');
for(const [rel,expected] of [[A.research,A.researchSha],[A.materialization,A.materializationSha],[A.docs,A.docsSha]]){
  if(fileSha(rel)!==expected)throw new Error(`V2.1-8G authority SHA mismatch: ${rel}`);
}
const research=JSON.parse(fs.readFileSync(path.join(ROOT,A.research),'utf8'));
const materialization=JSON.parse(fs.readFileSync(path.join(ROOT,A.materialization),'utf8'));
const plan=buildPlan(research,materialization);
const planText=pretty(plan);
const docsText=renderDocs(plan);
const outputs=[
  ['evidence/product-fact-adoption-v1/catalog-hosted-adoption-wave-1-v1.json',planText],
  ['docs/evidence/product-fact-catalog-hosted-adoption-wave-1-v1.md',docsText]
];
for(const [rel,content] of outputs){const p=path.join(OUT,rel);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,content);}
console.log(JSON.stringify({status:'PASS',products:plan.exact_scope.products,propositions:plan.exact_scope.propositions,plan_sha256:textSha(planText),docs_sha256:textSha(docsText),review_event_delta:plan.expected_writes.product_fact_review_events,phase_a_hosted_writes:0}));
