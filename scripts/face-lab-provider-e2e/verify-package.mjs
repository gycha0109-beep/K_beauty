import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = process.cwd();
const workflowPath = ".github/workflows/face-lab-provider-e2e.yml";
const runnerPath = "scripts/face-lab-provider-e2e/run.mjs";
const packagePath = "package.json";
const temporaryRoutePath = "app/api/__face-lab-provider-e2e/route.js";

function read(relativePath) {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function isTracked(relativePath) {
  const result = spawnSync("git", ["ls-files", "--error-unmatch", relativePath], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  return result.status === 0;
}

assert(existsSync(path.join(repoRoot, workflowPath)), "missing_face_lab_provider_e2e_workflow");
assert(existsSync(path.join(repoRoot, runnerPath)), "missing_face_lab_provider_e2e_runner");
assert(!isTracked(temporaryRoutePath), "temporary_e2e_route_must_not_be_tracked");

const workflow = read(workflowPath);
const runner = read(runnerPath);
const packageJson = JSON.parse(read(packagePath));

for (const marker of [
  "workflow_dispatch:",
  "private/face-lab-e2e/run.trigger",
  "BUNDLE_PATH: private/face-lab-e2e/fixture-bundle-v3.tar.gz.enc",
  "expected_size=3094224",
  "expected_sha256=3d7c888484c36b7f0293b8037d842b98cbc11ca4bcd6c28d136aef01222b935f",
  "secrets.OPENAI_API_KEY",
  "secrets.FACE_LAB_E2E_FIXTURE_PASSPHRASE",
  "openssl enc -d -aes-256-cbc -pbkdf2 -iter 210000",
  "-pass env:FACE_LAB_E2E_FIXTURE_PASSPHRASE",
  "import tarfile",
  "expected_files = (",
  "allowed_directories = {",
  "member.isfile()",
  "member.isdir()",
  "member.issym() or member.islnk()",
  "fixture_bundle_path_contract_invalid",
  "fixture_bundle_type_contract_invalid",
  "fixture_bundle_duplicate_member",
  "fixture_bundle_member_contract_invalid",
  "fixture_bundle_extract_failed",
  "archive.extractfile(member)",
  "os.replace(temp_path, target)",
  "os.lstat(target)",
  "frontal-clear.png",
  "lower-face-occluded.png",
  "permissions:\n  contents: read",
  "npm run face-lab:e2e:run",
  "retention-days: 3",
  "Mandatory cleanup"
]) {
  assert(workflow.includes(marker), `workflow_contract_missing:${marker}`);
}

for (const forbiddenMarker of [
  "BUNDLE_PREFIX",
  "fixture-bundle-v2",
  "fixture-bundle.tar.gz.enc.b64.part-",
  "base64 --decode",
  "tar.extractall",
  "tar -xzf",
  "pull_request:",
  "pull_request_target",
  "contents: write",
  "FACE_LAB_E2E_OPENAI_API_KEY"
]) {
  assert(!workflow.includes(forbiddenMarker), `forbidden_workflow_marker:${forbiddenMarker}`);
}

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

assert(!/console\.(?:log|info|warn|error)\([^\n]*(?:OPENAI_API_KEY|FACE_LAB_E2E_FIXTURE_PASSPHRASE)/.test(runner), "runner_must_not_log_provider_secret");
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
