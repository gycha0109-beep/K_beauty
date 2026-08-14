import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  D2CF_DEFINITION_DIGEST,
  D2DP_PACKET_AUTHORITY_DIGEST,
  TRANSFER_SCHEMA_VERSION,
  recursiveInventory,
  scanTransferSecrets,
  stableStringify,
  verifyTransferRoot
} from "./check-face-lab-home-transfer-v1.mjs";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const parseArgs = () => {
  const values = {};
  for (let index = 2; index < process.argv.length; index += 2) {
    assert.match(process.argv[index] || "", /^--[a-z0-9-]+$/);
    assert.ok(process.argv[index + 1]);
    values[process.argv[index].slice(2)] = process.argv[index + 1];
  }
  return values;
};
const copyRequired = (source, destination) => {
  assert.equal(existsSync(source), true, `required source missing:${source}`);
  cpSync(source, destination, { recursive: true, errorOnExist: true, force: false });
};

const args = parseArgs();
for (const key of ["synthetic-local-root", "output-parent", "timestamp", "remote-main-sha", "ui-branch", "ui-head", "draft-pr-number", "ui-distribution-authority-digest"]) assert.ok(args[key], `--${key} is required`);
assert.match(args.timestamp, /^\d{8}T\d{6}Z$/);
assert.match(args["remote-main-sha"], /^[a-f0-9]{40}$/);
assert.match(args["ui-head"], /^[a-f0-9]{40}$/);
assert.match(args["draft-pr-number"], /^\d+$/);
assert.match(args["ui-distribution-authority-digest"], /^[a-f0-9]{64}$/);
const outputParent = path.resolve(args["output-parent"]);
const bundleName = `BEJEWELY_FACE_LAB_HOME_TRANSFER_${args.timestamp}`;
const stagingRoot = path.join(outputParent, bundleName);
const archivePath = path.join(outputParent, `${bundleName}.zip`);
const sidecarPath = `${archivePath}.sha256.txt`;
for (const target of [stagingRoot, archivePath, sidecarPath]) assert.equal(existsSync(target), false, `output already exists:${target}`);
mkdirSync(stagingRoot, { recursive: false });
const syntheticRoot = path.resolve(args["synthetic-local-root"]);
const includedRoots = [".synthetic-local/face-eval-c-w1", ".synthetic-local/face-eval-c-w1m"];
copyRequired(path.join(syntheticRoot, "face-eval-c-w1"), path.join(stagingRoot, ".synthetic-local", "face-eval-c-w1"));
copyRequired(path.join(syntheticRoot, "face-eval-c-w1m"), path.join(stagingRoot, ".synthetic-local", "face-eval-c-w1m"));
for (const [argName, folderName] of [["provider-w1-root", "W1 image"], ["provider-w1m-root", "W1M image"]]) {
  if (!args[argName] || !existsSync(path.resolve(args[argName]))) continue;
  const relative = `provider-outputs/${folderName}`;
  copyRequired(path.resolve(args[argName]), path.join(stagingRoot, relative));
  includedRoots.push(relative);
}
const timestampMatch = args.timestamp.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
const createdAt = `${timestampMatch[1]}-${timestampMatch[2]}-${timestampMatch[3]}T${timestampMatch[4]}:${timestampMatch[5]}:${timestampMatch[6]}.000Z`;
assert.equal(Number.isNaN(Date.parse(createdAt)), false, "invalid timestamp");
const readme = `BEJEWELY FACE LAB HOME TRANSFER\n\n1. Clone or fetch gycha0109-beep/K_beauty.\n2. Checkout ${args["ui-branch"]} at ${args["ui-head"]}, or main after the Draft PR is merged.\n3. Restore .synthetic-local beneath D:\\Ji_hwan\\K_Beauti AI\\.synthetic-local\\.\n4. If needed, restore provider-outputs/W1 image and W1M image beneath C:\\Users\\M\\Downloads\\.\n5. Run: npm run verify:face-lab-home-transfer -- --root <extracted bundle root>\n6. Do not run Human review until D2D-X is explicitly authorized.\n\nD2D-P packet authority: ${D2DP_PACKET_AUTHORITY_DIGEST}\nD2D-UI1 distribution authority: ${args["ui-distribution-authority-digest"]}\nHuman judgments: 0\nW2_REMAINS_LOCKED\n`;
writeFileSync(path.join(stagingRoot, "TRANSFER_README.txt"), readme, "utf8");
const files = recursiveInventory(stagingRoot);
const secretFindings = scanTransferSecrets(stagingRoot, files);
assert.deepEqual(secretFindings, [], `transfer secret scan failed:${secretFindings.join(",")}`);
const manifestWithoutDigest = {
  schemaVersion: TRANSFER_SCHEMA_VERSION,
  createdAt,
  sourceMachineRole: "academy",
  repository: "gycha0109-beep/K_beauty",
  remoteMainSha: args["remote-main-sha"],
  uiBranch: args["ui-branch"],
  uiBranchHead: args["ui-head"],
  draftPrNumber: Number(args["draft-pr-number"]),
  d2cFDefinitionContractDigest: D2CF_DEFINITION_DIGEST,
  d2dPPacketAuthorityDigest: D2DP_PACKET_AUTHORITY_DIGEST,
  d2dUI1DistributionAuthorityDigest: args["ui-distribution-authority-digest"],
  includedRoots,
  fileCount: files.length,
  totalBytes: files.reduce((sum, file) => sum + file.byteLength, 0),
  files,
  secretScan: "PASS",
  archiveSha256: "SEE_SIDECAR"
};
const manifest = { ...manifestWithoutDigest, manifestDigest: sha256(stableStringify(manifestWithoutDigest)) };
writeFileSync(path.join(stagingRoot, "TRANSFER_MANIFEST.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
verifyTransferRoot(stagingRoot);
const archive = spawnSync("tar.exe", ["-a", "-c", "-f", archivePath, "-C", outputParent, bundleName], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
assert.equal(archive.status, 0, archive.stderr || "archive creation failed");
const archiveBytes = readFileSync(archivePath);
assert.ok(archiveBytes.length > 0);
const archiveSha256 = sha256(archiveBytes);
writeFileSync(sidecarPath, `${archiveSha256}  ${path.basename(archivePath)}\n`, "utf8");
console.log(JSON.stringify({ status: "PASS", stagingRoot, archivePath, sidecarPath, archiveBytes: archiveBytes.length, archiveSha256, fileCount: manifest.fileCount, totalBytes: manifest.totalBytes, secretScan: "PASS", manifestDigest: manifest.manifestDigest }, null, 2));
