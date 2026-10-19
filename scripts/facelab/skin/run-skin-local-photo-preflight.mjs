#!/usr/bin/env node
import fs from "node:fs";
import { inspectSkinLocalPhotoManifest } from "./skin-local-photo-preflight.mjs";

if (process.argv.length !== 4) {
  console.error("Usage: node scripts/facelab/skin/run-skin-local-photo-preflight.mjs <private-manifest.json> <private-photo-dir>");
  process.exitCode = 2;
} else {
  try {
    const bytes = fs.readFileSync(process.argv[2]);
    if (bytes.length > 32768) throw new Error("manifest_size_invalid");
    const result = inspectSkinLocalPhotoManifest(JSON.parse(bytes.toString("utf8")), process.argv[3]);
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  } catch (error) {
    // Never emit operating system error details, file paths or raw input.
    console.error("skin_local_photo_preflight_failed: " +
      (/^photo_|^image_|^jpeg_|^png_|^file_|^case_|^capture_|^rights_|^manifest_|^unsupported_/.test(error?.message || "")
        ? error.message : "private_input_unavailable_or_invalid"));
    process.exitCode = 1;
  }
}
