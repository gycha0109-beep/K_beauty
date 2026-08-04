import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST_PATH = path.join(ROOT, "docs/architecture/candidate-policy-main-integration-blob-manifest-v1.json");
const VERCEL_CONFIG_PATH = path.join(ROOT, "vercel.json");
const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
const CI_PORTABILITY_SEMANTIC_PATH = "scripts/verify-candidate-policy-runtime-reevaluation.mjs";
const CI_PORTABILITY_SOURCE_BLOB = "15f5cc94e2a2673ba36ef73a2cdb7a6a690ffc6c";
const CI_PORTABILITY_RESULT_BLOB = "4eea1f845c7a20a819a2189a3956b724b1d631ea";
let assertions = 0;
const check = (value, message) => { assertions += 1; assert.ok(value, message); };
const git = (...args) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).trim();
const hash = (filePath) => git("hash-object", "--", filePath);

check(manifest.version === "candidate-policy-main-integration-blob-manifest-v1", "manifest version drift");
check(manifest.baseSha === "647051f7feff8e23dc7b563cb7b58ffcba7e6eaf", "main authority drift");
check(manifest.sourceSha === "ce882aa2057a06d39d86f99a09f4264725b4161b", "source authority drift");
check(manifest.counts.includeExact === 61, "include exact count drift");
check(manifest.counts.mergeSemantic === 7, "semantic count drift");
check(manifest.counts.excludeSourceOnly === 38, "source-only exclusion count drift");
check(manifest.counts.preserveMain === 302, "main preservation count drift");

for (const entry of manifest.includeExact) {
  check(existsSync(path.join(ROOT, entry.path)), `missing exact source path: ${entry.path}`);
  if (entry.path === CI_PORTABILITY_SEMANTIC_PATH) {
    check(entry.sourceBlob === CI_PORTABILITY_SOURCE_BLOB, "historical reevaluation source blob drift");
    check(hash(entry.path) === CI_PORTABILITY_RESULT_BLOB, "reevaluation CI portability result drift");
    continue;
  }
  check(hash(entry.path) === entry.sourceBlob, `source blob mismatch: ${entry.path}`);
}
for (const entry of manifest.preserveMain) {
  check(existsSync(path.join(ROOT, entry.path)), `missing current-main path: ${entry.path}`);
  check(hash(entry.path) === entry.mainBlob, `current-main blob mismatch: ${entry.path}`);
}
for (const entry of manifest.excludeSourceOnly) {
  check(!existsSync(path.join(ROOT, entry.path)), `excluded source-only path present: ${entry.path}`);
}
for (const entry of manifest.mergeSemantic) {
  check(existsSync(path.join(ROOT, entry.path)), `missing semantic path: ${entry.path}`);
  check(hash(entry.path) === entry.resultBlob, `semantic result blob mismatch: ${entry.path}`);
}
for (const filePath of manifest.temporaryRouteFiles) {
  check(!existsSync(path.join(ROOT, filePath)), `temporary diagnostic route residue: ${filePath}`);
}

const route = readFileSync(path.join(ROOT, "app/api/analyze/route.js"), "utf8");
for (const token of [
  "resolveCandidateExposurePolicyShadowControl",
  "runCandidateExposurePolicyShadow",
  "candidateExposurePolicyShadowControl.enabled",
  "canonicalState: rebuiltPremiumReport",
  "responseValue: publicDecision",
  "snapshotValue: rebuiltPremiumReport"
]) check(route.includes(token), `missing analyze semantic token: ${token}`);
check(route.includes("const { access: premiumAccess } = await resolvePremiumAccessForRequest(request);"), "main premium access contract changed");
check(!route.includes("userId: premiumUser?.id"), "source-only premium ownership leaked");
const diagnosticRouteToken = ["/api/internal", "candidate-exposure-policy-diagnostic"].join("/");
check(!route.includes(diagnosticRouteToken), "temporary diagnostic route token leaked");

const evaluator = readFileSync(path.join(ROOT, "lib/evaluator-boundary-policy-shadow.js"), "utf8");
check(evaluator.includes("baselineExposureGroup: currentExposureDecision.exposureStatus"), "baseline exposure field missing");

const pkg = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8"));
check(Array.isArray(pkg.workspaces) && pkg.workspaces.includes("packages/*") && pkg.workspaces.includes("tools/*"), "workspace contract lost");
check(pkg.scripts["verify:candidate-exposure-policy-shadow"], "shadow script missing");
check(pkg.scripts["verify:candidate-exposure-policy-shadow-evaluation"], "shadow evaluation script missing");
check(pkg.scripts["synthetic:test"] && pkg.scripts["synthetic:solo"], "Toolkit scripts lost");
check(pkg.devDependencies.postcss === "^8.5.25", "postcss remediation drift");
check(pkg.overrides?.next?.postcss === "8.5.25", "Next postcss override drift");
check(pkg.overrides?.next?.sharp === "0.35.3", "Next sharp override drift");

