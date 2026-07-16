const MANIFEST_SCHEMA_VERSION = "face-lab-hosted-eval-manifest-v1";
const RUN_SCHEMA_VERSION = "face-lab-hosted-eval-run-v1";
const RECORD_SCHEMA_VERSION = "face-lab-hosted-eval-record-v1";
const SUMMARY_SCHEMA_VERSION = "face-lab-hosted-eval-summary-v1";

const ALLOWED_ELIGIBILITY = new Set(["eligible", "ineligible"]);
const ALLOWED_VARIANT_ROLES = new Set(["baseline", "variant", "control"]);
const ALLOWED_DEGRADATIONS = new Set([
  "none",
  "color_only",
  "forehead_occlusion",
  "eye_occlusion",
  "lower_face_occlusion",
  "profile_angle",
  "global_quality",
  "eligibility_block"
]);
const ALLOWED_PLANS = new Set(["smoke", "stability", "full"]);
const ALLOWED_LOCALES = new Set(["ko", "en"]);
const ANALYSIS_STATUSES = new Set([
  "available",
  "partial",
  "insufficient_evidence",
  "unavailable"
]);
const FIELD_STATUSES = new Set([
  "available",
  "insufficient_evidence",
  "unavailable"
]);
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const FORBIDDEN_METADATA_KEYS = new Set([
  "age",
  "birthdate",
  "dateofbirth",
  "dob",
  "minor",
  "isminor",
  "underage",
  "gender",
  "sex",
  "race",
  "ethnicity",
  "nationality",
  "religion",
  "health",
  "diagnosis",
  "disease",
  "name",
  "fullname",
  "email",
  "phone",
  "address"
]);
const FORBIDDEN_IMAGE_KEYS = new Set([
  "image",
  "imageurl",
  "imagealt",
  "imagepreview",
  "imagepreviewdataurl",
  "imagedataurl",
  "base64",
  "buffer",
  "facecrop",
  "crop"
]);
const ALLOWED_RESPONSE_TOP_LEVEL_KEYS = new Set([
  "status",
  "source",
  "failureReason",
  "analyzedAt",
  "data",
  "eligibility",
  "error",
  "code",
  "retryAfter"
]);
const ALLOWED_DATA_KEYS = new Set([
  "analysis",
  "base_data",
  "features",
  "structured"
]);

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeKey(value) {
  return String(value || "").replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function cleanId(value, label) {
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string`);
  }
  const cleaned = value.trim();
  if (!/^[a-z0-9][a-z0-9._-]{0,79}$/i.test(cleaned)) {
    throw new Error(`${label} must use 1-80 safe identifier characters`);
  }
  return cleaned;
}

function cleanStringList(value, label, { min = 0, max = 32 } = {}) {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`);
  }
  const cleaned = [...new Set(value.map((item) => {
    if (typeof item !== "string") {
      throw new Error(`${label} entries must be strings`);
    }
    return item.trim();
  }).filter(Boolean))];
  if (cleaned.length < min || cleaned.length > max) {
    throw new Error(`${label} must contain ${min}-${max} values`);
  }
  return cleaned;
}

function assertNoForbiddenMetadata(value, label = "manifest", seen = new WeakSet()) {
  if (!value || typeof value !== "object") {
    return;
  }
  if (seen.has(value)) {
    return;
  }
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoForbiddenMetadata(item, `${label}[${index}]`, seen));
    return;
  }
  for (const [key, item] of Object.entries(value)) {
    if (FORBIDDEN_METADATA_KEYS.has(normalizeKey(key))) {
      throw new Error(`${label} contains forbidden personal metadata key: ${key}`);
    }
    assertNoForbiddenMetadata(item, `${label}.${key}`, seen);
  }
}

function isWindowsAbsolutePath(value) {
  return /^[a-z]:[\\/]/i.test(value) || /^\\\\/.test(value);
}

function toPortablePath(value) {
  return String(value || "").replace(/\\/g, "/");
}

