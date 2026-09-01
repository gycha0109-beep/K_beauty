import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ratingPath = join(repoRoot, "docs", "store", "mobile-content-rating-readiness.json");
const readinessPath = join(repoRoot, "apps", "mobile", "store-readiness.json");
const appConfigPath = join(repoRoot, "apps", "mobile", "app.json");
const mobilePackagePath = join(repoRoot, "apps", "mobile", "package.json");
const visionBoundaryPath = join(repoRoot, "lib", "vision-observation-contract.js");

const rating = JSON.parse(readFileSync(ratingPath, "utf8"));
const readiness = JSON.parse(readFileSync(readinessPath, "utf8"));
const appConfig = JSON.parse(readFileSync(appConfigPath, "utf8"));
const mobilePackage = JSON.parse(readFileSync(mobilePackagePath, "utf8"));
const visionBoundary = readFileSync(visionBoundaryPath, "utf8");

assert.equal(rating.schemaVersion, "mobile-store-content-rating-readiness-v1");
assert.equal(rating.slice, "MOBILE-16E");
assert.equal(rating.status, "repository_prepared_console_submission_pending");
assert.equal(rating.authority.appleAgeRatingCalculation, "external_pending");
assert.equal(rating.authority.appleAppStoreConnectSubmission, "external_pending");
assert.equal(rating.authority.googleIarcCalculation, "external_pending");
assert.equal(rating.authority.googlePlayConsoleSubmission, "external_pending");

assert.equal(rating.apple.ageRatingRequired, true);
assert.equal(rating.apple.capabilities.unrestrictedWebAccess, false);
assert.equal(rating.apple.capabilities.userGeneratedContent, false);
assert.equal(rating.apple.capabilities.messagingAndChat, false);
assert.equal(rating.apple.capabilities.advertising, false);
assert.equal(rating.apple.capabilities.socialMedia, false);
assert.match(rating.apple.capabilities.userGeneratedContentBasis, /does not broadly distribute user-created content/i);
assert.equal(rating.apple.medicalOrWellness.healthOrWellnessTopics, true);
assert.equal(rating.apple.medicalOrWellness.medicalOrTreatmentInformation, "none");
assert.equal(rating.apple.publishedDescriptorExpectation.finalRating, "external_calculation_required");
assert.equal(rating.apple.publishedDescriptorExpectation.kidsCategory, false);

for (const group of [
  rating.apple.matureThemes,
  rating.apple.sexualityOrNudity,
  rating.apple.violence
]) {
  for (const value of Object.values(group)) {
    assert.equal(value, "none");
  }
}
assert.equal(rating.apple.chanceBasedActivities.contests, "none");
assert.equal(rating.apple.chanceBasedActivities.simulatedGambling, "none");
assert.equal(rating.apple.chanceBasedActivities.gambling, false);
assert.equal(rating.apple.chanceBasedActivities.lootBoxes, false);

assert.equal(rating.googlePlay.contentRatingRequired, true);
assert.equal(rating.googlePlay.ratingSystem, "IARC");
assert.equal(rating.googlePlay.questionnaireCategory, "Utility, Productivity, Communication, or Other");
assert.equal(rating.googlePlay.onlineInteractionOrContentExchange, false);
assert.equal(rating.googlePlay.finalRating, "external_iarc_calculation_required");
assert.equal(rating.googlePlay.retakeWhenRatingAnswersChange, true);
for (const value of Object.values(rating.googlePlay.contentTraits)) {
  assert.equal(value, "none");
}

assert.equal(appConfig.expo.name, "BEJEWELY");
assert.equal(appConfig.expo.android?.package, "com.bejewely.mobile");
assert.equal(appConfig.expo.ios?.bundleIdentifier, "com.bejewely.mobile");
assert.match(visionBoundary, /This is not medical diagnosis/);
assert.match(visionBoundary, /Do not infer hydration, barrier state, acne disease, UV damage, or sensitivity beyond cautious visible cues\./);

const dependencyNames = Object.keys({
  ...(mobilePackage.dependencies || {}),
  ...(mobilePackage.devDependencies || {})
});
const adDependencyPattern = /(admob|google-mobile-ads|facebook.*ads|applovin|unity-ads|ironsource)/i;
assert.equal(
  dependencyNames.some((name) => adDependencyPattern.test(name)),
  false,
  "Advertising=false requires no known mobile ad SDK dependency"
);

assert.equal(rating.separateDeclarations.googlePlayTargetAudienceAndContent, "external_pending_separate_from_iarc_content_rating");
assert.equal(rating.separateDeclarations.appleRegulatedMedicalDeviceStatus, "not_asserted_by_this_slice");
assert.equal(rating.separateDeclarations.googlePlayHealthAppsDeclaration, "owned_by_MOBILE_16D");

const readinessContract = readiness.mobile16EContract;
assert.ok(readinessContract, "Missing MOBILE-16E readiness contract");
assert.equal(readinessContract.storeContentRatingReadinessPath, "docs/store/mobile-content-rating-readiness.json");
assert.equal(readinessContract.verifier, "scripts/verify-mobile-16e-content-rating-readiness.mjs");
assert.equal(readinessContract.workflow, ".github/workflows/mobile-16e-content-rating-readiness.yml");
assert.equal(readinessContract.appleHealthOrWellnessTopics, true);
assert.equal(readinessContract.appleMedicalOrTreatmentInformation, "none");
assert.equal(readinessContract.appleUserGeneratedContentCapability, false);
assert.equal(readinessContract.appleSocialMediaCapability, false);
assert.equal(readinessContract.googleIarcCategory, "Utility, Productivity, Communication, or Other");
assert.equal(readinessContract.googleOnlineInteractionOrContentExchange, false);
assert.equal(readinessContract.appleFinalRatingStatus, "external_pending");
assert.equal(readinessContract.googleIarcFinalRatingStatus, "external_pending");
assert.equal(readinessContract.consoleSubmissionStatus, "external_pending");

const compliance = new Map(readiness.complianceInventory.map((item) => [item.id, item]));
assert.equal(compliance.get("store_age_rating_and_content_declarations")?.status, "repository_prepared_console_submission_pending");
assert.equal(compliance.get("store_age_rating_and_content_declarations")?.owner, "MOBILE-16E");

const externalBlockers = new Map(readiness.externalBlockers.map((item) => [item.id, item]));
for (const blockerId of [
  "apple_age_rating_submission",
  "google_play_iarc_content_rating_submission",
  "google_play_target_audience_and_content"
]) {
  assert.equal(externalBlockers.get(blockerId)?.status, "external_pending", `Missing external blocker: ${blockerId}`);
}

assert.ok(
  readiness.preflightMeaning.passDoesNotMean.some((line) => /final BEJEWELY age rating/i.test(line)),
  "Preflight must not claim Apple age-rating authority"
);
assert.ok(
  readiness.preflightMeaning.passDoesNotMean.some((line) => /IARC or Google Play/i.test(line)),
  "Preflight must not claim IARC/Google content-rating authority"
);

console.log("MOBILE_16E_STORE_CONTENT_RATING_BASIS=PASS");
console.log("MOBILE_16E_APPLE_FINAL_RATING_AUTHORITY=EXTERNAL_PENDING");
console.log("MOBILE_16E_GOOGLE_IARC_FINAL_RATING_AUTHORITY=EXTERNAL_PENDING");
console.log("MOBILE_16E_STORE_READINESS_SYNC=PASS");
