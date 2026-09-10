#!/usr/bin/env node

import dotenv from "dotenv";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  buildIdentityKeyRepairPlan,
  type IdentityKeyRepairProduct,
} from "./lib/identity-key-repair-plan.js";
import { createServiceRoleClient } from "./lib/supabase.js";

const CONFIRM_TOKEN = "product-identity-key-repair-v1";
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 25;

type Options = {
  actorUserId: string;
  confirm: boolean;
  limit: number;
  productId: string | null;
};

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

function parseArgs(argv: string[]): Options {
  const values = new Map<string, string>();
  for (const argument of argv) {
    if (!argument.startsWith("--")) continue;
    const separator = argument.indexOf("=");
    if (separator < 0) {
      values.set(argument.slice(2), "");
    } else {
      values.set(argument.slice(2, separator), argument.slice(separator + 1));
    }
  }

  const actorUserId = (values.get("actor-user-id") || process.env.ADMIN_ACTOR_USER_ID || "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(actorUserId)) {
    throw new Error("identity_key_repair_actor_user_id_required");
  }

  const rawLimit = values.get("limit")?.trim() || String(DEFAULT_LIMIT);
  const limit = Number(rawLimit);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw new Error(`identity_key_repair_limit_must_be_1_to_${MAX_LIMIT}`);
  }

  const productId = values.get("product-id")?.trim() || null;
  if (productId && !/^[0-9a-f-]{36}$/i.test(productId)) {
    throw new Error("identity_key_repair_product_id_invalid");
  }

  const confirmValue = values.get("confirm");
  if (confirmValue !== undefined && confirmValue !== CONFIRM_TOKEN) {
    throw new Error(`identity_key_repair_confirm_token_required:${CONFIRM_TOKEN}`);
  }

  return {
    actorUserId,
    confirm: confirmValue === CONFIRM_TOKEN,
    limit,
    productId,
  };
}

function deterministicRequestId(productId: string, expectedUpdatedAt: string): string {
  const compactTimestamp = expectedUpdatedAt.replace(/[^0-9TZ]/g, "");
  return `idkey-v1:${productId}:${compactTimestamp}`;
}

async function main(): Promise<void> {
  loadEnvironment();
  const options = parseArgs(process.argv.slice(2));
  const client = createServiceRoleClient();
  const { data, error } = await client
    .from("products")
    .select("id, brand, name, normalized_brand, normalized_name")
    .order("brand", { ascending: true })
    .order("name", { ascending: true })
    .limit(2000);

  if (error) throw new Error(`identity_key_repair_product_load_failed:${error.message}`);

  const plan = buildIdentityKeyRepairPlan((data ?? []) as IdentityKeyRepairProduct[])
    .filter((row) => row.disposition === "safe_mechanical_candidate")
    .filter((row) => !options.productId || row.productId === options.productId)
    .slice(0, options.limit);

  console.log(`Product identity key repair ${options.confirm ? "CONFIRM" : "DRY-RUN"}`);
  console.log(`- selected_safe_candidates: ${plan.length}`);
  console.log(`- max_batch_size: ${MAX_LIMIT}`);

  let confirmed = 0;
  for (const row of plan) {
    const preflight = await client.rpc("admin_preflight_product_identity_key_repair_v1", {
      p_actor_user_id: options.actorUserId,
      p_product_id: row.productId,
    });
    if (preflight.error) {
      throw new Error(`identity_key_repair_preflight_failed:${row.productId}:${preflight.error.message}`);
    }

    const snapshot = preflight.data as Record<string, unknown>;
    if (snapshot.eligible !== true || snapshot.disposition !== "safe_mechanical_candidate") {
      throw new Error(`identity_key_repair_preflight_no_longer_safe:${row.productId}:${String(snapshot.disposition)}`);
    }

    const expectedBrand = String(snapshot.expected_normalized_brand ?? "");
    const expectedName = String(snapshot.expected_normalized_name ?? "");
    const expectedUpdatedAt = String(snapshot.expected_updated_at ?? "");
    const proposedBrand = String(snapshot.proposed_normalized_brand ?? "");
    const proposedName = String(snapshot.proposed_normalized_name ?? "");

    console.log(
      `product=${row.productId} old=${JSON.stringify(expectedName)} new=${JSON.stringify(proposedName)} mode=${options.confirm ? "confirm" : "dry-run"}`,
    );

    if (!options.confirm) continue;

    const requestId = deterministicRequestId(row.productId, expectedUpdatedAt);
    const confirmation = await client.rpc("admin_confirm_product_identity_key_repair_v1", {
      p_actor_user_id: options.actorUserId,
      p_request_id: requestId,
      p_product_id: row.productId,
      p_expected_normalized_brand: expectedBrand,
      p_expected_normalized_name: expectedName,
      p_expected_updated_at: expectedUpdatedAt,
      p_reason: "mechanical whitespace-only normalized product name repair",
    });
    if (confirmation.error) {
      throw new Error(`identity_key_repair_confirm_failed:${row.productId}:${confirmation.error.message}`);
    }

    const { data: readback, error: readbackError } = await client
      .from("products")
      .select("normalized_brand, normalized_name")
      .eq("id", row.productId)
      .single();
    if (readbackError) {
      throw new Error(`identity_key_repair_readback_failed:${row.productId}:${readbackError.message}`);
    }
    if (readback.normalized_brand !== proposedBrand || readback.normalized_name !== proposedName) {
      throw new Error(`identity_key_repair_readback_mismatch:${row.productId}`);
    }
    confirmed += 1;
  }

  console.log(`- confirmed_writes: ${confirmed}`);
  console.log(`- manual_review_writes: 0`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
