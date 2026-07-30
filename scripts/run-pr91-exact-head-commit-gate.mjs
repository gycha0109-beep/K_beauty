import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const REQUIRED_CHANGED_FILES = [
  "docs/architecture/shared-skin-decision-context-v4.md",
  "lib/premium-decision-state.js",
  "lib/shared-skin-decision-context-v4.js",
  "package.json",
  "scripts/verify-shared-skin-decision-context-v4.mjs"
];

function run(command, args = []) {
  console.log(`\n$ ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    cwd: ROOT,
    env: process.env,
    encoding: "utf8",
    stdio: "inherit"
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit ${result.status}`);
  }
}

function verifyTextHygiene(file) {
  const value = readFileSync(path.join(ROOT, file), "utf8");
  if (value.includes("\0")) throw new Error(`${file}: NUL byte found`);
  if (/^(<<<<<<<|=======|>>>>>>>)/m.test(value)) {
    throw new Error(`${file}: merge conflict marker found`);
  }
  const lines = value.split("\n");
  const trailing = lines.findIndex((line) => /[ \t]+$/.test(line));
  if (trailing >= 0) throw new Error(`${file}:${trailing + 1}: trailing whitespace`);
  if (!value.endsWith("\n")) throw new Error(`${file}: missing final newline`);
}

console.log("PR91 exact-head commit gate");
console.log(`node=${process.version}`);

for (const file of REQUIRED_CHANGED_FILES) verifyTextHygiene(file);

run(process.execPath, ["--check", "lib/shared-skin-decision-context-v4.js"]);
run(process.execPath, ["--check", "lib/premium-decision-state.js"]);
run(process.execPath, ["--check", "scripts/verify-shared-skin-decision-context-v4.mjs"]);
run("npm", ["run", "verify:shared-skin-decision-context"]);

const scriptNames = readdirSync(path.join(ROOT, "scripts"));
const selected = scriptNames
  .filter((name) => name.endsWith(".mjs"))
  .filter((name) => {
    if (name === "verify-shared-skin-decision-context-v4.mjs") return false;
    if (name === "verify-premium-decision-state.mjs") return true;
    if (name === "verify-premium-report-reentry-contract.mjs") return true;
    return [
      /verify-.*functional.*policy/i,
      /verify-.*routine.*policy/i,
      /verify-.*condition.*policy/i,
      /verify-.*cross-domain-consistency/i,
      /verify-.*effective-policy/i,
      /verify-premium-.*projection/i
    ].some((pattern) => pattern.test(name));
  })
  .sort();

if (!selected.includes("verify-premium-decision-state.mjs")) {
  throw new Error("mandatory premium decision-state verifier missing");
}
if (!selected.includes("verify-premium-report-reentry-contract.mjs")) {
  throw new Error("mandatory premium report-reentry verifier missing");
}
if (selected.length < 4) {
  throw new Error(`expected at least 4 relevant verifiers, found ${selected.length}`);
}

console.log(`\nSelected relevant verifiers (${selected.length})`);
for (const name of selected) console.log(`- scripts/${name}`);
for (const name of selected) run(process.execPath, [`scripts/${name}`]);

run("npm", ["run", "architecture:guard"]);

const caller = readFileSync(path.join(ROOT, "lib/premium-decision-state.js"), "utf8");
if (!caller.includes('from "./shared-skin-decision-context-v4.js"')) {
  throw new Error("Premium decision state does not import SharedSkinDecisionContext v4");
}
if (caller.includes('from "./shared-skin-decision-context.js"')) {
  throw new Error("Premium decision state bypasses SharedSkinDecisionContext v4");
}

console.log("\nPR91_EXACT_HEAD_COMMIT_GATE_PASS");
