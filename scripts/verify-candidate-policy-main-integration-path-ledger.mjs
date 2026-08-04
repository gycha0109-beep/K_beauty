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
    maxBuffer: 16 * 1024 * 1024
  }).trim();

check(
  ledger.version === "candidate-policy-main-integration-path-ledger-v1",
  "ledger version must be exact"
);
check(
  ledger.status === "exhaustive_tree_diff_classified",
  "ledger status must be exhaustive"
);
check(ledger.compare.status === "diverged", "authority refs must be recorded as diverged");
check(ledger.compare.treeDiffPathCount === 127, "tree diff path count must remain 127");
check(ledger.counts.total === 127, "ledger total must remain 127");
check(ledger.contracts.everyPathExactlyOnce === true, "every path must be classified once");
check(ledger.contracts.unknownPathCount === 0, "unknown path count must be zero");
check(ledger.contracts.duplicatePathCount === 0, "duplicate path count must be zero");

const entries = ledger.entries;
check(Array.isArray(entries), "ledger entries must be an array");
check(entries.length === ledger.counts.total, "entry count must equal ledger total");

const paths = entries.map((entry) => entry.path);
const uniquePaths = new Set(paths);
check(uniquePaths.size === paths.length, "ledger paths must be unique");
check(
  paths.every((value) => typeof value === "string" && value.length > 0),
  "every ledger path must be non-empty"
);
check(
  [...paths].sort().every((value, index) => value === [...uniquePaths].sort()[index]),
  "ledger path ordering comparison must be deterministic"
);

const allowedDispositions = new Set(["include_exact", "merge_semantic", "exclude"]);
const dispositionCounts = Object.fromEntries(
  [...allowedDispositions].map((value) => [value, 0])
);
for (const entry of entries) {
  check(allowedDispositions.has(entry.disposition), `invalid disposition: ${entry.path}`);
  dispositionCounts[entry.disposition] += 1;
  check(typeof entry.reasonCode === "string" && entry.reasonCode.length > 0, `missing reason: ${entry.path}`);
  check(
    typeof entry.finalTreeContract === "string" && entry.finalTreeContract.length > 0,
    `missing final-tree contract: ${entry.path}`
  );
}
check(
  dispositionCounts.include_exact === ledger.counts.include_exact,
  "include_exact count mismatch"
);
check(
  dispositionCounts.merge_semantic === ledger.counts.merge_semantic,
  "merge_semantic count mismatch"
);
check(
  dispositionCounts.exclude === ledger.counts.exclude,
  "exclude count mismatch"
);
check(dispositionCounts.include_exact === 62, "include_exact count must remain 62");
check(dispositionCounts.merge_semantic === 6, "merge_semantic count must remain 6");
check(dispositionCounts.exclude === 59, "exclude count must remain 59");

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

const actualDiffPaths = git("diff", "--name-only", baseSha, sourceSha)
  .split(/\r?\n/)
  .filter(Boolean)
  .sort();
const ledgerPaths = [...paths].sort();
check(actualDiffPaths.length === 127, "actual tree diff path count drift");
check(
  actualDiffPaths.length === ledgerPaths.length &&
    actualDiffPaths.every((value, index) => value === ledgerPaths[index]),
  "ledger does not exactly equal the authoritative tree diff"
);

const semanticPaths = entries
  .filter((entry) => entry.disposition === "merge_semantic")
  .map((entry) => entry.path)
  .sort();
const expectedSemanticPaths = [
  "app/api/analyze/route.js",
  "lib/evaluator-boundary-policy-shadow.js",
  "package-lock.json",
  "package.json",
  "scripts/run-security-closeout-verifier-suite.mjs",
  "scripts/verify-evaluator-boundary-readiness-review.mjs"
].sort();
check(
  semanticPaths.length === expectedSemanticPaths.length &&
    semanticPaths.every((value, index) => value === expectedSemanticPaths[index]),
  "semantic merge path set drift"
);

for (const entry of entries.filter((item) => item.disposition === "include_exact")) {
  git("cat-file", "-e", `${sourceSha}:${entry.path}`);
}
for (const entry of entries.filter((item) => item.disposition === "exclude")) {
  if (entry.path.startsWith("lib/candidate-exposure-policy")) {
    throw new Error(`candidate runtime path cannot be excluded: ${entry.path}`);
  }
}

console.log(
  `verify-candidate-policy-main-integration-path-ledger: ok (${assertions} assertions, 127/127 paths)`
);
