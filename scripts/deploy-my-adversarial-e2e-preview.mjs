import { execFileSync } from "node:child_process";
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
  MY_E2E_VERCEL_PROJECT,
  MY_E2E_VERCEL_SCOPE,
  resolveMyE2EPreviewDeployment,
  runMyE2EVercelCommand,
  runMyE2EVercelJsonCommand
} from "./my-e2e-vercel-preview.mjs";

const DEPLOYMENT_POLL_ATTEMPTS = 60;
const DEPLOYMENT_POLL_MS = 2000;

await ensureLocalRuntime();
assertGitWorktreeClean();

const branch = getGitBranch();
const gitHead = getGitHead();
requireCondition(branch && !["main", "master"].includes(branch), FAILURE_CATEGORIES.PRECONDITION, "preview-deploy", "preview_branch_invalid");

function readRemoteBranchHead() {
  let output;
  try {
    output = execFileSync(
      "git",
      ["ls-remote", "--heads", "origin", `refs/heads/${branch}`],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"]
      }
    ).trim();
  } catch (error) {
    throw new JourneyFailure(
      FAILURE_CATEGORIES.PRECONDITION,
      "preview-remote-head",
      "remote_branch_lookup_failed",
      error?.stderr || error?.message || "remote_branch_lookup_failed"
    );
  }

  const remoteSha = output.split(/\s+/)[0] || "";
  requireCondition(
    /^[0-9a-f]{40}$/i.test(remoteSha),
    FAILURE_CATEGORIES.PRECONDITION,
    "preview-remote-head",
    "remote_branch_head_missing"
  );
  return remoteSha;
}

