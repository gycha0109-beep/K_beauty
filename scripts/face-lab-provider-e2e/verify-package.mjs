import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

function read(relativePath) {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const workflowPath = ".github/workflows/face-lab-provider-e2e.yml";
const runnerPath = "scripts/face-lab-provider-e2e/run.mjs";
const packagePath = "package.json";
const temporaryRoutePath = "app/api/__face-lab-provider-e2e/route.js";

assert(existsSync(path.join(repoRoot, workflowPath)), "missing_face_lab_provider_e2e_workflow");
assert(existsSync(path.join(repoRoot, runnerPath)), "missing_face_lab_provider_e2e_runner");
assert(!existsSync(path.join(repoRoot, temporaryRoutePath)), "temporary_e2e_route_must_not_be_tracked");

const workflow = read(workflowPath);
const runner = read(runnerPath);
const packageJson = JSON.parse(read(packagePath));

for (const marker of [
  "workflow_dispatch:",
  "private/face-lab-e2e/fixture-bundle.tar.gz.enc.b64",
  "secrets.OPENAI_API_KEY",
  "FACE_LAB_E2E_FIXTURE_PASSPHRASE",
  "base64 --decode",
  "frontal-clear.jpg",
  "lower-face-occluded.jpg",
  "permissions:\n  contents: read",
  "npm run face-lab:e2e:verify",
  "npm run face-lab:e2e:run",
  "retention-days: 3"
]) {
  assert(workflow.includes(marker), `workflow_contract_missing:${marker}`);
}

assert(!workflow.includes("pull_request_target"), "forbidden_pull_request_target_trigger");
assert(!workflow.includes("contents: write"), "provider_e2e_must_not_have_contents_write");
assert(!workflow.includes("actions/checkout@v3"), "checkout_action_must_be_v4");
assert(!workflow.includes("FACE_LAB_E2E_OPENAI_API_KEY"), "stale_dedicated_openai_secret_name");

for (const marker of [
  "subject-a-frontal-clear",
  "subject-a-lower-face-occluded",
  "MAX_IMAGE_ATTEMPTS = 2",
  "AUTOMATIC_RETRY_COUNT = 0",
  "127.0.0.1",
  "FACE_LAB_PROVIDER_E2E_ENABLED",
  "FACE_LAB_PROVIDER_E2E_TOKEN",
  "vision-observation-v1",
  "schemaVersion !== 2",
  "x-kbeauty-result-write-token",
  "x-kbeauty-track-write-token"
]) {
  assert(runner.includes(marker), `runner_contract_missing:${marker}`);
}

assert(!runner.includes("console.log(process.env.OPENAI_API_KEY"), "runner_must_not_log_provider_secret");
assert(!runner.includes("Authorization: `Bearer ${process.env.OPENAI_API_KEY}`"), "runner_must_not_interpolate_secret_in_logs");
assert(!runner.includes("retry("), "runner_must_not_define_automatic_retry_helper");

assert(
  packageJson.scripts?.["face-lab:e2e:verify"] === "node scripts/face-lab-provider-e2e/verify-package.mjs",
  "package_script_face_lab_e2e_verify_invalid"
);
assert(
  packageJson.scripts?.["face-lab:e2e:run"] === "node scripts/face-lab-provider-e2e/run.mjs",
  "package_script_face_lab_e2e_run_invalid"
);

console.log("[face-lab-provider-e2e-verify] PASS");
