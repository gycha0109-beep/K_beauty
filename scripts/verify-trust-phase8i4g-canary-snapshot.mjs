import assert from "node:assert/strict";
import fs from "node:fs";

function argValue(name) {
  const prefix = `--${name}=`;
  const arg = process.argv.slice(2).find((value) => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : null;
}

const resultPath = argValue("result");
if (!resultPath) {
  throw new Error(
    "Usage: node scripts/verify-trust-phase8i4g-canary-snapshot.mjs --result=<json>",
  );
}

const snapshot = JSON.parse(fs.readFileSync(resultPath, "utf8"));
assert.equal(
  snapshot.contract,
  "trust-phase8i4g-read-only-canary-snapshot-v1",
);
assert.equal(snapshot.phase, "8I-4G");
assert.equal(snapshot.authority, "READ_ONLY_DETECTION_NO_CONFIRMATION");
assert.equal(snapshot.automatic_confirmation, false);
assert.match(snapshot.snapshot_digest, /^[0-9a-f]{64}$/);
assert.equal(Array.isArray(snapshot.candidates), true);
assert.equal(snapshot.candidate_count, snapshot.candidates.length);

if (snapshot.candidate_count === 0) {
  assert.equal(snapshot.state, "WAITING_FOR_REAL_READY_FOR_8I4");
  assert.equal(snapshot.first_candidate_evaluation_id, null);
} else {
  assert.equal(
    snapshot.state,
    "REAL_READY_DETECTED_REQUIRES_ADMIN_PREFLIGHT",
  );
  assert.equal(
    snapshot.first_candidate_evaluation_id,
    snapshot.candidates[0].evaluation_id,
  );
  snapshot.candidates.forEach((candidate, index) => {
    assert.equal(candidate.provenance?.eligible, true);
    assert.equal(
      candidate.provenance?.kind,
      "PHASE8I3E_SCHEDULED_REAL",
    );
    assert.equal(candidate.canary_rank, index + 1);
    assert.equal(
      candidate.state,
      index === 0
        ? "REAL_READY_DETECTED_REQUIRES_ADMIN_PREFLIGHT"
        : "QUEUED_BEHIND_FIRST_REAL_CANARY",
    );
  });
}

for (const key of [
  "transport_incidents",
  "drift_cases",
  "drift_evaluations",
  "ready_for_8i4",
  "grouped_relocations",
  "grouped_sources",
  "grouped_incidents",
  "relocations",
  "product_fact_instances",
  "product_fact_current",
  "product_fact_confirmations",
  "evidence_sources",
  "evidence_subject_bindings",
  "recommendation_logs",
  "product_source_bindings",
  "official_source_reviews",
]) {
  assert.equal(typeof snapshot.counts?.[key], "number", `missing count: ${key}`);
}

process.stdout.write(
  JSON.stringify(
    {
      contract: "trust-phase8i4g-canary-snapshot-verification-v1",
      result: "PASS",
      state: snapshot.state,
      candidate_count: snapshot.candidate_count,
      first_candidate_evaluation_id:
        snapshot.first_candidate_evaluation_id,
      authority: snapshot.authority,
    },
    null,
    2,
  ) + "\n",
);
