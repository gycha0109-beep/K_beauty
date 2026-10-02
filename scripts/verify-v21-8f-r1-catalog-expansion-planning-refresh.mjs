#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const run = () => {
  const r = spawnSync(process.execPath, ['scripts/product-evidence/product-fact-catalog-selection-v2.mjs'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr || 'builder failed');
  return JSON.parse(r.stdout);
};

const a = run();
const b = run();
assert.deepEqual(a, b, 'Build A/B must be deterministic');
assert.deepEqual(a, read('evidence/product-fact-catalog-expansion-v1/coverage-expansion-wave-1-selection-v2.json'), 'committed artifact must equal canonical build');

assert.equal(a.stage, 'V2.1-8F-R1');
assert.equal(a.catalog_snapshot.catalog_product_count, 175);
assert.equal(a.catalog_snapshot.adopted_product_count, 32);
assert.equal(a.catalog_snapshot.adopted_current_fact_count, 95);
assert.equal(a.authority.candidate_pool_count, 140);
assert.equal(a.selected_products.length, 12);
assert.equal(a.selection_policy.floor_selected_count, 11);
assert.equal(a.selection_policy.flex_selected_count, 1);
assert.deepEqual(a.selection_policy.selected_by_category, {
  cleanser: 1,
  moisturizer_balm: 2,
  moisturizer_cream: 2,
  moisturizer_gel: 2,
  moisturizer_lotion_emulsion: 3,
  toner_essence: 1,
  toner_pad: 1,
});
for (const p of a.selected_products) {
  assert.equal(p.known_risk_penalty, 0);
  assert.ok(p.subject_creation_required_tasks > 0);
  if (p.priority_class === 'P1') assert.equal(p.selection_slot, 'floor');
  if (p.selection_slot === 'flex') assert.equal(p.priority_class, 'P0');
}

const old = read('evidence/product-fact-catalog-expansion-v1/hosted-selection-snapshot-v1/manifest.json');
assert.deepEqual([old.catalog_product_count, old.adopted_product_count, old.adopted_current_fact_count], [164, 9, 25]);
assert.equal(old.selection_policy_version, 'catalog-expansion-selection-policy-v1');

assert.equal(a.invariants.hosted_product_fact_writes, 0);
assert.equal(a.invariants.hosted_subject_writes, 0);
assert.equal(a.invariants.hosted_evidence_writes, 0);
assert.equal(a.invariants.external_product_evidence_research, 0);
assert.equal(a.invariants.missing_implies_false, false);
assert.equal(a.invariants.recommendation_activation_changed, false);
assert.equal(a.invariants.production_cutover_authorized, false);
assert.equal(a.invariants.public_activation, false);
assert.equal(a.decision, 'V21_8F_R1_CATALOG_EXPANSION_PLANNING_REFRESH_PASS');
assert.equal(a.next_gate, 'V2.1-8G_RESEARCH_EXACT_SELECTED_12_ONLY');

const doc = fs.readFileSync('docs/evidence/product-fact-catalog-expansion-wave-1-selection-v2.md', 'utf8');
for (const id of a.selected_product_ids) assert.ok(doc.includes(id));
assert.ok(doc.includes('Historical v1 remains frozen'));
assert.ok(doc.includes('V2.1-8G is **not started**'));

console.log(JSON.stringify({
  status: 'PASS',
  stage: a.stage,
  catalog: 175,
  adopted: 32,
  currentFacts: 95,
  candidatePool: 140,
  selected: a.selected_product_ids,
  allocation: a.selection_policy.selected_by_category,
  hostedWrites: 0,
  externalEvidenceResearch: 0,
  decision: a.decision,
}, null, 2));
