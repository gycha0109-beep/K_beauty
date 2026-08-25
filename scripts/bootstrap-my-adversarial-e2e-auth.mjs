import { spawnSync } from "node:child_process";
import {
  FAILURE_CATEGORIES,
  JourneyFailure,
  requireCondition
} from "./premium-browser-journey-core.mjs";
import {
  assertGitWorktreeClean,
  ensureLocalRuntime,
  getGitBranch,
  getGitHead,
  parseCliArgs
} from "./premium-browser-journey-local-auth.mjs";
import { resolveMyE2EPreviewDeployment } from "./my-e2e-vercel-preview.mjs";

const args = parseCliArgs();
await ensureLocalRuntime();
assertGitWorktreeClean();

const branch = getGitBranch();
const gitHead = getGitHead();
const requestedUrl = typeof args.url === "string" ? args.url : "";
const deployment = resolveMyE2EPreviewDeployment({ branch, gitHead, requestedUrl });

console.log(`My E2E 인증 대상(attested): ${deployment.url}`);
console.log(`Vercel attestation: ${deployment.attestationSource} / ${branch} @ ${gitHead}`);

const childArgs = [
  "scripts/bootstrap-premium-e2e-auth.mjs",
  "--url",
  deployment.url,
  "--environment",
  "preview",
  "--host",
  deployment.hostname
];

for (const flag of ["reset-profiles", "reset-a", "reset-b"]) {
  if (args[flag] === true) childArgs.push(`--${flag}`);
}
if (typeof args["preview-bypass-token"] === "string") {
  childArgs.push("--preview-bypass-token", args["preview-bypass-token"]);
}

const result = spawnSync(process.execPath, childArgs, {
  cwd: process.cwd(),
  env: process.env,
  stdio: "inherit",
  windowsHide: true
});

if (result.error) {
  throw new JourneyFailure(
    FAILURE_CATEGORIES.PRECONDITION,
    "my-auth-bootstrap",
    "premium_auth_bootstrap_spawn_failed",
    result.error.message
  );
}
requireCondition(result.status === 0, FAILURE_CATEGORIES.AUTH, "my-auth-bootstrap", "premium_auth_bootstrap_failed");
