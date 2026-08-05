import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { SHARED_SKIN_DECISION_CONTEXT_VERSION } from "../lib/shared-skin-decision-context-v4.js";

const ROOT = process.cwd();
const BASE_SHA = "6604ca37087eb063e793218d0b734e89c36f228d";
const SOURCE_LINEAGE = Object.freeze({
  sharedContextV4: "3f697f3e5c2ae607c9d86af3f16bdfe2cdb43037",
  integratedEvaluationV2: "697c7314ff52e16b9254bc8693e2f5fce7030009",
  unifiedVision: "c88d3c89801d5de73c307a925bf811f21c5198ff",
  unifiedVisionBase: "a2b67db32239278c1b8d23658fefadc902f1fac2",
  recommendationReference: "783afb91a964f5d762f46846f9ef854902b48e95"
});
const ADMIN_V1_ROUTES = new Set([
  "app/api/admin/product-reviews/preflight/route.js",
  "app/api/admin/product-reviews/confirm/route.js",
  "app/api/admin/product-reviews/import/dry-run/route.js",
  "app/api/admin/product-reviews/import/confirm/route.js"
]);
const ADMIN_V1_MIGRATIONS = new Set([
  "supabase/migrations/20260804233000_admin_product_candidate_reviews.sql",
  "supabase/migrations/20260804233100_admin_product_candidate_reviews_hardening.sql",
  "supabase/migrations/20260804233200_admin_product_candidate_reviews_security_hardening.sql",
  "supabase/migrations/20260804233300_admin_product_review_import_confirm.sql"
]);
let assertions = 0;
const check = (value, message) => { assertions += 1; assert.ok(value, message); };
const equal = (actual, expected, message) => { assertions += 1; assert.equal(actual, expected, message); };
const read = (relative) => readFileSync(path.join(ROOT, relative), "utf8");
const hash = (value) => createHash("sha256").update(value).digest("hex");

const premiumState = read("lib/premium-decision-state.js");
const contextSource = read("lib/shared-skin-decision-context-v4.js");
const route = read("app/api/analyze/route.js");
const faceRoute = read("app/api/face-reading/route.js");
const appPage = read("app/page.js");
const engine = read("lib/skin-match-decision-engine.js");
const sessionPayload = read("lib/premium-session-payload.js");
const anonymousBoundary = read("lib/security/anonymous-write-grant-core.js");
const visionService = read("lib/server/vision-observation-service.js");
const evaluation = read("scripts/verify-premium-integrated-evaluation-v2.mjs");
const recommendationInvariance = read("scripts/verify-skin-decision-recommendation-invariance.mjs");
const packageJson = JSON.parse(read("package.json"));
const vercel = JSON.parse(read("vercel.json"));

check(SHARED_SKIN_DECISION_CONTEXT_VERSION === "shared-skin-decision-context-v4", "v4 version authority");
check(premiumState.includes('from "./shared-skin-decision-context-v4.js"'), "Premium state imports v4");
check(!premiumState.includes('from "./shared-skin-decision-context.js"'), "Premium state does not bypass v4");
for (const token of [
  "provider_unavailable", "provider_failure", "technical_failure",
  "input_ineligible", "input_insufficient", "factsMayBeInferred: false",
  "normalizeImageAnalysisEligibility"
]) check(contextSource.includes(token), `v4 token ${token}`);

for (const token of [
  "analyzeVisionObservation", "projectSkinObservation", "projectFaceLabResult",
  "buildPremiumFaceLabSummary", "photoEvidenceState", "imageEligibility",
  "imageProviderAttemptCount", "ANALYZE_RESPONSE_SCHEMA_VERSION = 2",
  "resolveCandidateExposurePolicyShadowControl", "runCandidateExposurePolicyShadow",
  "canonicalState: rebuiltPremiumReport", "responseValue: publicDecision",
  "snapshotValue: rebuiltPremiumReport"
]) check(route.includes(token), `analyze route token ${token}`);
check(!route.includes("async function extractPhotoAnalysis"), "duplicate legacy photo provider removed");
check(!appPage.includes('fetch("/api/face-reading"'), "client does not issue duplicate Face Lab provider request");
check(faceRoute.includes("analyzeVisionObservation"), "compatibility route uses canonical provider service");
check(faceRoute.includes("projectFaceLabResult"), "compatibility route projects the canonical eligible Face Lab envelope");

for (const token of [
  "VISION_OBSERVATION_SCHEMA_VERSION", "VISION_OBSERVATION_PROMPT_VERSION",
  "AbortController", "timeout", "MAX_RESPONSE_BYTES", "redirect: \"manual\"",
  "logProviderRuntimeEvent"
]) check(visionService.includes(token), `Vision service boundary ${token}`);
for (const forbidden of ["imageDataUrl", "rawProviderResponse", "Authorization: Bearer ${apiKey}"]) {
  check(!visionService.includes(`console.log(${forbidden}`), `Vision service does not log ${forbidden}`);
}

check(engine.includes("photoAnalysis?.imageEligibility?.skinAnalysisEligible !== true"), "photo scoring eligibility gate");
check(engine.includes('reasons.push("redness-deep-clean")'), "legacy redness penalty semantics retained");
check(/total\s*-=\s*18/.test(engine), "legacy -18 remains unchanged");
check(!engine.includes("cleansing_profile"), "no cleanser structured authority activation");
check(engine.includes("...(photoEvidenceState ? { photoEvidenceState } : {})"), "legacy-null response compatibility");