export function validateHostedEvaluationImagePath(
  imagePath,
  { repoRoot = process.cwd(), pathApi } = {}
) {
  const path = pathApi;
  if (!path) {
    throw new Error("pathApi is required");
  }
  if (typeof imagePath !== "string" || !imagePath.trim()) {
    throw new Error("imagePath must be a non-empty string");
  }
  const raw = imagePath.trim();
  if (path.isAbsolute(raw) || isWindowsAbsolutePath(raw)) {
    throw new Error("imagePath must be repository-relative");
  }
  const portable = toPortablePath(raw).replace(/^\.\//, "");
  if (!portable.startsWith("private/face-lab-fixtures/")) {
    throw new Error("imagePath must stay under private/face-lab-fixtures/");
  }
  const resolvedRoot = path.resolve(repoRoot);
  const fixtureRoot = path.resolve(resolvedRoot, "private/face-lab-fixtures");
  const resolved = path.resolve(resolvedRoot, portable);
  const relative = path.relative(fixtureRoot, resolved);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("imagePath must point to a file inside private/face-lab-fixtures/");
  }
  const extension = path.extname(resolved).toLowerCase();
  if (!IMAGE_EXTENSIONS.has(extension)) {
    throw new Error("imagePath must use JPEG, PNG, or WEBP");
  }
  return {
    absolutePath: resolved,
    portablePath: portable
  };
}

export function validateHostedEvaluationManifest(
  manifest,
  {
    repoRoot = process.cwd(),
    pathApi,
    fileExists = () => true,
    requireImageFiles = true
  } = {}
) {
  if (!isObject(manifest)) {
    throw new Error("manifest must be an object");
  }
  assertNoForbiddenMetadata(manifest);
  if (manifest.schemaVersion !== MANIFEST_SCHEMA_VERSION) {
    throw new Error(`manifest schemaVersion must be ${MANIFEST_SCHEMA_VERSION}`);
  }
  const datasetId = cleanId(manifest.datasetId, "datasetId");
  if (!Array.isArray(manifest.fixtures) || !manifest.fixtures.length) {
    throw new Error("manifest.fixtures must be a non-empty array");
  }

  const fixtureIds = new Set();
  const fixtures = manifest.fixtures.map((fixture, index) => {
    const label = `fixtures[${index}]`;
    if (!isObject(fixture)) {
      throw new Error(`${label} must be an object`);
    }
    if (fixture.consentConfirmed !== true) {
      throw new Error(`${label}.consentConfirmed must be true`);
    }
    const fixtureId = cleanId(fixture.fixtureId, `${label}.fixtureId`);
    if (fixtureIds.has(fixtureId)) {
      throw new Error(`duplicate fixtureId: ${fixtureId}`);
    }
    fixtureIds.add(fixtureId);
    const subjectId = cleanId(fixture.subjectId, `${label}.subjectId`);
    if (!ALLOWED_ELIGIBILITY.has(fixture.expectedEligibility)) {
      throw new Error(`${label}.expectedEligibility is invalid`);
    }
    const comparisonGroup = cleanId(
      fixture.comparisonGroup,
      `${label}.comparisonGroup`
    );
    if (!ALLOWED_VARIANT_ROLES.has(fixture.variantRole)) {
      throw new Error(`${label}.variantRole is invalid`);
    }
    const conditionTags = cleanStringList(
      fixture.conditionTags,
      `${label}.conditionTags`,
      { min: 1, max: 16 }
    );
    if (!ALLOWED_DEGRADATIONS.has(fixture.expectedDegradation)) {
      throw new Error(`${label}.expectedDegradation is invalid`);
    }
    const plans = fixture.plans === undefined
      ? ["full"]
      : cleanStringList(fixture.plans, `${label}.plans`, { min: 1, max: 3 });
    if (plans.some((plan) => !ALLOWED_PLANS.has(plan))) {
      throw new Error(`${label}.plans contains an invalid plan`);
    }
    const resolvedImage = validateHostedEvaluationImagePath(fixture.imagePath, {
      repoRoot,
      pathApi
    });
    if (requireImageFiles && !fileExists(resolvedImage.absolutePath)) {
      throw new Error(`${label}.imagePath does not exist`);
    }

    return {
      fixtureId,
      subjectId,
      imagePath: resolvedImage.absolutePath,
      expectedEligibility: fixture.expectedEligibility,
      comparisonGroup,
      variantRole: fixture.variantRole,
      conditionTags,
      expectedDegradation: fixture.expectedDegradation,
      plans
    };
  });

  return {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    datasetId,
    fixtures
  };
}

function normalizeLocales(value) {
  const locales = value === undefined ? ["ko", "en"] : value;
  if (!Array.isArray(locales) || !locales.length) {
    throw new Error("locales must be a non-empty array");
  }
  const normalized = [...new Set(locales.map((locale) => String(locale || "").trim()))];
  if (normalized.some((locale) => !ALLOWED_LOCALES.has(locale))) {
    throw new Error("locales may contain only ko and en");
  }
  return normalized;
}

