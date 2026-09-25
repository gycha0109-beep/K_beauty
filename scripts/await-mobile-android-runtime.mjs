#!/usr/bin/env node

const repository = process.env.GITHUB_REPOSITORY;
const expectedSha = process.env.EXPECTED_SHA;
const token = process.env.GITHUB_TOKEN;
const apiUrl = process.env.GITHUB_API_URL || "https://api.github.com";
const workflowPath = ".github/workflows/mobile-android-runtime.yml";
const maxAttempts = Number.parseInt(process.env.MOBILE_RUNTIME_WAIT_ATTEMPTS || "100", 10);
const waitMs = Number.parseInt(process.env.MOBILE_RUNTIME_WAIT_INTERVAL_MS || "30000", 10);

if (!repository || !expectedSha || !token) {
  throw new Error("GITHUB_REPOSITORY, EXPECTED_SHA, and GITHUB_TOKEN are required");
}
if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || !Number.isInteger(waitMs) || waitMs < 1000) {
  throw new Error("invalid mobile runtime wait bounds");
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
  const url = new URL(`${apiUrl}/repos/${repository}/actions/runs`);
  url.searchParams.set("head_sha", expectedSha);
  url.searchParams.set("per_page", "100");

  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (response.status === 401 || response.status === 403) {
    throw new Error(`GitHub Actions run lookup denied with HTTP ${response.status}`);
  }
  if (!response.ok) {
    console.error(`MOBILE_ANDROID_RUNTIME_GATE=RETRY http=${response.status} attempt=${attempt}`);
    if (attempt < maxAttempts) {
      await sleep(waitMs);
      continue;
    }
    throw new Error(`GitHub Actions run lookup failed with HTTP ${response.status}`);
  }

  const payload = await response.json();
  const runs = (payload.workflow_runs || [])
    .filter((run) => run.head_sha === expectedSha && run.path === workflowPath)
    .sort((a, b) => b.id - a.id);
  const run = runs[0];

  if (!run) {
    console.log(`MOBILE_ANDROID_RUNTIME_GATE=WAIT reason=run-not-visible attempt=${attempt}`);
  } else if (run.status === "completed") {
    if (run.conclusion === "success") {
      console.log(`MOBILE_ANDROID_RUNTIME_GATE=PASS run_id=${run.id} sha=${expectedSha}`);
      process.exit(0);
    }
    throw new Error(
      `canonical Android Runtime failed: run_id=${run.id} conclusion=${run.conclusion || "unknown"}`,
    );
  } else {
    console.log(
      `MOBILE_ANDROID_RUNTIME_GATE=WAIT run_id=${run.id} status=${run.status} attempt=${attempt}`,
    );
  }

  if (attempt < maxAttempts) {
    await sleep(waitMs);
  }
}

throw new Error(
  `canonical Android Runtime did not complete within ${maxAttempts} checks for ${expectedSha}`,
);
