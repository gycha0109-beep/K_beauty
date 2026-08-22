import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const inventoryPath = path.resolve(process.env.EVAL_R1_INVENTORY_PATH || "fixtures/persona-evaluation/eval-r1-explanation-grounding-remediation-v1.json");
const baselineP8Path = path.resolve(process.env.EVAL_R1_BASELINE_P8_PATH || "artifacts/eval-r1/p8-baseline/bounded-llm-judge-inputs-v1.json");
const candidateP8Path = path.resolve(process.env.EVAL_R1_CANDIDATE_P8_PATH || "artifacts/eval-r1/p8-candidate/bounded-llm-judge-inputs-v1.json");
const baselineP6Path = path.resolve(process.env.EVAL_R1_BASELINE_P6_PATH || "artifacts/eval-r1/p6-baseline/eval-p6-persona-snapshots-v1.json");
const candidateP6Path = path.resolve(process.env.EVAL_R1_CANDIDATE_P6_PATH || "artifacts/eval-r1/p6-candidate/eval-p6-persona-snapshots-v1.json");
const policyFixturePath = path.resolve(process.env.EVAL_R1_CANDIDATE_POLICY_FIXTURE_PATH || "fixtures/candidate-exposure-policy-isolated-canary/manifest.v1.json");
const baselinePolicyModulePath = path.resolve(process.env.EVAL_R1_BASELINE_CANDIDATE_POLICY_MODULE || "_reference/eval-r1-baseline/lib/candidate-exposure-policy.js");
const candidatePolicyModulePath = path.resolve(process.env.EVAL_R1_CANDIDATE_POLICY_MODULE || "lib/candidate-exposure-policy.js");
const artifactRoot = path.resolve(process.env.EVAL_R1_ARTIFACT_ROOT || "artifacts/eval-r1/final");
const readJson = (filePath) => readFile(filePath, "utf8").then(JSON.parse);

const [inventory, baselineP8, candidateP8, baselineP6, candidateP6, policyFixture, baselinePolicyModule, candidatePolicyModule] = await Promise.all([
  readJson(inventoryPath),
  readJson(baselineP8Path),
  readJson(candidateP8Path),
  readJson(baselineP6Path),
  readJson(candidateP6Path),
  readJson(policyFixturePath),
  import(pathToFileURL(baselinePolicyModulePath).href),
  import(pathToFileURL(candidatePolicyModulePath).href)
]);

assert.equal(inventory.stage, "EVAL-R1");
assert.equal(inventory.findings.length, 6);
assert.equal(baselineP8.case_count, 16);
assert.equal(candidateP8.case_count, 16);
assert.equal(baselineP6.persona_snapshots.length, 37);
assert.equal(candidateP6.persona_snapshots.length, 37);
assert.equal(policyFixture.schemaVersion, "candidate-exposure-policy-isolated-canary-fixture-manifest-v1");
assert.equal(policyFixture.scenarios.length, 4);
assert.equal(typeof baselinePolicyModule.evaluateCandidateExposurePolicy, "function");
assert.equal(typeof candidatePolicyModule.evaluateCandidateExposurePolicy, "function");

const baselineCases = new Map(baselineP8.cases.map((item) => [item.case_id, item]));
const candidateCases = new Map(candidateP8.cases.map((item) => [item.case_id, item]));
const explanationText = (item) => JSON.stringify(item?.recommendation_explanation || {});

for (const finding of inventory.findings) {
  const baseline = baselineCases.get(finding.p8_case_id);
  const candidate = candidateCases.get(finding.p8_case_id);
  assert(baseline, `${finding.finding_id}: baseline case`);
  assert(candidate, `${finding.finding_id}: candidate case`);
  assert.equal(baseline.persona.persona_id, finding.persona_id);
  assert.equal(candidate.persona.persona_id, finding.persona_id);
  assert(explanationText(baseline).includes(finding.problematic_output), `${finding.finding_id}: frozen P8 problematic output must reproduce on baseline`);
}

function surveyText(caseItem) {
  return (caseItem?.recommendation_explanation?.survey_evidence || []).map((item) => item.detail || "").join(" ");
}
function topReason(caseItem) {
  return String(caseItem?.recommendation_explanation?.top_pick?.reason || "");
}

const c02 = candidateCases.get("EVAL-P8-P3-C02");
const c03 = candidateCases.get("EVAL-P8-P3-C03");
const c06 = candidateCases.get("EVAL-P8-P3-C06");
const a02 = candidateCases.get("EVAL-P8-P3-A02");
const a05 = candidateCases.get("EVAL-P8-P3-A05");

