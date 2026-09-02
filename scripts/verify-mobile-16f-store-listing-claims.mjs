import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const claims = JSON.parse(readFileSync(join(repoRoot, "docs", "store", "mobile-listing-claims-readiness.json"), "utf8"));
const readiness = JSON.parse(readFileSync(join(repoRoot, "apps", "mobile", "store-readiness.json"), "utf8"));
const health = JSON.parse(readFileSync(join(repoRoot, "apps", "mobile", "google-play-health-apps-declaration.json"), "utf8"));
const analyzeScreen = readFileSync(join(repoRoot, "apps", "mobile", "app", "analyze.tsx"), "utf8");
const visionBoundary = readFileSync(join(repoRoot, "lib", "vision-observation-contract.js"), "utf8");

assert.equal(claims.schemaVersion, "mobile-store-listing-claims-readiness-v1");
assert.equal(claims.slice, "MOBILE-16F");
assert.equal(claims.status, "repository_claim_boundary_ready_final_listing_copy_frozen_assets_pending");
assert.equal(claims.scope.runtimeBehaviorChanged, false);
assert.equal(claims.scope.runtimeMedicalDisclaimerAdded, false);
assert.equal(claims.scope.finalMarketingCopyFrozen, true);

assert.equal(claims.productPositioning.primaryPurpose, "consumer_cosmetic_skin_care_and_product_personalization");
assert.ok(claims.productPositioning.allowed.length >= 4);
assert.ok(claims.productPositioning.prohibited.length >= 6);
for (const requiredBoundary of ["diagnoses", "treats", "clinically", "medical-device", "guaranteed"]) {
  assert.ok(
    claims.productPositioning.prohibited.some((value) => value.toLowerCase().includes(requiredBoundary)),
    `Missing prohibited listing-claim boundary: ${requiredBoundary}`
  );
}

assert.equal(claims.googlePlay.healthAppsDeclarationOwner, "MOBILE-16D");
assert.equal(claims.googlePlay.medicalDeviceAppsSelected, false);
assert.equal(claims.googlePlay.appDescriptionDisclaimerRequiredByCurrentRepositoryDeclarationBasis, true);
assert.equal(
  claims.googlePlay.appDescriptionDisclaimerSource,
  "apps/mobile/google-play-health-apps-declaration.json#storeListingBoundary.englishDisclaimer"
);
assert.equal(claims.googlePlay.disclaimerPlacement, "google_play_app_description");
assert.equal(claims.googlePlay.runtimeDisclaimerRequiredByThisSlice, false);
assert.match(claims.googlePlay.finalPlayListingStatus, /pending/);

assert.equal(claims.apple.medicalFunctionClaimed, false);
assert.equal(claims.apple.healthMeasurementAccuracyClaimed, false);
assert.equal(claims.apple.diagnosisOrTreatmentClaimed, false);
assert.match(claims.apple.finalAppStoreListingStatus, /pending/);

assert.equal(claims.dynamicResultBoundary.serverAuthority, true);
assert.equal(claims.dynamicResultBoundary.mobileClientRewritesResults, false);
assert.equal(claims.dynamicResultBoundary.existingNonDiagnosticPromptBoundaryRequired, true);
assert.equal(claims.finalCopyGate.requiredBeforeSubmission, true);
assert.equal(claims.finalCopyGate.status, "copy_frozen_assets_pending");
assert.equal(claims.finalCopyGate.finalCopyPath, "docs/store/mobile-store-listing-final.json");

assert.equal(health.declaration.medicalDeviceAppsSelected, false);
assert.equal(health.productBoundary.primaryPurpose, "cosmetic_skin_care_and_product_personalization");
assert.equal(health.storeListingBoundary.placement, "google_play_app_description");
assert.match(health.storeListingBoundary.englishDisclaimer, /not a medical device/i);
assert.match(health.storeListingBoundary.englishDisclaimer, /does not diagnose, treat, cure, or prevent/i);
assert.equal(health.storeListingBoundary.runtimeMedicalDisclaimerAdded, false);

assert.match(visionBoundary, /This is not medical diagnosis/);
assert.match(visionBoundary, /Do not infer hydration, barrier state, acne disease, UV damage, or sensitivity beyond cautious visible cues\./);
assert.doesNotMatch(analyzeScreen, /not a medical device/i);
assert.doesNotMatch(analyzeScreen, /의료기기/);

const contract = readiness.mobile16FContract;
assert.ok(contract);
assert.equal(contract.listingClaimsReadinessPath, "docs/store/mobile-listing-claims-readiness.json");
assert.equal(contract.runtimeBehaviorChanged, false);
assert.equal(contract.runtimeMedicalDisclaimerAdded, false);
assert.equal(contract.finalListingCopyStatus, "pending");
assert.equal(contract.sourceContractStatus, "repository_implemented");

const inventory = readiness.complianceInventory.find((item) => item.id === "ai_skin_analysis_claim_review");
assert.ok(inventory);
assert.equal(inventory.owner, "MOBILE-16F");
assert.equal(inventory.status, "repository_claim_boundary_ready_final_listing_copy_pending");

console.log("MOBILE_16F_STORE_LISTING_CLAIM_BOUNDARY=PASS");
console.log("MOBILE_16F_RUNTIME_MEDICAL_DISCLAIMER_ADDED=NO");
console.log("MOBILE_16F_FINAL_LISTING_COPY=FROZEN_ASSETS_PENDING");