export function buildHostedEvaluationCases(
  manifest,
  {
    plan = "smoke",
    locales,
    repetitions = 1,
    maxCalls = 20
  } = {}
) {
  if (!ALLOWED_PLANS.has(plan)) {
    throw new Error("plan must be smoke, stability, or full");
  }
  if (!Number.isInteger(repetitions) || repetitions < 1 || repetitions > 10) {
    throw new Error("repetitions must be an integer from 1 to 10");
  }
  if (!Number.isInteger(maxCalls) || maxCalls < 1 || maxCalls > 500) {
    throw new Error("maxCalls must be an integer from 1 to 500");
  }
  const selectedLocales = normalizeLocales(locales);
  const selectedFixtures = manifest.fixtures.filter((fixture) => {
    if (plan === "full") {
      return true;
    }
    return fixture.plans.includes(plan);
  });
  if (!selectedFixtures.length) {
    throw new Error(`no fixtures selected for plan ${plan}`);
  }

  const cases = [];
  for (const fixture of selectedFixtures) {
    for (const locale of selectedLocales) {
      for (let repetition = 1; repetition <= repetitions; repetition += 1) {
        cases.push({
          caseId: `${fixture.fixtureId}:${locale}:${repetition}`,
          fixtureId: fixture.fixtureId,
          subjectId: fixture.subjectId,
          comparisonGroup: fixture.comparisonGroup,
          variantRole: fixture.variantRole,
          conditionTags: fixture.conditionTags,
          expectedEligibility: fixture.expectedEligibility,
          expectedDegradation: fixture.expectedDegradation,
          imagePath: fixture.imagePath,
          locale,
          repetition
        });
      }
    }
  }
  if (cases.length > maxCalls) {
    throw new Error(`planned call count ${cases.length} exceeds maxCalls ${maxCalls}`);
  }
  return {
    plan,
    locales: selectedLocales,
    repetitions,
    maxCalls,
    plannedCalls: cases.length,
    cases
  };
}

function hasForbiddenPayload(value, seen = new WeakSet()) {
  if (typeof value === "string") {
    return /^data:image\//i.test(value.trim()) || /;base64,/i.test(value);
  }
  if (!value || typeof value !== "object") {
    return false;
  }
  if (seen.has(value)) {
    return false;
  }
  seen.add(value);
  if (Array.isArray(value)) {
    return value.some((item) => hasForbiddenPayload(item, seen));
  }
  return Object.entries(value).some(([key, item]) =>
    FORBIDDEN_IMAGE_KEYS.has(normalizeKey(key)) || hasForbiddenPayload(item, seen)
  );
}

function pickQualityValue(value) {
  if (!isObject(value)) {
    return null;
  }
  return {
    faceVisibility: value.faceVisibility || null,
    faceScale: value.faceScale || null,
    pose: isObject(value.pose) ? { ...value.pose } : null,
    occlusion: isObject(value.occlusion) ? { ...value.occlusion } : null,
    sharpness: value.sharpness || null,
    exposure: value.exposure || null,
    lightingUniformity: value.lightingUniformity || null,
    whiteBalance: value.whiteBalance || null,
    filterOrEditing: value.filterOrEditing || null,
    makeupCoverage: value.makeupCoverage || null,
    structureSuitability: value.structureSuitability || null,
    colorSuitability: value.colorSuitability || null
  };
}

function projectObservationFields(observations) {
  if (!isObject(observations)) {
    return null;
  }
  return Object.fromEntries(
    Object.entries(observations).map(([groupName, group]) => [
      groupName,
      isObject(group)
        ? Object.fromEntries(Object.entries(group).map(([fieldName, field]) => [
            fieldName,
            isObject(field)
              ? {
                  status: FIELD_STATUSES.has(field.status) ? field.status : null,
                  value: Array.isArray(field.value)
                    ? [...field.value]
                    : field.value ?? null,
                  confidence: typeof field.confidence === "number"
                    ? field.confidence
                    : null,
                  unavailableReason: typeof field.unavailableReason === "string"
                    ? field.unavailableReason
                    : null
                }
              : null
          ]))
        : null
    ])
  );
}

