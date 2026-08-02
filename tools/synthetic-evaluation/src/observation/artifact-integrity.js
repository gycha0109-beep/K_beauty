import {
  SYNTHETIC_OBSERVATION_OBJECT_SCHEMA_VERSION,
  SYNTHETIC_OBSERVATION_RUN_SCHEMA_VERSION
} from "@bejewely/face-contracts";
import { sha256Hex, stableStringify } from "../generation/canonicalize-generation-spec.js";

const HEX_64 = /^[a-f0-9]{64}$/;

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function computeObservationObjectDigest(object) {
  if (!isObject(object)) return null;
  const { observationDigest, ...semantic } = object;
  return sha256Hex(stableStringify(semantic));
}

export function verifyObservationObjectIntegrity(object) {
  return isObject(object) &&
    object.schemaVersion === SYNTHETIC_OBSERVATION_OBJECT_SCHEMA_VERSION &&
    HEX_64.test(object.observationDigest || "") &&
    computeObservationObjectDigest(object) === object.observationDigest;
}

export function computeObservationRunManifestDigest(run) {
  if (!isObject(run)) return null;
  const { manifestDigest, ...semantic } = run;
  return sha256Hex(stableStringify(semantic));
}

export function verifyObservationRunManifestIntegrity(run) {
  return isObject(run) &&
    run.schemaVersion === SYNTHETIC_OBSERVATION_RUN_SCHEMA_VERSION &&
    HEX_64.test(run.manifestDigest || "") &&
    computeObservationRunManifestDigest(run) === run.manifestDigest;
}