assert(!topReason(c02).includes("세안 뒤 당김"), "E1 C02 comfortable must not assert post-cleansing tightness");
assert(!topReason(c03).includes("세안 뒤 당김"), "E1 C03 still_oily must not assert post-cleansing tightness");
assert(!surveyText(c03).includes("민감도가 높아"), "E5 C03 low sensitivity must not assert high sensitivity");
assert(!surveyText(c06).includes("민감도가 높아"), "E2 C06 medium sensitivity must not assert high sensitivity");
assert(!surveyText(a05).includes("민감도가 높아"), "E2 A05 medium sensitivity must not assert high sensitivity");
assert(!topReason(a02).includes("예민함이나 붉은기가 같이 잡힌"), "E7 A02 must not invent affirmative current redness from high sensitivity alone");

function deterministicViolations(caseItem) {
  const persona = caseItem.persona || {};
  const issues = [];
  const reason = topReason(caseItem);
  const evidence = surveyText(caseItem);
  if (persona.postWashFeeling !== "tight" && reason.includes("세안 뒤 당김")) issues.push("POST_WASH_TIGHTNESS_INVENTION");
  if (persona.sensitivity !== "high" && evidence.includes("민감도가 높아")) issues.push("HIGH_SENSITIVITY_OVERSTATEMENT");
  const hasDirectRedness = persona.primaryConcern === "redness" || persona.secondaryConcern === "redness" || persona.afternoonSkinChange === "red_or_irritated";
  if (!hasDirectRedness && reason.includes("붉은기가 같이 잡힌")) issues.push("CURRENT_REDNESS_INVENTION");
  return issues;
}

const p8ChangeAudit = [];
for (const [caseId, baseline] of baselineCases) {
  const candidate = candidateCases.get(caseId);
  assert(candidate, `${caseId}: candidate case`);
  assert.deepEqual(candidate.persona, baseline.persona, `${caseId}: Persona input invariant`);
  const before = explanationText(baseline);
  const after = explanationText(candidate);
  const beforeViolations = deterministicViolations(baseline);
  const afterViolations = deterministicViolations(candidate);
  if (before !== after) {
    assert(beforeViolations.length > 0 || inventory.findings.some((item) => item.p8_case_id === caseId), `${caseId}: unrelated explanation rewrite is forbidden`);
  }
  for (const violation of afterViolations) {
    assert(!beforeViolations.includes(violation), `${caseId}: known grounding violation must not survive remediation: ${violation}`);
  }
  p8ChangeAudit.push({ case_id: caseId, explanation_changed: before !== after, before_violations: beforeViolations, after_violations: afterViolations });
}

const baselineById = new Map(baselineP6.persona_snapshots.map((item) => [item.persona_id, item]));
const candidateById = new Map(candidateP6.persona_snapshots.map((item) => [item.persona_id, item]));
const presentationDerivedHashKeys = new Set(["response_hash", "explanation_hash", "candidate_policy_fingerprint"]);
const p6Changed = [];
const legacySnapshotFingerprintChanged = [];
for (const [personaId, before] of baselineById) {
  const after = candidateById.get(personaId);
  assert(after, `${personaId}: P6 candidate snapshot`);
  assert.equal(after.domain_hash, before.domain_hash, `${personaId}: domain invariant`);
  assert.equal(after.source_persona_hash, before.source_persona_hash, `${personaId}: Persona invariant`);
  assert.equal(after.harness_equivalence, true, `${personaId}: harness equivalence`);
  for (const harness of ["domain_core", "contract_integration"]) {
    assert.deepEqual(after[harness].top_ranked_ids, before[harness].top_ranked_ids, `${personaId} ${harness}: ranked IDs invariant`);
    for (const key of ["projection_hash", "ranking_hash", "score_hash", "survey_derived_hash"]) {
      assert.equal(after[harness][key], before[harness][key], `${personaId} ${harness}.${key}: Recommendation semantic invariant`);
    }
    const legacyFingerprintChanged = before[harness].candidate_policy_fingerprint !== after[harness].candidate_policy_fingerprint;
    if (legacyFingerprintChanged) {
      assert(
        before[harness].response_hash !== after[harness].response_hash || before[harness].explanation_hash !== after[harness].explanation_hash,
        `${personaId} ${harness}: legacy public-snapshot fingerprint changed without a presentation hash delta`
      );
      legacySnapshotFingerprintChanged.push(`${personaId}:${harness}`);
    }
    const changed = Object.keys(before[harness]).filter((key) => before[harness][key] !== after[harness][key] && !presentationDerivedHashKeys.has(key) && key !== "top_ranked_ids");
    assert.deepEqual(changed, [], `${personaId} ${harness}: only presentation-derived hashes may change`);
  }
  const explanationChanged = before.domain_core.explanation_hash !== after.domain_core.explanation_hash || before.contract_integration.explanation_hash !== after.contract_integration.explanation_hash;
  if (explanationChanged) p6Changed.push(personaId);
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
}

