#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalJson } from "./product-evidence/product-fact-current-resolver-v1.mjs";
import { VERSION as GROUP_RESOLVER_VERSION } from "./product-evidence/product-fact-current-group-resolver-v1.mjs";
import { VERSION as FIXTURE_ADAPTER_VERSION, adaptCrossCategoryDryRunProduct } from "./product-evidence/product-fact-cross-category-fixture-adapter-v1.mjs";
import { AXIS_KEYS, VERSION as MAPPER_VERSION, mapCrossCategoryDecisionAxis } from "./product-evidence/product-decision-axis-cross-category-v1.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const BASE_MAIN_SHA = "45628d2c859ab0ba875b66f30b4c47c150ef3162";
export const MATERIALIZATION_PATH = path.join(ROOT, "evidence/product-fact-materialization-v1/cross-category-pilot-materialization-dry-run-v1.json");
export const REGISTRY_PATH = path.join(ROOT, "evidence/product-evidence-decision-axis-v1/cross-category-registry-v1.json");
export const MAPPING_PATH = path.join(ROOT, "evidence/product-evidence-decision-axis-v1/cross-category-real-fact-mapping-pilot-v1.json");
export const CLEANSER_AXIS_PATH = path.join(ROOT, "evidence/product-decision-axis-v1/cleanser-product-decision-axis-v1.json");
export const OUT_JSON = path.join(ROOT, "evidence/product-decision-axis-v1/cross-category-product-decision-axis-v1.json");
export const OUT_MD = path.join(ROOT, "docs/evidence/product-decision-axis-cross-category-v1.md");

export const FROZEN = Object.freeze({
  materialization_sha256: "b2f19878f00f53d9a60dad0b1515fff1f566449e6a531825e712dfa2e3f19bb2",
  registry_blob: "32fdaa2d3a181c9d18888fc48c1343e083ad20f7",
  mapping_sha256: "c746c5d02f6547f0a8e8385611ac65ca30b9c4648fa4c6454ac863e7c9314f",
  cleanser_axis_sha256: "fbddc761328f2caa5025a5867061866d17f16d24cb6566fe82d0796c20a4a0b4",
});

const FACT_KEYS = Object.freeze([
  "spf_value", "uva_label", "uv_filter_type", "water_resistance_duration",
  "barrier_support_claim", "primary_use_role",
  "contains_active", "active_concentration", "recommended_use_frequency",
  "product_format", "wipe_off_use", "pad_surface_texture",
]);

function invariant(condition, message) { if (!condition) throw new Error(message); }
function sha256(text) { return crypto.createHash("sha256").update(text, "utf8").digest("hex"); }
function readJson(file) { return JSON.parse(fs.readFileSync(file, "utf8")); }

export function buildArtifact() {
  const materializationRaw = fs.readFileSync(MATERIALIZATION_PATH, "utf8");
  const mappingRaw = fs.readFileSync(MAPPING_PATH, "utf8");
  const cleanserRaw = fs.readFileSync(CLEANSER_AXIS_PATH, "utf8");
  invariant(sha256(materializationRaw) === FROZEN.materialization_sha256, "V2.1-2 materialization artifact SHA drift");
  invariant(sha256(mappingRaw) === FROZEN.mapping_sha256, "frozen cross-category mapping SHA drift");
  invariant(sha256(cleanserRaw) === FROZEN.cleanser_axis_sha256, "V2.1-5 cleanser axis SHA drift");

  const materialization = JSON.parse(materializationRaw);
  const registry = readJson(REGISTRY_PATH);
  const mapping = JSON.parse(mappingRaw);
  const cleanser = JSON.parse(cleanserRaw);
  invariant(materialization.summary?.input_products === 12, "V2.1-6 requires frozen 12-product pilot");
  invariant(materialization.summary?.forced_mapping_count === 0, "forced mapping must remain zero");
  invariant(registry.facts?.length === 20, "governed registry must remain 20 keys");
  invariant(cleanser.lifecycle?.DECISION_AXIS_CONSUMPTION === false, "V2.1-5 must remain non-consuming");

  const products = mapping.products.map((mapped) => {
    const resolved = adaptCrossCategoryDryRunProduct({ materialization, registry, mapping, pilotId: mapped.pilot_id, factKeys: FACT_KEYS });
    const subject = materialization.subjects.find((item) => item.pilot_id === mapped.pilot_id);
    const axis = mapCrossCategoryDecisionAxis(resolved);
    return {
      pilot_id: mapped.pilot_id,
      product_id: resolved.product_id,
      brand: subject.product_identity_input?.canonical_brand ?? null,
      name: subject.product_identity_input?.canonical_product_name ?? null,
      domain: mapped.domain,
      identity_status: resolved.identity_status,
      identity_blocked: resolved.identity_blocked,
      resolver_source: resolved.resolver_source,
      hosted_current: false,
      catalog_adopted: false,
      resolver_input_digest: resolved.resolver_input_digest,
      groups: resolved.groups,
      review_context: resolved.review_context,
      axis,
    };
  });

  const axes = products.map((product) => product.axis);
  const coverageCounts = Object.fromEntries([...new Set(axes.map((axis) => axis.coverage))].sort().map((key) => [key, axes.filter((axis) => axis.coverage === key).length]));
  const rawSignalFacts = axes.flatMap((axis) => axis.signal_families).reduce((sum, item) => sum + item.raw_fact_count, 0);
  const contributionUnits = axes.flatMap((axis) => axis.signal_families).reduce((sum, item) => sum + item.contribution_units, 0);

  return {
    version: MAPPER_VERSION,
    stage: "V2.1-6 Acceptance & Cross-category Extension",
    authority: {
      main_sha: BASE_MAIN_SHA,
      materialization_sha256: FROZEN.materialization_sha256,
      registry_blob: FROZEN.registry_blob,
      mapping_sha256: FROZEN.mapping_sha256,
      cleanser_axis_sha256: FROZEN.cleanser_axis_sha256,
    },
    resolver_contract: {
      grouped_resolver_version: GROUP_RESOLVER_VERSION,
      fixture_adapter_version: FIXTURE_ADAPTER_VERSION,
      cardinality_one_duplicate: "fail_closed",
      cardinality_many: "preserve_all_current_propositions",
      scope_preservation: ["market", "region", "locale", "validity", "subject_variant", "subject_formulation_revision"],
      identity_ambiguous_current_projection: "forbidden",
      missing_is_false: false,
      legacy_catalog_fallback: "forbidden",
    },
    axis_contract: {
      axis_keys: AXIS_KEYS,
      domain_axis_map: {
        sunscreen: "photo_protection",
        treatment: "exfoliation_load",
        moisturizer_family: "barrier_support",
        toner_pad_family: "exfoliation_load",
      },
      numeric_estimate_calibrated: false,
      signal_family_dedupe: true,
      fact_registry_auto_axis_creation: false,
      role_to_efficacy: "forbidden",
      usage_instruction_to_efficacy: "forbidden",
      active_identity_to_intensity: "forbidden",
      missing_to_false: "forbidden",
    },
    products,
    summary: {
      products: products.length,
      categories: 4,
      axis_keys: AXIS_KEYS.length,
      axis_outputs: axes.length,
      numeric_estimates: axes.filter((axis) => axis.estimate !== null).length,
      null_estimates: axes.filter((axis) => axis.estimate === null).length,
      coverage_counts: coverageCounts,
      raw_signal_fact_references: rawSignalFacts,
      signal_family_contribution_units: contributionUnits,
      identity_blocked_products: products.filter((product) => product.identity_blocked).length,
      hosted_product_fact_writes: 0,
      production_runtime_changes: 0,
    },
    lifecycle: {
      V21_6_ACCEPTANCE_CROSS_CATEGORY_OFFLINE_VERIFIED: true,
      PRODUCT_DECISION_AXIS_CROSS_CATEGORY_PRODUCTION_CALIBRATED: false,
      PRODUCT_FACT_CATALOG_ADOPTED: false,
      CATALOG_ADOPTED: false,
      DECISION_AXIS_CONSUMPTION: false,
      RECOMMENDATION_ACTIVATED: false,
      HOSTED_PRODUCT_FACT_WRITES: 0,
    },
  };
}

