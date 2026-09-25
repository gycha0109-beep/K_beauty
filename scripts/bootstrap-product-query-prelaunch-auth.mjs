#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import {
  LOCAL_PROFILE_A_PATH,
  LOCAL_PROFILE_B_PATH,
  LOCAL_STORAGE_A_PATH,
  LOCAL_STORAGE_B_PATH,
  assertAccountPair,
  assertGitWorktreeClean,
  ensureLocalRuntime,
  getGitHead,
  parseCliArgs,
  resetLocalAuthProfiles
} from "./premium-browser-journey-local-auth.mjs";
import { openManualSystemChromeSession } from "./premium-e2e-system-browser.mjs";
import { captureAccountSessionResilient } from "./premium-e2e-session-capture.mjs";

const PRODUCTION_CONFIRMATION = "I_UNDERSTAND_THIS_RUNS_AGAINST_PRODUCTION";
const SHA_PATTERN = /^[0-9a-f]{40}$/i;

function requiredArg(args, name, envName) {
  const value = String(args[name] || process.env[envName] || "").trim();
  assert.ok(value, `${name} is required`);
  return value;
}

function productionUrl(value) {
  const url = new URL(value);
  assert.equal(url.protocol, "https:", "Production prelaunch bootstrap requires HTTPS");
  assert.ok(!["localhost", "127.0.0.1"].includes(url.hostname));
  return url;
}

async function captureOrLogin({ label, profilePath, storageStatePath, baseUrl, reset }) {
  if (!reset) {
    try {
      return await captureAccountSessionResilient({
        label,
        profilePath,
        storageStatePath,
        baseUrl,
        timeoutMs: 2_000
      });
    } catch {}
  }

  await openManualSystemChromeSession({ label, profilePath, baseUrl });
  return captureAccountSessionResilient({
    label,
    profilePath,
    storageStatePath,
    baseUrl,
    timeoutMs: 8_000
  });
}

async function probeEligibility({ baseUrl, accessToken, label }) {
  const response = await fetch(new URL("/api/my/product-query-beta", baseUrl), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      query: "prelaunch dedicated QA cohort eligibility probe"
    })
  });

  if (response.status === 200) {
    const body = await response.json();
    assert.equal(body?.ok, true, `${label}: eligible probe must return ok=true`);
    assert.equal(
      body?.result?.contractVersion,
      "product-query-preview-v1",
      `${label}: eligible result contract drift`
    );
    assert.equal(body?.result?.persisted, false, `${label}: eligible probe persisted unexpectedly`);
    return "eligible";
  }

  assert.equal(response.status, 404, `${label}: account must be either eligible (200) or non-cohort (404)`);
  return "ineligible";
}

const args = parseCliArgs();
await ensureLocalRuntime();
assertGitWorktreeClean();

assert.equal(
  String(args.confirm || process.env.PQ_PRELAUNCH_ALLOW_PRODUCTION || ""),
  PRODUCTION_CONFIRMATION,
  "explicit Production confirmation is required"
);

const baseUrl = productionUrl(
  requiredArg(args, "url", "PQ_PRELAUNCH_BASE_URL")
);
const expectedSha = requiredArg(args, "sha", "PQ_PRELAUNCH_EXPECTED_SHA").toLowerCase();
const deploymentSha = String(
  args["deployment-sha"] || process.env.PQ_PRELAUNCH_DEPLOYMENT_SHA || expectedSha
).trim().toLowerCase();
const localHead = getGitHead();

assert.match(expectedSha, SHA_PATTERN, "expected SHA must be a full Git SHA");
assert.match(deploymentSha, SHA_PATTERN, "deployment SHA must be a full Git SHA");
assert.equal(localHead, expectedSha, "local checkout must equal the exact release-candidate SHA");
assert.equal(deploymentSha, expectedSha, "deployment SHA must equal release-candidate SHA");

const resetAll = args["reset-profiles"] === true;
await resetLocalAuthProfiles({
  resetA: resetAll || args["reset-a"] === true,
  resetB: resetAll || args["reset-b"] === true
});

console.log(`Product Query prelaunch Production target: ${baseUrl.origin}`);
console.log(`Exact release-candidate SHA: ${expectedSha}`);
console.log("Two distinct permanent Google QA accounts are required.");
console.log("No access token, raw account ID, or account hash will be printed.");

const accountA = await captureOrLogin({
  label: "A",
  profilePath: LOCAL_PROFILE_A_PATH,
  storageStatePath: LOCAL_STORAGE_A_PATH,
  baseUrl,
  reset: resetAll || args["reset-a"] === true
});
const accountB = await captureOrLogin({
  label: "B",
  profilePath: LOCAL_PROFILE_B_PATH,
  storageStatePath: LOCAL_STORAGE_B_PATH,
  baseUrl,
  reset: resetAll || args["reset-b"] === true
});

assertAccountPair(accountA, accountB);

const [roleA, roleB] = await Promise.all([
  probeEligibility({ baseUrl, accessToken: accountA.accessToken, label: "A" }),
  probeEligibility({ baseUrl, accessToken: accountB.accessToken, label: "B" })
]);

assert.notEqual(roleA, roleB, "exactly one QA account must be in the approved Product Query cohort");

const eligible = roleA === "eligible" ? accountA : accountB;
const ineligible = roleA === "ineligible" ? accountA : accountB;

console.log("Cohort role attestation: one eligible + one authenticated non-cohort account = PASS");

const evidencePath = resolve(
  args.evidence ||
    process.env.PQ_PRELAUNCH_EVIDENCE_PATH ||
    "tmp/product-query-prelaunch-e2e/evidence.json"
);

const result = spawnSync(
  process.execPath,
  ["scripts/run-product-query-prelaunch-e2e.mjs"],
  {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PQ_PRELAUNCH_BASE_URL: baseUrl.origin,
      PQ_PRELAUNCH_EXPECTED_HOST: baseUrl.hostname,
      PQ_PRELAUNCH_EXPECTED_SHA: expectedSha,
      PQ_PRELAUNCH_DEPLOYMENT_SHA: deploymentSha,
      PQ_PRELAUNCH_ELIGIBLE_STORAGE_STATE: eligible.storageStatePath,
      PQ_PRELAUNCH_INELIGIBLE_STORAGE_STATE: ineligible.storageStatePath,
      PQ_PRELAUNCH_ELIGIBLE_ACCESS_TOKEN: eligible.accessToken,
      PQ_PRELAUNCH_INELIGIBLE_ACCESS_TOKEN: ineligible.accessToken,
      PQ_PRELAUNCH_SUPABASE_URL: eligible.supabaseUrl,
      PQ_PRELAUNCH_SUPABASE_ANON_KEY: eligible.anonKey,
      PQ_PRELAUNCH_ALLOW_PRODUCTION: PRODUCTION_CONFIRMATION,
      PQ_PRELAUNCH_EVIDENCE_PATH: evidencePath
    },
    stdio: "inherit",
    windowsHide: true
  }
);

if (result.error) throw result.error;
assert.equal(result.status, 0, "Product Query hosted prelaunch acceptance failed");

console.log(`PRELAUNCH_ACCEPTED evidence written to ${evidencePath}`);