export function auditHostedEvaluationResponse(responsePayload) {
  const serialized = JSON.stringify(responsePayload ?? null);
  const topLevelUnknownKeys = isObject(responsePayload)
    ? Object.keys(responsePayload).filter((key) => !ALLOWED_RESPONSE_TOP_LEVEL_KEYS.has(key))
    : [];
  const dataUnknownKeys = isObject(responsePayload?.data)
    ? Object.keys(responsePayload.data).filter((key) => !ALLOWED_DATA_KEYS.has(key))
    : [];
  return {
    rawObservationKeyFound: serialized.includes('"observation_analysis"'),
    imagePayloadFound: hasForbiddenPayload(responsePayload),
    unknownProviderKeyFound: topLevelUnknownKeys.length > 0 || dataUnknownKeys.length > 0,
    topLevelUnknownKeys,
    dataUnknownKeys
  };
}

export function projectHostedEvaluationRecord({
  runId,
  caseDefinition,
  httpStatus,
  durationMs,
  responsePayload,
  requestError = null
}) {
  const privacyAudit = auditHostedEvaluationResponse(responsePayload);
  const eligibility = isObject(responsePayload?.eligibility)
    ? responsePayload.eligibility
    : null;
  const analysis = isObject(responsePayload?.data?.analysis)
    ? responsePayload.data.analysis
    : null;
  const quality = isObject(analysis?.quality) ? analysis.quality : null;
  const record = {
    schemaVersion: RECORD_SCHEMA_VERSION,
    runId,
    caseId: caseDefinition.caseId,
    fixtureId: caseDefinition.fixtureId,
    subjectId: caseDefinition.subjectId,
    comparisonGroup: caseDefinition.comparisonGroup,
    variantRole: caseDefinition.variantRole,
    conditionTags: [...caseDefinition.conditionTags],
    expectedEligibility: caseDefinition.expectedEligibility,
    expectedDegradation: caseDefinition.expectedDegradation,
    locale: caseDefinition.locale,
    repetition: caseDefinition.repetition,
    httpStatus: Number.isInteger(httpStatus) ? httpStatus : null,
    durationMs: Number.isFinite(durationMs) ? Math.max(0, Math.round(durationMs)) : null,
    requestError: typeof requestError === "string" && requestError ? requestError.slice(0, 120) : null,
    envelopeStatus: typeof responsePayload?.status === "string" ? responsePayload.status : null,
    failureReason: typeof responsePayload?.failureReason === "string"
      ? responsePayload.failureReason
      : null,
    eligibility: eligibility
      ? {
          status: eligibility.status || null,
          imageType: eligibility.imageType || null,
          humanFaceCount: Number.isInteger(eligibility.humanFaceCount)
            ? eligibility.humanFaceCount
            : null,
          faceLabEligible: eligibility.faceLabEligible === true,
          faceLabFailureReason: eligibility.faceLabFailureReason || null
        }
      : null,
    analysis: analysis
      ? {
          schemaVersion: analysis.schemaVersion || null,
          status: ANALYSIS_STATUSES.has(analysis.status) ? analysis.status : null,
          failureReason: analysis.failureReason || null,
          quality: quality
            ? {
                status: quality.status || null,
                confidence: typeof quality.confidence === "number"
                  ? quality.confidence
                  : null,
                unavailableReason: quality.unavailableReason || null,
                value: pickQualityValue(quality.value)
              }
            : null,
          observations: projectObservationFields(analysis.observations),
          coverage: isObject(analysis.coverage) ? { ...analysis.coverage } : null,
          warnings: Array.isArray(analysis.warnings)
            ? analysis.warnings.filter((item) => typeof item === "string")
            : [],
          sourceImagePersisted: analysis?.privacy?.sourceImagePersisted === true
        }
      : null,
    privacyAudit
  };
  if (hasForbiddenPayload(record)) {
    throw new Error("projected evaluation record contains forbidden image payload");
  }
  return record;
}

export function getCompletedHostedEvaluationCaseIds(records) {
  return new Set(
    (Array.isArray(records) ? records : [])
      .map((record) => record?.caseId)
      .filter((value) => typeof value === "string" && value)
  );
}

export function getPendingHostedEvaluationCases(cases, records) {
  const completed = getCompletedHostedEvaluationCaseIds(records);
  return cases.filter((item) => !completed.has(item.caseId));
}

export function jaccardSimilarity(left, right) {
  const leftSet = new Set(Array.isArray(left) ? left : []);
  const rightSet = new Set(Array.isArray(right) ? right : []);
  const union = new Set([...leftSet, ...rightSet]);
  if (!union.size) {
    return 1;
  }
  let intersection = 0;
  for (const item of leftSet) {
    if (rightSet.has(item)) {
      intersection += 1;
    }
  }
  return intersection / union.size;
}
function flattenObservationFields(record) {
  const output = {};
  for (const [groupName, group] of Object.entries(record?.analysis?.observations || {})) {
    for (const [fieldName, field] of Object.entries(group || {})) {
      output[`${groupName}.${fieldName}`] = field;
    }
  }
  return output;
}