check(existsSync(VERCEL_CONFIG_PATH), "vercel deployment policy missing");
const vercelConfig = JSON.parse(readFileSync(VERCEL_CONFIG_PATH, "utf8"));
check(vercelConfig.$schema === "https://openapi.vercel.sh/vercel.json", "vercel schema drift");
check(vercelConfig.git?.deploymentEnabled === false, "automatic Vercel Git deployments must remain disabled");
check(vercelConfig.github?.autoAlias === false, "automatic Vercel Git aliasing must remain disabled");
const workflowsDir = path.join(ROOT, ".github", "workflows");
if (existsSync(workflowsDir)) {
  for (const workflowName of readdirSync(workflowsDir).filter((name) => /\.ya?ml$/.test(name))) {
    const workflow = readFileSync(path.join(workflowsDir, workflowName), "utf8");
    check(!/(?:^|\s)vercel(?:\s+deploy|\s+--prod)(?:\s|$)/m.test(workflow), `automatic Vercel deploy command forbidden in workflow: ${workflowName}`);
  }
}

const securitySuite = readFileSync(path.join(ROOT, "scripts/run-security-closeout-verifier-suite.mjs"), "utf8");
for (const verifier of manifest.preservedMainSecurityVerifiers) {
  check(securitySuite.includes(`"${verifier}"`), `main security verifier removed: ${verifier}`);
}
for (const verifier of manifest.requiredCandidateSecurityVerifiers) {
  const occurrences = securitySuite.split(`"${verifier}"`).length - 1;
  check(occurrences === 1, `candidate security verifier count mismatch: ${verifier}`);
  check(existsSync(path.join(ROOT, "scripts", verifier)), `candidate verifier file missing: ${verifier}`);
}

const readiness = readFileSync(path.join(ROOT, "scripts/verify-evaluator-boundary-readiness-review.mjs"), "utf8");
check(readiness.includes("output.pureReplayEvidenceSummary.productRowsLoaded > 0"), "readiness semantic delta missing");

const reevaluation = readFileSync(path.join(ROOT, CI_PORTABILITY_SEMANTIC_PATH), "utf8");
check(reevaluation.includes("const REVIEW_BASE_CANDIDATES = ["), "reevaluation base candidate contract missing");
check(reevaluation.includes('"origin/codex/stage10-hosted-preview-user-flow"'), "reevaluation origin base fallback missing");
check(reevaluation.includes("const reviewBaseRef = resolveRef(REVIEW_BASE_CANDIDATES);"), "reevaluation base resolution missing");
check(reevaluation.includes("`${reviewBaseRef}...${reviewHeadRef}`"), "reevaluation resolved diff boundary missing");

const closurePaths = [...manifest.includeExact.map((entry) => entry.path), ...manifest.mergeSemantic.map((entry) => entry.path)]
  .filter((value) => /\.(?:m?js|jsx)$/.test(value));
const candidates = (filePath) => [filePath, `${filePath}.js`, `${filePath}.mjs`, path.join(filePath, "index.js")];
const resolveImport = (owner, specifier) => {
  if (specifier.startsWith("@/")) return candidates(path.join(ROOT, specifier.slice(2))).some(existsSync);
  if (specifier.startsWith(".")) return candidates(path.resolve(ROOT, path.dirname(owner), specifier)).some(existsSync);
  return true;
};
for (const owner of closurePaths) {
  const content = readFileSync(path.join(ROOT, owner), "utf8");
  const specs = new Set();
  for (const regex of [/from\s+["']([^"']+)["']/g, /import\(\s*["']([^"']+)["']\s*\)/g]) {
    for (const match of content.matchAll(regex)) specs.add(match[1]);
  }
  for (const specifier of specs) check(resolveImport(owner, specifier), `unresolved import ${owner} -> ${specifier}`);
}
for (const command of Object.values(pkg.scripts)) {
  const match = String(command).match(/(?:^|&&\s*|;\s*)node\s+([^\s]+)/);
  if (match && match[1].startsWith("scripts/")) check(existsSync(path.join(ROOT, match[1])), `package script target missing: ${match[1]}`);
}

console.log(`verify-candidate-policy-main-integration: PASS (${assertions} assertions; automatic Vercel Git deployments disabled; 60 exact, 1 CI portability semantic, 7 integration semantic, 38 absent, 302 main preserved)`);
