import { existsSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
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
  MY_E2E_VERCEL_PROJECT,
  MY_E2E_VERCEL_SCOPE,
  extractMyE2EDeploymentUrls,
  resolveMyE2EPreviewDeployment,
  runMyE2EVercelCommand
} from "./my-e2e-vercel-preview.mjs";

await ensureLocalRuntime();
assertGitWorktreeClean();

const branch = getGitBranch();
const gitHead = getGitHead();
requireCondition(branch && !["main", "master"].includes(branch), FAILURE_CATEGORIES.PRECONDITION, "preview-deploy", "preview_branch_invalid");

const vercelDir = resolve(process.cwd(), ".vercel");
const gitignorePath = resolve(process.cwd(), ".gitignore");
const hadVercelDir = existsSync(vercelDir);
const hadGitignore = existsSync(gitignorePath);
const originalGitignore = hadGitignore ? readFileSync(gitignorePath, "utf8") : null;

let deployOutput = "";
try {
  deployOutput = runMyE2EVercelCommand([
    "deploy",
    "--yes",
    "--scope",
    MY_E2E_VERCEL_SCOPE,
    "--project",
    MY_E2E_VERCEL_PROJECT,
    "--meta",
    `${MY_E2E_META_SHA}=${gitHead}`,
    "--meta",
    `${MY_E2E_META_BRANCH}=${branch}`,
    "--meta",
    `${MY_E2E_META_PURPOSE}=${MY_E2E_PURPOSE}`
  ], "vercel-preview-deploy");
} finally {
  if (!hadVercelDir && existsSync(vercelDir)) rmSync(vercelDir, { recursive: true, force: true });
  if (hadGitignore) {
    if (!existsSync(gitignorePath) || readFileSync(gitignorePath, "utf8") !== originalGitignore) {
      writeFileSync(gitignorePath, originalGitignore, "utf8");
    }
  } else if (existsSync(gitignorePath)) {
    unlinkSync(gitignorePath);
  }
}

assertGitWorktreeClean();

const outputUrls = extractMyE2EDeploymentUrls(deployOutput);
requireCondition(outputUrls.length > 0, FAILURE_CATEGORIES.PRECONDITION, "preview-deploy", "vercel_preview_url_missing_from_deploy_output");

const deployed = resolveMyE2EPreviewDeployment({
  branch,
  gitHead,
  requestedUrl: outputUrls[0]
});

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
  scope: deployed.scope,
  localVercelLinkCreated: false,
  nextCommand: "npm run e2e:my:login"
}, null, 2));
