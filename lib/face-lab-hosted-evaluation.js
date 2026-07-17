const MANIFEST_SCHEMA_VERSION = "face-lab-hosted-eval-manifest-v1";
const RUN_SCHEMA_VERSION = "face-lab-hosted-eval-run-v2";
const RECORD_SCHEMA_VERSION = "face-lab-hosted-eval-record-v2";
const SUMMARY_SCHEMA_VERSION = "face-lab-hosted-eval-summary-v2";
const LEGACY_RECORD_SCHEMA_VERSION = "face-lab-hosted-eval-record-v1";

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
const ANALYSIS_STATUSES = new Set(["available", "partial", "insufficient_evidence", "unavailable"]);
const FIELD_STATUSES = new Set(["available", "insufficient_evidence", "unavailable"]);
const TRANSPORT_STATUSES = new Set(["success", "rate_limited", "client_error", "server_error", "timeout", "network_error", "not_attempted"]);
const FINAL_CANONICAL_STATUSES = new Set(["valid", "invalid", "not_evaluable"]);
const ELIGIBILITY_COMPARISONS = new Set(["match", "mismatch", "not_evaluable"]);
const PRIVACY_STATUSES = new Set(["pass", "violation"]);
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const RETRYABLE_TERMINAL_STATUSES = new Set(["rate_limited", "server_error", "timeout", "network_error", "not_attempted"]);
const FORBIDDEN_METADATA_KEYS = new Set([
  "age", "birthdate", "dateofbirth", "dob", "minor", "isminor", "underage",
  "gender", "sex", "race", "ethnicity", "nationality", "religion", "health",
  "diagnosis", "disease", "name", "fullname", "email", "phone", "address"
]);
const FORBIDDEN_IMAGE_KEYS = new Set([
  "image", "imageurl", "imagealt", "imagepreview", "imagepreviewdataurl",
  "imagedataurl", "base64", "buffer", "facecrop", "crop"
]);
const ALLOWED_RESPONSE_TOP_LEVEL_KEYS = new Set([
  "status", "source", "failureReason", "analyzedAt", "data", "eligibility",
  "error", "code", "message", "retryAfter", "retryAfterSeconds"
]);
const ALLOWED_DATA_KEYS = new Set(["analysis", "base_data", "features", "structured"]);

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeKey(value) {
  return String(value || "").replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function cleanId(value, label) {
  if (typeof value !== "string") throw new Error(`${label} must be a string`);
  const cleaned = value.trim();
  if (!/^[a-z0-9][a-z0-9._-]{0,79}$/i.test(cleaned)) {
    throw new Error(`${label} must use 1-80 safe identifier characters`);
  }
  return cleaned;
}

function cleanCaseId(value) {
  if (typeof value !== "string") throw new Error("caseId must be a string");
  const cleaned = value.trim();
  if (!/^[a-z0-9][a-z0-9._:-]{0,159}$/i.test(cleaned) || cleaned.includes("/") || cleaned.includes("\\")) {
    throw new Error("caseId must use safe logical identifier characters");
  }
  return cleaned;
}

function cleanStringList(value, label, { min = 0, max = 32 } = {}) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  const cleaned = [...new Set(value.map((item) => {
    if (typeof item !== "string") throw new Error(`${label} entries must be strings`);
    return item.trim();
  }).filter(Boolean))];
  if (cleaned.length < min || cleaned.length > max) {
    throw new Error(`${label} must contain ${min}-${max} values`);
  }
  return cleaned;
}

