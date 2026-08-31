import assert from "node:assert/strict";
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  FACE_LAB_HOSTED_REVIEW_ENV_NAME,
  FACE_LAB_REVIEW_PRODUCTION_ORG_ID,
  FACE_LAB_REVIEW_PRODUCTION_PROJECT,
  FACE_LAB_REVIEW_PRODUCTION_PROJECT_ID,
  FACE_LAB_REVIEW_PRODUCTION_SCOPE,
  generateFaceLabHostedReviewAccessToken,
  rotateFaceLabNeutralReviewAccess,
  runFaceLabReviewTokenUpdate
} from "./face-lab-neutral-review-operator.mjs";

const env = { FACE_LAB_OPERATOR_ALLOW_PRODUCTION_ROTATION: "1" };
const deterministicBytes = () => Buffer.alloc(32, 7);
const token = generateFaceLabHostedReviewAccessToken(deterministicBytes);
assert.equal(token.length, 43);

const sourceGitSha = "9f1cbdbff51e97ecdef815ba5fb51afc14b19ac2";
const baselineDeployment = {
  id: "dpl_Baseline123",
  state: "READY",
  target: "production",
  url: "k-beauty-baseline-johnny-self.vercel.app",
  meta: { githubCommitSha: sourceGitSha }
};
const activatedDeployment = {
  id: "dpl_Activated456",
  state: "READY",
  target: "production",
  url: "k-beauty-activated-johnny-self.vercel.app",
  meta: { githubCommitSha: sourceGitSha }
};
const listOutput = (deployment) => JSON.stringify({ deployments: [deployment] });
const invocation = { command: "vercel-test", prefixArgs: ["vercel"] };

function createSpawnSequence(steps) {
  const calls = [];
  const spawnFn = (command, args, options) => {
    const index = calls.length;
    const step = steps[index];
    assert.ok(step, `unexpected spawn call:${index}`);
    calls.push({ command, args, options });
    return {
      status: step.status ?? 0,
      stdout: step.stdout ?? "",
      stderr: step.stderr ?? "",
      error: step.error
    };
  };
  return { spawnFn, calls };
}

let captured = null;
const tokenUpdateSpawn = (command, args, options) => {
  captured = { command, args, options };
  return { status: 0, stdout: "Updated", stderr: "" };
};
runFaceLabReviewTokenUpdate({
  token,
  env,
  spawnFn: tokenUpdateSpawn,
  invocation
});
assert.equal(captured.command, "vercel-test");
assert.deepEqual(captured.args, [
  "vercel",
  "env",
  "update",
  FACE_LAB_HOSTED_REVIEW_ENV_NAME,
  "production"
]);
assert.equal(captured.args.includes(token), false);
assert.equal(captured.options.input, `${token}\n`);
assert.equal(
  captured.options.env.VERCEL_PROJECT_ID,
  FACE_LAB_REVIEW_PRODUCTION_PROJECT_ID
);
assert.equal(
  captured.options.env.VERCEL_ORG_ID,
  FACE_LAB_REVIEW_PRODUCTION_ORG_ID
);

const dryRun = rotateFaceLabNeutralReviewAccess({ apply: false, env });
assert.deepEqual(dryRun, {
  status: "READY",
  applied: false,
  environment: "production",
  envName: FACE_LAB_HOSTED_REVIEW_ENV_NAME,
  projectId: FACE_LAB_REVIEW_PRODUCTION_PROJECT_ID,
  orgId: FACE_LAB_REVIEW_PRODUCTION_ORG_ID
});
assert.equal(JSON.stringify(dryRun).includes(token), false);

