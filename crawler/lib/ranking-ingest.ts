import { normalizeBrandName, normalizeProductName } from "./normalize.js";
import type { RankingJobConfig } from "./ranking-config.js";
import type { RankingSnapshotItem } from "./snapshot.js";

export interface CandidateObservation {
  sourceName: string;
  categoryPath: string;
  productNameRaw: string;
  brandNameRaw: string;
  normalizedName: string;
  normalizedBrand: string;
  externalType: string | null;
  externalId: string | null;
  sourceUrl: string;
  latestPrice: number | null;
  latestRawSource: Record<string, unknown>;
  observedAt: string;
}

export interface CandidateState {
  id: string;
  sourceName: string;
  categoryPath: string;
  normalizedName: string;
  normalizedBrand: string;
  externalType: string | null;
  externalId: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  seenCount: number;
}

export interface CandidateObservationResult {
  state: CandidateState | null;
  action: "inserted" | "reobserved" | "pending_collision";
}

export interface InMemoryCandidateStore {
  candidates: CandidateState[];
}

export interface RankingSnapshotIngestPayload {
  ingestKey: string;
  snapshotHash: string;
  job: RankingJobConfig;
  sourceUrl: string;
  collectedAt: string;
  collectorVersion: string;
  rawPayload: unknown;
  items: RankingSnapshotItem[];
}

export interface InMemoryRankingSnapshotState {
  id: string;
  ingestKey: string;
  snapshotHash: string;
  jobId: string;
  source: string;
  sourceUrl: string;
  collectedAt: string;
  collectorVersion: string;
  status: "ingested";
}

export interface InMemorySourceRankingState {
  snapshotId: string;
  rankPosition: number;
  candidateId: string | null;
}

export interface InMemoryRankingIngestStore extends InMemoryCandidateStore {
  snapshots: InMemoryRankingSnapshotState[];
  sourceRankings: InMemorySourceRankingState[];
}

export interface RankingIngestContractResult {
  snapshotId: string;
  snapshotCreated: boolean;
  sourceRankingsInserted: number;
  sourceRankingsSkipped: number;
  candidatesInserted: number;
  candidatesReobserved: number;
  pendingIdentityCount: number;
  productsWritten: 0;
}

export const ALLOWED_PHASE1_RANKING_CATEGORIES = new Set([
  "cleanser",
  "toner_essence",
  "toner_pad",
  "treatment",
  "moisturizer",
  "moisturizer_lotion_emulsion",
  "moisturizer_gel",
  "moisturizer_cream",
  "moisturizer_balm",
  "sunscreen",
]);

export function buildCandidateObservation(
  sourceName: string,
  categoryPath: string,
  item: RankingSnapshotItem,
  observedAt: string,
): CandidateObservation {
  return {
    sourceName,
    categoryPath,
    productNameRaw: item.productName,
    brandNameRaw: item.brandName,
    normalizedName: normalizeProductName(item.productName),
    normalizedBrand: normalizeBrandName(item.brandName),
    externalType: item.externalType?.trim() || null,
    externalId: item.externalId?.trim() || null,
    sourceUrl: item.sourceUrl,
    latestPrice: item.price,
    latestRawSource: item.rawItem,
    observedAt,
  };
}

export function candidateIdentityKey(observation: CandidateObservation): string {
  if (!observation.externalType || !observation.externalId) {
    throw new Error("ranking_ingest_missing_external_identity");
  }

  return [
    "external",
    observation.sourceName,
    observation.externalType,
    observation.externalId,
  ].join("::");
}

export function candidateIdentityKeyForItem(
  sourceName: string,
  item: RankingSnapshotItem,
): string {
  const observation = buildCandidateObservation(sourceName, "", item, new Date(0).toISOString());
  return candidateIdentityKey(observation);
}

function assertNonEmptyText(value: unknown, label: string, index: number): void {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`ranking_ingest_invalid_item:${label}:index_${index}`);
  }
}

function assertNullableFiniteNumber(value: unknown, label: string, index: number): void {
  if (value !== null && (typeof value !== "number" || !Number.isFinite(value))) {
    throw new Error(`ranking_ingest_invalid_item:${label}:index_${index}`);
  }
}

export function validateRankingSnapshotIngestPayload(payload: RankingSnapshotIngestPayload): void {
  assertNonEmptyText(payload.ingestKey, "ingest_key", -1);
  assertNonEmptyText(payload.snapshotHash, "snapshot_hash", -1);
  assertNonEmptyText(payload.job.id, "job_id", -1);
  assertNonEmptyText(payload.job.source, "source", -1);
  assertNonEmptyText(payload.job.serviceCategory, "service_category", -1);
  assertNonEmptyText(payload.job.rankingScope, "ranking_scope", -1);
  assertNonEmptyText(payload.job.rankingFilter, "ranking_filter", -1);
  assertNonEmptyText(payload.sourceUrl, "source_url", -1);
  assertNonEmptyText(payload.collectedAt, "collected_at", -1);
  assertNonEmptyText(payload.collectorVersion, "collector_version", -1);

  if (!ALLOWED_PHASE1_RANKING_CATEGORIES.has(payload.job.serviceCategory)) {
    throw new Error(`ranking_ingest_invalid_service_category:${payload.job.serviceCategory}`);
  }

  const rankPositions = new Set<number>();
  const candidateIdentityKeys = new Set<string>();

  for (const [index, item] of payload.items.entries()) {
    if (!Number.isInteger(item.rankPosition) || item.rankPosition <= 0) {
      throw new Error(`ranking_ingest_duplicate_or_invalid_rank_position:index_${index}`);
    }

    if (rankPositions.has(item.rankPosition)) {
      throw new Error(`ranking_ingest_duplicate_rank_position:${item.rankPosition}`);
    }

    rankPositions.add(item.rankPosition);
    assertNonEmptyText(item.productName, "product_name", index);
    assertNonEmptyText(item.brandName, "brand_name", index);
    assertNonEmptyText(item.sourceUrl, "source_url", index);
    assertNullableFiniteNumber(item.rating, "rating", index);
    assertNullableFiniteNumber(item.reviewCount, "review_count", index);
    assertNullableFiniteNumber(item.price, "price", index);

    if (!item.externalType || !item.externalId || item.externalType.trim().length === 0 || item.externalId.trim().length === 0) {
      throw new Error(`ranking_ingest_missing_external_identity:index_${index}`);
    }

    if (!item.rawItem || typeof item.rawItem !== "object" || Array.isArray(item.rawItem)) {
      throw new Error(`ranking_ingest_invalid_item:raw_item:index_${index}`);
    }

    const candidateKey = candidateIdentityKeyForItem(payload.job.source, item);

    if (candidateIdentityKeys.has(candidateKey)) {
      throw new Error(`ranking_ingest_duplicate_candidate_identity:${candidateKey}`);
    }

    candidateIdentityKeys.add(candidateKey);
  }
}

