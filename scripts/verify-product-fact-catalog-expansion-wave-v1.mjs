import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { buildCatalogExpansionWave1, loadFrozenCatalogSnapshot } from './product-evidence/product-fact-catalog-selection-v1.mjs';
import { CATALOG_EXPANSION_SELECTION_POLICY_V1 as POLICY, compareCandidates } from './product-evidence/catalog-expansion-selection-policy-v1.mjs';

let assertions = 0;
function ok(v, msg) { assertions += 1; assert.ok(v, msg); }
function eq(a,b,msg) { assertions += 1; assert.deepEqual(a,b,msg); }
function readJson(rel) { return JSON.parse(fs.readFileSync(path.join(process.cwd(), rel), 'utf8')); }

const expectedCoverage = {
  cleanser:[26,0,26], toner_essence:[24,0,24], toner_pad:[24,1,23], moisturizer_lotion_emulsion:[21,0,21],
  moisturizer_balm:[20,1,19], treatment:[18,3,15], sunscreen:[11,3,8], moisturizer_cream:[10,1,9], moisturizer_gel:[10,0,10],
};
const expectedSelected = [
  '24103bd1-c7ba-4cc9-b9b9-8129c6452232',
  '173c63a8-a40d-4d1e-acb6-a7944d66ec43',
  '97deb2cc-2fae-4dbb-8253-03170e197002',
  'c4a5f510-8d9e-46bd-a31c-3c0a34fee331',
  'dfc4b232-9997-4584-a886-bc7074b6f247',
  '59b149d0-5ffa-4610-8141-c0a501b60565',
  '1f20944c-5a86-4748-8daf-7d57259ea6c0',
  '65a4be83-a9b7-4b1d-bd58-1b6e99cf66fc',
  '8889342d-d9a2-454b-aa27-60d4934b9978',
  '51d526de-b127-47c4-83f1-64fc1ec4aa10',
  '0b59cb66-ab03-4a0d-815e-7a94a5c7ae65',
  'be8a590e-e5cb-4af4-84e7-99c7e121f45a',
];
const blockers = {
  '38dc094e-4148-4566-a743-a09815265f44':'IDENTITY_BLOCKED',
  '4cbd41f3-1357-42c6-a6c7-6df0e90d54a7':'VARIANT_SCOPE_CONFLICT',
  'd9e40ddb-b1e2-46e4-92db-82744227dfe3':'FORMULATION_SCOPE_CONFLICT',
};

const frozen = loadFrozenCatalogSnapshot(process.cwd());
eq(frozen.products.length, 164, 'frozen catalog must contain 164 products');
eq(frozen.manifest.source_main_sha, 'b1e70c638f0e039c4061986cefd55e8e937f0983', 'source main authority');
eq(frozen.manifest.registry_version, 'product-fact-registry-cross-category-v1', 'registry version');
eq(frozen.manifest.selection_policy_version, POLICY.version, 'policy version');
eq(frozen.manifest.hosted_semantic_digest, 'e7cf34642fc6ae8e073e30d852cc829ceb30ba408098e3fe1238d7978d95ee46', 'Hosted snapshot digest');
eq(frozen.fileProof.reduce((s,x)=>s+x.rows,0),164,'partition rows');

const result = buildCatalogExpansionWave1(process.cwd());
eq(result.catalog_snapshot.catalog_product_count,164,'catalog count');
eq(result.catalog_snapshot.adopted_product_count,9,'adopted count');
eq(result.catalog_snapshot.adopted_current_fact_count,25,'Current Fact count');
eq(result.catalog_snapshot.facts_per_adopted_product,2.777778,'facts/adopted');
eq(result.catalog_snapshot.max_eligible_recommendation_log_frequency,119,'max recommendation frequency');
eq(result.catalog_snapshot.source_ranking_component_unavailable,true,'source ranking unavailable');

for (const c of result.coverage_by_category) {
  const expected = expectedCoverage[c.category];
  ok(Boolean(expected), `unexpected category ${c.category}`);
  eq([c.total_products,c.adopted_products,c.unadopted_products], expected, `coverage ${c.category}`);
}
eq(result.coverage_by_category.length,9,'nine catalog categories');
eq(result.catalog_snapshot.category_floor_met_count,2,'floor met category count');
eq(result.catalog_snapshot.category_floor_coverage,0.222222,'floor coverage');

eq(result.candidate_pool_summary.nominal_unadopted_count,155,'nominal unadopted');
eq(result.candidate_pool_summary.eligible_candidate_pool_count,152,'eligible pool');
eq(result.candidate_pool_summary.P0_count,91,'P0 count');
eq(result.candidate_pool_summary.P1_count,61,'P1 count');
eq(result.candidate_pool_summary.P2_count,3,'P2 count');
eq(result.candidate_pool_summary.already_adopted_exclusions,9,'adopted exclusions');
eq(result.candidate_pool_summary.historical_block_exclusions,3,'historical blocker exclusions');
eq(result.candidate_pool_summary.minimum_identity_exclusions,0,'minimum identity exclusions');