function projectCandidatePolicySemantics(result) {
  assert(result && typeof result === "object", "CandidatePolicy result must be an object");
  assert.equal(typeof result.policyVersion, "string", "CandidatePolicy policyVersion");
  assert.equal(typeof result.status, "string", "CandidatePolicy status");
  assert(Array.isArray(result.decisions), "CandidatePolicy decisions");
  const decisions = result.decisions.map((decision) => ({
    policyVersion: decision.policyVersion,
    candidateRef: decision.candidateRef,
    exposure: decision.exposure,
    reasonCodes: [...(decision.reasonCodes || [])],
    currentProductRelation: decision.currentProductRelation,
    evidenceState: decision.evidenceState,
    laneEligibility: stableValue(decision.laneEligibility || {}),
    provenance: stableValue(decision.provenance || {})
  })).sort((left, right) => String(left.candidateRef).localeCompare(String(right.candidateRef), "en"));
  return stableValue({
    policyVersion: result.policyVersion,
    status: result.status,
    decisions
  });
}

function canonicalHash(value) {
  return createHash("sha256").update(JSON.stringify(stableValue(value))).digest("hex");
}

const policySemanticCases = [];
for (const scenario of policyFixture.scenarios) {
  const input = {
    canonicalState: structuredClone(scenario.canonicalState),
    candidates: structuredClone(scenario.candidates)
  };
  const baselineResult = baselinePolicyModule.evaluateCandidateExposurePolicy(structuredClone(input));
  const candidateResult = candidatePolicyModule.evaluateCandidateExposurePolicy(structuredClone(input));
  const baselineProjection = projectCandidatePolicySemantics(baselineResult);
  const candidateProjection = projectCandidatePolicySemantics(candidateResult);
  const baselineHash = canonicalHash(baselineProjection);
  const candidateHash = canonicalHash(candidateProjection);
  assert.deepEqual(candidateProjection, baselineProjection, `${scenario.scenario}: CandidatePolicy semantic projection invariant`);
  assert.equal(candidateHash, baselineHash, `${scenario.scenario}: CandidatePolicy semantic hash invariant`);
  const observedReasonCodes = new Set(candidateProjection.decisions.flatMap((decision) => decision.reasonCodes));
  for (const expectedReasonCode of scenario.expectedReasonCodes || []) {
    assert(observedReasonCodes.has(expectedReasonCode), `${scenario.scenario}: expected CandidatePolicy reason code ${expectedReasonCode}`);
  }
  policySemanticCases.push({
    scenario: scenario.scenario,
    semantic_version: scenario.semanticVersion,
    baseline_hash: baselineHash,
    candidate_hash: candidateHash,
    semantic_delta: 0,
    projection: candidateProjection
  });
}

const selfTestSource = candidatePolicyModule.evaluateCandidateExposurePolicy({
  canonicalState: structuredClone(policyFixture.scenarios[0].canonicalState),
  candidates: structuredClone(policyFixture.scenarios[0].candidates)
});
const selfTestBaseHash = canonicalHash(projectCandidatePolicySemantics(selfTestSource));
const presentationOnlyMutation = structuredClone(selfTestSource);
presentationOnlyMutation.summary = "controlled presentation-only mutation";
presentationOnlyMutation.decisions = presentationOnlyMutation.decisions.map((decision) => ({
  ...decision,
  explanation: "controlled presentation-only mutation"
}));
assert.equal(
  canonicalHash(projectCandidatePolicySemantics(presentationOnlyMutation)),
  selfTestBaseHash,
  "V1 explanation-only mutation must not change CandidatePolicy semantic projection"
);
const policySemanticMutation = structuredClone(selfTestSource);
assert(policySemanticMutation.decisions.length > 0, "V2 requires at least one CandidatePolicy decision");
policySemanticMutation.decisions[0].exposure = policySemanticMutation.decisions[0].exposure === "hidden" ? "visible" : "hidden";
assert.notEqual(
  canonicalHash(projectCandidatePolicySemantics(policySemanticMutation)),
  selfTestBaseHash,
  "V2 actual policy semantic mutation must be detected"
);

