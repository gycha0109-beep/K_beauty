import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, mkdir, open, readdir } from "node:fs/promises";
import { isAbsolute, join, relative, sep } from "node:path";
import {
  buildFaceLabV2HumanPairwiseOperatorManifest,
  buildFaceLabV2HumanPairwiseReviewPacket
} from "../lib/face-lab-v2/evaluation/human-pairwise-builder.js";
import {
  sealFaceLabV2HumanPairwisePilotJudgment
} from "../lib/face-lab-v2/evaluation/human-pairwise-pilot-intake.js";
import {
  buildFaceLabV2HumanPairwisePrivateReveal
} from "../lib/face-lab-v2/evaluation/human-pairwise-pilot-reveal.js";

const ROOT = join(process.cwd(), "private", "face-lab-human-pairwise-pilot");
const CAMPAIGN = /^[a-z0-9][a-z0-9_-]{0,47}$/;
const INBOX_FILE = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,95}\.json$/;
const PAIR_ID = /^flhp_[a-f0-9]{24}$/;
const MAX_JSON_BYTES = 2 * 1024 * 1024;
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

function parseArgs(args) {
  const [command, ...tokens] = args;
  if (!["prepare", "seal", "reveal", "status"].includes(command)) {
    throw new Error("command_must_be_prepare_seal_reveal_or_status");
  }
  if (tokens.length % 2) throw new Error("option_value_missing");
  const allowed = new Set(["--campaign", "--input", "--pair"]);
  const opts = {};
  for (let i = 0; i < tokens.length; i += 2) {
    if (!allowed.has(tokens[i]) || Object.hasOwn(opts, tokens[i]) ||
      !tokens[i + 1] || tokens[i + 1].startsWith("--")) {
      throw new Error("option_invalid_or_duplicate");
    }
    opts[tokens[i]] = tokens[i + 1];
  }
  if (!CAMPAIGN.test(opts["--campaign"] || "")) {
    throw new Error("campaign_name_invalid");
  }
  const expected = command === "seal"
    ? ["--campaign", "--input"]
    : command === "reveal"
      ? ["--campaign", "--pair"]
      : ["--campaign"];
  if (Object.keys(opts).sort().join("|") !== expected.sort().join("|")) {
    throw new Error("unexpected_command_options");
  }
  if (command === "seal" && !INBOX_FILE.test(opts["--input"])) {
    throw new Error("inbox_filename_invalid");
  }
  if (command === "reveal" && !PAIR_ID.test(opts["--pair"])) {
    throw new Error("pair_id_invalid");
  }
  return { command, campaign: opts["--campaign"],
    input: opts["--input"], pairId: opts["--pair"] };
}

async function guardedDirectory(directory) {
  const rel = relative(process.cwd(), directory);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error("private_path_outside_repository");
  }
  let current = process.cwd();
  for (const segment of rel.split(sep).filter(Boolean)) {
    current = join(current, segment);
    try {
      const st = await lstat(current);
      if (!st.isDirectory() || st.isSymbolicLink()) {
        throw new Error("private_path_not_a_real_directory");
      }
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      await mkdir(current, { mode: 0o700 });
    }
  }
}

async function assertTrustedReadParents(file) {
  const rel = relative(process.cwd(), file);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error("private_read_outside_repository");
  }
  let current = process.cwd();
  const segments = rel.split(sep).filter(Boolean);
  for (const segment of segments.slice(0, -1)) {
    current = join(current, segment);
    const st = await lstat(current);
    if (!st.isDirectory() || st.isSymbolicLink()) {
      throw new Error("private_parent_not_a_real_directory");
    }
  }
}

async function readPrivateJson(file) {
  await assertTrustedReadParents(file);
  const st = await lstat(file);
  if (!st.isFile() || st.isSymbolicLink() || st.size > MAX_JSON_BYTES) {
    throw new Error("private_input_not_a_bounded_regular_file");
  }
  const flags = constants.O_RDONLY | (constants.O_NOFOLLOW || 0);
  const handle = await open(file, flags);
  try {
    const data = await handle.readFile();
    if (data.length > MAX_JSON_BYTES) throw new Error("private_input_too_large");
    return JSON.parse(data.toString("utf8"));
  } finally {
    await handle.close();
  }
}

