import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  renameSync,
  rmSync,
  writeFileSync
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const FACE_LAB_HOSTED_REVIEW_ENV_NAME =
  "FACE_LAB_HOSTED_REVIEW_ACCESS_TOKEN";
export const FACE_LAB_REVIEW_PRODUCTION_ORIGIN =
  "https://k-beauty-two.vercel.app";
export const FACE_LAB_REVIEW_PRODUCTION_PROJECT = "k-beauty";
export const FACE_LAB_REVIEW_PRODUCTION_SCOPE = "johnny-self";
export const FACE_LAB_REVIEW_PRODUCTION_PROJECT_ID =
  "prj_VHh3BMegmXFGwxgOJLlgFQjksmKA";
export const FACE_LAB_REVIEW_PRODUCTION_ORG_ID =
  "team_xuYA9OhCWlJETaYFOmeVodgS";
export const FACE_LAB_REVIEW_HANDOFF_DIR = ".review/local";

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const PROJECT_ID_PATTERN = /^prj_[A-Za-z0-9]+$/;
const ORG_ID_PATTERN = /^team_[A-Za-z0-9]+$/;
const DEPLOYMENT_ID_PATTERN = /^dpl_[A-Za-z0-9]+$/;
const GIT_SHA_PATTERN = /^[0-9a-f]{40}$/i;
const VERCEL_HOST_PATTERN = /^[a-z0-9.-]+\.vercel\.app$/i;

function parseArgs(argv = process.argv.slice(2)) {
  const result = { apply: false, confirmEmptyReviewCampaign: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--apply") {
      result.apply = true;
      continue;
    }
    if (value === "--confirm-empty-review-campaign") {
      result.confirmEmptyReviewCampaign = true;
      continue;
    }
    throw new Error(`unsupported_argument:${value}`);
  }
  return result;
}

function resolveVercelInvocation() {
  const npmExecPath = String(process.env.npm_execpath || "").trim();
  if (npmExecPath) {
    const npxCliPath = path.join(path.dirname(npmExecPath), "npx-cli.js");
    if (existsSync(npxCliPath)) {
      return { command: process.execPath, prefixArgs: [npxCliPath, "vercel"] };
    }
  }
  if (process.platform === "win32") {
    throw new Error("npm_runtime_required_for_windows_vercel_cli");
  }
  return { command: "npx", prefixArgs: ["vercel"] };
}

function assertProductionTarget() {
  assert.equal(FACE_LAB_REVIEW_PRODUCTION_PROJECT, "k-beauty");
  assert.equal(FACE_LAB_REVIEW_PRODUCTION_SCOPE, "johnny-self");
  assert.match(FACE_LAB_REVIEW_PRODUCTION_PROJECT_ID, PROJECT_ID_PATTERN);
  assert.match(FACE_LAB_REVIEW_PRODUCTION_ORG_ID, ORG_ID_PATTERN);
  return {
    projectId: FACE_LAB_REVIEW_PRODUCTION_PROJECT_ID,
    orgId: FACE_LAB_REVIEW_PRODUCTION_ORG_ID
  };
}

function runVercelCommand({
  args,
  step,
  input,
  env = process.env,
  spawnFn = spawnSync,
  invocation = resolveVercelInvocation()
}) {
  const { projectId, orgId } = assertProductionTarget();
  const result = spawnFn(
    invocation.command,
    [...invocation.prefixArgs, ...args],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      input,
      env: {
        ...env,
        VERCEL_PROJECT_ID: projectId,
        VERCEL_ORG_ID: orgId,
        CI: "1",
        NO_UPDATE_NOTIFIER: "1"
      },
      windowsHide: true,
      timeout: 120_000,
      maxBuffer: 1024 * 1024
    }
  );
  if (result?.error || result?.status !== 0) {
    throw new Error(`${step}_failed`);
  }
  return String(result.stdout || "");
}

export function generateFaceLabHostedReviewAccessToken(randomBytesFn = randomBytes) {
  const token = randomBytesFn(32).toString("base64url");
  assert.match(token, TOKEN_PATTERN);
  return token;
}

