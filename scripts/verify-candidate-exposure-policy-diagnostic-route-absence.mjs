import { createHash } from "node:crypto";
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync
} from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SELF = path.normalize(
  "scripts/verify-candidate-exposure-policy-diagnostic-route-absence.mjs"
);

const TEMPORARY_PATHS = Object.freeze([
  "app/api/internal/candidate-exposure-policy-diagnostic/route.js",
  "lib/candidate-exposure-policy-hosted-diagnostic-auth.js",
  "lib/candidate-exposure-policy-hosted-diagnostic-contract.js",
  "lib/candidate-exposure-policy-hosted-diagnostic-execution.js",
  "scripts/check-candidate-exposure-policy-hosted-diagnostic-route.mjs"
]);

const EXPECTED_GIT_BLOBS = Object.freeze({
  "lib/candidate-exposure-policy-hosted-execution-v2.js":
    "3220b96a1e81e6c85eb12f05b3ce96b085cecb0b",
  "lib/candidate-exposure-policy-read-only-hosted-adapter.js":
    "12494938e141e2f74676444b8cbdf2f29edb812b",
  "scripts/check-candidate-exposure-policy-hosted-execution.mjs":
    "24baea33e998a9285ddbc65ffda54500a9d4c061"
});

const FORBIDDEN_TOKENS = Object.freeze([
  "/api/internal/candidate-exposure-policy-diagnostic",
  "x-bejewely-diagnostic-timestamp",
  "x-bejewely-diagnostic-nonce",
  "x-bejewely-diagnostic-signature",
  "CANDIDATE_EXPOSURE_POLICY_DIAGNOSTIC_GRANT_DIGEST",
  "CURRENT_CANDIDATE_POLICY_DIAGNOSTIC_ROUTE_CAPABILITY",
  "postCandidatePolicyDiagnostic",
  "probeCandidatePolicyDiagnostic",
  "candidate-exposure-policy-hosted-diagnostic-plan-v2",
  "candidate-exposure-policy-hosted-diagnostic-auth",
  "candidate-exposure-policy-hosted-diagnostic-contract",
  "candidate-exposure-policy-hosted-diagnostic-execution"
]);

const TEXT_EXTENSIONS = new Set([
  ".cjs", ".css", ".graphql", ".html", ".js", ".jsx", ".json",
  ".mjs", ".prisma", ".sh", ".sql", ".toml", ".ts", ".tsx",
  ".yaml", ".yml"
]);
const TEXT_BASENAMES = new Set([
  "Dockerfile", "Makefile", "middleware.js", "middleware.ts",
  "next.config.js", "next.config.mjs", "next.config.ts",
  "package-lock.json", "package.json", "vercel.json"
]);
const EXCLUDED_DIRECTORIES = new Set([
  ".git", ".next", ".codex", "coverage", "docs", "node_modules", "tmp"
]);

let assertions = 0;

function assert(condition, message) {
  assertions += 1;
  if (!condition) throw new Error(`assertion_failed:${message}`);
}

function relative(filePath) {
  return path.relative(ROOT, filePath).split(path.sep).join("/");
}

function gitBlobSha(filePath) {
  const bytes = readFileSync(filePath);
  return createHash("sha1")
    .update(Buffer.from(`blob ${bytes.length}\0`, "utf8"))
    .update(bytes)
    .digest("hex");
}

function isDocumentationPath(relativePath) {
  const segments = relativePath.split("/");
  return segments.includes("docs") || segments.includes(".codex") ||
    /(^|\/)(readme|changelog|license)(\.|$)/i.test(relativePath);
}

function shouldInspect(relativePath) {
  if (relativePath === SELF || isDocumentationPath(relativePath)) return false;
  const extension = path.extname(relativePath).toLowerCase();
  return TEXT_EXTENSIONS.has(extension) ||
    TEXT_BASENAMES.has(path.basename(relativePath));
}

function walk(directory, output = []) {
  if (!existsSync(directory)) return output;
  for (const entry of readdirSync(directory)) {
    if (EXCLUDED_DIRECTORIES.has(entry)) continue;
    const absolute = path.join(directory, entry);
    const info = statSync(absolute);
    if (info.isDirectory()) {
      walk(absolute, output);
    } else if (info.isFile()) {
      output.push(absolute);
    }
  }
  return output;
}

for (const temporaryPath of TEMPORARY_PATHS) {
  assert(!existsSync(path.join(ROOT, temporaryPath)), `temporary_path_absent:${temporaryPath}`);
}
assert(
  !existsSync(path.join(ROOT, "app/api/internal/candidate-exposure-policy-diagnostic")),
  "temporary_route_directory_absent"
);

for (const [relativePath, expectedBlob] of Object.entries(EXPECTED_GIT_BLOBS)) {
  const absolute = path.join(ROOT, relativePath);
  assert(existsSync(absolute), `restored_path_present:${relativePath}`);
  assert(gitBlobSha(absolute) === expectedBlob, `git_blob_exact:${relativePath}`);
}

const violations = [];
for (const absolute of walk(ROOT)) {
  const relativePath = relative(absolute);
  if (!shouldInspect(relativePath)) continue;
  const source = readFileSync(absolute, "utf8");
  for (const token of FORBIDDEN_TOKENS) {
    if (source.includes(token)) {
      violations.push(`${relativePath}:${token}`);
    }
  }
}
assert(violations.length === 0, `temporary_tokens_absent:${violations.join("|")}`);

const analyzeSource = readFileSync(
  path.join(ROOT, "app/api/analyze/route.js"),
  "utf8"
);
for (const token of [
  "resolveCandidateExposurePolicyShadowControl",
  "runCandidateExposurePolicyShadow",
  "candidateExposurePolicyShadowControl.enabled",
  "canonicalState: rebuiltPremiumReport",
  "responseValue: publicDecision",
  "snapshotValue: rebuiltPremiumReport"
]) {
  assert(analyzeSource.includes(token), `approved_analyze_semantic_present:${token}`);
}
assert(
  analyzeSource.includes("const { access: premiumAccess } = await resolvePremiumAccessForRequest(request);"),
  "current_main_premium_access_preserved"
);
assert(
  !analyzeSource.includes("userId: premiumUser?.id"),
  "source_only_premium_ownership_absent"
);

const adapterSource = readFileSync(
  path.join(ROOT, "lib/candidate-exposure-policy-read-only-hosted-adapter.js"),
  "utf8"
);
assert(
  adapterSource.includes('path: "/api/analyze"'),
  "analyze_capability_restored"
);
assert(
  adapterSource.includes("supportsSyntheticFixtureInjection: false"),
  "synthetic_fixture_injection_disabled"
);
assert(
  adapterSource.includes("emitsHostedDiagnosticEnvelope: false"),
  "hosted_diagnostic_envelope_disabled"
);
assert(
  !adapterSource.includes("readyForHostedExecution: true"),
  "hosted_execution_not_marked_ready"
);

const executionSource = readFileSync(
  path.join(ROOT, "lib/candidate-exposure-policy-hosted-execution-v2.js"),
  "utf8"
);
assert(
  executionSource.includes('"diagnostic_route_contract_unsupported"'),
  "route_blocker_restored"
);
assert(
  executionSource.includes('"blocked_before_execution"'),
  "blocked_execution_state_restored"
);

console.log(
  `candidate-exposure-policy-diagnostic-route-absence: PASS (${assertions} assertions)`
);
