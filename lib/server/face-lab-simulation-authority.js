import "server-only";

import {
  createHash,
  createHmac,
  timingSafeEqual
} from "node:crypto";

export const FACE_LAB_SIMULATION_AUTHORITY_VERSION =
  "face-lab-simulation-authority-v1";

export const FACE_LAB_SIMULATION_AUTHORITY_TTL_MS =
  15 * 60 * 1000;

const MAX_TOKEN_LENGTH = 2048;
const MAX_CLOCK_SKEW_MS = 60 * 1000;

function isObject(value) {
  return Boolean(value) &&
    typeof value === "object" &&
    !Array.isArray(value);
}

function normalizeStableValue(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeStableValue);
  }

  if (isObject(value)) {
    return Object.keys(value)
      .sort()
      .reduce((result, key) => {
        const normalized =
          normalizeStableValue(value[key]);

        if (normalized !== undefined) {
          result[key] = normalized;
        }

        return result;
      }, {});
  }

  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number") {
    return Number.isFinite(value)
      ? value
      : null;
  }

  if (typeof value === "boolean" ||
      value === null) {
    return value;
  }

  return value === undefined
    ? undefined
    : String(value);
}

export function stableSerializeFaceLabAuthority(value) {
  return JSON.stringify(
    normalizeStableValue(value)
  );
}

export function hashFaceLabAuthorityValue(value) {
  return createHash("sha256")
    .update(
      stableSerializeFaceLabAuthority(
        value
      )
    )
    .digest("hex");
}

export function hashFaceLabAuthorityImage(imageBuffer) {
  if (
    !Buffer.isBuffer(imageBuffer) ||
    !imageBuffer.length
  ) {
    return null;
  }

  return createHash("sha256")
    .update(imageBuffer)
    .digest("hex");
}

function signPayload(secret, encodedPayload) {
  return createHmac(
    "sha256",
    secret
  )
    .update(
      "face-lab-simulation-authority\n" +
      encodedPayload
    )
    .digest("base64url");
}

function safeEqual(left, right) {
  const leftBytes =
    Buffer.from(String(left || ""), "utf8");
  const rightBytes =
    Buffer.from(String(right || ""), "utf8");

  return leftBytes.length ===
    rightBytes.length &&
    timingSafeEqual(
      leftBytes,
      rightBytes
    );
}

export function issueFaceLabSimulationAuthority({
  secret,
  imageBuffer,
  analysis,
  locale = "ko",
  nowMs = Date.now(),
  ttlMs =
    FACE_LAB_SIMULATION_AUTHORITY_TTL_MS
} = {}) {
  if (
    typeof secret !== "string" ||
    !secret.trim() ||
    !isObject(analysis) ||
    !Buffer.isBuffer(imageBuffer) ||
    !imageBuffer.length ||
    !Number.isSafeInteger(nowMs) ||
    !Number.isSafeInteger(ttlMs) ||
    ttlMs <= 0 ||
    ttlMs > 60 * 60 * 1000
  ) {
    return null;
  }

  const normalizedLocale =
    locale === "en" ? "en" : "ko";
  const imageSha256 =
    hashFaceLabAuthorityImage(
      imageBuffer
    );
  const analysisSha256 =
    hashFaceLabAuthorityValue(
      analysis
    );

  if (!imageSha256 || !analysisSha256) {
    return null;
  }

  const payload = {
    version:
      FACE_LAB_SIMULATION_AUTHORITY_VERSION,
    locale: normalizedLocale,
    imageSha256,
    analysisSha256,
    issuedAt: nowMs,
    expiresAt: nowMs + ttlMs
  };
  const encodedPayload =
    Buffer.from(
      JSON.stringify(payload),
      "utf8"
    ).toString("base64url");
  const signature =
    signPayload(
      secret.trim(),
      encodedPayload
    );

  return {
    version:
      FACE_LAB_SIMULATION_AUTHORITY_VERSION,
    token:
      encodedPayload + "." + signature,
    expiresAt:
      new Date(
        payload.expiresAt
      ).toISOString()
  };
}

export function verifyFaceLabSimulationAuthority({
  token,
  secret,
  imageBuffer,
  analysis,
  locale = "ko",
  nowMs = Date.now()
} = {}) {
  if (
    typeof token !== "string" ||
    !token ||
    token.length > MAX_TOKEN_LENGTH ||
    typeof secret !== "string" ||
    !secret.trim() ||
    !Buffer.isBuffer(imageBuffer) ||
    !imageBuffer.length ||
    !isObject(analysis) ||
    !Number.isSafeInteger(nowMs)
  ) {
    return {
      ok: false,
      code: "simulation_authority_invalid"
    };
  }

  const parts = token.split(".");
  if (parts.length !== 2) {
    return {
      ok: false,
      code: "simulation_authority_invalid"
    };
  }

  const [
    encodedPayload,
    signature
  ] = parts;
  const expectedSignature =
    signPayload(
      secret.trim(),
      encodedPayload
    );

  if (
    !safeEqual(
      signature,
      expectedSignature
    )
  ) {
    return {
      ok: false,
      code: "simulation_authority_invalid"
    };
  }

  let payload = null;

  try {
    payload = JSON.parse(
      Buffer.from(
        encodedPayload,
        "base64url"
      ).toString("utf8")
    );
  } catch {
    return {
      ok: false,
      code: "simulation_authority_invalid"
    };
  }

  const normalizedLocale =
    locale === "en" ? "en" : "ko";

  if (
    !isObject(payload) ||
    payload.version !==
      FACE_LAB_SIMULATION_AUTHORITY_VERSION ||
    payload.locale !== normalizedLocale ||
    !Number.isSafeInteger(
      payload.issuedAt
    ) ||
    !Number.isSafeInteger(
      payload.expiresAt
    ) ||
    payload.expiresAt <=
      payload.issuedAt ||
    payload.issuedAt >
      nowMs + MAX_CLOCK_SKEW_MS
  ) {
    return {
      ok: false,
      code: "simulation_authority_invalid"
    };
  }

  if (payload.expiresAt < nowMs) {
    return {
      ok: false,
      code: "simulation_authority_expired"
    };
  }

  const imageSha256 =
    hashFaceLabAuthorityImage(
      imageBuffer
    );
  const analysisSha256 =
    hashFaceLabAuthorityValue(
      analysis
    );

  if (
    !safeEqual(
      payload.imageSha256,
      imageSha256
    ) ||
    !safeEqual(
      payload.analysisSha256,
      analysisSha256
    )
  ) {
    return {
      ok: false,
      code:
        "simulation_authority_mismatch"
    };
  }

  return {
    ok: true,
    version: payload.version,
    expiresAt:
      new Date(
        payload.expiresAt
      ).toISOString(),
    imageSha256,
    analysisSha256
  };
}
