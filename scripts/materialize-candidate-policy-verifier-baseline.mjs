import path from "node:path";
import {
  CANDIDATE_POLICY_BASELINE_VERSION,
  materializeCandidatePolicyVerifierBaseline
} from "./lib/candidate-policy-verifier-baseline.mjs";
import { resolveCliDirectory } from "./lib/verifier-cli-options.mjs";

const root = process.cwd();
const workspace = resolveCliDirectory(
  "--output-dir",
  path.join(root, "tmp")
);
const result = materializeCandidatePolicyVerifierBaseline({
  root,
  workspace,
  includeHintReceiver: true,
  legacyRepositoryLayout: true
});

console.log("candidate-policy-verifier-baseline materialized");
console.log(JSON.stringify({
  version: CANDIDATE_POLICY_BASELINE_VERSION,
  captureFiles: result.captureFiles,
  outputFiles: result.outputFiles,
  semanticHashes: result.semanticHashes,
  producerCount: result.runs.length
}, null, 2));
