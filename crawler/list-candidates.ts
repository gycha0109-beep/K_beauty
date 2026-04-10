import dotenv from "dotenv";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import type { ReviewStatus } from "./lib/review.js";
import {
  createServiceRoleClient,
  listProductCandidates,
} from "./lib/supabase.js";

const DEFAULT_LIMIT = 20;
const DEFAULT_STATUSES: ReviewStatus[] = ["needs_review"];
const ALLOWED_STATUSES: ReviewStatus[] = [
  "new",
  "auto_matched",
  "needs_review",
  "approved",
  "promoted",
  "rejected",
];

interface ListCandidatesOptions {
  statuses: ReviewStatus[];
  limit: number;
}

function loadEnvironment(): void {
  const currentFile = fileURLToPath(import.meta.url);
  const crawlerDirectory = path.dirname(currentFile);
  const workspaceDirectory = path.resolve(crawlerDirectory, "..");

  const candidateEnvFiles = [
    path.join(crawlerDirectory, ".env"),
    path.join(crawlerDirectory, ".env.local"),
    path.join(workspaceDirectory, ".env"),
    path.join(workspaceDirectory, ".env.local"),
  ];

  for (const envFile of candidateEnvFiles) {
    dotenv.config({ path: envFile, override: false });
  }
}

function parseStatuses(rawValue: string | undefined): ReviewStatus[] {
  if (!rawValue) {
    return DEFAULT_STATUSES;
  }

  const statuses = rawValue
    .split(",")
    .map((status) => status.trim())
    .filter(Boolean);

  if (statuses.length === 0) {
    return DEFAULT_STATUSES;
  }

  const invalidStatuses = statuses.filter(
    (status): status is string => !ALLOWED_STATUSES.includes(status as ReviewStatus),
  );

  if (invalidStatuses.length > 0) {
    throw new Error(
      `Invalid --status value: ${invalidStatuses.join(", ")}. Allowed values: ${ALLOWED_STATUSES.join(", ")}`,
    );
  }

  return Array.from(new Set(statuses)) as ReviewStatus[];
}

function parseArgs(argv: string[]): ListCandidatesOptions {
  const optionMap = new Map<string, string | undefined>();

  for (const argument of argv) {
    if (!argument.startsWith("--")) {
      continue;
    }

    const [rawKey, rawValue] = argument.slice(2).split("=", 2);
    optionMap.set(rawKey, rawValue);
  }

  const parsedLimit = Number.parseInt(optionMap.get("limit") ?? "", 10);

  return {
    statuses: parseStatuses(optionMap.get("status")),
    limit: Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : DEFAULT_LIMIT,
  };
}

function formatReviewFlags(value: string[] | null): string {
  return Array.isArray(value) && value.length > 0 ? value.join(", ") : "";
}

function formatMatchConfidence(value: number | null): string {
  return typeof value === "number" ? value.toFixed(2) : "";
}

async function run(): Promise<void> {
  loadEnvironment();

  const options = parseArgs(process.argv.slice(2));
  const client = createServiceRoleClient();
  const rows = await listProductCandidates(client, options);

  console.log(`Loaded ${rows.length} candidate(s) for statuses: ${options.statuses.join(", ")}`);

  if (rows.length === 0) {
    return;
  }

  console.table(
    rows.map((row) => ({
      id: row.id,
      source_name: row.source_name ?? "",
      service_category: row.service_category ?? "",
      brand_name_raw: row.brand_name_raw ?? "",
      product_name_raw: row.product_name_raw ?? "",
      canonical_brand: row.canonical_brand ?? "",
      canonical_name: row.canonical_name ?? "",
      review_status: row.review_status ?? "",
      review_flags: formatReviewFlags(row.review_flags),
      match_method: row.match_method ?? "",
      match_confidence: formatMatchConfidence(row.match_confidence),
      matched_product_id: row.matched_product_id ?? "",
      reviewed_by: row.reviewed_by ?? "",
      reviewed_at: row.reviewed_at ?? "",
    })),
  );
}

run().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
