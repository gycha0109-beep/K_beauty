import { CANONICAL_OBSERVATION_PROFILE } from "@bejewely/face-contracts";
import { deepFreeze } from "../generation/canonicalize-generation-spec.js";
import { CANONICAL_OBSERVATION_SNAPSHOT } from "./snapshot/canonical-v1.js";

export const OBSERVATION_ADAPTER_PROFILE = deepFreeze({
  id: CANONICAL_OBSERVATION_PROFILE.id,
  version: CANONICAL_OBSERVATION_PROFILE.version,
  contractSnapshotId: CANONICAL_OBSERVATION_SNAPSHOT.snapshotId,
  modes: {
    fixture_replay: {
      provider: "fixture",
      allowedModels: [CANONICAL_OBSERVATION_PROFILE.fixtureModel],
      maximumAttempts: 0,
      automaticRetry: false,
      rawResponseRetention: false,
      authority: "fixture_only"
    },
    provider_bounded: {
      provider: "openai",
      allowedModels: [CANONICAL_OBSERVATION_PROFILE.providerModel],
      maximumAttempts: 1,
      automaticRetry: false,
      rawResponseRetention: false,
      authority: "observed_image"
    }
  },
  limits: {
    timeoutMs: 120_000,
    maxResponseBytes: 1024 * 1024,
    maxOutputTokens: 2_200
  }
});

export function resolveObservationAdapterProfile(request) {
  const mode = request?.execution?.mode;
  const modeProfile = OBSERVATION_ADAPTER_PROFILE.modes[mode];
  if (
    request?.adapterProfile?.id !== OBSERVATION_ADAPTER_PROFILE.id ||
    request?.adapterProfile?.version !== OBSERVATION_ADAPTER_PROFILE.version ||
    request?.contractSnapshotId !== OBSERVATION_ADAPTER_PROFILE.contractSnapshotId ||
    !modeProfile ||
    !modeProfile.allowedModels.includes(request?.execution?.requestedModel)
  ) {
    return Object.freeze({ ok: false, code: "adapter_profile_unsupported" });
  }
  return Object.freeze({ ok: true, profile: OBSERVATION_ADAPTER_PROFILE, modeProfile });
}
