import { createBlindJudgmentInput } from "@bejewely/face-contracts";
import { readObservationObject, readObservationRun } from "../observation/register-observation-run.js";
import { alignJudgmentToIntent } from "./alignment.js";
import { readJudgmentConsensus } from "./blind-registrar.js";
import { deriveG2ObservedRecord, deriveG3ConsensusRecord } from "./grades.js";
import { readAndResolveCandidateIntent } from "./read-intent-artifacts.js";

function failure(code, path, detail = null) {
  return Object.freeze({ ok: false, errors: Object.freeze([{ code, path, detail }]) });
}

function blindCandidateFromManifest(manifest) {
  return Object.freeze({
    candidateId: manifest.candidateId,
    canonicalAsset: Object.freeze({
      sha256: manifest.asset.canonicalSha256,
      objectRelativePath: manifest.asset.canonicalObjectRelativePath,
      transformPolicyVersion: manifest.asset.canonicalTransformPolicyVersion
    })
  });
}

async function verifyStoredObservationAuthority({ dataRoot, consensus, candidateManifest }) {
  const blindCandidate = blindCandidateFromManifest(candidateManifest);
  let run;
  let observationObject;
  let blindInput;
  try {
    run = await readObservationRun(dataRoot, consensus.candidateId, consensus.observationRunId);
    if (!run.observation) return failure("blind_judgment_input_unavailable", "observationRun", "observation_missing");
    observationObject = await readObservationObject(dataRoot, run.observation);
    blindInput = createBlindJudgmentInput({ run, observationObject, blindCandidate });
  } catch (error) {
    return failure(error?.code || "blind_judgment_input_unavailable", "observationRun");
  }
  if (
    blindInput.candidateId !== consensus.candidateId ||
    blindInput.observationRunId !== consensus.observationRunId ||
    blindInput.observationDigest !== consensus.observationDigest ||
    blindInput.canonicalAsset.sha256 !== consensus.canonicalSha256
  ) {
    return failure("intent_join_mismatch", "consensus", "observation_authority_mismatch");
  }
  return Object.freeze({ ok: true, run, observationObject, blindInput });
}

export async function prepareStoredJudgmentAlignment({
  dataRoot,
  candidateId,
  consensusDigest,
  alignedAt = new Date().toISOString(),
  recordedAt = new Date().toISOString()
}) {
  let consensus;
  try {
    consensus = await readJudgmentConsensus(dataRoot, candidateId, consensusDigest);
  } catch (error) {
    return failure(error?.code || "judgment_consensus_integrity_invalid", "consensus");
  }
  const artifacts = await readAndResolveCandidateIntent({ dataRoot, candidateId });
  if (!artifacts.ok) return artifacts;
  const authority = await verifyStoredObservationAuthority({
    dataRoot,
    consensus,
    candidateManifest: artifacts.candidateManifest
  });
  if (!authority.ok) return authority;
  const aligned = alignJudgmentToIntent({
    consensus,
    candidateManifest: artifacts.candidateManifest,
    finalizedSpec: artifacts.finalizedSpec,
    compiledPrompt: artifacts.compiledPrompt,
    alignedAt
  });
  if (!aligned.ok) return aligned;
  const g2 = deriveG2ObservedRecord({
    run: authority.run,
    observationObject: authority.observationObject,
    recordedAt
  });
  if (!g2.ok) return g2;
  const g3 = deriveG3ConsensusRecord({
    consensus,
    alignment: aligned.alignment,
    recordedAt
  });
  if (!g3.ok) return g3;
  return Object.freeze({
    ok: true,
    consensus,
    alignment: aligned.alignment,
    g2: g2.gradeRecord,
    g3: g3.gradeRecord
  });
}
