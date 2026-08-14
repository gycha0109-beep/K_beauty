#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

export const VERSION = "exfoliation-load-calibration-wave-1-v1";
export const AXIS_KEY = "exfoliation_load";
export const OUTPUTS = Object.freeze({
  input: "evidence/product-decision-axis-calibration-v1/exfoliation-load-calibration-wave-1-input-v1.json",
  feasibility: "evidence/product-decision-axis-calibration-v1/exfoliation-load-calibration-feasibility-v1.json",
  result: "evidence/product-decision-axis-calibration-v1/exfoliation-load-calibration-wave-1-result-v1.json",
  doc: "docs/evidence/exfoliation-load-offline-shadow-calibration-wave-1-v1.md",
});
export const EXPECTED_HASHES = Object.freeze({
  input: "7ed8ccfac43c34ffbd83cb236a00a00fd02ea8f5751dc904b4390a60b178c97b",
  feasibility: "b2c8d716e6c53c54f7a32b713dc1c60209b43bfc598774aacecedd7e1367cd20",
  result: "6b79abb7b72292b16a4c6f8b1a5e420da24f2892dd4e09c7a9ca7ec22f58ffcc",
  doc: "9ccb7a8f8fbe9b8925b774e2fc949d380d06e51c0fcf52324b391b7311e2cda7",
});
export const UPSTREAM_AUTHORITY = Object.freeze({
  v21_8i_snapshot_sha256: "fde7b6fd9902ff965424be43d3c5e5bc1845f5e0a2fa97d3860376859636f05b",
  v21_8i_audit_sha256: "589dafe9ab4db7849676aef69d26e5122b4c64aea7bd548a497e60b6a21d5057",
  v21_8j_contract_file_sha256: "fcac5b422df3c3084eca20358e1a738796d159c8927a93e64e2f537371fe5cd2",
  v21_8j_contract_digest: "ce137d8755f454ae10c46e5321c718f3adca9f2cbceafc221bc3d93600543386",
  v21_8j_replay_sha256: "fbd9b2102c64c68c6aa68f1e899523c8ca80575d13768dd504ff89926bbe25cd",
});

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}
export function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}
export function canonicalJson(value) { return `${JSON.stringify(stable(value))}\n`; }
export function sha256Text(value) { return crypto.createHash("sha256").update(value, "utf8").digest("hex"); }
export function sha256Json(value) { return sha256Text(canonicalJson(value)); }
function sourceJson(key) { return JSON.parse(fs.readFileSync(OUTPUTS[key], "utf8")); }

export function buildInputCorpus() {
  const input = sourceJson("input");
  invariant(input.axis_key === AXIS_KEY, "axis drift");
  invariant(input.cohort.distinct_product_count === 3, "cohort count drift");
  invariant(JSON.stringify(stable(input.cohort.topology_distribution)) === JSON.stringify(stable({ treatment:1, toner_essence:1, toner_pad:1 })), "topology drift");
  invariant(input.external_research_performed === false && input.hosted_writes_performed === false, "8K mutation/research invariant drift");
  return input;
}

export function buildFeasibility(input) {
  const feasibility = sourceJson("feasibility");
  invariant(feasibility.input_corpus_sha256 === sha256Json(input), "feasibility input digest mismatch");
  invariant(feasibility.verdict === "NO_VALID_CALIBRATION_ANCHOR_AVAILABLE", "anchor verdict drift");
  invariant(!feasibility.candidates.some((candidate) => candidate.anchor_validity === "VALID"), "unexpected valid anchor");
  return feasibility;
}

function resultCandidate(candidate) {
  return {
    candidate: candidate.candidate,
    role: candidate.role,
    coverage: candidate.coverage,
    anchor_validity: candidate.anchor_validity,
    reason: candidate.reason,
  };
}

