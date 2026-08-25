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

try {
  runMyE2EVercelCommand([
    "deploy",
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
  project: MY_E2E_VERCEL_PROJECT,
  scope: MY_E2E_VERCEL_SCOPE,
  localVercelLinkCreated: false,
  nextCommand: "npm run e2e:my:login"
}, null, 2));