function compareFieldValues(left, right) {
  if (Array.isArray(left) || Array.isArray(right)) {
    return jaccardSimilarity(left, right);
  }
  return left === right ? 1 : 0;
}

function buildAgreement(records, keySelector) {
  const grouped = new Map();
  for (const record of records) {
    const key = keySelector(record);
    if (!key) continue;
    const list = grouped.get(key) || [];
    list.push(record);
    grouped.set(key, list);
  }

  let statusComparisons = 0;
  let statusMatches = 0;
  let valueComparisons = 0;
  let valueScore = 0;
  for (const groupRecords of grouped.values()) {
    if (groupRecords.length < 2) continue;
    for (let index = 0; index < groupRecords.length - 1; index += 1) {
      const leftFields = flattenObservationFields(groupRecords[index]);
      const rightFields = flattenObservationFields(groupRecords[index + 1]);
      const keys = new Set([...Object.keys(leftFields), ...Object.keys(rightFields)]);
      for (const key of keys) {
        const left = leftFields[key];
        const right = rightFields[key];
        statusComparisons += 1;
        if (left?.status === right?.status) statusMatches += 1;
        if (left?.status === "available" && right?.status === "available") {
          valueComparisons += 1;
          valueScore += compareFieldValues(left.value, right.value);
        }
      }
    }
  }
  return {
    statusComparisons,
    statusAgreement: statusComparisons ? statusMatches / statusComparisons : null,
    valueComparisons,
    valueAgreement: valueComparisons ? valueScore / valueComparisons : null
  };
}

export function summarizeHostedEvaluation(records, runManifest = {}) {
  const safeRecords = Array.isArray(records) ? records : [];
  const statusCounts = {};
  const analysisStatusCounts = {};
  const failureReasonCounts = {};
  let privacyFailures = 0;
  let requestFailures = 0;
  let ineligibleCanonicalViolations = 0;
  let baselineUsable = 0;
  let baselineTotal = 0;
  let latencyTotal = 0;
  let latencyCount = 0;

  for (const record of safeRecords) {
    statusCounts[record.envelopeStatus || "missing"] = (statusCounts[record.envelopeStatus || "missing"] || 0) + 1;
    const analysisStatus = record.analysis?.status || "missing";
    analysisStatusCounts[analysisStatus] = (analysisStatusCounts[analysisStatus] || 0) + 1;
    const failure = record.failureReason || record.analysis?.failureReason || "none";
    failureReasonCounts[failure] = (failureReasonCounts[failure] || 0) + 1;
    if (record.privacyAudit?.rawObservationKeyFound || record.privacyAudit?.imagePayloadFound || record.privacyAudit?.unknownProviderKeyFound || record.analysis?.sourceImagePersisted) {
      privacyFailures += 1;
    }
    if (record.requestError || !record.httpStatus || record.httpStatus >= 500) requestFailures += 1;
    if (record.expectedEligibility === "ineligible" && record.analysis) ineligibleCanonicalViolations += 1;
    if (record.variantRole === "baseline" && record.expectedEligibility === "eligible") {
      baselineTotal += 1;
      if (record.analysis?.status === "available" || record.analysis?.status === "partial") baselineUsable += 1;
    }
    if (Number.isFinite(record.durationMs)) {
      latencyTotal += record.durationMs;
      latencyCount += 1;
    }
  }

  const repeatAgreement = buildAgreement(
    safeRecords,
    (record) => `${record.fixtureId}:${record.locale}`
  );
  const localeAgreement = buildAgreement(
    safeRecords,
    (record) => `${record.fixtureId}:${record.repetition}`
  );
  const hardInvariantFailures = privacyFailures + requestFailures + ineligibleCanonicalViolations;
  const issues = [];
  if (hardInvariantFailures) issues.push({ severity: "P0", code: "hard_invariant_failure", count: hardInvariantFailures });
  if (baselineTotal && baselineUsable / baselineTotal < 0.8) issues.push({ severity: "P1", code: "baseline_usability_below_80_percent" });
  if (repeatAgreement.statusAgreement !== null && repeatAgreement.statusAgreement < 0.95) issues.push({ severity: "P1", code: "repeat_status_agreement_below_95_percent" });
  if (repeatAgreement.valueAgreement !== null && repeatAgreement.valueAgreement < 0.9) issues.push({ severity: "P1", code: "repeat_value_agreement_below_90_percent" });
  if (localeAgreement.statusAgreement !== null && localeAgreement.statusAgreement < 1) issues.push({ severity: "P1", code: "locale_status_agreement_below_100_percent" });
  if (localeAgreement.valueAgreement !== null && localeAgreement.valueAgreement < 0.9) issues.push({ severity: "P1", code: "locale_value_agreement_below_90_percent" });

  return {
    schemaVersion: SUMMARY_SCHEMA_VERSION,
    runId: runManifest.runId || null,
    datasetId: runManifest.datasetId || null,
    plan: runManifest.plan || null,
    plannedCalls: runManifest.plannedCalls ?? null,
    completedCalls: safeRecords.length,
    statusCounts,
    analysisStatusCounts,
    failureReasonCounts,
    privacyFailures,
    requestFailures,
    ineligibleCanonicalViolations,
    baseline: {
      total: baselineTotal,
      usable: baselineUsable,
      usableRate: baselineTotal ? baselineUsable / baselineTotal : null
    },
    repeatAgreement,
    localeAgreement,
    latency: {
      count: latencyCount,
      averageMs: latencyCount ? Math.round(latencyTotal / latencyCount) : null
    },
    hardInvariantFailures,
    issues
  };
}

