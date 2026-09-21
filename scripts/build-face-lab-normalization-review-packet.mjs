import { readFileSync } from "node:fs";
import {
  buildFaceLabNormalizationReviewPacketFromRunOutput
} from "../lib/face-lab-normalization-review-packet-run-output.js";

const [kind, runOutputPath, packetVersion] = process.argv.slice(2);
if (!kind || !runOutputPath || !packetVersion) {
  throw new Error(
    "Usage: node scripts/build-face-lab-normalization-review-packet.mjs <real-photo-stability|reference-corpus> <run-output.json> <packet-version>"
  );
}

const runOutput = JSON.parse(readFileSync(runOutputPath, "utf8"));
const packet = buildFaceLabNormalizationReviewPacketFromRunOutput({
  kind,
  runOutput,
  packetVersion
});

console.log(JSON.stringify({
  ok: true,
  kind,
  packet,
  authority: {
    productionAuthority: false,
    normalizationAuthority: false,
    thresholdAuthority: false,
    adequacyDecisionAuthority: false
  }
}, null, 2));