function assertNoForbiddenMetadata(value, label = "manifest", seen = new WeakSet()) {
  if (!value || typeof value !== "object" || seen.has(value)) return;
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

function isInsidePath(pathApi, parent, child) {
  const relative = pathApi.relative(parent, child);
  if (!relative || relative.startsWith("..") || pathApi.isAbsolute(relative)) return false;
  if (process.platform === "win32" || pathApi.sep === "\\") {
    return child.toLowerCase().startsWith(`${parent.toLowerCase()}${pathApi.sep}`);
  }
  return true;
}

export function validateHostedEvaluationImagePath(
  imagePath,
  { repoRoot = process.cwd(), pathApi, fsApi, requireImageFiles = true } = {}
) {
  if (!pathApi) throw new Error("pathApi is required");
  if (typeof imagePath !== "string" || !imagePath.trim()) {
    throw new Error("imagePath must be a non-empty string");
  }
  const raw = imagePath.trim();
  if (pathApi.isAbsolute(raw) || isWindowsAbsolutePath(raw)) {
    throw new Error("imagePath must be repository-relative");
  }
  const portable = toPortablePath(raw).replace(/^\.\//, "");
  if (!portable.startsWith("private/face-lab-fixtures/")) {
    throw new Error("imagePath must stay under private/face-lab-fixtures/");
  }
  const resolvedRoot = pathApi.resolve(repoRoot);
  const fixtureRoot = pathApi.resolve(resolvedRoot, "private", "face-lab-fixtures");
  const resolved = pathApi.resolve(resolvedRoot, portable);
  if (!isInsidePath(pathApi, fixtureRoot, resolved)) {
    throw new Error("imagePath must point to a file inside private/face-lab-fixtures/");
  }
  const extension = pathApi.extname(resolved).toLowerCase();
  if (!IMAGE_EXTENSIONS.has(extension)) throw new Error("imagePath must use JPEG, PNG, or WEBP");

  if (requireImageFiles) {
    if (!fsApi) throw new Error("fsApi is required when image files are required");
    if (!fsApi.existsSync(resolved)) throw new Error("imagePath does not exist");
    const fixtureRootReal = fsApi.realpathSync(fixtureRoot);
    const imageReal = fsApi.realpathSync(resolved);
    if (!isInsidePath(pathApi, fixtureRootReal, imageReal)) {
      throw new Error("imagePath realpath escapes private/face-lab-fixtures/");
    }
    const stat = fsApi.statSync(imageReal);
    if (!stat.isFile()) throw new Error("imagePath must point to a regular file");
    return { absolutePath: imageReal, portablePath: portable };
  }
  return { absolutePath: resolved, portablePath: portable };
}

export function validateHostedEvaluationManifest(
  manifest,
  { repoRoot = process.cwd(), pathApi, fsApi, fileExists, requireImageFiles = true } = {}
) {
  if (!isObject(manifest)) throw new Error("manifest must be an object");
  assertNoForbiddenMetadata(manifest);
  if (manifest.schemaVersion !== MANIFEST_SCHEMA_VERSION) {
    throw new Error(`manifest schemaVersion must be ${MANIFEST_SCHEMA_VERSION}`);
  }
  const datasetId = cleanId(manifest.datasetId, "datasetId");
  if (!Array.isArray(manifest.fixtures) || !manifest.fixtures.length) {
    throw new Error("manifest.fixtures must be a non-empty array");
  }
  const effectiveFs = fsApi || (fileExists ? {
    existsSync: fileExists,
    realpathSync: (value) => value,
    statSync: () => ({ isFile: () => true })
  } : null);
  const fixtureIds = new Set();
  const fixtures = manifest.fixtures.map((fixture, index) => {
    const label = `fixtures[${index}]`;
    if (!isObject(fixture)) throw new Error(`${label} must be an object`);
    if (fixture.consentConfirmed !== true) throw new Error(`${label}.consentConfirmed must be true`);
    const fixtureId = cleanId(fixture.fixtureId, `${label}.fixtureId`);
    if (fixtureIds.has(fixtureId)) throw new Error(`duplicate fixtureId: ${fixtureId}`);
    fixtureIds.add(fixtureId);
    const subjectId = cleanId(fixture.subjectId, `${label}.subjectId`);
    if (!ALLOWED_ELIGIBILITY.has(fixture.expectedEligibility)) {
      throw new Error(`${label}.expectedEligibility is invalid`);
    }
    const comparisonGroup = cleanId(fixture.comparisonGroup, `${label}.comparisonGroup`);
    if (!ALLOWED_VARIANT_ROLES.has(fixture.variantRole)) throw new Error(`${label}.variantRole is invalid`);
    const conditionTags = cleanStringList(fixture.conditionTags, `${label}.conditionTags`, { min: 1, max: 16 });
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
      pathApi,
      fsApi: effectiveFs,
      requireImageFiles
    });
    return {
      fixtureId,
      subjectId,
      imagePath: resolvedImage.absolutePath,
      imagePathPortable: resolvedImage.portablePath,
      declaredMime: typeof fixture.declaredMime === "string" ? fixture.declaredMime : null,
      expectedEligibility: fixture.expectedEligibility,
      comparisonGroup,
      variantRole: fixture.variantRole,
      conditionTags,
      expectedDegradation: fixture.expectedDegradation,
      plans
    };
  });
  return { schemaVersion: MANIFEST_SCHEMA_VERSION, datasetId, fixtures };
}

function normalizeLocales(value) {
  const locales = value === undefined ? ["ko", "en"] : value;
  if (!Array.isArray(locales) || !locales.length) throw new Error("locales must be a non-empty array");
  const normalized = [...new Set(locales.map((locale) => String(locale || "").trim()))];
  if (normalized.some((locale) => !ALLOWED_LOCALES.has(locale))) {
    throw new Error("locales may contain only ko and en");
  }
  return normalized;
}

export function buildHostedEvaluationCases(
  manifest,
  { plan = "smoke", locales, repetitions = 1, maxCalls = 20 } = {}
) {
  if (!ALLOWED_PLANS.has(plan)) throw new Error("plan must be smoke, stability, or full");
  if (!Number.isSafeInteger(repetitions) || repetitions < 1 || repetitions > 10) {
    throw new Error("repetitions must be an integer from 1 to 10");
  }
  if (!Number.isSafeInteger(maxCalls) || maxCalls < 1 || maxCalls > 500) {
    throw new Error("maxCalls must be an integer from 1 to 500");
  }
  const selectedLocales = normalizeLocales(locales);
  const selectedFixtures = manifest.fixtures.filter((fixture) => plan === "full" || fixture.plans.includes(plan));
  if (!selectedFixtures.length) throw new Error(`no fixtures selected for plan ${plan}`);
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
          conditionTags: [...fixture.conditionTags],
          expectedEligibility: fixture.expectedEligibility,
          expectedDegradation: fixture.expectedDegradation,
          imagePath: fixture.imagePath,
          imagePathPortable: fixture.imagePathPortable,
          declaredMime: fixture.declaredMime,
          locale,
          repetition
        });
      }
    }
  }
  if (cases.length > maxCalls) throw new Error(`planned call count ${cases.length} exceeds maxCalls ${maxCalls}`);
  return { plan, locales: selectedLocales, repetitions, maxCalls, plannedCalls: cases.length, cases };
}

