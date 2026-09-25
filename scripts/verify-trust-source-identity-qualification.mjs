import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {
  IDENTITY_QUALIFICATION_CONTRACT,
  IDENTITY_QUALIFICATION_STATES,
  qualificationDigest,
  qualifyOfficialSourceIdentity,
  stableQualificationJson,
} from "../lib/trust/official-source-identity-qualification.mjs";
import {
  QUALIFICATION_BATCH_CONTRACT,
  buildQualificationObservation,
  runQualificationBatch,
} from "./trust-source-identity-qualification.mjs";

const fixture = JSON.parse(
  await fs.readFile("fixtures/trust-phase8h-source-identity-qualification-v1.json", "utf8")
);

assert.equal(fixture.contract, "trust-phase8h-source-identity-qualification-fixtures-v1");
assert.equal(fixture.base.contract, IDENTITY_QUALIFICATION_CONTRACT);
assert.deepEqual(IDENTITY_QUALIFICATION_STATES, [
  "QUALIFIED_EXACT",
  "AMBIGUOUS_IDENTITY",
  "WRONG_PRODUCT",
  "WRONG_MARKET",
  "WRONG_VARIANT",
  "WRONG_FORMULATION",
  "ANCHOR_MISSING",
  "UNSUPPORTED_SEMANTICS",
  "TRANSIENT_FAILURE",
  "SOURCE_BLOCKED",
]);

function deepMerge(base, patch) {
  if (patch === null || typeof patch !== "object" || Array.isArray(patch)) return patch;
  const out = { ...(base && typeof base === "object" && !Array.isArray(base) ? base : {}) };
  for (const [key, value] of Object.entries(patch)) {
    out[key] = value && typeof value === "object" && !Array.isArray(value)
      ? deepMerge(out[key], value)
      : value;
  }
  return out;
}

for (const testCase of fixture.cases) {
  const input = deepMerge(fixture.base, testCase.patch);
  input.case_id = testCase.case_id;
  const result = qualifyOfficialSourceIdentity(input);
  assert.equal(result.disposition, testCase.expected, `${testCase.case_id} disposition`);
  assert.equal(result.mutation_policy, "READ_ONLY_NO_PRODUCTION_WRITE");
  assert.match(result.qualification_digest, /^[a-f0-9]{64}$/);
}

const exactA = qualifyOfficialSourceIdentity(fixture.base);
const exactB = qualifyOfficialSourceIdentity(JSON.parse(JSON.stringify(fixture.base)));
assert.equal(exactA.disposition, "QUALIFIED_EXACT");
assert.equal(exactA.qualification_digest, exactB.qualification_digest);
const observedDigestA = qualifyOfficialSourceIdentity({
  ...fixture.base,
  observation: { ...fixture.base.observation, content_digest: "a".repeat(64) },
});
const observedDigestB = qualifyOfficialSourceIdentity({
  ...fixture.base,
  observation: { ...fixture.base.observation, content_digest: "b".repeat(64) },
});
assert.notEqual(
  observedDigestA.qualification_digest,
  observedDigestB.qualification_digest,
  "qualification digest must change when observed source bytes change"
);
assert.equal(
  qualificationDigest({ b: 2, a: 1 }),
  qualificationDigest({ a: 1, b: 2 }),
  "qualification digest must use stable key ordering"
);
assert.equal(stableQualificationJson({ b: 2, a: 1 }), '{"a":1,"b":2}');

const html = Buffer.from(`<!doctype html>
<html>
<head>
<title>Niacinamide 20% Serum 30ml – Derma Factory</title>
<link rel="canonical" href="https://dermafactory.net/products/niacinamide-20-serum-30ml">
<style>.hidden{display:none}</style>
</head>
<body>
<h1>Niacinamide 20% Serum 30ml</h1>
<p>Available in Korea &amp; U.S.</p>
<script>window.secret = "must-not-be-observation-text"</script>
</body>
</html>`);
const parsed = buildQualificationObservation(
  html,
  "https://dermafactory.net/products/niacinamide-20-serum-30ml",
  "text/html"
);
assert.equal(parsed.ok, true);
assert.equal(parsed.title, "Niacinamide 20% Serum 30ml – Derma Factory");
assert.equal(parsed.canonical_url, "https://dermafactory.net/products/niacinamide-20-serum-30ml");
assert.ok(parsed.text.includes("Available in Korea & U.S."));
assert.equal(parsed.text.includes("must-not-be-observation-text"), false);
assert.match(parsed.content_digest, /^[a-f0-9]{64}$/);

