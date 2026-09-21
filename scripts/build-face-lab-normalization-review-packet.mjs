import { readFileSync } from "node:fs";
import {
  buildFaceLabNormalizationReviewPacketFromRunOutput
} from "../lib/face-lab-normalization-review-packet-run-output.js";

const [kind, runOutputPath, packetVersion, outputMode] = process.argv.slice(2);
if (!kind || !runOutputPath || !packetVersion) {
  throw new Error(
    "Usage: node scripts/build-face-lab-normalization-review-packet.mjs <real-photo-stability|reference-corpus> <run-output.json> <packet-version> [--packet-only]"
  );
}

const runOutput = JSON.parse(readFileSync(runOutputPath, "utf8"));
const packet = buildFaceLabNormalizationReviewPacketFromRunOutput({
  kind,
  runOutput,
  packetVersion
});

if (outputMode && outputMode !== "--packet-only") {
  throw new Error("face_lab_normalization_review_packet_output_mode_invalid");
}

if (outputMode === "--packet-only") {
  console.log(JSON.stringify(packet, null, 2));
} else {
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
}
