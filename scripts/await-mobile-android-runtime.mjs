#!/usr/bin/env node
import { pathToFileURL } from "node:url";

export const workflowPath = ".github/workflows/mobile-android-runtime.yml";
const workflowFile = "mobile-android-runtime.yml";
const events = new Set(["pull_request", "push", "workflow_dispatch"]);
const jobNames = ["Android Debug APK Build", "Android Native Shell Smoke", "Android Store Capture 20A", "Android Store Capture 20B"];
const artifactPrefixes = ["bejewely-mobile-android-debug", "bejewely-mobile-native-shell", "bejewely-mobile-20a-store-capture", "bejewely-mobile-20b-store-capture"];

function positiveInteger(value, label) {
  if (!/^[1-9][0-9]*$/.test(String(value)) || !Number.isSafeInteger(Number(value))) throw new Error(`${label} must be a positive safe integer`);
  return Number(value);
}

export function runtimeGateConfig(env) {
  const repository = env.GITHUB_REPOSITORY;
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository || "")) throw new Error("GITHUB_REPOSITORY must identify the calling repository");
  if (!/^[0-9a-f]{40}$/.test(env.EXPECTED_SHA || "")) throw new Error("EXPECTED_SHA must be the exact checked-out candidate SHA");
  if (!events.has(env.MOBILE_RUNTIME_EXPECTED_EVENT)) throw new Error("MOBILE_RUNTIME_EXPECTED_EVENT must identify the producer event");
  if (!env.GITHUB_TOKEN) throw new Error("GITHUB_TOKEN is required");
  // This project uses GitHub.com. Never forward the token to a caller-provided host.
  if (env.GITHUB_API_URL && env.GITHUB_API_URL !== "https://api.github.com") throw new Error("unsupported GitHub API origin");
  return {
    repository, sha: env.EXPECTED_SHA, event: env.MOBILE_RUNTIME_EXPECTED_EVENT,
    runId: positiveInteger(env.MOBILE_RUNTIME_RUN_ID, "MOBILE_RUNTIME_RUN_ID"),
    attempt: positiveInteger(env.MOBILE_RUNTIME_RUN_ATTEMPT, "MOBILE_RUNTIME_RUN_ATTEMPT"),
    token: env.GITHUB_TOKEN,
  };
}

function validateRun(run, config, workflowId) {
  if (run?.id !== config.runId || run.workflow_id !== workflowId || run.path !== workflowPath) throw new Error("producer run/workflow identity mismatch");
  if (run.repository?.full_name?.toLowerCase() !== config.repository.toLowerCase()) throw new Error("producer repository mismatch");
  if (run.head_sha !== config.sha || run.event !== config.event) throw new Error("producer SHA/event mismatch");
  if (run.run_attempt !== config.attempt) throw new Error("producer attempt is stale");
  if (run.status !== "completed" || run.conclusion !== "success") throw new Error("producer must already have completed successfully; no polling is performed");
}

export async function verifyMobileRuntime(config, { fetchImpl = fetch, timeoutMs = 10000 } = {}) {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 10000) throw new Error("request timeout must be bounded to 1..10000 ms");
  const base = `https://api.github.com/repos/${config.repository}/actions`;
  async function read(endpoint) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(`${base}/${endpoint}`, {
        signal: controller.signal, redirect: "error",
        headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${config.token}`, "X-GitHub-Api-Version": "2022-11-28" },
      });
      if (!response.ok) throw new Error(`GitHub Actions lookup HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      // Network/JSON exceptions may include credentials. Expose only controlled diagnostics.
      if (/^GitHub Actions lookup HTTP [0-9]{3}$/.test(error?.message || "")) throw error;
      throw new Error("GitHub Actions lookup failed, returned invalid JSON, or timed out");
    } finally {
      clearTimeout(timer);
    }
  }
  const workflow = await read(`workflows/${workflowFile}`);
  if (workflow?.path !== workflowPath || !Number.isSafeInteger(workflow.id) || workflow.id < 1) throw new Error("canonical workflow identity mismatch");
  const runEndpoint = `runs/${config.runId}`;
  validateRun(await read(runEndpoint), config, workflow.id);
  const jobs = await read(`${runEndpoint}/attempts/${config.attempt}/jobs?per_page=100`);
  if (!Array.isArray(jobs.jobs) || jobs.total_count !== jobs.jobs.length) throw new Error("producer job evidence is incomplete");
  for (const name of jobNames) {
    const matches = jobs.jobs.filter((job) => job.name === name);
    const job = matches[0];
    if (matches.length !== 1 || job.run_id !== config.runId || job.run_attempt !== config.attempt || job.head_sha !== config.sha || job.status !== "completed" || job.conclusion !== "success") throw new Error(`producer job evidence missing or unsuccessful: ${name}`);
  }
  const artifacts = await read(`${runEndpoint}/artifacts?per_page=100`);
  if (!Array.isArray(artifacts.artifacts) || artifacts.total_count !== artifacts.artifacts.length) throw new Error("producer artifact evidence is incomplete");
  for (const prefix of artifactPrefixes) {
    const matches = artifacts.artifacts.filter((artifact) => artifact.name === `${prefix}-${config.sha}`);
    const artifact = matches[0];
    if (matches.length !== 1 || artifact.expired !== false || !(artifact.size_in_bytes > 0) || artifact.workflow_run?.id !== config.runId || artifact.workflow_run.head_sha !== config.sha) throw new Error(`producer artifact evidence missing, expired, or mismatched: ${prefix}`);
  }
  // A rerun may have started while evidence was read. Never certify the previous attempt.
  validateRun(await read(runEndpoint), config, workflow.id);
  return { runId: config.runId, attempt: config.attempt, sha: config.sha, event: config.event };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await verifyMobileRuntime(runtimeGateConfig(process.env));
    console.log(`MOBILE_ANDROID_RUNTIME_GATE=PASS run_id=${result.runId} attempt=${result.attempt} event=${result.event} sha=${result.sha}`);
  } catch (error) {
    console.error(`MOBILE_ANDROID_RUNTIME_GATE=FAIL ${error.message}`);
    process.exitCode = 1;
  }
}
