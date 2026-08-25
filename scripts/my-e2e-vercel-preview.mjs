import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  FAILURE_CATEGORIES,
  JourneyFailure,
  normalizeBaseUrl,
  requireCondition
} from "./premium-browser-journey-core.mjs";

export const MY_E2E_VERCEL_PROJECT = String(process.env.MY_E2E_VERCEL_PROJECT || "k-beauty").trim();
export const MY_E2E_VERCEL_SCOPE = String(process.env.MY_E2E_VERCEL_SCOPE || "johnny-self").trim();
export const MY_E2E_VERCEL_PROJECT_ID = String(
  process.env.MY_E2E_VERCEL_PROJECT_ID || process.env.VERCEL_PROJECT_ID || "prj_VHh3BMegmXFGwxgOJLlgFQjksmKA"
).trim();
export const MY_E2E_VERCEL_ORG_ID = String(
  process.env.MY_E2E_VERCEL_ORG_ID || process.env.VERCEL_ORG_ID || "team_xuYA9OhCWlJETaYFOmeVodgS"
).trim();

function resolveNpxInvocation() {
  const npmExecPath = String(process.env.npm_execpath || "").trim();
  if (npmExecPath) {
    const npxCliPath = join(dirname(npmExecPath), "npx-cli.js");
    if (existsSync(npxCliPath)) {
      return {
        command: process.execPath,
        prefixArgs: [npxCliPath, "vercel"]
      };
    }
  }
  requireCondition(
    process.platform !== "win32",
    FAILURE_CATEGORIES.PRECONDITION,
    "vercel-cli",
    "npm_runtime_required_for_windows_vercel_cli"
  );
  return { command: "npx", prefixArgs: ["vercel"] };
}

function stripAnsi(value) {
  return String(value || "").replace(/\u001B\[[0-?]*[ -/]*[@-~]/g, "");
}

function runVercel(args, step) {
  requireCondition(
    MY_E2E_VERCEL_PROJECT_ID && MY_E2E_VERCEL_ORG_ID,
    FAILURE_CATEGORIES.PRECONDITION,
    step,
    "vercel_project_ids_missing"
  );
  const invocation = resolveNpxInvocation();
  const result = spawnSync(invocation.command, [...invocation.prefixArgs, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      VERCEL_PROJECT_ID: MY_E2E_VERCEL_PROJECT_ID,
      VERCEL_ORG_ID: MY_E2E_VERCEL_ORG_ID,
      CI: "1",
      NO_UPDATE_NOTIFIER: "1"
    },
    windowsHide: true
  });
  const stdout = stripAnsi(result.stdout);
  const stderr = stripAnsi(result.stderr);
  if (result.error || result.status !== 0) {
    const summary = [result.error?.message, stdout, stderr].filter(Boolean).join("\n").slice(-2000);
    throw new JourneyFailure(
      FAILURE_CATEGORIES.PRECONDITION,
      step,
      "vercel_cli_failed",
      summary || "vercel_cli_failed"
    );
  }
  return stdout;
}

function deploymentUrls(output) {
  return [...new Set(
    String(output || "").match(/https:\/\/[a-z0-9.-]+\.vercel\.app\b/gi) || []
  )];
}

function listGitAttestedDeployments({ branch, gitHead }) {
  const args = [
    "list",
    MY_E2E_VERCEL_PROJECT,
    "--scope",
    MY_E2E_VERCEL_SCOPE,
    "--environment",
    "preview",
    "--status",
    "READY",
    "--yes",
    "--meta",
    `githubCommitSha=${gitHead}`,
    "--meta",
    `githubCommitRef=${branch}`
  ];
  return deploymentUrls(runVercel(args, "vercel-preview-github"));
}

export function resolveMyE2EPreviewDeployment({ branch, gitHead, requestedUrl = "" } = {}) {
  requireCondition(branch && !["main", "master"].includes(branch), FAILURE_CATEGORIES.PRECONDITION, "vercel-preview", "preview_branch_invalid");
  requireCondition(/^[0-9a-f]{40}$/i.test(String(gitHead || "")), FAILURE_CATEGORIES.PRECONDITION, "vercel-preview", "git_head_invalid");
  requireCondition(MY_E2E_VERCEL_PROJECT && MY_E2E_VERCEL_SCOPE, FAILURE_CATEGORIES.PRECONDITION, "vercel-preview", "vercel_project_scope_missing");
  requireCondition(MY_E2E_VERCEL_PROJECT_ID && MY_E2E_VERCEL_ORG_ID, FAILURE_CATEGORIES.PRECONDITION, "vercel-preview", "vercel_project_ids_missing");

  const urls = listGitAttestedDeployments({ branch, gitHead });
  requireCondition(urls.length > 0, FAILURE_CATEGORIES.PRECONDITION, "vercel-preview", "vercel_git_preview_for_head_not_found");

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
    projectId: MY_E2E_VERCEL_PROJECT_ID,
    scope: MY_E2E_VERCEL_SCOPE,
    orgId: MY_E2E_VERCEL_ORG_ID,
    attestationSource: "github-metadata"
  };
}

export function runMyE2EVercelCommand(args, step = "vercel-command") {
  return runVercel(args, step);
}

export function parseMyE2EVercelJsonOutput(output, step = "vercel-json-command") {
  const text = String(output || "").trim();
  if (!text) {
    throw new JourneyFailure(
      FAILURE_CATEGORIES.PRECONDITION,
      step,
      "vercel_cli_json_invalid"
    );
  }

  try {
    const direct = JSON.parse(text);
    if (direct && typeof direct === "object" && !Array.isArray(direct)) return direct;
  } catch {
    // Vercel CLI can prefix/suffix machine-readable output with CLI status text.
  }

  for (let start = 0; start < text.length; start += 1) {
    if (text[start] !== "{") continue;

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = start; index < text.length; index += 1) {
      const char = text[index];

      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (char === "\\") {
          escaped = true;
        } else if (char === '"') {
          inString = false;
        }
        continue;
      }

      if (char === '"') {
        inString = true;
        continue;
      }
      if (char === "{") depth += 1;
      if (char !== "}") continue;

      depth -= 1;
      if (depth !== 0) continue;

      const candidate = text.slice(start, index + 1);
      try {
        const parsed = JSON.parse(candidate);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
      } catch {
        // Keep scanning for the next complete top-level object.
      }
      break;
    }
  }

  throw new JourneyFailure(
    FAILURE_CATEGORIES.PRECONDITION,
    step,
    "vercel_cli_json_invalid"
  );
}

export function runMyE2EVercelJsonCommand(args, step = "vercel-json-command") {
  return parseMyE2EVercelJsonOutput(runVercel(args, step), step);
}

export function extractMyE2EDeploymentUrls(output) {
  return deploymentUrls(output);
}
