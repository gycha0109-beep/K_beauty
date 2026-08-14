import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildAdoptionPlan,
  FROZEN_AUTHORITY,
  renderAdoptionMarkdown,
  sha256Text,
  stableJson,
} from './product-evidence/product-fact-recovered-source-gap-adoption-wave-1-v1.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT_ROOT = process.env.V21_8E_OUTPUT_ROOT ? path.resolve(process.env.V21_8E_OUTPUT_ROOT) : ROOT;
const P = {
  evidence: 'evidence/product-evidence-expansion-v1/source-gap-recovery-wave-1-v1.json',
  materialization: 'evidence/product-fact-adoption-v1/source-gap-recovery-wave-1-materialization-v1.json',
  markdown: 'docs/evidence/product-fact-source-gap-recovery-wave-1-v1.md',
  batch3: 'evidence/product-fact-adoption-v1/cross-category-adoption-batch-3-v1.json',
  outJson: 'evidence/product-fact-adoption-v1/recovered-source-gap-adoption-wave-1-v1.json',
  outMd: 'docs/evidence/product-fact-recovered-source-gap-adoption-wave-1-v1.md',
};

const canonicalRead = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8').replace(/\r\n?/gu, '\n');
const parse = relative => JSON.parse(canonicalRead(relative));
const hash = relative => sha256Text(canonicalRead(relative));

export function build() {
  const sourceMainSha = process.env.V21_8E_BASE_MAIN_SHA;
  if (sourceMainSha !== 'da4e499b9b33af5a36c33e2c4c189462d731786b') {
    throw new Error('V21_8E_BASE_MAIN_SHA authority mismatch');
  }
  const inputHashes = {
    evidence_sha256: hash(P.evidence),
    materialization_sha256: hash(P.materialization),
    markdown_sha256: hash(P.markdown),
  };
  if (stableJson(inputHashes) !== stableJson(FROZEN_AUTHORITY)) throw new Error('V2.1-8D frozen artifact hash drift');

  const plan = buildAdoptionPlan({
    evidence: parse(P.evidence),
    materialization: parse(P.materialization),
    batch3: parse(P.batch3),
    sourceMainSha,
    inputHashes,
  });
  const json = stableJson(plan);
  const markdown = renderAdoptionMarkdown(plan);
  for (const relative of [P.outJson, P.outMd]) fs.mkdirSync(path.dirname(path.join(OUTPUT_ROOT, relative)), { recursive: true });
  fs.writeFileSync(path.join(OUTPUT_ROOT, P.outJson), json);
  fs.writeFileSync(path.join(OUTPUT_ROOT, P.outMd), markdown);
  const result = {
    status: 'PASS',
    plan_id: plan.plan_id,
    products: plan.exact_scope.products,
    subjects: plan.exact_scope.subjects,
    evidence: plan.exact_scope.evidence,
    facts: plan.exact_scope.facts,
    current: plan.exact_scope.current,
    json_sha256: sha256Text(json),
    md_sha256: sha256Text(markdown),
  };
  console.log(JSON.stringify(result, null, 2));
  return result;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) build();
