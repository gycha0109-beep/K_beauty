import { randomUUID } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import {
  mkdir,
  open,
  readFile,
  rename,
  rm,
  stat
} from "node:fs/promises";
import path from "node:path";
import {
  createCandidateImportError,
  immutableCandidateProjection
} from "@bejewely/face-contracts";
import { stableStringify } from "../generation/canonicalize-generation-spec.js";
import { toNativePath } from "./storage-layout.js";

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

async function writeTempAndRename(targetPath, bytes) {
  await mkdir(path.dirname(targetPath), { recursive: true });
  const tempPath = `${targetPath}.tmp-${process.pid}-${randomUUID()}`;
  const handle = await open(tempPath, fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY, 0o600);
  try {
    await handle.writeFile(bytes);
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await rename(tempPath, targetPath);
  } catch (error) {
    await rm(tempPath, { force: true });
    throw error;
  }
}

async function ensureImmutableBytes(targetPath, bytes, conflictCode, conflictPath) {
  if (await exists(targetPath)) {
    const existing = await readFile(targetPath);
    if (!existing.equals(Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes))) {
      throw createCandidateImportError(conflictCode, conflictPath, "existing_bytes_differ");
    }
    return 0;
  }
  await writeTempAndRename(targetPath, bytes);
  return 1;
}

function withoutRegisteredAt(value) {
  const { registeredAt, ...rest } = value;
  return rest;
}

async function ensureAssetRecord(targetPath, assetManifest) {
  if (await exists(targetPath)) {
    const existing = JSON.parse(await readFile(targetPath, "utf8"));
    if (stableStringify(withoutRegisteredAt(existing)) !== stableStringify(withoutRegisteredAt(assetManifest))) {
      throw createCandidateImportError("candidate_identity_conflict", "asset", "asset_record_conflict");
    }
    return 0;
  }
  await writeTempAndRename(targetPath, `${stableStringify(assetManifest)}\n`);
  return 1;
}

async function publishCandidateManifest(targetPath, candidateManifest) {
  if (await exists(targetPath)) {
    const existing = JSON.parse(await readFile(targetPath, "utf8"));
    if (
      stableStringify(immutableCandidateProjection(existing)) !==
      stableStringify(immutableCandidateProjection(candidateManifest))
    ) {
      throw createCandidateImportError("candidate_identity_conflict", "candidateId", "existing_manifest_differs");
    }
    return { writes: 0, outcome: "existing_candidate", manifest: existing };
  }
  await writeTempAndRename(targetPath, `${stableStringify(candidateManifest)}\n`);
  return { writes: 1, outcome: "registered_candidate", manifest: candidateManifest };
}

async function acquireLock(dataRoot) {
  const lockPath = path.join(dataRoot, "locks", "candidate-import.lock");
  await mkdir(path.dirname(lockPath), { recursive: true });
  try {
    const handle = await open(lockPath, "wx", 0o600);
    await handle.writeFile(`${JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() })}\n`);
    await handle.sync();
    return { handle, lockPath };
  } catch (error) {
    throw createCandidateImportError("storage_lock_unavailable", "storage", error?.code || null);
  }
}

export async function commitImportTransaction({
  dataRoot,
  paths,
  rawBuffer,
  canonicalBuffer,
  specEnvelope,
  promptEnvelope,
  assetManifest,
  candidateManifest
}) {
  await mkdir(dataRoot, { recursive: true });
  const lock = await acquireLock(dataRoot);
  let writesPerformed = 0;
  try {
    writesPerformed += await ensureImmutableBytes(
      toNativePath(dataRoot, paths.raw),
      rawBuffer,
      "candidate_identity_conflict",
      "asset.raw"
    );
    writesPerformed += await ensureImmutableBytes(
      toNativePath(dataRoot, paths.canonical),
      canonicalBuffer,
      "candidate_identity_conflict",
      "asset.canonical"
    );
    writesPerformed += await ensureImmutableBytes(
      toNativePath(dataRoot, paths.spec),
      specEnvelope,
      "generation_artifact_identity_conflict",
      "generation.spec"
    );
    writesPerformed += await ensureImmutableBytes(
      toNativePath(dataRoot, paths.prompt),
      promptEnvelope,
      "generation_artifact_identity_conflict",
      "generation.compiledPrompt"
    );
    writesPerformed += await ensureAssetRecord(
      toNativePath(dataRoot, paths.assetRecord),
      assetManifest
    );

    const published = await publishCandidateManifest(
      toNativePath(dataRoot, paths.candidateManifest),
      candidateManifest
    );
    writesPerformed += published.writes;
    return {
      ok: true,
      outcome: published.outcome,
      writesPerformed,
      manifest: published.manifest
    };
  } catch (error) {
    if (error?.code && error?.path) {
      return { ok: false, errors: [error], writesPerformed };
    }
    return {
      ok: false,
      errors: [createCandidateImportError("atomic_commit_failed", "storage", error?.message || null)],
      writesPerformed
    };
  } finally {
    await lock.handle.close().catch(() => {});
    await rm(lock.lockPath, { force: true }).catch(() => {});
  }
}
