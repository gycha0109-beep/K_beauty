import {
  FACE_LAB_INDEPENDENT_HUMAN_CUE_AUDIT_PROTOCOL,
  INDEPENDENT_HUMAN_CUE_NOT_ASSESSABLE_REASON_CODES
} from "./independent-human-cue-audit.js";

export const HOSTED_HUMAN_CUE_SUBMISSION_SCHEMA_VERSION =
  "face-lab-independent-human-cue-hosted-submission-v1";
export const HOSTED_HUMAN_CUE_INTAKE_VERSION =
  "face-lab-independent-human-cue-hosted-intake-20260815-v1";
export const HOSTED_HUMAN_CUE_UI_VERSION =
  "face-lab-independent-human-cue-review-ui-ko-hosted-20260815-v1";
export const HOSTED_HUMAN_CUE_CAMPAIGN_KEY = "face_lab_cx1g_d2d_xp_v1";
export const HOSTED_HUMAN_CUE_DISTRIBUTION_MODE = "single_hosted_set";
export const HOSTED_HUMAN_CUE_ACCESS_MODE = "shared_opaque_link";
export const HOSTED_HUMAN_CUE_STORAGE_SCHEMA_VERSION =
  "tmp-face-lab-independent-human-cue-submissions-v1";

export const HOSTED_HUMAN_CUE_REQUIRED_ATTESTATION = Object.freeze({
  generationTargetKnown: false,
  generationPromptSeen: false,
  subtleModerateConditionKnown: false,
  archetypeTargetKnown: false,
  visionObservationSeen: false,
  shadowScoringSeen: false,
  peerJudgmentsSeen: false,
  consensusSeen: false
});

const NOT_ASSESSABLE_REASON_SET = new Set(
  INDEPENDENT_HUMAN_CUE_NOT_ASSESSABLE_REASON_CODES
);
const CONFIDENCE_SET = new Set(["low", "medium", "high"]);

const isObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const exactKeys = (value, keys) =>
  isObject(value) &&
  Object.keys(value).sort().join("|") === [...keys].sort().join("|");

const isIsoTimestamp = (value) =>
  typeof value === "string" &&
  value.length >= 20 &&
  value.length <= 35 &&
  Number.isFinite(Date.parse(value));

const isDigest = (value) =>
  typeof value === "string" && /^[0-9a-f]{64}$/.test(value);

const isSessionId = (value) =>
  typeof value === "string" &&
  /^hsi_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );

export function stableStringifyHostedHumanCueValue(value) {
  const sort = (item) =>
    Array.isArray(item)
      ? item.map(sort)
      : isObject(item)
        ? Object.fromEntries(
            Object.keys(item)
              .sort()
              .map((key) => [key, sort(item[key])])
          )
        : item;

  return JSON.stringify(sort(value));
}

function validateJudgment(judgment, expected, errors) {
  const fields = [
    "reviewItemId",
    "axisPath",
    "response",
    "confidence",
    "evidenceTags",
    "notAssessableReasonCodes"
  ];

  if (!exactKeys(judgment, fields)) {
    errors.push(`judgment_shape_invalid:${expected.reviewItemId}:${expected.axisPath}`);
    return;
  }

  if (
    judgment.reviewItemId !== expected.reviewItemId ||
    judgment.axisPath !== expected.axisPath ||
    !Array.isArray(judgment.evidenceTags) ||
    judgment.evidenceTags.length !== 0 ||
    !Array.isArray(judgment.notAssessableReasonCodes) ||
    new Set(judgment.notAssessableReasonCodes).size !==
      judgment.notAssessableReasonCodes.length ||
    judgment.notAssessableReasonCodes.some(
      (reason) => !NOT_ASSESSABLE_REASON_SET.has(reason)
    )
  ) {
    errors.push(`judgment_binding_invalid:${expected.reviewItemId}:${expected.axisPath}`);
    return;
  }

  if (judgment.response === "not_assessable") {
    if (
      judgment.confidence !== "not_applicable" ||
      judgment.notAssessableReasonCodes.length === 0
    ) {
      errors.push(
        `judgment_not_assessable_invalid:${expected.reviewItemId}:${expected.axisPath}`
      );
    }
    return;
  }

  if (judgment.response === "uncertain") {
    if (
      !["low", "medium"].includes(judgment.confidence) ||
      judgment.notAssessableReasonCodes.length !== 0
    ) {
      errors.push(
        `judgment_uncertain_invalid:${expected.reviewItemId}:${expected.axisPath}`
      );
    }
    return;
  }

  if (
    !expected.enumOptions.includes(judgment.response) ||
    !CONFIDENCE_SET.has(judgment.confidence) ||
    judgment.notAssessableReasonCodes.length !== 0
  ) {
    errors.push(`judgment_response_invalid:${expected.reviewItemId}:${expected.axisPath}`);
  }
}

