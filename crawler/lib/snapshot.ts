import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import type { RankingJobConfig } from "./ranking-config.js";

export interface RankingSnapshotItem {
  rankPosition: number;
  productName: string;
  brandName: string;
  rating: number | null;
  reviewCount: number | null;
  thumbnailUrl: string | null;
  sourceUrl: string;
  price: number | null;
  externalType: string | null;
  externalId: string | null;
  rawItem: Record<string, unknown>;
}

export interface RankingSnapshotPayload {
  job: RankingJobConfig;
  sourceUrl: string;
  collectedAt: string;
  collectorVersion: string;
  rawJsonLd: unknown[];
  items: RankingSnapshotItem[];
}

export interface SavedRankingSnapshot {
  payload: RankingSnapshotPayload;
  snapshotHash: string;
  ingestKey: string;
  filePath: string;
}

function safePathSegment(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "unknown";
}

function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, nestedValue) => {
    if (!nestedValue || typeof nestedValue !== "object" || Array.isArray(nestedValue)) {
      return nestedValue;
    }

    return Object.fromEntries(
      Object.entries(nestedValue as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)),
    );
  });
}

export function buildSnapshotHash(payload: RankingSnapshotPayload): string {
  const contentFingerprint = {
    job: payload.job,
    sourceUrl: payload.sourceUrl,
    collectorVersion: payload.collectorVersion,
    rawJsonLd: payload.rawJsonLd,
    items: payload.items,
  };

  return crypto.createHash("sha256").update(stableJson(contentFingerprint)).digest("hex");
}

export function buildSnapshotIngestKey(payload: RankingSnapshotPayload, snapshotHash = buildSnapshotHash(payload)): string {
  const retryIdentity = {
    jobId: payload.job.id,
    source: payload.job.source,
    sourceUrl: payload.sourceUrl,
    collectedAt: payload.collectedAt,
    collectorVersion: payload.collectorVersion,
    snapshotHash,
  };

  return crypto.createHash("sha256").update(stableJson(retryIdentity)).digest("hex");
}

export async function saveRankingSnapshotFile(
  payload: RankingSnapshotPayload,
  options: {
    workspaceRoot: string;
  },
): Promise<SavedRankingSnapshot> {
  const snapshotHash = buildSnapshotHash(payload);
  const ingestKey = buildSnapshotIngestKey(payload, snapshotHash);
  const collectedDate = new Date(payload.collectedAt);
  const timestamp = Number.isNaN(collectedDate.getTime())
    ? payload.collectedAt.replace(/[^0-9A-Za-z_-]+/g, "_")
    : collectedDate.toISOString().replace(/[:.]/g, "-");
  const directory = path.join(
    options.workspaceRoot,
    "data",
    "hwahae",
    "ranking-snapshots",
    safePathSegment(payload.job.serviceCategory),
    safePathSegment(payload.job.rankingScope),
    safePathSegment(payload.job.rankingFilter),
  );
  const filePath = path.join(directory, `${timestamp}-${snapshotHash.slice(0, 12)}.json`);

  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(
    filePath,
    `${JSON.stringify({ ...payload, snapshotHash, ingestKey }, null, 2)}\n`,
    "utf8",
  );

  return {
    payload,
    snapshotHash,
    ingestKey,
    filePath,
  };
}
