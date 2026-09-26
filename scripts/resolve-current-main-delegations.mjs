#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const repository = process.env.GITHUB_REPOSITORY;
const expectedSha = process.env.EXPECTED_SHA;
const expectedEvent = process.env.EXPECTED_EVENT;
const token = process.env.GITHUB_TOKEN;
const apiUrl = process.env.GITHUB_API_URL || "https://api.github.com";
const resultPath = process.env.CURRENT_MAIN_DELEGATION_RESULT_PATH;
const policy = JSON.parse(fs.readFileSync("docs/ci/consolidation-audits/current-main-delegation-policy.json", "utf8"));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const normalizedPath = (value) => String(value || "").split("@", 1)[0];

if (!repository || !expectedSha || !expectedEvent || !token || !resultPath) {
  throw new Error("GITHUB_REPOSITORY, EXPECTED_SHA, EXPECTED_EVENT, GITHUB_TOKEN, and CURRENT_MAIN_DELEGATION_RESULT_PATH are required");
}

const owners = new Map(policy.owners.map((owner) => [owner.id, owner]));
const states = new Map(policy.owners.map((owner) => [owner.id, { mode: "unresolved" }]));

function writeResult() {
  const contracts = {};
  for (const owner of policy.owners) {
    const state = states.get(owner.id);
    for (const contract of owner.contracts) {
      contracts[contract.id] = {
        mode: state.mode,
        owner: owner.id,
        workflowPath: owner.workflowPath,
        runId: state.runId || null,
        reason: state.reason || null,
      };
    }
  }
  fs.mkdirSync(path.dirname(resultPath), { recursive: true });
  fs.writeFileSync(
    resultPath,
    JSON.stringify({ schemaVersion: policy.schemaVersion, sha: expectedSha, event: expectedEvent, contracts }, null, 2) + "\n",
  );
}

async function listRuns() {
  const url = new URL(`${apiUrl}/repos/${repository}/actions/runs`);
  url.searchParams.set("head_sha", expectedSha);
  url.searchParams.set("event", expectedEvent);
  url.searchParams.set("per_page", "100");
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!response.ok) throw new Error(`workflow run lookup HTTP ${response.status}`);
  const payload = await response.json();
  return (payload.workflow_runs || []).filter((run) => run.head_sha === expectedSha && run.event === expectedEvent);
}

let latestRuns = [];
let lookupAvailable = true;
for (let attempt = 1; attempt <= policy.resolution.visibilityAttempts; attempt += 1) {
  try {
    latestRuns = await listRuns();
  } catch (error) {
    lookupAvailable = false;
    console.log(`CURRENT_MAIN_DELEGATION=FALLBACK reason=lookup-unavailable detail=${error.message}`);
    break;
  }

  for (const owner of policy.owners) {
    if (states.get(owner.id).mode !== "unresolved") continue;
    const matches = latestRuns
      .filter((run) => normalizedPath(run.path) === owner.workflowPath)
      .sort((a, b) => b.id - a.id);
    if (matches[0]) states.set(owner.id, { mode: "found", runId: matches[0].id });
  }

  if ([...states.values()].every((state) => state.mode !== "unresolved")) break;
  if (attempt < policy.resolution.visibilityAttempts) await sleep(policy.resolution.visibilityIntervalMs);
}

if (!lookupAvailable) {
  for (const ownerId of owners.keys()) states.set(ownerId, { mode: "fallback", reason: "lookup-unavailable" });
  writeResult();
  process.exit(0);
}

for (const [ownerId, state] of states) {
  if (state.mode === "unresolved") states.set(ownerId, { mode: "fallback", reason: "same-head-run-absent" });
}

for (let attempt = 1; attempt <= policy.resolution.completionAttempts; attempt += 1) {
  const waiting = [...states.entries()].filter(([, state]) => state.mode === "found");
  if (!waiting.length) break;

  try {
    latestRuns = await listRuns();
  } catch (error) {
    for (const [ownerId] of waiting) states.set(ownerId, { mode: "fallback", reason: "lookup-unavailable-after-discovery" });
    console.log(`CURRENT_MAIN_DELEGATION=FALLBACK reason=lookup-unavailable-after-discovery detail=${error.message}`);
    break;
  }

  for (const [ownerId, state] of waiting) {
    const owner = owners.get(ownerId);
    const run = latestRuns.find((candidate) => candidate.id === state.runId);
    if (!run) continue;
    if (run.status !== "completed") {
      console.log(`CURRENT_MAIN_DELEGATION=WAIT owner=${ownerId} run_id=${run.id} status=${run.status} attempt=${attempt}`);
      continue;
    }
    if (run.conclusion !== "success") {
      throw new Error(`canonical workflow failed: owner=${ownerId} workflow=${owner.workflowPath} run_id=${run.id} conclusion=${run.conclusion || "unknown"}`);
    }
    states.set(ownerId, { mode: "delegated", runId: run.id, reason: "same-head-canonical-success" });
    console.log(`CURRENT_MAIN_DELEGATION=PASS owner=${ownerId} workflow=${owner.workflowPath} run_id=${run.id} sha=${expectedSha}`);
  }

  if ([...states.values()].some((state) => state.mode === "found") && attempt < policy.resolution.completionAttempts) {
    await sleep(policy.resolution.completionIntervalMs);
  }
}

for (const [ownerId, state] of states) {
  if (state.mode === "found") throw new Error(`canonical workflow did not complete within policy bounds: owner=${ownerId} run_id=${state.runId}`);
}

writeResult();
const delegated = [...states.values()].filter((state) => state.mode === "delegated").length;
const fallback = [...states.values()].filter((state) => state.mode === "fallback").length;
console.log(`CURRENT_MAIN_DELEGATION_RESOLUTION=PASS owners=${states.size} delegated=${delegated} fallback=${fallback}`);