function markdown(output) {
  const s = output.summary;
  return [
    "# Product Decision Axis Cross-category v1",
    "",
    "> V2.1-6 offline acceptance and small-sample extension. No Hosted Product Fact writes, catalog adoption, recommendation consumption, or activation.",
    "",
    "## Scope",
    "",
    "- sunscreen → photo_protection",
    "- treatment → exfoliation_load",
    "- moisturizer family → barrier_support",
    "- toner/pad family → exfoliation_load",
    "- three shared axes cover four domains; Fact growth does not automatically create axis growth.",
    "",
    "## Resolver extension",
    "",
    "- preserves cardinality-many Current propositions instead of selecting one Fact by fact_key.",
    "- preserves market/region/locale/validity plus Subject variant/formulation scope.",
    "- ambiguous Subject identity is blocked from Current-like projection.",
    "- missing/source-blocked facts remain missing/not-established context, never false.",
    "",
    "## Frozen output",
    "",
    `- products: ${s.products}`,
    `- category families: ${s.categories}`,
    `- distinct cross-category axes: ${s.axis_keys}`,
    `- axis outputs: ${s.axis_outputs}`,
    `- numeric estimates: ${s.numeric_estimates}`,
    `- null estimates: ${s.null_estimates}`,
    `- identity-blocked products: ${s.identity_blocked_products}`,
    `- raw signal Fact references: ${s.raw_signal_fact_references}`,
    `- deduped signal-family contribution units: ${s.signal_family_contribution_units}`,
    "",
    "## Lifecycle",
    "",
    "```text",
    "V21_6_ACCEPTANCE_CROSS_CATEGORY_OFFLINE_VERIFIED = YES",
    "PRODUCT_DECISION_AXIS_CROSS_CATEGORY_PRODUCTION_CALIBRATED = NO",
    "PRODUCT_FACT_CATALOG_ADOPTED = NO",
    "CATALOG_ADOPTED = NO",
    "DECISION_AXIS_CONSUMPTION = NO",
    "RECOMMENDATION_ACTIVATED = NO",
    "HOSTED_PRODUCT_FACT_WRITES = 0",
    "```",
    "",
  ].join("\n");
}

export function buildTexts() {
  const output = buildArtifact();
  return { output, json: canonicalJson(output), markdown: markdown(output) };
}
export function writeOutputs() {
  const texts = buildTexts();
  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
  fs.mkdirSync(path.dirname(OUT_MD), { recursive: true });
  fs.writeFileSync(OUT_JSON, texts.json, "utf8");
  fs.writeFileSync(OUT_MD, texts.markdown, "utf8");
  return texts;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { output } = writeOutputs();
  console.log(`PASS build-product-decision-axis-cross-category-v1 products=${output.summary.products} axes=${output.summary.axis_outputs} axis_keys=${output.summary.axis_keys} numeric=${output.summary.numeric_estimates} hosted_writes=0`);
}
