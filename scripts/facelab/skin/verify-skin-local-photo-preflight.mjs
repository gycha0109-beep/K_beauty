import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { inspectSkinLocalPhotoManifest, SCHEMA_VERSION } from "./skin-local-photo-preflight.mjs";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "skin-local-preflight-"));
const tinyPng = Buffer.alloc(33);
Buffer.from([137,80,78,71,13,10,26,10]).copy(tinyPng, 0);
tinyPng.writeUInt32BE(13, 8);
tinyPng.write("IHDR", 12);
tinyPng.writeUInt32BE(200, 16);
tinyPng.writeUInt32BE(300, 20);
const tinyJpeg = Buffer.from([0xff,0xd8,0xff,0xe0,0,4,0,0,0xff,0xc0,0,11,8,1,0x90,1,0x90,3,1,0x11,0,0xff,0xd9,0,0]);
const sample = { schemaVersion: SCHEMA_VERSION, datasetId: "local_synthetic", cases: [
  { caseId: "S1", fileName: "sample.png", captureTags: ["low_resolution"], rightsStatus: "unverified" },
  { caseId: "S2", fileName: "sample.jpg", captureTags: ["low_light"], rightsStatus: "operator_claimed_documented" }
] };
try {
  fs.writeFileSync(path.join(dir, "sample.png"), tinyPng);
  fs.writeFileSync(path.join(dir, "sample.jpg"), tinyJpeg);
  const result = inspectSkinLocalPhotoManifest(sample, dir);
  assert.equal(result.cases.length, 2);
  assert.equal(result.cases[0].widthPx, 200);
  assert.equal(result.cases[1].widthPx, 400);
  assert.equal(result.cases[1].heightPx, 400);
  assert.equal(result.cases[0].shortSideBelow320Px, true);
  assert.equal(result.cases[1].shortSideBelow320Px, false);
  assert.equal(result.bounds.externalProviderTransferAuthorized, false);
  assert.equal(result.bounds.rightsVerifiedByTool, false);
  assert.equal(result.cases[1].providerResult, "NOT_RUN");
  assert.equal(JSON.stringify(result).includes("sample.jpg"), false);
  assert.equal(JSON.stringify(result).includes(dir), false);
  const fails = (change, regex) => assert.throws(() => inspectSkinLocalPhotoManifest(change, dir), regex);
  fails({ ...sample, cases: [sample.cases[0], sample.cases[0]] }, /case_id_invalid_or_duplicate/);
  fails({ ...sample, cases: [{ ...sample.cases[0], fileName: "../secret.jpg" }] }, /file_name_invalid/);
  fails({ ...sample, cases: [{ ...sample.cases[0], imageBase64: "PRIVATE" }] }, /case_invalid_shape/);
  fails({ ...sample, cases: [{ ...sample.cases[0], rightsStatus: "approved" }] }, /rights_status_invalid/);
  fails({ ...sample, cases: [{ ...sample.cases[0], captureTags: ["baseline", "baseline"] }] }, /capture_tags_invalid/);
  fs.writeFileSync(path.join(dir, "bad.jpg"), tinyPng);
  fails({ ...sample, cases: [{ ...sample.cases[0], fileName: "bad.jpg" }] }, /image_extension_header_mismatch/);
  fs.symlinkSync(path.join(dir, "sample.jpg"), path.join(dir, "link.jpg"));
  fails({ ...sample, cases: [{ ...sample.cases[0], fileName: "link.jpg" }] }, /photo_file_type_or_size_invalid/);
  fs.writeFileSync(path.join(dir, "junk.jpg"), Buffer.alloc(30));
  fails({ ...sample, cases: [{ ...sample.cases[0], fileName: "junk.jpg" }] }, /unsupported_image_header/);
  console.log("verify-skin-local-photo-preflight: PASS (synthetic image headers only; no real photos or Provider)");
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
