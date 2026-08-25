import { spawnSync } from "node:child_process";
import {
  FAILURE_CATEGORIES,
  JourneyFailure,
  normalizeBaseUrl,
  requireCondition
} from "./premium-browser-journey-core.mjs";

export const MY_E2E_VERCEL_PROJECT = String(process.env.MY_E2E_VERCEL_PROJECT || "k-beauty").trim();
export const MY_E2E_VERCEL_SCOPE = String(process.env.MY_E2E_VERCEL_SCOPE || "johnny-self").trim();
export const MY_E2E_META_SHA = "myE2EGitSha";
export const MY_E2E_META_BRANCH = "myE2EGitBranch";
export const MY_E2E_META_PURPOSE = "myE2EPurpose";
export const MY_E2E_PURPOSE = "my-adversarial";

const npxExecutable = process.platform === "win32" ? "npx.cmd" : "npx";

function stripAnsi(value) {
  return String(value || "").replace(/\u001B\[[0-?]*[ -/]*[@-~]/g, "");
}

function runVercel(args, step) {
  const result = spawnSync(npxExecutable, ["vercel", ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      CI: "1",
      NO_UPDATE_NOTIFIER: "1"
    },
    windowsHide: true
  });
  const stdout = stripAnsi(result.stdout);
  const stderr = stripAnsi(result.stderr);
  if (result.status !== 0) {
    const summary = [stdout, stderr].filter(Boolean).join("\n").slice(-2000);
    throw new JourneyFailure(
      FAILURE_CATEGORIES.PRECONDITION,
      step,
      "vercel_cli_failed",
      summary || "vercel_cli_failed"
    );
  }
  return [stdout, stderr].filter(Boolean).join("\n");
}

function deploymentUrls(output) {
  return [...new Set(
    String(output || "").match(/https:\/\/[a-z0-9.-]+\.vercel\.app\b/gi) || []
  )];
}

function listByMetadata({ branch, gitHead, metadataSource }) {
  const metadata = metadataSource === "my-e2e"
    ? [
        `${MY_E2E_META_SHA}=${gitHead}`,
        `${MY_E2E_META_BRANCH}=${branch}`,
        `${MY_E2E_META_PURPOSE}=${MY_E2E_PURPOSE}`
      ]
    : [
        `githubCommitSha=${gitHead}`,
        `githubCommitRef=${branch}`
      ];

  const args = [
    "list",
    MY_E2E_VERCEL_PROJECT,
    "--scope",
    MY_E2E_VERCEL_SCOPE,
    "--environment",
    "preview",
    "--status",
    "READY",
    "--yes"
  ];
  for (const pair of metadata) args.push("--meta", pair);
  return deploymentUrls(runVercel(args, `vercel-preview-${metadataSource}`));
}

export function resolveMyE2EPreviewDeployment({ branch, gitHead, requestedUrl = "" } = {}) {
  requireCondition(branch && !["main", "master"].includes(branch), FAILURE_CATEGORIES.PRECONDITION, "vercel-preview", "preview_branch_invalid");
  requireCondition(/^[0-9a-f]{40}$/i.test(String(gitHead || "")), FAILURE_CATEGORIES.PRECONDITION, "vercel-preview", "git_head_invalid");
  requireCondition(MY_E2E_VERCEL_PROJECT && MY_E2E_VERCEL_SCOPE, FAILURE_CATEGORIES.PRECONDITION, "vercel-preview", "vercel_project_scope_missing");

  let urls = listByMetadata({ branch, gitHead, metadataSource: "my-e2e" });
  let attestationSource = "my-e2e-metadata";
  if (!urls.length) {
    urls = listByMetadata({ branch, gitHead, metadataSource: "github" });
    attestationSource = "github-metadata";
  }

  requireCondition(urls.length > 0, FAILURE_CATEGORIES.PRECONDITION, "vercel-preview", "vercel_preview_for_head_not_found");

  let selected = urls[0];
  if (requestedUrl) {
    const requested = normalizeBaseUrl(requestedUrl);
    const exact = urls.find((value) => normalizeBaseUrl(value).hostname === requested.hostname);
    requireCondition(Boolean(exact), FAILURE_CATEGORIES.PRECONDITION, "vercel-preview", "requested_preview_not_attested_for_head");
    selected = exact;
  }

  const baseUrl = normalizeBaseUrl(selected);
  return {
    url: baseUrl.origin,
    hostname: baseUrl.hostname,
    branch,
    gitSha: gitHead,
    project: MY_E2E_VERCEL_PROJECT,
    scope: MY_E2E_VERCEL_SCOPE,
    attestationSource
  };
}

export function runMyE2EVercelCommand(args, step = "vercel-command") {
  return runVercel(args, step);
}

export function extractMyE2EDeploymentUrls(output) {
  return deploymentUrls(output);
}