export function buildResult(input, feasibility) {
  const products = input.cohort.exact_products;
  const result = {
    version: "exfoliation-load-calibration-wave-1-result-v1",
    stage: "V2.1-8K",
    axis_key: AXIS_KEY,
    authority: {
      repository: input.authority.repository,
      execution_main_sha: input.authority.execution_main_sha,
      hosted_project: input.authority.hosted_project,
      registry_version: input.authority.registry_version,
      registry_checksum: input.authority.registry_checksum,
      v21_8i_snapshot_digest: input.authority.v21_8i_snapshot_sha256,
      v21_8j_contract_digest: input.authority.v21_8j_contract_digest,
      v21_8j_replay_digest: input.authority.v21_8j_replay_sha256,
    },
    cohort: {
      distinct_product_count: products.length,
      topology_distribution: input.cohort.topology_distribution,
      exact_products: products.map((p) => ({
        product_id: p.product_id,
        identity: `${p.brand} ${p.name}`,
        category: p.category,
        subject_id: p.subject.subject_id,
      })),
    },
    input_fact_contract: input.contract,
    anchor_feasibility: {
      candidates: feasibility.candidates.map(resultCandidate),
      verdict: feasibility.verdict,
    },
    identifiability_analysis: {
      independent_anchor_observations: 0,
      free_model_parameters: 0,
      fitting_status: "PROHIBITED_NO_TARGET",
      parameter_observation_rule: "Any fitted model with one or more free parameters would have parameters >= independent usable anchor observations (0).",
      missing_anchor_coverage: { products_with_anchor: 0, of: 3 },
      ingredient_identity_confounding: "MATERIAL: mandelic_acid repeats across treatment and toner_essence; toner_pad contains lactic_acid + salicylic_acid, and no governed cross-active potency equivalence exists.",
      category_topology_confounding: "MATERIAL: treatment, toner_essence, and toner_pad each have exactly one eligible product (TOPOLOGY_SINGLETON).",
      context_coverage: {
        active_concentration: "1/3",
        recommended_use_frequency: "1/3",
        product_format: "2/3",
        wipe_off_use: "1/3",
        pad_surface_texture: "1/3",
      },
      repeated_comparable_contexts: "NONE sufficient for calibration.",
      multi_active_handling: "MULTI_ACTIVE_AGGREGATION_NOT_AUTHORIZED",
      scope_compatibility: "Eligible signal Facts are compatible with resolved Current Subjects; this does not create an anchor.",
      verdict: "NUMERIC_METHOD_NOT_IDENTIFIABLE_WITH_CURRENT_AUTHORITY",
    },
    calibration: {
      executed: false,
      mode: "none",
      method_version: null,
      target_or_anchor: null,
      predictors: ["contains_active"],
      contexts: ["active_concentration","recommended_use_frequency","product_format","wipe_off_use","pad_surface_texture"],
      parameters: [],
      parameter_authority: [],
      estimate_bounds: null,
      outputs: [],
      reason_codes: ["NO_VALID_CALIBRATION_ANCHOR_AVAILABLE","NO_ESTIMATES_GENERATED"],
    },
    uncertainty: ["STRUCTURAL_ONLY","ANCHOR_LIMITED","CONTEXT_INCOMPLETE","MULTI_ACTIVE_UNCALIBRATED","TOPOLOGY_SINGLETON"],
    limitations: [
      "Three structurally eligible products are not three numeric ground truths.",
      "Active identity does not establish exfoliation potency.",
      "Active concentration is not cross-active comparable potency under current authority.",
      "Usage frequency is instruction context, not efficacy.",
      "Format, wipe-off use, and pad surface texture are context, not effect magnitude.",
      "No population uncertainty or generalization claim is made.",
    ],
    invariants: {
      hosted_product_fact_writes_v21_8k: 0,
      external_product_evidence_research_v21_8k: 0,
      registry_definition_delta_v21_8k: 0,
      migration_delta_v21_8k: 0,
      pda_production_consumption_v21_8k: 0,
      recommendation_behavior_delta_v21_8k: 0,
      production_mapper_changed: false,
      production_consumer_changed: false,
      candidate_policy_changed: false,
      hosted_write_path_present: false,
      synthetic_target_created: false,
      cross_active_numeric_normalization: false,
      ingredient_potency_constants: [],
    },
    production_consumed: false,
    recommendation_activated: false,
    primary_experiment_outcome: "NUMERIC_ANCHOR_GAP_CONFIRMED",
    outcome_flags: {
      OFFLINE_CALIBRATION_METHOD_VALIDATED: false,
      NUMERIC_ANCHOR_GAP_CONFIRMED: true,
      EXFOLIATION_LOAD_OFFLINE_CALIBRATED: false,
    },
    next_stage_recommendation: {
      stage: "Exfoliation Load Numeric Anchor / Evidence Contract Design",
      execute_now: false,
      why: "Current governed authority provides structural predictor/context signals but no independent numeric or ordinal calibration anchor.",
      exact_scope: "Define the semantic target, admissible measurement/outcome authority, scale/order semantics, scope/lineage rules, and evidence/Registry contract required before numeric calibration.",
      will_prove: "What independently governed anchor can support exfoliation_load calibration without circularity or invented cross-active potency assumptions.",
      will_not_do: ["external product evidence research","numeric fitting","production Decision Axis consumption","Recommendation activation"],
    },
    artifact_inputs: {
      input_corpus_sha256: sha256Json(input),
      feasibility_sha256: sha256Json(feasibility),
    },
  };
  invariant(result.anchor_feasibility.verdict === "NO_VALID_CALIBRATION_ANCHOR_AVAILABLE", "result anchor verdict drift");
  invariant(result.calibration.executed === false && result.calibration.outputs.length === 0, "calibration must remain unexecuted");
  return result;
}

export function buildAll() {
  const input = buildInputCorpus();
  const feasibility = buildFeasibility(input);
  const result = buildResult(input, feasibility);
  const doc = fs.readFileSync(OUTPUTS.doc, "utf8");
  const rendered = { input: canonicalJson(input), feasibility: canonicalJson(feasibility), result: canonicalJson(result), doc };
  for (const [key, expected] of Object.entries(EXPECTED_HASHES)) {
    invariant(sha256Text(rendered[key]) === expected, `${key} canonical hash drift`);
  }
  return { input, feasibility, result, doc, rendered };
}

export function writeAll(root = process.env.V21_8K_OUTPUT_ROOT || ".") {
  const built = buildAll();
  for (const [key, relativePath] of Object.entries(OUTPUTS)) {
    const target = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, built.rendered[key], "utf8");
  }
  return built;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const built = writeAll();
  console.log(JSON.stringify({
    version: VERSION,
    status: "PASS",
    axis_key: AXIS_KEY,
    primary_experiment_outcome: built.result.primary_experiment_outcome,
    calibration_executed: built.result.calibration.executed,
    hashes: EXPECTED_HASHES,
  }));
}
