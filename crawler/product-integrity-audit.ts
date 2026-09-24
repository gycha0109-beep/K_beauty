#!/usr/bin/env node

import dotenv from "dotenv";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { createServiceRoleClient } from "./lib/supabase.js";
import { classifyLegacyOffer, type OfferSourceRules } from "./lib/offers/legacy-offer-classifier.js";
import {
  auditProductIntegrity,
  type IntegrityCurrentFact,
  type IntegrityOffer,
  type IntegrityProduct,
  type IntegritySourceBinding,
  type IntegritySubject,
} from "./lib/product-integrity-audit.js";

type FactCurrentRow = {
  fact_instance_id: string;
  subject_id: string;
};

type FactInstanceRow = {
  fact_instance_id: string;
  subject_id: string;
  fact_key: string;
  semantic_status: string;
  market: string | null;
  value_number: number | string | null;
  value_enum: string | null;
};

function loadEnvironment(): string {
  const crawlerDirectory = path.dirname(fileURLToPath(import.meta.url));
  const workspaceDirectory = path.resolve(crawlerDirectory, "..");
  for (const envFile of [
    path.join(crawlerDirectory, ".env"),
    path.join(crawlerDirectory, ".env.local"),
    path.join(workspaceDirectory, ".env"),
    path.join(workspaceDirectory, ".env.local"),
  ]) {
    dotenv.config({ path: envFile, override: false });
  }
  return crawlerDirectory;
}

async function loadRules(crawlerDirectory: string): Promise<OfferSourceRules> {
  const raw = await readFile(path.join(crawlerDirectory, "config", "offer-source-rules.json"), "utf8");
  const parsed = JSON.parse(raw) as OfferSourceRules;
  if (!parsed.version || !parsed.hosts || typeof parsed.hosts !== "object") {
    throw new Error("product_integrity_audit_invalid_offer_source_rules");
  }
  return parsed;
}

function outputPathFromArgs(): string | null {
  const index = process.argv.indexOf("--output");
  if (index < 0) return null;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error("product_integrity_audit_output_path_required");
  return path.resolve(process.cwd(), value);
}

function printSummary(audit: ReturnType<typeof auditProductIntegrity>): void {
  console.log("BEJEWELY product integrity audit v1");
  console.log(`- products: ${audit.productCount}`);
  console.log(`- issues: ${audit.issueCount}`);
  console.log(`- blockers: ${audit.severityCounts.blocker}`);
  console.log(`- review: ${audit.severityCounts.review}`);
  console.log(`- gaps: ${audit.severityCounts.gap}`);
  console.log(`- info: ${audit.severityCounts.info}`);
  console.log(`- legacy_buy_links: ${audit.commerceCoverage.legacyBuyLinks}`);
  console.log(`- current_offers: ${audit.commerceCoverage.currentOffers}`);
  console.log(`- products_with_current_offers: ${audit.commerceCoverage.productsWithCurrentOffers}`);
  console.log(`- products_without_current_offers: ${audit.commerceCoverage.productsWithoutCurrentOffers}`);
  console.log(`- trust_subjects: ${audit.trustCoverage.subjects}`);
  console.log(`- products_with_trust_subjects: ${audit.trustCoverage.productsWithSubjects}`);
  console.log(`- current_facts: ${audit.trustCoverage.currentFacts}`);
  for (const [code, count] of Object.entries(audit.issueCounts).sort(([a], [b]) => a.localeCompare(b))) {
    console.log(`- ${code}: ${count}`);
  }
  console.log("- database_writes: 0");
}

async function main(): Promise<void> {
  const crawlerDirectory = loadEnvironment();
  const rules = await loadRules(crawlerDirectory);
  const client = createServiceRoleClient();

  const [productsResult, bindingsResult, offersResult, subjectsResult, currentResult, instancesResult] =
    await Promise.all([
      client
        .from("products")
        .select(
          "id, brand, name, normalized_brand, normalized_name, buy_link, price_min, price_max, external_source, external_type, external_id, spf_value, uva_label, uv_filter_type",
        )
        .order("id", { ascending: true })
        .limit(5000),
      client
        .from("product_source_bindings")
        .select("product_id, source_name, external_type, external_id, binding_state, product_scope_state")
        .limit(10000),
      client
        .from("product_offers")
        .select(
          "offer_id, product_id, seller_key, listing_id, listing_url, offer_state, availability_state, product_scope_state",
        )
        .limit(10000),
      client
        .from("product_fact_subjects")
        .select(
          "subject_id, product_id, identity_status, current_state, market_applicability, variant_key, formulation_revision_key",
        )
        .limit(10000),
      client.from("product_fact_current").select("fact_instance_id, subject_id").limit(10000),
      client
        .from("product_fact_instances")
        .select(
          "fact_instance_id, subject_id, fact_key, semantic_status, market, value_number, value_enum",
        )
        .limit(10000),
    ]);

  for (const [label, result] of [
    ["products", productsResult],
    ["source_bindings", bindingsResult],
    ["offers", offersResult],
    ["subjects", subjectsResult],
    ["fact_current", currentResult],
    ["fact_instances", instancesResult],
  ] as const) {
    if (result.error) throw new Error(`product_integrity_audit_${label}_failed:${result.error.message}`);
  }

  const products = (productsResult.data ?? []) as IntegrityProduct[];
  const subjects = (subjectsResult.data ?? []) as IntegritySubject[];
  const subjectById = new Map(subjects.map((subject) => [subject.subject_id, subject]));
  const instanceById = new Map(
    ((instancesResult.data ?? []) as FactInstanceRow[]).map((instance) => [instance.fact_instance_id, instance]),
  );
  const currentFacts: IntegrityCurrentFact[] = [];
  for (const current of (currentResult.data ?? []) as FactCurrentRow[]) {
    const instance = instanceById.get(current.fact_instance_id);
    const subject = subjectById.get(current.subject_id);
    if (!instance || !subject) continue;
    currentFacts.push({
      product_id: subject.product_id,
      subject_id: current.subject_id,
      fact_key: instance.fact_key,
      semantic_status: instance.semantic_status,
      market: instance.market,
      value_number: instance.value_number,
      value_enum: instance.value_enum,
    });
  }

  const legacyOfferClassifications = products.map((product) =>
    classifyLegacyOffer(
      {
        productId: product.id,
        brand: product.brand,
        name: product.name,
        buyLink: product.buy_link,
        priceMin: product.price_min,
        priceMax: product.price_max,
      },
      rules,
    ),
  );

  const audit = auditProductIntegrity({
    products,
    sourceBindings: (bindingsResult.data ?? []) as IntegritySourceBinding[],
    offers: (offersResult.data ?? []) as IntegrityOffer[],
    subjects,
    currentFacts,
    legacyOfferClassifications,
  });

  if (process.argv.includes("--json")) {
    process.stdout.write(`${JSON.stringify(audit, null, 2)}\n`);
  } else {
    printSummary(audit);
  }

  const outputPath = outputPathFromArgs();
  if (outputPath) await writeFile(outputPath, `${JSON.stringify(audit, null, 2)}\n`, "utf8");

  if (audit.severityCounts.blocker > 0) process.exitCode = 2;
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
