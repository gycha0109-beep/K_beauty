#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

import {
  buildReviewObservationReadiness,
  summarizeReviewObservationReadiness
} from "../lib/product-evidence-review-observation-readiness.js";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_BATCH = path.join(
  ROOT_DIR,
  "data",
  "hwahae-review-signals",
  "categories",
  "sunscreen",
  "hwahae-sunscreen-review-signals.batch.json"
);

function loadEnv() {
  dotenv.config({ path: path.join(ROOT_DIR, ".env.local"), quiet: true });
  dotenv.config({ path: path.join(ROOT_DIR, ".env"), quiet: true });
}

function args() {
  const values = process.argv.slice(2);
  const fileArg = values.find((value) => value.startsWith("--file="));
  return {
    json: values.includes("--json"),
    details: values.includes("--details"),
    file: fileArg ? path.resolve(process.cwd(), fileArg.slice("--file=".length)) : DEFAULT_BATCH
  };
}

function createSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) {
    throw new Error("Missing Supabase env. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }
  return createClient(url.startsWith("http") ? url : `https://${url}`, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

async function loadAuthorityContext(supabase, productIds) {
  const [{ data: products, error: productError }, { data: subjects, error: subjectError }] = await Promise.all([
    supabase
      .from("products")
      .select("id,brand,name,category,hwahae_url")
      .in("id", productIds),
    supabase
      .from("product_fact_subjects")
      .select("product_id,subject_id,identity_status,current_state,valid_from,valid_to")
      .in("product_id", productIds)
  ]);

  if (productError) throw new Error(`products read failed: ${productError.message}`);
  if (subjectError) throw new Error(`product_fact_subjects read failed: ${subjectError.message}`);

  const productsById = new Map((products ?? []).map((row) => [String(row.id), row]));
  const subjectsByProduct = new Map();
  for (const subject of subjects ?? []) {
    if (subject.current_state !== "current") continue;
    const key = String(subject.product_id);
    if (!subjectsByProduct.has(key)) subjectsByProduct.set(key, []);
    subjectsByProduct.get(key).push(subject);
  }

  return { productsById, subjectsByProduct };
}

function singleCurrentSubject(subjects) {
  return Array.isArray(subjects) && subjects.length === 1 ? subjects[0] : null;
}

loadEnv();
const options = args();
const batch = JSON.parse(fs.readFileSync(options.file, "utf8").replace(/^\uFEFF/, ""));
const items = Array.isArray(batch?.items) ? batch.items : [];
const productIds = [...new Set(items.map((item) => String(item?.productId ?? "").trim()).filter(Boolean))];
const supabase = createSupabase();
const { productsById, subjectsByProduct } = await loadAuthorityContext(supabase, productIds);

const rows = items.map((item) => {
  const productId = String(item?.productId ?? "").trim();
  const product = productsById.get(productId) ?? null;
  const subjects = subjectsByProduct.get(productId) ?? [];
  const readiness = buildReviewObservationReadiness(item, {
    subject: singleCurrentSubject(subjects)
  });

  return {
    ...readiness,
    authorityContext: {
      productFound: Boolean(product),
      resolvedCurrentSubjectCount: subjects.filter((subject) => subject.identity_status === "resolved").length,
      currentSubjectCount: subjects.length,
      currentProductHwahaeUrlContextOnly: product?.hwahae_url ?? null
    }
  };
});

const summary = summarizeReviewObservationReadiness(rows);
const report = {
  reportVersion: "product-evidence-review-observation-readiness-report-v1",
  sourceBatch: path.relative(ROOT_DIR, options.file).replaceAll("\\", "/"),
  batchSourceLabel: batch?.source ?? null,
  batchGeneratedAtContextOnly: batch?.generated_at ?? null,
  writeAuthority: "none",
  prevalenceAuthorized: false,
  legacyProductHwahaeUrlMaySubstituteCaptureLocator: false,
  summary,
  rows: options.details ? rows : undefined
};

if (options.json || options.details) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(
    [
      `products=${summary.products}`,
      `targets=${summary.targets}`,
      `direct_observation_targets=${summary.directObservationTargets}`,
      `eligible_targets=${summary.eligibleTargets}`,
      `blocked_targets=${summary.blockedTargets}`,
      "writes=0",
      "prevalence_authorized=0",
      "legacy_hwahae_url_capture_fallback=0"
    ].join(" ")
  );
}