function hasForbiddenPayload(value, seen = new WeakSet()) {
  if (typeof value === "string") {
    return /^data:image\//i.test(value.trim()) || /;base64,/i.test(value);
  }
  if (!value || typeof value !== "object" || seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) return value.some((item) => hasForbiddenPayload(item, seen));
  return Object.entries(value).some(([key, item]) => FORBIDDEN_IMAGE_KEYS.has(normalizeKey(key)) || hasForbiddenPayload(item, seen));
}

function containsEvidenceText(value, seen = new WeakSet()) {
  if (!value || typeof value !== "object" || seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) return value.some((item) => containsEvidenceText(item, seen));
  for (const [key, item] of Object.entries(value)) {
    if (normalizeKey(key) === "evidence" && Array.isArray(item) && item.some((entry) => typeof entry === "string" && entry)) {
      return true;
    }
    if (containsEvidenceText(item, seen)) return true;
  }
  return false;
}

function pickQualityValue(value) {
  if (!isObject(value)) return null;
  return {
    faceVisibility: value.faceVisibility || null,
    faceScale: value.faceScale || null,
    pose: isObject(value.pose) ? {
      yaw: value.pose.yaw || null,
      pitch: value.pose.pitch || null,
      roll: value.pose.roll || null
    } : null,
    occlusion: isObject(value.occlusion) ? Object.fromEntries(
      Object.entries(value.occlusion).filter(([, item]) => typeof item === "string")
    ) : null,
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
  if (!isObject(observations)) return null;
  return Object.fromEntries(Object.entries(observations).map(([groupName, group]) => [
    groupName,
    isObject(group)
      ? Object.fromEntries(Object.entries(group).map(([fieldName, field]) => [
          fieldName,
          isObject(field) ? {
            status: FIELD_STATUSES.has(field.status) ? field.status : null,
            value: Array.isArray(field.value) ? field.value.filter((item) => typeof item === "string") : field.value ?? null,
            confidence: typeof field.confidence === "number" && Number.isFinite(field.confidence) ? field.confidence : null,
            unavailableReason: typeof field.unavailableReason === "string" ? field.unavailableReason : null
          } : null
        ]))
      : null
  ]));
}

function projectEligibility(value) {
  if (!isObject(value)) return null;
  return {
    status: typeof value.status === "string" ? value.status : null,
    imageType: typeof value.imageType === "string" ? value.imageType : null,
    humanFaceCount: Number.isInteger(value.humanFaceCount) ? value.humanFaceCount : null,
    faceLabEligible: value.faceLabEligible === true,
    faceLabFailureReason: typeof value.faceLabFailureReason === "string" ? value.faceLabFailureReason : null
  };
}

function projectAnalysis(value) {
  if (!isObject(value)) return null;
  const quality = isObject(value.quality) ? value.quality : null;
  return {
    schemaVersion: typeof value.schemaVersion === "string" ? value.schemaVersion : null,
    status: ANALYSIS_STATUSES.has(value.status) ? value.status : null,
    failureReason: typeof value.failureReason === "string" ? value.failureReason : null,
    quality: quality ? {
      status: typeof quality.status === "string" ? quality.status : null,
      confidence: typeof quality.confidence === "number" && Number.isFinite(quality.confidence) ? quality.confidence : null,
      unavailableReason: typeof quality.unavailableReason === "string" ? quality.unavailableReason : null,
      value: pickQualityValue(quality.value)
    } : null,
    observations: projectObservationFields(value.observations),
    coverage: isObject(value.coverage) ? {
      availableGroups: Array.isArray(value.coverage.availableGroups) ? value.coverage.availableGroups.filter((item) => typeof item === "string") : [],
      partialGroups: Array.isArray(value.coverage.partialGroups) ? value.coverage.partialGroups.filter((item) => typeof item === "string") : [],
      unavailableGroups: Array.isArray(value.coverage.unavailableGroups) ? value.coverage.unavailableGroups.filter((item) => typeof item === "string") : [],
      availableFieldCount: Number.isInteger(value.coverage.availableFieldCount) ? value.coverage.availableFieldCount : null,
      totalCoreFieldCount: Number.isInteger(value.coverage.totalCoreFieldCount) ? value.coverage.totalCoreFieldCount : null
    } : null,
    warnings: Array.isArray(value.warnings) ? value.warnings.filter((item) => typeof item === "string").slice(0, 32) : [],
    sourceImagePersisted: value?.privacy?.sourceImagePersisted === true
  };
}

export function isCanonicalAnalysisValid(value) {
  return Boolean(
    isObject(value) &&
    value.schemaVersion === "face-lab-observation-v1" &&
    ANALYSIS_STATUSES.has(value.status) &&
    isObject(value.quality) &&
    isObject(value.observations) &&
    isObject(value.coverage) &&
    value?.privacy?.sourceImagePersisted === false &&
    !hasForbiddenPayload(value)
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
    sourceImagePersisted: responsePayload?.data?.analysis?.privacy?.sourceImagePersisted === true,
    evidenceTextWouldPersist: false,
    unexpectedResponseShape: topLevelUnknownKeys.length > 0 || dataUnknownKeys.length > 0,
    privacyStatus: (
      serialized.includes('"observation_analysis"') ||
      hasForbiddenPayload(responsePayload) ||
      responsePayload?.data?.analysis?.privacy?.sourceImagePersisted === true
    ) ? "violation" : "pass"
  };
}

export function classifyHostedEvaluationPayload({ transport, responsePayload, expectedEligibility }) {
  if (!transport || transport.status !== "success") {
    return {
      canonicalStatus: "not_evaluable",
      eligibilityComparison: "not_evaluable"
    };
  }
  const eligibility = projectEligibility(responsePayload?.eligibility);
  const rawAnalysis = isObject(responsePayload?.data?.analysis) ? responsePayload.data.analysis : null;
  let canonicalStatus = "invalid";
  if (rawAnalysis) {
    canonicalStatus = isCanonicalAnalysisValid(rawAnalysis) ? "valid" : "invalid";
  } else if (eligibility && eligibility.faceLabEligible === false && responsePayload?.status === "unavailable") {
    canonicalStatus = "valid";
  }
  let eligibilityComparison = "not_evaluable";
  if (eligibility) {
    const observed = eligibility.faceLabEligible ? "eligible" : "ineligible";
    eligibilityComparison = observed === expectedEligibility ? "match" : "mismatch";
  }
  return { canonicalStatus, eligibilityComparison };
}

function normalizeTransport(value) {
  const status = TRANSPORT_STATUSES.has(value?.status) ? value.status : "network_error";
  return {
    status,
    httpStatus: Number.isInteger(value?.httpStatus) ? value.httpStatus : null,
    attemptCount: Number.isSafeInteger(value?.attemptCount) && value.attemptCount >= 0 ? value.attemptCount : 0,
    retryCount: Number.isSafeInteger(value?.retryCount) && value.retryCount >= 0 ? value.retryCount : 0,
    retryExhausted: value?.retryExhausted === true,
    retryAfterMs: Number.isSafeInteger(value?.retryAfterMs) && value.retryAfterMs >= 0 ? value.retryAfterMs : null,
    durationMs: Number.isFinite(value?.durationMs) ? Math.max(0, Math.round(value.durationMs)) : null,
    reasonCode: typeof value?.reasonCode === "string" && value.reasonCode ? value.reasonCode.slice(0, 96) : null
  };
}

export function projectHostedEvaluationRecord({
  runId,
  caseDefinition,
  recordSequence,
  attemptSequence,
  isFinal = true,
  transport,
  responsePayload
}) {
  const normalizedTransport = normalizeTransport(transport);
  const classification = classifyHostedEvaluationPayload({
    transport: normalizedTransport,
    responsePayload,
    expectedEligibility: caseDefinition.expectedEligibility
  });
  const privacyAudit = auditHostedEvaluationResponse(responsePayload);
  const eligibility = normalizedTransport.status === "success" ? projectEligibility(responsePayload?.eligibility) : null;
  const analysis = normalizedTransport.status === "success" ? projectAnalysis(responsePayload?.data?.analysis) : null;
  const record = {
    schemaVersion: RECORD_SCHEMA_VERSION,
    runId: cleanId(runId, "runId"),
    caseId: cleanCaseId(caseDefinition.caseId),
    fixtureId: cleanId(caseDefinition.fixtureId, "fixtureId"),
    subjectId: cleanId(caseDefinition.subjectId, "subjectId"),
    comparisonGroup: cleanId(caseDefinition.comparisonGroup, "comparisonGroup"),
    variantRole: caseDefinition.variantRole,
    conditionTags: [...caseDefinition.conditionTags],
    locale: caseDefinition.locale,
    repetition: caseDefinition.repetition,
    recordSequence,
    attemptSequence,
    isFinal: isFinal === true,
    expectedEligibility: caseDefinition.expectedEligibility,
    expectedDegradation: caseDefinition.expectedDegradation,
    transport: normalizedTransport,
    evaluation: {
      canonicalStatus: classification.canonicalStatus,
      eligibilityComparison: classification.eligibilityComparison,
      privacyStatus: privacyAudit.privacyStatus,
      unexpectedResponseShape: privacyAudit.unexpectedResponseShape
    },
    eligibility,
    analysis,
    privacyAudit: {
      rawObservationKeyFound: privacyAudit.rawObservationKeyFound,
      imagePayloadFound: privacyAudit.imagePayloadFound,
      sourceImagePersisted: privacyAudit.sourceImagePersisted,
      evidenceTextPersisted: false
    }
  };
  if (!Number.isSafeInteger(recordSequence) || recordSequence < 1) throw new Error("recordSequence must be a positive safe integer");
  if (!Number.isSafeInteger(attemptSequence) || attemptSequence < 1) throw new Error("attemptSequence must be a positive safe integer");
  if (hasForbiddenPayload(record) || containsEvidenceText(record)) {
    throw new Error("projected evaluation record contains forbidden persisted payload");
  }
  return record;
}

export function createNotAttemptedHostedEvaluationRecord({
  runId,
  caseDefinition,
  recordSequence,
  attemptSequence,
  reasonCode
}) {
  return projectHostedEvaluationRecord({
    runId,
    caseDefinition,
    recordSequence,
    attemptSequence,
    isFinal: true,
    responsePayload: null,
    transport: {
      status: "not_attempted",
      httpStatus: null,
      attemptCount: 0,
      retryCount: 0,
      retryExhausted: false,
      retryAfterMs: null,
      durationMs: null,
      reasonCode
    }
  });
}

export function adaptLegacyHostedEvaluationRecord(record, { recordSequence } = {}) {
  if (!isObject(record)) throw new Error("legacy record must be an object");
  if (record.schemaVersion === RECORD_SCHEMA_VERSION) return record;
  const httpStatus = Number.isInteger(record.httpStatus) ? record.httpStatus : null;
  let status;
  if (httpStatus >= 200 && httpStatus < 300) status = "success";
  else if (httpStatus === 429) status = "rate_limited";
  else if (httpStatus >= 400 && httpStatus < 500) status = "client_error";
  else if (httpStatus >= 500) status = "server_error";
  else if (record.requestError === "TimeoutError" || record.requestError === "AbortError") status = "timeout";
  else status = "network_error";
  const transport = normalizeTransport({
    status,
    httpStatus,
    attemptCount: status === "not_attempted" ? 0 : 1,
    retryCount: 0,
    retryExhausted: status === "rate_limited" || status === "server_error",
    retryAfterMs: null,
    durationMs: record.durationMs,
    reasonCode: status === "rate_limited" ? "legacy_rate_limited" : `legacy_${status}`
  });
  let canonicalStatus = "not_evaluable";
  let eligibilityComparison = "not_evaluable";
  if (status === "success") {
    canonicalStatus = record?.privacyAudit?.canonicalContractInvalid
      ? "invalid"
      : (record.analysis ? "valid" : (record.eligibility?.faceLabEligible === false ? "valid" : "invalid"));
    if (record.eligibility) {
      eligibilityComparison = (record.eligibility.faceLabEligible ? "eligible" : "ineligible") === record.expectedEligibility
        ? "match"
        : "mismatch";
    }
  }
  const privacyViolation = Boolean(
    record?.privacyAudit?.rawObservationKeyFound ||
    record?.privacyAudit?.imagePayloadFound ||
    record?.analysis?.sourceImagePersisted
  );
  return {
    schemaVersion: RECORD_SCHEMA_VERSION,
    legacySchemaVersion: record.schemaVersion || LEGACY_RECORD_SCHEMA_VERSION,
    legacyClassification: true,
    classificationConfidence: "partial",
    runId: typeof record.runId === "string" ? record.runId : "legacy-run",
    caseId: record.caseId,
    fixtureId: record.fixtureId,
    subjectId: record.subjectId,
    comparisonGroup: record.comparisonGroup || record.fixtureId,
    variantRole: record.variantRole || "variant",
    conditionTags: Array.isArray(record.conditionTags) ? record.conditionTags.filter((item) => typeof item === "string") : [],
    locale: record.locale,
    repetition: Number.isSafeInteger(record.repetition) ? record.repetition : 1,
    recordSequence: Number.isSafeInteger(record.recordSequence) ? record.recordSequence : recordSequence,
    attemptSequence: Number.isSafeInteger(record.attemptSequence) ? record.attemptSequence : 1,
    isFinal: record.isFinal !== false,
    expectedEligibility: record.expectedEligibility,
    expectedDegradation: record.expectedDegradation,
    transport,
    evaluation: {
      canonicalStatus,
      eligibilityComparison,
      privacyStatus: privacyViolation ? "violation" : "pass",
      unexpectedResponseShape: Boolean(record?.privacyAudit?.unknownProviderKeyFound)
    },
    eligibility: record.eligibility || null,
    analysis: record.analysis || null,
    privacyAudit: {
      rawObservationKeyFound: Boolean(record?.privacyAudit?.rawObservationKeyFound),
      imagePayloadFound: Boolean(record?.privacyAudit?.imagePayloadFound),
      sourceImagePersisted: Boolean(record?.analysis?.sourceImagePersisted),
      evidenceTextPersisted: false
    }
  };
}

export function parseHostedEvaluationJsonLines(content, {
  maxRowBytes = 256 * 1024,
  allowLegacy = true
} = {}) {
  if (typeof content !== "string") throw new Error("records content must be text");
  const records = [];
  const errors = [];
  const endsWithNewline = content.length === 0 || /\r?\n$/.test(content);
  const lines = content.split(/\r?\n/);
  if (endsWithNewline) lines.pop();
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const lineNumber = index + 1;
    if (!line) {
      errors.push({ code: "blank_jsonl_row", lineNumber });
      continue;
    }
    if (Buffer.byteLength(line, "utf8") > maxRowBytes) {
      errors.push({ code: "records_row_size_exceeded", lineNumber });
      continue;
    }
    try {
      const parsed = JSON.parse(line);
      records.push(allowLegacy && parsed?.schemaVersion !== RECORD_SCHEMA_VERSION
        ? adaptLegacyHostedEvaluationRecord(parsed, { recordSequence: lineNumber })
        : parsed);
    } catch {
      errors.push({ code: index === lines.length - 1 && !endsWithNewline ? "last_partial_jsonl_row" : "malformed_jsonl_row", lineNumber });
    }
  }
  if (!endsWithNewline && lines.length && !errors.some((item) => item.code === "last_partial_jsonl_row")) {
    errors.push({ code: "last_partial_jsonl_row", lineNumber: lines.length });
  }
  const seenSequences = new Set();
  let previousSequence = 0;
  for (const record of records) {
    const sequence = record?.recordSequence;
    if (!Number.isSafeInteger(sequence) || sequence < 1) {
      errors.push({ code: "invalid_record_sequence", lineNumber: null });
      continue;
    }
    if (seenSequences.has(sequence)) errors.push({ code: "duplicate_record_sequence", lineNumber: null });
    if (sequence <= previousSequence) errors.push({ code: "non_monotonic_record_sequence", lineNumber: null });
    seenSequences.add(sequence);
    previousSequence = Math.max(previousSequence, sequence);
  }
  return {
    records,
    integrity: {
      valid: errors.length === 0,
      errors,
      lastRecordSequence: previousSequence,
      endsWithNewline
    }
  };
}

