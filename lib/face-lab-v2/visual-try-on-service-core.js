import {
  createHash
} from "node:crypto";
import {
  FACE_LAB_SIMULATION_INSTRUCTION_VERSION,
  compileFaceLabSimulationInstruction
} from "./simulation-instructions.js";
import {
  FACE_LAB_SIMULATION_PROVIDER_CONFIG_VERSION,
  fingerprintFaceLabSimulationProviderConfig,
  normalizeFaceLabSimulationProviderConfig
} from "./simulation-provider-config.js";
import {
  FACE_LAB_VISUAL_TRY_ON_AUTHORITY_VERSION
} from "./visual-try-on-authority.js";

export const FACE_LAB_VISUAL_TRY_ON_SERVICE_VERSION =
  "face-lab-visual-try-on-service-v1";

export const FACE_LAB_VISUAL_TRY_ON_PROVIDER_REQUEST_VERSION =
  "face-lab-visual-try-on-provider-request-v1";

function cleanString(value) {
  return typeof value === "string" &&
    value.trim()
    ? value.trim()
    : null;
}

function sha256(bytes) {
  return createHash("sha256")
    .update(bytes)
    .digest("hex");
}

function invalidProviderRequest(
  reason,
  details = {}
) {
  return {
    requestVersion:
      FACE_LAB_VISUAL_TRY_ON_PROVIDER_REQUEST_VERSION,
    status: "invalid",
    reason,
    instructionVersion:
      FACE_LAB_SIMULATION_INSTRUCTION_VERSION,
    instruction: null,
    referenceImages: [],
    referenceManifest: [],
    ...details
  };
}

function buildReferenceInstruction(
  referenceManifest
) {
  if (!referenceManifest.length) {
    return "";
  }

  const lines = [
    "",
    "Reference image rules:",
    "Image 1 is the source portrait and is the sole identity authority.",
    "Do not copy a reference person's identity, facial geometry, pose, background, or unrelated styling into the source portrait.",
    "Use each reference image only for the explicitly mapped slot and visual property."
  ];

  for (
    const reference of
      referenceManifest
  ) {
    lines.push(
      [
        `Image ${reference.providerImageIndex}`,
        `slot=${reference.slotKey}`,
        `role=${reference.role}`,
        `asset=${reference.assetRef}`
      ].join("; ") + "."
    );
  }

  return lines.join("\n");
}

