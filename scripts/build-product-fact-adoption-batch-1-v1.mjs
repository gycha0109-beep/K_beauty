import fs from 'node:fs';
import crypto from 'node:crypto';
import { buildBatchPlan, stableJson, sha256JsonBytes } from './product-evidence/product-fact-adoption-batch-v1.mjs';

const BASE_MAIN_SHA = process.env.V21_8A_BASE_MAIN_SHA || '91078d537abfc7779c3988326697539038904b6b';
const paths = {
  materialization: 'evidence/product-fact-materialization-v1/cross-category-pilot-materialization-dry-run-v1.json',
  fusion: 'evidence/product-fact-fusion-v1/cleanser-evidence-fusion-review-uncertainty-v1.json',
  decisionAxis: 'evidence/product-decision-axis-v1/cross-category-product-decision-axis-v1.json',
  shadow: 'evidence/product-recommendation-shadow-v1/legacy-vs-decision-axis-shadow-v1.json',
};
const outJson = 'evidence/product-fact-adoption-v1/cross-category-adoption-batch-1-v1.json';
const outMd = 'docs/evidence/product-fact-adoption-batch-1-v1.md';
const read = (p) => fs.readFileSync(p, 'utf8');
const texts = Object.fromEntries(Object.entries(paths).map(([k,p]) => [k, read(p)]));
const docs = Object.fromEntries(Object.entries(texts).map(([k,t]) => [k, JSON.parse(t)]));
const inputHashes = Object.fromEntries(Object.entries(texts).map(([k,t]) => [k, sha256JsonBytes(t)]));

function buildPlan() {
  const axisForSelection = structuredClone(docs.decisionAxis);
  const catalogDomainByPilot = new Map();
  for (const product of axisForSelection.products) {
    catalogDomainByPilot.set(product.pilot_id, product.domain);
    if (product.domain.startsWith('moisturizer_')) product.domain = 'moisturizer_family';
  }
  const plan = buildBatchPlan({ ...docs, decisionAxis: axisForSelection, baseMainSha: BASE_MAIN_SHA, inputHashes });
  for (const product of plan.selected_products) product.catalog_domain = catalogDomainByPilot.get(product.pilot_id);
  plan.selection_policy.domain_family_adapter = {
    sunscreen: ['sunscreen'],
    moisturizer_family: ['moisturizer_cream', 'moisturizer_balm'],
    treatment: ['treatment'],
    authority: 'V2.1-6 axis_contract.domain_axis_map family semantics',
  };
  delete plan.plan_content_sha256;
  plan.plan_content_sha256 = crypto.createHash('sha256').update(JSON.stringify(plan)).digest('hex');
  return plan;
}

const plan = buildPlan();
const json = stableJson(plan);
fs.mkdirSync('evidence/product-fact-adoption-v1', { recursive: true });
fs.mkdirSync('docs/evidence', { recursive: true });
fs.writeFileSync(outJson, json);

const factLines = plan.selected_products.flatMap((p) => p.facts.map((f) => `- ${p.pilot_id} / ${p.brand} ${p.name}: \`${f.fact_key}\` = \`${JSON.stringify(f.typed_value)}\` — ${f.authority_ceiling}/${f.fused_confidence} — ${f.expected_proposition_key}`));
const md = `# V2.1-8A — Product Fact Catalog Adoption Batch 1\n\n## Authority\n\n- Base main: \`${plan.authority.base_main_sha}\`\n- Registry: \`${plan.authority.registry_version}\`\n- V2.1-2 materialization SHA-256: \`${plan.authority.materialization_sha256}\`\n- V2.1-4 fusion SHA-256: \`${plan.authority.fusion_sha256}\`\n- V2.1-5 cleanser axis SHA-256: \`${plan.authority.cleanser_axis_sha256}\`\n- V2.1-6 cross-category axis SHA-256: \`${plan.authority.cross_category_axis_sha256}\`\n- V2.1-7 shadow SHA-256: \`${plan.authority.shadow_sha256}\`\n\n## Selection policy\n\nBatch 1 is deterministic and frozen-pilot-only. It selects one safe candidate from each of sunscreen, moisturizer family, and treatment. V2.1-6 catalog domains \`moisturizer_cream\` / \`moisturizer_balm\` are mapped only to the existing mapper family \`moisturizer_family\`; the original catalog domain is preserved separately. Facts must be supported, high-confidence, product-specific-primary, root propositions with one admissible supporting Evidence record and no opposing/context Evidence. Existing V2.1-3 Hosted products are excluded.\n\n## Selected products\n\n${plan.selected_products.map((p) => `- **${p.pilot_id} — ${p.brand} ${p.name}** (${p.domain}; catalog domain ${p.catalog_domain}, ${p.product_id})`).join('\n')}\n\n## Selected Fact proposals\n\n${factLines.join('\n')}\n\n## Expected Hosted delta\n\n\`\`\`json\n${JSON.stringify(plan.expected_writes, null, 2)}\n\`\`\`\n\n## Safety boundary\n\n- New products: ${plan.summary.new_products} / max 3\n- New Facts: ${plan.summary.new_facts} / max 6\n- Registry republish: NO\n- Direct Product Fact table writes: NO\n- Each Fact requires preflight, stale-state negative coverage, confirm, and exact retry idempotency.\n- Hosted runtime fusion digests are computed only after Hosted UUID allocation.\n- Temporary Admin capability, if used, must be transaction-scoped with persistent membership residue 0.\n- Legacy product fields are never overwritten.\n- Decision Axis production consumption remains NO.\n- Recommendation activation remains NO.\n\n## Lifecycle\n\n\`\`\`text\nPRODUCT_FACT_PARTIAL_CATALOG_ADOPTION_PLANNED = YES\nPRODUCT_FACT_CATALOG_ADOPTED = NO\nCATALOG_FULLY_ADOPTED = NO\nPRODUCT_DECISION_AXIS_PRODUCTION_CALIBRATED = NO\nDECISION_AXIS_PRODUCTION_CONSUMPTION = NO\nRECOMMENDATION_SCORER_CHANGED = NO\nRECOMMENDATION_ACTIVATED = NO\nHOSTED_WRITES_EXECUTED_BY_THIS_ARTIFACT_BUILD = 0\n\`\`\`\n`;
fs.writeFileSync(outMd, md);
const hash = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
console.log(`PASS build-product-fact-adoption-batch-1-v1 products=${plan.summary.new_products} facts=${plan.summary.new_facts}`);
console.log(`selected=${plan.selected_products.map((p)=>`${p.pilot_id}:${p.domain}/${p.catalog_domain}`).join(',')}`);
console.log(`json_sha256=${hash(Buffer.from(json))}`);
console.log(`md_sha256=${hash(Buffer.from(md))}`);
console.log('hosted_writes=0 production_consumption=NO recommendation_activation=NO');
