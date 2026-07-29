import { spawnSync } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const sourcePath = path.join(root, "scripts", "verify-candidate-policy-current-findings-exact-head-local.mjs");
const diagnosticPath = path.join(root, "scripts", ".candidate-policy-current-findings-current-catalog-diagnostic.mjs");
const source = readFileSync(sourcePath, "utf8");

const hashAssertion = '  equal(audit.dataset.datasetHash, EXPECTED_DATASET_HASH, "actual catalog dataset hash");';
const statusMarker = '    status: "CANDIDATE_POLICY_CURRENT_FINDINGS_CONTRACTED_NOOP",';
const duplicateFixturePattern = /  const acneProducts = firstTwo\([\s\S]*?  \);\n  const completeSunscreen/;
const requestedOnlyPattern = /  const requestedOnly = canonical\(\{\n    requested: "acne",\n    detected: "dehydration",\n    selections: \[selection\(acneProducts\[0\]\)\]\n  \}\);/;
const pillingFixturePattern = /  const pillingOnlyMissingSunscreen = first\(\n    rows,\n    \(row\) => row\.product\.category === "sunscreen" && supportsGoal\(row, "uv"\) && !hasValue\(row\.product\.pilling_risk\),\n    "pilling-only-missing sunscreen"\n  \);/;
const neutralVisibleCountMarker = '    9,\n    "protection-complete visible sunscreen count"';

if (!source.includes(hashAssertion)) throw new Error("preserved dataset hash assertion marker missing");
if (!source.includes(statusMarker)) throw new Error("verification status marker missing");
if ((source.match(duplicateFixturePattern) || []).length !== 1) throw new Error("duplicate active fixture marker count invalid");
if ((source.match(requestedOnlyPattern) || []).length !== 1) throw new Error("requested-only fixture marker count invalid");
if ((source.match(pillingFixturePattern) || []).length !== 1) throw new Error("pilling fixture marker count invalid");
if (!source.includes(neutralVisibleCountMarker)) throw new Error("neutral sunscreen visibility marker missing");

let diagnostic = source
  .replace(
    hashAssertion,
    '  const preservedDatasetHashMatches = audit.dataset.datasetHash === EXPECTED_DATASET_HASH;'
  )
  .replace(
    statusMarker,
    '    status: preservedDatasetHashMatches\n      ? "CANDIDATE_POLICY_CURRENT_FINDINGS_CONTRACTED_NOOP"\n      : "CURRENT_CATALOG_REPLAY_PASS_PRESERVED_HASH_MISMATCH",\n    preservedDatasetHashMatches,\n    expectedDatasetHash: EXPECTED_DATASET_HASH,'
  )
  .replace(
    duplicateFixturePattern,
    `  const duplicateGoal = ["acne", "pores", "uneven_tone"].find((goal) =>
    rows.filter((row) =>
      supportsGoal(row, goal) &&
      row.profile.functionalAxes.some((axis) => ACTIVE_AXES.has(axis.axis))
    ).length >= 2
  );
  check(duplicateGoal, "duplicate active goal must exist in actual catalog");
  const acneProducts = firstTwo(
    rows,
    (row) => supportsGoal(row, duplicateGoal) &&
      row.profile.functionalAxes.some((axis) => ACTIVE_AXES.has(axis.axis)),
    "duplicate active axis"
  );
  const completeSunscreen`
  )
  .replace(
    requestedOnlyPattern,
    `  const requestedOnlyChoice = ["acne", "pores", "uneven_tone", "barrier", "redness", "oiliness", "uv"]
    .flatMap((goal) => rows
      .filter((row) => supportsGoal(row, goal) && !supportsGoal(row, "dehydration"))
      .map((row) => ({ goal, row })))
    .sort((left, right) => left.goal.localeCompare(right.goal) || left.row.id.localeCompare(right.row.id))[0];
  check(requestedOnlyChoice, "requested-only fixture must exist in actual catalog");
  const requestedOnly = canonical({
    requested: requestedOnlyChoice.goal,
    detected: "dehydration",
    selections: [selection(requestedOnlyChoice.row.product)]
  });`
  )
  .replace(
    pillingFixturePattern,
    `  const pillingVisibilityProbe = canonical({ requested: "uv", detected: "uv" });
  const pillingVisibleIds = new Set(runtime(products, pillingVisibilityProbe).visibleCandidateIds);
  const pillingOnlyMissingSunscreen = first(
    rows,
    (row) => row.product.category === "sunscreen" &&
      supportsGoal(row, "uv") &&
      !hasValue(row.product.pilling_risk) &&
      pillingVisibleIds.has(row.id),
    "pilling-only-missing visible sunscreen"
  );`
  )
  .replaceAll(
    'requested: "acne",\n    detected: "acne"',
    "requested: duplicateGoal,\n    detected: duplicateGoal"
  )
  .replace(
    'const duplicateEmpty = canonical({ requested: "acne", detected: "acne" });',
    "const duplicateEmpty = canonical({ requested: duplicateGoal, detected: duplicateGoal });"
  )
  .replace(
    neutralVisibleCountMarker,
    '    sunscreenRows.filter((row) => supportsGoal(row, "uv")).length,\n    "protection-complete visible sunscreen count"'
  );

writeFileSync(diagnosticPath, diagnostic, "utf8");
try {
  const result = spawnSync(process.execPath, [diagnosticPath], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, CI: "1", NODE_ENV: "test" },
    timeout: 180_000,
    maxBuffer: 16 * 1024 * 1024
  });
  process.stdout.write(result.stdout || "");
  process.stderr.write(result.stderr || "");
  if (result.status !== 0 || result.signal || result.error) {
    throw result.error || new Error(`current catalog diagnostic failed with status ${result.status}`);
  }
} finally {
  rmSync(diagnosticPath, { force: true });
}
