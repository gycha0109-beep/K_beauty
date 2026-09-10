import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const readinessPath = path.join(root, "apps/mobile/store-readiness.json");
const listingPath = path.join(root, "docs/store/mobile-store-listing-final.json");
const assetPath = "apps/mobile/assets/store/bejewely-google-play-feature-graphic-1024x500.png";

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

const listing = readJson(listingPath);
listing.googlePlay.featureGraphic = {
  status: "repository_asset_visual_approved",
  owner: "MOBILE-20C",
  path: assetPath,
  requiredSize: "1024x500",
  format: "24-bit PNG",
  alpha: false,
  languageStrategy: "language_neutral_visual_with_bejewely_wordmark",
  reason: "Repository-qualified feature graphic extends the BEJEWELY visual language with skin-profile, product-pick, AM/PM routine and diary-continuity motifs without medical or guaranteed-outcome claims."
};
listing.repositoryPending = listing.repositoryPending.filter((id) => id !== "google_play_feature_graphic");
writeJson(listingPath, listing);

const readiness = readJson(readinessPath);
readiness.mobile20CFeatureGraphicContract = {
  owner: "MOBILE-20C",
  assetPath,
  requiredSize: "1024x500",
  format: "24-bit PNG",
  alpha: false,
  renderer: "scripts/mobile-20c-feature-graphic.mjs",
  workflow: ".github/workflows/mobile-20c-feature-graphic.yml",
  repositoryStatus: "repository_asset_visual_approved",
  validationPolicy: "Any asset pixel change requires fresh exact-head CI artifact and direct visual review; merged-main requires a fresh artifact and direct visual review again."
};

const blockers = readiness.mobile20StoreCaptureContract?.remainingRepositoryAssetBlockers;
if (Array.isArray(blockers)) {
  readiness.mobile20StoreCaptureContract.remainingRepositoryAssetBlockers = blockers.filter((id) => id !== "google_play_feature_graphic");
}

const envKeys = readiness.clientEnvironmentContract?.allowedProcessEnvKeys;
if (Array.isArray(envKeys) && !envKeys.includes("EXPO_PUBLIC_STORE_CAPTURE_MODE")) {
  envKeys.push("EXPO_PUBLIC_STORE_CAPTURE_MODE");
}

const storeAssets = readiness.complianceInventory?.find((item) => item.id === "store_listing_assets");
if (!storeAssets) throw new Error("missing store_listing_assets compliance inventory item");
const repositoryBlockers = readiness.mobile20StoreCaptureContract?.remainingRepositoryAssetBlockers || [];
if (readiness.mobile20StoreCaptureContract?.storeAssetsFrozen === true && repositoryBlockers.length === 0) {
  storeAssets.status = "repository_implemented_external_pending";
  storeAssets.reason = "Repository store assets are frozen: the 512x512 listing icon, bilingual Home/Analyze/Results/Diary capture set, Google Play 1024x500 feature graphic, and MOBILE-20D App Store iPhone 6.9-inch submission package are repository-qualified. Public support-contact configuration, App Store Connect metadata submission, and Google Play Console metadata submission remain external.";
} else {
  storeAssets.status = "pending";
  storeAssets.reason = "The Google Play 1024x500 feature graphic is repository-qualified by MOBILE-20C. Any other repository-owned store-asset blocker remains under its owning slice and is not created or cleared by MOBILE-20C; support-contact configuration and console submissions remain external.";
}

writeJson(readinessPath, readiness);
console.log("MOBILE_20C_AUTHORITY_SYNC=PASS");
