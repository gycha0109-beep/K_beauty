import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  FAILURE_CATEGORIES,
  JourneyFailure,
  requireCondition
} from "./premium-browser-journey-core.mjs";
import {
  assertGitWorktreeClean,
  ensureLocalRuntime,
  getGitBranch,
  getGitHead
} from "./premium-browser-journey-local-auth.mjs";
import {
  MY_E2E_META_BRANCH,
  MY_E2E_META_PURPOSE,
  MY_E2E_META_SHA,
  MY_E2E_PURPOSE,
  MY_E2E_VERCEL_SCOPE,
  resolveMyE2EPreviewDeployment,
  runMyE2EVercelCommand
} from "./my-e2e-vercel-preview.mjs";

await ensureLocalRuntime();
assertGitWorktreeClean();

const branch = getGitBranch();
const gitHead = getGitHead();
requireCondition(branch && !["main", "master"].includes(branch), FAILURE_CATEGORIES.PRECONDITION, "preview-deploy", "preview_branch_invalid");

const snapshotDir = mkdtempSync(join(tmpdir(), "bejewely-my-e2e-"));
const snapshotPrefix = `${snapshotDir.replace(/\\/g, "/")}/`;

try {
  try {
    execFileSync("git", [
      "checkout-index",
      "--all",
      "--force",
      `--prefix=${snapshotPrefix}`
    ], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
  } catch (error) {
    throw new JourneyFailure(
      FAILURE_CATEGORIES.PRECONDITION,
      "preview-snapshot",
      "git_tracked_snapshot_export_failed",
      error?.stderr || error?.message || "git_tracked_snapshot_export_failed"
    );
  }

  runMyE2EVercelCommand([
    "deploy",
    snapshotDir,
    "--yes",
    "--scope",
    MY_E2E_VERCEL_SCOPE,
    "--meta",
    `${MY_E2E_META_SHA}=${gitHead}`,
    "--meta",
    `${MY_E2E_META_BRANCH}=${branch}`,
    "--meta",
    `${MY_E2E_META_PURPOSE}=${MY_E2E_PURPOSE}`
  ], "vercel-preview-deploy");
} finally {
  rmSync(snapshotDir, { recursive: true, force: true });
}

assertGitWorktreeClean();

const deployed = resolveMyE2EPreviewDeployment({ branch, gitHead });
if (deployed.gitSha !== gitHead || deployed.branch !== branch) {
  throw new JourneyFailure(FAILURE_CATEGORIES.PRECONDITION, "preview-deploy", "vercel_preview_attestation_mismatch");
}

console.log(JSON.stringify({
  ok: true,
  verdict: "MY_E2E_PREVIEW_READY",
  url: deployed.url,
  branch,
  gitHead,
  attestationSource: deployed.attestationSource,
  project: deployed.project,
  scope: MY_E2E_VERCEL_SCOPE,
  deploymentSource: "tracked-git-snapshot",
  localVercelLinkCreated: false,
  nextCommand: "npm run e2e:my:login"
}, null, 2));