export function observeCandidateInMemory(
  store: InMemoryCandidateStore,
  observation: CandidateObservation,
): CandidateObservationResult {
  const matches = store.candidates.filter(
    (candidate) =>
      candidate.sourceName === observation.sourceName &&
      candidate.externalType === observation.externalType &&
      candidate.externalId === observation.externalId,
  );

  if (matches.length > 1) {
    return {
      state: null,
      action: "pending_collision",
    };
  }

  if (matches.length === 1) {
    const [candidate] = matches;
    candidate.lastSeenAt = observation.observedAt;
    candidate.seenCount += 1;

    return {
      state: candidate,
      action: "reobserved",
    };
  }

  const inserted: CandidateState = {
    id: `candidate-${store.candidates.length + 1}`,
    sourceName: observation.sourceName,
    categoryPath: observation.categoryPath,
    normalizedName: observation.normalizedName,
    normalizedBrand: observation.normalizedBrand,
    externalType: observation.externalType,
    externalId: observation.externalId,
    firstSeenAt: observation.observedAt,
    lastSeenAt: observation.observedAt,
    seenCount: 1,
  };

  store.candidates.push(inserted);

  return {
    state: inserted,
    action: "inserted",
  };
}

export function ingestRankingSnapshotInMemory(
  store: InMemoryRankingIngestStore,
  payload: RankingSnapshotIngestPayload,
): RankingIngestContractResult {
  validateRankingSnapshotIngestPayload(payload);

  const existingSnapshot = store.snapshots.find((snapshot) => snapshot.ingestKey === payload.ingestKey);

  if (existingSnapshot) {
    if (
      existingSnapshot.snapshotHash !== payload.snapshotHash ||
      existingSnapshot.jobId !== payload.job.id ||
      existingSnapshot.source !== payload.job.source ||
      existingSnapshot.sourceUrl !== payload.sourceUrl ||
      existingSnapshot.collectedAt !== payload.collectedAt ||
      existingSnapshot.collectorVersion !== payload.collectorVersion
    ) {
      throw new Error("ranking_ingest_ingest_key_conflict");
    }

    return {
      snapshotId: existingSnapshot.id,
      snapshotCreated: false,
      sourceRankingsInserted: 0,
      sourceRankingsSkipped: payload.items.length,
      candidatesInserted: 0,
      candidatesReobserved: 0,
      pendingIdentityCount: 0,
      productsWritten: 0,
    };
  }

  const snapshotId = `snapshot-${store.snapshots.length + 1}`;
  const stagedCandidates = store.candidates.map((candidate) => ({ ...candidate }));
  const stagedSourceRankings: InMemorySourceRankingState[] = [];
  let candidatesInserted = 0;
  let candidatesReobserved = 0;
  let pendingIdentityCount = 0;

  for (const item of payload.items) {
    const observation = buildCandidateObservation(payload.job.source, payload.job.serviceCategory, item, payload.collectedAt);
    const result = observeCandidateInMemory({ candidates: stagedCandidates }, observation);

    if (result.action === "inserted") {
      candidatesInserted += 1;
    } else if (result.action === "reobserved") {
      candidatesReobserved += 1;
    } else {
      pendingIdentityCount += 1;
    }

    stagedSourceRankings.push({
      snapshotId,
      rankPosition: item.rankPosition,
      candidateId: result.state?.id ?? null,
    });
  }

  const candidateIds = new Set<string>();

  for (const row of stagedSourceRankings) {
    if (row.candidateId && candidateIds.has(row.candidateId)) {
      throw new Error(`ranking_ingest_duplicate_candidate_id:${row.candidateId}`);
    }

    if (row.candidateId) {
      candidateIds.add(row.candidateId);
    }
  }

  store.candidates = stagedCandidates;
  store.snapshots.push({
    id: snapshotId,
    ingestKey: payload.ingestKey,
    snapshotHash: payload.snapshotHash,
    jobId: payload.job.id,
    source: payload.job.source,
    sourceUrl: payload.sourceUrl,
    collectedAt: payload.collectedAt,
    collectorVersion: payload.collectorVersion,
    status: "ingested",
  });
  store.sourceRankings.push(...stagedSourceRankings);

  return {
    snapshotId,
    snapshotCreated: true,
    sourceRankingsInserted: stagedSourceRankings.length,
    sourceRankingsSkipped: 0,
    candidatesInserted,
    candidatesReobserved,
    pendingIdentityCount,
    productsWritten: 0,
  };
}
