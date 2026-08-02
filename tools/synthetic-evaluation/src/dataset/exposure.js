import { readdir } from "node:fs/promises";
import path from "node:path";
import {
  DATASET_EXPOSURE_CLAIM_SCHEMA_VERSION,
  DATASET_EXPOSURE_CLASS,
  validateDatasetExposureClaimShape
} from "@bejewely/face-contracts";
import { readJson } from "../campaign/storage.js";
import { deepFreeze, sha256Hex, stableStringify } from "../shared/canonical-json.js";

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

export async function readExposureRegistry(dataRoot, datasetLineageId) {
  let values;
  try { values = await readJsonTree(path.join(dataRoot, "objects", "exposure-claims", "sha256")); }
  catch (error) { return failure(error?.code || "exposure_registry_invalid", "exposureRegistry"); }
  const relevant = values.filter((claim) => claim.datasetLineageId === datasetLineageId);
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
    heads.push({ componentFingerprint: fingerprint, assignedSplit: projected.head.assignedSplit, headClaimDigest: projected.head.claimDigest });
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