function delay(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

function removeDeployHook(hookId, step) {
  runMyE2EVercelCommand([
    "deploy-hooks",
    "rm",
    hookId,
    "--project",
    MY_E2E_VERCEL_PROJECT,
    "--scope",
    MY_E2E_VERCEL_SCOPE,
    "--yes"
  ], step);
}

function listDeployHooks(step) {
  const listed = runMyE2EVercelJsonCommand([
    "deploy-hooks",
    "ls",
    "--format",
    "json",
    "--project",
    MY_E2E_VERCEL_PROJECT,
    "--scope",
    MY_E2E_VERCEL_SCOPE
  ], step);

  if (Array.isArray(listed)) return listed;
  if (Array.isArray(listed?.hooks)) return listed.hooks;

  throw new JourneyFailure(
    FAILURE_CATEGORIES.PRECONDITION,
    step,
    "vercel_deploy_hook_list_shape_invalid"
  );
}

function cleanupOrphanedHook(hookName) {
  const hooks = listDeployHooks("vercel-deploy-hook-preflight-list");
  for (const hook of hooks) {
    const candidateName = String(hook?.name || "").trim();
    const candidateRef = String(hook?.ref || "").trim();
    if (candidateName !== hookName || candidateRef !== branch) continue;

    const candidateId = String(hook?.id || "").trim();
    requireCondition(
      candidateId,
      FAILURE_CATEGORIES.PRECONDITION,
      "vercel-deploy-hook-preflight-list",
      "orphaned_deploy_hook_id_missing"
    );
    removeDeployHook(candidateId, "vercel-deploy-hook-preflight-remove");
  }
}

function resolveCreatedHook(hookName) {
  const hooks = listDeployHooks("vercel-deploy-hook-postcreate-list");
  const matches = hooks.filter((hook) =>
    String(hook?.name || "").trim() === hookName &&
    String(hook?.ref || "").trim() === branch
  );

  requireCondition(
    matches.length === 1,
    FAILURE_CATEGORIES.PRECONDITION,
    "vercel-deploy-hook-postcreate-list",
    "deploy_hook_creation_not_attested"
  );

  return matches[0];
}

async function waitForGitAttestedPreview() {
  for (let attempt = 0; attempt < DEPLOYMENT_POLL_ATTEMPTS; attempt += 1) {
    try {
      return resolveMyE2EPreviewDeployment({ branch, gitHead });
    } catch (error) {
      if (!(error instanceof JourneyFailure) || error.code !== "vercel_git_preview_for_head_not_found") {
        throw error;
      }
    }
    await delay(DEPLOYMENT_POLL_MS);
  }

  throw new JourneyFailure(
    FAILURE_CATEGORIES.PRECONDITION,
    "preview-deploy",
    "vercel_git_preview_ready_timeout"
  );
}

const remoteHead = readRemoteBranchHead();
requireCondition(
  remoteHead === gitHead,
  FAILURE_CATEGORIES.PRECONDITION,
  "preview-remote-head",
  "remote_branch_not_exact_head"
);

const hookName = `my-e2e-native-${gitHead.slice(0, 12)}`;
let hookId = "";
let deployed = null;
let primaryError = null;
let cleanupError = null;

try {
  cleanupOrphanedHook(hookName);

  runMyE2EVercelCommand([
    "deploy-hooks",
    "create",
    hookName,
    "--ref",
    branch,
    "--project",
    MY_E2E_VERCEL_PROJECT,
    "--scope",
    MY_E2E_VERCEL_SCOPE,
    "--yes"
  ], "vercel-deploy-hook-create");

  const hook = resolveCreatedHook(hookName);
  hookId = String(hook?.id || "").trim();
  const hookRef = String(hook?.ref || "").trim();
  const hookUrlValue = String(hook?.url || "").trim();

  requireCondition(
    hookId && hookRef === branch && hookUrlValue,
    FAILURE_CATEGORIES.PRECONDITION,
    "vercel-deploy-hook-postcreate-list",
    "deploy_hook_creation_not_attested"
  );

  let hookUrl;
  try {
    hookUrl = new URL(hookUrlValue);
  } catch {
    throw new JourneyFailure(
      FAILURE_CATEGORIES.PRECONDITION,
      "vercel-deploy-hook-create",
      "deploy_hook_url_invalid"
    );
  }
  requireCondition(
    hookUrl.protocol === "https:" &&
      hookUrl.hostname === "api.vercel.com" &&
      hookUrl.pathname.startsWith("/v1/integrations/deploy/"),
    FAILURE_CATEGORIES.PRECONDITION,
    "vercel-deploy-hook-create",
    "deploy_hook_url_untrusted"
  );
  hookUrl.searchParams.set("buildCache", "false");

  let triggerResponse;
  try {
    triggerResponse = await fetch(hookUrl, { method: "POST" });
  } catch (error) {
    throw new JourneyFailure(
      FAILURE_CATEGORIES.PRECONDITION,
      "vercel-deploy-hook-trigger",
      "deploy_hook_trigger_unreachable",
      error?.message || "deploy_hook_trigger_unreachable"
    );
  }
  const triggerBody = await triggerResponse.json().catch(() => null);
  requireCondition(
    triggerResponse.ok && triggerBody?.job?.id,
    FAILURE_CATEGORIES.PRECONDITION,
    "vercel-deploy-hook-trigger",
    "deploy_hook_trigger_failed"
  );

  deployed = await waitForGitAttestedPreview();
  requireCondition(
    deployed.gitSha === gitHead &&
      deployed.branch === branch &&
      deployed.attestationSource === "github-metadata",
    FAILURE_CATEGORIES.PRECONDITION,
    "preview-deploy",
    "vercel_native_git_attestation_mismatch"
  );
} catch (error) {
  primaryError = error;
} finally {
  if (hookId) {
    try {
      removeDeployHook(hookId, "vercel-deploy-hook-remove");
    } catch (error) {
      cleanupError = error instanceof JourneyFailure
        ? error
        : new JourneyFailure(
            FAILURE_CATEGORIES.PRECONDITION,
            "vercel-deploy-hook-remove",
            "deploy_hook_cleanup_failed",
            error?.message || "deploy_hook_cleanup_failed"
          );
    }
  }
}

if (primaryError) throw primaryError;
if (cleanupError) throw cleanupError;
requireCondition(Boolean(deployed), FAILURE_CATEGORIES.PRECONDITION, "preview-deploy", "vercel_git_preview_missing_after_trigger");

assertGitWorktreeClean();

console.log(JSON.stringify({
  ok: true,
  verdict: "MY_E2E_PREVIEW_READY",
  url: deployed.url,
  branch,
  gitHead,
  attestationSource: deployed.attestationSource,
  project: deployed.project,
  scope: MY_E2E_VERCEL_SCOPE,
  deploymentSource: "vercel-git-deploy-hook",
  remoteHeadAuthority: "origin-branch-sha",
  artifactGitAuthority: "vercel-git-source",
  deployHookRemoved: true,
  orphanedHookRecovery: true,
  localVercelLinkCreated: false,
  nextCommand: "npm run e2e:my:login"
}, null, 2));
