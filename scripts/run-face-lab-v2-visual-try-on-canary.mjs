#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import {
  createHash
} from "node:crypto";
import {
  buildFaceLabVisualTryOnProviderRequest,
  generateFaceLabVisualTryOnCore
} from "../lib/face-lab-v2/visual-try-on-service-core.js";
import {
  FACE_LAB_VISUAL_TRY_ON_CANARY_PLAN_VERSION,
  FACE_LAB_VISUAL_TRY_ON_CANARY_REFERENCE_ASSETS,
  buildFaceLabVisualTryOnCanaryAuthority
} from "../lib/face-lab-v2/visual-try-on-canary-plan.js";
import {
  OPENAI_IMAGE_EDIT_MAX_INPUT_BYTES,
  OPENAI_IMAGE_EDIT_MAX_REFERENCE_IMAGES,
  OPENAI_IMAGE_EDIT_MAX_TOTAL_INPUT_BYTES,
  OPENAI_IMAGE_EDIT_MODEL,
  executeOpenAiImageEdit
} from "../lib/openai-image-edit-runtime-core.js";
import {
  estimateFaceLabImageCost
} from "../lib/face-lab-v2/image-generation-cost.js";
import {
  resolveOpenAiApiKey
} from "../lib/openai-env-diagnostics.js";

const MODES =
  new Set([
    "precheck",
    "canary",
    "approve",
    "reject"
  ]);

const LIVE_APPROVAL =
  "I_ACCEPT_ONE_OPENAI_IMAGE_COST";

const ROOT =
  path.resolve(
    process.cwd(),
    "private",
    "face-lab-visual-try-on"
  );

const INPUT_ROOT =
  path.join(
    ROOT,
    "input"
  );

const DEFAULT_INPUTS =
  Object.freeze({
    source:
      "source.png",
    lip:
      "lip-reference.png",
    highlight:
      "highlight-reference.png",
    lens:
      "lens-reference.png"
  });

function sha256Bytes(value) {
  return createHash("sha256")
    .update(value)
    .digest("hex");
}

function canonical(value) {
  if (Array.isArray(value)) {
    return value.map(canonical);
  }

  if (
    value &&
    typeof value === "object"
  ) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [
          key,
          canonical(value[key])
        ])
    );
  }

  return value;
}

function sha256Json(value) {
  return sha256Bytes(
    Buffer.from(
      JSON.stringify(
        canonical(value)
      ),
      "utf8"
    )
  );
}

function safeCampaignId(value) {
  const normalized =
    String(value || "")
      .trim();

  return /^[A-Za-z0-9._-]{6,80}$/.test(
    normalized
  )
    ? normalized
    : null;
}

function defaultCampaignId() {
  return (
    "VT-CANARY-" +
    new Date()
      .toISOString()
      .replace(
        /[-:.TZ]/g,
        ""
      )
      .slice(0, 14)
  );
}

function assertConfined(
  root,
  candidate,
  errorCode
) {
  const resolvedRoot =
    path.resolve(root);
  const resolved =
    path.resolve(candidate);

  if (
    resolved !==
      resolvedRoot &&
    !resolved.startsWith(
      resolvedRoot +
        path.sep
    )
  ) {
    throw new Error(
      errorCode
    );
  }

  return resolved;
}

function resolveInputPath(
  envName,
  fallbackName
) {
  const raw =
    String(
      process.env[envName] ||
      fallbackName
    ).trim();

  const candidate =
    path.isAbsolute(raw)
      ? raw
      : path.resolve(
          INPUT_ROOT,
          raw
        );

  return assertConfined(
    INPUT_ROOT,
    candidate,
    "visual_try_on_input_path_outside_private_root"
  );
}

function detectImageMime(
  bytes
) {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }

  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "image/jpeg";
  }

  if (
    bytes.length >= 12 &&
    bytes
      .subarray(0, 4)
      .toString("ascii") ===
      "RIFF" &&
    bytes
      .subarray(8, 12)
      .toString("ascii") ===
      "WEBP"
  ) {
    return "image/webp";
  }

  return null;
}

function outputExtension(
  mimeType
) {
  if (
    mimeType === "image/jpeg"
  ) {
    return ".jpg";
  }

  if (
    mimeType === "image/webp"
  ) {
    return ".webp";
  }

  return ".png";
}

