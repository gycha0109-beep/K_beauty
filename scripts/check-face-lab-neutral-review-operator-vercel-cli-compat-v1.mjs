import assert from "node:assert/strict";
import {
  mkdtempSync,
  readFileSync,
  rmSync
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  rotateFaceLabNeutralReviewAccess
} from "./face-lab-neutral-review-operator.mjs";
import {
  createVercelDeploymentIdCompatSpawn
} from "./face-lab-neutral-review-operator-vercel-cli-compat.mjs";

const sourceGitSha = "1857dd78d50980bc4b9409befa56aadaa7bdfab9";
const baselineHostname = "k-beauty-baseline-johnny-self.vercel.app";
const activatedHostname = "k-beauty-activated-johnny-self.vercel.app";
const baselineId = "dpl_Baseline123";
const activatedId = "dpl_Activated456";
const tokenPattern = /^[A-Za-z0-9_-]{43}$/;
const env = { FACE_LAB_OPERATOR_ALLOW_PRODUCTION_ROTATION: "1" };
const deterministicBytes = () => Buffer.alloc(32, 11);
const invocation = { command: "vercel-test", prefixArgs: ["vercel"] };

function listOutput(hostname) {
  return JSON.stringify({
    contextName: "johnny-self",
    deployments: [
      {
        url: hostname,
        name: "k-beauty",
        state: "READY",
        target: "production",
        meta: { githubCommitSha: sourceGitSha }
      }
    ]
  });
}

function apiOutput(id, hostname) {
  return JSON.stringify({
    id,
    url: hostname,
    readyState: "READY",
    target: "production"
  });
}

function createBaseSpawn(steps) {
  const calls = [];
  const spawnFn = (command, args, options) => {
    const index = calls.length;
    const step = steps[index];
    assert.ok(step, `unexpected_spawn_call:${index}`);
    calls.push({ command, args, options });
    if (step.assertArgs) step.assertArgs(args);
    return {
      status: step.status ?? 0,
      stdout: step.stdout ?? "",
      stderr: step.stderr ?? "",
      error: step.error
    };
  };
  return { spawnFn, calls };
}

const root = mkdtempSync(path.join(tmpdir(), "facelab-vercel-cli-compat-"));
try {
  const base = createBaseSpawn([
    {
      stdout: listOutput(baselineHostname),
      assertArgs: (args) => assert.deepEqual(args.slice(0, 2), ["vercel", "list"])
    },
    {
      stdout: apiOutput(baselineId, baselineHostname),
      assertArgs: (args) => {
        assert.deepEqual(args.slice(0, 2), ["vercel", "api"]);
        assert.match(args[2], new RegExp(`/v13/deployments/${baselineHostname}`));
      }
    },
    {
      stdout: "Updated",
      assertArgs: (args) => assert.deepEqual(args.slice(0, 3), ["vercel", "env", "update"])
    },
    {
      stdout: `https://${activatedHostname}`,
      assertArgs: (args) => assert.deepEqual(args, ["vercel", "redeploy", baselineId])
    },
    {
      stdout: listOutput(activatedHostname),
      assertArgs: (args) => assert.deepEqual(args.slice(0, 2), ["vercel", "list"])
    },
    {
      stdout: apiOutput(activatedId, activatedHostname),
      assertArgs: (args) => {
        assert.deepEqual(args.slice(0, 2), ["vercel", "api"]);
        assert.match(args[2], new RegExp(`/v13/deployments/${activatedHostname}`));
      }
    }
  ]);

  const result = rotateFaceLabNeutralReviewAccess({
    apply: true,
    confirmEmptyReviewCampaign: true,
    cwd: root,
    env,
    now: () => new Date("2026-09-02T00:30:00.000Z"),
    randomBytesFn: deterministicBytes,
    spawnFn: createVercelDeploymentIdCompatSpawn(base.spawnFn),
    invocation
  });

  assert.equal(base.calls.length, 6);
  assert.equal(result.status, "ROTATED");
  assert.equal(result.sourceDeploymentId, baselineId);
  assert.equal(result.activatedDeploymentId, activatedId);
  assert.equal(result.productionSourceGitSha, sourceGitSha);
  assert.equal(result.productionRedeployed, true);
  assert.equal(result.neutralReceiptSigningKeyRotated, true);
  assert.equal(JSON.stringify(result).includes("?t="), false);

  const handoff = JSON.parse(readFileSync(path.join(root, result.handoffPath), "utf8"));
  assert.equal(handoff.sourceDeploymentId, baselineId);
  assert.equal(handoff.sourceGitSha, sourceGitSha);
  const reviewToken = new URL(handoff.reviewUrl).searchParams.get("t");
  assert.match(reviewToken || "", tokenPattern);
} finally {
  rmSync(root, { recursive: true, force: true });
}

const oldShapeBase = createBaseSpawn([
  {
    stdout: JSON.stringify({
      deployments: [
        {
          id: baselineId,
          url: baselineHostname,
          state: "READY",
          target: "production",
          meta: { githubCommitSha: sourceGitSha }
        }
      ]
    })
  }
]);
const oldShapeCompat = createVercelDeploymentIdCompatSpawn(oldShapeBase.spawnFn);
const oldShapeResult = oldShapeCompat(
  "vercel-test",
  ["vercel", "list", "k-beauty", "--prod", "--format", "json"],
  { encoding: "utf8" }
);
assert.equal(oldShapeBase.calls.length, 1);
assert.equal(JSON.parse(oldShapeResult.stdout).deployments[0].id, baselineId);

console.log(
  JSON.stringify(
    {
      status: "PASS",
      currentVercelListUrlOnlyShape: "PASS",
      deploymentIdApiEnrichment: "PASS",
      exactSourceRedeployPreserved: "PASS",
      postRedeployShaAttestationPreserved: "PASS",
      legacyListShapeStillAccepted: "PASS",
      secretInResult: 0,
      realProductionMutation: 0
    },
    null,
    2
  )
);
