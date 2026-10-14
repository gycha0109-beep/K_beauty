import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFile, readdir, lstat, writeFile, rm, symlink, rename } from "node:fs/promises";
import { join } from "node:path";
import {
  validateFaceLabV2HumanPairwiseBindings
} from "../lib/face-lab-v2/evaluation/human-pairwise-contract.js";

const cli = "scripts/run-face-lab-v2-human-pairwise-local-pilot.mjs";
const campaign = "test_" + randomBytes(8).toString("hex");
const root = join(process.cwd(), "private", "face-lab-human-pairwise-pilot", campaign);
const sha256Hex = (value) => createHash("sha256").update(value).digest("hex");

function command(kind, options = [], expectedSuccess = true) {
  const p = spawnSync(process.execPath, [cli, kind, "--campaign", campaign, ...options], {
    encoding: "utf8", timeout: 25000, maxBuffer: 2 * 1024 * 1024
  });
  assert.equal(p.error, undefined, p.error?.message);
  assert.equal(p.status === 0, expectedSuccess, JSON.stringify({
    kind, status: p.status, stdout: p.stdout, stderr: p.stderr
  }));
  return expectedSuccess
    ? JSON.parse(p.stdout.trim())
    : p.stderr.trim();
}

const itemPath = (kind, name) => join(root, kind, name);
const readJson = async (file) => JSON.parse(await readFile(file, "utf8"));
const writeJson = async (file, data) =>
  writeFile(file, JSON.stringify(data, null, 2) + "\n", { flag: "wx", mode: 0o600 });