async function readJsonIfPresent(
  filePath
) {
  try {
    return JSON.parse(
      await fs.readFile(
        filePath,
        "utf8"
      )
    );
  } catch (error) {
    if (
      error?.code === "ENOENT"
    ) {
      return null;
    }

    throw error;
  }
}

async function writeJson(
  filePath,
  value
) {
  await fs.mkdir(
    path.dirname(filePath),
    {
      recursive: true
    }
  );

  await fs.writeFile(
    filePath,
    JSON.stringify(
      value,
      null,
      2
    ) + "\n",
    "utf8"
  );
}

async function readImage(
  key,
  envName,
  fallbackName
) {
  const filePath =
    resolveInputPath(
      envName,
      fallbackName
    );
  const imageBuffer =
    await fs.readFile(
      filePath
    );
  const mimeType =
    detectImageMime(
      imageBuffer
    );

  if (!mimeType) {
    throw new Error(
      "visual_try_on_input_image_invalid_" +
        key
    );
  }

  if (
    imageBuffer.length >
    OPENAI_IMAGE_EDIT_MAX_INPUT_BYTES
  ) {
    throw new Error(
      "visual_try_on_input_image_too_large_" +
        key
    );
  }

  return {
    key,
    filePath,
    fileName:
      path.basename(
        filePath
      ),
    imageBuffer,
    mimeType,
    byteLength:
      imageBuffer.length,
    sha256:
      sha256Bytes(
        imageBuffer
      )
  };
}

async function loadInputs() {
  await fs.mkdir(
    INPUT_ROOT,
    {
      recursive: true
    }
  );

  const source =
    await readImage(
      "source",
      "FACE_LAB_VISUAL_TRY_ON_SOURCE_IMAGE",
      DEFAULT_INPUTS.source
    );
  const lip =
    await readImage(
      "lip",
      "FACE_LAB_VISUAL_TRY_ON_LIP_REFERENCE",
      DEFAULT_INPUTS.lip
    );
  const highlight =
    await readImage(
      "highlight",
      "FACE_LAB_VISUAL_TRY_ON_HIGHLIGHT_REFERENCE",
      DEFAULT_INPUTS.highlight
    );
  const lens =
    await readImage(
      "lens",
      "FACE_LAB_VISUAL_TRY_ON_LENS_REFERENCE",
      DEFAULT_INPUTS.lens
    );

  const references = [
    {
      assetRef:
        FACE_LAB_VISUAL_TRY_ON_CANARY_REFERENCE_ASSETS
          .lip,
      ...lip
    },
    {
      assetRef:
        FACE_LAB_VISUAL_TRY_ON_CANARY_REFERENCE_ASSETS
          .highlight,
      ...highlight
    },
    {
      assetRef:
        FACE_LAB_VISUAL_TRY_ON_CANARY_REFERENCE_ASSETS
          .lens,
      ...lens
    }
  ];

  if (
    references.length >
    OPENAI_IMAGE_EDIT_MAX_REFERENCE_IMAGES
  ) {
    throw new Error(
      "visual_try_on_reference_count_exceeded"
    );
  }

  const totalInputBytes =
    source.byteLength +
    references.reduce(
      (
        sum,
        item
      ) =>
        sum +
        item.byteLength,
      0
    );

  if (
    totalInputBytes >
    OPENAI_IMAGE_EDIT_MAX_TOTAL_INPUT_BYTES
  ) {
    throw new Error(
      "visual_try_on_total_input_bytes_exceeded"
    );
  }

  return {
    source,
    references,
    totalInputBytes
  };
}

