// Skin S5 off-production evidence checklist. Never approves an actual release.
export const SKIN_READINESS_VERSION = "face-lab-skin-readiness-v1";
export const SKIN_PRODUCT_GATES = Object.freeze({
  s0_current_code_audit: "repository",
  s1_independent_human_accuracy: "human",
  s2_human_decision_safety: "human",
  s3_real_capture_repeatability: "device",
  s4_mobile_web_uat: "device"
});
export const SKIN_RELEASE_GATES = Object.freeze({
  sca_security: "security",
  privacy_consent_retention: "privacy",
  auth_rls_storage_review: "security",
  production_ci_regression: "ci",
  rollback_and_monitoring: "operations",
  responsible_owner_approval: "governance"
});
const GATES = { ...SKIN_PRODUCT_GATES, ...SKIN_RELEASE_GATES };
const KEYS = new Set(Object.keys(GATES));
const VALUES = new Set(["pass", "hold", "fail"]);
const EVIDENCE_FIELDS = new Set(["status", "family", "reference"]);
function isRecord(v) { return Boolean(v) && typeof v === "object" && !Array.isArray(v); }
function validateEvidence(record, key) {
  if (!isRecord(record) || Object.keys(record).some(k => !EVIDENCE_FIELDS.has(k))) throw new Error("invalid_gate_record:" + key);
  if (!VALUES.has(record.status)) throw new Error("invalid_gate_status:" + key);
  if (record.family !== GATES[key]) throw new Error("evidence_family_mismatch:" + key);
  if (record.status === "pass" && (typeof record.reference !== "string" ||
      !/^[A-Za-z0-9_\-.:/#]{4,256}$/.test(record.reference))) {
    throw new Error("passing_gate_requires_opaque_reference:" + key);
  }
}
export function evaluateSkinReadiness(input = {}) {
  if (!isRecord(input) || Object.keys(input).some(k => !["schemaVersion", "gateEvidence"].includes(k)) ||
      input.schemaVersion !== SKIN_READINESS_VERSION || !isRecord(input.gateEvidence)) {
    throw new Error("readiness_manifest_invalid");
  }
  for (const [key, row] of Object.entries(input.gateEvidence)) {
    if (!KEYS.has(key)) throw new Error("unknown_gate:" + key);
    validateEvidence(row, key);
  }
  const report = gates => {
    const statuses = Object.keys(gates).map(key => ({
      gate: key, expectedFamily: gates[key],
      status: input.gateEvidence[key]?.status || "hold",
      reference: input.gateEvidence[key]?.status === "pass" ? input.gateEvidence[key].reference : null
    }));
    const failed = statuses.filter(row => row.status === "fail").map(row => row.gate);
    const pending = statuses.filter(row => row.status !== "pass").map(row => row.gate);
    return {
      evidenceStatus: failed.length ? "BLOCKED" : pending.length ? "HOLD" : "EXTERNAL_REVIEW_REQUIRED",
      failed,
      pending,
      statuses
    };
  };
  const product = report(SKIN_PRODUCT_GATES), releaseEvidence = report(SKIN_RELEASE_GATES);
  const release = {
    ...releaseEvidence,
    evidenceStatus: product.evidenceStatus === "BLOCKED" || releaseEvidence.evidenceStatus === "BLOCKED"
      ? "BLOCKED"
      : product.evidenceStatus !== "EXTERNAL_REVIEW_REQUIRED" ||
          releaseEvidence.evidenceStatus !== "EXTERNAL_REVIEW_REQUIRED"
        ? "HOLD"
        : "EXTERNAL_REVIEW_REQUIRED"
  };
  return {
    version: SKIN_READINESS_VERSION,
    product,
    release,
    authority: {
      realEvidenceAuthenticityVerified: false,
      humanOrPrivacyOwnerSignatureVerified: false,
      productReadyAuthorized: false,
      releaseReadyAuthorized: false,
      noProductionWrites: true
    }
  };
}