export function validateHostedHumanCueSubmission(payload, authority) {
  const errors = [];
  const fields = [
    "schemaVersion",
    "intakeVersion",
    "campaignKey",
    "distributionMode",
    "sessionId",
    "sourceAuthorityDigest",
    "targetAxisDefinitionDigest",
    "hostedSetAuthorityDigest",
    "protocolVersion",
    "uiVersion",
    "startedAt",
    "clientSubmittedAt",
    "independenceAttestation",
    "judgments",
    "completion"
  ];

  if (!exactKeys(payload, fields)) {
    return { ok: false, errors: ["submission_shape_invalid"] };
  }

  if (
    payload.schemaVersion !== HOSTED_HUMAN_CUE_SUBMISSION_SCHEMA_VERSION ||
    payload.intakeVersion !== HOSTED_HUMAN_CUE_INTAKE_VERSION ||
    payload.campaignKey !== HOSTED_HUMAN_CUE_CAMPAIGN_KEY ||
    payload.distributionMode !== HOSTED_HUMAN_CUE_DISTRIBUTION_MODE ||
    payload.protocolVersion !==
      FACE_LAB_INDEPENDENT_HUMAN_CUE_AUDIT_PROTOCOL.protocolVersion ||
    payload.uiVersion !== HOSTED_HUMAN_CUE_UI_VERSION ||
    !isSessionId(payload.sessionId) ||
    !isIsoTimestamp(payload.startedAt) ||
    !isIsoTimestamp(payload.clientSubmittedAt)
  ) {
    errors.push("submission_identity_invalid");
  }

  if (
    !authority ||
    !isDigest(authority.authorityDigest) ||
    payload.sourceAuthorityDigest !==
      authority.sourceAuthorities?.d2dPPacketAuthorityDigest ||
    payload.targetAxisDefinitionDigest !==
      authority.sourceAuthorities?.d2cFDefinitionContractDigest ||
    payload.hostedSetAuthorityDigest !== authority.authorityDigest
  ) {
    errors.push("submission_authority_invalid");
  }

  if (
    !exactKeys(
      payload.independenceAttestation,
      Object.keys(HOSTED_HUMAN_CUE_REQUIRED_ATTESTATION)
    ) ||
    Object.entries(HOSTED_HUMAN_CUE_REQUIRED_ATTESTATION).some(
      ([key, expected]) => payload.independenceAttestation[key] !== expected
    )
  ) {
    errors.push("submission_attestation_invalid");
  }

  const expectedJudgments = (authority?.orderedItems || []).flatMap((item) =>
    [...(authority?.primaryAxes || []), ...(authority?.validationAxes || [])].map(
      (axis) => ({
        reviewItemId: item.reviewItemId,
        axisPath: axis.axisPath,
        enumOptions: axis.enumOptions
      })
    )
  );

  if (
    expectedJudgments.length !== 140 ||
    !Array.isArray(payload.judgments) ||
    payload.judgments.length !== expectedJudgments.length
  ) {
    errors.push("submission_judgment_count_invalid");
  } else {
    payload.judgments.forEach((judgment, index) =>
      validateJudgment(judgment, expectedJudgments[index], errors)
    );
  }

  if (
    !exactKeys(payload.completion, [
      "completed",
      "imageCount",
      "judgmentCount",
      "primaryAxisCount",
      "validationAxisCount"
    ]) ||
    payload.completion.completed !== true ||
    payload.completion.imageCount !== 14 ||
    payload.completion.judgmentCount !== 140 ||
    payload.completion.primaryAxisCount !== 8 ||
    payload.completion.validationAxisCount !== 2
  ) {
    errors.push("submission_completion_invalid");
  }

  const startedAt = Date.parse(payload.startedAt);
  const clientSubmittedAt = Date.parse(payload.clientSubmittedAt);
  if (
    Number.isFinite(startedAt) &&
    Number.isFinite(clientSubmittedAt) &&
    (clientSubmittedAt < startedAt || clientSubmittedAt - startedAt > 86_400_000)
  ) {
    errors.push("submission_timeline_invalid");
  }

  return { ok: errors.length === 0, errors };
}
