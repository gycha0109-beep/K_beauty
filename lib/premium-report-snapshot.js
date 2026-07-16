import { createHash } from "node:crypto";

export const PREMIUM_REPORT_SNAPSHOT_VERSION = "premium-report-snapshot-v1";
export const PREMIUM_REPORT_DOCUMENT_VERSION = "premium-v2";

const TRANSIENT_KEYS = new Set([
  "generatedAt",
  "savedReportId",
  "sessionId",
  "premiumSessionToken",
  "topPickFitGauges"
]);

function normalize(value) {
  if (Array.isArray(value)) return value.map(normalize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .filter((key) => !TRANSIENT_KEYS.has(key))
      .sort()
      .map((key) => [key, normalize(value[key])])
  );
}

export function resolvePremiumReportLocale(report) {
  return report?.locale === "en" ? "en" : "ko";
}

export function buildPremiumReportSnapshot(report) {
  if (!report || typeof report !== "object" || Array.isArray(report)) return null;
  const canonical = normalize(report);
  const serialized = JSON.stringify(canonical);
  return {
    version: PREMIUM_REPORT_SNAPSHOT_VERSION,
    fingerprint: createHash("sha256").update(serialized).digest("hex"),
    contextHash: report?.decisionBundle?.contextHash || null,
    contextRevision: Number.isFinite(report?.decisionBundle?.contextRevision)
      ? report.decisionBundle.contextRevision
      : null,
    reportVersion: PREMIUM_REPORT_DOCUMENT_VERSION,
    decisionBundleVersion: report?.decisionBundle?.version || null,
    locale: resolvePremiumReportLocale(report),
    canonical
  };
}

export function classifyPremiumSnapshotReplay(existingReport, nextReport) {
  const existing = buildPremiumReportSnapshot(existingReport);
  const next = buildPremiumReportSnapshot(nextReport);
  if (!existing || !next) return { status: "invalid_snapshot", existing, next };
  return existing.fingerprint === next.fingerprint
    ? { status: "existing", existing, next }
    : { status: "conflict", existing, next };
}
