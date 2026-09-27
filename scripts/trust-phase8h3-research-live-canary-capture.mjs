import fs from "node:fs";
import { processClaimedTask } from "./trust-research-worker.mjs";

const targetArg = process.argv.find((arg) => arg.startsWith("--target="));
if (!targetArg) throw new Error("TARGET_REQUIRED");
const targetPath = targetArg.slice("--target=".length);
const target = JSON.parse(fs.readFileSync(targetPath, "utf8"));
if (target.contract !== "trust-phase8h3-research-live-canary-target-v1") {
  throw new Error("TARGET_CONTRACT_INVALID");
}
if (!Array.isArray(target.tasks) || target.tasks.length === 0) {
  throw new Error("TARGET_TASKS_REQUIRED");
}

const captured = [];
const fakeClient = {
  async rpc(name, args) {
    if (name !== "record_trust_research_result_v1") {
      return { data: null, error: { code: "READ_ONLY_CANARY", message: `Unexpected RPC: ${name}` } };
    }
    const row = {
      task_id: args?.p_task_id ?? null,
      p_result: args?.p_result ?? null,
    };
    captured.push(row);
    return { data: row, error: null };
  },
};

for (const task of target.tasks) {
  await processClaimedTask(fakeClient, task, fetch);
}
if (captured.length !== target.tasks.length) {
  throw new Error(`CAPTURE_COUNT_MISMATCH:${captured.length}:${target.tasks.length}`);
}
console.log("TRUST_PHASE8H3_RESEARCH_LIVE_CANARY_RESULT=" + JSON.stringify({
  contract: "trust-phase8h3-research-live-canary-result-v1",
  production_mutation: "NONE",
  results: captured,
}));
