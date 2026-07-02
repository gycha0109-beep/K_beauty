import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export const SURVEY_INPUT_CONTRACT_RUNTIME_AUDIT_DIR = path.join(
  process.cwd(),
  "tmp",
  "survey-input-contract-runtime-audit"
);

export const SURVEY_INPUT_CONTRACT_RUNTIME_AUDIT_EVENTS_FILE = "events.jsonl";

function asArray(value) {
  return Array.isArray(value) ? value.filter((item) => item !== undefined && item !== null) : [];
}

function asBoolean(value) {
  return typeof value === "boolean" ? value : Boolean(value);
}

export function buildSurveyInputContractDevAuditEvent(contract, options = {}) {
  return {
    timestamp: options.timestamp || new Date().toISOString(),
    source: contract?.metadata?.source || "unknown",
    primaryConcern: contract?.goals?.primaryConcern ?? null,
    secondaryConcerns: asArray(contract?.goals?.secondaryConcerns),
    unresolvedPrimaryConcern: asBoolean(contract?.goals?.unresolvedPrimaryConcern),
    safety: {
      recentSkinChange: contract?.safety?.recentSkinChange || "unknown",
      recentlyChangedProduct: contract?.safety?.recentlyChangedProduct || "unknown",
      sensitivityRisk: contract?.safety?.sensitivityRisk || "unknown",
      drynessRisk: contract?.safety?.drynessRisk || "unknown",
      rednessRisk: contract?.safety?.rednessRisk || "unknown"
    },
    missingFields: asArray(contract?.metadata?.missingFields),
    warnings: asArray(contract?.metadata?.warnings),
    sunscreenSourceCompleteness: contract?.sunscreen?.sourceCompleteness || "unknown",
    hasImage: asBoolean(options.hasImage),
    requestId: options.requestId || crypto.randomUUID()
  };
}

export function appendSurveyInputContractDevAuditEvent(contract, options = {}) {
  if (process.env.NODE_ENV !== "development") {
    return {
      ok: true,
      skipped: true,
      reason: "not_development"
    };
  }

  try {
    const auditDir = options.auditDir || SURVEY_INPUT_CONTRACT_RUNTIME_AUDIT_DIR;
    const eventsPath = path.join(auditDir, SURVEY_INPUT_CONTRACT_RUNTIME_AUDIT_EVENTS_FILE);
    const event = buildSurveyInputContractDevAuditEvent(contract, options);

    mkdirSync(auditDir, { recursive: true });
    appendFileSync(eventsPath, `${JSON.stringify(event)}\n`, "utf8");

    return {
      ok: true,
      skipped: false,
      path: eventsPath
    };
  } catch (error) {
    return {
      ok: false,
      skipped: false,
      error
    };
  }
}
