#!/usr/bin/env node

import { stdin } from "node:process";
import { evaluateProductQueryOperationalReadiness } from "../lib/product-query-beta-operational-readiness-evaluator.mjs";

let raw = "";
stdin.setEncoding("utf8");
for await (const chunk of stdin) raw += chunk;

if (!raw.trim()) {
  throw new Error("DATA-AI25 expects a JSON object with baseline and verified controls on stdin");
}

const input = JSON.parse(raw);
const result = evaluateProductQueryOperationalReadiness(
  input.baseline,
  input.controls
);
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
