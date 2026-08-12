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
const CLOSEOUT_SEMANTIC_BLOBS = Object.freeze({
  "lib/candidate-exposure-policy-observability.js": "1c108be104d020e80a7c571d586a27013bb9d646",
  "scripts/verify-candidate-exposure-policy-shadow-runtime.mjs": "3a02dc8a47e2d9bf037f44f349ba87884206bb2d",
  "app/api/analyze/route.js": "cc059eba680034d28e1ade0b1a8147d43a8b30f7",
  "package.json": "53eb387437edb818e80d901f1bb92803fb48d219",
  "scripts/run-security-closeout-verifier-suite.mjs": "3885fc4676170b80b81dfe354f40ee52fd7b43f8",
  "components/onboarding/SurveyFlow.js": "95a7edeb33d2bf2b7cee094e38c18554674c6778",
  "scripts/verify-sec06-saved-report-boundary.mjs": "32410c3dab260ef861e0fbc687cf30dde998719c"
});
const ADMIN_PRODUCT_CURRENT_MAIN_SEMANTIC_PATHS = new Set([
  ".codex/AI_WORK_LOG.md",
  "app/admin/layout.js",
  "lib/admin/access.js",
  "package.json",
  "scripts/run-security-closeout-verifier-suite.mjs"
]);
const SOLO_ALIGNMENT_CURRENT_MAIN_SEMANTIC_PATHS = new Set([
  "packages/face-contracts/src/synthetic-solo-assessment/constants.js",
  "packages/face-contracts/src/synthetic-solo-assessment/contract.js",
  "tools/synthetic-evaluation/package.json",
  "tools/synthetic-evaluation/src/index.js",
  "tools/synthetic-evaluation/src/solo-assessment/cli/solo.js",
  "tools/synthetic-evaluation/src/solo-assessment/orchestrator.js",
  "tools/synthetic-evaluation/src/solo-assessment/source-preflight.js",
  "tools/synthetic-evaluation/src/solo-assessment/storage.js",
  "tools/synthetic-evaluation/tests/solo-assessment/architecture-boundary.test.mjs"
]);
const expectedBlob = (entry, legacyKey) => CLOSEOUT_SEMANTIC_BLOBS[entry.path] || entry[legacyKey];
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
  check(hash(entry.path) === expectedBlob(entry, "sourceBlob"), `source/closeout blob mismatch: ${entry.path}`);
}
for (const entry of manifest.preserveMain) {
  check(existsSync(path.join(ROOT, entry.path)), `missing current-main path: ${entry.path}`);
  if (ADMIN_PRODUCT_CURRENT_MAIN_SEMANTIC_PATHS.has(entry.path) || SOLO_ALIGNMENT_CURRENT_MAIN_SEMANTIC_PATHS.has(entry.path)) continue;
  check(hash(entry.path) === expectedBlob(entry, "mainBlob"), `current-main/closeout blob mismatch: ${entry.path}`);
}
for (const entry of manifest.excludeSourceOnly) {
  check(!existsSync(path.join(ROOT, entry.path)), `excluded source-only path present: ${entry.path}`);
}
for (const entry of manifest.mergeSemantic) {
  check(existsSync(path.join(ROOT, entry.path)), `missing semantic path: ${entry.path}`);
  if (ADMIN_PRODUCT_CURRENT_MAIN_SEMANTIC_PATHS.has(entry.path) || SOLO_ALIGNMENT_CURRENT_MAIN_SEMANTIC_PATHS.has(entry.path)) continue;
  check(hash(entry.path) === expectedBlob(entry, "resultBlob"), `semantic/closeout result blob mismatch: ${entry.path}`);
}
const candidateManifestProtectedPaths = new Set([
  ...manifest.preserveMain.map((entry) => entry.path),
  ...manifest.mergeSemantic.map((entry) => entry.path)
]);
for (const filePath of ADMIN_PRODUCT_CURRENT_MAIN_SEMANTIC_PATHS) {
  check(candidateManifestProtectedPaths.has(filePath), `unregistered admin semantic exception: ${filePath}`);
}
for (const filePath of SOLO_ALIGNMENT_CURRENT_MAIN_SEMANTIC_PATHS) {
  check(candidateManifestProtectedPaths.has(filePath), `unregistered Solo alignment semantic exception: ${filePath}`);
}

