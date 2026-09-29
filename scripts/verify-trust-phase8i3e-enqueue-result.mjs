import assert from "node:assert/strict";
import fs from "node:fs";

function argValue(name) {
  const prefix = "--" + name + "=";
  const arg = process.argv.slice(2).find((value) => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : null;
}

const resultPath = argValue("result");
if (!resultPath) {
  throw new Error(
    "Usage: node scripts/verify-trust-phase8i3e-enqueue-result.mjs --result=<json>",
  );
}

const result = JSON.parse(fs.readFileSync(resultPath, "utf8"));
assert.equal(result.contract, "trust-phase8i3-drift-case-enqueue-result-v1");

for (const key of [
  "candidate_count",
  "new_case_count",
  "existing_case_count",
  "new_link_count",
  "new_reentry_event_count",
  "blocked_count",
]) {
  assert.equal(Number.isInteger(result[key]), true, key + " must be an integer");
  assert.ok(result[key] >= 0, key + " must be non-negative");
}

assert.equal(result.authority_mutation, false);
assert.equal(result.current_invalidated, false);
assert.equal(
  result.new_case_count + result.existing_case_count,
  result.candidate_count,
);

const summary = {
  contract: "trust-phase8i3e-enqueue-result-verification-v1",
  result: "PASS",
  candidate_count: result.candidate_count,
  new_case_count: result.new_case_count,
  existing_case_count: result.existing_case_count,
  new_link_count: result.new_link_count,
  new_reentry_event_count: result.new_reentry_event_count,
  blocked_count: result.blocked_count,
  authority_mutation: result.authority_mutation,
  current_invalidated: result.current_invalidated,
};
process.stdout.write(JSON.stringify(summary, null, 2) + "\n");
