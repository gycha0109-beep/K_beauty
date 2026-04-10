import dotenv from "dotenv";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import type { ReviewStatus } from "./lib/review.js";
import {
  countPromotionFailures,
  createServiceRoleClient,
  listPromotionReportRows,
  type PromotionReportRow,
} from "./lib/supabase.js";

const DEFAULT_LIMIT = 20;
const DEFAULT_HOURS = 24;
const DEFAULT_STATUSES: ReviewStatus[] = ["promoted"];
const ALLOWED_STATUSES: ReviewStatus[] = [
  "new",
  "auto_matched",
  "needs_review",
  "approved",
  "promoted",
  "rejected",
];

interface PromoteReportOptions {
  limit: number;
  hours: number;
  statuses: ReviewStatus[];
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
    .map((value) => value.trim())
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

function parseArgs(argv: string[]): PromoteReportOptions {
  const optionMap = new Map<string, string | undefined>();

  for (const argument of argv) {
    if (!argument.startsWith("--")) {
      continue;
    }

    const [rawKey, rawValue] = argument.slice(2).split("=", 2);
    optionMap.set(rawKey, rawValue);
  }

  const parsedLimit = Number.parseInt(optionMap.get("limit") ?? "", 10);
  const parsedHours = Number.parseInt(optionMap.get("hours") ?? "", 10);

  return {
    limit: Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : DEFAULT_LIMIT,
    hours: Number.isFinite(parsedHours) && parsedHours > 0 ? parsedHours : DEFAULT_HOURS,
    statuses: parseStatuses(optionMap.get("status")),
  };
}

function getReviewedAfterIso(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function extractPromotionResult(row: PromotionReportRow): string {
  const payload = row.promotion_payload;

  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const payloadObject = payload as Record<string, unknown>;
    const promotionResult = payloadObject.promotion_result;

    if (
      promotionResult &&
      typeof promotionResult === "object" &&
      !Array.isArray(promotionResult) &&
      typeof (promotionResult as Record<string, unknown>).result === "string"
    ) {
      return String((promotionResult as Record<string, unknown>).result);
    }

    const metadata = payloadObject.metadata;

    if (
      metadata &&
      typeof metadata === "object" &&
      !Array.isArray(metadata) &&
      typeof (metadata as Record<string, unknown>).promotion_action === "string"
    ) {
      return String((metadata as Record<string, unknown>).promotion_action);
    }
  }

  if (row.duplicate_of_product_id) {
    return "merged";
  }

  if (row.matched_product_id) {
    return "inserted";
  }

  return "unknown";
}

async function run(): Promise<void> {
  loadEnvironment();

  const options = parseArgs(process.argv.slice(2));
  const reviewedAfter = getReviewedAfterIso(options.hours);
  const client = createServiceRoleClient();
  const [rows, failedTotal] = await Promise.all([
    listPromotionReportRows(client, {
      statuses: options.statuses,
      limit: options.limit,
      reviewedAfter,
    }),
    countPromotionFailures(client, {
      reviewedAfter,
    }),
  ]);

  const normalizedRows = rows.map((row) => ({
    ...row,
    promotion_result: extractPromotionResult(row),
  }));

  const promotedTotal = normalizedRows.filter((row) => row.review_status === "promoted").length;
  const insertedTotal = normalizedRows.filter((row) => row.promotion_result === "inserted").length;
  const mergedTotal = normalizedRows.filter((row) => row.promotion_result === "merged").length;

  console.log("Promotion report summary");
  console.log(`- reviewed_after: ${reviewedAfter}`);
  console.log(`- statuses: ${options.statuses.join(", ")}`);
  console.log(`- promoted total: ${promotedTotal}`);
  console.log(`- inserted total: ${insertedTotal}`);
  console.log(`- merged total: ${mergedTotal}`);
  console.log(`- failed total: ${failedTotal}`);

  console.log("");
  console.log(`Promotion report rows (${normalizedRows.length})`);

  if (normalizedRows.length === 0) {
    return;
  }

  console.table(
    normalizedRows.map((row) => ({
      candidate_id: row.candidate_id,
      canonical_brand: row.canonical_brand ?? "",
      canonical_name: row.canonical_name ?? "",
      review_status: row.review_status ?? "",
      matched_product_id: row.matched_product_id ?? "",
      duplicate_of_product_id: row.duplicate_of_product_id ?? "",
      promotion_result: row.promotion_result,
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
