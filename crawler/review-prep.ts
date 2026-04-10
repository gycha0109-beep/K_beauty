import dotenv from "dotenv";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { prepareCandidateReview } from "./lib/review.js";
import {
  createServiceRoleClient,
  ensureReviewWorkflowReady,
  getPendingReviewCandidates,
  listProductsForMatching,
  updateProductCandidateReview,
} from "./lib/supabase.js";

const DEFAULT_LIMIT = 100;

interface ReviewPrepOptions {
  limit: number;
  dryRun: boolean;
}

interface ReviewPrepSummary {
  processed: number;
  autoMatchedCount: number;
  needsReviewCount: number;
  rejectedCount: number;
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

function parseArgs(argv: string[]): ReviewPrepOptions {
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
    limit: Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : DEFAULT_LIMIT,
    dryRun: optionMap.has("dry-run"),
  };
}

function printReviewPrepSummary(summary: ReviewPrepSummary, dryRun: boolean): void {
  console.log("");
  console.log(dryRun ? "Review prep summary (dry-run)" : "Review prep summary");
  console.log(`- processed: ${summary.processed}`);
  console.log(`- auto_matched: ${summary.autoMatchedCount}`);
  console.log(`- needs_review: ${summary.needsReviewCount}`);
  console.log(`- rejected: ${summary.rejectedCount}`);
}

export async function runReviewPrep(inputOptions: Partial<ReviewPrepOptions> = {}): Promise<ReviewPrepSummary> {
  loadEnvironment();

  const options: ReviewPrepOptions = {
    limit: inputOptions.limit ?? DEFAULT_LIMIT,
    dryRun: inputOptions.dryRun ?? false,
  };
  const client = createServiceRoleClient();
  await ensureReviewWorkflowReady(client);
  const [candidates, products] = await Promise.all([
    getPendingReviewCandidates(client, options.limit),
    listProductsForMatching(client),
  ]);

  if (candidates.length === 0) {
    console.log("No new candidates are waiting for review prep.");
    return {
      processed: 0,
      autoMatchedCount: 0,
      needsReviewCount: 0,
      rejectedCount: 0,
    };
  }

  console.log(`Loaded ${candidates.length} candidates and ${products.length} products for matching.`);

  let autoMatchedCount = 0;
  let needsReviewCount = 0;
  let rejectedCount = 0;

  for (const candidate of candidates) {
    const prepared = prepareCandidateReview(candidate, products);

    if (prepared.reviewStatus === "auto_matched") {
      autoMatchedCount += 1;
    } else if (prepared.reviewStatus === "rejected") {
      rejectedCount += 1;
    } else {
      needsReviewCount += 1;
    }

    if (options.dryRun) {
      console.log(
        `[dry-run] ${candidate.id} -> ${prepared.reviewStatus} (${prepared.canonicalBrand} / ${prepared.canonicalName})`,
      );
      continue;
    }

    await updateProductCandidateReview(client, candidate.id, {
      service_category: prepared.serviceCategory,
      canonical_name: prepared.canonicalName,
      canonical_brand: prepared.canonicalBrand,
      matched_product_id: prepared.matchedProductId,
      duplicate_of_product_id: prepared.duplicateOfProductId,
      review_status: prepared.reviewStatus,
      review_notes: prepared.reviewNotes,
      promotion_payload: prepared.promotionPayload,
      match_method: prepared.matchMethod,
      match_confidence: prepared.matchConfidence,
      review_flags: prepared.reviewFlags,
      promotion_version: prepared.promotionVersion,
    });
  }

  const summary: ReviewPrepSummary = {
    processed: candidates.length,
    autoMatchedCount,
    needsReviewCount,
    rejectedCount,
  };

  printReviewPrepSummary(summary, options.dryRun);

  return summary;
}

const isDirectExecution =
  Boolean(process.argv[1]) &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectExecution) {
  runReviewPrep(parseArgs(process.argv.slice(2))).catch((error) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  });
}