const adminIntegrationWorkLog = readFileSync(path.join(ROOT, ".codex/AI_WORK_LOG.md"), "utf8");
check(adminIntegrationWorkLog.includes("ADMIN-PRODUCT-INTEGRATION-1"), "admin integration work log missing");
const adminIntegrationLayout = readFileSync(path.join(ROOT, "app/admin/layout.js"), "utf8");
check(adminIntegrationLayout.includes("AdminNavigation"), "admin navigation semantic delta missing");
check(adminIntegrationLayout.includes("capabilities={access.capabilities}"), "admin capability projection lost");
const adminIntegrationAccess = readFileSync(path.join(ROOT, "lib/admin/access.js"), "utf8");
check(adminIntegrationAccess.includes("userId: null"), "denied admin actor binding missing");
check(adminIntegrationAccess.includes("userId: user.id"), "authenticated admin actor binding missing");
check(adminIntegrationAccess.includes("requireAdminCapability"), "admin capability guard lost");
const adminIntegrationPackage = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8"));
for (const scriptName of [
  "verify:admin-product-candidate-reviews",
  "verify:admin-product-review-import-confirm",
  "verify:admin-product-review-import-ui",
  "verify:admin-product-review-import-routes",
  "verify:admin-product-current-main-integration"
]) {
  check(Boolean(adminIntegrationPackage.scripts?.[scriptName]), `admin integration package script missing: ${scriptName}`);
}
const adminIntegrationSecuritySuite = readFileSync(path.join(ROOT, "scripts/run-security-closeout-verifier-suite.mjs"), "utf8");
check(
  adminIntegrationSecuritySuite.split('"verify-admin-product-candidate-reviews.mjs"').length - 1 === 1,
  "admin product verifier manifest count mismatch"
);

const soloAlignmentConstants = readFileSync(
  path.join(ROOT, "packages/face-contracts/src/synthetic-solo-assessment/constants.js"),
  "utf8"
);
for (const token of [
  'SOLO_INTENT_ASSESSMENT_SCHEMA_VERSION = "solo-intent-assessment-v1"',
  'SOLO_WAVE_BRIEF_SCHEMA_VERSION = "solo-wave-brief-v1"',
  'SOLO_CUE_ALIGNMENT_SCHEMA_VERSION = "solo-cue-alignment-v1"',
  'SOLO_WAVE_ALIGNMENT_REPORT_SCHEMA_VERSION = "solo-wave-alignment-report-v1"',
  '"exact_match", "under_target", "over_target", "contradictory", "unverifiable"',
  '"human_redness_color_discrimination_reliability_limited"',
  '"blemish_visual_cue_not_dermatological_diagnosis"'
]) check(soloAlignmentConstants.includes(token), `Solo alignment constants semantic delta missing: ${token}`);
const soloAlignmentContract = readFileSync(
  path.join(ROOT, "packages/face-contracts/src/synthetic-solo-assessment/contract.js"),
  "utf8"
);
for (const token of [
  "export function validateSoloIntentAssessment(value)",
  "export function validateSoloWaveBrief(value)",
  "export function validateSoloCueAlignment(value)",
  "export function validateSoloWaveAlignmentReport(value)",
  "value.sameSlotQualityRegenerationAllowed === false",
  'value[axis] === "not_available"'
]) check(soloAlignmentContract.includes(token), `Solo alignment contract semantic delta missing: ${token}`);

const soloToolkitPackage = JSON.parse(readFileSync(path.join(ROOT, "tools/synthetic-evaluation/package.json"), "utf8"));
check(soloToolkitPackage.scripts?.solo === "node src/solo-assessment/cli/solo.js", "Solo CLI script drift");
for (const scriptName of ["test", "verify"]) {
  check(String(soloToolkitPackage.scripts?.[scriptName] || "").includes("tests/solo-assessment/alignment-diagnostic.test.mjs"), `Solo alignment test wiring missing: ${scriptName}`);
}

const soloToolkitIndex = readFileSync(path.join(ROOT, "tools/synthetic-evaluation/src/index.js"), "utf8");
for (const token of [
  "prepareSoloWave",
  "revealSoloIntent",
  "submitSoloIntentAssessment",
  "confirmSoloWaveBrief",
  "linkSoloBriefToCheckpoint",
  "deriveSoloAlignmentReport",
  "verifySoloCueAlignmentIntegrity",
  "verifySoloWaveAlignmentReportIntegrity"
]) check(soloToolkitIndex.includes(token), `Solo public export semantic delta missing: ${token}`);

