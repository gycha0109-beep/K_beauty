import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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
const axes = [...authority.primaryAxes, ...authority.validationAxes];
const payload = {
  schemaVersion: HOSTED_HUMAN_CUE_SUBMISSION_SCHEMA_VERSION,
  intakeVersion: HOSTED_HUMAN_CUE_INTAKE_VERSION,
  campaignKey: HOSTED_HUMAN_CUE_CAMPAIGN_KEY,
  distributionMode: HOSTED_HUMAN_CUE_DISTRIBUTION_MODE,
  sessionId: "hsi_123e4567-e89b-42d3-a456-426614174000",
  sourceAuthorityDigest: authority.sourceAuthorities.d2dPPacketAuthorityDigest,
  targetAxisDefinitionDigest:
    authority.sourceAuthorities.d2cFDefinitionContractDigest,
  hostedSetAuthorityDigest: authority.authorityDigest,
  protocolVersion: "face-lab-independent-human-cue-audit-20260814-v1",
  uiVersion: HOSTED_HUMAN_CUE_UI_VERSION,
  startedAt: "2026-08-15T00:00:00.000Z",
  clientSubmittedAt: "2026-08-15T00:05:00.000Z",
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

assert.deepEqual(validateHostedHumanCueSubmission(payload, authority), {
  ok: true,
  errors: []
});
const digest = createHash("sha256")
  .update(stableStringifyHostedHumanCueValue(payload), "utf8")
  .digest("hex");
assert.match(digest, /^[0-9a-f]{64}$/);
assert.equal(
  stableStringifyHostedHumanCueValue({ b: 2, a: 1 }),
  stableStringifyHostedHumanCueValue({ a: 1, b: 2 })
);

const reject = (mutate, expectedError) => {
  const candidate = structuredClone(payload);
  mutate(candidate);
  const result = validateHostedHumanCueSubmission(candidate, authority);
  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some((error) => error.includes(expectedError)),
    `${expectedError}:${result.errors.join(",")}`
  );
};

reject((value) => {
  value.reviewerSlot = "R01";
}, "submission_shape_invalid");
reject((value) => {
  value.judgments[0].response = "둥근형";
}, "judgment_response_invalid");
reject((value) => {
  value.judgments[0].reviewItemId = value.judgments[10].reviewItemId;
}, "judgment_binding_invalid");
reject((value) => {
  value.judgments[0].response = "uncertain";
  value.judgments[0].confidence = "high";
}, "judgment_uncertain_invalid");
reject((value) => {
  value.judgments[0].response = "not_assessable";
  value.judgments[0].confidence = "not_applicable";
}, "judgment_not_assessable_invalid");
reject((value) => {
  value.independenceAttestation.peerJudgmentsSeen = true;
}, "submission_attestation_invalid");
reject((value) => {
  value.hostedSetAuthorityDigest = "0".repeat(64);
}, "submission_authority_invalid");

console.log(
  JSON.stringify(
    {
      status: "PASS",
      schemaVersion: payload.schemaVersion,
      canonicalJudgments: payload.judgments.length,
      canonicalDigest: digest,
      negativeCases: 7,
      reviewerSlotField: "excluded",
      humanJudgments: 0
    },
    null,
    2
  )
);
