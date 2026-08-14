#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

export const VERSION = "exfoliation-load-anchor-contract-v1";
export const AXIS_KEY = "exfoliation_load";
export const OUTPUTS = Object.freeze({
  contract: "evidence/product-decision-axis-anchor-contract-v1/exfoliation-load-numeric-anchor-evidence-contract-v1.json",
  replay: "evidence/product-decision-axis-anchor-contract-v1/exfoliation-load-anchor-contract-replay-v1.json",
  doc: "docs/evidence/exfoliation-load-numeric-anchor-evidence-contract-v1.md",
});
export const EXPECTED_HASHES = Object.freeze({
  contract: "07aa89c15039b77763a0e2bd411575279e5867468db7ed9ca1ac34b6f61740d8",
  replay: "852c8c9143f70841594b32e1ea5637a25682d8a684a925d54cee05b1efcb18df",
  doc: "f5100ba37c48cf26f172f95bdd82c534ff5c363412a4ec012f9e5c28ffff4bdd",
});
export const UPSTREAM = Object.freeze({
  v21_8k_result_sha256: "6b79abb7b72292b16a4c6f8b1a5e420da24f2892dd4e09c7a9ca7ec22f58ffcc",
  v21_8j_contract_digest: "ce137d8755f454ae10c46e5321c718f3adca9f2cbceafc221bc3d93600543386",
  execution_main_sha: "43595dfa5722d3612ab33c21737490e3cc34ab97",
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

export function canonicalJson(value) {
  return `${JSON.stringify(stable(value))}\n`;
}

export function sha256Text(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function readJson(key) {
  return JSON.parse(fs.readFileSync(OUTPUTS[key], "utf8"));
}

export function buildContract() {
  const contract = readJson("contract");
  invariant(contract.version === "exfoliation-load-numeric-anchor-evidence-contract-v1", "contract version drift");
  invariant(contract.stage === "V2.1-8L", "stage drift");
  invariant(contract.axis_key === AXIS_KEY, "axis drift");
  invariant(contract.authority.execution_main_sha === UPSTREAM.execution_main_sha, "execution authority drift");
  invariant(contract.authority.v21_8k_result_sha256 === UPSTREAM.v21_8k_result_sha256, "8K authority drift");
  invariant(contract.authority.v21_8j_contract_digest === UPSTREAM.v21_8j_contract_digest, "8J authority drift");
  invariant(contract.stage_outcome.primary_outcome === "NUMERIC_ANCHOR_EVIDENCE_CONTRACT_DESIGNED", "outcome drift");
  invariant(contract.stage_outcome.targeted_anchor_evidence_research_ready === true, "research contract must be ready");
  invariant(contract.stage_outcome.registry_publication_ready_now === false, "8L must not authorize premature Registry publication");
  invariant(contract.invariants.external_product_evidence_research_v21_8l === 0, "8L research invariant drift");
  invariant(contract.invariants.registry_definition_delta_v21_8l === 0, "8L Registry invariant drift");
  invariant(contract.invariants.numeric_fitting_v21_8l === 0, "8L fitting invariant drift");
  return contract;
}

export function buildReplay(contract) {
  const replay = readJson("replay");
  invariant(replay.axis_key === AXIS_KEY, "replay axis drift");
  invariant(replay.primary_outcome === contract.stage_outcome.primary_outcome, "replay outcome drift");
  invariant(replay.registry_replay.proposed_anchor_fact_present === false, "proposed Fact unexpectedly exists");
  invariant(replay.registry_replay.fact_keys.length === 20, "Registry key-count drift");
  invariant(replay.cohort_replay.distinct_product_count === 3, "cohort count drift");
  invariant(replay.cohort_replay.current_numeric_anchor_observations === 0, "unexpected numeric anchor");
  invariant(replay.contract_application.synthetic_target_authorized === false, "synthetic target must remain forbidden");
  return replay;
}

export function buildAll() {
  const contract = buildContract();
  const replay = buildReplay(contract);
  const doc = fs.readFileSync(OUTPUTS.doc, "utf8");
  const rendered = {
    contract: canonicalJson(contract),
    replay: canonicalJson(replay),
    doc,
  };
  for (const [key, expected] of Object.entries(EXPECTED_HASHES)) {
    invariant(sha256Text(rendered[key]) === expected, `${key} canonical hash drift`);
  }
  return { contract, replay, doc, rendered };
}

export function writeAll(root = process.env.V21_8L_OUTPUT_ROOT || ".") {
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
    primary_outcome: built.contract.stage_outcome.primary_outcome,
    next_stage: built.contract.next_stage_recommendation.stage,
    hashes: EXPECTED_HASHES,
  }));
}
