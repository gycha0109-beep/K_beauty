import { deepFreeze } from "../generation/canonicalize-generation-spec.js";
import { OBSERVATION_SEMANTIC_EXPORT, OBSERVATION_VERSIONS } from "./snapshot/canonical-v1.js";
import { hasExactRawObservationShape } from "./normalize/helpers.js";
import { normalizeEligibility, normalizeSkin } from "./normalize/eligibility-skin.js";
import { normalizeFace } from "./normalize/face.js";

export function normalizeObservationPayload(parsed, options = {}) {
  const provider = typeof options.provider === "string" && options.provider ? options.provider : "fixture";
  const model = typeof options.model === "string" && options.model ? options.model : null;
  if (!hasExactRawObservationShape(parsed, OBSERVATION_SEMANTIC_EXPORT) || parsed.schemaVersion !== OBSERVATION_VERSIONS.visionSchemaVersion) {
    return Object.freeze({ ok: false, code: "provider_contract_invalid" });
  }
  const eligibility = normalizeEligibility(parsed.eligibility, OBSERVATION_SEMANTIC_EXPORT);
  if (eligibility.source !== "vision") return Object.freeze({ ok: false, code: "provider_contract_invalid" });
  const skin = normalizeSkin(parsed.skin, eligibility, OBSERVATION_SEMANTIC_EXPORT);
  const faceAnalysis = normalizeFace(parsed.face, eligibility, {
    provider, model,
    semanticExport: OBSERVATION_SEMANTIC_EXPORT,
    versions: OBSERVATION_VERSIONS
  });
  const bundle = deepFreeze({
    schemaVersion: OBSERVATION_VERSIONS.visionSchemaVersion,
    promptVersion: OBSERVATION_VERSIONS.visionPromptVersion,
    status: "available",
    eligibility,
    skin,
    face: { status: faceAnalysis.status, analysis: faceAnalysis },
    privacy: { sourceImagePersisted: false, rawProviderResponsePersisted: false }
  });
  return Object.freeze({ ok: true, bundle });
}