export function selectLatestFinalHostedEvaluationRecords(records) {
  const latest = new Map();
  for (const record of Array.isArray(records) ? records : []) {
    if (!record?.isFinal || typeof record.caseId !== "string" || !Number.isSafeInteger(record.recordSequence)) continue;
    const existing = latest.get(record.caseId);
    if (!existing || record.recordSequence > existing.recordSequence) latest.set(record.caseId, record);
  }
  return latest;
}

export function isHostedEvaluationRecordRetryable(record) {
  if (!record?.isFinal) return false;
  const status = record?.transport?.status;
  if (status === "server_error") {
    return [502, 503, 504].includes(record?.transport?.httpStatus);
  }
  return RETRYABLE_TERMINAL_STATUSES.has(status);
}

export function getPendingHostedEvaluationCases(cases, records) {
  const latest = selectLatestFinalHostedEvaluationRecords(records);
  return (Array.isArray(cases) ? cases : []).filter((item) => {
    const record = latest.get(item.caseId);
    if (!record) return true;
    if (record.transport?.status === "success") return false;
    return isHostedEvaluationRecordRetryable(record);
  });
}

export function getNextHostedEvaluationAttemptSequence(caseId, records) {
  return (Array.isArray(records) ? records : []).reduce((max, record) => (
    record?.caseId === caseId && Number.isSafeInteger(record.attemptSequence)
      ? Math.max(max, record.attemptSequence)
      : max
  ), 0) + 1;
}

