#!/usr/bin/env node

import { stdin } from "node:process";
import { aggregateProductQueryOperationalBaseline } from "../lib/product-query-beta-operational-baseline.mjs";

let raw = "";
stdin.setEncoding("utf8");
for await (const chunk of stdin) raw += chunk;

if (!raw.trim()) {
  throw new Error("DATA-AI25 expects a JSON array of already-extracted DATA-AI24 safe events on stdin");
}

const events = JSON.parse(raw);
const baseline = aggregateProductQueryOperationalBaseline(events);
process.stdout.write(`${JSON.stringify(baseline, null, 2)}\n`);
