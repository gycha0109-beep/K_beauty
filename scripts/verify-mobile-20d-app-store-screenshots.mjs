import assert from "node:assert/strict";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const mode = process.argv[2] || "source";
const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const fail = (message) => { throw new Error(message); };
const requireText = (text, marker, label) => {
  if (!text.includes(marker)) fail(`${label}: missing ${marker}`);
};

const acceptedPortraitSizes = new Set(["1260x2736", "1290x2796", "1320x2868"]);
const frames = ["home", "analyze", "results", "diary"];
const locales = ["en-US", "ko"];

function verifySource() {
  const appJson = JSON.parse(read("apps/mobile/app.json"));
  const route = read("apps/mobile/app/store-capture.tsx");
  const capture = read("scripts/capture-mobile-20d-app-store-screenshots.sh");
  const workflow = read(".github/workflows/mobile-20d-app-store-screenshots.yml");
  const contract = JSON.parse(read("docs/store/mobile-20d-app-store-screenshot-packaging.json"));

  assert.equal(appJson.expo.ios.supportsTablet, false, "MOBILE-20D only packages the iPhone submission set");
  requireText(route, '__DEV__ === true && process.env.EXPO_PUBLIC_STORE_CAPTURE_MODE === "1"', "store fixture fail-closed guard");
  assert.equal(Object.prototype.hasOwnProperty.call(appJson.expo, "EXPO_PUBLIC_STORE_CAPTURE_MODE"), false);

  for (const size of acceptedPortraitSizes) requireText(capture, size, "accepted 6.9-inch size contract");
  for (const frame of frames) requireText(capture, `"${frame}"`, `capture frame ${frame}`);
  requireText(capture, 'capture_locale "en-US"', "English localization capture");
  requireText(capture, 'capture_locale "ko"', "Korean localization capture");
  requireText(capture, 'screenshot --type=jpeg', "opaque JPEG capture");
  requireText(capture, 'EXPO_PUBLIC_STORE_CAPTURE_MODE=1', "bounded fixture environment");

  requireText(workflow, 'runs-on: macos-26', "iOS runner");
  requireText(workflow, 'DEVELOPER_DIR: /Applications/Xcode_26.6.app/Contents/Developer', "Xcode authority");
  requireText(workflow, 'ref: ${{ github.event.pull_request.head.sha || github.sha }}', "exact-head checkout");
  requireText(workflow, 'MOBILE_20D_EXPECTED_SHA: ${{ github.event.pull_request.head.sha || github.sha }}', "exact-head artifact binding");
  requireText(workflow, 'apps/mobile/.mobile-20d-app-store-package/**', "package artifact upload");

  assert.equal(contract.schemaVersion, "mobile-20d-app-store-screenshot-packaging-v1");
  assert.equal(contract.owner, "MOBILE-20D");
  assert.equal(contract.platform, "ios");
  assert.equal(contract.deviceFamily, "iphone");
  assert.equal(contract.ipadRequired, false);
  assert.deepEqual(contract.locales, locales);
  assert.deepEqual(contract.frames, frames);
  assert.deepEqual(new Set(contract.acceptedPortraitSizes), acceptedPortraitSizes);
  assert.equal(contract.imageFormat, "jpeg");
  assert.equal(contract.alphaAllowed, false);
  assert.equal(contract.sourceContractStatus, "repository_implemented");
  assert.equal(contract.visualReviewRequired, true);
  assert.equal(contract.appStoreConnectUploadStatus, "external_pending");

  console.log("MOBILE_20D_SOURCE_CONTRACT=PASS");
}

function jpegDimensions(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) fail("invalid JPEG SOI");
  let offset = 2;
  while (offset + 4 <= buffer.length) {
    if (buffer[offset] !== 0xff) { offset += 1; continue; }
    while (offset < buffer.length && buffer[offset] === 0xff) offset += 1;
    const marker = buffer[offset++];
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker >= 0xd0 && marker <= 0xd7) continue;
    if (offset + 2 > buffer.length) break;
    const length = buffer.readUInt16BE(offset);
    if (length < 2 || offset + length > buffer.length) break;
    const sof = new Set([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf]);
    if (sof.has(marker)) {
      if (length < 8) fail("invalid JPEG SOF");
      const height = buffer.readUInt16BE(offset + 3);
      const width = buffer.readUInt16BE(offset + 5);
      return { width, height };
    }
    offset += length;
  }
  fail("JPEG dimensions not found");
}

function checkedOutSha() {
  const sha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  if (!/^[0-9a-f]{40}$/.test(sha)) fail(`invalid checkout SHA: ${sha}`);
  const expected = process.env.MOBILE_20D_EXPECTED_SHA;
  if (expected && expected !== sha) fail(`checkout SHA mismatch: expected ${expected}, got ${sha}`);
  return sha;
}

function verifyArtifact(dirArg) {
  const dir = path.resolve(root, dirArg || "apps/mobile/.mobile-20d-app-store-package");
  const exactSha = checkedOutSha();
  const screens = [];

  for (const locale of locales) {
    for (let index = 0; index < frames.length; index += 1) {
      const frame = frames[index];
      const order = String(index + 1).padStart(2, "0");
      const relative = `${locale}/${order}-${frame}.jpg`;
      const absolute = path.join(dir, relative);
      assert.ok(fs.existsSync(absolute), `missing App Store screenshot: ${relative}`);
      const buffer = fs.readFileSync(absolute);
      assert.ok(buffer.length > 20_000, `${relative}: suspiciously small JPEG`);
      const { width, height } = jpegDimensions(buffer);
      assert.ok(acceptedPortraitSizes.has(`${width}x${height}`), `${relative}: unsupported size ${width}x${height}`);
      screens.push({
        locale,
        order: index + 1,
        frame,
        file: relative,
        width,
        height,
        format: "jpeg",
        alpha: false,
        sha256: crypto.createHash("sha256").update(buffer).digest("hex"),
        technicalPass: true
      });
    }
  }

  assert.equal(screens.length, 8);
  const manifest = {
    schemaVersion: "mobile-20d-app-store-screenshot-package-manifest-v1",
    owner: "MOBILE-20D",
    exactSha,
    platform: "ios",
    deviceFamily: "iphone",
    locales,
    frames,
    acceptedPortraitSizes: [...acceptedPortraitSizes],
    imageFormat: "jpeg",
    alphaAllowed: false,
    screenshotCount: screens.length,
    technicalPass: true,
    visualReviewRequired: true,
    appStoreConnectUploadStatus: "external_pending",
    screens
  };
  fs.writeFileSync(path.join(dir, "app-store-screenshot-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`MOBILE_20D_ARTIFACT_SHA=${exactSha}`);
  console.log("MOBILE_20D_ARTIFACT_CONTRACT=PASS");
}

if (mode === "source") verifySource();
else if (mode === "artifact") verifyArtifact(process.argv[3]);
else fail(`unknown mode: ${mode}`);
