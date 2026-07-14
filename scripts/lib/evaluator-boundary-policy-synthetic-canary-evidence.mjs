import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export const SYNTHETIC_CANARY_RUN_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
export const SYNTHETIC_CANARY_EVIDENCE_FILE = "evaluator-boundary-policy-synthetic-canary-probe.json";
export const SYNTHETIC_CANARY_EVIDENCE_ROOT = path.join(
  process.cwd(),
  "tmp",
  "evaluator-boundary-policy-synthetic-canary-runs"
);

export function assertValidSyntheticCanaryRunId(runId) {
  if (typeof runId !== "string" || !SYNTHETIC_CANARY_RUN_ID_PATTERN.test(runId)) {
    throw new Error("invalid_synthetic_canary_run_id");
  }
  return runId;
}

export function resolveSyntheticCanaryEvidencePath(runId, outputRoot = SYNTHETIC_CANARY_EVIDENCE_ROOT) {
  const safeRunId = assertValidSyntheticCanaryRunId(runId);
  const root = path.resolve(outputRoot);
  const evidencePath = path.resolve(root, safeRunId, SYNTHETIC_CANARY_EVIDENCE_FILE);
  if (!evidencePath.startsWith(`${root}${path.sep}`)) throw new Error("synthetic_canary_path_escape");
  return evidencePath;
}

export async function writeSyntheticCanaryEvidenceExclusive({ runId, evidence, outputRoot } = {}) {
  const evidencePath = resolveSyntheticCanaryEvidencePath(runId, outputRoot);
  await mkdir(path.dirname(evidencePath), { recursive: true });
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx"
  });
  return evidencePath;
}
