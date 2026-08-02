import { createHash } from "node:crypto";
import { lstat, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { validateObservationRunRequest } from "@bejewely/face-contracts";
import { CANONICAL_OBSERVATION_SNAPSHOT, verifyCanonicalObservationSnapshot } from "./snapshot/canonical-v1.js";
import { resolveObservationAdapterProfile } from "./profiles.js";
import { buildObservationRunIdentity } from "./run-identity.js";
import { observationStorageLayout } from "./storage-layout.js";

function isInside(root, target) {
  const relative = path.relative(root, target);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

async function resolveCanonicalAsset(dataRoot, relativePath) {
  const rootReal = await realpath(dataRoot);
  const segments = relativePath.replace(/\\/g, "/").split("/");
  let current = rootReal;
  for (const segment of segments) {
    current = path.join(current, segment);
    const info = await lstat(current);
    if (info.isSymbolicLink()) throw Object.assign(new Error("canonical_asset_path_unsafe"), { code: "canonical_asset_path_unsafe" });
  }
  const targetReal = await realpath(current);
  if (!isInside(rootReal, targetReal)) throw Object.assign(new Error("canonical_asset_path_unsafe"), { code: "canonical_asset_path_unsafe" });
  const info = await lstat(targetReal);
  if (!info.isFile()) throw Object.assign(new Error("canonical_asset_missing"), { code: "canonical_asset_missing" });
  return targetReal;
}

async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

export async function preflightObservationRun({ request, dataRoot, snapshot = CANONICAL_OBSERVATION_SNAPSHOT }) {
  const validation = validateObservationRunRequest(request);
  if (!validation.ok) return Object.freeze({ ok: false, errors: validation.errors });
  const snapshotValidation = verifyCanonicalObservationSnapshot(snapshot);
  if (!snapshotValidation.ok || request.contractSnapshotId !== snapshot.snapshotId) {
    return Object.freeze({ ok: false, errors: [{ code: snapshotValidation.code || "contract_snapshot_missing", path: "contractSnapshotId" }] });
  }
  const profileResult = resolveObservationAdapterProfile(request);
  if (!profileResult.ok) return Object.freeze({ ok: false, errors: [{ code: profileResult.code, path: "adapterProfile" }] });

  let canonicalAbsolutePath;
  let imageBuffer;
  try {
    canonicalAbsolutePath = await resolveCanonicalAsset(dataRoot, request.candidate.canonicalAsset.objectRelativePath);
    imageBuffer = await readFile(canonicalAbsolutePath);
  } catch (error) {
    return Object.freeze({ ok: false, errors: [{ code: error?.code || "canonical_asset_missing", path: "candidate.canonicalAsset.objectRelativePath" }] });
  }
  const actualSha256 = createHash("sha256").update(imageBuffer).digest("hex");
  if (actualSha256 !== request.candidate.canonicalAsset.sha256) {
    return Object.freeze({ ok: false, errors: [{ code: "canonical_asset_hash_mismatch", path: "candidate.canonicalAsset.sha256" }] });
  }

  const identity = buildObservationRunIdentity({ request, snapshot, modeProfile: profileResult.modeProfile });
  const layout = observationStorageLayout(dataRoot, request.candidate.candidateId, identity.runId);
  const existingManifest = await readJsonIfExists(layout.manifestPath);
  const existingClaim = await readJsonIfExists(layout.claimPath);
  if (existingManifest) {
    if (existingManifest.runDigest !== identity.runDigest) {
      return Object.freeze({ ok: false, errors: [{ code: "run_identity_conflict", path: "execution" }] });
    }
    return Object.freeze({ ok: true, state: "existing_run", identity, existingManifest, imageBuffer: null, canonicalAbsolutePath: null, profile: profileResult.profile, modeProfile: profileResult.modeProfile, snapshot });
  }
  if (existingClaim) {
    if (existingClaim.runDigest !== identity.runDigest) {
      return Object.freeze({ ok: false, errors: [{ code: "run_identity_conflict", path: "execution" }] });
    }
    return Object.freeze({ ok: false, errors: [{ code: "execution_state_uncertain", path: "execution.replicateOrdinal" }], identity });
  }

  return Object.freeze({
    ok: true,
    state: "ready",
    identity,
    imageBuffer,
    canonicalAbsolutePath,
    profile: profileResult.profile,
    modeProfile: profileResult.modeProfile,
    snapshot,
    layout
  });
}
