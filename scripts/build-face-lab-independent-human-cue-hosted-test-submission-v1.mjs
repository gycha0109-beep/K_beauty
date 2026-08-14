import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  HOSTED_HUMAN_CUE_CAMPAIGN_KEY,
  HOSTED_HUMAN_CUE_DISTRIBUTION_MODE,
  HOSTED_HUMAN_CUE_INTAKE_VERSION,
  HOSTED_HUMAN_CUE_REQUIRED_ATTESTATION,
  HOSTED_HUMAN_CUE_SUBMISSION_SCHEMA_VERSION,
  HOSTED_HUMAN_CUE_UI_VERSION,
  stableStringifyHostedHumanCueValue,
  validateHostedHumanCueSubmission
} from "@bejewely/face-contracts";

const authority = JSON.parse(
  readFileSync(
    "evidence/facelab/face-lab-independent-human-cue-single-hosted-set-20260815-v1.json",
    "utf8"
  )
);
const now = new Date();
const startedAt = new Date(now.getTime() - 300_000).toISOString();
const axes = [...authority.primaryAxes, ...authority.validationAxes];
const payload = {
  schemaVersion: HOSTED_HUMAN_CUE_SUBMISSION_SCHEMA_VERSION,
  intakeVersion: HOSTED_HUMAN_CUE_INTAKE_VERSION,
  campaignKey: HOSTED_HUMAN_CUE_CAMPAIGN_KEY,
  distributionMode: HOSTED_HUMAN_CUE_DISTRIBUTION_MODE,
  sessionId: `hsi_${randomUUID()}`,
  sourceAuthorityDigest: authority.sourceAuthorities.d2dPPacketAuthorityDigest,
  targetAxisDefinitionDigest:
    authority.sourceAuthorities.d2cFDefinitionContractDigest,
  hostedSetAuthorityDigest: authority.authorityDigest,
  protocolVersion: "face-lab-independent-human-cue-audit-20260814-v1",
  uiVersion: HOSTED_HUMAN_CUE_UI_VERSION,
  startedAt,
  clientSubmittedAt: now.toISOString(),
  independenceAttestation: HOSTED_HUMAN_CUE_REQUIRED_ATTESTATION,
  judgments: authority.orderedItems.flatMap((item) =>
    axes.map((axis) => ({
      reviewItemId: item.reviewItemId,
      axisPath: axis.axisPath,
      response: axis.enumOptions[0],
      confidence: "low",
      evidenceTags: [],
      notAssessableReasonCodes: []
    }))
  ),
  completion: {
    completed: true,
    imageCount: 14,
    judgmentCount: 140,
    primaryAxisCount: 8,
    validationAxisCount: 2
  }
};
const validation = validateHostedHumanCueSubmission(payload, authority);
if (!validation.ok) {
  throw new Error(`test payload invalid:${validation.errors.join(",")}`);
}
const responsePayloadSha256 = createHash("sha256")
  .update(stableStringifyHostedHumanCueValue(payload), "utf8")
  .digest("hex");

console.log(
  JSON.stringify({
    payload,
    responsePayloadSha256,
    submissionStatus: "test"
  })
);
