import dotenv from "dotenv";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  createServiceRoleClient,
  setProductCandidateReviewStatus,
} from "./lib/supabase.js";

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

function parseCandidateId(argv: string[]): string {
  for (const argument of argv) {
    if (!argument.startsWith("--id=")) {
      continue;
    }

    const candidateId = argument.slice("--id=".length).trim();

    if (candidateId) {
      return candidateId;
    }
  }

  throw new Error("Missing required argument: --id=<candidate-id>");
}

async function run(): Promise<void> {
  loadEnvironment();

  const candidateId = parseCandidateId(process.argv.slice(2));
  const client = createServiceRoleClient();
  const updatedCandidate = await setProductCandidateReviewStatus(client, candidateId, "approved", "cli");

  console.log("Candidate approved");
  console.log(`- id: ${updatedCandidate.id}`);
  console.log(`- review_status: ${updatedCandidate.review_status}`);
  console.log(`- reviewed_at: ${updatedCandidate.reviewed_at}`);
  console.log(`- reviewed_by: ${updatedCandidate.reviewed_by}`);
  console.log(
    `- product: ${updatedCandidate.canonical_brand ?? updatedCandidate.brand_name_raw ?? "unknown brand"} / ${
      updatedCandidate.canonical_name ?? updatedCandidate.product_name_raw ?? "unknown product"
    }`,
  );
}

run().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
