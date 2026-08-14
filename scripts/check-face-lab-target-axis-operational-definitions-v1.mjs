import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  FACE_LAB_TARGET_AXIS_OPERATIONAL_DEFINITION_CONTRACT,
  TARGET_AXIS_OPERATIONAL_DEFINITION_CONTRACT_VERSION,
  canonicalizeTargetAxisOperationalDefinitionContract,
  projectTargetAxisDefinitionsForReviewer,
  validateTargetAxisOperationalDefinitionContract
} from "../packages/face-contracts/src/archetype-human-evaluation/target-axis-operational-definitions.js";
import {
  ARCHETYPE_STRESS_FEATURE_CUE_REGISTRY
} from "../packages/face-contracts/src/synthetic-generation/generation-spec.js";
import * as faceContractsRoot from "../packages/face-contracts/src/index.js";
import { FACE_LAB_ARCHETYPE_REGISTRY } from "../lib/face-lab-archetype-registry.js";
import {
  CANONICAL_OBSERVATION_SNAPSHOT,
  OBSERVATION_PROMPT_DIGEST,
  OBSERVATION_SEMANTIC_EXPORT,
  OBSERVATION_SEMANTIC_EXPORT_DIGEST
} from "../tools/synthetic-evaluation/src/observation/snapshot/canonical-v1.js";
import {
  sha256Hex,
  stableStringify
} from "../tools/synthetic-evaluation/src/generation/canonicalize-generation-spec.js";

const FREEZE_PATH = "evidence/facelab/archetype-stress-target-axis-definition-freeze-v1.json";
const freeze = JSON.parse(readFileSync(FREEZE_PATH, "utf8"));
const contract = FACE_LAB_TARGET_AXIS_OPERATIONAL_DEFINITION_CONTRACT;
const expectedAxes = [
  "observations.outline.faceShape",
  "observations.outline.jawlineAngularity",
  "observations.vertical.faceLengthBalance",
  "observations.eyes.eyeDirection",
  "observations.eyes.eyeLength",
  "observations.eyes.eyeOpenness",
  "observations.featureLayout.featureScale",
  "observations.featureLayout.featureConcentration",
  "observations.visualLanguage.straightCurveBalance",
  "observations.visualLanguage.contourDefinition",
  "observations.visualLanguage.featureContrast"
];
const expectedD2c = {
  d1PhaseADigest: "2abde98d4682de4772d214df74d66d8c20a330cbead7ab553256e06cbb060e14",
  d1AuditDigest: "32c0467af4cbd588a3d5cf3330d1ff55b139bd63aa9fd4914cda0009265c7302",
  d2cMatrixDigest: "d6ca9fb61d7450d0d3dd0602d26c6473363e956e3081ef95b97b2ce67c3c51fe",
  d2cProposalDigest: "4fb8cd3278650a4472476337e4c1772ebbb47f89a6e951ed190568e87c09cfa6",
  d2cAuditDigest: "e52fb4364e1a83f2b15f3dd6275cf5534a7699370ffe8452532acb709b7a9dd9"
};
const axisKey = (path) => path.split(".").at(-1);
const getObservationValues = (path) => {
  const [, group, field] = path.split(".");
  return OBSERVATION_SEMANTIC_EXPORT.face.definitions[group]?.[field];
};
const reviewerText = (value) => JSON.stringify(value);
const forbiddenTarget = /\b(?:wolf|cat|puppy|deer|tofu|potato|dino)\b/i;
const suspiciousThreshold = /\bdegrees?\b|%|\bratio\s*[<>]|\b0\.\d+\s*cutoff\b|\b(?:mm|cm)\b/i;
const populationNorm = /Korean average|Asian average|male average|female average|beauty ideal|attractiveness|\brace\b|\bethnicity\b/i;

