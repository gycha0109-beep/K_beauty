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
    report,
  };
}

const BASELINE = Object.freeze({
  production: Object.freeze({ info: 0, low: 0, moderate: 13, high: 0, critical: 0, total: 13 }),
  all: Object.freeze({ info: 0, low: 0, moderate: 13, high: 0, critical: 0, total: 13 }),
});

function summarizePackages(report) {
  return Object.entries(report?.vulnerabilities || {})
    .map(([packageName, entry]) => ({
      package: packageName,
      severity: entry?.severity ?? "unknown",
      direct: Boolean(entry?.isDirect),
      range: entry?.range ?? null,
      effects: Array.isArray(entry?.effects) ? entry.effects : [],
      fixAvailable: entry?.fixAvailable ?? null,
      via: Array.isArray(entry?.via)
        ? entry.via.map((item) =>
            typeof item === "string"
              ? item
              : {
                  source: item?.source ?? null,
                  name: item?.name ?? null,
                  severity: item?.severity ?? null,
                  title: item?.title ?? null,
                  range: item?.range ?? null,
                  url: item?.url ?? null,
                },
          )
        : [],
    }))
    .sort((a, b) => a.package.localeCompare(b.package));
}

function assertNoRegression(name, vulnerabilities) {
  const baseline = BASELINE[name];
  for (const severity of severities) {
    assert.ok(
      vulnerabilities[severity] <= baseline[severity],
      `${name}: ${severity} vulnerabilities regressed from baseline ${baseline[severity]} to ${vulnerabilities[severity]}`,
    );
  }
}

const productionResult = runAudit("production", ["--omit=dev"]);
const allResult = runAudit("all", []);

const production = {
  ...productionResult,
  packages: summarizePackages(productionResult.report),
};
const all = {
  ...allResult,
  packages: summarizePackages(allResult.report),
};

fs.mkdirSync("tmp", { recursive: true });
fs.writeFileSync(
  "tmp/supply-chain-audit.json",
  JSON.stringify({ baseline: BASELINE, production, all }, null, 2) + "\n",
  "utf8",
);

console.log(`SUPPLY_CHAIN_AUDIT_PRODUCTION=${JSON.stringify(production.vulnerabilities)}`);
console.log(`SUPPLY_CHAIN_AUDIT_ALL=${JSON.stringify(all.vulnerabilities)}`);
console.log(`SUPPLY_CHAIN_AUDIT_PRODUCTION_PACKAGES=${JSON.stringify(production.packages)}`);
console.log(`SUPPLY_CHAIN_AUDIT_ALL_PACKAGES=${JSON.stringify(all.packages)}`);

assertNoRegression("production", production.vulnerabilities);
assertNoRegression("all", all.vulnerabilities);

console.log("SUPPLY_CHAIN_AUDIT=PASS baseline-non-regression");
