import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, open, readFile, rm, chmod, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";
import { HostedContractError } from "./premium-hosted-preview-contract-core.mjs";

const execFileAsync = promisify(execFile);
const CLOUD_SEGMENTS = new Set(["onedrive", "dropbox", "google drive", "googledrive", "icloud drive"]);

function fail(code, detail = null) {
  throw new HostedContractError(code, detail);
}

function isInside(parent, child) {
  const rel = relative(resolve(parent), resolve(child));
  return rel === "" || (!rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel));
}

export function assertPathInside(parent, child, code = "path_outside_allowed_root") {
  if (!isInside(parent, child)) fail(code, resolve(child));
  return resolve(child);
}

export function validateCredentialRoot(root, { repositoryRoot = process.cwd(), osTempRoot = tmpdir() } = {}) {
  const target = resolve(root);
  if (isInside(repositoryRoot, target)) fail("credential_root_inside_repository");
  if (!isInside(osTempRoot, target)) fail("credential_root_outside_os_temp");
  const segments = target.toLowerCase().split(/[\\/]+/);
  if (segments.some((segment) => CLOUD_SEGMENTS.has(segment))) fail("credential_root_cloud_synced");
  return target;
}

export function resolveHostedRunPaths(runId, env = process.env) {
  const safeRunId = String(runId || "").trim();
  if (!/^[a-zA-Z0-9._-]{8,128}$/.test(safeRunId)) fail("credential_run_id_invalid");
  const root = validateCredentialRoot(
    env.PREMIUM_HOSTED_SECURE_ROOT || resolve(tmpdir(), "bejewely-premium-hosted", safeRunId)
  );
  return {
    root,
    credentialsDir: resolve(root, "credentials"),
    artifactsDir: resolve(root, "artifacts"),
    locksDir: resolve(root, "locks")
  };
}

async function applyWindowsAcl(path, directory) {
  const principal = process.env.USERNAME || process.env.USER;
  if (!principal) fail("credential_acl_principal_missing");
  const grant = directory ? `${principal}:(OI)(CI)F` : `${principal}:F`;
  const systemGrant = directory ? "SYSTEM:(OI)(CI)F" : "SYSTEM:F";
  await execFileAsync("icacls", [path, "/inheritance:r", "/grant:r", grant, "/grant:r", systemGrant])
    .catch(() => fail("credential_acl_apply_failed", path));
}

async function verifyMode(path, expectedMask) {
  if (process.platform === "win32") return;
  const info = await stat(path);
  if ((info.mode & 0o777) !== expectedMask) fail("credential_mode_invalid", path);
}

export async function ensureSecureRunDirectories(paths) {
  for (const path of [paths.root, paths.credentialsDir, paths.artifactsDir, paths.locksDir]) {
    await mkdir(path, { recursive: true, mode: 0o700 });
    if (process.platform === "win32") await applyWindowsAcl(path, true);
    else {
      await chmod(path, 0o700);
      await verifyMode(path, 0o700);
    }
  }
  return paths;
}

export async function secureWriteJson(path, value) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const handle = await open(path, "wx", 0o600).catch((error) => {
    if (error?.code === "EEXIST") fail("credential_file_already_exists", path);
    throw error;
  });
  try {
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, "utf8");
  } finally {
    await handle.close();
  }
  if (process.platform === "win32") await applyWindowsAcl(path, false);
  else {
    await chmod(path, 0o600);
    await verifyMode(path, 0o600);
  }
}

export async function hashFileSha256(path) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

export async function acquireHostedRunLock(paths, lockKey, { now = Date.now(), ttlMs = 30 * 60 * 1000 } = {}) {
  const key = createHash("sha256").update(String(lockKey)).digest("hex");
  const lockPath = resolve(paths.locksDir, `${key}.lock`);
  const payload = {
    pid: process.pid,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + ttlMs).toISOString()
  };
  try {
    await secureWriteJson(lockPath, payload);
  } catch (error) {
    if (error?.code !== "credential_file_already_exists") throw error;
    let existing;
    try {
      existing = JSON.parse(await readFile(lockPath, "utf8"));
    } catch {
      fail("concurrent_run_lock_invalid", lockPath);
    }
    const expiresAt = Date.parse(existing?.expiresAt || "");
    if (!Number.isFinite(expiresAt) || expiresAt > now) fail("concurrent_run_active", lockPath);
    await rm(lockPath, { force: true });
    await secureWriteJson(lockPath, payload);
  }
  return {
    lockPath,
    async release() {
      await rm(lockPath, { force: true });
    }
  };
}

export async function cleanupSecureRun(paths) {
  await rm(paths.root, { recursive: true, force: true });
}

export function validateLoginEvidence(evidence, expected, { now = Date.now() } = {}) {
  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) fail("login_evidence_invalid");
  const required = [
    "schemaVersion",
    "accountKey",
    "userIdHash",
    "permanentUser",
    "providerCategory",
    "deploymentId",
    "deploymentSha",
    "targetHost",
    "storageStateHash",
    "createdAt",
    "expiresAt"
  ];
  for (const key of required) if (!(key in evidence)) fail("login_evidence_field_missing", key);
  if (evidence.accountKey !== expected.accountKey) fail("login_evidence_account_mismatch");
  if (evidence.userIdHash !== expected.userIdHash) fail("login_evidence_user_mismatch");
  if (evidence.permanentUser !== true) fail("login_evidence_not_permanent");
  if (evidence.providerCategory !== "google") fail("login_evidence_provider_invalid");
  if (
    evidence.deploymentId !== expected.deploymentId ||
    evidence.deploymentSha !== expected.deploymentSha ||
    evidence.targetHost !== expected.targetHost
  ) {
    fail("login_evidence_deployment_mismatch");
  }
  if (evidence.storageStateHash !== expected.storageStateHash) fail("login_evidence_storage_hash_mismatch");
  const createdAt = Date.parse(evidence.createdAt);
  const expiresAt = Date.parse(evidence.expiresAt);
  if (
    !Number.isFinite(createdAt) ||
    !Number.isFinite(expiresAt) ||
    createdAt > now + 60_000 ||
    expiresAt <= now ||
    expiresAt <= createdAt
  ) {
    fail("login_evidence_expired_or_invalid");
  }
  return true;
}