function formatPercent(value) {
  return typeof value === "number" ? `${(value * 100).toFixed(1)}%` : "n/a";
}

export function renderHostedEvaluationReport(summary) {
  const lines = [
    "# Face Lab Hosted Evaluation Report",
    "",
    `- Run: ${summary.runId || "unknown"}`,
    `- Dataset: ${summary.datasetId || "unknown"}`,
    `- Plan: ${summary.plan || "unknown"}`,
    `- Completed: ${summary.completedCalls}/${summary.plannedCalls ?? "?"}`,
    `- Average latency: ${summary.latency?.averageMs ?? "n/a"} ms`,
    "",
    "## Hard invariants",
    "",
    `- Privacy failures: ${summary.privacyFailures}`,
    `- Request/server failures: ${summary.requestFailures}`,
    `- Ineligible canonical violations: ${summary.ineligibleCanonicalViolations}`,
    `- Total hard invariant failures: ${summary.hardInvariantFailures}`,
    "",
    "## Baseline usability",
    "",
    `- Usable: ${summary.baseline.usable}/${summary.baseline.total}`,
    `- Rate: ${formatPercent(summary.baseline.usableRate)}`,
    "",
    "## Stability",
    "",
    `- Repeat status agreement: ${formatPercent(summary.repeatAgreement.statusAgreement)}`,
    `- Repeat value agreement: ${formatPercent(summary.repeatAgreement.valueAgreement)}`,
    `- Locale status agreement: ${formatPercent(summary.localeAgreement.statusAgreement)}`,
    `- Locale value agreement: ${formatPercent(summary.localeAgreement.valueAgreement)}`,
    "",
    "## Issues",
    ""
  ];
  if (!summary.issues.length) {
    lines.push("- None detected by the current gates.");
  } else {
    for (const issue of summary.issues) {
      lines.push(`- ${issue.severity}: ${issue.code}${issue.count ? ` (${issue.count})` : ""}`);
    }
  }
  lines.push("", "This report excludes source images, absolute paths, raw provider JSON, and evidence text.", "");
  return lines.join("\n");
}

export function createHostedEvaluationRunManifest({
  runId,
  datasetId,
  plan,
  locales,
  repetitions,
  maxCalls,
  plannedCalls,
  baseUrl,
  createdAt = new Date().toISOString()
}) {
  return {
    schemaVersion: RUN_SCHEMA_VERSION,
    runId: cleanId(runId, "runId"),
    datasetId: cleanId(datasetId, "datasetId"),
    plan,
    locales: normalizeLocales(locales),
    repetitions,
    maxCalls,
    plannedCalls,
    baseUrl: typeof baseUrl === "string" ? baseUrl.replace(/\/$/, "") : null,
    createdAt
  };
}

export const FACE_LAB_HOSTED_EVALUATION_VERSIONS = Object.freeze({
  manifest: MANIFEST_SCHEMA_VERSION,
  run: RUN_SCHEMA_VERSION,
  record: RECORD_SCHEMA_VERSION,
  summary: SUMMARY_SCHEMA_VERSION
});
