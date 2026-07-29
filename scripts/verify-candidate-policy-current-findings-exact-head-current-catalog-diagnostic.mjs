import { spawnSync } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const sourcePath = path.join(root, "scripts", "verify-candidate-policy-current-findings-exact-head-local.mjs");
const diagnosticPath = path.join(root, "scripts", ".candidate-policy-current-findings-current-catalog-diagnostic.mjs");
const source = readFileSync(sourcePath, "utf8");

const hashAssertion = '  equal(audit.dataset.datasetHash, EXPECTED_DATASET_HASH, "actual catalog dataset hash");';
const statusMarker = '    status: "CANDIDATE_POLICY_CURRENT_FINDINGS_CONTRACTED_NOOP",';

if (!source.includes(hashAssertion)) {
  throw new Error("preserved dataset hash assertion marker missing");
}
if (!source.includes(statusMarker)) {
  throw new Error("verification status marker missing");
}

const diagnostic = source
  .replace(
    hashAssertion,
    '  const preservedDatasetHashMatches = audit.dataset.datasetHash === EXPECTED_DATASET_HASH;'
  )
  .replace(
    statusMarker,
    '    status: preservedDatasetHashMatches\n      ? "CANDIDATE_POLICY_CURRENT_FINDINGS_CONTRACTED_NOOP"\n      : "CURRENT_CATALOG_REPLAY_PASS_PRESERVED_HASH_MISMATCH",\n    preservedDatasetHashMatches,\n    expectedDatasetHash: EXPECTED_DATASET_HASH,'
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
