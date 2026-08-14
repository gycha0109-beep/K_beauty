import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const TRANSFER_SCHEMA_VERSION = "bejewely-face-lab-home-transfer-v1";
export const D2CF_DEFINITION_DIGEST = "8e630605ece0629da6a51e30829297688c27f10a3a92be6a3c8e3413f546bb46";
export const D2DP_PACKET_AUTHORITY_DIGEST = "1f344a9d1cbd8e8ac6076b06da7780d213ff6ff71df80ea7a9f818617965339c";
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const sortKeys = (value) => Array.isArray(value)
  ? value.map(sortKeys)
  : value && typeof value === "object"
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortKeys(value[key])]))
    : value;
export const stableStringify = (value) => JSON.stringify(sortKeys(value));
const parseArgs = () => {
  const values = {};
  for (let index = 2; index < process.argv.length; index += 2) {
    assert.match(process.argv[index] || "", /^--[a-z-]+$/);
    assert.ok(process.argv[index + 1]);
    values[process.argv[index].slice(2)] = process.argv[index + 1];
  }
  return values;
};
export const recursiveInventory = (root, excluded = new Set()) => readdirSync(root, { recursive: true })
  .filter((relativePath) => statSync(path.join(root, relativePath)).isFile())
  .map((relativePath) => relativePath.split(path.sep).join("/"))
  .filter((relativePath) => !excluded.has(relativePath))
  .map((relativePath) => {
    const bytes = readFileSync(path.join(root, relativePath));
    return { relativePath, sha256: sha256(bytes), byteLength: bytes.length };
  })
  .sort((left, right) => left.relativePath.localeCompare(right.relativePath));

const forbiddenPath = /(^|\/)(?:\.env(?:\.|$)|node_modules(?:\/|$)|\.git(?:\/|$)|\.vscode(?:\/|$)|\.idea(?:\/|$)|cookies?(?:\.|\/|$)|credentials?(?:\.|\/|$))/i;
const textExtension = /\.(?:json|jsonl|md|txt|csv|tsv|ya?ml|js|mjs|cjs|ts|tsx|html|css|xml|log|toml|ini|cfg|conf|sql)$/i;
const secretPatterns = [
  /(?:OPENAI_API_KEY|SUPABASE_SERVICE_ROLE_KEY|GITHUB_TOKEN|GOOGLE_APPLICATION_CREDENTIALS)\s*[:=]\s*["']?[^\s"']+/i,
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/,
  /\bgh(?:p|o|u|s|r)_[A-Za-z0-9]{20,}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /"client_secret"\s*:\s*"[^"\s]{8,}"/i
];
export function scanTransferSecrets(root, entries) {
  const findings = [];
  for (const entry of entries) {
    if (forbiddenPath.test(entry.relativePath)) findings.push(`${entry.relativePath}:forbidden_path`);
    if (!textExtension.test(entry.relativePath) || entry.byteLength > 20 * 1024 * 1024) continue;
    const text = readFileSync(path.join(root, entry.relativePath), "utf8");
    secretPatterns.forEach((pattern, index) => {
      if (pattern.test(text)) findings.push(`${entry.relativePath}:secret_pattern_${index + 1}`);
    });
  }
  return findings;
}

