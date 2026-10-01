import {
  hashFaceLabAuthorityValue
} from "./simulation-authority-core.js";

export const FACE_LAB_SIMULATION_PROVIDER_CONFIG_VERSION =
  "face-lab-simulation-provider-config-v1";

const TOKEN_PATTERN =
  /^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/;

function cleanToken(value) {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    return null;
  }

  const normalized =
    value.trim();

  return TOKEN_PATTERN.test(
    normalized
  )
    ? normalized
    : null;
}

function cleanEndpoint(value) {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.length > 500
  ) {
    return null;
  }

  try {
    const parsed =
      new URL(value.trim());

    if (
      parsed.protocol !== "https:" ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash
    ) {
      return null;
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

export function normalizeFaceLabSimulationProviderConfig(
  value
) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return null;
  }

  const provider =
    cleanToken(value.provider);
  const operation =
    cleanToken(value.operation);
  const endpoint =
    cleanEndpoint(value.endpoint);
  const model =
    cleanToken(value.model);
  const quality =
    cleanToken(value.quality);
  const size =
    cleanToken(value.size);
  const outputFormat =
    cleanToken(
      value.outputFormat
    );
  const n =
    Number.isSafeInteger(value.n) &&
    value.n >= 1 &&
    value.n <= 4
      ? value.n
      : null;

  if (
    !provider ||
    !operation ||
    !endpoint ||
    !model ||
    !quality ||
    !size ||
    !outputFormat ||
    !n
  ) {
    return null;
  }

  return Object.freeze({
    configVersion:
      FACE_LAB_SIMULATION_PROVIDER_CONFIG_VERSION,
    provider,
    operation,
    endpoint,
    model,
    quality,
    size,
    outputFormat,
    n
  });
}

export function fingerprintFaceLabSimulationProviderConfig(
  value
) {
  const normalized =
    normalizeFaceLabSimulationProviderConfig(
      value
    );

  return normalized
    ? hashFaceLabAuthorityValue(
        normalized
      )
    : null;
}

export function buildFaceLabSimulationProviderConfig(
  value
) {
  const config =
    normalizeFaceLabSimulationProviderConfig(
      value
    );

  if (!config) {
    return null;
  }

  const fingerprint =
    fingerprintFaceLabSimulationProviderConfig(
      config
    );

  if (!fingerprint) {
    return null;
  }

  return Object.freeze({
    config,
    fingerprint
  });
}
