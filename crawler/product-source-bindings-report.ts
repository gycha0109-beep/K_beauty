#!/usr/bin/env node

import dotenv from "dotenv";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { createServiceRoleClient } from "./lib/supabase.js";

type ProductExternalIdentity = {
  id: string;
  external_source: string | null;
  external_type: string | null;
  external_id: string | null;
};

type SourceBinding = {
  product_id: string;
  source_name: string;
  external_type: string;
  external_id: string;
  binding_state: string;
  binding_method: string;
  product_scope_state: string;
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

function identityKey(source: string, type: string, id: string): string {
  return `${source}\u0000${type}\u0000${id}`;
}

async function main(): Promise<void> {
  loadEnvironment();
  const client = createServiceRoleClient();

  const [productsResult, bindingsResult] = await Promise.all([
    client
      .from("products")
      .select("id, external_source, external_type, external_id")
      .limit(2000),
    client
      .from("product_source_bindings")
      .select("product_id, source_name, external_type, external_id, binding_state, binding_method, product_scope_state")
      .limit(10000),
  ]);

  if (productsResult.error) {
    throw new Error(`product_source_binding_report_products_failed:${productsResult.error.message}`);
  }
  if (bindingsResult.error) {
    throw new Error(`product_source_binding_report_bindings_failed:${bindingsResult.error.message}`);
  }

  const products = (productsResult.data ?? []) as ProductExternalIdentity[];
  const bindings = (bindingsResult.data ?? []) as SourceBinding[];
  const legacy = products.filter(
    (product) => product.external_source && product.external_type && product.external_id,
  );
  const resolved = bindings.filter((binding) => binding.binding_state === "resolved");
  const resolvedByIdentity = new Map(
    resolved.map((binding) => [
      identityKey(binding.source_name, binding.external_type, binding.external_id),
      binding,
    ]),
  );
  const missingLegacyBindings = legacy.filter((product) => {
    const binding = resolvedByIdentity.get(
      identityKey(
        String(product.external_source),
        String(product.external_type),
        String(product.external_id),
      ),
    );
    return !binding || binding.product_id !== product.id;
  });

  const resolvedSourceCount = new Set(resolved.map((binding) => binding.source_name)).size;
  const resolvedCountByProduct = new Map<string, number>();
  for (const binding of resolved) {
    resolvedCountByProduct.set(binding.product_id, (resolvedCountByProduct.get(binding.product_id) ?? 0) + 1);
  }
  const multiSourceProducts = [...resolvedCountByProduct.values()].filter((count) => count > 1).length;

  console.log("Product source binding shadow report");
  console.log(`- products: ${products.length}`);
  console.log(`- legacy_external_triplets: ${legacy.length}`);
  console.log(`- source_bindings: ${bindings.length}`);
  console.log(`- resolved_bindings: ${resolved.length}`);
  console.log(`- retired_bindings: ${bindings.length - resolved.length}`);
  console.log(`- resolved_sources: ${resolvedSourceCount}`);
  console.log(`- multi_source_products: ${multiSourceProducts}`);
  console.log(`- missing_legacy_bindings: ${missingLegacyBindings.length}`);
  console.log(
    `- unresolved_product_subject_scope: ${resolved.filter((binding) => binding.product_scope_state === "product_subject_unresolved").length}`,
  );
  console.log("- product_writes: 0");

  if (missingLegacyBindings.length > 0) {
    process.exitCode = 2;
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
