import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mobileRoot = join(repoRoot, "apps", "mobile");
const app = JSON.parse(readFileSync(join(mobileRoot, "app.json"), "utf8"));
const readiness = JSON.parse(readFileSync(join(mobileRoot, "store-readiness.json"), "utf8"));

const paths = {
  dark: join(mobileRoot, "assets", "icon", "bejewely-icon-dark-1024.png"),
  light: join(mobileRoot, "assets", "icon", "bejewely-icon-light-1024.png"),
  play: join(mobileRoot, "assets", "store", "bejewely-play-icon-512.png")
};

function inspectPng(path) {
  const buffer = readFileSync(path);
  assert.equal(buffer.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", `${path}: invalid PNG signature`);

  let offset = 8;
  let ihdr = null;
  let transparentPaletteOrColor = false;
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString("ascii");
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;

    if (type === "IHDR") {
      ihdr = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        bitDepth: data[8],
        colorType: data[9],
        interlace: data[12]
      };
    } else if (type === "tRNS") {
      transparentPaletteOrColor = true;
    } else if (type === "IEND") {
      break;
    }
  }

  assert.ok(ihdr, `${path}: missing IHDR`);
  return {
    ...ihdr,
    bytes: statSync(path).size,
    transparentPaletteOrColor,
    hasAlphaChannel: ihdr.colorType === 4 || ihdr.colorType === 6
  };
}

const dark = inspectPng(paths.dark);
const light = inspectPng(paths.light);
const play = inspectPng(paths.play);

for (const [label, image] of [["dark", dark], ["light", light]]) {
  assert.equal(image.width, 1024, `${label} icon width must be 1024`);
  assert.equal(image.height, 1024, `${label} icon height must be 1024`);
  assert.equal(image.bitDepth, 8, `${label} icon must be 8-bit`);
  assert.equal(image.interlace, 0, `${label} icon must be non-interlaced`);
  assert.equal(image.hasAlphaChannel, false, `${label} icon must not have an alpha channel`);
  assert.equal(image.transparentPaletteOrColor, false, `${label} icon must not declare transparent pixels`);
}

assert.equal(play.width, 512);
assert.equal(play.height, 512);
assert.equal(play.bitDepth, 8);
assert.equal(play.interlace, 0);
assert.equal(play.hasAlphaChannel, false);
assert.equal(play.transparentPaletteOrColor, false);
assert.ok(play.bytes <= 1024 * 1024, `Google Play listing icon exceeds 1MB: ${play.bytes}`);

const expo = app.expo;
assert.equal(expo.icon, "./assets/icon/bejewely-icon-dark-1024.png");
assert.equal(expo.android?.icon, "./assets/icon/bejewely-icon-dark-1024.png");
assert.equal(expo.android?.adaptiveIcon, undefined, "Do not fake a layered adaptive icon from full-square artwork");
assert.deepEqual(expo.ios?.icon, {
  light: "./assets/icon/bejewely-icon-light-1024.png",
  dark: "./assets/icon/bejewely-icon-dark-1024.png"
});

const contract = readiness.mobile16HContract;
assert.ok(contract, "Missing MOBILE-16H readiness contract");
assert.equal(contract.sourceAuditWorkflow, ".github/workflows/mobile-16g-production-icon-audit.yml");
assert.equal(contract.verifier, "scripts/verify-mobile-16h-production-icons.mjs");
assert.equal(contract.workflow, ".github/workflows/mobile-16h-production-icons.yml");
assert.equal(contract.rootIcon, "apps/mobile/assets/icon/bejewely-icon-dark-1024.png");
assert.equal(contract.androidIcon, contract.rootIcon);
assert.equal(contract.iosIconLight, "apps/mobile/assets/icon/bejewely-icon-light-1024.png");
assert.equal(contract.iosIconDark, contract.rootIcon);
assert.equal(contract.googlePlayListingIcon, "apps/mobile/assets/store/bejewely-play-icon-512.png");
assert.equal(contract.appIconRasterSize, "1024x1024");
assert.equal(contract.googlePlayListingRasterSize, "512x512");
assert.equal(contract.customAndroidAdaptiveIconConfigured, false);
assert.equal(contract.customAndroidAdaptiveIconStatus, "non_blocking_separate_layer_asset_not_configured");
assert.equal(contract.sourceContractStatus, "repository_implemented");

const compliance = new Map(readiness.complianceInventory.map((item) => [item.id, item]));
assert.equal(compliance.get("production_app_icon")?.status, "repository_implemented");
assert.equal(compliance.get("production_app_icon")?.owner, "MOBILE-16H");
assert.equal(compliance.get("store_listing_assets")?.status, "pending");
assert.match(compliance.get("store_listing_assets")?.reason || "", /512x512 listing icon is repository-frozen/i);

console.log(`MOBILE_16H_DARK_ICON_BYTES=${dark.bytes}`);
console.log(`MOBILE_16H_LIGHT_ICON_BYTES=${light.bytes}`);
console.log(`MOBILE_16H_PLAY_ICON_BYTES=${play.bytes}`);
console.log("MOBILE_16H_IOS_LIGHT_DARK_ICON_CONTRACT=PASS");
console.log("MOBILE_16H_ANDROID_DEFAULT_ICON_CONTRACT=PASS");
console.log("MOBILE_16H_GOOGLE_PLAY_LISTING_ICON=PASS");
console.log("MOBILE_16H_PRODUCTION_ICON_READINESS=PASS");
