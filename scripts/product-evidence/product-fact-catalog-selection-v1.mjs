import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { CATALOG_EXPANSION_SELECTION_POLICY_V1 as POLICY, round6, compareCandidates } from './catalog-expansion-selection-policy-v1.mjs';

const FIELD_NAMES = Object.freeze([
  'id','brand','name','normalized_brand','normalized_name','category','recommendation_tier','size_ml','product_form',
  'source_url','hwahae_url','external_source','external_type','external_id','current_fact_count','recommendation_log_frequency','top_pick_frequency',
]);

function sha256(buf) { return crypto.createHash('sha256').update(buf).digest('hex'); }
function hasText(v) { return typeof v === 'string' && v.trim().length > 0; }
function isHttps(v) { if (!hasText(v)) return false; try { return new URL(v).protocol === 'https:'; } catch { return false; } }
function expandRow(row) { const out = {}; FIELD_NAMES.forEach((k, i) => { out[k] = row[i] ?? null; }); return out; }
function blockerDisposition(state) {
  if (state === 'IDENTITY_BLOCKED') return 'EXCLUDED_IDENTITY_BLOCKED';
  if (state === 'VARIANT_SCOPE_CONFLICT') return 'EXCLUDED_VARIANT_CONFLICT';
  if (state === 'FORMULATION_SCOPE_CONFLICT') return 'EXCLUDED_FORMULATION_CONFLICT';
  return 'EXCLUDED_MINIMUM_IDENTITY_NOT_READY';
}

