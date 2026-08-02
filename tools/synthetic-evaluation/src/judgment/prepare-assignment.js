import { createBlindJudgmentInput } from "@bejewely/face-contracts";
import { readObservationObject, readObservationRun } from "../observation/register-observation-run.js";
import { createBlindJudgmentAssignment } from "./assignment.js";

export async function prepareBlindJudgmentAssignment({
  dataRoot,
  blindCandidate,
  observationRunId,
  issuedAt = new Date().toISOString()
}) {
  let run;
  let observationObject;
  try {
    run = await readObservationRun(dataRoot, blindCandidate?.candidateId, observationRunId);
    if (!run.observation) {
      return Object.freeze({ ok: false, errors: Object.freeze([{ code: "blind_judgment_input_unavailable", path: "observationRun", detail: "observation_missing" }]) });
    }
    observationObject = await readObservationObject(dataRoot, run.observation);
  } catch (error) {
    return Object.freeze({ ok: false, errors: Object.freeze([{ code: error?.code || "blind_judgment_input_unavailable", path: "observationRun", detail: null }]) });
  }
  let blindInput;
  try {
    blindInput = createBlindJudgmentInput({ run, observationObject, blindCandidate });
  } catch {
    return Object.freeze({ ok: false, errors: Object.freeze([{ code: "blind_judgment_input_unavailable", path: "observationRun", detail: null }]) });
  }
  return createBlindJudgmentAssignment(blindInput, { issuedAt });
}
