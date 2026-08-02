export const OBSERVATION_CONTRACT_SNAPSHOT_SCHEMA_VERSION = "observation-contract-snapshot-v1";
export const OBSERVATION_RUN_REQUEST_SCHEMA_VERSION = "observation-run-request-v1";
export const SYNTHETIC_OBSERVATION_OBJECT_SCHEMA_VERSION = "synthetic-observation-object-v1";
export const SYNTHETIC_OBSERVATION_RUN_SCHEMA_VERSION = "synthetic-observation-run-v1";
export const OBSERVATION_EXECUTION_CLAIM_SCHEMA_VERSION = "observation-execution-claim-v1";
export const BLIND_JUDGMENT_INPUT_SCHEMA_VERSION = "blind-judgment-input-v1";

export const CANONICAL_OBSERVATION_PROFILE = Object.freeze({
  id: "bejewely-canonical-vision-v1",
  version: "1.0.0",
  providerModel: "gpt-4o-mini",
  fixtureModel: "fixture-canonical-v1"
});

const EXACT_HEX_64 = /^[a-f0-9]{64}$/;
const CANDIDATE_ID = /^cand_[a-f0-9]{24}$/;
const SNAPSHOT_ID = /^obsc_[a-f0-9]{24}$/;
const SAFE_RELATIVE_PATH = /^(?![A-Za-z]:)(?!\\\\)(?!\/)(?!.*(?:^|[\\/])\.\.(?:[\\/]|$))(?!.*\0).+$/;

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value, expected) {
  if (!isObject(value)) return false;
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function error(code, path, detail = null) {
  return Object.freeze({ code, path, detail });
}

export function validateBlindCandidateInput(value) {
  const errors = [];
  if (!exactKeys(value, ["candidateId", "canonicalAsset"])) {
    errors.push(error("candidate_input_invalid", "$"));
    return Object.freeze({ ok: false, errors });
  }
  if (!CANDIDATE_ID.test(value.candidateId)) {
    errors.push(error("candidate_input_invalid", "candidateId"));
  }
  if (!exactKeys(value.canonicalAsset, ["sha256", "objectRelativePath", "transformPolicyVersion"])) {
    errors.push(error("candidate_input_invalid", "canonicalAsset"));
  } else {
    if (!EXACT_HEX_64.test(value.canonicalAsset.sha256)) {
      errors.push(error("candidate_input_invalid", "canonicalAsset.sha256"));
    }
    if (
      typeof value.canonicalAsset.objectRelativePath !== "string" ||
      !SAFE_RELATIVE_PATH.test(value.canonicalAsset.objectRelativePath) ||
      value.canonicalAsset.objectRelativePath.split(/[\\/]/).some((part) => !part || part === "." || part === "..")
    ) {
      errors.push(error("canonical_asset_path_unsafe", "canonicalAsset.objectRelativePath"));
    }
    if (value.canonicalAsset.transformPolicyVersion !== "canonical-image-v1") {
      errors.push(error("canonical_transform_policy_unsupported", "canonicalAsset.transformPolicyVersion"));
    }
  }
  return Object.freeze({ ok: errors.length === 0, errors });
}

export function validateObservationRunRequest(value) {
  const errors = [];
  if (!exactKeys(value, ["schemaVersion", "candidate", "adapterProfile", "contractSnapshotId", "execution"])) {
    return Object.freeze({ ok: false, errors: [error("observation_request_invalid", "$")] });
  }
  if (value.schemaVersion !== OBSERVATION_RUN_REQUEST_SCHEMA_VERSION) {
    errors.push(error("observation_request_invalid", "schemaVersion"));
  }
  const candidate = validateBlindCandidateInput(value.candidate);
  errors.push(...candidate.errors);
  if (!exactKeys(value.adapterProfile, ["id", "version"])) {
    errors.push(error("adapter_profile_unsupported", "adapterProfile"));
  } else if (
    value.adapterProfile.id !== CANONICAL_OBSERVATION_PROFILE.id ||
    value.adapterProfile.version !== CANONICAL_OBSERVATION_PROFILE.version
  ) {
    errors.push(error("adapter_profile_unsupported", "adapterProfile"));
  }
  if (typeof value.contractSnapshotId !== "string" || !SNAPSHOT_ID.test(value.contractSnapshotId)) {
    errors.push(error("contract_snapshot_missing", "contractSnapshotId"));
  }
  if (!exactKeys(value.execution, ["mode", "requestedModel", "replicateOrdinal"])) {
    errors.push(error("observation_request_invalid", "execution"));
  } else {
    if (!["fixture_replay", "provider_bounded"].includes(value.execution.mode)) {
      errors.push(error("adapter_profile_unsupported", "execution.mode"));
    }
    const expectedModel = value.execution.mode === "fixture_replay"
      ? CANONICAL_OBSERVATION_PROFILE.fixtureModel
      : CANONICAL_OBSERVATION_PROFILE.providerModel;
    if (value.execution.requestedModel !== expectedModel) {
      errors.push(error("model_unsupported", "execution.requestedModel", expectedModel));
    }
    if (!Number.isSafeInteger(value.execution.replicateOrdinal) || value.execution.replicateOrdinal < 1) {
      errors.push(error("replicate_ordinal_invalid", "execution.replicateOrdinal"));
    }
  }
  return Object.freeze({ ok: errors.length === 0, errors });
}

export function createBlindJudgmentInput({ run, observationObject, blindCandidate }) {
  if (
    !isObject(run) ||
    run.schemaVersion !== SYNTHETIC_OBSERVATION_RUN_SCHEMA_VERSION ||
    run.outcome !== "observed_bundle" ||
    run.authority !== "observed_image" ||
    run.execution?.mode !== "provider_bounded" ||
    !isObject(observationObject) ||
    observationObject.schemaVersion !== SYNTHETIC_OBSERVATION_OBJECT_SCHEMA_VERSION ||
    run.observation?.schemaVersion !== SYNTHETIC_OBSERVATION_OBJECT_SCHEMA_VERSION ||
    run.observation?.digest !== observationObject.observationDigest ||
    observationObject.candidateId !== run.candidate?.candidateId ||
    observationObject.canonicalSha256 !== run.candidate?.canonicalSha256 ||
    observationObject.contractSnapshotDigest !== run.adapter?.contractSnapshotDigest ||
    observationObject.bundle?.status !== "available" ||
    observationObject.bundle?.privacy?.sourceImagePersisted !== false ||
    observationObject.bundle?.privacy?.rawProviderResponsePersisted !== false ||
    !validateBlindCandidateInput(blindCandidate).ok ||
    blindCandidate.candidateId !== run.candidate?.candidateId ||
    blindCandidate.canonicalAsset.sha256 !== run.candidate?.canonicalSha256
  ) {
    throw new Error("blind_judgment_input_unavailable");
  }
  return Object.freeze({
    schemaVersion: BLIND_JUDGMENT_INPUT_SCHEMA_VERSION,
    candidateId: run.candidate.candidateId,
    observationRunId: run.runId,
    observationDigest: observationObject.observationDigest,
    canonicalAsset: Object.freeze({
      sha256: blindCandidate.canonicalAsset.sha256,
      objectRelativePath: blindCandidate.canonicalAsset.objectRelativePath
    }),
    observation: observationObject.bundle
  });
}
