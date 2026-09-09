#!/usr/bin/env node

import dotenv from "dotenv";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { buildIdentityAdoptionPlan } from "./lib/identity-adoption-plan.js";
import {
  resolveProductIdentities,
  type IdentityCandidateRecord,
  type IdentityProductRecord,
} from "./lib/identity-resolution.js";
import { createServiceRoleClient } from "./lib/supabase.js";

const DEFAULT_LIMIT = 500;

interface ReportOptions {
  limit: number;
  candidateId: string | null;
  details: boolean;
}

interface ProductRow extends IdentityProductRecord {
  product_form?: string | null;
}

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

async function main(): Promise<void> {
  loadEnvironment();
  const options = parseArgs(process.argv.slice(2));
  const client = createServiceRoleClient();

  let candidateQuery = client
    .from("product_candidates")
    .select(
      "id, source_name, external_type, external_id, brand_name_raw, product_name_raw, canonical_brand, canonical_name, category_path",
    )
    .order("created_at", { ascending: true });

  if (options.candidateId) {
    candidateQuery = candidateQuery.eq("id", options.candidateId);
  }

  const [candidateResult, productResult, queueResult] = await Promise.all([
    candidateQuery.limit(options.limit),
    client
      .from("products")
      .select(
        "id, brand, name, brand_en, name_en, normalized_brand, normalized_name, category, product_form, external_source, external_type, external_id",
      )
      .limit(2000),
    client
      .from("candidate_promotion_reviews")
      .select("candidate_id, status")
      .limit(2000),
  ]);

  if (candidateResult.error) {
    throw new Error(`identity_adoption_candidate_load_failed:${candidateResult.error.message}`);
  }
  if (productResult.error) {
    throw new Error(`identity_adoption_product_load_failed:${productResult.error.message}`);
  }
  if (queueResult.error) {
    throw new Error(`identity_adoption_queue_load_failed:${queueResult.error.message}`);
  }

  const candidates = (candidateResult.data ?? []) as IdentityCandidateRecord[];
  const products = (productResult.data ?? []) as ProductRow[];
  const queueStatusByCandidateId = new Map(
    (queueResult.data ?? []).map((row) => [String(row.candidate_id), String(row.status ?? "")]),
  );
  const resolutions = resolveProductIdentities(candidates, products);
  const plans = resolutions.map((resolution) => {
    const candidate = candidates.find((entry) => entry.id === resolution.candidateId);
    if (!candidate) {
      throw new Error(`identity_adoption_candidate_missing:${resolution.candidateId}`);
    }

    return buildIdentityAdoptionPlan(
      candidate,
      products,
      resolution,
      queueStatusByCandidateId.get(candidate.id) ?? null,
    );
  });

  const resolvedCount = resolutions.filter((result) => result.state === "resolved").length;
  const identityRecordReadyCount = plans.filter((plan) => plan.identityRecordReady).length;
  const keyDriftCount = plans.filter(
    (plan) => plan.structuralIdentityState === "blocked_target_identity_key_drift",
  ).length;
  const keyMissingCount = plans.filter(
    (plan) => plan.structuralIdentityState === "blocked_target_identity_key_missing",
  ).length;
  const queueWaitingCount = plans.filter(
    (plan) => plan.structuralIdentityState === "waiting_for_promotion_queue",
  ).length;
  const identitySideReadyCount = plans.filter(
    (plan) => plan.structuralIdentityState === "identity_side_ready",
  ).length;

  console.log("Product identity adoption plan report");
  console.log(`- candidates: ${candidates.length}`);
  console.log(`- products: ${products.length}`);
  console.log(`- resolved_existing_product: ${resolvedCount}`);
  console.log(`- identity_record_ready: ${identityRecordReadyCount}`);
  console.log(`- target_identity_key_drift: ${keyDriftCount}`);
  console.log(`- target_identity_key_missing: ${keyMissingCount}`);
  console.log(`- waiting_for_promotion_queue: ${queueWaitingCount}`);
  console.log(`- structural_identity_side_ready: ${identitySideReadyCount}`);
  console.log("- candidate_writes: 0");
  console.log("- product_writes: 0");
  console.log("- identity_state_writes: 0");

  if (options.details || options.candidateId) {
    console.log("");
    console.log("Resolved candidate details");

    for (const plan of plans.filter((entry) => entry.identityRecordReady)) {
      const resolution = resolutions.find((entry) => entry.candidateId === plan.candidateId);
      console.log(
        [
          `candidate=${plan.candidateId}`,
          `product=${plan.targetProductId ?? "-"}`,
          `method=${resolution?.method ?? "-"}`,
          `canonical_brand=${JSON.stringify(plan.targetCanonicalBrand)}`,
          `canonical_name=${JSON.stringify(plan.targetCanonicalName)}`,
          `key_consistent=${plan.targetIdentityKeys?.consistent ?? false}`,
          `structural_identity=${plan.structuralIdentityState}`,
          `blockers=${plan.blockers.join("|") || "-"}`,
        ].join(" "),
      );
    }
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