async function writePrivateJson(file, value) {
  await guardedDirectory(join(file, ".."));
  const handle = await open(file, "wx", 0o600);
  try {
    await handle.writeFile(JSON.stringify(value, null, 2) + "\n", "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function listedJson(directory) {
  await assertTrustedReadParents(join(directory, "child.json"));
  const st = await lstat(directory);
  if (!st.isDirectory() || st.isSymbolicLink()) {
    throw new Error("private_list_directory_invalid");
  }
  const names = await readdir(directory);
  return names.filter((name) => name.endsWith(".json")).sort();
}

async function run({ command, campaign, input, pairId }) {
  const dir = join(ROOT, campaign);
  const reviewFile = join(dir, "reviewer", "packet.json");
  const manifestFile = join(dir, "operator", "manifest.json");
  if (command === "prepare") {
    await guardedDirectory(join(dir, "inbox"));
    await guardedDirectory(join(dir, "sealed"));
    const packet = buildFaceLabV2HumanPairwiseReviewPacket();
    const manifest = buildFaceLabV2HumanPairwiseOperatorManifest();
    if (manifest.packetId !== packet.packetId ||
        manifest.reviewPacketDigest !== packet.packetDigest) {
      throw new Error("prepared_pairwise_artifacts_mismatch");
    }
    await writePrivateJson(manifestFile, manifest);
    await writePrivateJson(reviewFile, packet);
    return {
      status: "prepared", campaign,
      pairCount: packet.reviewItems.length,
      reviewerFile: relative(process.cwd(), reviewFile),
      operatorFile: "PRIVATE_DO_NOT_DISTRIBUTE",
      realHumanJudgments: 0
    };
  }

  const packet = await readPrivateJson(reviewFile);
  if (command === "seal") {
    const raw = await readPrivateJson(join(dir, "inbox", input));
    if (!raw || typeof raw !== "object" || Array.isArray(raw) ||
        Object.hasOwn(raw, "submittedAt")) {
      throw new Error("reviewer_payload_invalid_or_forged_timestamp");
    }
    // Observed locally at intake; never accept a reviewer-supplied clock value.
    const submittedAt = new Date().toISOString();
    const sealed = sealFaceLabV2HumanPairwisePilotJudgment({
      reviewPacket: packet,
      submission: { ...raw, submittedAt }
    });
    if (sealed.status !== "sealed") {
      throw new Error("human_pairwise_submission_rejected:" + sealed.reason);
    }
    const file = join(dir, "sealed",
      sealed.judgment.pairId + "." +
      sha256(sealed.judgment.reviewerId).slice(0, 16) + ".json");
    await writePrivateJson(file, sealed.judgment);
    return {
      status: "sealed", campaign,
      pairId: sealed.judgment.pairId,
      judgmentDigest: sealed.judgment.judgmentDigest,
      observedAt: submittedAt,
      reviewerIdentityVerified: false
    };
  }

  if (command === "reveal") {
    const manifest = await readPrivateJson(manifestFile);
    const names = (await listedJson(join(dir, "sealed")))
      .filter((name) => name.startsWith(pairId + "."));
    const judgments = [];
    for (const name of names) {
      if (!/^flhp_[a-f0-9]{24}\.[a-f0-9]{16}\.json$/.test(name)) {
        throw new Error("sealed_judgment_filename_invalid");
      }
      judgments.push(await readPrivateJson(join(dir, "sealed", name)));
    }
    const sealed = buildFaceLabV2HumanPairwisePrivateReveal({
      reviewPacket: packet, operatorManifest: manifest,
      pairId, judgments, revealedAt: new Date().toISOString()
    });
    if (sealed.status !== "revealed") {
      throw new Error("human_pairwise_reveal_blocked:" + sealed.reason);
    }
    const file = join(dir, "operator", "reveals", pairId + ".json");
    await writePrivateJson(file, sealed.reveal);
    return {
      status: "revealed_private", campaign, pairId,
      judgments: judgments.length, revealDigest: sealed.reveal.revealDigest,
      reviewerIdentityVerified: false,
      note: "This is an integrity gate, not proof of human authorship or quality."
    };
  }

  const sealed = await listedJson(join(dir, "sealed"));
  let reveals = [];
  try {
    reveals = await listedJson(join(dir, "operator", "reveals"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  return {
    status: "local_private_status", campaign,
    submittedArtifacts: sealed.length,
    privatelyRevealedPairs: reveals.length,
    actualHumanAttribution: "operator_verification_required"
  };
}

try {
  const options = parseArgs(process.argv.slice(2));
  const output = await run(options);
  process.stdout.write(JSON.stringify(output) + "\n");
} catch (error) {
  process.stderr.write("Face Lab pilot blocked: " +
    (error?.message || "unknown_error") + "\n");
  process.exitCode = 1;
}
