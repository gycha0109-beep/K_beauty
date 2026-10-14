// Skin Track presentation-only adapter. Does not change saved data or canonical decisions.
export type SkinPhotoEvidenceStatus =
  | "available"
  | "not_provided"
  | "unavailable"
  | "ineligible"
  | "insufficient_evidence"
  | "unknown";

export type SkinPhotoDisplayState = Readonly<{
  status: SkinPhotoEvidenceStatus;
  statusConflict: boolean;
  highOrMediumObservationCount: number;
}>;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}
function nested(record: Record<string, unknown> | null, key: string) {
  return asRecord(record?.[key]);
}
function normalizedStatus(value: unknown): SkinPhotoEvidenceStatus {
  switch (typeof value === "string" ? value.trim() : "") {
    case "available":
    case "not_provided":
    case "unavailable":
    case "ineligible":
    case "insufficient_evidence":
      return value as SkinPhotoEvidenceStatus;
    default:
      return "unknown";
  }
}

export function resolveSkinPhotoDisplayState(report: unknown): SkinPhotoDisplayState {
  const source = asRecord(report);
  const free = nested(source, "freeResult");
  const bundle = nested(source, "decisionBundle");
  const context = nested(bundle, "context");
  const canonicalPhoto = nested(context, "photo");
  const explicit = nested(source, "photoEvidenceState") || nested(free, "photoEvidenceState");
  const explicitStatus = normalizedStatus(explicit?.status);
  const canonicalStatus = normalizedStatus(canonicalPhoto?.status);
  // Original photo failure is more trustworthy than a legacy v4 fallback-object promotion.
  // Never infer "available" from a bare object or from the old canonical status alone.
  const status: SkinPhotoEvidenceStatus = explicitStatus !== "unknown"
    ? explicitStatus
    : canonicalStatus !== "available" ? canonicalStatus : "unknown";
  const statusConflict = explicitStatus !== "unknown" &&
    canonicalStatus !== "unknown" && explicitStatus !== canonicalStatus;
  const observations = nested(source, "photoObservations") || nested(free, "photoObservations");
  const cues = Array.isArray(observations?.signals) ? observations.signals : [];
  const highOrMediumObservationCount = status === "available"
    ? cues.filter((value) => {
        const item = asRecord(value);
        return item && ["high", "medium"].includes(String(item.confidence));
      }).length
    : 0;
  return { status, statusConflict, highOrMediumObservationCount };
}
