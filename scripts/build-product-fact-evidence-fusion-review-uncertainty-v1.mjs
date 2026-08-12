#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadFrozenCorpus } from "./build-product-evidence-cleanser-poc-v1.mjs";
import {
  buildFusionArtifactWithAuthorityUpgrade,
  canonicalJson,
  CORPUS_SHA256,
  VERSION,
} from "./product-evidence/product-fact-evidence-fusion-review-uncertainty-v1-adapter.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SUPPLEMENT_PATH = path.join(ROOT, "evidence/product-fact-fusion-v1/cleanser-fusion-authority-upgrade-v1.json");
export const OUT_JSON = path.join(ROOT, "evidence/product-fact-fusion-v1/cleanser-evidence-fusion-review-uncertainty-v1.json");
export const OUT_MD = path.join(ROOT, "docs/evidence/product-fact-evidence-fusion-review-uncertainty-v1.md");

function loadSupplement() {
  return JSON.parse(fs.readFileSync(SUPPLEMENT_PATH, "utf8"));
}

function markdown(output) {
  const a = output.review_uncertainty_acceptance;
  const s = output.summary;
  const n5 = a.same_ratio_n5.uncertainty.value;
  const n5000 = a.same_ratio_n5000.uncertainty.value;
  const n100 = a.same_analyzed_n5000_effective_n100.uncertainty.value;
  return [
    "# Product Fact Evidence Fusion / Review Uncertainty v1",
    "",
    "> V2.1-4 offline contract. No Product Fact Hosted writes, Decision Axis consumption, or recommendation activation.",
    "",
    "## Authority",
    "",
    `- version: \`${VERSION}\``,
    `- main authority: \`${output.authority.main_sha}\``,
    `- frozen cleanser corpus: \`${output.authority.frozen_corpus_version}\``,
    `- corpus SHA-256: \`${CORPUS_SHA256}\``,
    `- historical cleanser POC oracle: \`${output.authority.historical_cleanser_poc_head}\``,
    `- V2.1-4 official authority upgrade: \`${output.authority.authority_upgrade_version}\` (${output.authority.authority_upgrade_records} record)`,
    "",
    "## Fusion contract",
    "",
    `- policy: \`${output.fusion_policy_version}\``,
    "- semantic states remain fact-specific: supported / reviewed_not_established / not_reviewed / evidence_insufficient / evidence_conflict",
    "- Boolean supported(false) requires explicit negative evidence and is not reviewed_not_established.",
    "- authority_ceiling never exceeds admissible evidence authority.",
    "- review_corpus and ingredient_list cannot establish low_ph/deep_cleansing when the current Registry does not permit those evidence classes.",
    "- manual conflict records remain adjudication context and cannot select physical truth.",
    "- BRMUD deep_cleansing uses one separately frozen current official-product claim with equivalent-presentation binding; its historical review observation remains context-only.",
    "",
    "## Real cleanser replay",
    "",
    `- products: ${s.products}`,
    `- fact propositions: ${s.fact_propositions}`,
    `- supported: ${s.supported}`,
    `- reviewed_not_established: ${s.reviewed_not_established}`,
    `- evidence_insufficient: ${s.evidence_insufficient}`,
    `- evidence_conflict: ${s.evidence_conflict}`,
    `- not_reviewed: ${s.not_reviewed}`,
    `- review-corpus evidence records: ${s.review_corpus_evidence}`,
    `- supplemental official product-claim evidence: ${s.supplemental_product_claim_evidence}`,
    `- review observations promoted into Fact authority: ${s.review_observation_promotions}`,
    `- real review prevalence estimates emitted: ${s.real_review_prevalence_estimates_emitted}`,
    "",
    "## Review uncertainty acceptance",
    "",
    "The prevalence denominator is analyzed_review_count only. raw_source_review_count is never substituted.",
    "",
    `- 3/5 estimate=${a.same_ratio_n5.estimate}, posterior variance POC=${n5}`,
    `- 3000/5000 estimate=${a.same_ratio_n5000.estimate}, posterior variance POC=${n5000}`,
    `- analyzed n=5000 but explicit effective n=100: estimate=${a.same_analyzed_n5000_effective_n100.estimate}, posterior variance POC=${n100}`,
    `- missing analyzed denominator: estimate=${a.missing_denominator.estimate}, prevalence_allowed=${a.missing_denominator.prevalence_estimate_allowed}`,
    "",
    "Beta-Binomial is retained only as an explicit-effective-N POC. No Production effective-N formula or calibrated Bayesian prior is approved here.",
    "",
    "## Lifecycle",
    "",
    "```text",
    "EVIDENCE_FUSION_V1_OFFLINE_VERIFIED = YES",
    "EVIDENCE_FUSION_PRODUCTION_CALIBRATED = NO",
    "REVIEW_BAYESIAN_MODEL_CALIBRATED = NO",
    "EFFECTIVE_SAMPLE_MODEL_CALIBRATED = NO",
    "PRODUCT_FACT_CATALOG_ADOPTED = NO",
    "DECISION_AXIS_CONSUMPTION = NO",
    "RECOMMENDATION_ACTIVATED = NO",
    "```",
    "",
  ].join("\n");
}

export function buildTexts() {
  const { corpus } = loadFrozenCorpus();
  const supplement = loadSupplement();
  const output = buildFusionArtifactWithAuthorityUpgrade(corpus, supplement);
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
  console.log(`PASS build-product-fact-evidence-fusion-review-uncertainty-v1 products=${output.summary.products} facts=${output.summary.fact_propositions} supported=${output.summary.supported} supplemental_official=${output.summary.supplemental_product_claim_evidence} real_review_prevalence=0`);
}
