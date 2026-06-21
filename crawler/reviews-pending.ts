import dotenv from "dotenv";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  createServiceRoleClient,
  listPendingPromotionReviews,
  type PendingPromotionReviewRow,
} from "./lib/supabase.js";

function loadEnvironment(): void {
  const currentFile = fileURLToPath(import.meta.url);
  const crawlerDirectory = path.dirname(currentFile);
  const workspaceDirectory = path.resolve(crawlerDirectory, "..");

  for (const envFile of [
    path.join(crawlerDirectory, ".env"),
    path.join(crawlerDirectory, ".env.local"),
    path.join(workspaceDirectory, ".env"),
    path.join(workspaceDirectory, ".env.local"),
  ]) {
    dotenv.config({ path: envFile, override: false });
  }
}

function parseLimit(argv: string[]): number {
  const argument = argv.find((value) => value.startsWith("--limit="));
  const parsed = argument ? Number.parseInt(argument.split("=", 2)[1], 10) : 50;

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 50;
}

function formatDate(value: string | null): string {
  return value ?? "-";
}

function summarizeConcernEvidence(evidence: Record<string, unknown>): string {
  const concerns = Array.isArray(evidence.concerns) ? evidence.concerns : [];

  if (concerns.length === 0) {
    return "-";
  }

  return concerns
    .map((entry) => {
      const concern = entry as Record<string, unknown>;

      return [
        String(concern.concern ?? "unknown"),
        `count=${Number(concern.observation_count ?? 0)}`,
        `best=${String(concern.best_rank ?? "-")}`,
        `latest=${String(concern.latest_rank ?? "-")}`,
      ].join(" ");
    })
    .join(" | ");
}

function summarizePopularityEvidence(evidence: Record<string, unknown>): string {
  const popularity = (evidence.popularity ?? {}) as Record<string, unknown>;
  const count = Number(popularity.observation_count ?? 0);

  if (count === 0) {
    return "-";
  }

  return [
    `count=${count}`,
    `best=${String(popularity.best_rank ?? "-")}`,
    `latest=${String(popularity.latest_rank ?? "-")}`,
  ].join(" ");
}

function printReview(review: PendingPromotionReviewRow): void {
  const evidence = review.evidence_snapshot as Record<string, unknown>;

  console.log(`${review.brand_name_raw ?? "-"} / ${review.product_name_raw ?? "-"}`);
  console.log(`  candidate: ${review.candidate_id}`);
  console.log(`  status: ${review.status}`);
  console.log(`  priority: ${review.priority_score}`);
  console.log(`  why queued: ${review.selection_reason || "-"}`);
  console.log(`  concern evidence: ${summarizeConcernEvidence(evidence)}`);
  console.log(`  popularity evidence: ${summarizePopularityEvidence(evidence)}`);
  console.log(`  first queued: ${formatDate(review.first_queued_at)}`);
  console.log(`  last queued: ${formatDate(review.last_queued_at)}`);
  console.log(`  review note: ${review.review_note ?? "-"}`);
}

async function run(): Promise<void> {
  loadEnvironment();

  const client = createServiceRoleClient();
  const reviews = await listPendingPromotionReviews(client, parseLimit(process.argv.slice(2)));

  if (reviews.length === 0) {
    console.log("No queued or reviewing candidate promotion reviews.");
    return;
  }

  for (const [index, review] of reviews.entries()) {
    if (index > 0) {
      console.log("");
    }

    printReview(review);
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
