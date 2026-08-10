import {
  PILOT_WAVE_CANCELLATION_REASONS,
  PILOT_WAVE_CANCELLATION_SCHEMA_VERSION,
  validatePilotWaveCancellation
} from "@bejewely/face-contracts";
import { deepFreeze, sha256Hex, stableStringify } from "../shared/canonical-json.js";

const TOKEN = /^[a-z0-9][a-z0-9._-]{0,127}$/;

function failure(code, path, detail = null) {
  return Object.freeze({ ok: false, errors: Object.freeze([{ code, path, detail }]) });
}

function semantic(cancellation) {
  const { cancellationId, cancellationDigest, ...value } = cancellation;
  return value;
}

export function createPilotWaveCancellation({
  campaignRunId,
  waveOrdinal,
  runProjectionDigest,
  packets,
  reason,
  cancelledBy,
  cancelledAt = new Date().toISOString()
}) {
  if (!PILOT_WAVE_CANCELLATION_REASONS.includes(reason) || !TOKEN.test(cancelledBy || "") || !Number.isFinite(Date.parse(cancelledAt)) || new Date(cancelledAt).toISOString() !== cancelledAt || !Array.isArray(packets) || packets.length < 1) return failure("campaign_wave_cancellation_invalid", "$", null);
  const slotBindings = packets
    .map((packet) => ({ slotId: packet.slotId, attemptId: packet.attemptId, packetId: packet.packetId, packetDigest: packet.packetDigest }))
    .sort((left, right) => left.slotId.localeCompare(right.slotId));
  const value = {
    schemaVersion: PILOT_WAVE_CANCELLATION_SCHEMA_VERSION,
    campaignRunId,
    waveOrdinal,
    runProjectionDigest,
    slotBindings,
    reason,
    cancelledBy,
    cancelledAt
  };
  const cancellationDigest = sha256Hex(stableStringify(value));
  const cancellation = deepFreeze({ ...value, cancellationId: `wcan_${cancellationDigest.slice(0, 24)}`, cancellationDigest });
  return validatePilotWaveCancellation(cancellation).ok
    ? Object.freeze({ ok: true, cancellation })
    : failure("campaign_wave_cancellation_invalid", "$", null);
}

export function verifyPilotWaveCancellationIntegrity(cancellation) {
  if (!validatePilotWaveCancellation(cancellation).ok) return false;
  const digest = sha256Hex(stableStringify(semantic(cancellation)));
  return cancellation.cancellationDigest === digest && cancellation.cancellationId === `wcan_${digest.slice(0, 24)}`;
}
