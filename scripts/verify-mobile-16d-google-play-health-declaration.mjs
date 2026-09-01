import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const declarationPath = join(repoRoot, "apps", "mobile", "google-play-health-apps-declaration.json");
const readinessPath = join(repoRoot, "apps", "mobile", "store-readiness.json");
const visionBoundaryPath = join(repoRoot, "lib", "vision-observation-contract.js");
const analyzeScreenPath = join(repoRoot, "apps", "mobile", "app", "analyze.tsx");

const declaration = JSON.parse(readFileSync(declarationPath, "utf8"));
const readiness = JSON.parse(readFileSync(readinessPath, "utf8"));
const visionBoundary = readFileSync(visionBoundaryPath, "utf8");
const analyzeScreen = readFileSync(analyzeScreenPath, "utf8");

assert.equal(declaration.schemaVersion, "mobile-google-play-health-apps-declaration-v1");
assert.equal(declaration.slice, "MOBILE-16D");
assert.equal(declaration.status, "repository_prepared_play_console_submission_pending");
assert.equal(declaration.authority.googlePlayHealthAppsDeclaration, "external_pending");
assert.equal(declaration.authority.regulatoryMedicalDeviceStatus, "not_asserted_by_repository");

assert.equal(declaration.declaration.requiredForPublishedGooglePlayApps, true);
assert.equal(declaration.declaration.declaresHealthRelatedFeature, true);
assert.equal(declaration.declaration.medicalDeviceAppsSelected, false);
assert.deepEqual(declaration.declaration.selectedFeatures, [
  {
    section: "Medical",
    category: "Diseases and Conditions Management",
    taxonomyExample: "skin care",
    basis: declaration.declaration.selectedFeatures[0].basis
  }
]);
assert.match(declaration.declaration.selectedFeatures[0].basis, /store taxonomy mapping does not change/i);

const forbiddenProductClaims = [
  "medicalDiagnosis",
  "diseaseTreatment",
  "diseaseCure",
  "diseasePrevention",
  "clinicalDecisionSupport",
  "medicationOrPrescriptionManagement",
  "medicalDeviceFunction",
  "regulatedMedicalDeviceClaim"
];
for (const key of forbiddenProductClaims) {
  assert.equal(declaration.productBoundary[key], false, `${key} must remain false`);
}
assert.equal(declaration.productBoundary.primaryPurpose, "cosmetic_skin_care_and_product_personalization");

assert.equal(declaration.storeListingBoundary.runtimeMedicalDisclaimerAdded, false);
assert.equal(declaration.storeListingBoundary.placement, "google_play_app_description");
assert.match(declaration.storeListingBoundary.englishDisclaimer, /not a medical device/i);
assert.match(declaration.storeListingBoundary.englishDisclaimer, /does not diagnose, treat, cure, or prevent/i);
assert.match(declaration.storeListingBoundary.englishDisclaimer, /consult a qualified healthcare professional/i);
assert.match(declaration.storeListingBoundary.koreanDisclaimer, /의료기기가 아니며/);
assert.match(declaration.storeListingBoundary.koreanDisclaimer, /의료 전문가와 상담/);
assert.match(declaration.storeListingBoundary.cameraCompatibilityEnglish, /supported device camera/i);
assert.match(declaration.storeListingBoundary.cameraCompatibilityEnglish, /does not require external medical hardware/i);

assert.match(visionBoundary, /This is not medical diagnosis/);
assert.match(
  visionBoundary,
  /Do not infer hydration, barrier state, acne disease, UV damage, or sensitivity beyond cautious visible cues\./
);
assert.doesNotMatch(analyzeScreen, /native-analyze-health-disclaimer/);
assert.doesNotMatch(analyzeScreen, /not a medical device/i);

const readinessContract = readiness.mobile16DContract;
assert.ok(readinessContract, "Missing MOBILE-16D readiness contract");
assert.equal(
  readinessContract.googlePlayHealthAppsDeclarationPath,
  "apps/mobile/google-play-health-apps-declaration.json"
);
assert.equal(readinessContract.verifier, "scripts/verify-mobile-16d-google-play-health-declaration.mjs");
assert.equal(readinessContract.workflow, ".github/workflows/mobile-16d-google-play-health-declaration.yml");
assert.equal(readinessContract.selectedCategory, "Diseases and Conditions Management");
assert.equal(readinessContract.taxonomyExample, "skin care");
assert.equal(readinessContract.medicalDeviceAppsSelected, false);
assert.equal(readinessContract.runtimeMedicalDisclaimerAdded, false);
assert.equal(readinessContract.sourceContractStatus, "repository_implemented");
assert.equal(readinessContract.playConsoleSubmissionStatus, "external_pending");
assert.equal(readinessContract.playPolicyReviewStatus, "external_pending");

const compliance = new Map(readiness.complianceInventory.map((item) => [item.id, item]));
assert.equal(
  compliance.get("google_play_health_apps_declaration")?.status,
  "repository_prepared_play_console_submission_pending"
);
assert.equal(compliance.get("google_play_health_apps_declaration")?.owner, "MOBILE-16D");
assert.equal(compliance.get("ai_skin_analysis_claim_review")?.status, "pending");

const externalBlockers = new Map(readiness.externalBlockers.map((item) => [item.id, item]));
for (const blockerId of [
  "google_play_health_apps_declaration_submission",
  "google_play_health_policy_review"
]) {
  assert.equal(externalBlockers.get(blockerId)?.status, "external_pending", `Missing external blocker: ${blockerId}`);
}

assert.ok(
  readiness.preflightMeaning.passDoesNotMean.some((line) => /Health Apps declaration/i.test(line) && /accepted/i.test(line)),
  "Preflight must not claim Google acceptance"
);
assert.ok(
  readiness.preflightMeaning.passDoesNotMean.some((line) => /medical-device regulatory determination/i.test(line)),
  "Preflight must not claim regulatory medical-device authority"
);

console.log("MOBILE_16D_GOOGLE_PLAY_HEALTH_DECLARATION=PASS");
console.log("MOBILE_16D_RUNTIME_MEDICAL_UI_ABSENT=PASS");
console.log("MOBILE_16D_MEDICAL_PRODUCT_NONCLAIM_BOUNDARY=PASS");