function buildBinding({
  authority,
  providerRequest,
  inputs
}) {
  const binding = {
    schemaVersion:
      "face-lab-visual-try-on-canary-binding-v1",
    planVersion:
      FACE_LAB_VISUAL_TRY_ON_CANARY_PLAN_VERSION,
    authorityVersion:
      authority.authorityVersion,
    sessionId:
      authority.sessionId,
    routeId:
      authority.routeId,
    lookId:
      authority.lookId,
    source: {
      fileName:
        inputs.source.fileName,
      mimeType:
        inputs.source.mimeType,
      byteLength:
        inputs.source.byteLength,
      sha256:
        inputs.source.sha256
    },
    references:
      providerRequest
        .referenceManifest
        .map((reference) => {
          const input =
            inputs.references.find(
              (item) =>
                item.assetRef ===
                reference.assetRef
            );

          return {
            providerImageIndex:
              reference.providerImageIndex,
            assetRef:
              reference.assetRef,
            slotKey:
              reference.slotKey,
            role:
              reference.role,
            fileName:
              input.fileName,
            mimeType:
              input.mimeType,
            byteLength:
              input.byteLength,
            sha256:
              input.sha256
          };
        }),
    renderSpecSha256:
      sha256Json(
        authority.renderSpec
      ),
    instructionSha256:
      sha256Bytes(
        Buffer.from(
          providerRequest.instruction,
          "utf8"
        )
      ),
    totalInputBytes:
      inputs.totalInputBytes
  };

  return {
    ...binding,
    bindingSha256:
      sha256Json(binding)
  };
}

async function buildCurrentState() {
  const inputs =
    await loadInputs();
  const authority =
    buildFaceLabVisualTryOnCanaryAuthority();

  if (
    authority.status !==
    "ready"
  ) {
    throw new Error(
      "visual_try_on_canary_authority_invalid"
    );
  }

  const resolvedReferenceImages =
    inputs.references.map(
      (item) => ({
        assetRef:
          item.assetRef,
        imageBuffer:
          item.imageBuffer,
        mimeType:
          item.mimeType
      })
    );

  const providerRequest =
    buildFaceLabVisualTryOnProviderRequest({
      authority,
      resolvedReferenceImages
    });

  if (
    providerRequest.status !==
    "ready"
  ) {
    throw new Error(
      "visual_try_on_canary_provider_request_" +
        providerRequest.reason
    );
  }

  const binding =
    buildBinding({
      authority,
      providerRequest,
      inputs
    });

  return {
    inputs,
    authority,
    providerRequest,
    resolvedReferenceImages,
    binding
  };
}

function assertLocalPaidExecution() {
  if (
    String(
      process.env.CI || ""
    ).trim()
  ) {
    throw new Error(
      "visual_try_on_canary_ci_forbidden"
    );
  }

  if (
    String(
      process.env
        .FACE_LAB_VISUAL_TRY_ON_LIVE_APPROVAL ||
      ""
    ).trim() !==
      LIVE_APPROVAL
  ) {
    throw new Error(
      "visual_try_on_canary_live_approval_required"
    );
  }
}

function assertBindingEqual(
  expected,
  actual
) {
  if (
    !expected ||
    !actual ||
    expected.bindingSha256 !==
      actual.bindingSha256
  ) {
    throw new Error(
      "visual_try_on_canary_binding_mismatch"
    );
  }
}

async function validateGate({
  gate,
  checkpoint,
  campaignDir
}) {
  if (
    !gate ||
    !checkpoint ||
    gate.schemaVersion !==
      "face-lab-visual-try-on-canary-gate-v1" ||
    checkpoint.schemaVersion !==
      "face-lab-visual-try-on-canary-checkpoint-v1" ||
    gate.campaignId !==
      checkpoint.campaignId ||
    gate.bindingSha256 !==
      checkpoint.bindingSha256 ||
    gate.outputSha256 !==
      checkpoint.outputSha256
  ) {
    throw new Error(
      "visual_try_on_canary_gate_invalid"
    );
  }

  const outputPath =
    assertConfined(
      campaignDir,
      path.join(
        campaignDir,
        checkpoint.outputFile
      ),
      "visual_try_on_output_path_invalid"
    );
  const outputBytes =
    await fs.readFile(
      outputPath
    );

  if (
    sha256Bytes(
      outputBytes
    ) !==
      checkpoint.outputSha256
  ) {
    throw new Error(
      "visual_try_on_output_binding_mismatch"
    );
  }
}

const mode =
  String(
    process.argv[2] || ""
  )
    .trim()
    .toLowerCase();

if (!MODES.has(mode)) {
  throw new Error(
    "visual_try_on_canary_mode_required"
  );
}

const statePath =
  path.join(
    ROOT,
    "current-campaign.json"
  );
const previousState =
  await readJsonIfPresent(
    statePath
  );

const explicitCampaignId =
  safeCampaignId(
    process.argv[3]
  );
