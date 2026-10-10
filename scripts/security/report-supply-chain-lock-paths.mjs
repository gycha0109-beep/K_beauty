#!/usr/bin/env node
import fs from "node:fs";
import { traceSupplyChainLockGraph } from "../../lib/supply-chain-lock-path-tracer.mjs";

// Exact checkout's committed lockfile; do not use network install, npm audit overrides,
// script-generated exceptions or caller-provided approval evidence.
const lock = JSON.parse(fs.readFileSync("package-lock.json", "utf8"));
const result = traceSupplyChainLockGraph(lock,{maxExamples:6});
console.log("SUPPLY_CHAIN_LOCK_PATH_TRIAGE=" + JSON.stringify(result));
if (result.status !== "EVIDENCE_ONLY_NOT_A_SECURITY_PASS") {
  process.exitCode = 1;
}