for (const token of ["photoEvidenceState", "imageEligibility"]) {
  check(sessionPayload.includes(token), `session payload retains ${token}`);
  check(anonymousBoundary.includes(`\"${token}\"`), `anonymous field allowlist includes ${token}`);
}
check(anonymousBoundary.includes("normalizePhotoEvidenceState"), "anonymous photo state is bounded");
check(!anonymousBoundary.includes("rawProviderResponse:"), "anonymous boundary does not persist raw provider response");

for (const token of [
  "evaluateCandidateExposurePolicy", "runCandidateExposurePolicyShadow",
  "S09_PHOTO_UNAVAILABLE", "provider-unavailable", "technical-failure",
  "input-ineligible", "input-insufficient", "S21_RUNTIME_SHADOW_PARITY"
]) check(evaluation.includes(token), `evaluation v2 token ${token}`);
for (const staleImport of [
  "candidate-policy-goal-context.js", "candidate-policy-runtime-safety.js",
  "candidate-policy-current-findings-context.js", "evaluator-boundary-policy-runtime.js"
]) check(!evaluation.includes(staleImport), `stale #92 module excluded: ${staleImport}`);
check(recommendationInvariance.includes("actualResponseHashBefore"), "#167 response baseline comparison");
check(recommendationInvariance.includes("candidatePolicyFingerprintBefore"), "#167 CandidatePolicy fingerprint comparison");

for (const script of [
  "verify:shared-skin-decision-context", "verify:premium-integrated-evaluation-v2",
  "verify:unified-vision-pipeline", "verify:skin-decision-persistence-reentry",
  "verify:skin-decision-recommendation-invariance", "verify:skin-decision-engine-closeout"
]) check(Boolean(packageJson.scripts?.[script]), `package script ${script}`);

equal(vercel.git?.deploymentEnabled?.["**"], false, "non-main Vercel deployments disabled");
equal(vercel.git?.deploymentEnabled?.main, true, "main Vercel deployment enabled");
check(!existsSync(path.join(ROOT, ".github/workflows/skin-decision-closeout-source-export.yml")), "temporary source workflow absent");
check(!existsSync(path.join(ROOT, ".github/workflows/skin-decision-closeout-base-export.yml")), "temporary base workflow absent");
check(existsSync(path.join(ROOT, ".github/workflows/skin-decision-engine-closeout.yml")), "durable closeout workflow present");

let diffPaths = [];
let adminRouteDiffPaths = [];
let adminMigrationDiffPaths = [];
const diffBase = process.env.CLOSEOUT_BASE_SHA || "";
if (diffBase && existsSync(path.join(ROOT, ".git"))) {
  diffPaths = execFileSync("git", ["diff", "--name-only", `${diffBase}..HEAD`], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024
  }).split(/\r?\n/).filter(Boolean);
  check(diffPaths.length > 0, "closeout diff is non-empty");
  adminRouteDiffPaths = diffPaths.filter((file) => file.startsWith("app/api/admin/"));
  adminMigrationDiffPaths = diffPaths.filter((file) => file.startsWith("supabase/migrations/"));
  for (const file of adminRouteDiffPaths) {
    check(ADMIN_V1_ROUTES.has(file), `unexpected Admin route in closeout-preservation diff: ${file}`);
  }
  for (const file of adminMigrationDiffPaths) {
    check(ADMIN_V1_MIGRATIONS.has(file), `unexpected migration in closeout-preservation diff: ${file}`);
  }
  check(adminRouteDiffPaths.length === ADMIN_V1_ROUTES.size, "Admin v1 route set incomplete");
  check(adminMigrationDiffPaths.length === ADMIN_V1_MIGRATIONS.size, "Admin v1 migration set incomplete");
  for (const file of diffPaths) {
    check(!file.includes("recommendation-metadata-transport"), `#167 not copied: ${file}`);
    check(!file.includes("cleanser-structured-authority-activation"), `activation absent: ${file}`);
  }
}

mkdirSync(path.join(ROOT, "tmp"), { recursive: true });
const result = {
  version: "skin-decision-engine-current-main-closeout-v1",
  status: "ENGINE_CLOSEOUT_PRESERVED_WITH_ADMIN_V1_INTEGRATION",
  baseSha: BASE_SHA,
  headSha: process.env.CLOSEOUT_HEAD_SHA || null,
  sourceLineage: SOURCE_LINEAGE,
  contextVersion: SHARED_SKIN_DECISION_CONTEXT_VERSION,
  evaluationVersion: "premium-integrated-evaluation-pack-v2",
  analyzeResponseSchemaVersion: 2,
  recommendationActivation: false,
  adminMutation: adminRouteDiffPaths.length > 0,
  migrationMutation: adminMigrationDiffPaths.length > 0,
  adminRouteDiffPaths,
  adminMigrationDiffPaths,
  candidateExposureActivation: false,
  vercelPolicy: vercel.git.deploymentEnabled,
  assertions,
  diffPaths,
  semanticDigests: {
    context: hash(contextSource),
    analyzeRoute: hash(route),
    evaluation: hash(evaluation),
    recommendationInvariance: hash(recommendationInvariance)
  }
};
writeFileSync(path.join(ROOT, "tmp/skin-decision-engine-closeout.json"), `${JSON.stringify(result, null, 2)}\n`);
console.log(`verify-skin-decision-engine-current-main-closeout: PASS (${assertions} assertions)`);
