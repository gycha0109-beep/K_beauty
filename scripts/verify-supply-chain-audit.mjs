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
  assert.ok(
    result.status === 0 || result.status === 1,
    `${name}: npm audit exited unexpectedly with ${result.status}\n${result.stderr}`,
  );

  let report;
  try {
    report = JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(
      `${name}: npm audit did not return valid JSON: ${error.message}\n${result.stdout}\n${result.stderr}`,
    );
  }

  const raw = report?.metadata?.vulnerabilities;
  assert.ok(raw && typeof raw === "object", `${name}: vulnerability metadata missing`);

  const vulnerabilities = Object.fromEntries(
    severities.map((severity) => {
      const value = Number(raw[severity] ?? 0);
      assert.ok(
        Number.isInteger(value) && value >= 0,
        `${name}: invalid ${severity} vulnerability count`,
      );
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
  production: Object.freeze({
    info: 0,
    low: 0,
    moderate: 13,
    high: 0,
    critical: 0,
    total: 13,
  }),
  all: Object.freeze({
    info: 0,
    low: 0,
    moderate: 13,
    high: 0,
    critical: 0,
    total: 13,
  }),
});

const TEMPORARY_ADVISORY_EXCEPTION = Object.freeze({
  id: "GHSA-86w9-cpqp-85rv",
  source: 1240912,
  package: "node-forge",
  affectedRange: "<=1.4.0",
  lockedVersion: "1.4.0",
  expiresAt: "2026-10-16T00:00:00.000Z",
  propagatedHighPackages: Object.freeze([
    "@expo/cli",
    "@expo/code-signing-certificates",
    "expo",
    "node-forge",
  ]),
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

function collectLeafAdvisories(packageName, report, seen = new Set()) {
  if (seen.has(packageName)) return [];
  seen.add(packageName);

  const entry = report?.vulnerabilities?.[packageName];
  if (!entry || !Array.isArray(entry.via)) return [];

  const leaves = [];
  for (const item of entry.via) {
    if (typeof item === "string") {
      leaves.push(...collectLeafAdvisories(item, report, new Set(seen)));
      continue;
    }
    if (item && typeof item === "object") {
      leaves.push({
        source: item.source ?? null,
        name: item.name ?? null,
        severity: item.severity ?? null,
        title: item.title ?? null,
        range: item.range ?? null,
        url: item.url ?? null,
      });
    }
  }
  return leaves;
}

function validateTemporaryAdvisoryException(name, report) {
  const expiry = Date.parse(TEMPORARY_ADVISORY_EXCEPTION.expiresAt);
  assert.ok(Number.isFinite(expiry), "temporary advisory exception expiry is invalid");
  assert.ok(
    Date.now() < expiry,
    `${name}: temporary advisory exception expired at ${TEMPORARY_ADVISORY_EXCEPTION.expiresAt}`,
  );

  const lock = JSON.parse(fs.readFileSync("package-lock.json", "utf8"));
  const lockedNodeForge = lock?.packages?.["node_modules/node-forge"]?.version ?? null;
  assert.equal(
    lockedNodeForge,
    TEMPORARY_ADVISORY_EXCEPTION.lockedVersion,
    `${name}: node-forge lock version changed; remove or reassess the temporary advisory exception`,
  );

  const highOrCriticalPackages = Object.entries(report?.vulnerabilities || {})
    .filter(([, entry]) => ["high", "critical"].includes(entry?.severity))
    .map(([packageName]) => packageName)
    .sort();

  const expectedPackages = [...TEMPORARY_ADVISORY_EXCEPTION.propagatedHighPackages].sort();
  assert.deepEqual(
    highOrCriticalPackages,
    expectedPackages,
    `${name}: high/critical package set changed; temporary advisory exception cannot apply`,
  );

  for (const packageName of expectedPackages) {
    const highLeaves = collectLeafAdvisories(packageName, report).filter((leaf) =>
      ["high", "critical"].includes(leaf.severity),
    );

    assert.ok(
      highLeaves.length > 0,
      `${name}: ${packageName} has no traceable high/critical advisory leaf`,
    );

    for (const leaf of highLeaves) {
      assert.equal(
        leaf.source,
        TEMPORARY_ADVISORY_EXCEPTION.source,
        `${name}: ${packageName} includes an unapproved high advisory source`,
      );
      assert.equal(
        leaf.name,
        TEMPORARY_ADVISORY_EXCEPTION.package,
        `${name}: ${packageName} high advisory does not resolve to node-forge`,
      );
      assert.equal(
        leaf.range,
        TEMPORARY_ADVISORY_EXCEPTION.affectedRange,
        `${name}: node-forge affected range changed`,
      );
      assert.equal(
        leaf.url,
        `https://github.com/advisories/${TEMPORARY_ADVISORY_EXCEPTION.id}`,
        `${name}: node-forge high advisory URL changed`,
      );
      assert.equal(
        leaf.severity,
        "high",
        `${name}: node-forge advisory severity changed`,
      );
    }
  }

  return {
    id: TEMPORARY_ADVISORY_EXCEPTION.id,
    expiresAt: TEMPORARY_ADVISORY_EXCEPTION.expiresAt,
    allowedHighPackageCount: expectedPackages.length,
    lockedNodeForge,
    packages: expectedPackages,
  };
}

function assertNoRegression(name, vulnerabilities, temporaryException) {
  const baseline = BASELINE[name];
  const adjusted = {
    ...vulnerabilities,
    high:
      vulnerabilities.high - temporaryException.allowedHighPackageCount,
    total:
      vulnerabilities.total - temporaryException.allowedHighPackageCount,
  };

  assert.ok(adjusted.high >= 0, `${name}: adjusted high count became negative`);
  assert.ok(adjusted.total >= 0, `${name}: adjusted total count became negative`);

  for (const severity of severities) {
    assert.ok(
      adjusted[severity] <= baseline[severity],
      `${name}: ${severity} vulnerabilities regressed from baseline ${baseline[severity]} to ${adjusted[severity]} after the scoped temporary exception`,
    );
  }

  return adjusted;
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

const productionException = validateTemporaryAdvisoryException(
  "production",
  production.report,
);
const allException = validateTemporaryAdvisoryException("all", all.report);

const productionAdjusted = assertNoRegression(
  "production",
  production.vulnerabilities,
  productionException,
);
const allAdjusted = assertNoRegression(
  "all",
  all.vulnerabilities,
  allException,
);

fs.mkdirSync("tmp", { recursive: true });
fs.writeFileSync(
  "tmp/supply-chain-audit.json",
  JSON.stringify(
    {
      baseline: BASELINE,
      temporaryAdvisoryException: TEMPORARY_ADVISORY_EXCEPTION,
      production: {
        ...production,
        adjustedVulnerabilities: productionAdjusted,
        temporaryException: productionException,
      },
      all: {
        ...all,
        adjustedVulnerabilities: allAdjusted,
        temporaryException: allException,
      },
    },
    null,
    2,
  ) + "\n",
  "utf8",
);

console.log(
  `SUPPLY_CHAIN_AUDIT_PRODUCTION=${JSON.stringify(production.vulnerabilities)}`,
);
console.log(
  `SUPPLY_CHAIN_AUDIT_ALL=${JSON.stringify(all.vulnerabilities)}`,
);
console.log(
  `SUPPLY_CHAIN_AUDIT_PRODUCTION_ADJUSTED=${JSON.stringify(productionAdjusted)}`,
);
console.log(
  `SUPPLY_CHAIN_AUDIT_ALL_ADJUSTED=${JSON.stringify(allAdjusted)}`,
);
console.log(
  `SUPPLY_CHAIN_AUDIT_TEMP_EXCEPTION=${JSON.stringify(productionException)}`,
);
console.log(
  `SUPPLY_CHAIN_AUDIT_PRODUCTION_PACKAGES=${JSON.stringify(production.packages)}`,
);
console.log(
  `SUPPLY_CHAIN_AUDIT_ALL_PACKAGES=${JSON.stringify(all.packages)}`,
);
console.log("SUPPLY_CHAIN_AUDIT=PASS baseline-non-regression-with-scoped-temporary-exception");
