import dotenv from "dotenv";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  type ApprovedCandidateRecord,
  createServiceRoleClient,
  getApprovedCandidates,
  promoteApprovedCandidate,
} from "./lib/supabase.js";

const DEFAULT_LIMIT = 100;
const DEFAULT_ACTOR = "crawler/promote-approved";

interface PromoteOptions {
  limit: number;
  dryRun: boolean;
  actor: string;
  candidateId?: string;
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

function parseArgs(argv: string[]): PromoteOptions {
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
    actor: optionMap.get("actor")?.trim() || DEFAULT_ACTOR,
    candidateId: optionMap.get("candidate-id")?.trim() || undefined,
  };
}

function formatCandidateLabel(candidate: ApprovedCandidateRecord): string {
  return `${candidate.id} -> ${candidate.canonical_brand ?? "unknown brand"} / ${candidate.canonical_name ?? "unknown product"}`;
}

async function run(): Promise<void> {
  loadEnvironment();

  const options = parseArgs(process.argv.slice(2));
  const client = createServiceRoleClient();
  const approvedCandidates = await getApprovedCandidates(client, options.limit, options.candidateId);

  if (approvedCandidates.length === 0) {
    console.log("No approved candidates are waiting for promotion.");
    return;
  }

  console.log(`Loaded ${approvedCandidates.length} approved candidates.`);

  if (options.dryRun) {
    for (const candidate of approvedCandidates) {
      console.log(
        `[dry-run] ${formatCandidateLabel(candidate)} (review_status=${candidate.review_status ?? "unknown"}, reviewed_at=${candidate.reviewed_at ?? "null"})`,
      );
    }

    return;
  }

  let insertedCount = 0;
  let mergedCount = 0;
  let blockedCount = 0;
  let alreadyPromotedCount = 0;

  for (const candidate of approvedCandidates) {
    console.log(
      `[promote] starting ${formatCandidateLabel(candidate)} (review_status_before=${candidate.review_status ?? "unknown"}, reviewed_at=${candidate.reviewed_at ?? "null"})`,
    );

    try {
      const result = await promoteApprovedCandidate(client, candidate.id, options.actor);

      console.log(`[promote] rpc response ${candidate.id}: ${JSON.stringify(result)}`);

      if (result.action === "inserted") {
        insertedCount += 1;
      } else if (result.action === "merged") {
        mergedCount += 1;
      } else if (result.action === "blocked") {
        blockedCount += 1;
      } else if (result.action === "already_promoted") {
        alreadyPromotedCount += 1;
      }
    } catch (error) {
      const message = error instanceof Error ? error.stack ?? error.message : String(error);
      console.error(`[promote] failed ${candidate.id}: ${message}`);
      throw error;
    }
  }

  console.log("");
  console.log("Promotion summary");
  console.log(`- processed: ${approvedCandidates.length}`);
  console.log(`- inserted: ${insertedCount}`);
  console.log(`- merged: ${mergedCount}`);
  console.log(`- blocked: ${blockedCount}`);
  console.log(`- already_promoted: ${alreadyPromotedCount}`);
}

run().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
