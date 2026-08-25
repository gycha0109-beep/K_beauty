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
  MY_E2E_VERCEL_PROJECT_ID,
  runMyE2EVercelApiJsonCommand
} from "./my-e2e-vercel-preview.mjs";

const DEPLOYMENT_POLL_ATTEMPTS = 180;
const DEPLOYMENT_POLL_MS = 2000;
const TERMINAL_DEPLOYMENT_STATES = new Set(["BLOCKED", "CANCELED", "ERROR"]);

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

function readOriginGitHubRepository() {
  let output;
  try {
    output = execFileSync("git", ["config", "--get", "remote.origin.url"], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    }).trim();
  } catch (error) {
    throw new JourneyFailure(
      FAILURE_CATEGORIES.PRECONDITION,
      "preview-origin-repository",
      "origin_repository_lookup_failed",
      error?.stderr || error?.message || "origin_repository_lookup_failed"
    );
  }

  const normalized = output.replace(/\.git$/i, "");
  const match = normalized.match(/^(?:https:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)([^/]+)\/(.+)$/i);
  requireCondition(
    Boolean(match?.[1] && match?.[2]),
    FAILURE_CATEGORIES.PRECONDITION,
    "preview-origin-repository",
    "origin_github_repository_invalid"
  );
  return { org: match[1], repo: match[2] };
}

function readVercelProjectGitSource() {
  const project = runMyE2EVercelApiJsonCommand(
    `/v9/projects/${encodeURIComponent(MY_E2E_VERCEL_PROJECT_ID)}`,
    { method: "GET" },
    "vercel-project-git-source"
  );
  const originRepository = readOriginGitHubRepository();
  const linkType = String(project?.link?.type || "").trim();
  const repoId = project?.link?.repoId;
  const linkedOrg = String(project?.link?.org || "").trim();
  const linkedRepo = String(project?.link?.repo || "").trim();

  requireCondition(
    project?.id === MY_E2E_VERCEL_PROJECT_ID &&
      project?.name === MY_E2E_VERCEL_PROJECT &&
      linkType === "github" &&
      ["number", "string"].includes(typeof repoId) &&
      String(repoId).trim() &&
      linkedOrg.toLowerCase() === originRepository.org.toLowerCase() &&
      linkedRepo.toLowerCase() === originRepository.repo.toLowerCase(),
    FAILURE_CATEGORIES.PRECONDITION,
    "vercel-project-git-source",
    "vercel_project_git_source_mismatch"
  );

  return { type: linkType, repoId };
}

function validateGitDeployment(deployment, { deploymentId, repoId, requireReady }) {
  const readyState = String(deployment?.readyState || "").trim().toUpperCase();
  const gitSource = deployment?.gitSource;
  requireCondition(
    deployment?.id === deploymentId &&
      deployment?.projectId === MY_E2E_VERCEL_PROJECT_ID &&
      deployment?.name === MY_E2E_VERCEL_PROJECT &&
      deployment?.target == null &&
      gitSource?.type === "github" &&
      String(gitSource?.repoId) === String(repoId) &&
      gitSource?.ref === branch &&
      gitSource?.sha === gitHead,
    FAILURE_CATEGORIES.PRECONDITION,
    "preview-deploy",
    "vercel_native_git_source_mismatch"
  );

  if (!requireReady) return null;
  requireCondition(
    readyState === "READY" &&
      deployment?.meta?.githubCommitSha === gitHead &&
      deployment?.meta?.githubCommitRef === branch,
    FAILURE_CATEGORIES.PRECONDITION,
    "preview-deploy",
    "vercel_native_git_attestation_mismatch"
  );

  const hostname = String(deployment?.url || "").trim().toLowerCase();
  requireCondition(
    /^[a-z0-9.-]+\.vercel\.app$/.test(hostname),
    FAILURE_CATEGORIES.PRECONDITION,
    "preview-deploy",
    "vercel_preview_url_invalid"
  );
  return {
    id: deploymentId,
    url: `https://${hostname}`,
    branch,
    gitSha: gitHead,
    project: MY_E2E_VERCEL_PROJECT,
    attestationSource: "github-metadata"
  };
}

async function waitForGitAttestedPreview({ deploymentId, repoId }) {
  for (let attempt = 0; attempt < DEPLOYMENT_POLL_ATTEMPTS; attempt += 1) {
    const deployment = runMyE2EVercelApiJsonCommand(
      `/v13/deployments/${encodeURIComponent(deploymentId)}`,
      { method: "GET" },
      "vercel-preview-deployment-poll"
    );
    const readyState = String(deployment?.readyState || "").trim().toUpperCase();
    validateGitDeployment(deployment, { deploymentId, repoId, requireReady: false });
    if (readyState === "READY") {
      return validateGitDeployment(deployment, { deploymentId, repoId, requireReady: true });
    }
    if (TERMINAL_DEPLOYMENT_STATES.has(readyState)) {
      throw new JourneyFailure(
        FAILURE_CATEGORIES.PRECONDITION,
        "preview-deploy",
        `vercel_git_preview_terminal_${readyState.toLowerCase()}`
      );
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

const projectGitSource = readVercelProjectGitSource();
const created = runMyE2EVercelApiJsonCommand(
  "/v13/deployments?forceNew=1",
  {
    method: "POST",
    body: {
      name: MY_E2E_VERCEL_PROJECT,
      project: MY_E2E_VERCEL_PROJECT_ID,
      gitSource: {
        type: "github",
        repoId: projectGitSource.repoId,
        ref: branch,
        sha: gitHead
      }
    }
  },
  "vercel-git-source-deploy-create"
);
const deploymentId = String(created?.id || "").trim();
requireCondition(
  /^dpl_[A-Za-z0-9]+$/.test(deploymentId),
  FAILURE_CATEGORIES.PRECONDITION,
  "vercel-git-source-deploy-create",
  "vercel_deployment_id_missing"
);
const deployed = await waitForGitAttestedPreview({
  deploymentId,
  repoId: projectGitSource.repoId
});

assertGitWorktreeClean();

console.log(JSON.stringify({
  ok: true,
  verdict: "MY_E2E_PREVIEW_READY",
  url: deployed.url,
  deploymentId: deployed.id,
  branch,
  gitHead,
  attestationSource: deployed.attestationSource,
  project: deployed.project,
  scope: MY_E2E_VERCEL_SCOPE,
  deploymentSource: "vercel-git-source-api",
  remoteHeadAuthority: "origin-branch-sha",
  artifactGitAuthority: "vercel-git-source",
  deployHookCreated: false,
  deployHookRemoved: false,
  orphanedHookRecovery: false,
  forceNewDeployment: true,
  localVercelLinkCreated: false,
  nextCommand: "npm run e2e:my:login"
}, null, 2));
