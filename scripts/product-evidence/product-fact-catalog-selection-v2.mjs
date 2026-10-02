#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import {
  CATALOG_EXPANSION_SELECTION_POLICY_V2 as POLICY,
  round2,
  thresholdScore,
  compareCandidatesV2,
} from './catalog-expansion-selection-policy-v2.mjs';

const EVIDENCE_DIR = 'evidence/product-fact-catalog-expansion-v1/hosted-selection-snapshot-v2';

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

function expandRows(schema, rows) {
  return rows.map((row) => Object.fromEntries(schema.map((key, i) => [key, row[i]])));
}

export function loadCatalogExpansionRefreshSnapshot(repoRoot = process.cwd()) {
  const dir = path.join(repoRoot, EVIDENCE_DIR);
  const manifest = readJson(path.join(dir, 'manifest.json'));
  if (manifest.version !== 'v21-8f-r1-hosted-selection-snapshot-v2') {
    throw new Error('snapshot v2 manifest mismatch');
  }
  if (manifest.selection_policy_version !== POLICY.version) {
    throw new Error('snapshot/policy version mismatch');
  }
  const frontierRows = manifest.frontier_files.flatMap(({ path: file }) => {
    const part = readJson(path.join(dir, file));
    if (!Array.isArray(part.rows)) throw new Error(`invalid frontier part: ${file}`);
    return part.rows;
  });
  return {
    manifest,
    categories: expandRows(manifest.category_row_schema, manifest.categories),
    candidates: expandRows(manifest.frontier_row_schema, frontierRows),
  };
}

function scoreCandidate(candidate, category) {
  const categoryGapScore = round2(
    POLICY.weights.categoryFloorGap * (category.floor_gap / POLICY.targetFloor) +
      POLICY.weights.categoryCoverageGap *
        (1 - category.adopted_products / category.total_products),
  );

  const recommendationRelevanceScore = Math.min(
    POLICY.weights.recommendationRelevance,
    thresholdScore(candidate.recommendation_events, POLICY.recommendationEventThresholds) +
      thresholdScore(candidate.top_picks, POLICY.topPickThresholds),
  );

  const sourceSeedPresent =
    candidate.source_class === 'first_party_seed' ||
    candidate.source_class === 'secondary_seed';

  const identityReadinessScore =
    (candidate.normalized_brand ? 3 : 0) +
    (candidate.normalized_name ? 3 : 0) +
    (candidate.size_present ? 3 : 0) +
    (candidate.product_form_present ? 2 : 0) +
    (candidate.external_id_present ? 2 : 0) +
    (sourceSeedPresent ? 2 : 0);

  const registryOpportunityScore = Math.min(
    POLICY.weights.registryOpportunity,
    category.candidate_fact_families.length * 3,
  );

  const evidenceDiscoveryReadinessScore =
    POLICY.discoveryScores[candidate.source_class] ?? POLICY.discoveryScores.none;

  const knownRiskPenalty =
    candidate.identity_risk_tasks > 0
      ? POLICY.riskPenalties.identityRisk
      : candidate.noncurrent_or_unresolved_subjects > 0
        ? POLICY.riskPenalties.unresolvedSubject
        : 0;

  const priorityScore = round2(
    categoryGapScore +
      recommendationRelevanceScore +
      identityReadinessScore +
      registryOpportunityScore +
      evidenceDiscoveryReadinessScore -
      knownRiskPenalty,
  );

  const priorityClass =
    knownRiskPenalty > 0 || identityReadinessScore < 6
      ? 'P2'
      : priorityScore >= POLICY.priorityP0Threshold
        ? 'P0'
        : 'P1';

  return {
    ...candidate,
    priority_class: priorityClass,
    priority_score: priorityScore,
    category_adopted_count: category.adopted_products,
    category_gap_score: categoryGapScore,
    recommendation_relevance_score: recommendationRelevanceScore,
    identity_readiness_score: identityReadinessScore,
    registry_opportunity_score: registryOpportunityScore,
    evidence_discovery_readiness_score: evidenceDiscoveryReadinessScore,
    known_risk_penalty: knownRiskPenalty,
    candidate_fact_families: [...category.candidate_fact_families],
  };
}

