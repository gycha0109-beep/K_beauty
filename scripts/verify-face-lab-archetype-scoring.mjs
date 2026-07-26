import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function loadModule(path, names, dependencies = {}) {
  const source = readFileSync(path, "utf8")
    .replace(/^import[\s\S]*?from\s+["'][^"']+["'];\r?\n/gm, "")
    .replace(/export const /g, "const ")
    .replace(/export function /g, "function ");
  const dependencyNames = Object.keys(dependencies);
  return Function(
    ...dependencyNames,
    `${source}\nreturn { ${names.join(", ")} };`
  )(...dependencyNames.map((name) => dependencies[name]));
}

const observationModule = loadModule(
  "lib/face-lab-observation-contract.js",
  ["FACE_LAB_OBSERVATION_DEFINITIONS"]
);

const registryModule = loadModule(
  "lib/face-lab-archetype-registry.js",
  [
    "FACE_LAB_ARCHETYPE_REGISTRY_SCHEMA_VERSION",
    "FACE_LAB_ARCHETYPE_REGISTRY_VERSION",
    "FACE_LAB_ARCHETYPE_REGISTRY",
    "validateFaceLabArchetypeRegistry"
  ],
  { FACE_LAB_OBSERVATION_DEFINITIONS: observationModule.FACE_LAB_OBSERVATION_DEFINITIONS }
);

const scoringModule = loadModule(
  "lib/face-lab-archetype-scoring.js",
  ["FACE_LAB_ARCHETYPE_SCORING_SCHEMA_VERSION", "scoreFaceLabArchetypes"],
  {
    FACE_LAB_ARCHETYPE_REGISTRY: registryModule.FACE_LAB_ARCHETYPE_REGISTRY,
    validateFaceLabArchetypeRegistry: registryModule.validateFaceLabArchetypeRegistry
  }
);

const decisionModule = loadModule(
  "lib/face-lab-archetype-decision.js",
  ["FACE_LAB_ARCHETYPE_SHADOW_SCHEMA_VERSION", "evaluateFaceLabArchetypeShadow"],
  {
    FACE_LAB_ARCHETYPE_REGISTRY: registryModule.FACE_LAB_ARCHETYPE_REGISTRY,
    validateFaceLabArchetypeRegistry: registryModule.validateFaceLabArchetypeRegistry,
    scoreFaceLabArchetypes: scoringModule.scoreFaceLabArchetypes
  }
);

function field(value, confidence = 0.9) {
  return {
    status: "available",
    source: "vision",
    confidence,
    evidence: ["fixture-visible-fact"],
    unavailableReason: null,
    value
  };
}

function makeAnalysis(overrides = {}) {
  return {
    schemaVersion: "face-lab-observation-v1",
    status: "available",
    failureReason: null,
    quality: {
      status: "available",
      source: "vision",
      confidence: 0.9,
      evidence: ["fixture-quality-fact"],
      unavailableReason: null,
      value: { structureSuitability: "suitable" }
    },
    observations: {
      outline: {
        faceShape: field("oblong"),
        jawlineAngularity: field("angular"),
        jawTaper: field("balanced"),
        cheekboneProminence: field("prominent")
      },
      vertical: { faceLengthBalance: field("long") },
      eyes: {
        eyeDirection: field("level"),
        eyeLength: field("long"),
        eyeOpenness: field("medium")
      },
      featureLayout: {
        featureScale: field("medium"),
        featureConcentration: field("spread")
      },
      visualLanguage: {
        straightCurveBalance: field("straight"),
        contourDefinition: field("defined"),
        featureContrast: field("high")
      }
    },
    ...overrides
  };
}

function withReadyPolicy(registry, policy = {}) {
  return {
    ...registry,
    lifecycle: "validated",
    calibrationStatus: "ready",
    decisionPolicy: {
      minimumEvidenceCoverage: 0,
      minimumTopScore: 0,
      minimumTopMargin: 0,
      maximumContradictions: 99,
      ...policy
    },
    archetypes: registry.archetypes.map((item) => ({
      ...item,
      lifecycle: "validated",
      calibrationStatus: "validated"
    }))
  };
}

const registryValidation = registryModule.validateFaceLabArchetypeRegistry(
  registryModule.FACE_LAB_ARCHETYPE_REGISTRY
);
assert.equal(registryValidation.ok, true, registryValidation.errors.join(","));

const positive = scoringModule.scoreFaceLabArchetypes(makeAnalysis());
assert.equal(positive.candidates[0].key, "wolf");
assert.ok(positive.candidates[0].rawScore > positive.candidates[1].rawScore);

const negativeAnalysis = makeAnalysis();
negativeAnalysis.observations.visualLanguage.straightCurveBalance = field("curved");
const negative = scoringModule.scoreFaceLabArchetypes(negativeAnalysis);
const wolfNegative = negative.candidates.find((item) => item.key === "wolf");
assert.ok(wolfNegative.negativeScore < 0);
assert.equal(wolfNegative.contradictionCount, 1);

const repeatedA = scoringModule.scoreFaceLabArchetypes(makeAnalysis());
const repeatedB = scoringModule.scoreFaceLabArchetypes(makeAnalysis());
assert.deepEqual(repeatedA, repeatedB);