export function buildFaceLabVisualTryOnProviderRequest({
  authority,
  resolvedReferenceImages = []
} = {}) {
  if (
    !authority ||
    authority.status !== "ready" ||
    authority.authorityVersion !==
      FACE_LAB_VISUAL_TRY_ON_AUTHORITY_VERSION ||
    authority.providerPayload !== null ||
    authority.imageModelInvoked !== false ||
    !authority.renderSpec ||
    authority.renderSpec.status !== "ready"
  ) {
    return invalidProviderRequest(
      "visual_try_on_authority_invalid"
    );
  }

  if (
    !Array.isArray(
      authority.referenceAssets
    ) ||
    !Array.isArray(
      resolvedReferenceImages
    )
  ) {
    return invalidProviderRequest(
      "reference_collection_invalid"
    );
  }

  const resolvedByAssetRef =
    new Map();

  for (
    const rawReference of
      resolvedReferenceImages
  ) {
    const assetRef =
      cleanString(
        rawReference?.assetRef
      );

    if (
      !assetRef ||
      resolvedByAssetRef.has(
        assetRef
      ) ||
      !Buffer.isBuffer(
        rawReference?.imageBuffer
      ) ||
      !rawReference.imageBuffer.length ||
      !cleanString(
        rawReference?.mimeType
      )
    ) {
      return invalidProviderRequest(
        resolvedByAssetRef.has(
          assetRef
        )
          ? "resolved_reference_duplicate"
          : "resolved_reference_invalid"
      );
    }

    resolvedByAssetRef.set(
      assetRef,
      {
        assetRef,
        mimeType:
          cleanString(
            rawReference.mimeType
          ),
        imageBuffer:
          rawReference.imageBuffer
      }
    );
  }

  if (
    resolvedByAssetRef.size !==
    authority.referenceAssets.length
  ) {
    return invalidProviderRequest(
      "resolved_reference_count_mismatch"
    );
  }

  const referenceImages = [];
  const referenceManifest = [];

  for (
    let index = 0;
    index <
      authority.referenceAssets.length;
    index += 1
  ) {
    const descriptor =
      authority.referenceAssets[index];
    const resolved =
      resolvedByAssetRef.get(
        descriptor.assetRef
      );

    if (!resolved) {
      return invalidProviderRequest(
        "resolved_reference_missing",
        {
          missingAssetRef:
            descriptor.assetRef
        }
      );
    }

    referenceImages.push({
      imageBuffer:
        resolved.imageBuffer,
      mimeType:
        resolved.mimeType
    });

    referenceManifest.push({
      providerImageIndex:
        index + 2,
      assetRef:
        descriptor.assetRef,
      slotKey:
        descriptor.slotKey,
      role:
        descriptor.role,
      candidateRef:
        descriptor.candidateRef,
      mimeType:
        resolved.mimeType,
      byteLength:
        resolved.imageBuffer.length,
      sha256:
        sha256(
          resolved.imageBuffer
        )
    });
  }

  const compiled =
    compileFaceLabSimulationInstruction(
      authority.renderSpec
    );

  if (compiled.status !== "ready") {
    return invalidProviderRequest(
      "simulation_instruction_invalid",
      {
        instructionReason:
          compiled.reason || null
      }
    );
  }

  const instruction =
    compiled.instruction +
    buildReferenceInstruction(
      referenceManifest
    );

  if (
    !instruction.trim() ||
    instruction.length > 16_000
  ) {
    return invalidProviderRequest(
      "visual_try_on_instruction_too_large"
    );
  }

  return {
    requestVersion:
      FACE_LAB_VISUAL_TRY_ON_PROVIDER_REQUEST_VERSION,
    status: "ready",
    reason:
      "visual_try_on_provider_request_built",
    instructionVersion:
      FACE_LAB_SIMULATION_INSTRUCTION_VERSION,
    instruction,
    referenceImages,
    referenceManifest
  };
}

export async function generateFaceLabVisualTryOnCore({
  apiKey,
  imageBuffer,
  mimeType,
  authority,
  resolvedReferenceImages = [],
  providerRuntime,
  model
} = {}) {
  if (
    typeof providerRuntime !==
    "function"
  ) {
    throw new Error(
      "visual_try_on_provider_runtime_invalid"
    );
  }

  const request =
    buildFaceLabVisualTryOnProviderRequest({
      authority,
      resolvedReferenceImages
    });

  if (request.status !== "ready") {
    throw new Error(
      `visual_try_on_request_${request.reason}`
    );
  }

  const providerResult =
    await providerRuntime({
      apiKey,
      imageBuffer,
      mimeType,
      referenceImages:
        request.referenceImages,
      instruction:
        request.instruction,
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
      "visual_try_on_provider_result_invalid"
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
      "visual_try_on_provider_config_invalid"
    );
  }

  return {
    serviceVersion:
      FACE_LAB_VISUAL_TRY_ON_SERVICE_VERSION,
    status: "ready",
    provider:
      providerConfig.provider,
    model:
      providerConfig.model,
    providerConfigVersion:
      providerConfig.configVersion,
    providerConfigFingerprint,
    authorityVersion:
      authority.authorityVersion,
    sessionId:
      authority.sessionId,
    routeId:
      authority.routeId,
    lookId:
      authority.lookId,
    instructionVersion:
      request.instructionVersion,
    referenceManifest:
      request.referenceManifest.map(
        (item) => ({
          ...item
        })
      ),
    mimeType:
      providerResult.mimeType ||
      "image/png",
    imageBytes:
      providerResult.imageBytes,
    providerRequestId:
      providerResult.requestId ||
      null,
    fidelity: {
      status: "not_evaluated",
      requiredChecks: [
        "identity_preservation",
        "selected_region_adherence",
        "reference_adherence",
        "edit_scope",
        "multi_item_coexistence"
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
      inputImageCount:
        Number.isSafeInteger(
          providerResult.inputImageCount
        )
          ? providerResult.inputImageCount
          : 1 +
            request.referenceImages.length,
      referenceImageCount:
        request.referenceImages.length,
      inputBytes:
        Number.isFinite(
          providerResult.inputBytes
        )
          ? providerResult.inputBytes
          : null,
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
