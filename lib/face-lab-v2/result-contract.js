export const FACE_LAB_V2_SCHEMA_VERSION = "face-lab-canonical-v2";

export const FACE_LAB_V2_STATUSES = new Set([
  "available",
  "partial",
  "insufficient_evidence",
  "unavailable"
]);

export const FACE_LAB_V2_DOMAIN_STATUSES = new Set([
  "available",
  "partial",
  "insufficient_evidence",
  "unavailable",
  "not_requested",
  "not_applicable"
]);

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cleanString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function cleanStringList(values) {
  return Array.isArray(values)
    ? [...new Set(values.map(cleanString).filter(Boolean))]
    : [];
}

function hasTargetStyle(value) {
  return isObject(value) &&
    (value.status === "available" || value.status === "partial" || value.status === "needs_confirmation");
}

export function deriveFaceLabV2OverallStatus(result) {
  if (!isObject(result)) {
    return "unavailable";
  }

  const faceStatus = result.currentFaceProfile?.status || "unavailable";
  if (faceStatus === "unavailable") {
    return "unavailable";
  }

  if (faceStatus === "insufficient_evidence") {
    return "insufficient_evidence";
  }

  if (!hasTargetStyle(result.targetStyle)) {
    return faceStatus === "available" ? "partial" : faceStatus;
  }

  const coreStatuses = [
    result.currentFaceProfile?.status,
    result.targetStyle?.status,
    result.styleDelta?.status,
    result.routes?.status
  ].filter(Boolean);

  if (coreStatuses.some((status) => status === "unavailable")) {
    return "partial";
  }

  if (coreStatuses.some((status) =>
    status === "partial" ||
    status === "insufficient_evidence" ||
    status === "needs_confirmation"
  )) {
    return "partial";
  }

  return coreStatuses.length >= 4 ? "available" : "partial";
}

export function createFaceLabV2CanonicalResult({
  resultId,
  analyzedAt = null,
  currentFaceProfile = null,
  quality = null,
  targetStyle = null,
  styleDelta = null,
  routes = null,
  hair = null,
  makeup = null,
  color = null,
  grooming = null,
  eyewear = null,
  accessories = null,
  faceAdjacentStyle = null,
  looks = null,
  archetypeFun = null,
  productHandoff = null,
  lineage = {},
  warnings = [],
  failureReason = null,
  updatedAt = null
} = {}) {
  const resolvedTarget = hasTargetStyle(targetStyle) ? targetStyle : null;

  const result = {
    schemaVersion: FACE_LAB_V2_SCHEMA_VERSION,
    resultId: cleanString(resultId) || null,
    status: "unavailable",
    analyzedAt: cleanString(analyzedAt),
    updatedAt: cleanString(updatedAt) || new Date().toISOString(),
    analysisVersion: cleanString(lineage?.faceRepresentationVersion) || null,
    targetProfileVersion: cleanString(targetStyle?.profileVersion) || null,
    decisionVersion: cleanString(lineage?.styleDeltaVersion) || null,
    failureReason: cleanString(failureReason),
    warnings: cleanStringList(warnings),
    quality: isObject(quality) ? quality : null,
    currentFaceProfile: isObject(currentFaceProfile) ? currentFaceProfile : null,
    targetStyle: resolvedTarget,
    styleDelta: resolvedTarget && isObject(styleDelta) ? styleDelta : null,
    routes: resolvedTarget && isObject(routes) ? routes : null,
    hair: resolvedTarget && isObject(hair) ? hair : null,
    makeup: resolvedTarget && isObject(makeup) ? makeup : null,
    color: resolvedTarget && isObject(color) ? color : null,
    grooming: resolvedTarget && isObject(grooming) ? grooming : null,
    eyewear: resolvedTarget && isObject(eyewear) ? eyewear : null,
    accessories: resolvedTarget && isObject(accessories) ? accessories : null,
    faceAdjacentStyle: resolvedTarget && isObject(faceAdjacentStyle) ? faceAdjacentStyle : null,
    looks: resolvedTarget && isObject(looks) ? looks : null,
    archetypeFun: isObject(archetypeFun) ? archetypeFun : null,
    productHandoff: resolvedTarget && isObject(productHandoff) ? productHandoff : null,
    lineage: isObject(lineage) ? { ...lineage } : {}
  };

  result.status = deriveFaceLabV2OverallStatus(result);

  if (result.status === "available" || result.status === "partial") {
    result.failureReason = null;
  } else if (!result.failureReason) {
    result.failureReason = result.currentFaceProfile?.unavailableReason || "face_lab_v2_not_ready";
  }

  return result;
}

export function isFaceLabV2CanonicalResult(value) {
  if (
    !isObject(value) ||
    value.schemaVersion !== FACE_LAB_V2_SCHEMA_VERSION ||
    !FACE_LAB_V2_STATUSES.has(value.status) ||
    !isObject(value.lineage)
  ) {
    return false;
  }

  if (!isObject(value.currentFaceProfile)) {
    return false;
  }

  if (!hasTargetStyle(value.targetStyle)) {
    return value.styleDelta === null &&
      value.routes === null &&
      value.hair === null &&
      value.makeup === null &&
      value.color === null &&
      value.grooming === null &&
      value.eyewear === null &&
      value.accessories === null &&
      value.faceAdjacentStyle === null &&
      value.looks === null &&
      value.productHandoff === null;
  }

  return true;
}
