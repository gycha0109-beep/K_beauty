import fs from 'node:fs';
import path from 'node:path';
import { buildBatch3Plan, renderBatch3Markdown, stableJson, sha256Text, FROZEN_AUTHORITY } from './product-evidence/product-fact-adoption-batch-3-v1.mjs';

const ROOT = process.cwd();
const paths = {
  materialization: 'evidence/product-fact-materialization-v1/cross-category-pilot-materialization-dry-run-v1.json',
  corpus: 'evidence/product-evidence-decision-axis-v1/cross-category-real-evidence-pilot-v1.json',
  mapping: 'evidence/product-evidence-decision-axis-v1/cross-category-real-fact-mapping-pilot-v1.json',
  gap: 'evidence/product-evidence-decision-axis-v1/cross-category-real-pilot-gap-report-v1.json',
  batch1: 'evidence/product-fact-adoption-v1/cross-category-adoption-batch-1-v1.json',
  batch2: 'evidence/product-fact-adoption-v1/cross-category-adoption-batch-2-v1.json',
  outJson: 'evidence/product-fact-adoption-v1/cross-category-adoption-batch-3-v1.json',
  outMd: 'docs/evidence/product-fact-adoption-batch-3-v1.md',
};

const read = p => fs.readFileSync(path.join(ROOT,p),'utf8');
const parse = p => JSON.parse(read(p));
const hash = p => sha256Text(read(p));
const canonicalTextEof = value => `${String(value).replace(/\n+$/u, '')}\n`;

const baseMainSha = process.env.V21_8C_BASE_MAIN_SHA;
if (!baseMainSha || !/^[0-9a-f]{40}$/.test(baseMainSha)) throw new Error('V21_8C_BASE_MAIN_SHA must be exact SHA');

const inputHashes = {
  materialization_sha256: hash(paths.materialization),
  corpus_sha256: hash(paths.corpus),
  mapping_sha256: hash(paths.mapping),
  gap_sha256: hash(paths.gap),
  batch1_sha256: hash(paths.batch1),
  batch2_sha256: hash(paths.batch2),
};
if (inputHashes.corpus_sha256 !== FROZEN_AUTHORITY.corpus_sha256) throw new Error('frozen corpus hash drift');
if (inputHashes.mapping_sha256 !== FROZEN_AUTHORITY.mapping_sha256) throw new Error('frozen mapping hash drift');
if (inputHashes.gap_sha256 !== FROZEN_AUTHORITY.gap_sha256) throw new Error('frozen gap hash drift');

const plan = buildBatch3Plan({
  materialization: parse(paths.materialization),
  mapping: parse(paths.mapping),
  baseMainSha,
  inputHashes,
});
const json = stableJson(plan);
const md = canonicalTextEof(renderBatch3Markdown(plan));
fs.mkdirSync(path.dirname(paths.outJson),{recursive:true});
fs.mkdirSync(path.dirname(paths.outMd),{recursive:true});
fs.writeFileSync(paths.outJson,json);
fs.writeFileSync(paths.outMd,md);
console.log(JSON.stringify({
  status:'PASS',
  batch_id:plan.batch_id,
  remaining_supported:plan.summary.remaining_supported,
  selected_products:plan.summary.selected_products,
  new_subjects:plan.summary.new_subjects,
  expected_final_current:plan.summary.expected_final_current,
  json_sha256:sha256Text(json),
  md_sha256:sha256Text(md),
},null,2));