try {
  assert.match(command("status", [], false), /ENOENT/);
  assert.match(command("prepare", ["--pair", "bad"], false), /unexpected_command_options/);
  assert.match(
    command("prepare", ["--campaign", "bad"], false),
    /option_invalid_or_duplicate/
  );
  const prepared = command("prepare");
  assert.equal(prepared.status, "prepared");
  assert.equal(prepared.operatorFile, "PRIVATE_DO_NOT_DISTRIBUTE");
  assert.equal(prepared.realHumanJudgments, 0);
  assert.ok(prepared.pairCount > 0);
  assert.match(command("prepare", [], false), /EEXIST/);

  const packet = await readJson(itemPath("reviewer", "packet.json"));
  const manifest = await readJson(itemPath("operator", "manifest.json"));
  assert.equal(manifest.reviewPacketDigest, packet.packetDigest);
  assert.equal(packet.reviewItems.length, prepared.pairCount);
  assert.equal(Object.hasOwn(packet, "mappings"), false);
  assert.equal(Object.hasOwn(packet.reviewItems[0], "engineVersion"), false);

  const item = packet.reviewItems[0];
  const pairId = item.pairId;
  const options = ["--pair", pairId];
  assert.match(
    command("reveal", options, false),
    /human_pairwise_reveal_blocked:sealed_human_judgment_required/
  );
  const payload = (extra = {}) => ({
    packetId: packet.packetId,
    pairId,
    reviewItemDigest: item.itemDigest,
    reviewerId: "reviewer_synthetic_cli_fixture_001",
    assessability: "assessable",
    assessabilityReasonCodes: [],
    dimensions: {
      target_fit: "A",
      specificity: "tie",
      evidence_action_linkage: "uncertain"
    },
    rationale: "SYNTHETIC CLI CONTRACT FIXTURE — never treat as Human evidence.",
    ...extra
  });
  await writeJson(itemPath("inbox", "bad-timestamp.json"), payload({
    submittedAt: "2026-11-01T00:00:00.000Z"
  }));
  assert.match(
    command("seal", ["--input", "bad-timestamp.json"], false),
    /reviewer_payload_invalid_or_forged_timestamp/
  );
  await writeJson(itemPath("inbox", "bad-reviewer.json"), payload({
    reviewerId: "anonymous"
  }));
  assert.match(
    command("seal", ["--input", "bad-reviewer.json"], false),
    /human_pairwise_submission_rejected/
  );
  await writeJson(itemPath("inbox", "valid-01.json"), payload());
  const sealed = command("seal", ["--input", "valid-01.json"]);
  assert.equal(sealed.status, "sealed");
  assert.equal(sealed.reviewerIdentityVerified, false);
  assert.equal(sealed.pairId, pairId);
  assert.equal(typeof sealed.judgmentDigest, "string");
  assert.equal(Object.hasOwn(sealed, "mapping"), false);
  assert.ok(!JSON.stringify(sealed).includes("engineVersion"));
  assert.ok(!JSON.stringify(sealed).includes("candidate"));

  const names = await readdir(join(root, "sealed"));
  assert.equal(names.length, 1);
  const sealPath = itemPath("sealed", names[0]);
  const judgment = await readJson(sealPath);
  assert.equal(judgment.sealState, "sealed");
  assert.equal(judgment.reviewItemDigest, item.itemDigest);
  assert.equal(judgment.judgmentDigest, sealed.judgmentDigest);
  assert.equal(
    Number.isFinite(Date.parse(judgment.submittedAt)), true
  );
  if (process.platform !== "win32") {
    assert.equal((await lstat(sealPath)).mode & 0o777, 0o600);
  }
  assert.match(
    command("seal", ["--input", "valid-01.json"], false),
    /EEXIST/
  );

  const status = command("status");
  assert.equal(status.submittedArtifacts, 1);
  assert.equal(status.privatelyRevealedPairs, 0);
  assert.equal(status.actualHumanAttribution, "operator_verification_required");
  assert.equal(Object.hasOwn(status, "mapping"), false);

  const corrupt = { ...judgment, dimensions: {
    ...judgment.dimensions, specificity: "B"
  } };
  await rm(sealPath);
  await writeJson(sealPath, corrupt);
  assert.match(
    command("reveal", options, false),
    /human_pairwise_reveal_blocked:human_seal_binding_invalid/
  );
  await rm(sealPath);
  await writeJson(sealPath, judgment);

  const unlinked = { ...manifest, reviewPacketDigest: "0".repeat(64) };
  await rm(itemPath("operator", "manifest.json"));
  await writeJson(itemPath("operator", "manifest.json"), unlinked);
  assert.match(
    command("reveal", options, false),
    /human_pairwise_reveal_blocked:operator_manifest_untrusted/
  );
  await rm(itemPath("operator", "manifest.json"));
  await writeJson(itemPath("operator", "manifest.json"), manifest);

  const opened = command("reveal", options);
  assert.equal(opened.status, "revealed_private");
  assert.equal(opened.pairId, pairId);
  assert.equal(opened.judgments, 1);
  assert.equal(opened.reviewerIdentityVerified, false);
  assert.equal(Object.hasOwn(opened, "mapping"), false);
  const revealDoc = await readJson(
    itemPath("operator/reveals", pairId + ".json")
  );
  assert.equal(revealDoc.revealDigest, opened.revealDigest);
  assert.equal(
    validateFaceLabV2HumanPairwiseBindings({
      reviewItem: item, judgments: [judgment],
      reveal: revealDoc, sha256Hex
    }).ok,
    true
  );
  assert.match(command("reveal", options, false), /EEXIST/);

  const after = command("status");
  assert.equal(after.submittedArtifacts, 1);
  assert.equal(after.privatelyRevealedPairs, 1);
  assert.equal(Object.hasOwn(after, "mapping"), false);

  await writeJson(itemPath("inbox", "plain.json"), payload({
    reviewerId: "reviewer_synthetic_cli_fixture_002"
  }));
  const linked = itemPath("inbox", "symlink.json");
  try {
    await symlink(itemPath("inbox", "plain.json"), linked, "file");
    assert.match(
      command("seal", ["--input", "symlink.json"], false),
      /private_input_not_a_bounded_regular_file/
    );
  } catch (error) {
    if (!["EPERM", "EACCES", "ENOTSUP"].includes(error.code)) throw error;
  }

  // Parent-directory symlinks must not redirect artifact reads elsewhere.
  const inboxDir = join(root, "inbox");
  const backupDir = join(root, "inbox-backup");
  await rename(inboxDir, backupDir);
  let linkedParent = false;
  try {
    try {
      await symlink(backupDir, inboxDir, "dir");
      linkedParent = true;
      assert.match(
        command("seal", ["--input", "plain.json"], false),
        /private_parent_not_a_real_directory/
      );
    } catch (error) {
      if (!["EPERM", "EACCES", "ENOTSUP"].includes(error.code)) throw error;
    }
  } finally {
    if (linkedParent) await rm(inboxDir);
    await rename(backupDir, inboxDir);
  }

  console.log(JSON.stringify({
    status: "PASS",
    stage: "FACE_LAB_HUMAN_PAIRWISE_LOCAL_PILOT_E2",
    syntheticOnly: true,
    realHumanJudgments: 0,
    privateOnly: true,
    noProviderCalls: true,
    noProductionWrite: true
  }));
} finally {
  await rm(root, { recursive: true, force: true });
}
