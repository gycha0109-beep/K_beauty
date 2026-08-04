import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ledgerPath = path.join(
  root,
  "docs/architecture/candidate-policy-main-integration-path-ledger-v1.json"
);
const ledger = JSON.parse(fs.readFileSync(ledgerPath, "utf8"));
const { baseSha, sourceSha, mergeBaseSha } = ledger.compare;

let assertions = 0;
const check = (condition, message) => {
  assertions += 1;
  assert.ok(condition, message);
};

const git = (...args) =>
  execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024
  }).trim();

function readPathList(relativePath) {
  return fs
    .readFileSync(path.join(root, relativePath), "utf8")
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean);
}

const includeExact = readPathList(ledger.pathSets.includeExact);
const mergeSemantic = readPathList(ledger.pathSets.mergeSemantic);
const excludeSourceOnly = readPathList(ledger.pathSets.excludeSourceOnly);
const excludeMainPresent = ledger.pathSets.excludeMainPresent.flatMap(readPathList);
const classifiedPaths = [
  ...includeExact,
  ...mergeSemantic,
  ...excludeSourceOnly,
  ...excludeMainPresent
];

check(
  ledger.version === "candidate-policy-main-integration-path-ledger-v1",
  "ledger version must be exact"
);
check(
  ledger.status === "exhaustive_tree_diff_408_classified",
  "ledger status must record the exhaustive 408-path comparison"
);
check(ledger.compare.status === "diverged", "authority refs must be recorded as diverged");
check(ledger.compare.treeDiffPathCount === 408, "tree diff path count must remain 408");
check(ledger.compare.gitStatusCounts.sourceOnlyA === 100, "source-only count must remain 100");
check(ledger.compare.gitStatusCounts.mainOnlyD === 278, "main-only count must remain 278");
check(ledger.compare.gitStatusCounts.modifiedM === 30, "modified count must remain 30");
check(ledger.counts.total === 408, "ledger total must remain 408");
check(ledger.counts.includeExact === 62, "include-exact count must remain 62");
check(ledger.counts.mergeSemantic === 6, "semantic count must remain 6");
check(ledger.counts.excludeSourceOnly === 38, "source-only exclusion count must remain 38");
check(ledger.counts.excludeMainPresent === 302, "main-present exclusion count must remain 302");
check(ledger.counts.excludeTotal === 340, "total exclusion count must remain 340");
check(ledger.contracts.everyPathExactlyOnce === true, "every path must be classified once");
check(ledger.contracts.unknownPathCount === 0, "unknown path count must be zero");
check(ledger.contracts.duplicatePathCount === 0, "duplicate path count must be zero");

check(includeExact.length === ledger.counts.includeExact, "include-exact list count mismatch");
check(mergeSemantic.length === ledger.counts.mergeSemantic, "semantic list count mismatch");
check(
  excludeSourceOnly.length === ledger.counts.excludeSourceOnly,
  "source-only exclusion list count mismatch"
);
check(
  excludeMainPresent.length === ledger.counts.excludeMainPresent,
  "main-present exclusion list count mismatch"
);
check(classifiedPaths.length === ledger.counts.total, "classified path total mismatch");
check(
  new Set(classifiedPaths).size === classifiedPaths.length,
  "a path is classified more than once"
);

const actualMergeBase = git("merge-base", baseSha, sourceSha);
check(actualMergeBase === mergeBaseSha, "merge-base authority drift");

const [baseOnly, sourceOnly] = git(
  "rev-list",
  "--left-right",
  "--count",
  `${baseSha}...${sourceSha}`
)
  .split(/\s+/)
  .map(Number);
check(baseOnly === ledger.compare.mainAheadBy, "main ahead count drift");
check(sourceOnly === ledger.compare.sourceAheadBy, "source ahead count drift");

const actualNameStatus = git("diff", "--name-status", "--no-renames", baseSha, sourceSha)
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => {
    const [status, pathValue] = line.split("\t");
    return { status, path: pathValue };
  });
const actualStatusByPath = new Map(actualNameStatus.map((entry) => [entry.path, entry.status]));
const actualDiffPaths = actualNameStatus.map((entry) => entry.path).sort();
const ledgerPaths = [...classifiedPaths].sort();
check(actualDiffPaths.length === 408, "actual tree diff path count drift");
check(
  actualDiffPaths.length === ledgerPaths.length &&
    actualDiffPaths.every((value, index) => value === ledgerPaths[index]),
  "ledger does not exactly equal the authoritative 408-path tree diff"
);

const statusCounts = actualNameStatus.reduce(
  (counts, entry) => ({ ...counts, [entry.status]: (counts[entry.status] ?? 0) + 1 }),
  {}
);
check(statusCounts.A === 100, "actual source-only status count drift");
check(statusCounts.D === 278, "actual main-only status count drift");
check(statusCounts.M === 30, "actual modified status count drift");

for (const pathValue of includeExact) {
  check(actualStatusByPath.get(pathValue) === "A", `include-exact path is not source-only: ${pathValue}`);
  git("cat-file", "-e", `${sourceSha}:${pathValue}`);
}
for (const pathValue of mergeSemantic) {
  check(actualStatusByPath.get(pathValue) === "M", `semantic path is not modified on both sides: ${pathValue}`);
  git("cat-file", "-e", `${baseSha}:${pathValue}`);
  git("cat-file", "-e", `${sourceSha}:${pathValue}`);
}
for (const pathValue of excludeSourceOnly) {
  check(actualStatusByPath.get(pathValue) === "A", `source-only exclusion has wrong status: ${pathValue}`);
  git("cat-file", "-e", `${sourceSha}:${pathValue}`);
}
for (const pathValue of excludeMainPresent) {
  check(
    ["D", "M"].includes(actualStatusByPath.get(pathValue)),
    `main-present exclusion has wrong status: ${pathValue}`
  );
  git("cat-file", "-e", `${baseSha}:${pathValue}`);
}

const expectedSemanticPaths = [
  "app/api/analyze/route.js",
  "lib/evaluator-boundary-policy-shadow.js",
  "package-lock.json",
  "package.json",
  "scripts/run-security-closeout-verifier-suite.mjs",
  "scripts/verify-evaluator-boundary-readiness-review.mjs"
].sort();
check(
  [...mergeSemantic].sort().every((value, index) => value === expectedSemanticPaths[index]),
  "semantic merge path set drift"
);
check(
  Object.keys(ledger.semanticContracts).sort().every(
    (value, index) => value === expectedSemanticPaths[index]
  ),
  "semantic contract key set drift"
);

for (const pathValue of classifiedPaths) {
  check(
    !pathValue.startsWith("app/api/internal/candidate-exposure-policy-diagnostic/"),
    "temporary diagnostic route must not be a classified durable source path"
  );
}
for (const pathValue of excludeSourceOnly) {
  check(
    !pathValue.startsWith("lib/candidate-exposure-policy"),
    `CandidateExposurePolicy runtime path cannot be excluded: ${pathValue}`
  );
}

console.log(
  `verify-candidate-policy-main-integration-path-ledger: ok (${assertions} assertions, 408/408 paths, 62 exact + 6 semantic + 340 excluded)`
);
