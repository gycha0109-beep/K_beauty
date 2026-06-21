import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_HWAHAE_BASE_URL = "https://www.hwahae.com/en/rankings";

export interface RankingJobConfig {
  id: string;
  source: string;
  serviceCategory: string;
  rankingScope: string;
  rankingFilter: string;
  limit: number;
  enabled: boolean;
  themeId?: number;
  url?: string;
}

export interface RuntimeJobOptions {
  configPath?: string;
  includeDisabled?: boolean;
  themeIds?: number[] | null;
  maxPages?: number | null;
}

function assertString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Ranking job config field ${fieldName} must be a non-empty string.`);
  }

  return value.trim();
}

function assertLimit(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new Error("Ranking job config field limit must be a positive integer.");
  }

  return value;
}

function normalizeJobConfig(rawJob: unknown): RankingJobConfig {
  if (!rawJob || typeof rawJob !== "object") {
    throw new Error("Ranking job config entries must be objects.");
  }

  const record = rawJob as Record<string, unknown>;
  const themeId = record.themeId;
  const url = record.url;

  if (themeId !== undefined && (typeof themeId !== "number" || !Number.isInteger(themeId))) {
    throw new Error(`Ranking job ${String(record.id)} has invalid themeId.`);
  }

  if (url !== undefined && typeof url !== "string") {
    throw new Error(`Ranking job ${String(record.id)} has invalid url.`);
  }

  return {
    id: assertString(record.id, "id"),
    source: assertString(record.source, "source"),
    serviceCategory: assertString(record.serviceCategory, "serviceCategory"),
    rankingScope: assertString(record.rankingScope, "rankingScope"),
    rankingFilter: assertString(record.rankingFilter, "rankingFilter"),
    limit: assertLimit(record.limit),
    enabled: Boolean(record.enabled),
    ...(themeId !== undefined ? { themeId } : {}),
    ...(typeof url === "string" && url.trim() ? { url: url.trim() } : {}),
  };
}

export function resolveRankingJobUrl(job: RankingJobConfig): string {
  if (job.url) {
    return job.url;
  }

  if (job.source === "hwahae" && typeof job.themeId === "number") {
    return `${DEFAULT_HWAHAE_BASE_URL}?english_name=category&theme_id=${job.themeId}`;
  }

  throw new Error(`Ranking job ${job.id} must define url or a supported source parser option.`);
}

export async function loadRankingJobs(options: RuntimeJobOptions = {}): Promise<RankingJobConfig[]> {
  const configPath = options.configPath
    ? path.resolve(options.configPath)
    : path.resolve("config", "ranking-jobs.json");
  const raw = await fs.readFile(configPath, "utf8");
  const parsed = JSON.parse(raw) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error("Ranking job config must be a JSON array.");
  }

  let jobs = parsed.map(normalizeJobConfig);

  if (!options.includeDisabled) {
    jobs = jobs.filter((job) => job.enabled);
  }

  if (options.themeIds) {
    const themeIdSet = new Set(options.themeIds);
    jobs = jobs.filter((job) => typeof job.themeId === "number" && themeIdSet.has(job.themeId));
  }

  if (options.maxPages !== null && options.maxPages !== undefined) {
    jobs = jobs.slice(0, options.maxPages);
  }

  return jobs;
}
