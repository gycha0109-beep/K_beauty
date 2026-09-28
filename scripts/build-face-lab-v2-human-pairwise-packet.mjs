import {
  buildFaceLabV2HumanPairwiseOperatorManifest,
  buildFaceLabV2HumanPairwiseReviewPacket
} from "../lib/face-lab-v2/evaluation/human-pairwise-builder.js";

const mode = (
  process.env.FACE_LAB_HUMAN_PAIRWISE_OUTPUT || "review"
).toLowerCase();

if (mode === "review") {
  console.log(
    JSON.stringify(
      buildFaceLabV2HumanPairwiseReviewPacket(),
      null,
      2
    )
  );
} else if (mode === "operator") {
  console.log(
    JSON.stringify(
      buildFaceLabV2HumanPairwiseOperatorManifest(),
      null,
      2
    )
  );
} else {
  throw new Error(
    "FACE_LAB_HUMAN_PAIRWISE_OUTPUT must be review or operator"
  );
}