export function buildFaceLabNeutralReviewUrl(token) {
  assert.match(String(token || ""), TOKEN_PATTERN);
  const url = new URL("/facelab/review", FACE_LAB_REVIEW_PRODUCTION_ORIGIN);
  url.searchParams.set("t", token);
  return url.toString();
}

export function buildFaceLabReviewHandoffDocument({
  token,
  createdAt,
  sourceDeploymentId,
  sourceGitSha
}) {
  const reviewUrl = buildFaceLabNeutralReviewUrl(token);
  assert.match(sourceDeploymentId, DEPLOYMENT_ID_PATTERN);
  assert.match(sourceGitSha, GIT_SHA_PATTERN);
  return {
    schemaVersion: "face-lab-neutral-review-local-handoff-v1",
    createdAt,
    environment: "production",
    sourceDeploymentId,
    sourceGitSha,
    reviewUrl,
    handling: "LOCAL_ONLY_DO_NOT_COMMIT_OR_CHAT"
  };
}

function parseProductionDeploymentList(output) {
  let parsed;
  try {
    parsed = JSON.parse(String(output || "").trim());
  } catch {
    throw new Error("vercel_production_list_json_invalid");
  }
  if (!Array.isArray(parsed?.deployments)) {
    throw new Error("vercel_production_list_shape_invalid");
  }
  const deployment = parsed.deployments.find(
    (candidate) =>
      String(candidate?.state || "").toUpperCase() === "READY" &&
      candidate?.target === "production"
  );
  const id = String(deployment?.id || "").trim();
  const hostname = String(deployment?.url || "").trim().toLowerCase();
  const gitSha = String(deployment?.meta?.githubCommitSha || "").trim();
  if (
    !DEPLOYMENT_ID_PATTERN.test(id) ||
    !VERCEL_HOST_PATTERN.test(hostname) ||
    !GIT_SHA_PATTERN.test(gitSha)
  ) {
    throw new Error("vercel_production_deployment_attestation_invalid");
  }
  return {
    id,
    url: `https://${hostname}`,
    gitSha
  };
}

export function readCurrentFaceLabProductionDeployment({
  env = process.env,
  spawnFn = spawnSync,
  invocation = resolveVercelInvocation()
} = {}) {
  const output = runVercelCommand({
    args: [
      "list",
      FACE_LAB_REVIEW_PRODUCTION_PROJECT,
      "--scope",
      FACE_LAB_REVIEW_PRODUCTION_SCOPE,
      "--prod",
      "--status",
      "READY",
      "--yes",
      "--format",
      "json"
    ],
    step: "vercel_production_list",
    env,
    spawnFn,
    invocation
  });
  return parseProductionDeploymentList(output);
}

export function runFaceLabReviewTokenUpdate({
  token,
  env = process.env,
  spawnFn = spawnSync,
  invocation = resolveVercelInvocation()
}) {
  assert.match(String(token || ""), TOKEN_PATTERN);
  runVercelCommand({
    args: [
      "env",
      "update",
      FACE_LAB_HOSTED_REVIEW_ENV_NAME,
      "production"
    ],
    step: "vercel_env_update",
    input: `${token}\n`,
    env,
    spawnFn,
    invocation
  });
  return { status: "UPDATED", environment: "production" };
}

export function redeployFaceLabProductionFromExactSource({
  sourceDeployment,
  env = process.env,
  spawnFn = spawnSync,
  invocation = resolveVercelInvocation()
}) {
  assert.match(sourceDeployment?.id || "", DEPLOYMENT_ID_PATTERN);
  assert.match(sourceDeployment?.gitSha || "", GIT_SHA_PATTERN);
  runVercelCommand({
    args: ["redeploy", sourceDeployment.id],
    step: "vercel_production_redeploy",
    env,
    spawnFn,
    invocation
  });
  const activated = readCurrentFaceLabProductionDeployment({
    env,
    spawnFn,
    invocation
  });
  if (
    activated.id === sourceDeployment.id ||
    activated.gitSha !== sourceDeployment.gitSha
  ) {
    throw new Error("vercel_production_redeploy_attestation_failed");
  }
  return activated;
}

