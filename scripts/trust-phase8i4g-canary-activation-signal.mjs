import fs from "node:fs";
import { pathToFileURL } from "node:url";

function argValue(name) {
  const prefix = `--${name}=`;
  const arg = process.argv.slice(2).find((value) => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : null;
}

function githubEscape(value) {
  return String(value ?? "")
    .replaceAll("%", "%25")
    .replaceAll("\r", "%0D")
    .replaceAll("\n", "%0A")
    .replaceAll(":", "%3A")
    .replaceAll(",", "%2C");
}

export function buildCanaryActivationSignal(snapshot) {
  if (
    snapshot?.contract !== "trust-phase8i4g-read-only-canary-snapshot-v1" ||
    snapshot?.phase !== "8I-4G" ||
    snapshot?.authority !== "READ_ONLY_DETECTION_NO_CONFIRMATION" ||
    snapshot?.automatic_confirmation !== false
  ) {
    throw new Error("TRUST_PHASE8I4G_ACTIVATION_SNAPSHOT_INVALID");
  }

  const first =
    snapshot.candidate_count > 0 && Array.isArray(snapshot.candidates)
      ? snapshot.candidates[0]
      : null;
  const detected =
    snapshot.state === "REAL_READY_DETECTED_REQUIRES_ADMIN_PREFLIGHT" &&
    first?.canary_rank === 1;

  return {
    contract: "trust-phase8i4g-canary-activation-signal-v1",
    state: detected
      ? "FIRST_REAL_CANARY_ADMIN_ATTENTION_REQUIRED"
      : "WAITING_FOR_REAL_READY_FOR_8I4",
    authority: "READ_ONLY_SIGNAL_NO_PREFLIGHT_NO_CONFIRMATION",
    automatic_confirmation: false,
    snapshot_digest: snapshot.snapshot_digest,
    candidate_count: snapshot.candidate_count,
    first_candidate_evaluation_id: detected
      ? first.evaluation_id
      : null,
    first_candidate_case_id: detected ? first.case_id : null,
    historical_source_count: detected
      ? first.historical_source_ids?.length ?? 0
      : 0,
    incident_count: detected ? first.incident_ids?.length ?? 0 : 0,
  };
}

function emitGithubWarning(signal) {
  if (
    signal.state !== "FIRST_REAL_CANARY_ADMIN_ATTENTION_REQUIRED" ||
    process.env.GITHUB_ACTIONS !== "true"
  ) {
    return;
  }
  const message = [
    "first scheduled real READY_FOR_8I4 detected",
    `evaluation=${signal.first_candidate_evaluation_id}`,
    `case=${signal.first_candidate_case_id}`,
    `sources=${signal.historical_source_count}`,
    `incidents=${signal.incident_count}`,
    `snapshot=${signal.snapshot_digest}`,
    "Admin preflight and explicit human confirmation are still required",
  ].join(" | ");
  process.stdout.write(
    `::warning title=Phase 8I-4G First Real Canary Detected::${githubEscape(message)}\n`,
  );
}

function main() {
  const snapshotPath = argValue("snapshot");
  if (!snapshotPath) {
    throw new Error(
      "Usage: node scripts/trust-phase8i4g-canary-activation-signal.mjs --snapshot=<json>",
    );
  }
  const snapshot = JSON.parse(fs.readFileSync(snapshotPath, "utf8"));
  const signal = buildCanaryActivationSignal(snapshot);
  emitGithubWarning(signal);
  process.stdout.write(JSON.stringify(signal, null, 2) + "\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