const manifestBlockers = Object.fromEntries(frozen.manifest.historical_blockers.map(x=>[x.product_id,x.state]));
eq(manifestBlockers, blockers, 'blocker ledger exact');
const gapText = fs.readFileSync('evidence/product-evidence-decision-axis-v1/cross-category-real-pilot-gap-report-v1.json','utf8');
const recoveryText = fs.readFileSync('evidence/product-evidence-expansion-v1/source-gap-recovery-wave-1-v1.json','utf8');
ok(gapText.includes('38dc094e-4148-4566-a743-a09815265f44'),'P2 NEEDLY historical authority present');
ok(recoveryText.includes('4cbd41f3-1357-42c6-a6c7-6df0e90d54a7') && recoveryText.includes('VARIANT_SCOPE_CONFLICT'),'M3 blocker authority present');
ok(recoveryText.includes('d9e40ddb-b1e2-46e4-92db-82744227dfe3') && recoveryText.includes('FORMULATION_SCOPE_CONFLICT'),'P1 blocker authority present');

const selectedIds = result.selected_products.map(x=>x.product_id);
eq(selectedIds,expectedSelected,'exact selected products and deterministic global ranks');
eq(result.selected_products.length,12,'selected count');
eq(result.candidate_pool_summary.selected_by_category,{cleanser:4,toner_essence:3,moisturizer_lotion_emulsion:2,moisturizer_gel:2,toner_pad:1},'exact category quota');
eq(result.invariants.brand_cap_relaxation_count,0,'no brand cap relaxation');
for (const [brand,count] of Object.entries(result.candidate_pool_summary.selected_by_brand)) ok(count<=2,`brand cap ${brand}`);
for (const p of result.selected_products) {
  eq(p.current_fact_count,0,`selected must be unadopted ${p.product_id}`);
  ok(p.priority_class !== 'P2',`selected must not be P2 ${p.product_id}`);
  eq(p.known_blocker_state,null,`selected blocker null ${p.product_id}`);
  eq(p.source_ranking_component,0,`source ranking component zero ${p.product_id}`);
  ok(p.priority_score>=60,`Wave1 expected selected P0 ${p.product_id}`);
  ok(p.selection_reason.includes(POLICY.version),`selection reason policy ${p.product_id}`);
}

const registry = readJson('evidence/product-evidence-decision-axis-v1/cross-category-registry-v1.json');
eq(registry.registry_version,'product-fact-registry-cross-category-v1','registry file version');
const registryKeys = new Set(registry.facts.map(x=>x.fact_key));
for (const [category,families] of Object.entries(POLICY.candidateFactFamilies)) for (const fact of families) ok(registryKeys.has(fact),`governed registry family ${category}/${fact}`);

const quotaCategories = new Set(POLICY.wave1CategoryQuota.map(x=>x.category));
for (const p of result.selected_products) ok(quotaCategories.has(p.category),`selected category allowed ${p.product_id}`);
for (const p of result.selected_products) eq(p.penalties,[],'no v1 nonblocking penalties');

// Independent selected-ID rebuild from the scored selected rows verifies comparator stability.
const independentlySortedSelected = [...result.selected_products].sort(compareCandidates).map(x=>x.product_id);
eq(independentlySortedSelected, expectedSelected, 'independent selected-ID ordering');

const committedJson = readJson('evidence/product-fact-catalog-expansion-v1/coverage-expansion-wave-1-selection-v1.json');
eq(committedJson, result, 'committed JSON equals canonical rebuild');
const md = fs.readFileSync('docs/evidence/product-fact-catalog-expansion-wave-1-selection-v1.md','utf8');
for (const id of expectedSelected) ok(md.includes(id),`MD includes selected ${id}`);
ok(md.includes('does not assert Product Facts'),'MD states planning semantics');

eq(result.invariants.hosted_product_fact_write_intent,0,'PF write intent');
eq(result.invariants.products_write_intent,0,'products write intent');
eq(result.invariants.source_rankings_write_intent,0,'source rankings write intent');
eq(result.invariants.recommendation_logs_write_intent,0,'recommendation logs write intent');
eq(result.invariants.external_product_evidence_research,0,'external research intent');
eq(result.invariants.product_fact_semantic_assertions_generated,0,'no PF semantic assertion');
eq(result.invariants.runtime_consumption,false,'runtime consumption false');

// Offline-only import isolation: production sources may not reference the new artifact/tool identifiers.
const needles = ['coverage-expansion-wave-1-selection-v1','product-fact-catalog-selection-v1','catalog-expansion-selection-policy-v1'];
for (const root of ['app','components','lib']) {
  if (!fs.existsSync(root)) continue;
  const stack=[root];
  while(stack.length){ const p=stack.pop(); for(const ent of fs.readdirSync(p,{withFileTypes:true})){ const q=path.join(p,ent.name); if(ent.isDirectory()) stack.push(q); else if(/\.(js|jsx|mjs|ts|tsx)$/.test(ent.name)){ const text=fs.readFileSync(q,'utf8'); for(const needle of needles) ok(!text.includes(needle),`runtime isolation ${q}/${needle}`); } } }
}

console.log(JSON.stringify({
  status:'PASS',
  assertions,
  catalog_products:result.catalog_snapshot.catalog_product_count,
  adopted_products:result.catalog_snapshot.adopted_product_count,
  current_facts:result.catalog_snapshot.adopted_current_fact_count,
  candidate_pool:result.candidate_pool_summary.eligible_candidate_pool_count,
  classes:{P0:result.candidate_pool_summary.P0_count,P1:result.candidate_pool_summary.P1_count,P2:result.candidate_pool_summary.P2_count},
  selected_product_ids:selectedIds,
  quotas:result.candidate_pool_summary.selected_by_category,
  brand_cap_relaxations:result.invariants.brand_cap_relaxation_count,
  source_ranking_component_unavailable:true,
  hosted_writes:0,
  external_product_evidence_research:0,
},null,2));