const aggregatePolicyBaselineHash = canonicalHash(policySemanticCases.map((item) => ({ scenario: item.scenario, hash: item.baseline_hash })));
const aggregatePolicyCandidateHash = canonicalHash(policySemanticCases.map((item) => ({ scenario: item.scenario, hash: item.candidate_hash })));
assert.equal(aggregatePolicyCandidateHash, aggregatePolicyBaselineHash, "CandidatePolicy aggregate semantic delta must be zero");

const policySemanticReport = {
  schema_version: "eval-r1-candidate-policy-semantic-invariance-v1",
  stage: "EVAL-R1",
  measurement_boundary: "candidate_exposure_policy_decision_semantics",
  actual_semantic_fields: [
    "policyVersion",
    "status",
    "decisions[].policyVersion",
    "decisions[].candidateRef",
    "decisions[].exposure",
    "decisions[].reasonCodes",
    "decisions[].currentProductRelation",
    "decisions[].evidenceState",
    "decisions[].laneEligibility",
    "decisions[].provenance"
  ],
  excluded_presentation_fields: [
    "summary",
    "reason",
    "comparison_reason",
    "premiumReport",
    "surveyEvidence",
    "routine explanation",
    "UI/presentation strings"
  ],
  legacy_p6_candidate_policy_fingerprint_classification: "WHOLE_PUBLIC_SNAPSHOT_PRESENTATION_DERIVED_NOT_POLICY_SEMANTIC_AUTHORITY",
  baseline_hash: aggregatePolicyBaselineHash,
  candidate_hash: aggregatePolicyCandidateHash,
  semantic_delta: 0,
  verifier_self_tests: {
    explanation_only_projection_invariant: "PASS",
    actual_policy_semantic_delta_detected: "PASS"
  },
  cases: policySemanticCases
};

const report = {
  schema_version: "eval-r1-explanation-grounding-validation-report-v1",
  stage: "EVAL-R1",
  p8_authoritative_finding_count: inventory.findings.length,
  p8_case_count: 16,
  p8_change_audit: p8ChangeAudit,
  p6_persona_count: 37,
  p6_explanation_changed_persona_ids: p6Changed,
  p6_legacy_public_snapshot_fingerprint_changed_entries: legacySnapshotFingerprintChanged,
  candidate_policy_semantic_invariance: {
    baseline_hash: aggregatePolicyBaselineHash,
    candidate_hash: aggregatePolicyCandidateHash,
    semantic_delta: 0,
    explanation_only_self_test: "PASS",
    policy_delta_detection_self_test: "PASS"
  },
  recommendation_invariance: {
    projection_delta: 0,
    ranking_delta: 0,
    score_delta: 0,
    top_ranked_id_delta: 0,
    candidate_policy_semantic_delta: 0,
    survey_derived_delta: 0
  },
  blocking_rules: ["EXPLICIT_INPUT_CONTRADICTION", "HARD_REJECT_VIOLATION", "DETERMINISTIC_GROUNDING_INVARIANT_FAILURE", "REPRODUCIBILITY_FAILURE", "FROZEN_RECOMMENDATION_INVARIANT_FAILURE", "CANDIDATE_POLICY_SEMANTIC_DELTA"],
  review_required_rules: ["INTENTIONAL_TOP1_CHANGE", "EXPECTED_RANKING_MOVEMENT", "STYLISTIC_EXPLANATION_CHANGE", "COHORT_LEVEL_UTILITY_MOVEMENT"],
  evidence_class: "SYNTHETIC_SIMULATION_EVIDENCE",
  enforce_authority: "NONE"
};

await mkdir(artifactRoot, { recursive: true });
await Promise.all([
  writeFile(path.join(artifactRoot, "eval-r1-explanation-grounding-validation-report-v1.json"), `${JSON.stringify(report, null, 2)}\n`),
  writeFile(path.join(artifactRoot, "eval-r1-candidate-policy-semantic-invariance-v1.json"), `${JSON.stringify(policySemanticReport, null, 2)}\n`)
]);
console.log(`EVAL-R1 grounding compare PASS findings=${inventory.findings.length} p6_changed_explanations=${p6Changed.length} candidate_policy_semantic_delta=0`);
