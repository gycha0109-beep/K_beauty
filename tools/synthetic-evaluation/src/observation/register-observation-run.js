import { mkdir, open, readFile } from "node:fs/promises";
import path from "node:path";
import {
  OBSERVATION_EXECUTION_CLAIM_SCHEMA_VERSION,
  SYNTHETIC_OBSERVATION_OBJECT_SCHEMA_VERSION,
  SYNTHETIC_OBSERVATION_RUN_SCHEMA_VERSION
} from "@bejewely/face-contracts";
import { deepFreeze, sha256Hex, stableStringify } from "../generation/canonicalize-generation-spec.js";
import { observationStorageLayout, relativeFromDataRoot } from "./storage-layout.js";

async function writeExclusiveJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const serialized = `${stableStringify(value)}\n`;
  let handle;
  try {
    handle = await open(filePath, "wx", 0o600);
    await handle.writeFile(serialized, "utf8");
    await handle.sync();
  } finally {
    await handle?.close();
  }
  return serialized;
}

async function writeContentAddressedJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const serialized = `${stableStringify(value)}\n`;
  try {
    const handle = await open(filePath, "wx", 0o600);
    try {
      await handle.writeFile(serialized, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    return { created: true };
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
    const existing = await readFile(filePath, "utf8");
    if (existing !== serialized) throw Object.assign(new Error("observation_object_conflict"), { code: "observation_object_conflict" });
    return { created: false };
  }
}

export async function createObservationExecutionClaim({ preflight, request, now = () => new Date() }) {
  const claim = deepFreeze({
    schemaVersion: OBSERVATION_EXECUTION_CLAIM_SCHEMA_VERSION,
    runId: preflight.identity.runId,
    runDigest: preflight.identity.runDigest,
    candidateId: request.candidate.candidateId,
    canonicalSha256: request.candidate.canonicalAsset.sha256,
    adapterProfileId: request.adapterProfile.id,
    adapterProfileVersion: request.adapterProfile.version,
    contractSnapshotId: preflight.snapshot.snapshotId,
    contractSnapshotDigest: preflight.snapshot.snapshotDigest,
    mode: request.execution.mode,
    provider: preflight.modeProfile.provider,
    model: request.execution.requestedModel,
    replicateOrdinal: request.execution.replicateOrdinal,
    claimedAt: now().toISOString()
  });
  try {
    await writeExclusiveJson(preflight.layout.claimPath, claim);
  } catch (error) {
    if (error?.code === "EEXIST") throw Object.assign(new Error("execution_state_uncertain"), { code: "execution_state_uncertain" });
    throw error;
  }
  return claim;
}

function buildObservationObject({ request, snapshot, bundle }) {
  const semantic = {
    schemaVersion: SYNTHETIC_OBSERVATION_OBJECT_SCHEMA_VERSION,
    candidateId: request.candidate.candidateId,
    canonicalSha256: request.candidate.canonicalAsset.sha256,
    contractSnapshotDigest: snapshot.snapshotDigest,
    bundle
  };
  const observationDigest = sha256Hex(stableStringify(semantic));
  return deepFreeze({ ...semantic, observationDigest });
}

function sanitizeFailure(failure) {
  if (!failure) return null;
  return Object.freeze({
    code: typeof failure.code === "string" ? failure.code.slice(0, 80) : "observation_execution_failed",
    category: typeof failure.category === "string" ? failure.category.slice(0, 80) : "unknown"
  });
}

export async function registerObservationRun({
  dataRoot,
  request,
  preflight,
  startedAt,
  completedAt,
  telemetry,
  bundle = null,
  outcome,
  failure = null,
  now = () => new Date()
}) {
  let observation = null;
  if (outcome === "observed_bundle") {
    const object = buildObservationObject({ request, snapshot: preflight.snapshot, bundle });
    const objectLayout = observationStorageLayout(dataRoot, request.candidate.candidateId, preflight.identity.runId, object.observationDigest);
    await writeContentAddressedJson(objectLayout.observationObjectPath, object);
    observation = Object.freeze({
      schemaVersion: SYNTHETIC_OBSERVATION_OBJECT_SCHEMA_VERSION,
      digest: object.observationDigest,
      objectRelativePath: relativeFromDataRoot(dataRoot, objectLayout.observationObjectPath),
      visionSchemaVersion: bundle.schemaVersion,
      visionPromptVersion: bundle.promptVersion
    });
  }

  const run = deepFreeze({
    schemaVersion: SYNTHETIC_OBSERVATION_RUN_SCHEMA_VERSION,
    runId: preflight.identity.runId,
    runDigest: preflight.identity.runDigest,
    candidate: {
      candidateId: request.candidate.candidateId,
      canonicalSha256: request.candidate.candicalAsset.sha256,
      canonicalTransformPolicyVersion: request.candidate.canonicalAsset.transformPolicyVersion
    },
    adapter: {
      profileId: request.adapterProfile.id,
      profileVersion: request.adapterProfile.version,
      contractSnapshotId: preflight.snapshot.snapshotId,
      contractSnapshotDigest: preflight.snapshot.snapshotDigest
    },
    execution: {
      mode: request.execution.mode,
      provider: preflight.modeProfile.provider,
      model: request.execution.requestedModel,
      replicateOrdinal: request.execution.replicateOrdinal,
      imageProviderAttemptCount: telemetry?.imageProviderAttemptCount ?? 0,
      inputTokens: telemetry?.inputTokens ?? null,
      outputTokens: telemetry?.outputTokens ?? null,
      startedAt,
      completedAt
    },
    authority: preflight.modeProfile.authority,
    outcome,
    observation,
    failure: sanitizeFailure(failure),
    retention: {
      observationProcessCreatedImageCopy: false,
      rawProviderResponsePersisted: false
    },
    registeredAt: now().toISOString()
  });

  try {
    await writeExclusiveJson(preflight.layout.manifestPath, run);
  } catch (error) {
    if (error?.code === "EEXIST") {
      const existing = JSON.parse(await readFile(preflight.layout.manifestPath, "utf8"));
      if (existing.runDigest !== run.runDigest) throw Object.assign(new Error("run_manifest_conflict"), { code: "run_manifest_conflict" });
      return Object.freeze({ run: existing, idempotent: true });
    }
    throw error;
  }
  return Object.freeze({ run, idempotent: false });
}

export async function readObservationObject(dataRoot, observationReference) {
  const absolutePath = path.join(dataRoot, ...observationReference.objectRelativePath.split("/"));
  const object = JSON.parse(await readFile(absolutePath, "utf8"));
  if (object.observationDigest !== observationReference.digest) throw new Error("observation_object_conflict");
  return object;
}
