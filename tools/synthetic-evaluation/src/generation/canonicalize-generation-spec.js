import { createHash } from "node:crypto";
import {
  GENERATION_BLEMISH_REGION_ORDER,
  GENERATION_REDNESS_REGION_ORDER,
  validateDraftGenerationSpec
} from "@bejewely/face-contracts";

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

export function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }
  for (const child of Object.values(value)) {
    deepFreeze(child);
  }
  return Object.freeze(value);
}

function sortByRegistry(values, registry) {
  return [...values].sort((left, right) => registry.indexOf(left) - registry.indexOf(right));
}

function normalizeSemanticArrays(spec) {
  const normalized = cloneJson(spec);
  normalized.skinIntent.redness.regions = sortByRegistry(
    normalized.skinIntent.redness.regions,
    GENERATION_REDNESS_REGION_ORDER
  );
  normalized.skinIntent.blemishes.regions = sortByRegistry(
    normalized.skinIntent.blemishes.regions,
    GENERATION_BLEMISH_REGION_ORDER
  );
  return normalized;
}

function sortKeys(value) {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, sortKeys(value[key])])
  );
}

export function stableStringify(value) {
  return JSON.stringify(sortKeys(value));
}

export function sha256Hex(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function buildGenerationSemanticPayload(draftSpec) {
  const validation = validateDraftGenerationSpec(draftSpec);
  if (!validation.ok) {
    return validation;
  }
  const normalized = normalizeSemanticArrays(draftSpec);
  normalized.provenance = {
    campaignId: normalized.provenance.campaignId,
    authoredBy: normalized.provenance.authoredBy,
    sourceTemplateId: normalized.provenance.sourceTemplateId,
    sourceTemplateVersion: normalized.provenance.sourceTemplateVersion
  };
  return Object.freeze({ ok: true, semanticPayload: deepFreeze(sortKeys(normalized)) });
}

export function finalizeGenerationSpec(draftSpec) {
  const result = buildGenerationSemanticPayload(draftSpec);
  if (!result.ok) {
    return result;
  }
  const canonicalJson = stableStringify(result.semanticPayload);
  const specDigest = sha256Hex(canonicalJson);
  const finalizedSpec = deepFreeze({
    ...cloneJson(draftSpec),
    specId: `gen_${specDigest.slice(0, 24)}`,
    specDigest
  });
  return Object.freeze({
    ok: true,
    semanticPayload: result.semanticPayload,
    canonicalJson,
    specDigest,
    finalizedSpec
  });
}
