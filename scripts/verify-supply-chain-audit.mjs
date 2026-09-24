import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const severities = ["info", "low", "moderate", "high", "critical", "total"];

function runAudit(name, args) {
  const result = spawnSync(npm, ["audit", "--json", ...args], {
    encoding: "utf8",
    timeout: 120_000,
    maxBuffer: 16 * 1024 * 1024,
  });

  if (result.error) {
    throw result.error;
  }
  assert.ok(result.status === 0 || result.status === 1, `${name}: npm audit exited unexpectedly with ${result.status}\n${result.stderr}`);

  let report;
  try {
    report = JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(`${name}: npm audit did not return valid JSON: ${error.message}\n${result.stdout}\n${result.stderr}`);
  }

  const raw = report?.metadata?.vulnerabilities;
  assert.ok(raw && typeof raw === "object", `${name}: vulnerability metadata missing`);

  const vulnerabilities = Object.fromEntries(
    severities.map((severity) => {
      const value = Number(raw[severity] ?? 0);
      assert.ok(Number.isInteger(value) && value >= 0, `${name}: invalid ${severity} vulnerability count`);
      return [severity, value];
    }),
  );

  return {
    name,
    exitCode: result.status,
    vulnerabilities,
  };
}

const production = runAudit("production", ["--omit=dev"]);
const all = runAudit("all", []);

fs.mkdirSync("tmp", { recursive: true });
fs.writeFileSync(
  "tmp/supply-chain-audit.json",
  JSON.stringify({ production, all }, null, 2) + "\n",
  "utf8",
);

console.log(`SUPPLY_CHAIN_AUDIT_PRODUCTION=${JSON.stringify(production.vulnerabilities)}`);
console.log(`SUPPLY_CHAIN_AUDIT_ALL=${JSON.stringify(all.vulnerabilities)}`);

assert.equal(
  production.vulnerabilities.critical,
  0,
  `production dependency audit has ${production.vulnerabilities.critical} critical vulnerabilities`,
);
assert.equal(
  all.vulnerabilities.critical,
  0,
  `full dependency audit has ${all.vulnerabilities.critical} critical vulnerabilities`,
);

console.log("SUPPLY_CHAIN_AUDIT=PASS critical=0");
