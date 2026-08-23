#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const git = (...args) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8" });
const tracked = git("ls-files", "-z").split("\0").filter(Boolean);
const trackedSet = new Set(tracked);

const forbiddenTrackedPaths = [
  "Todo.txt",
  "e supabasemigrations  Select-String 20260506070849",
  "lib/backups/product-db.backup.js",
];
for (const file of forbiddenTrackedPaths) {
  assert(!trackedSet.has(file), `stale repository artifact must not be tracked: ${file}`);
}
assert(!tracked.some((file) => file.startsWith("lib/backups/")), "backup-only lib/backups directory must not remain in current main");

const envFiles = tracked.filter((file) => {
  const base = path.basename(file);
  if (!base.startsWith(".env")) return false;
  return !/(?:\.example|\.sample|\.template)$/.test(base);
});
assert.deepEqual(envFiles, [], `tracked environment secret files are forbidden: ${envFiles.join(", ")}`);

const runtimeTextFiles = tracked.filter((file) => {
  const inRuntime =
    file.startsWith("app/") ||
    file.startsWith("lib/") ||
    file.startsWith("components/") ||
    file === "middleware.js" ||
    file === "next.config.js" ||
    file === "vercel.json" ||
    file === ".github/workflows/current-main-health.yml";
  return inRuntime && /\.(?:js|mjs|cjs|ts|tsx|jsx|json|ya?ml)$/.test(file);
});

const secretPatterns = [
  ["private-key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ["github-token", /(?:ghp_|github_pat_)[A-Za-z0-9_]{20,}/],
  ["openai-project-key", /sk-proj-[A-Za-z0-9_-]{20,}/],
  ["slack-token", /xox[baprs]-[A-Za-z0-9-]{20,}/],
  ["aws-access-key", /AKIA[0-9A-Z]{16}/],
  ["public-service-role", /NEXT_PUBLIC_[A-Z0-9_]*SERVICE_ROLE[A-Z0-9_]*/],
];
const findings = [];
for (const file of runtimeTextFiles) {
  const absolute = path.join(ROOT, file);
  if (!existsSync(absolute)) continue;
  const source = readFileSync(absolute, "utf8");
  for (const [kind, pattern] of secretPatterns) {
    if (pattern.test(source)) findings.push(`${kind}:${file}`);
  }
}
assert.deepEqual(findings, [], `secret or forbidden public-authority shortcut detected: ${findings.join(", ")}`);

const crawlerFiles = tracked.filter((file) => file.startsWith("crawler/") && /\.(?:js|mjs|cjs|ts|tsx|jsx)$/.test(file));
const crawlerAuthorityPattern = /read_recommendation_admission_authority_v1|INITIAL_ADMISSION_GRANT|product_fact_current|product_fact_confirmations|product_fact_instances/;
const crawlerAuthorityFindings = crawlerFiles.filter((file) => crawlerAuthorityPattern.test(readFileSync(path.join(ROOT, file), "utf8")));
assert.deepEqual(crawlerAuthorityFindings, [], `crawler must not bypass canonical adoption boundary: ${crawlerAuthorityFindings.join(", ")}`);

const vercel = JSON.parse(readFileSync(path.join(ROOT, "vercel.json"), "utf8"));
assert(!Object.prototype.hasOwnProperty.call(vercel, "crons"), "crawler/scheduled auto-adoption must remain disabled");
assert.equal(vercel.git?.deploymentEnabled?.["**"], false, "non-main automatic Vercel deployment disabled");
assert.equal(vercel.git?.deploymentEnabled?.main, true, "main Vercel deployment enabled");

const shadowObserverPath = path.join(ROOT, "lib/exfoliation-normative-policy-production-shadow-observer.js");
if (existsSync(shadowObserverPath)) {
  const observer = readFileSync(shadowObserverPath, "utf8");
  assert(!/EXFOLIATION_NORMATIVE_POLICY_MODE.*ENFORCE/.test(observer), "current Production observer must not activate ENFORCE");
}

const canonicalWorkflowPath = path.join(ROOT, ".github/workflows/current-main-health.yml");
assert(existsSync(canonicalWorkflowPath), "canonical current-main workflow must exist");
const canonicalWorkflow = readFileSync(canonicalWorkflowPath, "utf8");
assert(canonicalWorkflow.includes("name: BEJEWELY Current Main Health"), "canonical workflow name");
assert(canonicalWorkflow.includes("actions/checkout@v4"), "canonical workflow exact checkout boundary");
assert(canonicalWorkflow.includes("npm run verify:current"), "canonical workflow root verification entrypoint");
assert(!/\b[0-9a-f]{40}\b/i.test(canonicalWorkflow), "canonical workflow must not hard-code historical commit SHAs");

const packageJson = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8"));
assert.equal(packageJson.scripts?.["verify:current"], "node scripts/verify-current-main-health.mjs", "canonical root verify script");
assert.equal(packageJson.scripts?.["verify:current-repository-hygiene"], "node scripts/verify-current-repository-hygiene.mjs", "repository hygiene script");

console.log(JSON.stringify({
  status: "PASS",
  tracked_file_count: tracked.length,
  runtime_secret_scan_file_count: runtimeTextFiles.length,
  crawler_authority_scan_file_count: crawlerFiles.length,
  stale_artifact_count: 0,
  tracked_env_secret_file_count: 0,
  secret_or_shortcut_findings: 0,
  crawler_authority_findings: 0,
  scheduled_auto_adoption: false,
}, null, 2));