export function jaccardSimilarity(left, right) {
  const leftSet = new Set(Array.isArray(left) ? left : []);
  const rightSet = new Set(Array.isArray(right) ? right : []);
  const union = new Set([...leftSet, ...rightSet]);
  if (!union.size) return 1;
  let intersection = 0;
  for (const item of leftSet) if (rightSet.has(item)) intersection += 1;
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
  if (Array.isArray(left) || Array.isArray(right)) return jaccardSimilarity(left, right);
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
    groupRecords.sort((a, b) => a.recordSequence - b.recordSequence);
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

function percentile(values, fraction) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1));
  return sorted[index];
}

export function summarizeHostedEvaluation(records, runManifest = {}, integrity = { valid: true, errors: [] }) {
  const allRecords = Array.isArray(records) ? records : [];
  const latestMap = selectLatestFinalHostedEvaluationRecords(allRecords);
  const latest = [...latestMap.values()].sort((a, b) => a.recordSequence - b.recordSequence);
  const plannedCases = Number.isSafeInteger(runManifest.plannedCalls) ? runManifest.plannedCalls : null;
  const contractFailures = {
    privacyViolations: 0,
    canonicalContractFailures: 0,
    ineligibleCanonicalViolations: 0
  };
  const expectationFailures = { eligibilityMismatches: 0 };
  const operationalFailures = {
    rateLimitedCases: 0,
    clientErrorCases: 0,
    serverErrorCases: 0,
    timeoutCases: 0,
    networkErrorCases: 0,
    retryExhaustedCases: 0,
    notAttemptedCases: 0
  };
  let evaluableCases = 0;
  let notEvaluableCases = 0;
  let baselineTotal = 0;
  let baselineUsable = 0;
  const latencies = [];
  let recoveredCases = 0;
  let legacyClassification = false;

  for (const record of latest) {
    if (record.legacyClassification) legacyClassification = true;
    if (record.evaluation?.privacyStatus === "violation") contractFailures.privacyViolations += 1;
    if (record.evaluation?.canonicalStatus === "invalid") contractFailures.canonicalContractFailures += 1;
    if (record.expectedEligibility === "ineligible" && record.analysis) contractFailures.ineligibleCanonicalViolations += 1;
    if (record.evaluation?.eligibilityComparison === "mismatch") expectationFailures.eligibilityMismatches += 1;
    if (
      record.evaluation?.canonicalStatus === "not_evaluable" ||
      record.evaluation?.eligibilityComparison === "not_evaluable"
    ) notEvaluableCases += 1;
    else evaluableCases += 1;
    switch (record.transport?.status) {
      case "rate_limited": operationalFailures.rateLimitedCases += 1; break;
      case "client_error": operationalFailures.clientErrorCases += 1; break;
      case "server_error": operationalFailures.serverErrorCases += 1; break;
      case "timeout": operationalFailures.timeoutCases += 1; break;
      case "network_error": operationalFailures.networkErrorCases += 1; break;
      case "not_attempted": operationalFailures.notAttemptedCases += 1; break;
      default: break;
    }
    if (record.transport?.retryExhausted) operationalFailures.retryExhaustedCases += 1;
    if (record.variantRole === "baseline" && record.expectedEligibility === "eligible" && record.transport?.status === "success") {
      baselineTotal += 1;
      if (record.analysis?.status === "available" || record.analysis?.status === "partial") baselineUsable += 1;
    }
    if (Number.isFinite(record.transport?.durationMs) && record.transport.status === "success") {
      latencies.push(record.transport.durationMs);
    }
    const previous = allRecords.some((candidate) =>
      candidate.caseId === record.caseId &&
      candidate.recordSequence < record.recordSequence &&
      candidate.transport?.status !== "success"
    );
    if (record.transport?.status === "success" && previous) recoveredCases += 1;
  }

  const actualFailures = Object.values(contractFailures).reduce((sum, value) => sum + value, 0)
    + Object.values(expectationFailures).reduce((sum, value) => sum + value, 0);
  const finalCases = latest.length;
  const completeByCount = plannedCases !== null && finalCases === plannedCases;
  const evaluationComplete = Boolean(
    integrity?.valid !== false &&
    completeByCount &&
    notEvaluableCases === 0 &&
    operationalFailures.notAttemptedCases === 0 &&
    !legacyClassification
  );
  const gateStatus = actualFailures > 0
    ? "FAIL"
    : (evaluationComplete ? "PASS" : "INCONCLUSIVE");
  const issues = [];
  if (actualFailures) issues.push({ severity: "P0", code: "contract_or_expectation_failure", count: actualFailures });
  if (integrity?.valid === false) issues.push({ severity: "P0", code: "records_integrity_invalid", count: integrity.errors?.length || 1 });
  if (!completeByCount) issues.push({ severity: "P1", code: "planned_cases_incomplete" });
  if (notEvaluableCases) issues.push({ severity: "P1", code: "cases_not_evaluable", count: notEvaluableCases });
  if (legacyClassification) issues.push({ severity: "P1", code: "legacy_classification_partial" });

  const evaluableLatest = latest.filter((record) => record.transport?.status === "success" && record.evaluation?.canonicalStatus !== "not_evaluable");
  const repeatAgreement = buildAgreement(evaluableLatest, (record) => `${record.fixtureId}:${record.locale}`);
  const localeAgreement = buildAgreement(evaluableLatest, (record) => `${record.fixtureId}:${record.repetition}`);
  return {
    schemaVersion: SUMMARY_SCHEMA_VERSION,
    runId: runManifest.runId || null,
    datasetId: runManifest.datasetId || null,
    plan: runManifest.plan || null,
    gateStatus,
    evaluationComplete,
    legacyClassification,
    classificationConfidence: legacyClassification ? "partial" : "full",
    contractFailures,
    expectationFailures,
    operationalFailures,
    evaluationCounts: {
      plannedCases,
      finalCases,
      evaluableCases,
      notEvaluableCases
    },
    historicalAttempts: Math.max(0, allRecords.length - finalCases),
    recoveredCases,
    baseline: {
      total: baselineTotal,
      usable: baselineUsable,
      usableRate: baselineTotal ? baselineUsable / baselineTotal : null
    },
    repeatAgreement,
    localeAgreement,
    latency: {
      count: latencies.length,
      averageMs: latencies.length ? Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length) : null,
      p95Ms: percentile(latencies, 0.95)
    },
    recordsIntegrity: {
      valid: integrity?.valid !== false,
      errors: Array.isArray(integrity?.errors) ? integrity.errors.map((item) => ({ code: item.code, lineNumber: item.lineNumber ?? null })) : []
    },
    issues,
    // Compatibility aliases. Their v2 meanings are documented and never include operational failures.
    plannedCalls: plannedCases,
    completedCalls: finalCases,
    privacyFailures: contractFailures.privacyViolations,
    requestFailures: operationalFailures.rateLimitedCases + operationalFailures.clientErrorCases + operationalFailures.serverErrorCases + operationalFailures.timeoutCases + operationalFailures.networkErrorCases,
    canonicalContractFailures: contractFailures.canonicalContractFailures,
    ineligibleCanonicalViolations: contractFailures.ineligibleCanonicalViolations,
    eligibilityMismatches: expectationFailures.eligibilityMismatches,
    hardInvariantFailures: actualFailures
  };
}

