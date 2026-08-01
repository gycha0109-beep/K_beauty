import { spawnSync } from "node:child_process";
import {
  readdirSync,
  readFileSync,
  statSync
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DESIGN_BASE_SHA = "d82f097ac49bf3d2fbfe68b0ee57b1f07c55953a";
const HARNESS_MARKERS = [
  "candidate-exposure-policy-isolated-canary-control",
  "candidate-exposure-policy-isolated-projection",
  "candidate-exposure-policy-isolated-canary-telemetry",
  "candidate-exposure-policy-isolated-canary-evidence",
  "run-candidate-exposure-policy-isolated-preview-canary"
];
const HARNESS_FILES = [
  "lib/candidate-exposure-policy-isolated-canary-control.js",
  "lib/candidate-exposure-policy-isolated-projection.js",
  "lib/candidate-exposure-policy-isolated-canary-telemetry.js",
  "lib/candidate-exposure-policy-isolated-canary-evidence.js",
  "scripts/run-candidate-exposure-policy-isolated-preview-canary.mjs",
  "scripts/check-candidate-exposure-policy-isolated-canary-contract.mjs",
  "scripts/check-candidate-exposure-policy-isolated-canary-import-boundary.mjs"
];
const EXACT_ALLOWED_PATHS = new Set([
  ...HARNESS_FILES,
  "docs/reviews/candidate-exposure-policy-isolated-canary-implementation-review.md",
  "docs/verification/candidate-exposure-policy-isolated-canary-implementation-result.md",
  ".github/workflows/stage11f-isolated-canary-final-validation.yml"
]);
const ALLOWED_PREFIXES = ["fixtures/candidate-exposure-policy-isolated-canary/"];
const PRODUCT_SCAN_ROOTS = ["app", "components"];
const PRODUCT_LIB_FILES = [
  "lib/skin-match-decision-engine.js",
  "lib/candidate-exposure-policy.js",
  "lib/candidate-exposure-policy-shadow.js",
  "lib/candidate-exposure-policy-observability.js",
  "lib/candidate-exposure-policy-contract.js",
  "lib/candidate-exposure-policy-evaluator-adapter.js"
];
const FORBIDDEN_HARNESS_PATTERNS = [
  /\bfetch\s*\(/,
  /https?:\/\//i,
  /VERCEL_TOKEN/,
  /x-vercel-protection-bypass/i,
  /\bvercel\s+deploy\b/i,
  /\/api\/analyze/,
  /workflow_dispatch/,
  /production\s+deploy/i
];

let assertions = 0;
function assertCondition(condition, message) {
  assertions += 1;
  if (!condition) throw new Error(message);
}

function runGit(args) {
  const result = spawnSync("git", args, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  if (result.status !== 0) {
    throw new Error(`git_command_failed:${args.join(" ")}:${String(result.stderr || "").trim()}`);
  }
  return String(result.stdout || "").trim();
}

function walkFiles(rootPath) {
  const absolute = path.join(ROOT, rootPath);
  const output = [];
  for (const entry of readdirSync(absolute)) {
    const relative = path.posix.join(rootPath, entry);
    const entryPath = path.join(ROOT, relative);
    if (statSync(entryPath).isDirectory()) output.push(...walkFiles(relative));
    else output.push(relative);
  }
  return output;
}

function allowedPath(filePath) {
  return EXACT_ALLOWED_PATHS.has(filePath) ||
    ALLOWED_PREFIXES.some((prefix) => filePath.startsWith(prefix));
}

const headSha = runGit(["rev-parse", "HEAD"]);
const changedPaths = runGit([
  "diff",
  "--name-only",
  `${DESIGN_BASE_SHA}..${headSha}`
]).split("\n").map((value) => value.trim()).filter(Boolean);

assertCondition(changedPaths.length > 0, "stage11f_changed_paths_missing");
for (const filePath of changedPaths) {
  assertCondition(allowedPath(filePath), `stage11f_disallowed_changed_path:${filePath}`);
}
for (const filePath of ["package.json", "package-lock.json"]) {
  assertCondition(!changedPaths.includes(filePath), `stage11f_package_file_changed:${filePath}`);
}
for (const prefix of ["app/", "components/", "supabase/"]) {
  assertCondition(
    !changedPaths.some((filePath) => filePath.startsWith(prefix)),
    `stage11f_product_path_changed:${prefix}`
  );
}

const productFiles = [
  ...PRODUCT_SCAN_ROOTS.flatMap(walkFiles),
  ...PRODUCT_LIB_FILES
].filter((filePath) => /\.(?:js|mjs|jsx|ts|tsx)$/.test(filePath));
for (const filePath of productFiles) {
  const source = readFileSync(path.join(ROOT, filePath), "utf8");
  for (const marker of HARNESS_MARKERS) {
    assertCondition(
      !source.includes(marker),
      `stage11f_harness_imported_by_product:${filePath}:${marker}`
    );
  }
}

for (const filePath of HARNESS_FILES) {
  const source = readFileSync(path.join(ROOT, filePath), "utf8");
  for (const pattern of FORBIDDEN_HARNESS_PATTERNS) {
    assertCondition(!pattern.test(source), `stage11f_forbidden_harness_pattern:${filePath}:${pattern}`);
  }
  if (filePath !== "scripts/run-candidate-exposure-policy-isolated-preview-canary.mjs" &&
      filePath !== "scripts/check-candidate-exposure-policy-isolated-canary-import-boundary.mjs") {
    assertCondition(
      !source.includes("node:child_process"),
      `stage11f_child_process_outside_attestation:${filePath}`
    );
  }
}

const runnerSource = readFileSync(
  path.join(ROOT, "scripts/run-candidate-exposure-policy-isolated-preview-canary.mjs"),
  "utf8"
);
assertCondition(runnerSource.includes("--mode"), "stage11f_runner_mode_argument_missing");
assertCondition(runnerSource.includes("validate-only"), "stage11f_runner_validate_only_missing");
assertCondition(!runnerSource.includes("--hosted"), "stage11f_runner_hosted_mode_present");
assertCondition(!runnerSource.includes("--deploy"), "stage11f_runner_deploy_mode_present");

const manifest = JSON.parse(readFileSync(
  path.join(ROOT, "fixtures/candidate-exposure-policy-isolated-canary/manifest.v1.json"),
  "utf8"
));
assertCondition(manifest.actualUserData === false, "stage11f_manifest_user_data_not_false");
assertCondition(Array.isArray(manifest.scenarios) && manifest.scenarios.length === 4, "stage11f_manifest_scenario_count_invalid");

console.log(
  `check-candidate-exposure-policy-isolated-canary-import-boundary: PASS ` +
  `(${assertions} assertions, ${changedPaths.length} changed paths, ${productFiles.length} product files scanned)`
);
