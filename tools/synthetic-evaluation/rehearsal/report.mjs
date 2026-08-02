import { createHash } from "node:crypto";

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

export function sha256(value) {
  return createHash("sha256").update(typeof value === "string" ? value : stable(value)).digest("hex");
}

export function finalizeRehearsalReport(draft) {
  const semantic = {
    schemaVersion: "full-pipeline-rehearsal-report-v1",
    toolkitTrack: "T10",
    mode: "composed_operational_rehearsal",
    sourceHeadSha: draft.sourceHeadSha,
    scenarioMatrixDigest: draft.scenarioMatrixDigest,
    slotsTotal: draft.slotsTotal,
    conditionCounts: draft.conditionCounts,
    waveSchedule: draft.waveSchedule,
    expectedTerminalCounts: draft.expectedTerminalCounts,
    actualTerminalCounts: draft.actualTerminalCounts,
    moduleResults: draft.moduleResults,
    failureInjectionResults: draft.failureInjectionResults,
    providerCalls: draft.providerCalls,
    networkAttempts: draft.networkAttempts,
    productionWrites: draft.productionWrites,
    authoritativeHumanReviews: draft.authoritativeHumanReviews,
    persistentAuthoritativeG4Created: draft.persistentAuthoritativeG4Created,
    persistentAuthoritativeG5Created: draft.persistentAuthoritativeG5Created,
    temporaryRootsCreated: draft.temporaryRootsCreated,
    temporaryRootsDeleted: draft.temporaryRootsDeleted,
    cleanupVerified: draft.cleanupVerified,
    localDataBoundaryUnchanged: draft.localDataBoundaryUnchanged,
    singleArtifactLineageEndToEnd: false,
    authorityBoundaryNote: "Fake transport and rehearsal decisions are exercised in isolated authority domains and are not joined into one authoritative pilot lineage."
  };
  return Object.freeze({ ...semantic, completedAt: draft.completedAt, reportDigest: sha256(semantic) });
}

export function verifyRehearsalReport(report) {
  if (!report || report.schemaVersion !== "full-pipeline-rehearsal-report-v1" || report.toolkitTrack !== "T10") return false;
  const { completedAt, reportDigest, ...semantic } = report;
  if (typeof completedAt !== "string" || !Number.isFinite(Date.parse(completedAt))) return false;
  if (reportDigest !== sha256(semantic)) return false;
  if (report.slotsTotal !== 20 || JSON.stringify(report.waveSchedule) !== JSON.stringify([4, 8, 8])) return false;
  if (Object.values(report.conditionCounts).reduce((sum, value) => sum + value, 0) !== 20) return false;
  if (Object.values(report.conditionCounts).some((value) => value !== 5)) return false;
  if (stable(report.expectedTerminalCounts) !== stable(report.actualTerminalCounts)) return false;
  if (report.providerCalls !== 0 || report.networkAttempts !== 0 || report.productionWrites !== 0) return false;
  if (report.authoritativeHumanReviews !== 0 || report.persistentAuthoritativeG4Created !== 0 || report.persistentAuthoritativeG5Created !== 0) return false;
  if (!report.cleanupVerified || !report.localDataBoundaryUnchanged || report.temporaryRootsCreated !== report.temporaryRootsDeleted) return false;
  if (!Array.isArray(report.moduleResults) || report.moduleResults.some((item) => item.status !== "passed")) return false;
  if (!Array.isArray(report.failureInjectionResults) || report.failureInjectionResults.some((item) => item.status !== "passed")) return false;
  return true;
}

export function stableStringify(value) {
  return stable(value);
}
