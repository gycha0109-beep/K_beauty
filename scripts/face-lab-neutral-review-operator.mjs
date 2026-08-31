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
export const FACE_LAB_REVIEW_PRODUCTION_PROJECT_ID =
  "prj_VHh3BMegmXFGwxgOJLlgFQjksmKA";
export const FACE_LAB_REVIEW_PRODUCTION_ORG_ID =
  "team_xuYA9OhCWlJETaYFOmeVodgS";
export const FACE_LAB_REVIEW_HANDOFF_DIR = ".review/local";

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const PROJECT_ID_PATTERN = /^prj_[A-Za-z0-9]+$/;
const ORG_ID_PATTERN = /^team_[A-Za-z0-9]+$/;

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

export function buildFaceLabReviewHandoffDocument({ token, createdAt }) {
  const reviewUrl = buildFaceLabNeutralReviewUrl(token);
  return {
    schemaVersion: "face-lab-neutral-review-local-handoff-v1",
    createdAt,
    environment: "production",
    reviewUrl,
    handling: "LOCAL_ONLY_DO_NOT_COMMIT_OR_CHAT"
  };
}

function assertProductionTarget() {
  assert.match(FACE_LAB_REVIEW_PRODUCTION_PROJECT_ID, PROJECT_ID_PATTERN);
  assert.match(FACE_LAB_REVIEW_PRODUCTION_ORG_ID, ORG_ID_PATTERN);
  return {
    projectId: FACE_LAB_REVIEW_PRODUCTION_PROJECT_ID,
    orgId: FACE_LAB_REVIEW_PRODUCTION_ORG_ID
  };
}

export function runFaceLabReviewTokenUpdate({
  token,
  env = process.env,
  spawnFn = spawnSync,
  invocation = resolveVercelInvocation()
}) {
  assert.match(String(token || ""), TOKEN_PATTERN);
  const { projectId, orgId } = assertProductionTarget();
  const result = spawnFn(
    invocation.command,
    [
      ...invocation.prefixArgs,
      "env",
      "update",
      FACE_LAB_HOSTED_REVIEW_ENV_NAME,
      "production"
    ],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      input: `${token}\n`,
      env: {
        ...env,
        VERCEL_PROJECT_ID: projectId,
        VERCEL_ORG_ID: orgId,
        CI: "1",
        NO_UPDATE_NOTIFIER: "1"
      },
      windowsHide: true,
      timeout: 60_000,
      maxBuffer: 1024 * 1024
    }
  );
  if (result?.error || result?.status !== 0) {
    throw new Error(
      result?.error ? "vercel_env_update_process_error" : "vercel_env_update_failed"
    );
  }
  return { status: "UPDATED", environment: "production" };
}

function handoffFileName(createdAt) {
  const normalized = createdAt.replace(/[^0-9]/g, "").slice(0, 14);
  assert.match(normalized, /^\d{14}$/);
  return `facelab-neutral-review-handoff-${normalized}.local.json`;
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

  const createdAt = now().toISOString();
  const token = generateFaceLabHostedReviewAccessToken(randomBytesFn);
  const document = buildFaceLabReviewHandoffDocument({ token, createdAt });
  const outputDir = path.resolve(cwd, FACE_LAB_REVIEW_HANDOFF_DIR);
  const fileName = handoffFileName(createdAt);
  const finalPath = path.join(outputDir, fileName);
  const tempPath = path.join(outputDir, `.${fileName}.tmp-${process.pid}`);
  mkdirSync(outputDir, { recursive: true, mode: 0o700 });
  chmodSync(outputDir, 0o700);

  try {
    writeFileSync(tempPath, `${JSON.stringify(document, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
      flag: "wx"
    });
    chmodSync(tempPath, 0o600);
    runFaceLabReviewTokenUpdate({ token, env, spawnFn, invocation });
    renameSync(tempPath, finalPath);
    chmodSync(finalPath, 0o600);
  } catch (error) {
    rmSync(tempPath, { force: true });
    throw error;
  }

  return {
    status: "ROTATED",
    applied: true,
    environment: "production",
    envName: FACE_LAB_HOSTED_REVIEW_ENV_NAME,
    handoffPath: path.relative(cwd, finalPath).replaceAll("\\", "/"),
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