export function verifyTransferRoot(root) {
  root = path.resolve(root);
  const manifestPath = path.join(root, "TRANSFER_MANIFEST.json");
  const readmePath = path.join(root, "TRANSFER_README.txt");
  assert.equal(existsSync(manifestPath), true, "TRANSFER_MANIFEST.json missing");
  assert.equal(existsSync(readmePath), true, "TRANSFER_README.txt missing");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  assert.equal(manifest.schemaVersion, TRANSFER_SCHEMA_VERSION);
  assert.equal(manifest.sourceMachineRole, "academy");
  assert.equal(manifest.repository, "gycha0109-beep/K_beauty");
  assert.equal(manifest.d2cFDefinitionContractDigest, D2CF_DEFINITION_DIGEST);
  assert.equal(manifest.d2dPPacketAuthorityDigest, D2DP_PACKET_AUTHORITY_DIGEST);
  assert.equal(manifest.secretScan, "PASS");
  assert.equal(manifest.archiveSha256, "SEE_SIDECAR");
  const semantic = structuredClone(manifest);
  delete semantic.manifestDigest;
  assert.equal(sha256(stableStringify(semantic)), manifest.manifestDigest, "manifest digest mismatch");
  const entries = recursiveInventory(root, new Set(["TRANSFER_MANIFEST.json"]));
  assert.deepEqual(entries, manifest.files, "transfer file inventory mismatch");
  assert.equal(entries.length, manifest.fileCount);
  assert.equal(entries.reduce((sum, entry) => sum + entry.byteLength, 0), manifest.totalBytes);
  assert.deepEqual(scanTransferSecrets(root, entries), []);
  for (const includedRoot of manifest.includedRoots) assert.equal(existsSync(path.join(root, includedRoot)), true, `included root missing:${includedRoot}`);
  const d2dpAuthority = JSON.parse(readFileSync(path.join(root, ".synthetic-local", "face-eval-c-w1m", "cx1g-d2d-p", "private", "packet-authority-v1.json"), "utf8"));
  assert.equal(d2dpAuthority.authorityDigest, D2DP_PACKET_AUTHORITY_DIGEST);
  const uiAuthority = JSON.parse(readFileSync(path.join(root, ".synthetic-local", "face-eval-c-w1m", "cx1g-d2d-ui1", "private", "ui-distribution-authority-v1.json"), "utf8"));
  assert.equal(uiAuthority.authorityDigest, manifest.d2dUI1DistributionAuthorityDigest);
  return { manifest, entries, uiAuthority };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = parseArgs();
  assert.ok(args.root, "--root is required");
  const verified = verifyTransferRoot(args.root);
  let archive = null;
  if (args.archive || args.sidecar) {
    assert.ok(args.archive && args.sidecar, "archive verification requires --archive and --sidecar");
    const archivePath = path.resolve(args.archive);
    const sidecarPath = path.resolve(args.sidecar);
    assert.equal(existsSync(archivePath), true);
    assert.equal(existsSync(sidecarPath), true);
    const archiveBytes = readFileSync(archivePath);
    assert.ok(archiveBytes.length > 0);
    const archiveSha256 = sha256(archiveBytes);
    const sidecar = readFileSync(sidecarPath, "utf8").trim();
    assert.equal(sidecar, `${archiveSha256}  ${path.basename(archivePath)}`);
    const listing = spawnSync("tar.exe", ["-tf", archivePath], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    assert.equal(listing.status, 0, listing.stderr || "archive listing failed");
    const rootName = path.basename(path.resolve(args.root));
    const normalized = listing.stdout.replaceAll("\\", "/");
    for (const required of [`${rootName}/TRANSFER_MANIFEST.json`, `${rootName}/TRANSFER_README.txt`, `${rootName}/.synthetic-local/face-eval-c-w1/`, `${rootName}/.synthetic-local/face-eval-c-w1m/`]) assert.equal(normalized.includes(required), true, `archive entry missing:${required}`);
    const readback = spawnSync("tar.exe", ["-xOf", archivePath, `${rootName}/TRANSFER_MANIFEST.json`], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
    assert.equal(readback.status, 0, readback.stderr || "manifest read-back failed");
    assert.deepEqual(JSON.parse(readback.stdout), verified.manifest);
    archive = { archivePath, archiveBytes: archiveBytes.length, archiveSha256, sidecarPath, readBack: "PASS" };
  }
  console.log(JSON.stringify({ status: "PASS", schemaVersion: verified.manifest.schemaVersion, fileCount: verified.manifest.fileCount, totalBytes: verified.manifest.totalBytes, manifestDigest: verified.manifest.manifestDigest, secretScan: "PASS", d2dPPacketAuthorityDigest: verified.manifest.d2dPPacketAuthorityDigest, d2dUI1DistributionAuthorityDigest: verified.manifest.d2dUI1DistributionAuthorityDigest, archive }, null, 2));
}
