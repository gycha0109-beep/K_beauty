import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  FACE_LAB_HOSTED_REVIEW_ENV_NAME,
  FACE_LAB_REVIEW_PRODUCTION_ORG_ID,
  FACE_LAB_REVIEW_PRODUCTION_PROJECT_ID,
  generateFaceLabHostedReviewAccessToken,
  rotateFaceLabNeutralReviewAccess,
  runFaceLabReviewTokenUpdate
} from "./face-lab-neutral-review-operator.mjs";

const env = { FACE_LAB_OPERATOR_ALLOW_PRODUCTION_ROTATION: "1" };
const deterministicBytes = () => Buffer.alloc(32, 7);
const token = generateFaceLabHostedReviewAccessToken(deterministicBytes);
assert.equal(token.length, 43);

let captured = null;
const spawnFn = (command, args, options) => {
  captured = { command, args, options };
  return { status: 0, stdout: "Updated", stderr: "" };
};
runFaceLabReviewTokenUpdate({
  token,
  env,
  spawnFn,
  invocation: { command: "vercel-test", prefixArgs: ["vercel"] }
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
assert.equal(captured.options.env.VERCEL_PROJECT_ID, FACE_LAB_REVIEW_PRODUCTION_PROJECT_ID);
assert.equal(captured.options.env.VERCEL_ORG_ID, FACE_LAB_REVIEW_PRODUCTION_ORG_ID);

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
  const rotated = rotateFaceLabNeutralReviewAccess({
    apply: true,
    confirmEmptyReviewCampaign: true,
    cwd: root,
    env,
    now: () => new Date("2026-09-01T09:30:45.000Z"),
    randomBytesFn: deterministicBytes,
    spawnFn,
    invocation: { command: "vercel-test", prefixArgs: ["vercel"] }
  });
  assert.equal(rotated.status, "ROTATED");
  assert.equal(rotated.applied, true);
  assert.equal(rotated.neutralReceiptSigningKeyRotated, true);
  assert.equal(JSON.stringify(rotated).includes(token), false);
  assert.equal(JSON.stringify(rotated).includes("?t="), false);
  const filePath = path.join(root, rotated.handoffPath);
  const handoff = JSON.parse(readFileSync(filePath, "utf8"));
  assert.equal(handoff.environment, "production");
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

const failRoot = mkdtempSync(path.join(tmpdir(), "facelab-neutral-operator-fail-"));
try {
  assert.throws(
    () =>
      rotateFaceLabNeutralReviewAccess({
        apply: true,
        confirmEmptyReviewCampaign: true,
        cwd: failRoot,
        env,
        now: () => new Date("2026-09-01T09:31:45.000Z"),
        randomBytesFn: deterministicBytes,
        spawnFn: () => ({ status: 1, stdout: token, stderr: token }),
        invocation: { command: "vercel-test", prefixArgs: ["vercel"] }
      }),
    /vercel_env_update_failed/
  );
  const handoffDir = path.join(failRoot, ".review", "local");
  assert.deepEqual(readdirSync(handoffDir), []);
} finally {
  rmSync(failRoot, { recursive: true, force: true });
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
      localHandoffMode0600: "PASS",
      failedUpdateCleansHandoff: "PASS",
      emptyCampaignConfirmationGuard: "PASS",
      explicitProductionOptInGuard: "PASS",
      receiptKeyRotationReported: "PASS",
      realProductionMutation: 0
    },
    null,
    2
  )
);
