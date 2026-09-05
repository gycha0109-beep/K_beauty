import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (path) => JSON.parse(readFileSync(join(repoRoot, path), "utf8"));

const listing = readJson("docs/store/mobile-store-listing-final.json");
const claims = readJson("docs/store/mobile-listing-claims-readiness.json");
const health = readJson("apps/mobile/google-play-health-apps-declaration.json");

const charCount = (value) => Array.from(value).length;
const byteCount = (value) => Buffer.byteLength(value, "utf8");

assert.equal(listing.schemaVersion, "mobile-store-listing-final-v1");
assert.equal(listing.slice, "MOBILE-18");
assert.equal(listing.status, "repository_listing_copy_and_support_url_frozen_assets_pending");
assert.equal(listing.scope.runtimeBehaviorChanged, false);
assert.equal(listing.scope.finalMarketingCopyFrozen, true);
assert.equal(listing.scope.storeAssetsFrozen, false);
assert.equal(listing.scope.appStoreSupportUrlFrozen, true);
assert.equal(listing.appStore.appName, "BEJEWELY");
assert.equal(listing.googlePlay.appName, "BEJEWELY");

const appStoreLimits = listing.metadataConstraints.appStore;
assert.ok(charCount(listing.appStore.appName) <= appStoreLimits.nameMaxCharacters);
for (const [locale, copy] of Object.entries(listing.appStore.localizations)) {
  assert.ok(charCount(copy.subtitle) <= appStoreLimits.subtitleMaxCharacters, `${locale} App Store subtitle exceeds limit`);
  assert.ok(charCount(copy.promotionalText) <= appStoreLimits.promotionalTextMaxCharacters, `${locale} App Store promotional text exceeds limit`);
  assert.ok(charCount(copy.description) <= appStoreLimits.descriptionMaxCharacters, `${locale} App Store description exceeds limit`);
  assert.ok(byteCount(copy.keywords) <= appStoreLimits.keywordsMaxBytes, `${locale} App Store keywords exceed byte limit`);
}

const playLimits = listing.metadataConstraints.googlePlay;
assert.ok(charCount(listing.googlePlay.appName) <= playLimits.appNameMaxCharacters);
for (const [locale, copy] of Object.entries(listing.googlePlay.localizations)) {
  assert.ok(charCount(copy.shortDescription) <= playLimits.shortDescriptionMaxCharacters, `${locale} Play short description exceeds limit`);
  assert.ok(charCount(copy.fullDescription) <= playLimits.fullDescriptionMaxCharacters, `${locale} Play full description exceeds limit`);
  assert.doesNotMatch(copy.shortDescription, /download now|install now|try now|지금 다운로드|지금 설치/i);
}

const englishPlay = listing.googlePlay.localizations["en-US"].fullDescription;
const koreanPlay = listing.googlePlay.localizations.ko.fullDescription;
const englishDisclaimer = health.storeListingBoundary.englishDisclaimer;
const koreanDisclaimer = health.storeListingBoundary.koreanDisclaimer;
const englishCamera = health.storeListingBoundary.cameraCompatibilityEnglish;
const koreanCamera = health.storeListingBoundary.cameraCompatibilityKorean;

assert.ok(englishPlay.includes(englishDisclaimer), "English Play description must include the frozen Health Apps disclaimer");
assert.ok(koreanPlay.includes(koreanDisclaimer), "Korean Play description must include the frozen Health Apps disclaimer");
assert.ok(englishPlay.includes(englishCamera), "English Play description must include the frozen camera compatibility copy");
assert.ok(koreanPlay.includes(koreanCamera), "Korean Play description must include the frozen camera compatibility copy");

const stripPlayBoundary = (value, camera, disclaimer) => value.replace(camera, "").replace(disclaimer, "");
const marketingCopy = [
  ...Object.values(listing.appStore.localizations).flatMap((copy) => [copy.subtitle, copy.promotionalText, copy.description]),
  ...Object.values(listing.googlePlay.localizations).flatMap((copy, index) => [
    copy.shortDescription,
    stripPlayBoundary(
      copy.fullDescription,
      index === 0 ? englishCamera : koreanCamera,
      index === 0 ? englishDisclaimer : koreanDisclaimer
    )
  ])
].join("\n");

