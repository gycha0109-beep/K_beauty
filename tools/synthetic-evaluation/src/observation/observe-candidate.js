import { preflightObservationRun } from "./preflight-observation.js";
import { createObservationExecutionClaim, registerObservationRun } from "./register-observation-run.js";
import { normalizeObservationPayload } from "./normalize-observation.js";
import { ELIGIBLE_PARITY_FIXTURE } from "./parity-fixtures.js";
import { executeBoundedOpenAIObservation, ObservationTransportError } from "./openai-transport.js";
import { OBSERVATION_PROMPT } from "./snapshot/canonical-v1.js";

function publicPreflight(result) {
  if (!result.ok) return result;
  if (result.state === "existing_run") {
    return Object.freeze({ ok: true, state: "existing_run", runId: result.identity.runId, runDigest: result.identity.runDigest, run: result.existingManifest });
  }
  return Object.freeze({
    ok: true,
    state: "ready",
    runId: result.identity.runId,
    runDigest: result.identity.runDigest,
    provider: result.modeProfile.provider,
    model: result.identity.semanticPayload.model,
    maximumImageProviderAttempts: result.modeProfile.maximumAttempts,
    automaticRetry: false,
    persistentWrites: 0
  });
}

export async function observeCandidate({
  request,
  action,
  dataRoot,
  apiKey = null,
  fixturePayload = null,
  fetchImpl = fetch,
  now = () => new Date()
}) {
  if (!["preflight", "execute"].includes(action)) {
    return Object.freeze({ ok: false, errors: [{ code: "observation_action_invalid", path: "action" }] });
  }
  const preflight = await preflightObservationRun({ request, dataRoot });
  if (!preflight.ok || action === "preflight" || preflight.state === "existing_run") return publicPreflight(preflight);
  if (request.execution.mode === "provider_bounded" && (typeof apiKey !== "string" || !apiKey.trim())) {
    return Object.freeze({ ok: false, errors: [{ code: "provider_credential_missing", path: "execution" }] });
  }

  await createObservationExecutionClaim({ preflight, request, now });
  const startedAt = now().toISOString();
  let telemetry = {
    provider: preflight.modeProfile.provider,
    model: request.execution.requestedModel,
    imageProviderAttemptCount: 0,
    inputTokens: null,
    outputTokens: null
  };

  try {
    let rawObservation;
    if (request.execution.mode === "fixture_replay") {
      rawObservation = fixturePayload || ELIGIBLE_PARITY_FIXTURE;
    } else {
      const result = await executeBoundedOpenAIObservation({
        apiKey,
        imageBuffer: preflight.imageBuffer,
        model: request.execution.requestedModel,
        prompt: OBSERVATION_PROMPT,
        limits: preflight.profile.limits,
        fetchImpl
      });
      rawObservation = result.rawObservation;
      telemetry = result.telemetry;
    }

    const normalized = normalizeObservationPayload(rawObservation, {
      provider: preflight.modeProfile.provider,
      model: request.execution.requestedModel
    });
    const completedAt = now().toISOString();
    if (!normalized.ok) {
      const registered = await registerObservationRun({
        dataRoot,
        request,
        preflight,
        startedAt,
        completedAt,
        telemetry,
        outcome: "contract_failure",
        failure: { code: normalized.code, category: "normalization" },
        now
      });
      return Object.freeze({ ok: false, state: "registered_failure", run: registered.run });
    }

    const registered = await registerObservationRun({
      dataRoot,
      request,
      preflight,
      startedAt,
      completedAt,
      telemetry,
      bundle: normalized.bundle,
      outcome: "observed_bundle",
      now
    });
    return Object.freeze({ ok: true, state: "registered", run: registered.run });
  } catch (error) {
    if (!(error instanceof ObservationTransportError)) throw error;
    telemetry = {
      ...telemetry,
      imageProviderAttemptCount: error.attemptCount
    };
    const registered = await registerObservationRun({
      dataRoot,
      request,
      preflight,
      startedAt,
      completedAt: now().toISOString(),
      telemetry,
      outcome: "provider_failure",
      failure: { code: error.code, category: error.category },
      now
    });
    return Object.freeze({ ok: false, state: "registered_failure", run: registered.run });
  }
}
