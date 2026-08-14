import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { buildCatalogExpansionWave1 } from './product-evidence/product-fact-catalog-selection-v1.mjs';

const OUT_JSON = 'evidence/product-fact-catalog-expansion-v1/coverage-expansion-wave-1-selection-v1.json';
const OUT_MD = 'docs/evidence/product-fact-catalog-expansion-wave-1-selection-v1.md';
const root = process.env.V21_8F_OUTPUT_ROOT ? path.resolve(process.env.V21_8F_OUTPUT_ROOT) : process.cwd();

function sha256(text) { return crypto.createHash('sha256').update(text, 'utf8').digest('hex'); }
function write(rel, text) { const p = path.join(root, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, text); }
function fmt(v) { return Number(v).toFixed(6); }

function renderMarkdown(x) {
  const lines = [];
  lines.push('# V2.1-8F — Catalog Coverage Expansion Wave 1 Selection');
  lines.push('');
  lines.push('> Planning-only repository authority. This artifact selects the next Product Fact evidence-research batch; it does not assert Product Facts, perform external evidence research, or write Hosted data.');
  lines.push('');
  lines.push('## Authority');
  lines.push('');
  lines.push(`- Source main: \`${x.authority.source_main_sha}\``);
  lines.push(`- Registry: \`${x.authority.registry_version}\``);
  lines.push(`- Selection policy: \`${x.authority.selection_policy_version}\``);
  lines.push(`- Hosted snapshot digest: \`${x.authority.hosted_snapshot_digest}\``);
  lines.push('- Generated-at policy: none; canonical output contains no wall-clock timestamp.');
  lines.push('');
  lines.push('## Catalog snapshot');
  lines.push('');
  lines.push(`- Catalog products: ${x.catalog_snapshot.catalog_product_count}`);
  lines.push(`- Adopted products: ${x.catalog_snapshot.adopted_product_count}`);
  lines.push(`- Current Facts: ${x.catalog_snapshot.adopted_current_fact_count}`);
  lines.push(`- Facts per adopted product: ${fmt(x.catalog_snapshot.facts_per_adopted_product)}`);
  lines.push(`- Eligible candidate pool: ${x.candidate_pool_summary.eligible_candidate_pool_count}`);
  lines.push(`- P0 / P1 / P2: ${x.candidate_pool_summary.P0_count} / ${x.candidate_pool_summary.P1_count} / ${x.candidate_pool_summary.P2_count}`);
  lines.push('');
  lines.push('## Category coverage');
  lines.push('');
  lines.push('| Category | Total | Adopted | Unadopted | Current Facts | Adoption ratio | Floor gap |');
  lines.push('|---|---:|---:|---:|---:|---:|---:|');
  for (const c of x.coverage_by_category) lines.push(`| ${c.category} | ${c.total_products} | ${c.adopted_products} | ${c.unadopted_products} | ${c.adopted_current_facts} | ${fmt(c.category_adoption_ratio)} | ${c.category_floor_gap} |`);
  lines.push('');
  lines.push('## Selection policy v1');
  lines.push('');
  lines.push('- Category gap: `40 * max(0, 3 - adopted_product_count) / 3`.');
  lines.push('- Recommendation logs: `15 * product_frequency / max_eligible_frequency`.');
  lines.push('- Source rankings: 0 in Wave 1 because no defensible current source_rankings → catalog-product canonical mapping exists.');
  lines.push('- Identity readiness: normalized brand +3, normalized name +3, HTTPS source_url +3, external source+id +3, disambiguating attribute +3.');
  lines.push('- Registry opportunity: `min(15, applicable governed candidate Fact-family count * 3)`.');
  lines.push('- Evidence discovery readiness: HTTPS source_url +2, existing external locator +1, external_source +1, external_id +1.');
  lines.push('- Nonblocking score penalties: none in policy v1. Brand diversity is a separate global cap of 2 per normalized brand.');
  lines.push('- P0: score >= 60. P1: score < 60. P2: hard historical blocker or missing minimum deterministic identity.');
  lines.push('- All component and final scores are rounded to 6 decimals. No LLM ranking, random sampling, created_at ordering, or DB implicit ordering is used.');
  lines.push('');
  lines.push('## Exact selected 12-product batch');
  lines.push('');
  lines.push('| Rank | Product ID | Brand | Product | Category | Class | Score | Gap | Rec. | Identity | Registry | Discovery | Research target families |');
  lines.push('|---:|---|---|---|---|---|---:|---:|---:|---:|---:|---:|---|');
  for (const p of x.selected_products) lines.push(`| ${p.selection_rank_overall} | \`${p.product_id}\` | ${p.brand} | ${p.name} | ${p.category} | ${p.priority_class} | ${fmt(p.priority_score)} | ${fmt(p.category_gap_score)} | ${fmt(p.recommendation_relevance_score)} | ${fmt(p.identity_readiness_score)} | ${fmt(p.registry_opportunity_score)} | ${fmt(p.evidence_discovery_readiness_score)} | ${p.candidate_fact_families.join(', ')} |`);
  lines.push('');
  lines.push('Candidate Fact families above are Stage-B research targets from the governed Registry, **not Product Fact assertions**.');
  lines.push('');
  lines.push('## Wave 1 quota and diversity proof');
  lines.push('');
  for (const [category, count] of Object.entries(x.candidate_pool_summary.selected_by_category)) lines.push(`- ${category}: ${count}`);
  lines.push('');
  lines.push(`Brand-cap relaxations: ${x.invariants.brand_cap_relaxation_count}`);
  for (const [brand, count] of Object.entries(x.candidate_pool_summary.selected_by_brand)) lines.push(`- ${brand}: ${count}`);
  lines.push('');
  lines.push('## Historical blocker ledger');
  lines.push('');
  for (const e of x.excluded_products.filter(e => e.priority_class === 'P2')) lines.push(`- \`${e.product_id}\` — ${e.disposition} — ${e.reason_codes.join(', ')}`);
  lines.push('');
  lines.push('## Invariants');
  lines.push('');
  lines.push('- Hosted Product Fact writes: 0');
  lines.push('- products/source_rankings/recommendation_logs writes: 0');
  lines.push('- External product evidence research: 0');
  lines.push('- Product Fact semantic assertions generated: 0');
  lines.push('- Production runtime consumption: false');
  lines.push('- V2.1-8G: not started');
  lines.push('');
  return lines.join('\n');
}

const result = buildCatalogExpansionWave1(process.cwd());
const json = JSON.stringify(result, null, 2) + '\n';
const md = renderMarkdown(result);
write(OUT_JSON, json);
write(OUT_MD, md);
console.log('catalog_expansion_wave_1_build: PASS');
console.log(`selection_json_sha256=${sha256(json)}`);
console.log(`selection_md_sha256=${sha256(md)}`);
console.log(`selected_product_ids=${JSON.stringify(result.selected_products.map(x => x.product_id))}`);
console.log(`candidate_pool=${result.candidate_pool_summary.eligible_candidate_pool_count} P0=${result.candidate_pool_summary.P0_count} P1=${result.candidate_pool_summary.P1_count} P2=${result.candidate_pool_summary.P2_count}`);