const root = mkdtempSync(path.join(tmpdir(), "facelab-neutral-operator-"));
try {
  const success = createSpawnSequence([
    { stdout: listOutput(baselineDeployment) },
    { stdout: "Updated" },
    { stdout: "https://k-beauty-activated-johnny-self.vercel.app" },
    { stdout: listOutput(activatedDeployment) }
  ]);
  const rotated = rotateFaceLabNeutralReviewAccess({
    apply: true,
    confirmEmptyReviewCampaign: true,
    cwd: root,
    env,
    now: () => new Date("2026-09-01T09:30:45.000Z"),
    randomBytesFn: deterministicBytes,
    spawnFn: success.spawnFn,
    invocation
  });
  assert.equal(success.calls.length, 4);
  assert.deepEqual(success.calls[0].args, [
    "vercel",
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
  ]);
  assert.deepEqual(success.calls[1].args, [
    "vercel",
    "env",
    "update",
    FACE_LAB_HOSTED_REVIEW_ENV_NAME,
    "production"
  ]);
  assert.equal(success.calls[1].args.includes(token), false);
  assert.equal(success.calls[1].options.input, `${token}\n`);
  assert.deepEqual(success.calls[2].args, [
    "vercel",
    "redeploy",
    baselineDeployment.id
  ]);
  assert.equal(success.calls[2].args.includes(token), false);
  assert.deepEqual(success.calls[3].args, success.calls[0].args);
  assert.equal(rotated.status, "ROTATED");
  assert.equal(rotated.applied, true);
  assert.equal(rotated.sourceDeploymentId, baselineDeployment.id);
  assert.equal(rotated.activatedDeploymentId, activatedDeployment.id);
  assert.equal(rotated.productionSourceGitSha, sourceGitSha);
  assert.equal(rotated.productionRedeployed, true);
  assert.equal(rotated.neutralReceiptSigningKeyRotated, true);
  assert.equal(JSON.stringify(rotated).includes(token), false);
  assert.equal(JSON.stringify(rotated).includes("?t="), false);
  const filePath = path.join(root, rotated.handoffPath);
  const handoff = JSON.parse(readFileSync(filePath, "utf8"));
  assert.equal(handoff.environment, "production");
  assert.equal(handoff.sourceDeploymentId, baselineDeployment.id);
  assert.equal(handoff.sourceGitSha, sourceGitSha);
  assert.equal(new URL(handoff.reviewUrl).pathname, "/facelab/review");
  assert.equal(new URL(handoff.reviewUrl).searchParams.get("t"), token);
  if (process.platform !== "win32") {
    assert.equal(statSync(filePath).mode & 0o777, 0o600);
    assert.equal(statSync(path.dirname(filePath)).mode & 0o777, 0o700);
  }
  assert.deepEqual(
    readdirSync(path.dirname(filePath)).filter((name) => name.includes(".tmp-")),
    []
  );
} finally {
  rmSync(root, { recursive: true, force: true });
}

const envFailRoot = mkdtempSync(
  path.join(tmpdir(), "facelab-neutral-operator-env-fail-")
);
try {
  const envFail = createSpawnSequence([
    { stdout: listOutput(baselineDeployment) },
    { status: 1, stdout: token, stderr: token }
  ]);
  assert.throws(
    () =>
      rotateFaceLabNeutralReviewAccess({
        apply: true,
        confirmEmptyReviewCampaign: true,
        cwd: envFailRoot,
        env,
        now: () => new Date("2026-09-01T09:31:45.000Z"),
        randomBytesFn: deterministicBytes,
        spawnFn: envFail.spawnFn,
        invocation
      }),
    /vercel_env_update_failed/
  );
  assert.equal(envFail.calls[1].args.includes(token), false);
  assert.deepEqual(
    readdirSync(path.join(envFailRoot, ".review", "local")),
    []
  );
} finally {
  rmSync(envFailRoot, { recursive: true, force: true });
}