assert.deepEqual(validateTargetAxisOperationalDefinitionContract(contract), { ok: true, errors: [] });
assert.equal(
  faceContractsRoot.FACE_LAB_TARGET_AXIS_OPERATIONAL_DEFINITION_CONTRACT,
  contract,
  "face-contracts root export missing"
);
assert.equal(
  sha256Hex(canonicalizeTargetAxisOperationalDefinitionContract(contract)),
  contract.contractDigest,
  "contract digest mismatch"
);
assert.equal(contract.contractVersion, TARGET_AXIS_OPERATIONAL_DEFINITION_CONTRACT_VERSION);
assert.deepEqual(contract.productionConsumption, { observation: false, generation: false, scoring: false });
assert.deepEqual(contract.axes.map((item) => item.axisPath), expectedAxes);

for (const item of contract.axes) {
  const generationValues = ARCHETYPE_STRESS_FEATURE_CUE_REGISTRY[axisKey(item.axisPath)];
  const observationValues = getObservationValues(item.axisPath);
  assert.deepEqual(item.currentEnumValues, generationValues, `generation enum drift:${item.axisPath}`);
  assert.deepEqual(item.currentEnumValues, observationValues, `observation enum drift:${item.axisPath}`);
  assert.deepEqual(Object.keys(item.valueDefinitions), item.currentEnumValues);
  assert.equal(item.currentEnumValues.every((token) => item.valueDefinitions[token].trim().length > 0), true);
  if (item.disposition === "DECOMPOSITION_REQUIRED_BEFORE_DIRECT_USE") {
    assert.equal(item.validationStatus, "NOT_READY_REQUIRES_DECOMPOSITION");
  } else {
    assert.equal(item.neighborContrasts.length, item.currentEnumValues.length - 1, `neighbor contrast gap:${item.axisPath}`);
  }
  assert.equal(item.ambiguityRules.length > 0, true, `ambiguity rule missing:${item.axisPath}`);
  if (item.disposition !== "DECOMPOSITION_REQUIRED_BEFORE_DIRECT_USE") {
    assert.equal(item.ambiguityRules.some((rule) => /uncertain/i.test(rule)), true, `uncertain missing:${item.axisPath}`);
  } else {
    assert.equal(item.ambiguityRules.some((rule) => /not_assessable/i.test(rule)), true, `decomposition handling missing:${item.axisPath}`);
  }
  assert.equal(item.notAssessableConditions.length > 0, true, `not-assessable missing:${item.axisPath}`);
  assert.equal(item.generationTokenParity, "exact");
  assert.equal(item.generationOperationalParity, "UNVALIDATED");
  assert.equal(item.currentProductionObserverConsumesDefinition, false);

  const uses = FACE_LAB_ARCHETYPE_REGISTRY.archetypes.flatMap((archetype) =>
    archetype.indicators.filter((indicator) => indicator.path === item.axisPath)
  );
  assert.equal(uses.length > 0, true, `rubric dependency missing:${item.axisPath}`);
  const positive = uses.some((entry) => entry.polarity === 1);
  const negative = uses.some((entry) => entry.polarity === -1);
  const leverage = positive && negative
    ? "MIXED"
    : uses.some((entry) => entry.required)
      ? "REQUIRED_FOR_ONE_OR_MORE_TARGETS"
      : "OPTIONAL_ONLY";
  assert.equal(item.rubricDependency.leverage, leverage, `rubric leverage drift:${item.axisPath}`);
}

const projectionA = projectTargetAxisDefinitionsForReviewer(contract);
const projectionB = projectTargetAxisDefinitionsForReviewer(contract);
assert.ok(projectionA);
assert.equal(stableStringify(projectionA), stableStringify(projectionB), "reviewer projection is not deterministic");
const projected = reviewerText(projectionA);
assert.doesNotMatch(projected, forbiddenTarget);
assert.doesNotMatch(projected, suspiciousThreshold);
assert.doesNotMatch(projected, populationNorm);
for (const forbiddenKey of [
  "rubricDependency", "generationTokenParity", "generationOperationalParity", "generationParityNote",
  "currentProductionObserverConsumesDefinition", "historicalObserverDefinitionVersion", "contractDigest"
]) {
  assert.equal(projected.includes(`\"${forbiddenKey}\"`), false, `reviewer projection leaked ${forbiddenKey}`);
}