const previousCampaignId =
  safeCampaignId(
    previousState
      ?.campaignId
  );

const campaignId =
  explicitCampaignId ||
  previousCampaignId ||
  (
    mode === "precheck"
      ? defaultCampaignId()
      : null
  );

if (!campaignId) {
  throw new Error(
    "visual_try_on_canary_campaign_missing"
  );
}

if (
  explicitCampaignId &&
  previousCampaignId &&
  explicitCampaignId !==
    previousCampaignId &&
  mode !== "precheck"
) {
  throw new Error(
    "visual_try_on_canary_campaign_mismatch"
  );
}

const campaignDir =
  path.join(
    ROOT,
    campaignId
  );
const precheckPath =
  path.join(
    campaignDir,
    "precheck.json"
  );
const checkpointPath =
  path.join(
    campaignDir,
    "manifest.checkpoint.json"
  );
const gatePath =
  path.join(
    campaignDir,
    "canary-gate.json"
  );

if (mode === "precheck") {
  const current =
    await buildCurrentState();

  const precheck = {
    schemaVersion:
      "face-lab-visual-try-on-canary-precheck-v1",
    status: "ready",
    campaignId,
    createdAt:
      new Date().toISOString(),
    providerCalls: 0,
    realProviderInvoked: false,
    binding:
      current.binding
  };

  await writeJson(
    precheckPath,
    precheck
  );
  await writeJson(
    statePath,
    {
      schemaVersion:
        "face-lab-visual-try-on-canary-current-v1",
      campaignId,
      status: "prechecked",
      bindingSha256:
        current.binding
          .bindingSha256,
      updatedAt:
        new Date()
          .toISOString()
    }
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        verdict:
          "FACE_LAB_VISUAL_TRY_ON_PRECHECK_PASS",
        campaignId,
        providerCalls: 0,
        realProviderInvoked:
          false,
        source:
          current.binding
            .source,
        references:
          current.binding
            .references,
        renderSpecSha256:
          current.binding
            .renderSpecSha256,
        instructionSha256:
          current.binding
            .instructionSha256,
        bindingSha256:
          current.binding
            .bindingSha256
      },
      null,
      2
    )
  );

  process.exit(0);
}

