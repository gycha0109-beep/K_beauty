import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_HWAHAE_BASE_URL = "https://www.hwahae.com/en/rankings";

export interface RankingJobConfig {
  id: string;
  source: string;
  sourceCategoryKey: string;
  serviceCategory: string;
  sourceProductForm: string | null;
  rankingScope: string;
  rankingFilter: string;
  sourceConcernKey: string | null;
  canonicalConcerns: string[];
  evidenceType: "popularity" | "concern_relevance";
  limit: number;
  requestedLimit: number;
  enabled: boolean;
  disabledReason: string | null;
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

function getStringField(record: Record<string, unknown>, camelName: string, snakeName: string): unknown {
  return record[camelName] ?? record[snakeName];
}

function optionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeStringArray(value: unknown, fieldName: string): string[] {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error(`Ranking job config field ${fieldName} must be an array of strings.`);
  }

  return Array.from(
    new Set(
      value.map((entry) => {
        if (typeof entry !== "string" || entry.trim().length === 0) {
          throw new Error(`Ranking job config field ${fieldName} must contain only non-empty strings.`);
        }

        return entry.trim();
      }),
    ),
  );
}

function assertEvidenceType(value: unknown): "popularity" | "concern_relevance" {
  if (value === "popularity" || value === "concern_relevance") {
    return value;
  }

  throw new Error("Ranking job config field evidence_type must be popularity or concern_relevance.");
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

  const serviceCategory = assertString(
    getStringField(record, "serviceCategory", "service_category"),
    "service_category",
  );
  const rankingScope = assertString(
    getStringField(record, "rankingScope", "ranking_scope"),
    "ranking_scope",
  );
  const rankingFilter = assertString(
    getStringField(record, "rankingFilter", "ranking_filter"),
    "ranking_filter",
  );
  const limit = assertLimit(record.limit);
  const evidenceType = assertEvidenceType(getStringField(record, "evidenceType", "evidence_type"));

  return {
    id: assertString(record.id, "id"),
    source: assertString(record.source, "source"),
    sourceCategoryKey: assertString(
      getStringField(record, "sourceCategoryKey", "source_category_key"),
      "source_category_key",
    ),
    serviceCategory,
    sourceProductForm: optionalString(getStringField(record, "sourceProductForm", "source_product_form")),
    rankingScope,
    rankingFilter,
    sourceConcernKey: optionalString(getStringField(record, "sourceConcernKey", "source_concern_key")),
    canonicalConcerns: normalizeStringArray(
      getStringField(record, "canonicalConcerns", "canonical_concerns"),
      "canonical_concerns",
    ),
    evidenceType,
    limit,
    requestedLimit: assertLimit(getStringField(record, "requestedLimit", "requested_limit") ?? limit),
    enabled: Boolean(record.enabled),
    disabledReason: optionalString(getStringField(record, "disabledReason", "disabled_reason")),
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
