import dotenv from "dotenv";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  createServiceRoleClient,
  listProductsForEnrichment,
  updateProductDetailsIfMissing,
  type ProductDetailUpdateInput,
} from "./lib/supabase.js";

const DEFAULT_LIMIT = 10;

interface EnrichProductsOptions {
  id?: string;
  limit?: number;
  payloadPath?: string;
  buyLink?: string;
  imageUrl?: string;
  priceMin?: number;
  priceMax?: number;
  knownSourceUrl?: string;
  sourceEvidence?: string;
}

interface ManualEnrichmentPayload {
  id?: string;
  buy_link?: string | null;
  image_url?: string | null;
  price_min?: number | null;
  price_max?: number | null;
  known_source_url?: string | null;
  source_evidence?: unknown;
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

function parseOptionalNumber(rawValue: string | undefined): number | undefined {
  if (typeof rawValue !== "string" || rawValue.trim().length === 0) {
    return undefined;
  }

  const parsedValue = Number.parseFloat(rawValue);
  return Number.isFinite(parsedValue) ? parsedValue : undefined;
}

function parseArgs(argv: string[]): EnrichProductsOptions {
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
    id: optionMap.get("id")?.trim() || undefined,
    limit: Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : undefined,
    payloadPath: optionMap.get("payload")?.trim() || undefined,
    buyLink: optionMap.get("buy-link")?.trim() || undefined,
    imageUrl: optionMap.get("image-url")?.trim() || undefined,
    priceMin: parseOptionalNumber(optionMap.get("price-min")),
    priceMax: parseOptionalNumber(optionMap.get("price-max")),
    knownSourceUrl: optionMap.get("known-source-url")?.trim() || undefined,
    sourceEvidence: optionMap.get("source-evidence")?.trim() || undefined,
  };
}

function hasInlinePatch(options: EnrichProductsOptions): boolean {
  return (
    typeof options.buyLink === "string" ||
    typeof options.imageUrl === "string" ||
    typeof options.priceMin === "number" ||
    typeof options.priceMax === "number"
  );
}

function hasInlineProvenance(options: EnrichProductsOptions): boolean {
  return typeof options.knownSourceUrl === "string" || typeof options.sourceEvidence === "string";
}

function formatScalar(value: string | number | null | undefined): string {
  if (typeof value === "number") {
    return String(value);
  }

  if (typeof value === "string") {
    return value;
  }

  return "";
}

