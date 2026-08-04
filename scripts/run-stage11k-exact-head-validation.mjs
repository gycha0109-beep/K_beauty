import { spawnSync } from "node:child_process";

function run(name, command) {
  console.log(`VALIDATION_STEP_START=${name}`);
  const result = spawnSync(command[0], command.slice(1), {
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32"
  });
  if (result.error || result.status !== 0 || result.signal) {
    console.error(`VALIDATION_STEP_FAIL=${name} status=${result.status} signal=${result.signal || "none"} error=${result.error?.message || "none"}`);
    process.exit(result.status || 1);
  }
  console.log(`VALIDATION_STEP_PASS=${name}`);
}

console.log("VALIDATION_SOURCE_SHA=31fd7468ea898014c3cf6b5a21917386034c3040");
console.log(`VALIDATION_NODE=${process.version}`);

const authorityRefs = [
  ["codex/stage10-hosted-preview-user-flow", "7a32d497744352f43468da144be889893e8e5cba"],
  ["codex/candidate-policy-runtime-reevaluation", "75f7ff8dc58c0ff47db3a8ab7b3002385c08158a"]
];
for (const [branch, sha] of authorityRefs) {
  run(`verify-object:${branch}`, ["git", "cat-file", "-e", `${sha}^{commit}`]);
  run(`restore-ref:${branch}`, ["git", "update-ref", `refs/heads/${branch}`, sha]);
}

for (const [name, command] of [
  ["route-checker", ["node", "scripts/check-candidate-exposure-policy-hosted-diagnostic-route.mjs"]],
  ["execution-checker", ["node", "scripts/check-candidate-exposure-policy-hosted-execution.mjs"]],
  ["security-closeout", ["node", "scripts/run-security-closeout-verifier-suite.mjs"]],
  ["architecture-guard", ["npm", "run", "architecture:guard"]],
  ["production-build", ["npm", "run", "build"]]
]) run(name, command);

console.log("STAGE11K_EXACT_HEAD_VALIDATION=PASS");
