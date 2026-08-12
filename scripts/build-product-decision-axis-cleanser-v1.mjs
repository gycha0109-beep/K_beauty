#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { adaptFusionProductToCurrentFactFixture, VERSION as FIXTURE_ADAPTER_VERSION } from "./product-evidence/product-fact-current-resolver-v1-fixture-adapter.mjs";
import { VERSION as RESOLVER_VERSION, canonicalJson } from "./product-evidence/product-fact-current-resolver-v1.mjs";
import { ARCHITECTURE_VERSION, AXIS_KEYS, FACT_KEYS, ESTIMATE_BOUNDS, VERSION as MAPPER_VERSION, mapCleanserDecisionAxes } from "./product-evidence/product-decision-axis-cleanser-v1.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const BASE_MAIN_SHA = "4dce99057ca44adb14dac549e8df6d468cf7f5e2";
export const FUSION_PATH = path.join(ROOT, "evidence/product-fact-fusion-v1/cleanser-evidence-fusion-review-uncertainty-v1.json");
export const FUSION_SHA256 = "86332b78ec38d79f8dfa12c5879cee46f4a22979d69945ee2f5a9dcc7038b802";
export const HISTORICAL_POC_HEAD = "e371d5bc037fb80d1edd3876f0c7d1d94a2c1461";
export const HISTORICAL_POC_ARTIFACT_BLOB = "be3724b513a11a6521585950e79e21296550ecdc";
export const OUT_JSON = path.join(ROOT, "evidence/product-decision-axis-v1/cleanser-product-decision-axis-v1.json");
export const OUT_MD = path.join(ROOT, "docs/evidence/product-decision-axis-cleanser-v1.md");

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}
function sha256(text) {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

export function buildArtifact() {
  const raw = fs.readFileSync(FUSION_PATH, "utf8");
  invariant(sha256(raw) === FUSION_SHA256, "V2.1-4 fusion artifact SHA-256 drift");
  const fusion = JSON.parse(raw);
  invariant(fusion.version === "product-fact-evidence-fusion-review-uncertainty-v1", "unexpected V2.1-4 fusion version");
  invariant(fusion.products?.length === 26, "V2.1-5 cleanser mapper requires frozen 26-product fusion corpus");
  invariant(fusion.lifecycle?.DECISION_AXIS_CONSUMPTION === false, "V2.1-4 must remain non-consuming");
  invariant(fusion.lifecycle?.RECOMMENDATION_ACTIVATED === false, "V2.1-4 recommendation must remain inactive");

  const products = fusion.products
    .map((product) => {
      const resolved = adaptFusionProductToCurrentFactFixture(product, FACT_KEYS);
      const axes = mapCleanserDecisionAxes(resolved);
      return {
        product_id: product.product_id,
        brand: product.brand,
        name: product.name,
        resolver_source: resolved.resolver_source,
        resolver_input_digest: resolved.resolver_input_digest,
        hosted_current: false,
        catalog_adopted: false,
        facts: resolved.facts,
        axes,
      };
    })
    .sort((a, b) => a.product_id.localeCompare(b.product_id, "en"));

  const axes = products.flatMap((product) => product.axes);
  const facts = products.flatMap((product) => product.facts);
  const coverageCounts = Object.fromEntries([...new Set(axes.map((axis) => axis.coverage))].sort().map((key) => [key, axes.filter((axis) => axis.coverage === key).length]));
  const semanticCounts = Object.fromEntries([...new Set(facts.map((fact) => fact.semantic_status ?? "missing_current"))].sort().map((key) => [key, facts.filter((fact) => (fact.semantic_status ?? "missing_current") === key).length]));

  return {
    version: MAPPER_VERSION,
    architecture_version: ARCHITECTURE_VERSION,
    authority: {
      main_sha: BASE_MAIN_SHA,
      v21_4_fusion_version: fusion.version,
      v21_4_fusion_artifact_sha256: FUSION_SHA256,
      historical_cleanser_poc_head: HISTORICAL_POC_HEAD,
      historical_cleanser_poc_artifact_blob: HISTORICAL_POC_ARTIFACT_BLOB,
    },
    resolver_contract: {
      production_resolver_version: RESOLVER_VERSION,
      offline_fixture_adapter_version: FIXTURE_ADAPTER_VERSION,
      fixture_is_hosted_current: false,
      fixture_is_catalog_adopted: false,
      missing_current_is_false: false,
      legacy_catalog_fallback: "forbidden",
      scoring: "forbidden",
      evidence_refusion: "forbidden",
    },
    axis_contract: {
      axis_keys: AXIS_KEYS,
      estimate_bounds: ESTIMATE_BOUNDS,
      numeric_magnitude_requires_direct_calibrated_fact: true,
      qualitative_claims_may_create_numeric_magnitude: false,
      uncertainty_recalibration: "forbidden",
      authority_inflation: "forbidden",
      semantic_family_policy: "one_current_fact_per_fact_key_no_additive_stacking",
      correlated_fact_weighting: "not_calibrated_no_numeric_weights",
    },
    products,
    summary: {
      products: products.length,
      unique_fact_inputs: facts.length,
      axis_outputs: axes.length,
      axis_fact_input_references: axes.reduce((sum, axis) => sum + axis.fact_inputs.length, 0),
      numeric_estimates: axes.filter((axis) => axis.estimate !== null).length,
      null_estimates: axes.filter((axis) => axis.estimate === null).length,
      authority_limited_outputs: axes.filter((axis) => axis.coverage === "authority_limited").length,
      conflict_blocked_outputs: axes.filter((axis) => axis.coverage === "conflict_blocked").length,
      missing_fact_outputs: axes.filter((axis) => axis.coverage === "missing_fact").length,
      coverage_counts: coverageCounts,
      semantic_status_counts: semanticCounts,
      hosted_product_fact_writes: 0,
    },
    lifecycle: {
      V21_5_IMPLEMENTED: true,
      PRODUCT_DECISION_AXIS_MAPPER_V1_OFFLINE_VERIFIED: true,
      PRODUCT_DECISION_AXIS_PRODUCTION_CALIBRATED: false,
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
    "# Product Decision Axis Cleanser v1",
    "",
    "> V2.1-5 offline deterministic interpretation layer. Product Fact creation, Hosted Current mutation, recommendation consumption, scoring, and production activation are out of scope.",
    "",
    "## Authority",
    "",
    `- main authority: \`${output.authority.main_sha}\``,
    `- V2.1-4 fusion artifact SHA-256: \`${output.authority.v21_4_fusion_artifact_sha256}\``,
    `- historical cleanser POC: \`${output.authority.historical_cleanser_poc_head}\` (regression oracle only)`,
    "",
    "## Resolver boundary",
    "",
    `- production resolver: \`${output.resolver_contract.production_resolver_version}\``,
    `- offline fixture adapter: \`${output.resolver_contract.offline_fixture_adapter_version}\``,
    "- the frozen fusion artifact is adapted as Current Fact-like offline input; it is not Hosted Current and does not imply catalog adoption.",
    "- missing Current is preserved as missing, never false; reviewed_not_established, evidence_insufficient, evidence_conflict, and supported(false) remain distinct.",
    "- no legacy catalog fallback, scoring, evidence re-fusion, confidence increase, or authority increase occurs in the resolver.",
    "",
    "## Cleanser axes",
    "",
    "- cleansing_burden: deep_cleansing is only a qualitative claim signal; no burden magnitude is invented.",
    "- hydration_preservation: low_ph is indirect relevance only; no hydration magnitude is invented.",
    "- irritation_burden: the current cleanser Fact registry has no irritation Fact, so output is no_relevant_fact.",
    "- sebum_pore_control: deep_cleansing is relevant claim evidence only; no effect magnitude is invented.",
    "",
    "## Frozen output",
    "",
    `- products: ${s.products}`,
    `- unique Fact inputs: ${s.unique_fact_inputs}`,
    `- axis outputs: ${s.axis_outputs}`,
    `- numeric estimates: ${s.numeric_estimates}`,
    `- null estimates: ${s.null_estimates}`,
    `- authority-limited outputs: ${s.authority_limited_outputs}`,
    `- conflict-blocked outputs: ${s.conflict_blocked_outputs}`,
    `- missing-fact outputs: ${s.missing_fact_outputs}`,
    "",
    "## Lifecycle",
    "",
    "```text",
    "PRODUCT_DECISION_AXIS_MAPPER_V1_OFFLINE_VERIFIED = YES",
    "PRODUCT_DECISION_AXIS_PRODUCTION_CALIBRATED = NO",
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
  console.log(`PASS build-product-decision-axis-cleanser-v1 products=${output.summary.products} facts=${output.summary.unique_fact_inputs} axes=${output.summary.axis_outputs} numeric=${output.summary.numeric_estimates} null=${output.summary.null_estimates} hosted_writes=0`);
}
