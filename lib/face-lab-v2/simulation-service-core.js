import {
  FACE_LAB_SIMULATION_INSTRUCTION_VERSION,
  compileFaceLabSimulationInstruction
} from "./simulation-instructions.js";
import {
  FACE_LAB_RENDER_SPEC_VERSION
} from "./render-adapter.js";
import {
  FACE_LAB_SIMULATION_PROVIDER_CONFIG_VERSION,
  fingerprintFaceLabSimulationProviderConfig,
  normalizeFaceLabSimulationProviderConfig
} from "./simulation-provider-config.js";

export const FACE_LAB_AI_SIMULATION_VERSION =
  "face-lab-ai-simulation-v1";

export const FACE_LAB_SIMULATION_FIDELITY_VERSION =
  "face-lab-simulation-fidelity-v1";

export const FACE_LAB_SIMULATION_REQUIRED_CHECKS =
  Object.freeze([
    "identity_preservation",
    "route_adherence",
    "color_fidelity",
    "edit_scope"
  ]);

export async function generateFaceLabSimulationCore({
  apiKey,
  imageBuffer,
  mimeType,
  renderSpec,
  providerRuntime,
  model
} = {}) {
  if (
    typeof providerRuntime !==
    "function"
  ) {
    throw new Error(
      "simulation_provider_runtime_invalid"
    );
  }

  const compiled =
    compileFaceLabSimulationInstruction(
      renderSpec
    );

  if (compiled.status !== "ready") {
    throw new Error(
      `simulation_instruction_${compiled.reason || "invalid"}`
    );
  }

  const providerResult =
    await providerRuntime({
      apiKey,
      imageBuffer,
      mimeType,
      instruction:
        compiled.instruction,
      model,
      quality: "high",
      size: "auto",
      outputFormat: "png"
    });

  if (
    !providerResult ||
    !Buffer.isBuffer(
      providerResult.imageBytes
    ) ||
    !providerResult.imageBytes.length
  ) {
    throw new Error(
      "simulation_provider_result_invalid"
    );
  }

  const providerConfig =
    normalizeFaceLabSimulationProviderConfig(
      providerResult.providerConfig
    );
  const providerConfigFingerprint =
    fingerprintFaceLabSimulationProviderConfig(
      providerConfig
    );

  if (
    !providerConfig ||
    providerConfig.configVersion !==
      FACE_LAB_SIMULATION_PROVIDER_CONFIG_VERSION ||
    !providerConfigFingerprint ||
    providerConfigFingerprint !==
      providerResult.providerConfigFingerprint
  ) {
    throw new Error(
      "simulation_provider_config_invalid"
    );
  }

  return {
    simulationVersion:
      FACE_LAB_AI_SIMULATION_VERSION,
    status: "ready",
    provider:
      providerConfig.provider,
    model:
      providerConfig.model,
    providerConfigVersion:
      providerConfig.configVersion,
    providerConfigFingerprint,
    renderSpecVersion:
      FACE_LAB_RENDER_SPEC_VERSION,
    instructionVersion:
      FACE_LAB_SIMULATION_INSTRUCTION_VERSION,
    routeId:
      compiled.routeId,
    lookId:
      compiled.lookId,
    mimeType:
      providerResult.mimeType ||
      "image/png",
    imageBytes:
      providerResult.imageBytes,
    providerRequestId:
      providerResult.requestId ||
      null,
    fidelity: {
      version:
        FACE_LAB_SIMULATION_FIDELITY_VERSION,
      status: "not_evaluated",
      requiredChecks: [
        ...FACE_LAB_SIMULATION_REQUIRED_CHECKS
      ],
      evidence: []
    },
    telemetry: {
      attemptCount:
        Number.isSafeInteger(
          providerResult.attemptCount
        )
          ? providerResult.attemptCount
          : null,
      durationMs:
        Number.isFinite(
          providerResult.durationMs
        )
          ? providerResult.durationMs
          : null,
      responseBytes:
        Number.isFinite(
          providerResult.responseBytes
        )
          ? providerResult.responseBytes
          : null,
      outputBytes:
        Number.isFinite(
          providerResult.outputBytes
        )
          ? providerResult.outputBytes
          : providerResult.imageBytes.length,
      usage:
        providerResult.usage &&
        typeof providerResult.usage ===
          "object"
          ? structuredClone(
              providerResult.usage
            )
          : null
    }
  };
}