export function loadFrozenCatalogSnapshot(repoRoot = process.cwd()) {
  const dir = path.join(repoRoot, 'evidence/product-fact-catalog-expansion-v1/hosted-selection-snapshot-v1');
  const manifestPath = path.join(dir, 'manifest.json');
  const manifestBytes = fs.readFileSync(manifestPath);
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  if (manifest.version !== 'v21-8f-hosted-selection-snapshot-v1') throw new Error('snapshot manifest version mismatch');
  const products = [];
  const fileProof = [];
  for (const file of manifest.category_files) {
    const p = path.join(dir, file.path);
    const bytes = fs.readFileSync(p);
    const actual = sha256(bytes);
    if (actual !== file.sha256) throw new Error(`snapshot partition hash mismatch: ${file.path}`);
    const payload = JSON.parse(bytes.toString('utf8'));
    if (payload.category !== file.category || !Array.isArray(payload.rows)) throw new Error(`snapshot partition contract mismatch: ${file.path}`);
    for (const row of payload.rows) products.push(expandRow(row));
    fileProof.push({ path: file.path, sha256: actual, rows: payload.rows.length });
  }
  products.sort((a,b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  if (products.length !== manifest.catalog_product_count) throw new Error(`catalog count mismatch ${products.length}`);
  const duplicateIds = products.length - new Set(products.map(p => p.id)).size;
  if (duplicateIds) throw new Error('duplicate product ids in frozen snapshot');
  return { manifest, products, fileProof, manifest_sha256: sha256(manifestBytes) };
}

function coverageFor(products) {
  const by = new Map();
  for (const p of products) {
    const x = by.get(p.category) ?? { category: p.category, total_products: 0, adopted_products: 0, adopted_current_facts: 0 };
    x.total_products += 1;
    if (Number(p.current_fact_count) > 0) x.adopted_products += 1;
    x.adopted_current_facts += Number(p.current_fact_count) || 0;
    by.set(p.category, x);
  }
  return [...by.values()].sort((a,b) => a.category < b.category ? -1 : a.category > b.category ? 1 : 0).map(x => ({
    ...x,
    unadopted_products: x.total_products - x.adopted_products,
    category_adoption_ratio: round6(x.total_products ? x.adopted_products / x.total_products : 0),
    category_floor_gap: Math.max(0, POLICY.targetFloor - x.adopted_products),
    category_floor_met: x.adopted_products >= POLICY.targetFloor,
  }));
}

function identityReadiness(p) {
  let score = 0;
  if (hasText(p.normalized_brand)) score += 3;
  if (hasText(p.normalized_name)) score += 3;
  if (isHttps(p.source_url)) score += 3;
  if (hasText(p.external_source) && hasText(p.external_id)) score += 3;
  const disambiguating = p.size_ml !== null || hasText(p.product_form) || (p.category === 'toner_pad' && hasText(p.external_source) && hasText(p.external_id));
  if (disambiguating) score += 3;
  return score;
}

function evidenceReadiness(p) {
  return (isHttps(p.source_url) ? 2 : 0)
    + (isHttps(p.hwahae_url) ? 1 : 0)
    + (hasText(p.external_source) ? 1 : 0)
    + (hasText(p.external_id) ? 1 : 0);
}

function minimumIdentityReady(p) { return hasText(p.normalized_brand) && hasText(p.normalized_name); }

function scoreCandidate(p, coverageMap, maxLogFrequency, blockerMap) {
  const coverage = coverageMap.get(p.category);
  const blocked = blockerMap.get(p.id) ?? null;
  const categoryGapScore = round6(POLICY.weights.categoryGap * Math.max(0, POLICY.targetFloor - coverage.adopted_products) / POLICY.targetFloor);
  const logComponent = round6(maxLogFrequency > 0 ? POLICY.weights.recommendationLogs * Number(p.recommendation_log_frequency || 0) / maxLogFrequency : 0);
  const sourceRankingComponent = 0;
  const recommendationRelevanceScore = round6(logComponent + sourceRankingComponent);
  const identityReadinessScore = identityReadiness(p);
  const families = POLICY.candidateFactFamilies[p.category] ?? [];
  const registryOpportunityScore = Math.min(POLICY.weights.registryOpportunity, families.length * 3);
  const evidenceDiscoveryReadinessScore = evidenceReadiness(p);
  const penaltyTotal = 0;
  const priorityScore = round6(categoryGapScore + recommendationRelevanceScore + identityReadinessScore + registryOpportunityScore + evidenceDiscoveryReadinessScore - penaltyTotal);
  const adopted = Number(p.current_fact_count) > 0;
  let priorityClass;
  let exclusionState = null;
  if (adopted) priorityClass = 'ADOPTED';
  else if (blocked || !minimumIdentityReady(p)) { priorityClass = 'P2'; exclusionState = blocked?.state ?? 'MINIMUM_IDENTITY_NOT_READY'; }
  else priorityClass = priorityScore >= POLICY.priorityP0Threshold ? 'P0' : 'P1';
  return {
    product_id: p.id,
    brand: p.brand,
    name: p.name,
    normalized_brand: p.normalized_brand,
    normalized_name: p.normalized_name,
    category: p.category,
    current_fact_count: Number(p.current_fact_count) || 0,
    priority_class: priorityClass,
    priority_score: priorityScore,
    category_adopted_count: coverage.adopted_products,
    category_gap_score: categoryGapScore,
    recommendation_relevance_score: recommendationRelevanceScore,
    recommendation_log_component: logComponent,
    source_ranking_component: sourceRankingComponent,
    identity_readiness_score: identityReadinessScore,
    registry_opportunity_score: registryOpportunityScore,
    evidence_discovery_readiness_score: evidenceDiscoveryReadinessScore,
    penalties: [],
    penalty_total: penaltyTotal,
    candidate_fact_families: [...families],
    known_blocker_state: blocked?.state ?? null,
    known_blocker_authority: blocked?.authority ?? null,
    minimum_identity_ready: minimumIdentityReady(p),
    source_url: p.source_url,
    hwahae_url: p.hwahae_url,
    external_source: p.external_source,
    external_type: p.external_type,
    external_id: p.external_id,
    recommendation_log_frequency: Number(p.recommendation_log_frequency) || 0,
    top_pick_frequency: Number(p.top_pick_frequency) || 0,
    size_ml: p.size_ml,
    product_form: p.product_form,
    exclusion_state: exclusionState,
  };
}

function selectionReason(candidate, fallback, capRelaxed) {
  return [
    `selected for next Product Fact evidence research under ${POLICY.version}`,
    `category quota=${candidate.category}`,
    `priority_class=${candidate.priority_class}${fallback ? ' P1_fallback' : ''}`,
    `priority_score=${candidate.priority_score.toFixed(6)}`,
    capRelaxed ? 'brand cap relaxed deterministically for otherwise unfillable slot' : 'brand cap satisfied',
  ].join('; ');
}

export function buildCatalogExpansionWave1(repoRoot = process.cwd()) {
  const frozen = loadFrozenCatalogSnapshot(repoRoot);
  const { manifest, products } = frozen;
  if (manifest.selection_policy_version !== POLICY.version) throw new Error('selection policy version mismatch');
  const coverage = coverageFor(products);
  const coverageMap = new Map(coverage.map(x => [x.category, x]));
  const blockerMap = new Map(manifest.historical_blockers.map(x => [x.product_id, x]));
  const prelimEligible = products.filter(p => Number(p.current_fact_count) === 0 && !blockerMap.has(p.id) && minimumIdentityReady(p));
  const maxLogFrequency = Math.max(0, ...prelimEligible.map(p => Number(p.recommendation_log_frequency) || 0));
  const scored = products.map(p => scoreCandidate(p, coverageMap, maxLogFrequency, blockerMap));
  const scoredMap = new Map(scored.map(x => [x.product_id, x]));
  const selected = [];
  const selectedIds = new Set();
  const brandCounts = new Map();
  const quotaTrace = [];

  for (const { category, quota } of POLICY.wave1CategoryQuota) {
    const pool = scored.filter(x => x.category === category && (x.priority_class === 'P0' || x.priority_class === 'P1')).sort(compareCandidates);
    let rankWithin = 0;
    for (const priorityClass of ['P0', 'P1']) {
      for (const candidate of pool.filter(x => x.priority_class === priorityClass)) {
        if (rankWithin >= quota) break;
        const brandCount = brandCounts.get(candidate.normalized_brand) ?? 0;
        if (brandCount >= POLICY.brandCap) continue;
        rankWithin += 1;
        selectedIds.add(candidate.product_id);
        brandCounts.set(candidate.normalized_brand, brandCount + 1);
        selected.push({ ...candidate, selection_rank_within_category: rankWithin, brand_cap_relaxed: false, selection_reason: selectionReason(candidate, priorityClass === 'P1', false) });
      }
      if (rankWithin >= quota) break;
    }
    while (rankWithin < quota) {
      const candidate = pool.find(x => !selectedIds.has(x.product_id));
      if (!candidate) throw new Error(`quota unfillable: ${category}`);
      rankWithin += 1;
      selectedIds.add(candidate.product_id);
      brandCounts.set(candidate.normalized_brand, (brandCounts.get(candidate.normalized_brand) ?? 0) + 1);
      selected.push({ ...candidate, selection_rank_within_category: rankWithin, brand_cap_relaxed: true, selection_reason: selectionReason(candidate, candidate.priority_class === 'P1', true) });
      quotaTrace.push({ category, slot: rankWithin, brand_cap_relaxed: true, product_id: candidate.product_id, reason: 'quota otherwise unfillable under global normalized_brand cap' });
    }
  }

  const selectedOverall = [...selected].sort(compareCandidates).map((x, i) => ({ selection_rank_overall: i + 1, ...x }));
  const excluded = [];
  const deferred = [];
  for (const c of scored.sort((a,b) => compareCandidates(a,b))) {
    if (selectedIds.has(c.product_id)) continue;
    if (c.priority_class === 'ADOPTED') {
      excluded.push({ product_id: c.product_id, category: c.category, priority_class: 'ADOPTED', priority_score: c.priority_score, disposition: 'EXCLUDED_ALREADY_ADOPTED', reason_codes: ['HAS_PRODUCT_FACT_CURRENT'] });
    } else if (c.priority_class === 'P2') {
      excluded.push({ product_id: c.product_id, category: c.category, priority_class: 'P2', priority_score: c.priority_score, disposition: blockerDisposition(c.exclusion_state), reason_codes: [c.exclusion_state] });
    } else {
      const inTarget = POLICY.wave1CategoryQuota.some(q => q.category === c.category);
      let disposition = inTarget ? 'DEFERRED_CATEGORY_QUOTA' : 'DEFERRED_CATEGORY_QUOTA';
      let reason = inTarget ? 'LOWER_THAN_SELECTED_CATEGORY_CUTOFF' : 'NO_WAVE_1_CATEGORY_ALLOCATION';
      if (inTarget && (brandCounts.get(c.normalized_brand) ?? 0) >= POLICY.brandCap) {
        const categorySelected = selected.filter(s => s.category === c.category);
        const wouldOutrank = categorySelected.some(s => compareCandidates(c, s) < 0);
        if (wouldOutrank) { disposition = 'DEFERRED_BRAND_CAP'; reason = 'GLOBAL_NORMALIZED_BRAND_CAP_2'; }
      }
      deferred.push({ product_id: c.product_id, brand: c.brand, name: c.name, category: c.category, priority_class: c.priority_class, priority_score: c.priority_score, disposition, reason_codes: [reason] });
    }
  }

  const classes = { P0: 0, P1: 0, P2: 0 };
  for (const c of scored) if (classes[c.priority_class] !== undefined) classes[c.priority_class] += 1;
  const adoptedProducts = scored.filter(x => x.priority_class === 'ADOPTED').length;
  const adoptedCurrentFacts = scored.reduce((s,x) => s + x.current_fact_count, 0);
  const categoryFloorMet = coverage.filter(x => x.category_floor_met).length;
  const selectedByCategory = Object.fromEntries(POLICY.wave1CategoryQuota.map(q => [q.category, selected.filter(s => s.category === q.category).length]));
  const selectedByBrand = Object.fromEntries([...brandCounts.entries()].sort((a,b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));

  const selectionPolicy = {
    version: POLICY.version,
    target_floor: POLICY.targetFloor,
    score_formula: 'category_gap_score + recommendation_relevance_score + identity_readiness_score + registry_opportunity_score + evidence_discovery_readiness_score - nonblocking_penalties',
    category_gap_formula: '40 * max(0, 3 - category_adopted_count) / 3',
    recommendation_log_formula: '15 * candidate_frequency / max_eligible_candidate_frequency',
    source_ranking_component: POLICY.sourceRankingComponent,
    identity_readiness_formula: ['normalized_brand +3','normalized_name +3','valid_https_source_url +3','external_source_and_external_id +3','identity_disambiguating_attribute +3'],
    registry_opportunity_formula: 'min(15, governed_applicable_fact_family_count * 3)',
    evidence_discovery_formula: ['valid_https_source_url +2','valid_https_hwahae_or_external_locator +1','external_source +1','external_id +1'],
    nonblocking_penalties: [],
    p0_threshold: POLICY.priorityP0Threshold,
    p2_rule: 'unresolved historical identity/variant/formulation blocker or missing normalized brand/name',
    brand_cap: POLICY.brandCap,
    wave1_category_quota: POLICY.wave1CategoryQuota,
    candidate_fact_family_map: POLICY.candidateFactFamilies,
    deterministic_tie_break: POLICY.tieBreak,
  };

  return {
    version: 'coverage-expansion-wave-1-selection-v1',
    stage: 'V2.1-8F',
    authority: {
      source_main_sha: manifest.source_main_sha,
      registry_version: manifest.registry_version,
      selection_policy_version: POLICY.version,
      hosted_snapshot_digest: manifest.hosted_semantic_digest,
      snapshot_manifest_sha256: frozen.manifest_sha256,
      snapshot_partition_proof: frozen.fileProof,
      generated_at_policy: 'none_deterministic',
    },
    catalog_snapshot: {
      catalog_product_count: products.length,
      adopted_product_count: adoptedProducts,
      adopted_current_fact_count: adoptedCurrentFacts,
      facts_per_adopted_product: round6(adoptedProducts ? adoptedCurrentFacts / adoptedProducts : 0),
      category_floor_target: POLICY.targetFloor,
      category_floor_met_count: categoryFloorMet,
      category_floor_coverage: round6(categoryFloorMet / coverage.length),
      max_eligible_recommendation_log_frequency: maxLogFrequency,
      source_ranking_component_unavailable: true,
    },
    coverage_by_category: coverage,
    selection_policy: selectionPolicy,
    candidate_pool_summary: {
      nominal_unadopted_count: scored.filter(x => x.priority_class !== 'ADOPTED').length,
      eligible_candidate_pool_count: classes.P0 + classes.P1,
      P0_count: classes.P0,
      P1_count: classes.P1,
      P2_count: classes.P2,
      selected_count: selectedOverall.length,
      selected_by_category: selectedByCategory,
      selected_by_brand: selectedByBrand,
      already_adopted_exclusions: excluded.filter(x => x.disposition === 'EXCLUDED_ALREADY_ADOPTED').length,
      historical_block_exclusions: excluded.filter(x => x.priority_class === 'P2' && x.disposition !== 'EXCLUDED_MINIMUM_IDENTITY_NOT_READY').length,
      minimum_identity_exclusions: excluded.filter(x => x.disposition === 'EXCLUDED_MINIMUM_IDENTITY_NOT_READY').length,
    },
    selected_products: selectedOverall,
    deferred_products: deferred,
    excluded_products: excluded,
    invariants: {
      hosted_product_fact_write_intent: 0,
      products_write_intent: 0,
      source_rankings_write_intent: 0,
      recommendation_logs_write_intent: 0,
      external_product_evidence_research: 0,
      product_fact_semantic_assertions_generated: 0,
      selected_product_count: selectedOverall.length,
      brand_cap_relaxation_count: selectedOverall.filter(x => x.brand_cap_relaxed).length,
      quota_trace: quotaTrace,
      runtime_consumption: false,
    },
  };
}

export const SNAPSHOT_FIELD_NAMES = FIELD_NAMES;
