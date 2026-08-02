import { readdir } from "node:fs/promises";
import path from "node:path";
import {
  DATASET_EXPOSURE_CLAIM_SCHEMA_VERSION,
  DATASET_EXPOSURE_CLASS,
  validateDatasetExposureClaimShape
} from "@bejewely/face-contracts";
import { readJson } from "../campaign/storage.js";
import { deepFreeze, sha256Hex, stableStringify } from "../shared/canonical-json.js";
import { datasetStorageLayout, nativeDatasetPath } from "./storage-layout.js";

function failure(code, pathName, detail = null) { return Object.freeze({ ok: false, errors: Object.freeze([{ code, path: pathName, detail }]) }); }
function semantic(value) { const { firstExposedAt, claimDigest, ...rest } = value; return rest; }

export function verifyDatasetExposureClaimIntegrity(value) {
  return validateDatasetExposureClaimShape(value).ok && value.claimDigest === sha256Hex(stableStringify(semantic(value)));
}

async function readJsonTree(directory) {
  let entries;
  try { entries = await readdir(directory, { withFileTypes: true }); }
  catch (error) { if (error?.code === "ENOENT") return []; throw error; }
  const values = [];
  for (const entry of entries) {
    if (entry.isSymbolicLink()) throw Object.assign(new Error("exposure_registry_invalid"), { code: "exposure_registry_invalid" });
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) values.push(...await readJsonTree(absolute));
    else if (entry.isFile() && entry.name.endsWith(".json")) values.push(await readJson(absolute));
  }
  return values;
}

function projectChain(claims) {
  if (!claims.length || !claims.every(verifyDatasetExposureClaimIntegrity)) return failure("exposure_registry_invalid", "claims");
  const digests = claims.map((claim) => claim.claimDigest);
  if (new Set(digests).size !== digests.length) return failure("exposure_registry_invalid", "claims", "duplicate");
  const lineages = new Set(claims.map((claim) => claim.datasetLineageId));
  const fingerprints = new Set(claims.map((claim) => claim.componentFingerprint));
  const splits = new Set(claims.map((claim) => claim.assignedSplit));
  if (lineages.size !== 1 || fingerprints.size !== 1 || splits.size !== 1) return failure("exposure_registry_invalid", "claims", "sticky_split_violation");
  const byDigest = new Map(claims.map((claim) => [claim.claimDigest, claim]));
  const roots = claims.filter((claim) => claim.predecessorClaimDigest === null);
  if (roots.length !== 1) return failure("exposure_registry_invalid", "claims", "invalid_root");
  const children = new Map();
  for (const claim of claims) {
    if (!claim.predecessorClaimDigest) continue;
    if (!byDigest.has(claim.predecessorClaimDigest)) return failure("exposure_registry_invalid", "claims", "broken_chain");
    children.set(claim.predecessorClaimDigest, (children.get(claim.predecessorClaimDigest) || 0) + 1);
  }
  if ([...children.values()].some((count) => count !== 1)) return failure("exposure_registry_invalid", "claims", "branched_chain");
  const leaves = claims.filter((claim) => !children.has(claim.claimDigest));
  if (leaves.length !== 1) return failure("exposure_registry_invalid", "claims", "ambiguous_head");
  let current = leaves[0];
  const seen = new Set();
  while (current) {
    if (seen.has(current.claimDigest)) return failure("exposure_registry_invalid", "claims", "cycle");
    seen.add(current.claimDigest);
    current = current.predecessorClaimDigest ? byDigest.get(current.predecessorClaimDigest) : null;
  }
  if (seen.size !== claims.length) return failure("exposure_registry_invalid", "claims", "disconnected");
  return Object.freeze({ ok: true, head: leaves[0], claims: claims.slice().sort((a, b) => a.claimDigest.localeCompare(b.claimDigest)) });
}