if (mode === "canary") {
  assertLocalPaidExecution();

  const precheck =
    await readJsonIfPresent(
      precheckPath
    );

  if (
    precheck?.status !==
      "ready" ||
    !precheck.binding
  ) {
    throw new Error(
      "visual_try_on_canary_precheck_required"
    );
  }

  if (
    await readJsonIfPresent(
      checkpointPath
    ) ||
    await readJsonIfPresent(
      gatePath
    )
  ) {
    throw new Error(
      "visual_try_on_canary_already_generated"
    );
  }

  const current =
    await buildCurrentState();

  assertBindingEqual(
    precheck.binding,
    current.binding
  );

  const {
    apiKey
  } =
    resolveOpenAiApiKey();

  if (!apiKey) {
    throw new Error(
      "visual_try_on_canary_openai_key_missing"
    );
  }

  const simulation =
    await generateFaceLabVisualTryOnCore({
      apiKey,
      imageBuffer:
        current.inputs
          .source
          .imageBuffer,
      mimeType:
        current.inputs
          .source
          .mimeType,
      authority:
        current.authority,
      resolvedReferenceImages:
        current
          .resolvedReferenceImages,
      providerRuntime:
        executeOpenAiImageEdit,
      model:
        OPENAI_IMAGE_EDIT_MODEL
    });

  const extension =
    outputExtension(
      simulation.mimeType
    );
  const outputFile =
    "canary-output" +
    extension;
  const outputPath =
    path.join(
      campaignDir,
      outputFile
    );
  const outputSha256 =
    sha256Bytes(
      simulation.imageBytes
    );

  await fs.mkdir(
    campaignDir,
    {
      recursive: true
    }
  );
  await fs.writeFile(
    outputPath,
    simulation.imageBytes
  );

  const estimatedCost =
    estimateFaceLabImageCost(
      simulation.telemetry
        ?.usage
    );

  const checkpoint = {
    schemaVersion:
      "face-lab-visual-try-on-canary-checkpoint-v1",
    status:
      "awaiting_review",
    campaignId,
    createdAt:
      new Date().toISOString(),
    planVersion:
      FACE_LAB_VISUAL_TRY_ON_CANARY_PLAN_VERSION,
    bindingSha256:
      current.binding
        .bindingSha256,
    sourceSha256:
      current.binding
        .source
        .sha256,
    referenceManifest:
      simulation
        .referenceManifest,
    renderSpecSha256:
      current.binding
        .renderSpecSha256,
    instructionSha256:
      current.binding
        .instructionSha256,
    outputFile,
    outputSha256,
    outputMimeType:
      simulation.mimeType,
    provider:
      simulation.provider,
    model:
      simulation.model,
    providerConfigVersion:
      simulation
        .providerConfigVersion,
    providerConfigFingerprint:
      simulation
        .providerConfigFingerprint,
    providerRequestId:
      simulation
        .providerRequestId,
    providerAttemptCount:
      simulation.telemetry
        ?.attemptCount ??
      null,
    inputImageCount:
      simulation.telemetry
        ?.inputImageCount ??
      null,
    referenceImageCount:
      simulation.telemetry
        ?.referenceImageCount ??
      null,
    usage:
      simulation.telemetry
        ?.usage ??
      null,
    pricingVersion:
      estimatedCost
        ?.pricingVersion ??
      null,
    estimatedCostNanoUsd:
      estimatedCost
        ?.estimatedCostNanoUsd ??
      null
  };

  const gate = {
    schemaVersion:
      "face-lab-visual-try-on-canary-gate-v1",
    status:
      "awaiting_review",
    campaignId,
    bindingSha256:
      checkpoint
        .bindingSha256,
    outputSha256,
    outputFile,
    createdAt:
      new Date()
        .toISOString()
  };

  await writeJson(
    checkpointPath,
    checkpoint
  );
  await writeJson(
    gatePath,
    gate
  );
  await writeJson(
    statePath,
    {
      schemaVersion:
        "face-lab-visual-try-on-canary-current-v1",
      campaignId,
      status:
        "canary_generated",
      bindingSha256:
        checkpoint
          .bindingSha256,
      outputSha256,
      updatedAt:
        new Date()
          .toISOString()
    }
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        verdict:
          "FACE_LAB_VISUAL_TRY_ON_CANARY_READY_FOR_REVIEW",
        campaignId,
        outputFile:
          path.relative(
            process.cwd(),
            outputPath
          ),
        providerAttemptCount:
          checkpoint
            .providerAttemptCount,
        inputImageCount:
          checkpoint
            .inputImageCount,
        referenceImageCount:
          checkpoint
            .referenceImageCount,
        estimatedCostNanoUsd:
          checkpoint
            .estimatedCostNanoUsd,
        pricingVersion:
          checkpoint
            .pricingVersion,
        next:
          "human_review_required"
      },
      null,
      2
    )
  );

  process.exit(0);
}

const checkpoint =
  await readJsonIfPresent(
    checkpointPath
  );
const gate =
  await readJsonIfPresent(
    gatePath
  );

await validateGate({
  gate,
  checkpoint,
  campaignDir
});

if (
  gate.status !==
    "awaiting_review"
) {
  throw new Error(
    "visual_try_on_canary_gate_not_awaiting_review"
  );
}

const nextStatus =
  mode === "approve"
    ? "approved"
    : "rejected";

await writeJson(
  gatePath,
  {
    ...gate,
    status:
      nextStatus,
    reviewedAt:
      new Date()
        .toISOString()
  }
);
await writeJson(
  statePath,
  {
    schemaVersion:
      "face-lab-visual-try-on-canary-current-v1",
    campaignId,
    status:
      "canary_" +
      nextStatus,
    bindingSha256:
      checkpoint
        .bindingSha256,
    outputSha256:
      checkpoint
        .outputSha256,
    updatedAt:
      new Date()
        .toISOString()
  }
);

console.log(
  JSON.stringify(
    {
      ok: true,
      verdict:
        mode === "approve"
          ? "FACE_LAB_VISUAL_TRY_ON_CANARY_APPROVED"
          : "FACE_LAB_VISUAL_TRY_ON_CANARY_REJECTED",
      campaignId,
      providerCalls: 0,
      realProviderInvoked:
        false
    },
    null,
    2
  )
);