export function buildCatalogExpansionWave1RefreshV2(repoRoot = process.cwd()) {
  const frozen = loadCatalogExpansionRefreshSnapshot(repoRoot);
  const excluded = new Set(POLICY.excludedCategories);
  const categoryMap = new Map(frozen.categories.map((x) => [x.category, x]));

  const scored = frozen.candidates.map((candidate) => {
    const category = categoryMap.get(candidate.category);
    if (!category) throw new Error(`frontier category missing from manifest: ${candidate.category}`);
    return scoreCandidate(candidate, category);
  });

  const selected = [];
  for (const category of frozen.categories) {
    if (excluded.has(category.category) || category.floor_gap <= 0) continue;
    const pool = scored
      .filter((x) => x.category === category.category && x.priority_class !== 'P2')
      .sort(compareCandidatesV2);
    if (pool.length < category.floor_gap) throw new Error(`frontier too small: ${category.category}`);
    selected.push(
      ...pool.slice(0, category.floor_gap).map((x) => ({ ...x, selection_slot: 'floor' })),
    );
  }

  const floorSelectedCount = selected.length;
  const flexSelectedCount = POLICY.batchSize - floorSelectedCount;
  if (flexSelectedCount < 0) throw new Error('floor selection exceeds batch size');

  const selectedIds = new Set(selected.map((x) => x.product_id));
  const flexPool = scored
    .filter((x) => !selectedIds.has(x.product_id) && !excluded.has(x.category) && x.priority_class !== 'P2')
    .sort(compareCandidatesV2);

  if (flexPool.length < flexSelectedCount) throw new Error('frontier too small for flex slots');
  selected.push(
    ...flexPool.slice(0, flexSelectedCount).map((x) => ({ ...x, selection_slot: 'flex' })),
  );

  const selectedProducts = selected.map((x) => ({
    product_id: x.product_id,
    brand: x.brand,
    name: x.name,
    category: x.category,
    selection_slot: x.selection_slot,
    priority_class: x.priority_class,
    priority_score: x.priority_score,
    category_gap_score: x.category_gap_score,
    recommendation_relevance_score: x.recommendation_relevance_score,
    identity_readiness_score: x.identity_readiness_score,
    registry_opportunity_score: x.registry_opportunity_score,
    evidence_discovery_readiness_score: x.evidence_discovery_readiness_score,
    known_risk_penalty: x.known_risk_penalty,
    recommendation_events: x.recommendation_events,
    top_picks: x.top_picks,
    subject_creation_required_tasks: x.subject_creation_required_tasks,
    candidate_fact_families: x.candidate_fact_families,
  }));

  const allocation = {};
  for (const x of selectedProducts) allocation[x.category] = (allocation[x.category] ?? 0) + 1;

  return {
    version: 'coverage-expansion-wave-1-selection-v2',
    stage: POLICY.stage,
    authority: {
      source_main_sha: frozen.manifest.source_main_sha,
      snapshot_captured_at: frozen.manifest.captured_at,
      registry_version: frozen.manifest.registry_version,
      registry_digest_sha256: frozen.manifest.registry_digest_sha256,
      selection_policy_version: POLICY.version,
      candidate_pool_count: frozen.manifest.candidate_pool_count,
      candidate_pool_digest_sha256: frozen.manifest.candidate_pool_digest_sha256,
    },
    catalog_snapshot: {
      catalog_product_count: frozen.manifest.catalog_product_count,
      adopted_product_count: frozen.manifest.adopted_product_count,
      adopted_current_fact_count: frozen.manifest.adopted_current_fact_count,
      uncategorized: frozen.manifest.exclusions.uncategorized,
      sunscreen: frozen.manifest.exclusions.sunscreen,
    },
    selection_policy: {
      target_floor: POLICY.targetFloor,
      batch_size: POLICY.batchSize,
      floor_selected_count: floorSelectedCount,
      flex_selected_count: flexSelectedCount,
      selected_by_category: allocation,
      tie_break: POLICY.tieBreak,
    },
    selected_products: selectedProducts,
    selected_product_ids: selectedProducts.map((x) => x.product_id),
    invariants: {
      hosted_product_fact_writes: 0,
      hosted_subject_writes: 0,
      hosted_evidence_writes: 0,
      external_product_evidence_research: 0,
      missing_implies_false: false,
      recommendation_activation_changed: false,
      production_cutover_authorized: false,
      public_activation: false,
    },
    decision: 'V21_8F_R1_CATALOG_EXPANSION_PLANNING_REFRESH_PASS',
    next_gate: 'V2.1-8G_RESEARCH_EXACT_SELECTED_12_ONLY',
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  process.stdout.write(JSON.stringify(buildCatalogExpansionWave1RefreshV2(), null, 2) + '\n');
}