const forbiddenClaimPatterns = [
  /diagnos(?:e|es|is) acne/i,
  /diagnos(?:e|es|is) (?:a )?(?:disease|medical condition)/i,
  /treats? (?:a )?(?:disease|medical condition)/i,
  /cures? (?:a )?(?:disease|medical condition)/i,
  /prevent(?:s|ion)? (?:a )?(?:disease|medical condition)/i,
  /clinical accuracy/i,
  /dermatologist[- ]equivalent/i,
  /medical[- ]device function/i,
  /guaranteed (?:skin improvement|product efficacy)/i,
  /질환.*진단/,
  /질환.*치료/,
  /임상.*정확/,
  /피부과.*동등/,
  /의료기기.*기능/,
  /개선.*보장/
];
for (const pattern of forbiddenClaimPatterns) {
  assert.doesNotMatch(marketingCopy, pattern, `store marketing copy crosses claim boundary: ${pattern}`);
}

assert.equal(listing.googlePlay.featureGraphic.status, "asset_pending");
assert.equal(listing.googlePlay.featureGraphic.requiredSize, "1024x500");
assert.equal(listing.googlePlay.phoneScreenshots.status, "repository_capture_visual_approved");
assert.ok(listing.googlePlay.phoneScreenshots.submissionMinimum >= 2);
assert.ok(listing.googlePlay.phoneScreenshots.targetCount >= 4);
assert.equal(listing.googlePlay.phoneScreenshots.targetPortraitSize, "1080x1920");
assert.deepEqual(listing.googlePlay.phoneScreenshots.captureOwners, ["MOBILE-20A", "MOBILE-20B"]);
assert.deepEqual(listing.googlePlay.phoneScreenshots.captureFrames, ["home", "analyze", "results", "diary"]);
assert.equal(listing.googlePlay.phoneScreenshots.consoleSubmissionStatus, "external_pending");

assert.equal(listing.appStore.screenshots.status, "repository_capture_visual_approved_submission_packaging_pending");
assert.equal(listing.appStore.screenshots.captureSize, "1080x1920");
assert.deepEqual(listing.appStore.screenshots.captureOwners, ["MOBILE-20A", "MOBILE-20B"]);
assert.equal(listing.appStore.screenshots.submissionPackagingStatus, "pending");

assert.equal(listing.screenshotPlan.status, "repository_capture_visual_approved");
assert.deepEqual(listing.screenshotPlan.captureOwners, ["MOBILE-20A", "MOBILE-20B"]);
assert.deepEqual(listing.screenshotPlan.captureLanguages, ["en", "ko"]);
assert.match(listing.screenshotPlan.validationPolicy, /new candidate head invalidates prior exact-head screenshot approval/i);
assert.match(listing.screenshotPlan.validationPolicy, /merged-main must be re-captured and visually reviewed again/i);

assert.equal(listing.appStore.supportUrl.status, "repository_route_implemented_external_contact_pending");
assert.equal(listing.appStore.supportUrl.value, "https://k-beauty-two.vercel.app/support");
assert.equal(listing.appStore.supportUrl.englishValue, "https://k-beauty-two.vercel.app/en/support");
assert.equal(listing.appStore.supportUrl.contactEnvironmentKey, "NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL");
assert.equal(listing.appStore.supportUrl.contactStatus, "external_pending");
assert.equal(listing.repositoryPending.includes("app_store_support_route_and_url"), false);
assert.equal(listing.repositoryPending.includes("app_store_screenshots"), false);
assert.equal(listing.repositoryPending.includes("google_play_phone_screenshots"), false);
assert.ok(listing.repositoryPending.includes("app_store_screenshot_submission_packaging"));
assert.ok(listing.repositoryPending.includes("google_play_feature_graphic"));
assert.ok(listing.externalPending.includes("public_support_contact_configuration"));
assert.ok(listing.externalPending.includes("app_store_connect_metadata_submission"));
assert.ok(listing.externalPending.includes("google_play_console_metadata_submission"));

assert.equal(claims.scope.finalMarketingCopyFrozen, true);
assert.equal(claims.finalCopyGate.status, "copy_frozen_assets_pending");
assert.equal(claims.finalCopyGate.finalCopyPath, "docs/store/mobile-store-listing-final.json");

console.log("MOBILE_18_APP_STORE_METADATA_LIMITS=PASS");
console.log("MOBILE_18_GOOGLE_PLAY_METADATA_LIMITS=PASS");
console.log("MOBILE_18_HEALTH_LISTING_BOUNDARY=PASS");
console.log("MOBILE_18_COSMETIC_CLAIM_BOUNDARY=PASS");
console.log("MOBILE_18_SCREENSHOT_CAPTURE_VISUAL_APPROVAL=PASS");
console.log("MOBILE_18_SUPPORT_URL_FROZEN_REMAINING_ASSETS_PENDING=PASS");
