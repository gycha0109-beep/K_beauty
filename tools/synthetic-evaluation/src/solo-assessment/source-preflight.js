import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { readCampaignBundle, nativePath } from "../campaign/storage.js";
import { derivePilotCampaignProjection } from "../campaign/projection.js";
import { resolveSafeContainedFile } from "../import/resolve-safe-path.js";
import { finalizeGenerationSpec, sha256Hex, stableStringify } from "../generation/canonicalize-generation-spec.js";
import { readObservationObject, readObservationRun } from "../observation/register-observation-run.js";
import { deriveSoloWaveShape, verifySoloWaveSlotShape } from "./wave-shape.js";

const HEX64 = /^[a-f0-9]{64}$/;

function failure(code, pathValue = "$", detail = null) {
  return Object.freeze({ ok: false, errors: Object.freeze([{ code, path: pathValue, detail }]), writesPerformed: 0 });
}

function hashBuffer(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function readSafeJson(dataRoot, relativePath, errorPath) {
  const resolved = await resolveSafeContainedFile(dataRoot, relativePath, errorPath);
  if (!resolved.ok) return null;
  try {
    return JSON.parse(await readFile(resolved.absolutePath, "utf8"));
  } catch {
    return null;
  }
}

function verifyFinalizedSpec(spec, expectedDigest) {
  if (!spec || spec.specDigest !== expectedDigest || spec.specId !== `gen_${expectedDigest.slice(0, 24)}`) return false;
  const { specId, specDigest, ...draft } = spec;
  const finalized = finalizeGenerationSpec(draft);
  return finalized.ok && finalized.specDigest === expectedDigest && stableStringify(finalized.finalizedSpec) === stableStringify(spec);
}

function verifyCompiledPrompt(prompt, expectedDigest, expectedSpecDigest) {
  if (!prompt || prompt.promptDigest !== expectedDigest || prompt.specDigest !== expectedSpecDigest) return false;
  const { promptDigest, ...semantic } = prompt;
  return sha256Hex(stableStringify(semantic)) === expectedDigest;
}

function intendedCueFromSpec(spec) {
  const redness = spec?.skinIntent?.redness?.severity;
  const blemishes = spec?.skinIntent?.blemishes?.severity;
  const blemishCountBand = spec?.skinIntent?.blemishes?.countBand;
  if (!["none","mild"].includes(redness) || !["none","mild"].includes(blemishes) || !["none","three_to_five"].includes(blemishCountBand)) return null;
  return Object.freeze({ redness, blemishes, blemishCountBand });
}

function expectedConditionCue(conditionId) {
  return Object.freeze({
    redness: ["B","D"].includes(conditionId) ? "mild" : "none",
    blemishes: ["C","D"].includes(conditionId) ? "mild" : "none",
    blemishCountBand: ["C","D"].includes(conditionId) ? "three_to_five" : "none"
  });
}

function sameCue(left, right) {
  return left && right && left.redness === right.redness && left.blemishes === right.blemishes && left.blemishCountBand === right.blemishCountBand;
}

function classifyReadiness(slotProjection) {
  if (slotProjection.terminalOutcome === "generation_failed_no_asset") return "technical_no_asset";
  if (slotProjection.terminalOutcome === "candidate_import_failed") return "technical_import_failure";
  if (slotProjection.terminalOutcome === "observation_failed") return "technical_observation_failure";
  if (["cancelled_budget_exhausted","cancelled_campaign_stop","cancelled_operator"].includes(slotProjection.terminalOutcome)) return "cancelled";
  if (slotProjection.terminalOutcome === "observation_valid_ineligible") return "assessable_valid_ineligible";
  if (slotProjection.refs?.observationObjectDigest) return "assessable_observed";
  return "not_ready";
}

function t5Status(slotProjection) {
  if (slotProjection.refs?.consensusDigest) return "present_but_not_used";
  if (["awaiting_consensus","consensus_sealed","awaiting_promotion_policy_reviews","awaiting_promotion_review","promotion_decision_registered","terminal"].includes(slotProjection.state) && !slotProjection.refs?.consensusDigest) return "incomplete";
  return "not_started";
}

async function verifyCandidateSource(dataRoot, slot, slotProjection) {
  const candidateId = slotProjection.refs?.candidateId;
  const candidateDigest = slotProjection.refs?.candidateDigest;
  const canonicalSha256 = slotProjection.refs?.canonicalSha256;
  if (!candidateId || !HEX64.test(candidateDigest || "") || !HEX64.test(canonicalSha256 || "")) return failure("solo_candidate_source_invalid", slot.slotId);
  const manifestRelativePath = path.posix.join("candidates", candidateId, "manifest.json");
  const manifest = await readSafeJson(dataRoot, manifestRelativePath, `candidate.${candidateId}`);
  if (!manifest || manifest.schemaVersion !== "candidate-manifest-v1" || manifest.state !== "G0_GENERATED" || manifest.candidateId !== candidateId || manifest.candidateDigest !== candidateDigest || manifest.asset?.canonicalSha256 !== canonicalSha256 || manifest.grouping?.conditionId !== slot.conditionId) return failure("solo_candidate_source_invalid", slot.slotId);

  const canonicalRelativePath = manifest.asset?.canonicalObjectRelativePath;
  const canonicalResolved = await resolveSafeContainedFile(dataRoot, canonicalRelativePath, `candidate.${candidateId}.canonical`);
  if (!canonicalResolved.ok) return failure("solo_candidate_source_invalid", slot.slotId, "canonical_path");
  const canonicalBytes = await readFile(canonicalResolved.absolutePath);
  if (hashBuffer(canonicalBytes) !== canonicalSha256) return failure("solo_candidate_source_invalid", slot.slotId, "canonical_sha");

  const specRef = manifest.generation?.artifactReferences?.spec;
  const promptRef = manifest.generation?.artifactReferences?.compiledPrompt;
  if (!specRef || !promptRef || specRef.digest !== manifest.generation?.specDigest || promptRef.digest !== manifest.generation?.promptDigest) return failure("solo_candidate_source_invalid", slot.slotId, "generation_refs");
  const [spec, prompt] = await Promise.all([
    readSafeJson(dataRoot, specRef.objectRelativePath, `candidate.${candidateId}.spec`),
    readSafeJson(dataRoot, promptRef.objectRelativePath, `candidate.${candidateId}.prompt`)
  ]);
  if (!verifyFinalizedSpec(spec, specRef.digest) || !verifyCompiledPrompt(prompt, promptRef.digest, specRef.digest)) return failure("solo_candidate_source_invalid", slot.slotId, "generation_integrity");
  const intendedSkinCue = intendedCueFromSpec(spec);
  if (!sameCue(intendedSkinCue, expectedConditionCue(slot.conditionId))) return failure("solo_intent_source_conflict", slot.slotId);
  return Object.freeze({
    ok: true,
    manifest,
    canonicalAsset: Object.freeze({ sha256: canonicalSha256, objectRelativePath: canonicalRelativePath }),
    finalizedSpecDigest: specRef.digest,
    compiledPromptDigest: promptRef.digest,
    intendedSkinCue
  });
}

async function verifyObservationSource(dataRoot, slotProjection, candidateId, canonicalSha256) {
  const runId = slotProjection.refs?.observationRunId;
  const runDigest = slotProjection.refs?.observationRunDigest;
  const objectDigest = slotProjection.refs?.observationObjectDigest;
  if (!runId || !HEX64.test(runDigest || "")) return failure("solo_observation_source_invalid", slotProjection.slotId, "run_ref");
  let run;
  try {
    run = await readObservationRun(dataRoot, candidateId, runId);
  } catch (error) {
    return failure("solo_observation_source_invalid", slotProjection.slotId, error?.code || "run_read");
  }
  if (run.manifestDigest !== runDigest || run.candidate?.canonicalSha256 !== canonicalSha256 || run.candidate?.candidateId !== candidateId) return failure("solo_observation_source_invalid", slotProjection.slotId, "run_binding");
  if (objectDigest) {
    if (run.observation?.digest !== objectDigest) return failure("solo_observation_source_invalid", slotProjection.slotId, "object_ref");
    try {
      const object = await readObservationObject(dataRoot, run.observation);
      if (object.observationDigest !== objectDigest || object.candidateId !== candidateId || object.canonicalSha256 !== canonicalSha256) return failure("solo_observation_source_invalid", slotProjection.slotId, "object_binding");
      return Object.freeze({ ok: true, observationDigest: objectDigest, observationObject: object });
    } catch (error) {
      return failure("solo_observation_source_invalid", slotProjection.slotId, error?.code || "object_read");
    }
  }
  return Object.freeze({ ok: true, observationDigest: objectDigest ?? null, observationObject: null });
}

export async function preflightSoloWaveSource({ dataRoot, runId, waveOrdinal, includeObservationObjects = false }) {
  if (typeof dataRoot !== "string" || dataRoot.length < 1 || !/^crun_[a-f0-9]{24}$/.test(runId || "") || ![1,2,3].includes(waveOrdinal)) return failure("solo_source_not_ready");
  let bundle;
  try {
    bundle = await readCampaignBundle(dataRoot, runId);
  } catch (error) {
    return failure("solo_t7_projection_invalid", "campaign", error?.detail || error?.code || null);
  }
  const projected = derivePilotCampaignProjection({ plan: bundle.plan, run: bundle.run, slots: bundle.slots, events: bundle.events });
  if (!projected.ok) return failure("solo_t7_projection_invalid", "projection", projected.errors);
  const projection = projected.projection;
  const waveStatus = projection.waveStatus.find((item) => item.waveOrdinal === waveOrdinal)?.status;
  if (!waveStatus || waveStatus === "not_issued" || waveStatus === "stopped") return failure("solo_wave_not_issued", "waveOrdinal", waveStatus || null);
  const derivedShape = deriveSoloWaveShape(bundle.plan, waveOrdinal);
  if (!derivedShape.ok) return failure("solo_wave_shape_invalid", "plan", derivedShape.errors);
  const waveShape = derivedShape.waveShape;
  const slots = bundle.slots.filter((slot) => slot.waveOrdinal === waveOrdinal);
  if (!verifySoloWaveSlotShape(waveShape, slots)) return failure("solo_wave_slot_count_invalid", "slots", {
    actualSlotCount: slots.length,
    expectedSlotCount: waveShape.expectedSlotCount,
    conditionCounts: waveShape.conditionCounts
  });

  const sourceRows = [];
  for (const slot of slots) {
    const slotProjection = projection.slotProjections.find((item) => item.slotId === slot.slotId);
    if (!slotProjection) return failure("solo_t7_projection_invalid", slot.slotId, "slot_projection_missing");
    const readiness = classifyReadiness(slotProjection);
    const authoritativeT5Status = t5Status(slotProjection);
    if (authoritativeT5Status === "present_but_not_used") return failure("solo_existing_t5_consensus_blocks_session", slot.slotId);
    const fixtureId = bundle.plan.matrix.find((item) => item.conditionId === slot.conditionId)?.fixtureId || null;

    if (["technical_no_asset","technical_import_failure","cancelled"].includes(readiness)) {
      sourceRows.push(Object.freeze({
        slotId: slot.slotId,
        conditionId: slot.conditionId,
        readiness,
        candidateId: null,
        canonicalAsset: null,
        observationDigest: null,
        authoritativeT5Status,
        fixtureId,
        finalizedSpecDigest: null,
        compiledPromptDigest: null,
        intendedSkinCue: null
      }));
      continue;
    }

    if (readiness === "not_ready") return failure("solo_source_not_ready", slot.slotId, slotProjection.state);
    const candidate = await verifyCandidateSource(dataRoot, slot, slotProjection);
    if (!candidate.ok) return candidate;
    let observationDigest = null;
    let observationObject = null;
    if (slotProjection.refs?.observationRunId) {
      const observation = await verifyObservationSource(dataRoot, slotProjection, candidate.manifest.candidateId, candidate.canonicalAsset.sha256);
      if (!observation.ok) return observation;
      observationDigest = observation.observationDigest;
      observationObject = observation.observationObject;
    } else if (readiness !== "technical_observation_failure") {
      return failure("solo_observation_source_invalid", slot.slotId, "observation_missing");
    }

    sourceRows.push(Object.freeze({
      slotId: slot.slotId,
      conditionId: slot.conditionId,
      readiness,
      candidateId: candidate.manifest.candidateId,
      canonicalAsset: candidate.canonicalAsset,
      observationDigest,
      ...(includeObservationObjects ? { observationObject } : {}),
      authoritativeT5Status,
      fixtureId,
      finalizedSpecDigest: candidate.finalizedSpecDigest,
      compiledPromptDigest: candidate.compiledPromptDigest,
      intendedSkinCue: candidate.intendedSkinCue
    }));
  }

  return Object.freeze({
    ok: true,
    plan: bundle.plan,
    run: bundle.run,
    projection,
    waveShape,
    sourceRows: Object.freeze(sourceRows),
    writesPerformed: 0
  });
}