function formatEvidence(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (value === null || value === undefined) {
    return "";
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function getRequestedPatch(payload: ManualEnrichmentPayload): ProductDetailUpdateInput {
  return {
    buy_link: payload.buy_link,
    image_url: payload.image_url,
    price_min: payload.price_min,
    price_max: payload.price_max,
  };
}

async function loadPayloadFile(
  payloadPath: string,
  fallbackId?: string,
): Promise<Map<string, ManualEnrichmentPayload>> {
  const resolvedPath = path.resolve(process.cwd(), payloadPath);
  const rawContent = await fs.readFile(resolvedPath, "utf8");
  const parsedValue = JSON.parse(rawContent) as unknown;
  const rows = Array.isArray(parsedValue) ? parsedValue : [parsedValue];
  const normalizedRows = new Map<string, ManualEnrichmentPayload>();

  for (const row of rows) {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      throw new Error(`Invalid payload row in ${resolvedPath}. Each row must be a JSON object.`);
    }

    const payload = row as ManualEnrichmentPayload;
    const resolvedId = payload.id?.trim() || fallbackId;

    if (!resolvedId) {
      throw new Error(
        `Invalid payload row in ${resolvedPath}. Each row must include id, or use --id with a single payload object.`,
      );
    }

    normalizedRows.set(resolvedId, {
      ...payload,
      id: resolvedId,
    });
  }

  return normalizedRows;
}

function buildInlinePayload(options: EnrichProductsOptions): ManualEnrichmentPayload {
  if (!options.id) {
    throw new Error("Inline enrich updates require --id.");
  }

  return {
    id: options.id,
    buy_link: options.buyLink ?? null,
    image_url: options.imageUrl ?? null,
    price_min: options.priceMin ?? null,
    price_max: options.priceMax ?? null,
    known_source_url: options.knownSourceUrl ?? null,
    source_evidence: options.sourceEvidence ?? null,
  };
}

function mergePayloads(
  basePayload: ManualEnrichmentPayload | undefined,
  overridePayload: ManualEnrichmentPayload | undefined,
): ManualEnrichmentPayload | undefined {
  if (!basePayload && !overridePayload) {
    return undefined;
  }

  return {
    ...basePayload,
    ...overridePayload,
    id: overridePayload?.id ?? basePayload?.id,
  };
}

async function resolveTargetProductIds(options: EnrichProductsOptions): Promise<string[]> {
  if (options.id) {
    return [options.id];
  }

  const client = createServiceRoleClient();
  const queue = await listProductsForEnrichment(client, {
    limit: options.limit ?? DEFAULT_LIMIT,
  });

  return queue.map((row) => row.id);
}

function validateOptions(options: EnrichProductsOptions): void {
  if (!options.id && !options.limit) {
    throw new Error("Provide either --id=<product-id> or --limit=<n>.");
  }

  if (!options.id && hasInlinePatch(options)) {
    throw new Error("Inline field updates require --id. Use --payload=<file.json> for limit-based batch updates.");
  }

  if (!options.id && hasInlineProvenance(options)) {
    throw new Error("Inline provenance flags require --id. Use --payload=<file.json> for limit-based batch updates.");
  }

  if (options.id && !options.payloadPath && !hasInlinePatch(options)) {
    throw new Error(
      "Provide manual enrich values with --payload=<file.json> or with direct flags like --buy-link / --image-url / --price-min / --price-max.",
    );
  }

  if (!options.id && !options.payloadPath) {
    throw new Error("Limit-based enrich runs require --payload=<file.json>.");
  }
}

async function buildPayloadMap(options: EnrichProductsOptions): Promise<Map<string, ManualEnrichmentPayload>> {
  const payloadFromFile = options.payloadPath ? await loadPayloadFile(options.payloadPath, options.id) : new Map();
  const inlinePayload = hasInlinePatch(options) || hasInlineProvenance(options) ? buildInlinePayload(options) : null;

  if (!inlinePayload) {
    return payloadFromFile;
  }

  const mergedPayloads = new Map(payloadFromFile);
  const existingPayload = mergedPayloads.get(inlinePayload.id ?? "");
  const mergedPayload = mergePayloads(existingPayload, inlinePayload);

  if (mergedPayload?.id) {
    mergedPayloads.set(mergedPayload.id, mergedPayload);
  }

  return mergedPayloads;
}

async function run(): Promise<void> {
  loadEnvironment();

  const options = parseArgs(process.argv.slice(2));
  validateOptions(options);

  const client = createServiceRoleClient();
  const targetIds = await resolveTargetProductIds(options);

  if (targetIds.length === 0) {
    console.log("No products are currently waiting for enrichment.");
    return;
  }

  const payloadById = await buildPayloadMap(options);
  const selectedPayloadIds = new Set(targetIds);
  const ignoredPayloadIds = Array.from(payloadById.keys()).filter((payloadId) => !selectedPayloadIds.has(payloadId));

  if (!options.id && ignoredPayloadIds.length > 0) {
    console.log(
      `Ignoring ${ignoredPayloadIds.length} payload row(s) outside the selected enrich queue window: ${ignoredPayloadIds.join(", ")}`,
    );
  }

  let updatedCount = 0;
  let skippedCount = 0;

  for (let index = 0; index < targetIds.length; index += 1) {
    const productId = targetIds[index];
    const payload = payloadById.get(productId);

    if (!payload) {
      console.log(`[${index + 1}/${targetIds.length}] Skipping ${productId}: no manual payload provided.`);
      skippedCount += 1;
      continue;
    }

    console.log("");
    console.log(`[${index + 1}/${targetIds.length}] Enriching ${productId}`);

    if (payload.known_source_url) {
      console.log(`- known_source_url: ${payload.known_source_url}`);
    }

    if (payload.source_evidence !== undefined && payload.source_evidence !== null) {
      console.log(`- source_evidence: ${formatEvidence(payload.source_evidence)}`);
    }

    const requestedPatch = getRequestedPatch(payload);
    const result = await updateProductDetailsIfMissing(client, productId, requestedPatch);

    console.log(
      `- before: buy_link=${formatScalar(result.before.buy_link)} | image_url=${formatScalar(result.before.image_url)} | price_min=${formatScalar(result.before.price_min)} | price_max=${formatScalar(result.before.price_max)}`,
    );
    console.log(
      `- requested: buy_link=${formatScalar(requestedPatch.buy_link)} | image_url=${formatScalar(requestedPatch.image_url)} | price_min=${formatScalar(requestedPatch.price_min)} | price_max=${formatScalar(requestedPatch.price_max)}`,
    );
    console.log(`- applied: ${result.applied_fields.length > 0 ? result.applied_fields.join(", ") : "none"}`);
    console.log(`- skipped: ${result.skipped_fields.length > 0 ? result.skipped_fields.join(", ") : "none"}`);
    console.log(
      `- after: buy_link=${formatScalar(result.after.buy_link)} | image_url=${formatScalar(result.after.image_url)} | price_min=${formatScalar(result.after.price_min)} | price_max=${formatScalar(result.after.price_max)}`,
    );

    if (result.applied_fields.length > 0) {
      updatedCount += 1;
    } else {
      skippedCount += 1;
    }
  }

  console.log("");
  console.log("Enrich products summary");
  console.log(`- selected: ${targetIds.length}`);
  console.log(`- updated: ${updatedCount}`);
  console.log(`- skipped: ${skippedCount}`);
}

run().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
