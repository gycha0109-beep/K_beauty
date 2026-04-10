import dotenv from "dotenv";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  createServiceRoleClient,
  listProductsForEnrichment,
} from "./lib/supabase.js";

const DEFAULT_LIMIT = 20;

interface EnrichQueueOptions {
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

function parseArgs(argv: string[]): EnrichQueueOptions {
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
  };
}

async function run(): Promise<void> {
  loadEnvironment();

  const options = parseArgs(process.argv.slice(2));
  const client = createServiceRoleClient();
  const rows = await listProductsForEnrichment(client, {
    limit: options.limit,
  });

  console.log(`Loaded ${rows.length} product(s) for enrich queue. Recent promoted products are prioritized first.`);

  if (rows.length === 0) {
    return;
  }

  console.table(
    rows.map((row) => ({
      id: row.id,
      brand: row.brand ?? "",
      name: row.name ?? "",
      category: row.category ?? "",
      buy_link: row.buy_link ?? "",
      image_url: row.image_url ?? "",
      price_min: row.price_min ?? "",
      price_max: row.price_max ?? "",
      updated_at: row.updated_at ?? "",
    })),
  );
}

run().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
