#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  buildHwahaeReviewCaptureEnvelope,
  validateHwahaeReviewCaptureEnvelope
} from "../lib/hwahae-review-capture-provenance.js";

function argsMap(argv) {
  const entries = argv.slice(2).flatMap((arg) => {
    if (!arg.startsWith("--")) return [];
    const index = arg.indexOf("=");
    return index === -1 ? [[arg.slice(2), true]] : [[arg.slice(2, index), arg.slice(index + 1)]];
  });
  return Object.fromEntries(entries);
}

function required(args, key) {
  const value = args[key];
  if (typeof value !== "string" || !value.trim()) throw new Error(`missing --${key}=...`);
  return value.trim();
}

const args = argsMap(process.argv);
const inputPath = resolve(required(args, "input"));
const outputPath = resolve(required(args, "output"));
const payload = JSON.parse(await readFile(inputPath, "utf8"));

const sourceIdentity = args["source-id"]
  ? {
      source: "hwahae",
      source_type: required(args, "source-type"),
      source_id: required(args, "source-id")
    }
  : null;

const envelope = buildHwahaeReviewCaptureEnvelope({
  productId: typeof args["product-id"] === "string" ? args["product-id"] : null,
  sourceIdentity,
  canonicalLocator: required(args, "canonical-locator"),
  observedAt: required(args, "observed-at"),
  payload
});

const validation = validateHwahaeReviewCaptureEnvelope(envelope);
if (!validation.valid) {
  throw new Error(`capture envelope failed validation: ${validation.errors.join(",")}`);
}

await writeFile(outputPath, `${JSON.stringify(envelope, null, 2)}\n`, "utf8");
console.log(
  `build-hwahae-review-capture-envelope: PASS output=${outputPath} digest=${envelope.capture_source.content_digest}`
);