const soloCli = readFileSync(path.join(ROOT, "tools/synthetic-evaluation/src/solo-assessment/cli/solo.js"), "utf8");
for (const action of ["prepare_wave", "claim", "screen", "reveal", "assess", "brief", "link_checkpoint", "derive_alignment_report"]) {
  check(soloCli.includes(`request.action === "${action}"`), `Solo CLI action missing: ${action}`);
}
check(soloCli.includes("deriveSoloAlignmentReport"), "Solo alignment CLI orchestration missing");

const soloOrchestrator = readFileSync(path.join(ROOT, "tools/synthetic-evaluation/src/solo-assessment/orchestrator.js"), "utf8");
for (const token of [
  "export async function revealSoloIntent",
  "export async function submitSoloIntentAssessment",
  "export async function confirmSoloWaveBrief",
  "export async function linkSoloBriefToCheckpoint",
  "export async function deriveSoloAlignmentReport",
  "createSoloCueAlignment",
  "createSoloWaveAlignmentReport",
  "saveSoloAlignmentReport",
  "solo_alignment_reveal_required"
]) check(soloOrchestrator.includes(token), `Solo orchestrator semantic delta missing: ${token}`);

const soloSourcePreflight = readFileSync(path.join(ROOT, "tools/synthetic-evaluation/src/solo-assessment/source-preflight.js"), "utf8");
for (const token of [
  "export async function preflightSoloWaveSource",
  "includeObservationObjects = false",
  "verifyObservationSource",
  "observationObject",
  "writesPerformed: 0"
]) check(soloSourcePreflight.includes(token), `Solo source preflight semantic delta missing: ${token}`);

const soloStorage = readFileSync(path.join(ROOT, "tools/synthetic-evaluation/src/solo-assessment/storage.js"), "utf8");
for (const token of [
  "saveSoloReveal",
  "saveSoloIntentAssessment",
  "saveSoloWaveBrief",
  "saveSoloCheckpointLink",
  "saveSoloAlignmentReport",
  "alignment-diagnostics",
  "writeImmutableJson"
]) check(soloStorage.includes(token), `Solo storage semantic delta missing: ${token}`);

const soloArchitectureBoundary = readFileSync(path.join(ROOT, "tools/synthetic-evaluation/tests/solo-assessment/architecture-boundary.test.mjs"), "utf8");
for (const token of [
  "T11 has no Provider, browser, DB, shell, upload, or production execution path",
  "T11 does not import T5 consensus, T6 promotion, T8 mutation, or T9 dataset operations",
  "deriveSoloAlignmentReport",
  "createSoloCueAlignment",
  "createSoloWaveAlignmentReport"
]) check(soloArchitectureBoundary.includes(token), `Solo architecture boundary semantic delta missing: ${token}`);

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
check(route.includes("analyzeVisionObservation"), "closeout Vision producer missing");
check(route.includes("photoEvidenceState"), "closeout bounded photo state missing");
check(route.includes("imageEligibility"), "closeout image eligibility missing");

const observability = readFileSync(path.join(ROOT, "lib/candidate-exposure-policy-observability.js"), "utf8");
check(observability.includes("ENUMERATED_AGGREGATE_COUNT_MAPS"), "aggregate count-map privacy boundary missing");
check(observability.includes("function validateCountMap"), "aggregate enum validation missing");
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
const deploymentEnabled = vercelConfig.git?.deploymentEnabled;
check(deploymentEnabled && typeof deploymentEnabled === "object" && !Array.isArray(deploymentEnabled), "Vercel deployment policy must be branch-scoped");
check(JSON.stringify(Object.keys(deploymentEnabled).sort()) === JSON.stringify(["**", "main"]), "only globstar deny and main allow rules are permitted");
check(deploymentEnabled["**"] === false, "all non-main Vercel Git deployments, including slash-named branches, must remain disabled");
check(deploymentEnabled.main === true, "main automatic Vercel Production deployment must remain enabled");
check(vercelConfig.github?.autoAlias !== false, "main automatic Vercel aliasing must remain enabled");
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

console.log(`verify-candidate-policy-main-integration: PASS (${assertions} assertions; latest closeout semantics preserved; main-only automatic Vercel deployment with globstar preview deny enforced; 5 approved Admin semantic deltas; Solo alignment semantic drift gated)`);
