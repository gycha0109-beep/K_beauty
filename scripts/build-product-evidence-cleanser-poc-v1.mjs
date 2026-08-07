#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CORPUS_SHA256,
  buildArtifactFromCorpus,
  canonicalJson,
  digestWithoutSelf,
} from "./product-evidence/cleanser-poc-core.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const INDEX_PATH = path.join(ROOT, "evidence/catalog/cleanser-field-review-v1.json");
const OUTPUT_PATH = path.join(ROOT, "evidence/product-evidence-decision-axis-v1/cleanser-poc-output-v1.json");

export function loadFrozenCorpus() {
  const index = JSON.parse(fs.readFileSync(INDEX_PATH, "utf8"));
  const products = [];
  for (const relativePath of index.product_parts ?? []) {
    const shard = JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), "utf8"));
    products.push(...(shard.products ?? []));
  }
  const { product_parts: _parts, ...indexWithoutParts } = index;
  const corpus = { ...indexWithoutParts, products };
  if (index.canonical_sha256 !== CORPUS_SHA256) throw new Error("frozen corpus declared SHA-256 mismatch");
  if (digestWithoutSelf(corpus) !== CORPUS_SHA256) throw new Error("frozen corpus canonical SHA-256 mismatch");
  return { index, corpus };
}

export function buildOutputText() {
  const { corpus } = loadFrozenCorpus();
  return canonicalJson(buildArtifactFromCorpus(corpus));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const outputText = buildOutputText();
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, outputText, "utf8");
  process.stdout.write(`WROTE ${path.relative(ROOT, OUTPUT_PATH)} bytes=${Buffer.byteLength(outputText)}\n`);
}
