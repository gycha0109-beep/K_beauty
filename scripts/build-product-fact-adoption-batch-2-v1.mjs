import fs from 'node:fs';
import crypto from 'node:crypto';
import { buildBatch2Plan, stableJson, sha256JsonBytes } from './product-evidence/product-fact-adoption-batch-2-v1.mjs';

const BASE_MAIN_SHA = process.env.V21_8B_BASE_MAIN_SHA || 'a303e216f3953567a175c4d01978efc06b20bbc6';
const paths = {
  materialization: 'evidence/product-fact-materialization-v1/cross-category-pilot-materialization-dry-run-v1.json',
  fusion: 'evidence/product-fact-fusion-v1/cleanser-evidence-fusion-review-uncertainty-v1.json',
  decisionAxis: 'evidence/product-decision-axis-v1/cross-category-product-decision-axis-v1.json',
  shadow: 'evidence/product-recommendation-shadow-v1/legacy-vs-decision-axis-shadow-v1.json',
  batch1: 'evidence/product-fact-adoption-v1/cross-category-adoption-batch-1-v1.json',
};
const outJson = 'evidence/product-fact-adoption-v1/cross-category-adoption-batch-2-v1.json';
const outMd = 'docs/evidence/product-fact-adoption-batch-2-v1.md';
const read = (p) => fs.readFileSync(p, 'utf8');
const texts = Object.fromEntries(Object.entries(paths).map(([k,p]) => [k, read(p)]));
const docs = Object.fromEntries(Object.entries(texts).map(([k,t]) => [k, JSON.parse(t)]));
const inputHashes = Object.fromEntries(Object.entries(texts).map(([k,t]) => [k, sha256JsonBytes(t)]));

const plan = buildBatch2Plan({ ...docs, baseMainSha: BASE_MAIN_SHA, inputHashes });
plan.plan_content_sha256 = crypto.createHash('sha256').update(JSON.stringify(plan)).digest('hex');
const json = stableJson(plan);

const facts = plan.selected_products.flatMap((p) => p.facts.map((f) => {
  const parent = f.parent_dependency.required ? `; parent=${f.parent_dependency.parent_proposition_key}` : '';
  return `- ${p.pilot_id} / ${p.brand} ${p.name}: \`${f.fact_key}\` = \`${JSON.stringify(f.typed_value)}\` — ${f.authority_ceiling}/${f.fused_confidence} — ${f.expected_proposition_key}${parent}`;
}));
const excluded = plan.excluded_products.map((p) => `- ${p.pilot_id}: \`${p.reason}\` — ${p.detail}`);
const md = `# V2.1-8B — Product Fact Catalog Adoption Batch 2\n\n## Authority\n\n- Source main: \`${plan.authority.source_main_sha}\`\n- Registry: \`${plan.authority.registry_version}\`\n- Hosted prestate digest: \`${plan.authority.hosted_prestate_digest}\`\n- V2.1-2 materialization SHA-256: \`${plan.authority.materialization_sha256}\`\n- V2.1-4 fusion SHA-256: \`${plan.authority.fusion_sha256}\`\n- V2.1-6 cross-category axis SHA-256: \`${plan.authority.cross_category_axis_sha256}\`\n- V2.1-7 shadow SHA-256: \`${plan.authority.shadow_sha256}\`\n- V2.1-8A Batch 1 SHA-256: \`${plan.authority.batch_1_sha256}\`\n\n## Selection comparator\n\nCandidate source is frozen cross-category pilot only. Eligibility requires resolved/current identity, eligible exact/equivalent binding, supported Product Fact semantics, product-specific-primary authority, high confidence, and a closed parent dependency. Existing adopted pilot products are excluded. Eligible products are ranked by new Fact-family coverage descending, eligible Fact count descending, then pilot_id/product_id ascending. Final execution order is separately stabilized by pilot_id/product_id with parent-before-child ordering. Authority always wins over diversity.\n\n## Selected products\n\n${plan.selected_products.map((p) => `- **${p.pilot_id} — ${p.brand} ${p.name}** (${p.category}; ${p.product_id})`).join('\n')}\n\n## Selected Facts\n\n${facts.join('\n')}\n\n## Excluded products\n\n${excluded.join('\n')}\n\n## Parent dependency\n\n${plan.parent_dependency_decisions.length ? plan.parent_dependency_decisions.map((d) => `- ${d.pilot_id} / ${d.fact_key}: parent \`${d.parent_proposition_key}\` must be confirmed first and its Hosted fact_instance_id must be bound into the child confirmation.`).join('\n') : '- None'}\n\n## Coverage\n\n- Categories: ${plan.coverage.categories.join(', ')}\n- Fact families: ${plan.coverage.fact_families.join(', ')}\n- New vs Batch 1 Fact families: ${plan.coverage.new_vs_batch_1_fact_families.join(', ') || 'none'}\n\n## Expected Hosted delta\n\n\`\`\`json\n${JSON.stringify(plan.expected_writes, null, 2)}\n\`\`\`\n\n## Expected final Hosted state\n\n\`\`\`json\n${JSON.stringify(plan.expected_final_hosted, null, 2)}\n\`\`\`\n\n## Safety boundary\n\n- New products: ${plan.summary.new_products} / max 4\n- New subjects: ${plan.summary.new_subjects} / max 4\n- New Facts: ${plan.summary.new_facts} / max 8\n- New Evidence: ${plan.summary.new_evidence_records} / max 10\n- Registry republish: NO\n- Migration / DDL / repair / db push: 0\n- Direct Product Fact table writes: NO\n- Existing eight Current propositions must remain byte-semantically and ID invariant.\n- Every Fact requires zero-write preflight, controlled confirmation, and exact retry idempotency.\n- At least one stale-prestate rejection must be rechecked in Hosted execution.\n- Legacy product scalar sync remains 0.\n- Decision Axis production consumption remains NO.\n- Recommendation activation remains NO.\n\n## Lifecycle\n\n\`\`\`text\nV21_8B_BATCH_PLAN_FROZEN = PLANNED\nPRODUCT_FACT_ADOPTION_BATCH_2_COMPLETE = NO\nPRODUCT_FACT_PARTIAL_CATALOG_ADOPTION = YES (Batch 1 authority only before Hosted Batch 2 execution)\nCATALOG_FULLY_ADOPTED = NO\nPRODUCT_DECISION_AXIS_PRODUCTION_CALIBRATED = NO\nDECISION_AXIS_PRODUCTION_CONSUMPTION = NO\nRECOMMENDATION_SCORER_CHANGED = NO\nRECOMMENDATION_ACTIVATED = NO\nADMIN_PRODUCT_FACT_UI_OPERATIONAL = NO\nHOSTED_WRITES_EXECUTED_BY_THIS_ARTIFACT_BUILD = 0\n\`\`\`\n`;

fs.mkdirSync('evidence/product-fact-adoption-v1', { recursive: true });
fs.mkdirSync('docs/evidence', { recursive: true });
fs.writeFileSync(outJson, json);
fs.writeFileSync(outMd, md);
const hash = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
console.log(`PASS build-product-fact-adoption-batch-2-v1 products=${plan.summary.new_products} facts=${plan.summary.new_facts}`);
console.log(`selected=${plan.selected_products.map((p)=>p.pilot_id).join(',')}`);
console.log(`json_sha256=${hash(Buffer.from(json))}`);
console.log(`md_sha256=${hash(Buffer.from(md))}`);
console.log(`expected_sources=${plan.summary.unique_sources} expected_bindings=${plan.summary.unique_bindings}`);
console.log('hosted_writes=0 production_consumption=NO recommendation_activation=NO');
