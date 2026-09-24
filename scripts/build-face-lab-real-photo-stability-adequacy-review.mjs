import { readFileSync, writeFileSync } from "node:fs";
import {
  buildRealPhotoStabilityAdequacyReview
} from "../lib/face-lab-real-photo-stability-adequacy-review.js";

const [reviewPacketPath, outputPath] = process.argv.slice(2);
if (!reviewPacketPath || !outputPath) {
  throw new Error(
    "Usage: node scripts/build-face-lab-real-photo-stability-adequacy-review.mjs <review-packet.json> <output.json>"
  );
}

const reviewPacket = JSON.parse(readFileSync(reviewPacketPath, "utf8"));
const review = buildRealPhotoStabilityAdequacyReview(reviewPacket);
writeFileSync(outputPath, JSON.stringify(review, null, 2) + "\n", "utf8");

console.log(JSON.stringify({
  ok: true,
  reviewVersion: review.reviewVersion,
  sourceReportCount: review.boundEvidence.sourceReportCount,
  coveredNuisanceClasses: review.coverage.coveredNuisanceClasses,
  analysisFingerprint: review.analysisFingerprint,
  automaticPassFail: false,
  productionAuthority: false,
  normalizationAuthority: false,
  thresholdAuthority: false
}, null, 2));
