#!/usr/bin/env node

import dotenv from "dotenv";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  resolveProductIdentities,
  type IdentityCandidateRecord,
  type IdentityProductRecord,
  type IdentityResolutionResult,
  type IdentitySourceBindingRecord,
} from "./lib/identity-resolution.js";
import { createServiceRoleClient } from "./lib/supabase.js";

const DEFAULT_LIMIT = 500;

interface ReportOptions {
  limit: number;
  candidateId: string | null;
  details: boolean;
}

interface CandidateRow extends IdentityCandidateRecord {
  identity_resolution_state?: string | null;
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

function parseArgs(argv: string[]): ReportOptions {
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
    candidateId: optionMap.get("candidate-id")?.trim() || null,
    details: optionMap.has("details"),
  };
}

async function loadCandidates(options: ReportOptions): Promise<CandidateRow[]> {
  const client = createServiceRoleClient();
  let query = client
    .from("product_candidates")
    .select(
      "id, source_name, external_type, external_id, brand_name_raw, product_name_raw, canonical_brand, canonical_name, category_path, identity_resolution_state",
    )
    .order("created_at", { ascending: true });

  if (options.candidateId) {
    query = query.eq("id", options.candidateId);
  }

  const { data, error } = await query.limit(options.limit);

  if (error) {
    throw new Error(`identity_resolution_candidate_load_failed:${error.message}`);
  }

  return (data ?? []) as CandidateRow[];
}

async function loadProducts(): Promise<IdentityProductRecord[]> {
  const client = createServiceRoleClient();
  const { data, error } = await client
    .from("products")
    .select(
      "id, brand, name, brand_en, name_en, normalized_brand, normalized_name, category, external_source, external_type, external_id",
    )
    .limit(2000);

  if (error) {
    throw new Error(`identity_resolution_product_load_failed:${error.message}`);
  }

  return (data ?? []) as IdentityProductRecord[];
}

async function loadSourceBindings(): Promise<IdentitySourceBindingRecord[]> {
  const client = createServiceRoleClient();
  const { data, error } = await client
    .from("product_source_bindings")
    .select("product_id, source_name, external_type, external_id, binding_state")
    .eq("binding_state", "resolved")
    .limit(10000);

  if (error) {
    throw new Error(`identity_resolution_source_binding_load_failed:${error.message}`);
  }

  return (data ?? []) as IdentitySourceBindingRecord[];
}

function countBy<T extends string>(values: T[]): Map<T, number> {
  const counts = new Map<T, number>();

  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return counts;
}

function formatSuggestion(result: IdentityResolutionResult): string {
  if (result.suggestions.length === 0) {
    return "-";
  }

  return result.suggestions
    .map(
      (suggestion) =>
        `${suggestion.productId}:${suggestion.identitySource}:${suggestion.score.toFixed(2)}`,
    )
    .join("|");
}

function printSummary(
  candidates: CandidateRow[],
  products: IdentityProductRecord[],
  sourceBindings: IdentitySourceBindingRecord[],
  results: IdentityResolutionResult[],
): void {
  const stateCounts = countBy(results.map((result) => result.state));
  const methodCounts = countBy(
    results
      .map((result) => result.method)
      .filter((method): method is NonNullable<IdentityResolutionResult["method"]> => Boolean(method)),
  );

  console.log("Product identity resolution report");
  console.log(`- candidates: ${candidates.length}`);
  console.log(`- products: ${products.length}`);
  console.log(`- source_bindings: ${sourceBindings.length}`);
  console.log(`- resolved: ${stateCounts.get("resolved") ?? 0}`);
  console.log(`- identity_ambiguous: ${stateCounts.get("identity_ambiguous") ?? 0}`);
  console.log(`- unresolved: ${stateCounts.get("unresolved") ?? 0}`);
  console.log(`- external_id_exact: ${methodCounts.get("external_id_exact") ?? 0}`);
  console.log(`- localized_exact: ${methodCounts.get("localized_exact") ?? 0}`);
  console.log(`- english_exact: ${methodCounts.get("english_exact") ?? 0}`);
  console.log("- candidate_writes: 0");
  console.log("- product_writes: 0");
}

function printDetails(candidates: CandidateRow[], results: IdentityResolutionResult[]): void {
  const candidateById = new Map(candidates.map((candidate) => [candidate.id, candidate]));

  console.log("");
  console.log("Resolution details");

  for (const result of results) {
    const candidate = candidateById.get(result.candidateId);
    const shouldPrint =
      result.state !== "unresolved" ||
      result.blockers.length > 0 ||
      result.suggestions.length > 0;

    if (!shouldPrint) {
      continue;
    }

    console.log(
      [
        `candidate=${result.candidateId}`,
        `current=${candidate?.identity_resolution_state ?? "-"}`,
        `proposed=${result.state}`,
        `product=${result.productId ?? "-"}`,
        `method=${result.method ?? "-"}`,
        `blockers=${result.blockers.join("|") || "-"}`,
        `suggestions=${formatSuggestion(result)}`,
      ].join(" "),
    );
  }
}

async function main(): Promise<void> {
  loadEnvironment();
  const options = parseArgs(process.argv.slice(2));
  const [candidates, products, sourceBindings] = await Promise.all([
    loadCandidates(options),
    loadProducts(),
    loadSourceBindings(),
  ]);

  if (candidates.length === 0) {
    throw new Error("identity_resolution_no_candidates");
  }

  const results = resolveProductIdentities(candidates, products, sourceBindings);
  printSummary(candidates, products, sourceBindings, results);

  if (options.details || options.candidateId) {
    printDetails(candidates, results);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