const redeployFailRoot = mkdtempSync(
  path.join(tmpdir(), "facelab-neutral-operator-redeploy-fail-")
);
try {
  const redeployFail = createSpawnSequence([
    { stdout: listOutput(baselineDeployment) },
    { stdout: "Updated" },
    { status: 1, stdout: token, stderr: token }
  ]);
  let caught = null;
  try {
    rotateFaceLabNeutralReviewAccess({
      apply: true,
      confirmEmptyReviewCampaign: true,
      cwd: redeployFailRoot,
      env,
      now: () => new Date("2026-09-01T09:32:45.000Z"),
      randomBytesFn: deterministicBytes,
      spawnFn: redeployFail.spawnFn,
      invocation
    });
  } catch (error) {
    caught = error;
  }
  assert.ok(caught instanceof Error);
  assert.match(
    caught.message,
    /^production_redeploy_failed_recovery_preserved:\.review\/local\/facelab-neutral-review-recovery-/
  );
  assert.equal(caught.message.includes(token), false);
  const recoveryName = readdirSync(
    path.join(redeployFailRoot, ".review", "local")
  ).find((name) => name.includes("-recovery-"));
  assert.ok(recoveryName);
  const recoveryPath = path.join(
    redeployFailRoot,
    ".review",
    "local",
    recoveryName
  );
  const recovery = JSON.parse(readFileSync(recoveryPath, "utf8"));
  assert.equal(new URL(recovery.reviewUrl).searchParams.get("t"), token);
  if (process.platform !== "win32") {
    assert.equal(statSync(recoveryPath).mode & 0o777, 0o600);
  }
} finally {
  rmSync(redeployFailRoot, { recursive: true, force: true });
}

const attestationFailRoot = mkdtempSync(
  path.join(tmpdir(), "facelab-neutral-operator-attestation-fail-")
);
try {
  const mismatched = {
    ...activatedDeployment,
    meta: { githubCommitSha: "d639f15a59f29036dff17f44677cfe72cbea8cc2" }
  };
  const attestationFail = createSpawnSequence([
    { stdout: listOutput(baselineDeployment) },
    { stdout: "Updated" },
    { stdout: "https://k-beauty-activated-johnny-self.vercel.app" },
    { stdout: listOutput(mismatched) }
  ]);
  assert.throws(
    () =>
      rotateFaceLabNeutralReviewAccess({
        apply: true,
        confirmEmptyReviewCampaign: true,
        cwd: attestationFailRoot,
        env,
        now: () => new Date("2026-09-01T09:33:45.000Z"),
        randomBytesFn: deterministicBytes,
        spawnFn: attestationFail.spawnFn,
        invocation
      }),
    /production_redeploy_failed_recovery_preserved/
  );
  assert.equal(
    readdirSync(path.join(attestationFailRoot, ".review", "local")).filter(
      (name) => name.includes("-recovery-")
    ).length,
    1
  );
} finally {
  rmSync(attestationFailRoot, { recursive: true, force: true });
}

assert.throws(
  () =>
    rotateFaceLabNeutralReviewAccess({
      apply: true,
      confirmEmptyReviewCampaign: false,
      env
    }),
  /empty_review_campaign_confirmation_required/
);
assert.throws(
  () =>
    rotateFaceLabNeutralReviewAccess({
      apply: true,
      confirmEmptyReviewCampaign: true,
      env: {}
    }),
  /production_rotation_opt_in_required/
);

console.log(
  JSON.stringify(
    {
      status: "PASS",
      dryRunNoSecret: "PASS",
      tokenNotInArgv: "PASS",
      stdinSecretTransport: "PASS",
      exactProductionTargetGuard: "PASS",
      exactSourceRedeploy: "PASS",
      postRedeployGitShaAttestation: "PASS",
      localHandoffMode0600: "PASS",
      envUpdateFailureCleansHandoff: "PASS",
      postUpdateFailurePreservesRecoveryHandoff: "PASS",
      emptyCampaignConfirmationGuard: "PASS",
      explicitProductionOptInGuard: "PASS",
      receiptKeyRotationReported: "PASS",
      realProductionMutation: 0
    },
    null,
    2
  )
);
