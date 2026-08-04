import { spawnSync } from "node:child_process";

const steps = [
  ["route-checker", ["node", "scripts/check-candidate-exposure-policy-hosted-diagnostic-route.mjs"]],
  ["execution-checker", ["node", "scripts/check-candidate-exposure-policy-hosted-execution.mjs"]],
  ["runtime-reevaluation-verifier", ["node", "scripts/verify-candidate-policy-runtime-reevaluation.mjs"]],
  ["security-closeout", ["node", "scripts/run-security-closeout-verifier-suite.mjs"]],
  ["architecture-guard", ["npm", "run", "architecture:guard"]],
  ["production-build", ["npm", "run", "build"]]
];

console.log("VALIDATION_SOURCE_SHA=31fd7468ea898014c3cf6b5a21917386034c3040");
console.log(`VALIDATION_NODE=${process.version}`);
for (const [name, command] of steps) {
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
console.log("STAGE11K_EXACT_HEAD_VALIDATION=PASS");
