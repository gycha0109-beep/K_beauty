import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const TMP_DIR = path.join(ROOT, "tmp");
const OUTPUT_PATH = path.join(TMP_DIR, "security-closeout-verifier-suite.json");
const STEP_TIMEOUT_MS = 180_000;

const CURRENT_SECURITY_STEPS = [
  {
    name: "analysis-rls-boundary",
    command: process.execPath,
    args: ["scripts/verify-analysis-rls-contract.mjs"],
  },
  {
    name: "anonymous-write-grant-boundary",
    command: process.execPath,
    args: ["scripts/verify-anonymous-write-grant-v2.mjs"],
  },
  {
    name: "image-upload-boundary",
    command: process.execPath,
    args: ["scripts/verify-sec08-image-upload-boundary.mjs"],
  },
  {
    name: "public-result-read-boundary",
    command: process.execPath,
    args: ["scripts/verify-sec09-public-result-read-boundary.mjs"],
  },
  {
    name: "security-headers-and-purchase-anchor",
    command: process.execPath,
    args: ["scripts/verify-sec10-security-headers.mjs"],
  },
  {
    name: "admin-access-boundary",
    command: process.execPath,
    args: ["scripts/verify-admin-access-foundation.mjs"],
  },
  {
    name: "sec11-origin-normalization",
    command: process.platform === "win32" ? "npm.cmd" : "npm",
    args: ["run", "check:sec11-origin-normalization"],
  },
  {
    name: "repository-secret-and-authority-shortcut-scan",
    command: process.platform === "win32" ? "npm.cmd" : "npm",
    args: ["run", "verify:current-repository-hygiene"],
  },
];

function runStep(step) {
  const startedAt = Date.now();
  const result = spawnSync(step.command, step.args, {
    cwd: ROOT,
    encoding: "utf8",
    timeout: STEP_TIMEOUT_MS,
    env: {
      ...process.env,
      CI: "1",
      NODE_ENV: "test",
    },
    maxBuffer: 16 * 1024 * 1024,
  });

  return {
    name: step.name,
    command: [step.command, ...step.args].join(" "),
    status: result.status,
    signal: result.signal,
    timedOut: result.error?.code === "ETIMEDOUT",
    error: result.error ? String(result.error.message || result.error) : null,
    durationMs: Date.now() - startedAt,
    stdoutTail: (result.stdout || "").slice(-4_000),
    stderrTail: (result.stderr || "").slice(-4_000),
  };
}

rmSync(TMP_DIR, { recursive: true, force: true });
mkdirSync(TMP_DIR, { recursive: true });

const results = [];
for (const step of CURRENT_SECURITY_STEPS) {
  const result = runStep(step);
  results.push(result);
  const passed = result.status === 0 && !result.signal && !result.error;
  console.log(`${passed ? "PASS" : "FAIL"} ${step.name}`);
  if (!passed) break;
}

const failures = results.filter((result) => result.status !== 0 || result.signal || result.error);
const status = failures.length === 0 && results.length === CURRENT_SECURITY_STEPS.length ? "PASS" : "FAIL";
const output = {
  suiteVersion: "current-security-verifier-suite-v1",
  authority: "BEJEWELY Current Main Health",
  historicalManifestAuthority: false,
  status,
  expectedVerifierCount: CURRENT_SECURITY_STEPS.length,
  executedVerifierCount: results.length,
  passedVerifierCount: results.filter((result) => result.status === 0 && !result.signal && !result.error).length,
  failedVerifierCount: failures.length,
  steps: CURRENT_SECURITY_STEPS.map((step) => step.name),
  results,
};

writeFileSync(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(`CURRENT_SECURITY_VERIFIERS=${status} ${output.passedVerifierCount}/${output.expectedVerifierCount}`);

if (status !== "PASS") {
  process.exitCode = 1;
}