function handoffFileName(createdAt, kind = "handoff") {
  const normalized = createdAt.replace(/[^0-9]/g, "").slice(0, 14);
  assert.match(normalized, /^\d{14}$/);
  assert.ok(["handoff", "recovery"].includes(kind));
  return `facelab-neutral-review-${kind}-${normalized}.local.json`;
}

function preserveRecoveryHandoff({ tempPath, outputDir, createdAt, cwd }) {
  const recoveryPath = path.join(
    outputDir,
    handoffFileName(createdAt, "recovery")
  );
  renameSync(tempPath, recoveryPath);
  chmodSync(recoveryPath, 0o600);
  return path.relative(cwd, recoveryPath).replaceAll("\\", "/");
}

export function rotateFaceLabNeutralReviewAccess({
  apply = false,
  confirmEmptyReviewCampaign = false,
  cwd = process.cwd(),
  env = process.env,
  now = () => new Date(),
  randomBytesFn = randomBytes,
  spawnFn = spawnSync,
  invocation
} = {}) {
  assertProductionTarget();
  if (!apply) {
    return {
      status: "READY",
      applied: false,
      environment: "production",
      envName: FACE_LAB_HOSTED_REVIEW_ENV_NAME,
      projectId: FACE_LAB_REVIEW_PRODUCTION_PROJECT_ID,
      orgId: FACE_LAB_REVIEW_PRODUCTION_ORG_ID
    };
  }

  assert.equal(
    confirmEmptyReviewCampaign,
    true,
    "empty_review_campaign_confirmation_required"
  );
  assert.equal(
    env.FACE_LAB_OPERATOR_ALLOW_PRODUCTION_ROTATION,
    "1",
    "production_rotation_opt_in_required"
  );

  const sourceDeployment = readCurrentFaceLabProductionDeployment({
    env,
    spawnFn,
    invocation
  });
  const createdAt = now().toISOString();
  const token = generateFaceLabHostedReviewAccessToken(randomBytesFn);
  const document = buildFaceLabReviewHandoffDocument({
    token,
    createdAt,
    sourceDeploymentId: sourceDeployment.id,
    sourceGitSha: sourceDeployment.gitSha
  });
  const outputDir = path.resolve(cwd, FACE_LAB_REVIEW_HANDOFF_DIR);
  const finalPath = path.join(outputDir, handoffFileName(createdAt));
  const tempPath = path.join(
    outputDir,
    `.${handoffFileName(createdAt)}.tmp-${process.pid}`
  );
  mkdirSync(outputDir, { recursive: true, mode: 0o700 });
  chmodSync(outputDir, 0o700);
  writeFileSync(tempPath, `${JSON.stringify(document, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
    flag: "wx"
  });
  chmodSync(tempPath, 0o600);

  try {
    runFaceLabReviewTokenUpdate({ token, env, spawnFn, invocation });
  } catch {
    rmSync(tempPath, { force: true });
    throw new Error("vercel_env_update_failed");
  }

  let activatedDeployment;
  try {
    activatedDeployment = redeployFaceLabProductionFromExactSource({
      sourceDeployment,
      env,
      spawnFn,
      invocation
    });
  } catch {
    let recoveryHandoffPath;
    try {
      recoveryHandoffPath = preserveRecoveryHandoff({
        tempPath,
        outputDir,
        createdAt,
        cwd
      });
    } catch {
      throw new Error("post_update_recovery_handoff_persist_failed");
    }
    throw new Error(
      `production_redeploy_failed_recovery_preserved:${recoveryHandoffPath}`
    );
  }

  renameSync(tempPath, finalPath);
  chmodSync(finalPath, 0o600);
  return {
    status: "ROTATED",
    applied: true,
    environment: "production",
    envName: FACE_LAB_HOSTED_REVIEW_ENV_NAME,
    handoffPath: path.relative(cwd, finalPath).replaceAll("\\", "/"),
    sourceDeploymentId: sourceDeployment.id,
    activatedDeploymentId: activatedDeployment.id,
    productionSourceGitSha: activatedDeployment.gitSha,
    productionRedeployed: true,
    neutralReceiptSigningKeyRotated: true
  };
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const args = parseArgs();
  const result = rotateFaceLabNeutralReviewAccess({
    apply: args.apply,
    confirmEmptyReviewCampaign: args.confirmEmptyReviewCampaign
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
