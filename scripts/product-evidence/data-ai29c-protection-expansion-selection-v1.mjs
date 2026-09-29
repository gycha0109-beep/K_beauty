import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {
  DATA_AI29C_PROTECTION_EXPANSION_POLICY_V1 as POLICY,
  compareProtectionExpansionCandidates,
} from "./data-ai29c-protection-expansion-selection-policy-v1.mjs";

const SNAPSHOT_PATH =
  "evidence/product-fact-catalog-expansion-v1/data-ai29c-protection-expansion-wave-1-snapshot-v1.json";

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isHttps(value) {
  if (!hasText(value)) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function integer(value, fallback = 0) {
  const n = Number(value);
  return Number.isInteger(n) ? n : fallback;
}

export function loadProtectionExpansionSnapshot(repoRoot = process.cwd()) {
  const absolute = path.join(repoRoot, SNAPSHOT_PATH);
  const bytes = fs.readFileSync(absolute);
  const snapshot = JSON.parse(bytes.toString("utf8"));
  if (snapshot.snapshot_version !== "data-ai29c-protection-expansion-wave1-snapshot-v1") {
    throw new Error("DATA-AI29C-C5 snapshot version mismatch");
  }
  if (!Array.isArray(snapshot.candidates)) {
    throw new Error("DATA-AI29C-C5 candidates missing");
  }
  return {
    snapshot,
    snapshot_sha256: sha256(bytes),
  };
}

export function isEligibleProtectionExpansionCandidate(candidate) {
  return candidate?.classification_state === "active_shadow"
    && candidate?.category_term_id === POLICY.categoryTermId
    && candidate?.review_status === "new"
    && candidate?.matched_product_id == null
    && candidate?.duplicate_of_product_id == null
    && candidate?.product_write_allowed === false
    && candidate?.product_promotion_allowed === false
    && candidate?.recommendation_admission_allowed === false
    && hasText(candidate?.normalized_brand)
    && hasText(candidate?.normalized_name)
    && hasText(candidate?.source_name)
    && hasText(candidate?.external_id)
    && isHttps(candidate?.source_url);
}

function discriminationLeadCount(candidate) {
  const leads = candidate?.discovery_leads || {};
  return Number(Boolean(leads.spf_non_50))
    + Number(Boolean(leads.uva_non_pa4))
    + Number(Boolean(leads.water_duration));
}

function leadScore(candidate) {
  const leads = candidate?.discovery_leads || {};
  return (leads.spf_non_50 ? POLICY.weights.spfNon50Lead : 0)
    + (leads.uva_non_pa4 ? POLICY.weights.uvaNonPa4Lead : 0)
    + (leads.water_duration ? POLICY.weights.waterDurationLead : 0)
    + (leads.water_claim_research ? POLICY.weights.waterClaimResearchLead : 0);
}

function recommendationRelevanceScore(candidate) {
  const rank = integer(candidate.best_rank_position, 999999);
  if (rank < 1 || rank > 25) return 0;
  return 26 - rank;
}

function evidenceReadinessScore(candidate) {
  const count = Math.max(0, integer(candidate.source_evidence_count, 0));
  return Math.min(
    POLICY.weights.sourceEvidenceMax,
    count * POLICY.weights.sourceEvidencePerObservation,
  );
}

function identityReadinessScore(candidate) {
  let score = 0;
  if (hasText(candidate.normalized_brand)) score += POLICY.weights.identityComponent;
  if (hasText(candidate.normalized_name)) score += POLICY.weights.identityComponent;
  if (isHttps(candidate.source_url)) score += POLICY.weights.identityComponent;
  if (hasText(candidate.source_name) && hasText(candidate.external_id)) {
    score += POLICY.weights.identityComponent;
  }
  return Math.min(POLICY.weights.identityMax, score);
}

function scoreCandidate(candidate) {
  const lead_score = leadScore(candidate);
  const recommendation_relevance_score = recommendationRelevanceScore(candidate);
  const evidence_readiness_score = evidenceReadinessScore(candidate);
  const identity_readiness_score = identityReadinessScore(candidate);
  const priority_score =
    lead_score
    + recommendation_relevance_score
    + evidence_readiness_score
    + identity_readiness_score;

  const discovery_leads = {
    spf_non_50: Boolean(candidate.discovery_leads?.spf_non_50),
    uva_non_pa4: Boolean(candidate.discovery_leads?.uva_non_pa4),
    water_duration: Boolean(candidate.discovery_leads?.water_duration),
    water_claim_research: Boolean(candidate.discovery_leads?.water_claim_research),
  };

  return {
    candidate_id: candidate.candidate_id,
    source_name: candidate.source_name,
    external_type: candidate.external_type,
    external_id: candidate.external_id,
    source_url: candidate.source_url,
    brand: candidate.brand_name_raw,
    name: candidate.product_name_raw,
    normalized_brand: candidate.normalized_brand,
    normalized_name: candidate.normalized_name,
    best_rank_position: integer(candidate.best_rank_position, 999999),
    source_evidence_count: Math.max(0, integer(candidate.source_evidence_count, 0)),
    discovery_leads,
    discrimination_lead_count: discriminationLeadCount(candidate),
    lead_score,
    recommendation_relevance_score,
    evidence_readiness_score,
    identity_readiness_score,
    priority_score,
    priority_class: discriminationLeadCount(candidate) > 0
      ? "DISCRIMINATION_LEAD"
      : discovery_leads.water_claim_research
        ? "PROTECTION_RESEARCH_LEAD"
        : "FALLBACK_RESEARCH",
  };
}

function selectionReason(candidate, brandCapRelaxed) {
  const leadNames = Object.entries(candidate.discovery_leads)
    .filter(([, value]) => value)
    .map(([key]) => key);
  return [
    `policy=${POLICY.version}`,
    `class=${candidate.priority_class}`,
    `priority_score=${candidate.priority_score}`,
    `best_rank=${candidate.best_rank_position}`,
    `source_evidence_count=${candidate.source_evidence_count}`,
    `discovery_leads=${leadNames.length ? leadNames.join(",") : "none"}`,
    brandCapRelaxed ? "brand_cap=relaxed" : "brand_cap=satisfied",
  ].join("; ");
}

export function buildProtectionExpansionWave1(repoRoot = process.cwd()) {
  const { snapshot, snapshot_sha256 } = loadProtectionExpansionSnapshot(repoRoot);

  if (snapshot.taxonomy_version !== POLICY.taxonomyVersion) {
    throw new Error("DATA-AI29C-C5 taxonomy version mismatch");
  }
  if (snapshot.limits?.productionCutoverAuthorized !== false) {
    throw new Error("DATA-AI29C-C5 Production cutover must remain false");
  }
  if (snapshot.limits?.outdoorRankableSignalAuthorized !== false) {
    throw new Error("DATA-AI29C-C5 outdoor rankable signal must remain false");
  }

  const eligible = snapshot.candidates
    .filter(isEligibleProtectionExpansionCandidate)
    .map(scoreCandidate)
    .sort(compareProtectionExpansionCandidates);

  if (eligible.length < POLICY.waveSize) {
    throw new Error(`DATA-AI29C-C5 eligible pool too small: ${eligible.length}`);
  }

  const selected = [];
  const selectedIds = new Set();
  const brandCounts = new Map();

  for (const candidate of eligible) {
    if (selected.length >= POLICY.waveSize) break;
    const brandCount = brandCounts.get(candidate.normalized_brand) || 0;
    if (brandCount >= POLICY.brandCap) continue;
    brandCounts.set(candidate.normalized_brand, brandCount + 1);
    selectedIds.add(candidate.candidate_id);
    selected.push({
      ...candidate,
      brand_cap_relaxed: false,
      selection_reason: selectionReason(candidate, false),
    });
  }

  let brandCapRelaxationCount = 0;
  while (selected.length < POLICY.waveSize) {
    const candidate = eligible.find((item) => !selectedIds.has(item.candidate_id));
    if (!candidate) {
      throw new Error("DATA-AI29C-C5 wave cannot be filled");
    }
    selectedIds.add(candidate.candidate_id);
    selected.push({
      ...candidate,
      brand_cap_relaxed: true,
      selection_reason: selectionReason(candidate, true),
    });
    brandCapRelaxationCount += 1;
  }

  const selectedProducts = selected
    .sort(compareProtectionExpansionCandidates)
    .map((candidate, index) => ({
      selection_rank: index + 1,
      ...candidate,
    }));

  const deferred = eligible
    .filter((candidate) => !selectedIds.has(candidate.candidate_id))
    .map((candidate) => ({
      candidate_id: candidate.candidate_id,
      brand: candidate.brand,
      name: candidate.name,
      priority_class: candidate.priority_class,
      priority_score: candidate.priority_score,
      disposition: "DEFERRED_WAVE_SIZE",
      reason_codes: ["LOWER_THAN_WAVE_1_CUTOFF"],
    }));

  const excluded = snapshot.candidates
    .filter((candidate) => !isEligibleProtectionExpansionCandidate(candidate))
    .map((candidate) => ({
      candidate_id: candidate.candidate_id,
      brand: candidate.brand_name_raw,
      name: candidate.product_name_raw,
      review_status: candidate.review_status,
      matched_product_id: candidate.matched_product_id,
      duplicate_of_product_id: candidate.duplicate_of_product_id,
      disposition: candidate.review_status === "promoted" && candidate.matched_product_id
        ? "EXCLUDED_ALREADY_PROMOTED"
        : "EXCLUDED_NOT_PLANNING_ELIGIBLE",
    }))
    .sort((a, b) => String(a.candidate_id).localeCompare(String(b.candidate_id), "en"));

  const leadSummary = {
    exact_discrimination_lead_candidates: eligible.filter((candidate) => candidate.discrimination_lead_count > 0).length,
    spf_non_50_lead_candidates: eligible.filter((candidate) => candidate.discovery_leads.spf_non_50).length,
    uva_non_pa4_lead_candidates: eligible.filter((candidate) => candidate.discovery_leads.uva_non_pa4).length,
    water_duration_lead_candidates: eligible.filter((candidate) => candidate.discovery_leads.water_duration).length,
    water_claim_research_lead_candidates: eligible.filter((candidate) => candidate.discovery_leads.water_claim_research).length,
  };

  const mode = leadSummary.exact_discrimination_lead_candidates > 0
    ? "DISCRIMINATION_LEAD_WAVE"
    : "RESEARCH_READINESS_FALLBACK_WAVE";

  return {
    version: "data-ai29c-protection-expansion-wave-1-selection-v1",
    stage: POLICY.stage,
    mode,
    authority: {
      source_main_sha: snapshot.source_main_sha,
      registry_version: snapshot.registry_version,
      taxonomy_version: snapshot.taxonomy_version,
      selection_policy_version: POLICY.version,
      snapshot_sha256,
      candidate_source_authority: false,
    },
    current_protection_corpus: {
      ...snapshot.protection_audit_summary,
      productionCutoverAuthorized: false,
      outdoorRankableSignalAuthorized: false,
    },
    candidate_pool_summary: {
      frozen_candidate_count: snapshot.candidate_pool_count,
      eligible_candidate_count: eligible.length,
      excluded_candidate_count: excluded.length,
      selected_candidate_count: selectedProducts.length,
      deferred_candidate_count: deferred.length,
      ...leadSummary,
    },
    selection_policy: {
      wave_size: POLICY.waveSize,
      brand_cap: POLICY.brandCap,
      scoring: {
        spf_non_50_lead: POLICY.weights.spfNon50Lead,
        uva_non_pa4_lead: POLICY.weights.uvaNonPa4Lead,
        water_duration_lead: POLICY.weights.waterDurationLead,
        water_claim_research_lead: POLICY.weights.waterClaimResearchLead,
        recommendation_relevance: "rank 1..25 => 25..1; otherwise 0",
        source_evidence: "min(10, source_evidence_count * 2)",
        identity_readiness: "normalized brand/name + HTTPS source + source/external id; max 16",
      },
      tie_break: [...POLICY.tieBreak],
      semantics: { ...POLICY.semantics },
    },
    selected_candidates: selectedProducts,
    deferred_candidates: deferred,
    excluded_candidates: excluded,
    invariants: {
      hosted_writes: 0,
      product_promotion_intent: 0,
      product_fact_write_intent: 0,
      recommendation_write_intent: 0,
      production_ranking_changed: false,
      candidate_source_used_as_product_fact_authority: false,
      water_claim_research_lead_used_as_duration_evidence: false,
      brand_cap_relaxation_count: brandCapRelaxationCount,
      runtime_consumption: false,
    },
  };
}

export const DATA_AI29C_PROTECTION_EXPANSION_SNAPSHOT_PATH = SNAPSHOT_PATH;