for (const candidate of positive.candidates) {
  const ledgerSum = Number(candidate.ledger.reduce((sum, row) => sum + row.contribution, 0).toFixed(6));
  assert.equal(candidate.rawScore, ledgerSum);
  assert.ok(candidate.ledger.every((row) => !Object.hasOwn(row, "evidence")));
}

const firstTwo = registryModule.FACE_LAB_ARCHETYPE_REGISTRY.archetypes.slice(0, 2);
const tieRegistry = withReadyPolicy({
  ...registryModule.FACE_LAB_ARCHETYPE_REGISTRY,
  archetypes: registryModule.FACE_LAB_ARCHETYPE_REGISTRY.archetypes.map((item, index) =>
    index === 1 ? { ...item, indicators: firstTwo[0].indicators } : item
  )
}, { minimumTopMargin: 0.01 });
const tieDecision = decisionModule.evaluateFaceLabArchetypeShadow(makeAnalysis(), tieRegistry);
assert.ok(tieDecision.holdReasons.includes("low_top_margin"));

const lowScoreRegistry = withReadyPolicy(registryModule.FACE_LAB_ARCHETYPE_REGISTRY, {
  minimumTopScore: 99
});
const lowScoreDecision = decisionModule.evaluateFaceLabArchetypeShadow(makeAnalysis(), lowScoreRegistry);
assert.ok(lowScoreDecision.holdReasons.includes("low_top_score"));

const insufficient = decisionModule.evaluateFaceLabArchetypeShadow({
  status: "insufficient_evidence",
  failureReason: "quality_response_invalid",
  quality: { status: "insufficient_evidence", value: null },
  observations: {}
});
assert.ok(insufficient.holdReasons.includes("insufficient_quality"));
assert.ok(insufficient.holdReasons.includes("calibration_not_ready"));
assert.equal(insufficient.productionEligible, false);
assert.equal(insufficient.decision, null);
assert.equal(insufficient.topCandidate, null);

const zeroMatchAnalysis = makeAnalysis();
zeroMatchAnalysis.observations = {};
const zeroMatch = decisionModule.evaluateFaceLabArchetypeShadow(zeroMatchAnalysis);
assert.equal(zeroMatch.topCandidate, null);
assert.equal(zeroMatch.decision, null);

const missingEvidenceAnalysis = makeAnalysis();
missingEvidenceAnalysis.observations.eyes.eyeLength = {
  ...field("long"),
  evidence: []
};
missingEvidenceAnalysis.observations.outline.jawlineAngularity = field("moderate");
missingEvidenceAnalysis.observations.outline.cheekboneProminence = field("subtle");
missingEvidenceAnalysis.observations.featureLayout.featureScale = field("small");
const missingEvidenceDecision = decisionModule.evaluateFaceLabArchetypeShadow(missingEvidenceAnalysis);
assert.ok(missingEvidenceDecision.holdReasons.includes("missing_required_axis"));
const missingEvidenceWolf = missingEvidenceDecision.ranking.find((item) => item.key === "wolf");
assert.equal(missingEvidenceWolf.ledger.find((row) => row.path === "observations.eyes.eyeLength").contribution, 0);

const negativeWithoutEvidence = makeAnalysis();
negativeWithoutEvidence.observations.visualLanguage.straightCurveBalance = {
  ...field("curved"),
  evidence: []
};
const negativeWithoutEvidenceScore = scoringModule.scoreFaceLabArchetypes(negativeWithoutEvidence);
const wolfWithoutNegativeEvidence = negativeWithoutEvidenceScore.candidates.find((item) => item.key === "wolf");
assert.equal(wolfWithoutNegativeEvidence.negativeScore, 0);
assert.equal(wolfWithoutNegativeEvidence.contradictionCount, 0);

const malformedRegistry = {
  ...registryModule.FACE_LAB_ARCHETYPE_REGISTRY,
  archetypes: [{ key: "wolf", lifecycle: "rubric_ready", indicators: [] }]
};
const malformedValidation = registryModule.validateFaceLabArchetypeRegistry(malformedRegistry);
assert.equal(malformedValidation.ok, false);
const failClosed = decisionModule.evaluateFaceLabArchetypeShadow(makeAnalysis(), malformedRegistry);
assert.deepEqual(failClosed.holdReasons, ["taxonomy_not_ready"]);
assert.equal(failClosed.decision, null);

const defaultShadow = decisionModule.evaluateFaceLabArchetypeShadow(makeAnalysis());
assert.equal(defaultShadow.status, "held");
assert.ok(defaultShadow.holdReasons.includes("taxonomy_not_ready"));
assert.ok(defaultShadow.holdReasons.includes("calibration_not_ready"));
assert.equal(defaultShadow.productionEligible, false);
assert.equal(defaultShadow.privacy.evidenceTextCopied, false);

for (const sourcePath of [
  "lib/face-lab-archetype-registry.js",
  "lib/face-lab-archetype-scoring.js",
  "lib/face-lab-archetype-decision.js"
]) {
  const source = readFileSync(sourcePath, "utf8");
  assert.doesNotMatch(source, /new\s+RegExp|\.match\s*\(/);
  assert.doesNotMatch(source, /evidence\s*\.\s*(includes|some)\s*\([^)]*expected/i);
}

console.log("[verify-face-lab-archetype-scoring] PASS");
