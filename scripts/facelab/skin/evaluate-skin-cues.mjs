#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { evaluateSkinCues } from "./skin-cue-evaluation-core.mjs";

if (process.argv.length !== 3) {
  console.error("Usage: node scripts/facelab/skin/evaluate-skin-cues.mjs <private-metadata-only-manifest.json>");
  process.exitCode = 2;
} else {
  try {
    // No image/photo content, no directory traversal into provider/data stores, no persistence.
    const input = JSON.parse(readFileSync(process.argv[2], "utf8"));
    const evaluation = evaluateSkinCues(input);
    process.stdout.write(JSON.stringify(evaluation, null, 2) + "\n");
  } catch (error) {
    console.error("skin_cue_evaluation_failed: " + String(error?.message || error));
    process.exitCode = 1;
  }
}
