#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

export const VERSION = "exfoliation-non-numeric-pda-contract-v1";
export const STAGE = "V2.1-8O";
export const AXIS_KEY = "exfoliation_load";
export const CONTRACT_MODE = "STRUCTURED_CATEGORICAL";
export const PRIMARY_TERMINAL_OUTCOME = "NON_NUMERIC_EXFOLIATION_PDA_CONTRACT_FROZEN";
export const EXECUTION_MAIN_SHA = "070cd4be1e9dcd05660d26451027ae0b504c5034";
export const ACTIVE_IDENTITIES_V1 = Object.freeze(["lactic_acid", "mandelic_acid", "salicylic_acid"]);
export const OUTPUTS = Object.freeze({
  contract: "evidence/product-decision-axis-non-numeric-contract-v1/exfoliation-non-numeric-pda-contract-v1.json",
  examples: "evidence/product-decision-axis-non-numeric-contract-v1/exfoliation-non-numeric-pda-examples-v1.json",
  replay: "evidence/product-decision-axis-non-numeric-contract-v1/exfoliation-non-numeric-pda-replay-v1.json",
  doc: "docs/evidence/exfoliation-non-numeric-product-decision-axis-contract-v1.md",
});

export function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  return value;
}
export function canonicalJson(value) { return `${JSON.stringify(stable(value))}\n`; }
export function sha256(text) { return crypto.createHash("sha256").update(text, "utf8").digest("hex"); }

export function buildAll() {
  const rendered = {};
  for (const [key, rel] of Object.entries(OUTPUTS)) {
    const text = fs.readFileSync(rel, "utf8");
    rendered[key] = key === "doc" ? text : canonicalJson(JSON.parse(text));
  }
  return {
    contract: JSON.parse(rendered.contract),
    examples: JSON.parse(rendered.examples),
    replay: JSON.parse(rendered.replay),
    doc: rendered.doc,
    rendered,
    hashes: Object.fromEntries(Object.entries(rendered).map(([key, value]) => [key, sha256(value)])),
  };
}

export function writeAll(root = process.env.V21_8O_OUTPUT_ROOT || ".") {
  const built = buildAll();
  for (const [key, rel] of Object.entries(OUTPUTS)) {
    const target = path.join(root, rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, built.rendered[key], "utf8");
  }
  return built;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const built = writeAll();
  console.log(JSON.stringify({ status: "PASS", stage: STAGE, axis_key: AXIS_KEY, primary_terminal_outcome: PRIMARY_TERMINAL_OUTCOME, hashes: built.hashes }));
}
