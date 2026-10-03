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

const TEMPORARY_ADVISORY_EXCEPTIONS = Object.freeze([
  Object.freeze({
    id: "GHSA-86w9-cpqp-85rv",
    source: 1240912,
    package: "node-forge",
    affectedRange: "<=1.4.0",
    lockPath: "node_modules/node-forge",
    lockedVersion: "1.4.0",
    expiresAt: "2026-10-16T00:00:00.000Z",
    propagatedHighPackages: Object.freeze({
      production: Object.freeze([
        "@expo/cli",
        "@expo/code-signing-certificates",
        "expo",
        "node-forge",
      ]),
      all: Object.freeze([
        "@expo/cli",
        "@expo/code-signing-certificates",
        "expo",
        "node-forge",
      ]),
    }),
  }),
  Object.freeze({
    id: "GHSA-vfj7-8cjw-p6xm",
    source: 1240992,
    package: "braces",
    affectedRange: "<=3.0.3",
    lockPath: "node_modules/braces",
    lockedVersion: "3.0.3",
    expiresAt: "2026-10-10T00:00:00.000Z",
    propagatedHighPackages: Object.freeze({
      production: Object.freeze([
        "@expo/cli",
        "@expo/metro",
        "@expo/metro-config",
        "@expo/metro-file-map",
        "@react-native/community-cli-plugin",
        "@react-native/metro-config",
        "@react-native/virtualized-lists",
        "braces",
        "expo",
        "metro",
        "metro-config",
        "metro-file-map",
        "metro-transform-worker",
        "micromatch",
        "react-native",
        "react-native-reanimated",
        "react-native-worklets",
      ]),
      all: Object.freeze([
        "@expo/cli",
        "@expo/metro",
        "@expo/metro-config",
        "@expo/metro-file-map",
        "@react-native/community-cli-plugin",
        "@react-native/metro-config",
        "@react-native/virtualized-lists",
        "braces",
        "chokidar",
        "expo",
        "fast-glob",
        "metro",
        "metro-config",
        "metro-file-map",
        "metro-transform-worker",
        "micromatch",
        "react-native",
        "react-native-reanimated",
        "react-native-worklets",
        "tailwindcss",
      ]),
    }),
  }),
]);

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

function packagesForTemporaryException(exception, name) {
  const packages =
    exception?.propagatedHighPackages?.[name];

  assert.ok(
    Array.isArray(packages),
    `${name}: temporary advisory exception ${exception?.id || "unknown"} has no scoped propagated package set`,
  );

  return packages;
}

function leafMatchesTemporaryException(leaf, exception) {
  return (
    leaf?.source === exception.source &&
    leaf?.name === exception.package &&
    leaf?.range === exception.affectedRange &&
    leaf?.url === `https://github.com/advisories/${exception.id}` &&
    leaf?.severity === "high"
  );
}

function validateTemporaryAdvisoryExceptions(name, report) {
  const lock = JSON.parse(fs.readFileSync("package-lock.json", "utf8"));
  const expectedPackageSet = new Set();
  const exceptionSummaries = [];

  for (const exception of TEMPORARY_ADVISORY_EXCEPTIONS) {
    const expiry = Date.parse(exception.expiresAt);
    assert.ok(
      Number.isFinite(expiry),
      `${name}: temporary advisory exception ${exception.id} expiry is invalid`,
    );
    assert.ok(
      Date.now() < expiry,
      `${name}: temporary advisory exception ${exception.id} expired at ${exception.expiresAt}`,
    );

    const lockedVersion = lock?.packages?.[exception.lockPath]?.version ?? null;
    assert.equal(
      lockedVersion,
      exception.lockedVersion,
      `${name}: ${exception.package} lock version changed; remove or reassess temporary advisory exception ${exception.id}`,
    );

    for (const packageName of packagesForTemporaryException(exception, name)) {
      expectedPackageSet.add(packageName);
    }

    exceptionSummaries.push({
      id: exception.id,
      source: exception.source,
      package: exception.package,
      affectedRange: exception.affectedRange,
      expiresAt: exception.expiresAt,
      lockedVersion,
      packages: [...packagesForTemporaryException(exception, name)].sort(),
    });
  }

  const highOrCriticalPackages = Object.entries(report?.vulnerabilities || {})
    .filter(([, entry]) => ["high", "critical"].includes(entry?.severity))
    .map(([packageName]) => packageName)
    .sort();
  const expectedPackages = [...expectedPackageSet].sort();

  assert.deepEqual(
    highOrCriticalPackages,
    expectedPackages,
    `${name}: high/critical package set changed; scoped temporary advisory exceptions cannot apply`,
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
      const matched = TEMPORARY_ADVISORY_EXCEPTIONS.some(
        (exception) =>
          packagesForTemporaryException(exception, name).includes(packageName) &&
          leafMatchesTemporaryException(leaf, exception),
      );

      assert.ok(
        matched,
        `${name}: ${packageName} includes an unapproved high/critical advisory leaf ${JSON.stringify(leaf)}`,
      );
    }
  }

  for (const exception of TEMPORARY_ADVISORY_EXCEPTIONS) {
    for (const packageName of packagesForTemporaryException(exception, name)) {
      const highLeaves = collectLeafAdvisories(packageName, report).filter((leaf) =>
        ["high", "critical"].includes(leaf.severity),
      );
      assert.ok(
        highLeaves.some((leaf) => leafMatchesTemporaryException(leaf, exception)),
        `${name}: ${packageName} no longer traces to temporary exception ${exception.id}; remove or reassess that exception`,
      );
    }
  }

  return {
    allowedHighPackageCount: expectedPackages.length,
    packages: expectedPackages,
    exceptions: exceptionSummaries,
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

const productionException = validateTemporaryAdvisoryExceptions(
  "production",
  production.report,
);
const allException = validateTemporaryAdvisoryExceptions("all", all.report);

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
      temporaryAdvisoryExceptions: TEMPORARY_ADVISORY_EXCEPTIONS,
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
console.log("SUPPLY_CHAIN_AUDIT=PASS baseline-non-regression-with-scoped-temporary-exceptions");
