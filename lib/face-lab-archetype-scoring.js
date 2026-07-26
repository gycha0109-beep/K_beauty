import {
  FACE_LAB_ARCHETYPE_REGISTRY,
  validateFaceLabArchetypeRegistry
} from "./face-lab-archetype-registry.js";

export const FACE_LAB_ARCHETYPE_SCORING_SCHEMA_VERSION = "face-lab-archetype-scoring-v1";

function clampUnit(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(1, Math.max(0, numeric));
}

function round(value) {
  return Number((Number(value) || 0).toFixed(6));
}

function resolveField(analysis, path) {
  const parts = typeof path === "string" ? path.split(".") : [];
  let current = analysis;
  for (const part of parts) {
    if (!current || typeof current !== "object") return null;
    current = current[part];
  }
  return current && typeof current === "object" ? current : null;
}

function hasExpectedValue(value, expectedValues) {
  if (Array.isArray(value)) {
    return value.some((item) => expectedValues.includes(item));
  }
  return expectedValues.includes(value);
}

function isFieldUsable(field, evidenceRequired) {
  if (field?.status !== "available") return false;
  if (field.value === null || field.value === undefined) return false;
  if (!evidenceRequired) return true;
  return Array.isArray(field.evidence) && field.evidence.some((item) => typeof item === "string" && item.trim());
}

function scoreIndicator(analysis, entry, qualityMultiplier) {
  const field = resolveField(analysis, entry.path);
  const usable = isFieldUsable(field, entry.evidenceRequired);
  const matched = usable && hasExpectedValue(field.value, entry.expectedValues);
  const fieldConfidence = usable ? clampUnit(field.confidence) : 0;
  const evidenceCount = usable
    ? field.evidence.filter((item) => typeof item === "string" && item.trim()).length
    : 0;
  const contribution = matched
    ? round(entry.weight * fieldConfidence * qualityMultiplier * entry.polarity)
    : 0;

  return {
    path: entry.path,
    polarity: entry.polarity,
    weight: entry.weight,
    required: entry.required,
    fieldStatus: field?.status || "missing",
    evidenceAvailable: usable,
    matched,
    fieldConfidence,
    qualityMultiplier,
    evidenceCount,
    contribution
  };
}

function scoreArchetype(analysis, item, qualityMultiplier) {
  const ledger = item.indicators.map((entry) => scoreIndicator(analysis, entry, qualityMultiplier));
  const rawScore = round(ledger.reduce((sum, row) => sum + row.contribution, 0));
  const positiveScore = round(ledger.filter((row) => row.contribution > 0)
    .reduce((sum, row) => sum + row.contribution, 0));
  const negativeScore = round(ledger.filter((row) => row.contribution < 0)
    .reduce((sum, row) => sum + row.contribution, 0));
  const positiveWeight = ledger.filter((row) => row.polarity === 1)
    .reduce((sum, row) => sum + row.weight, 0);
  const evidencedPositiveWeight = ledger.filter((row) => row.polarity === 1 && row.evidenceAvailable)
    .reduce((sum, row) => sum + row.weight, 0);
  const evidenceCoverage = positiveWeight > 0 ? round(evidencedPositiveWeight / positiveWeight) : 0;
  const missingRequiredPaths = ledger
    .filter((row) => row.required && !row.evidenceAvailable)
    .map((row) => row.path);
  const contradictionCount = ledger.filter((row) => row.polarity === -1 && row.matched).length;

  return {
    key: item.key,
    lifecycle: item.lifecycle,
    calibrationStatus: item.calibrationStatus,
    rawScore,
    positiveScore,
    negativeScore,
    evidenceCoverage,
    missingRequiredPaths: [...new Set(missingRequiredPaths)],
    contradictionCount,
    ledger
  };
}

export function scoreFaceLabArchetypes(analysis, registry = FACE_LAB_ARCHETYPE_REGISTRY) {
  const validation = validateFaceLabArchetypeRegistry(registry);
  if (!validation.ok) {
    const error = new Error("face_lab_archetype_registry_invalid");
    error.details = validation.errors;
    throw error;
  }

  const analysisUsable = Boolean(
    analysis &&
    typeof analysis === "object" &&
    ["available", "partial"].includes(analysis.status) &&
    analysis.quality?.status === "available"
  );
  const qualityMultiplier = analysisUsable ? clampUnit(analysis.quality.confidence) : 0;
  const candidates = registry.archetypes
    .map((item) => scoreArchetype(analysisUsable ? analysis : null, item, qualityMultiplier))
    .sort((left, right) => right.rawScore - left.rawScore || left.key.localeCompare(right.key));

  return {
    schemaVersion: FACE_LAB_ARCHETYPE_SCORING_SCHEMA_VERSION,
    registryVersion: registry.registryVersion,
    analysisUsable,
    qualityMultiplier,
    candidates
  };
}
