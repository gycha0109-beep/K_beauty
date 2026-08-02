import {
  ALIGNMENT_POLICY_VERSION,
  CANONICAL_OBSERVATION_PROFILE,
  CANDIDATE_IMPORT_REQUEST_SCHEMA_VERSION,
  COMPILED_PROMPT_SCHEMA_VERSION,
  GENERATION_SPEC_SCHEMA_VERSION,
  JUDGMENT_POLICY_VERSION,
  OBSERVATION_RUN_REQUEST_SCHEMA_VERSION,
  PILOT_ALLOWED_PROVIDER_PROFILES,
  PILOT_FIXTURE_SET_ID,
  PILOT_SOURCE_FREEZE_SCHEMA_VERSION,
  PROMOTION_POLICY_ID,
  PROMOTION_POLICY_VERSION,
  PROMPT_COMPILER_VERSION
} from "@bejewely/face-contracts";
import { compileGenerationPrompt } from "../generation/compile-prompt.js";
import { SKIN_CONTROL_FIXTURES } from "../generation/fixtures/skin-control-fixtures.js";
import { resolveProviderProfile } from "../generation/providers/provider-profiles.js";
import { deepFreeze, sha256Hex, stableStringify } from "../shared/canonical-json.js";

const CONDITIONS = Object.freeze(["A", "B", "C", "D"]);
const HEX64 = /^[a-f0-9]{64}$/;

function semantic(value) {
  const { sourceFreezeDigest, ...rest } = value;
  return rest;
}

export function buildPilotSourceFreeze(providerProfileId) {
  if (!PILOT_ALLOWED_PROVIDER_PROFILES.includes(providerProfileId)) {
    return Object.freeze({ ok: false, errors: Object.freeze([{ code: "campaign_provider_profile_invalid", path: "providerProfileId", detail: null }]) });
  }
  const provider = resolveProviderProfile(providerProfileId);
  if (!provider || provider.status !== "active_pilot" || provider.executionMode !== "manual_web" || provider.version !== "1.0.0") {
    return Object.freeze({ ok: false, errors: Object.freeze([{ code: "campaign_provider_profile_invalid", path: "providerProfileId", detail: null }]) });
  }
  const fixtureObjectDigests = {};
  const finalizedSpecDigests = {};
  for (const condition of CONDITIONS) {
    const fixture = SKIN_CONTROL_FIXTURES[condition];
    fixtureObjectDigests[condition] = sha256Hex(stableStringify(fixture));
    const compiled = compileGenerationPrompt({ draftSpec: fixture.spec, providerProfileId });
    if (!compiled.ok) {
      return Object.freeze({ ok: false, errors: Object.freeze([{ code: "campaign_source_freeze_drift", path: `fixtures.${condition}`, detail: compiled.errors?.[0]?.code || null }]) });
    }
    finalizedSpecDigests[condition] = compiled.canonicalSpec.finalizedSpec.specDigest;
  }
  const value = {
    schemaVersion: PILOT_SOURCE_FREEZE_SCHEMA_VERSION,
    generationSpecSchemaVersion: GENERATION_SPEC_SCHEMA_VERSION,
    compiledPromptSchemaVersion: COMPILED_PROMPT_SCHEMA_VERSION,
    promptCompilerVersion: PROMPT_COMPILER_VERSION,
    fixtureSetId: PILOT_FIXTURE_SET_ID,
    fixtureObjectDigests,
    finalizedSpecDigests,
    providerProfileId: provider.id,
    providerProfileVersion: provider.version,
    providerProfileDigest: sha256Hex(stableStringify(provider)),
    providerTemplateVersion: provider.templateVersion,
    t3ImportPolicyVersion: CANDIDATE_IMPORT_REQUEST_SCHEMA_VERSION,
    t4ObservationContractVersion: OBSERVATION_RUN_REQUEST_SCHEMA_VERSION,
    t4AdapterProfileId: CANONICAL_OBSERVATION_PROFILE.id,
    t4AdapterProfileVersion: CANONICAL_OBSERVATION_PROFILE.version,
    t5JudgmentPolicyVersion: `${JUDGMENT_POLICY_VERSION}+alignment-${ALIGNMENT_POLICY_VERSION}`,
    t6PromotionPolicyId: PROMOTION_POLICY_ID,
    t6PromotionPolicyVersion: PROMOTION_POLICY_VERSION
  };
  const sourceFreezeDigest = sha256Hex(stableStringify(value));
  return Object.freeze({ ok: true, sourceFreeze: deepFreeze({ ...value, sourceFreezeDigest }) });
}

export function verifyPilotSourceFreeze(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) || !HEX64.test(value.sourceFreezeDigest || "")) return false;
  return value.sourceFreezeDigest === sha256Hex(stableStringify(semantic(value)));
}

export function verifyPilotSourceFreezeCurrent(value) {
  if (!verifyPilotSourceFreeze(value)) return false;
  const rebuilt = buildPilotSourceFreeze(value.providerProfileId);
  return rebuilt.ok && stableStringify(value) === stableStringify(rebuilt.sourceFreeze);
}
