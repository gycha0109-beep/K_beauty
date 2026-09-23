import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const TMP_DIR = path.join(ROOT, "tmp");
const OUTPUT_PATH = path.join(TMP_DIR, "security-boundary-verifier-suite.json");
const STEP_TIMEOUT_MS = 180_000;

const SECURITY_BOUNDARY_STEPS = Object.freeze([
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
    name: "saved-report-premium-write-boundary",
    command: process.execPath,
    args: ["scripts/verify-sec06-saved-report-boundary.mjs"],
  },
  {
    name: "product-link-boundary",
    command: process.execPath,
    args: ["scripts/verify-sec07-product-link-boundary.mjs"],
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
    name: "browser-image-origin-boundary",
    command: process.execPath,
    args: ["scripts/verify-sec10-image-origin-contract.mjs"],
  },
  {
    name: "security-headers-and-purchase-anchor",
    command: process.execPath,
    args: ["scripts/verify-sec10-security-headers.mjs"],
  },
  {
    name: "signout-boundary",
    command: process.execPath,
    args: ["scripts/verify-sec11-signout-boundary.mjs"],
  },
  {
    name: "sec11-origin-normalization",
    command: process.platform === "win32" ? "npm.cmd" : "npm",
    args: ["run", "check:sec11-origin-normalization"],
  },
  {
    name: "error-and-log-redaction-boundary",
    command: process.execPath,
    args: ["scripts/verify-sec12-error-log-boundary.mjs"],
  },
  {
    name: "provider-runtime-log-sanitization",
    command: process.execPath,
    args: ["scripts/verify-provider-runtime-log-sanitization.mjs"],
  },
  {
    name: "admin-access-boundary",
    command: process.execPath,
    args: ["scripts/verify-admin-access-foundation.mjs"],
  },
  {
    name: "repository-secret-and-authority-shortcut-scan",
    command: process.platform === "win32" ? "npm.cmd" : "npm",
    args: ["run", "verify:current-repository-hygiene"],
  },
]);

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
for (const step of SECURITY_BOUNDARY_STEPS) {
  const result = runStep(step);
  results.push(result);
  const passed = result.status === 0 && !result.signal && !result.error;
  console.log(`${passed ? "PASS" : "FAIL"} ${step.name}`);
  if (!passed) {
    if (result.stdoutTail) console.error(`--- ${step.name} stdout tail ---\n${result.stdoutTail}`);
    if (result.stderrTail) console.error(`--- ${step.name} stderr tail ---\n${result.stderrTail}`);
    break;
  }
}

const failures = results.filter((result) => result.status !== 0 || result.signal || result.error);
const status =
  failures.length === 0 && results.length === SECURITY_BOUNDARY_STEPS.length
    ? "PASS"
    : "FAIL";
const output = {
  suiteVersion: "security-boundary-verifier-suite-v1",
  authority: "BEJEWELY Security Boundary",
  status,
  expectedVerifierCount: SECURITY_BOUNDARY_STEPS.length,
  executedVerifierCount: results.length,
  passedVerifierCount: results.filter(
    (result) => result.status === 0 && !result.signal && !result.error
  ).length,
  failedVerifierCount: failures.length,
  steps: SECURITY_BOUNDARY_STEPS.map((step) => step.name),
  results,
};

writeFileSync(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(
  `SECURITY_BOUNDARY_VERIFIERS=${status} ${output.passedVerifierCount}/${output.expectedVerifierCount}`
);

if (status !== "PASS") {
  process.exitCode = 1;
}