const batchCases = [
  { ...fixture.base, case_id: "batch-exact" },
  {
    ...fixture.base,
    case_id: "batch-transient",
    candidate: { ...fixture.base.candidate, candidate_locator: "https://dermafactory.net/transient" },
  },
];
const batch = {
  contract: QUALIFICATION_BATCH_CONTRACT,
  case_count: batchCases.length,
  cases: batchCases,
};
const batchResult = await runQualificationBatch(batch, {
  concurrency: 2,
  observedAt: () => "2026-09-25T00:00:00.000Z",
  observe: async (locator) => locator.endsWith("/transient")
    ? { ok: false, error: "TRANSIENT_FAILURE:http_429" }
    : fixture.base.observation,
});
assert.equal(batchResult.case_count, 2);
assert.equal(batchResult.counts.QUALIFIED_EXACT, 1);
assert.equal(batchResult.counts.TRANSIENT_FAILURE, 1);
assert.equal(batchResult.mutation_policy, "READ_ONLY_NO_PRODUCTION_WRITE");
assert.equal(batchResult.authority, "QUALIFICATION_EVIDENCE_ONLY_NOT_RELOCATION_AUTHORITY");

const implementationPaths = [
  "lib/trust/official-source-identity-qualification.mjs",
  "scripts/trust-source-identity-qualification.mjs",
];
for (const path of implementationPaths) {
  const implementation = await fs.readFile(path, "utf8");
  for (const forbidden of [
    "createClient(",
    ".rpc(",
    ".insert(",
    ".upsert(",
    ".delete(",
    "apply_migration",
  ]) {
    assert.equal(implementation.includes(forbidden), false, `${path} must stay read-only: ${forbidden}`);
  }
  assert.equal(["@supabase/", "supabase-js", "SUPABASE_"].some((token) => implementation.includes(token)), false, `${path} must not depend on Supabase runtime`);
}

const engine = await fs.readFile("lib/trust/official-source-identity-qualification.mjs", "utf8");
for (const forbidden of [
  "f5eb21f8-4829-4c9b-b927-ccdfb43cdd1b",
  "Derma Factory",
  "Beauty of Joseon",
  "beautyofjoseon.com",
  "dermafactory.net",
]) {
  assert.equal(engine.includes(forbidden), false, `qualification engine must not branch on canary data: ${forbidden}`);
}

const liveSummary = JSON.parse(
  await fs.readFile("docs/evidence/trust-phase8h-source-identity-qualification-live-summary-v1.json", "utf8")
);
assert.equal(liveSummary.contract, "trust-phase8h-source-identity-qualification-live-summary-v1");
assert.equal(liveSummary.qualification_contract, IDENTITY_QUALIFICATION_CONTRACT);
assert.equal(liveSummary.case_count, 5);
assert.equal(liveSummary.counts.QUALIFIED_EXACT, 1);
assert.equal(liveSummary.counts.AMBIGUOUS_IDENTITY, 4);
assert.equal(liveSummary.mutation_policy, "READ_ONLY_NO_PRODUCTION_WRITE");
assert.equal(liveSummary.qualified_exact.length, 1);
assert.equal(liveSummary.qualified_exact[0].disposition, "QUALIFIED_EXACT");
assert.match(liveSummary.qualified_exact[0].qualification_digest, /^[a-f0-9]{64}$/);
assert.equal(liveSummary.held_redirects.length, 4);
assert.ok(liveSummary.held_redirects.every((row) => row.disposition === "AMBIGUOUS_IDENTITY"));

console.log("TRUST_PHASE8H_SOURCE_IDENTITY_QUALIFICATION_VERIFIED");