assert.equal(freeze.schemaVersion, "face-lab-target-axis-operational-definition-freeze-v1");
assert.equal(freeze.contractVersion, contract.contractVersion);
assert.equal(freeze.status, "evaluation_ready_not_production_active");
assert.equal(freeze.contractDigest, contract.contractDigest);
assert.equal(freeze.axisCount, 11);
assert.deepEqual(freeze.productionConsumption, { observation: false, generation: false, scoring: false });
assert.equal(freeze.w2Status, "locked");
assert.equal(freeze.authority.d2cProposalHistoricalStatus, "PROPOSAL_ONLY");
for (const [key, digest] of Object.entries(expectedD2c)) assert.equal(freeze.authority[key], digest, `${key} drift`);

const dispositionCounts = Object.fromEntries(
  Object.keys(freeze.axisDispositionSummary).map((disposition) => [
    disposition,
    contract.axes.filter((item) => item.disposition === disposition).length
  ])
);
assert.deepEqual(dispositionCounts, freeze.axisDispositionSummary);
assert.deepEqual(
  contract.axes.filter((item) => item.validationStatus === "READY_FOR_BLIND_HUMAN_CUE_AUDIT").map((item) => item.axisPath),
  freeze.humanAuditReadyAxes
);
assert.deepEqual(
  contract.axes.filter((item) => item.validationStatus === "NOT_READY_REQUIRES_DECOMPOSITION").map((item) => item.axisPath),
  freeze.decompositionRequiredAxes
);
assert.deepEqual(
  contract.axes.filter((item) => item.validationStatus === "NOT_READY_REQUIRES_VALIDATION").map((item) => item.axisPath),
  freeze.validationRequiredAxes
);

const freezeSemantic = structuredClone(freeze);
delete freezeSemantic.freezeDigest;
assert.equal(sha256Hex(stableStringify(freezeSemantic)), freeze.freezeDigest, "freeze digest mismatch");
assert.equal(freeze.coreBehaviorAuthority.observationPromptDigest, OBSERVATION_PROMPT_DIGEST);
assert.equal(freeze.coreBehaviorAuthority.observationSemanticExportDigest, OBSERVATION_SEMANTIC_EXPORT_DIGEST);
assert.equal(freeze.coreBehaviorAuthority.observationSnapshotDigest, CANONICAL_OBSERVATION_SNAPSHOT.snapshotDigest);

const mutated = structuredClone(contract);
mutated.unexpected = true;
assert.equal(validateTargetAxisOperationalDefinitionContract(mutated).ok, false, "unknown contract key must fail closed");
const badEnum = structuredClone(contract);
badEnum.axes[0].currentEnumValues[0] = "unknown";
assert.equal(validateTargetAxisOperationalDefinitionContract(badEnum).ok, false, "enum mutation must fail closed");

const firstBuild = Buffer.from(`${stableStringify(contract)}\n${stableStringify(freeze)}\n`);
const secondBuild = Buffer.from(`${stableStringify(contract)}\n${stableStringify(freeze)}\n`);
assert.equal(firstBuild.equals(secondBuild), true, "freeze build is not byte-identical");

console.log(JSON.stringify({
  status: "PASS",
  contractVersion: contract.contractVersion,
  contractDigest: contract.contractDigest,
  freezeDigest: freeze.freezeDigest,
  axes: contract.axes.length,
  reviewerSafeProjectionDigest: createHash("sha256").update(stableStringify(projectionA)).digest("hex"),
  readyAxes: freeze.humanAuditReadyAxes.length,
  decompositionRequiredAxes: freeze.decompositionRequiredAxes.length,
  validationRequiredAxes: freeze.validationRequiredAxes.length,
  providerCalls: 0,
  humanJudgments: 0,
  productionConsumption: freeze.productionConsumption,
  w2Status: "W2_REMAINS_LOCKED"
}, null, 2));