function formatPercent(value) {
  return typeof value === "number" ? `${(value * 100).toFixed(1)}%` : "n/a";
}

export function renderHostedEvaluationReport(summary) {
  const lines = [
    "# Face Lab Hosted Evaluation Report v2",
    "",
    `- Gate status: ${summary.gateStatus}`,
    `- Evaluation complete: ${summary.evaluationComplete}`,
    `- Run: ${summary.runId || "unknown"}`,
    `- Dataset: ${summary.datasetId || "unknown"}`,
    `- Plan: ${summary.plan || "unknown"}`,
    `- Final cases: ${summary.evaluationCounts.finalCases}/${summary.evaluationCounts.plannedCases ?? "?"}`,
    `- Evaluable cases: ${summary.evaluationCounts.evaluableCases}`,
    `- Not evaluable cases: ${summary.evaluationCounts.notEvaluableCases}`,
    "",
    "## Contract failures",
    "",
    `- Privacy violations: ${summary.contractFailures.privacyViolations}`,
    `- Canonical contract failures: ${summary.contractFailures.canonicalContractFailures}`,
    `- Ineligible canonical violations: ${summary.contractFailures.ineligibleCanonicalViolations}`,
    "",
    "## Expectation failures",
    "",
    `- Eligibility mismatches: ${summary.expectationFailures.eligibilityMismatches}`,
    "",
    "## Operational failures",
    "",
    `- Rate-limited cases: ${summary.operationalFailures.rateLimitedCases}`,
    `- Client-error cases: ${summary.operationalFailures.clientErrorCases}`,
    `- Server-error cases: ${summary.operationalFailures.serverErrorCases}`,
    `- Timeout cases: ${summary.operationalFailures.timeoutCases}`,
    `- Network-error cases: ${summary.operationalFailures.networkErrorCases}`,
    `- Retry-exhausted cases: ${summary.operationalFailures.retryExhaustedCases}`,
    `- Not-attempted cases: ${summary.operationalFailures.notAttemptedCases}`,
    "",
    "## Attempts and recovery",
    "",
    `- Historical attempts: ${summary.historicalAttempts}`,
    `- Recovered cases: ${summary.recoveredCases}`,
    `- Records integrity: ${summary.recordsIntegrity.valid ? "valid" : "invalid"}`,
    "",
    "## Baseline and stability",
    "",
    `- Baseline usable: ${summary.baseline.usable}/${summary.baseline.total}`,
    `- Baseline usable rate: ${formatPercent(summary.baseline.usableRate)}`,
    `- Repeat status agreement: ${formatPercent(summary.repeatAgreement.statusAgreement)}`,
    `- Repeat value agreement: ${formatPercent(summary.repeatAgreement.valueAgreement)}`,
    `- Locale status agreement: ${formatPercent(summary.localeAgreement.statusAgreement)}`,
    `- Locale value agreement: ${formatPercent(summary.localeAgreement.valueAgreement)}`,
    `- Average successful latency: ${summary.latency.averageMs ?? "n/a"} ms`,
    `- P95 successful latency: ${summary.latency.p95Ms ?? "n/a"} ms`,
    "",
    "## Issues",
    ""
  ];
  if (!summary.issues.length) lines.push("- None detected by the v2 gates.");
  else for (const issue of summary.issues) lines.push(`- ${issue.severity}: ${issue.code}${issue.count ? ` (${issue.count})` : ""}`);
  if (summary.legacyClassification) {
    lines.push("", "Legacy v1 records were only partially reclassified. They cannot be promoted to a complete v2 PASS.");
  }
  lines.push("", "This report excludes source images, absolute paths, raw provider JSON, provider error messages, full headers, and evidence text.", "");
  return lines.join("\n");
}

export function createHostedEvaluationRunManifest({
  runId,
  datasetId,
  plan,
  locales,
  repetitions,
  maxCalls,
  maxAttempts,
  plannedCalls,
  baseUrl,
  createdAt = new Date().toISOString()
}) {
  if (!Number.isSafeInteger(repetitions) || repetitions < 1) throw new Error("repetitions must be positive");
  if (!Number.isSafeInteger(maxCalls) || maxCalls < 1) throw new Error("maxCalls must be positive");
  if (!Number.isSafeInteger(maxAttempts) || maxAttempts < 1) throw new Error("maxAttempts must be positive");
  return {
    schemaVersion: RUN_SCHEMA_VERSION,
    runId: cleanId(runId, "runId"),
    datasetId: cleanId(datasetId, "datasetId"),
    plan,
    locales: normalizeLocales(locales),
    repetitions,
    maxCalls,
    maxAttempts,
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