async function readComponentMemberKeys(dataRoot, datasetLineageId, claims) {
  const requiredVersions = new Set(claims.map((claim) => claim.datasetVersionDigest));
  const keysByVersionAndFingerprint = new Map();
  const lineageRoot = path.join(dataRoot, "datasets", datasetLineageId);
  let versions;
  try { versions = await readdir(lineageRoot, { withFileTypes: true }); }
  catch (error) {
    if (error?.code === "ENOENT" && requiredVersions.size === 0) return keysByVersionAndFingerprint;
    throw Object.assign(new Error("exposure_registry_invalid"), { code: "exposure_registry_invalid" });
  }
  for (const entry of versions) {
    if (entry.isSymbolicLink()) throw Object.assign(new Error("exposure_registry_invalid"), { code: "exposure_registry_invalid" });
    if (!entry.isDirectory() || !entry.name.startsWith("dsv_")) continue;
    let version;
    let memberIndex;
    try {
      version = await readJson(path.join(lineageRoot, entry.name, "locked-manifest.json"));
      if (!requiredVersions.has(version.datasetVersionDigest)) continue;
      memberIndex = await readJson(path.join(lineageRoot, entry.name, "member-index.json"));
    } catch {
      throw Object.assign(new Error("exposure_registry_invalid"), { code: "exposure_registry_invalid" });
    }
    if (!Array.isArray(memberIndex.memberDigests)) throw Object.assign(new Error("exposure_registry_invalid"), { code: "exposure_registry_invalid" });
    for (const digest of memberIndex.memberDigests) {
      let member;
      try { member = await readJson(nativeDatasetPath(dataRoot, datasetStorageLayout.member(digest))); }
      catch { throw Object.assign(new Error("exposure_registry_invalid"), { code: "exposure_registry_invalid" }); }
      if (member.memberDigest !== digest || member.sourceSnapshotDigest !== version.sourceSnapshotDigest || !/^[a-f0-9]{64}$/.test(member.componentFingerprint || "") || !/^[a-f0-9]{64}$/.test(member.canonicalSha256 || "") || !/^[a-f0-9]{64}$/.test(member.claimValuesDigest || "")) throw Object.assign(new Error("exposure_registry_invalid"), { code: "exposure_registry_invalid" });
      const mapKey = `${version.datasetVersionDigest}:${member.componentFingerprint}`;
      if (!keysByVersionAndFingerprint.has(mapKey)) keysByVersionAndFingerprint.set(mapKey, new Set());
      keysByVersionAndFingerprint.get(mapKey).add(sha256Hex(stableStringify([member.canonicalSha256, member.claimValuesDigest])));
    }
  }
  for (const claim of claims) {
    const keys = keysByVersionAndFingerprint.get(`${claim.datasetVersionDigest}:${claim.componentFingerprint}`);
    if (!keys || keys.size === 0) throw Object.assign(new Error("exposure_registry_invalid"), { code: "exposure_registry_invalid" });
  }
  return keysByVersionAndFingerprint;
}

export async function readExposureRegistry(dataRoot, datasetLineageId) {
  let values;
  try { values = await readJsonTree(path.join(dataRoot, "objects", "exposure-claims", "sha256")); }
  catch (error) { return failure(error?.code || "exposure_registry_invalid", "exposureRegistry"); }
  const relevant = values.filter((claim) => claim.datasetLineageId === datasetLineageId);
  let memberKeys;
  try { memberKeys = await readComponentMemberKeys(dataRoot, datasetLineageId, relevant); }
  catch (error) { return failure(error?.code || "exposure_registry_invalid", "exposureRegistry", "member_history"); }
  const byFingerprint = new Map();
  for (const claim of relevant) {
    if (!byFingerprint.has(claim.componentFingerprint)) byFingerprint.set(claim.componentFingerprint, []);
    byFingerprint.get(claim.componentFingerprint).push(claim);
  }
  const heads = [];
  const allClaims = [];
  for (const [fingerprint, claims] of byFingerprint) {
    const projected = projectChain(claims);
    if (!projected.ok) return projected;
    const keySet = new Set();
    for (const claim of projected.claims) {
      for (const key of memberKeys.get(`${claim.datasetVersionDigest}:${fingerprint}`) || []) keySet.add(key);
    }
    heads.push({ componentFingerprint: fingerprint, assignedSplit: projected.head.assignedSplit, headClaimDigest: projected.head.claimDigest, memberKeyDigests: [...keySet].sort() });
    allClaims.push(...projected.claims);
  }
  heads.sort((a, b) => a.componentFingerprint.localeCompare(b.componentFingerprint));
  allClaims.sort((a, b) => a.claimDigest.localeCompare(b.claimDigest));
  const semantic = { datasetLineageId, heads, claimDigests: allClaims.map((claim) => claim.claimDigest) };
  return Object.freeze({ ok: true, heads: deepFreeze(heads), claims: deepFreeze(allClaims), registryDigest: sha256Hex(stableStringify(semantic)) });
}

export function createExposureClaim({ datasetLineageId, componentFingerprint, datasetVersionDigest, assignedSplit, predecessorClaimDigest = null, firstExposedAt = new Date().toISOString() }) {
  const semanticValue = {
    schemaVersion: DATASET_EXPOSURE_CLAIM_SCHEMA_VERSION,
    datasetLineageId,
    componentFingerprint,
    datasetVersionDigest,
    assignedSplit,
    exposureClass: DATASET_EXPOSURE_CLASS[assignedSplit],
    predecessorClaimDigest
  };
  const claim = deepFreeze({ ...semanticValue, firstExposedAt, claimDigest: sha256Hex(stableStringify(semanticValue)) });
  return verifyDatasetExposureClaimIntegrity(claim) ? Object.freeze({ ok: true, claim }) : failure("dataset_exposure_claim_invalid", "claim");
}
