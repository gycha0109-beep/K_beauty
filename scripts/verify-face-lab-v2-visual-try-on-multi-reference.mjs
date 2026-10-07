#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  buildFaceLabProductVariantCandidateRecord,
  FACE_LAB_SHADE_PROFILE_VERSION
} from "../lib/face-lab-v2/product-variant-authority.js";
import {
  buildFaceLabVisualTryOnAuthority
} from "../lib/face-lab-v2/visual-try-on-authority.js";
import {
  FACE_LAB_VISUAL_TRY_ON_PROVIDER_REQUEST_VERSION,
  FACE_LAB_VISUAL_TRY_ON_SERVICE_VERSION,
  buildFaceLabVisualTryOnProviderRequest,
  generateFaceLabVisualTryOnCore
} from "../lib/face-lab-v2/visual-try-on-service-core.js";
import {
  OPENAI_IMAGE_EDITS_URL,
  OPENAI_IMAGE_EDIT_MAX_REFERENCE_IMAGES,
  OPENAI_IMAGE_EDIT_MAX_TOTAL_INPUT_BYTES,
  OPENAI_IMAGE_EDIT_MODEL,
  executeOpenAiImageEdit
} from "../lib/openai-image-edit-runtime-core.js";
import {
  buildFaceLabSimulationProviderConfig
} from "../lib/face-lab-v2/simulation-provider-config.js";

function png(seed) {
  return Buffer.from([
    0x89, 0x50, 0x4e, 0x47,
    0x0d, 0x0a, 0x1a, 0x0a,
    seed, seed + 1,
    seed + 2, seed + 3
  ]);
}

function capabilityClaim(
  capabilityKey
) {
  return {
    capabilityKey,
    supportState: "supported",
    proofClass:
      "governed_catalog_attribute_mapping",
    proofVersion:
      "try-on-multi-reference-fixture-v1",
    evidenceRefs: [
      `catalog_attribute_review:multi-ref-${capabilityKey}`
    ]
  };
}

function bundle({
  productId,
  variantId,
  capabilityKey,
  attributes
}) {
  return buildFaceLabProductVariantCandidateRecord({
    variant: {
      productId,
      variantId,
      identityVersion:
        "try-on-multi-ref-identity-v1",
      identityState: "resolved",
      lifecycleState: "active",
      variantAxes: {
        shade: variantId,
        market: "KR"
      },
      identityEvidenceRefs: [
        `catalog_variant_review:${productId}-${variantId}`
      ],
      sourceVariantRefs: [
        `brand_variant:${productId}-${variantId}`
      ],
      shadeProfile: {
        profileVersion:
          FACE_LAB_SHADE_PROFILE_VERSION,
        shadeKey: variantId,
        displayLabel: variantId,
        attributes,
        evidenceRefsByAttribute:
          Object.fromEntries(
            Object.keys(attributes)
              .map((key) => [
                key,
                [
                  `catalog_attribute_review:${productId}-${variantId}-${key}`
                ]
              ])
          ),
        colorAnchors: []
      }
    },
    capabilityClaims: [
      capabilityClaim(
        capabilityKey
      )
    ]
  });
}

const lip = bundle({
  productId: "fixture-lip-multi-ref",
  variantId: "coral-orange",
  capabilityKey: "lip_color",
  attributes: {
    hueFamily: "coral_orange",
    undertone: "warm",
    depth: "medium",
    chroma: "medium_high",
    opacity: "buildable",
    finish: "glossy",
    glossLevel: "high"
  }
});

const highlight = bundle({
  productId:
    "fixture-highlight-multi-ref",
  variantId: "lavender",
  capabilityKey: "face_highlight",
  attributes: {
    hueFamily: "lavender",
    undertone: "cool",
    depth: "light",
    chroma: "low",
    opacity: "sheer",
    finish: "pearl",
    shimmerLevel: "medium"
  }
});

const lens = bundle({
  productId: "fixture-lens-multi-ref",
  variantId: "gray",
  capabilityKey: "iris_appearance",
  attributes: {
    hueFamily: "gray",
    undertone: "cool",
    depth: "medium",
    chroma: "low",
    opacity: "medium"
  }
});

for (const item of [
  lip,
  highlight,
  lens
]) {
  assert.equal(item.status, "ready");
}

const authority =
  buildFaceLabVisualTryOnAuthority({
    sessionId:
      "multi-reference-fixture",
    selections: [
      {
        slotKey: "lip_color",
        binding: lip,
        referenceAssets: [
          {
            assetRef:
              "product_image:lip",
            role:
              "product_image",
            evidenceRef:
              "catalog_variant_review:lip"
          }
        ]
      },
      {
        slotKey:
          "face_highlight",
        binding: highlight,
        referenceAssets: [
          {
            assetRef:
              "product_image:highlight",
            role:
              "product_image",
            evidenceRef:
              "catalog_variant_review:highlight"
          }
        ]
      },
      {
        slotKey:
          "iris_appearance",
        binding: lens,
        referenceAssets: [
          {
            assetRef:
              "wearing_reference:lens",
            role:
              "wearing_reference",
            evidenceRef:
              "applied_reference:lens"
          }
        ]
      }
    ]
  });

assert.equal(authority.status, "ready");
assert.equal(
  authority.referenceAssets.length,
  3
);

const referenceBytes = {
  "product_image:lip": png(0x11),
  "product_image:highlight": png(0x21),
  "wearing_reference:lens": png(0x31)
};

const resolvedReferenceImages = [
  {
    assetRef:
      "wearing_reference:lens",
    mimeType: "image/png",
    imageBuffer:
      referenceBytes[
        "wearing_reference:lens"
      ]
  },
  {
    assetRef:
      "product_image:lip",
    mimeType: "image/png",
    imageBuffer:
      referenceBytes[
        "product_image:lip"
      ]
  },
  {
    assetRef:
      "product_image:highlight",
    mimeType: "image/png",
    imageBuffer:
      referenceBytes[
        "product_image:highlight"
      ]
  }
];

const request =
  buildFaceLabVisualTryOnProviderRequest({
    authority,
    resolvedReferenceImages
  });

assert.equal(
  FACE_LAB_VISUAL_TRY_ON_PROVIDER_REQUEST_VERSION,
  "face-lab-visual-try-on-provider-request-v1"
);
assert.equal(
  FACE_LAB_VISUAL_TRY_ON_SERVICE_VERSION,
  "face-lab-visual-try-on-service-v1"
);
assert.equal(request.status, "ready");
assert.equal(
  request.referenceImages.length,
  3
);
assert.deepEqual(
  request.referenceManifest
    .map((item) =>
      item.assetRef
    ),
  authority.referenceAssets
    .map((item) =>
      item.assetRef
    )
);
assert.deepEqual(
  request.referenceManifest
    .map((item) =>
      item.providerImageIndex
    ),
  [2, 3, 4]
);
assert.ok(
  request.instruction.includes(
    "Image 1 is the source portrait and is the sole identity authority."
  )
);
assert.ok(
  request.instruction.includes(
    "Do not copy a reference person's identity"
  )
);
for (
  const item of
    request.referenceManifest
) {
  assert.match(
    item.sha256,
    /^[a-f0-9]{64}$/
  );
  assert.ok(
    request.instruction.includes(
      `Image ${item.providerImageIndex}; slot=${item.slotKey}; role=${item.role}; asset=${item.assetRef}.`
    )
  );
}

const sourcePng = png(0x01);
const outputPng = png(0x71);
const providerPayload = {
  data: [
    {
      b64_json:
        outputPng.toString("base64")
    }
  ],
  usage: {
    total_tokens: 777
  }
};

const attempts = [];
const runtimeEvents = [];
let attemptCount = 0;

const runtimeResult =
  await executeOpenAiImageEdit({
    apiKey: "sk-test-redacted",
    imageBuffer: sourcePng,
    mimeType: "image/png",
    referenceImages:
      request.referenceImages,
    instruction:
      request.instruction,
    fetchImpl: async (
      url,
      options
    ) => {
      attemptCount += 1;

      const images =
        options.body.getAll(
          "image[]"
        );

      attempts.push({
        url,
        prompt:
          options.body.get(
            "prompt"
          ),
        images:
          images.map((image) => ({
            name: image.name,
            type: image.type,
            size: image.size
          }))
      });

      if (attemptCount === 1) {
        return new Response(
          JSON.stringify({
            error: {
              message:
                "retry fixture"
            }
          }),
          {
            status: 429,
            headers: {
              "content-type":
                "application/json",
              "retry-after-ms": "0"
            }
          }
        );
      }

      return new Response(
        JSON.stringify(
          providerPayload
        ),
        {
          status: 200,
          headers: {
            "content-type":
              "application/json",
            "x-request-id":
              "req_multi_reference"
          }
        }
      );
    },
    logEvent: (event) => {
      runtimeEvents.push(
        structuredClone(event)
      );
    }
  });

assert.equal(attemptCount, 2);
assert.equal(
  attempts.length,
  2
);
assert.equal(
  attempts[0].url,
  OPENAI_IMAGE_EDITS_URL
);
assert.deepEqual(
  attempts[0],
  attempts[1],
  "retry must preserve prompt and image ordering"
);
assert.deepEqual(
  attempts[0].images
    .map((item) =>
      item.name
    ),
  [
    "face-lab-source.png",
    "face-lab-reference-01.png",
    "face-lab-reference-02.png",
    "face-lab-reference-03.png"
  ]
);
assert.deepEqual(
  attempts[0].images
    .map((item) =>
      item.size
    ),
  [
    sourcePng.length,
    ...request.referenceImages
      .map((item) =>
        item.imageBuffer.length
      )
  ]
);
assert.equal(
  runtimeResult.inputImageCount,
  4
);
assert.equal(
  runtimeResult.referenceImageCount,
  3
);
assert.equal(
  runtimeResult.inputBytes,
  sourcePng.length +
    request.referenceImages.reduce(
      (sum, item) =>
        sum +
        item.imageBuffer.length,
      0
    )
);
assert.equal(
  runtimeResult.requestId,
  "req_multi_reference"
);
assert.deepEqual(
  runtimeResult.imageBytes,
  outputPng
);
assert.equal(
  runtimeEvents.at(-1)
    .referenceImageCount,
  3
);
assert.equal(
  JSON.stringify(runtimeEvents)
    .includes(
      referenceBytes[
        "product_image:lip"
      ].toString("base64")
    ),
  false
);

const expectedProviderAuthority =
  buildFaceLabSimulationProviderConfig({
    provider: "openai",
    operation: "images.edit",
    endpoint:
      OPENAI_IMAGE_EDITS_URL,
    model:
      OPENAI_IMAGE_EDIT_MODEL,
    quality: "high",
    size: "auto",
    outputFormat: "png",
    n: 1
  });

const serviceCalls = [];
const service =
  await generateFaceLabVisualTryOnCore({
    apiKey: "sk-test",
    imageBuffer: sourcePng,
    mimeType: "image/png",
    authority,
    resolvedReferenceImages,
    model:
      OPENAI_IMAGE_EDIT_MODEL,
    providerRuntime:
      async (input) => {
        serviceCalls.push(input);

        return {
          provider: "openai",
          model:
            OPENAI_IMAGE_EDIT_MODEL,
          providerConfig:
            expectedProviderAuthority
              .config,
          providerConfigFingerprint:
            expectedProviderAuthority
              .fingerprint,
          status: 200,
          requestId:
            "req_service_fixture",
          imageBytes: outputPng,
          mimeType: "image/png",
          responseBytes: 100,
          outputBytes:
            outputPng.length,
          inputImageCount: 4,
          referenceImageCount: 3,
          inputBytes:
            sourcePng.length + 36,
          durationMs: 123,
          attemptCount: 1,
          usage: {
            total_tokens: 555
          }
        };
      }
  });

assert.equal(
  serviceCalls.length,
  1
);
assert.equal(
  serviceCalls[0]
    .referenceImages.length,
  3
);
assert.ok(
  serviceCalls[0]
    .instruction
    .includes(
      "Image 1 is the source portrait"
    )
);
assert.equal(
  service.status,
  "ready"
);
assert.equal(
  service.serviceVersion,
  FACE_LAB_VISUAL_TRY_ON_SERVICE_VERSION
);
assert.equal(
  service.referenceManifest.length,
  3
);
assert.equal(
  service.telemetry
    .referenceImageCount,
  3
);
assert.equal(
  service.fidelity.status,
  "not_evaluated"
);
assert.deepEqual(
  service.fidelity
    .requiredChecks,
  [
    "identity_preservation",
    "selected_region_adherence",
    "reference_adherence",
    "edit_scope",
    "multi_item_coexistence"
  ]
);
assert.equal(
  Object.prototype.hasOwnProperty.call(
    service,
    "instruction"
  ),
  false
);
assert.equal(
  JSON.stringify(
    service.referenceManifest
  ).includes("imageBuffer"),
  false
);

const missingReference =
  buildFaceLabVisualTryOnProviderRequest({
    authority,
    resolvedReferenceImages:
      resolvedReferenceImages.slice(
        0,
        2
      )
  });

assert.equal(
  missingReference.status,
  "invalid"
);
assert.equal(
  missingReference.reason,
  "resolved_reference_count_mismatch"
);

const duplicateResolved =
  buildFaceLabVisualTryOnProviderRequest({
    authority,
    resolvedReferenceImages: [
      resolvedReferenceImages[0],
      resolvedReferenceImages[0],
      resolvedReferenceImages[2]
    ]
  });

assert.equal(
  duplicateResolved.status,
  "invalid"
);
assert.equal(
  duplicateResolved.reason,
  "resolved_reference_duplicate"
);

await assert.rejects(
  () =>
    executeOpenAiImageEdit({
      apiKey: "sk-test",
      imageBuffer: sourcePng,
      mimeType: "image/png",
      referenceImages:
        Array.from(
          {
            length:
              OPENAI_IMAGE_EDIT_MAX_REFERENCE_IMAGES +
              1
          },
          (_, index) => ({
            imageBuffer:
              png(0x40 + index),
            mimeType:
              "image/png"
          })
        ),
      instruction:
        "fixture instruction",
      fetchImpl: async () => {
        throw new Error(
          "must not reach provider"
        );
      },
      logEvent: () => {}
    }),
  /reference_image_count_exceeded/
);

const largeReference =
  Buffer.alloc(2048);
png(0x51).copy(
  largeReference,
  0
);

await assert.rejects(
  () =>
    executeOpenAiImageEdit({
      apiKey: "sk-test",
      imageBuffer: sourcePng,
      mimeType: "image/png",
      referenceImages: [
        {
          imageBuffer:
            largeReference,
          mimeType: "image/png"
        }
      ],
      instruction:
        "fixture instruction",
      maxTotalInputBytes: 1024,
      fetchImpl: async () => {
        throw new Error(
          "must not reach provider"
        );
      },
      logEvent: () => {}
    }),
  /total_input_bytes_exceeded/
);

assert.equal(
  OPENAI_IMAGE_EDIT_MAX_TOTAL_INPUT_BYTES,
  48 * 1024 * 1024
);

console.log(
  JSON.stringify({
    status: "PASS",
    providerCalls: 0,
    realProviderInvoked: false,
    inputImageCount:
      runtimeResult.inputImageCount,
    referenceImageCount:
      runtimeResult.referenceImageCount,
    retryOrderingStable: true,
    referenceMappingStable: true,
    totalInputGuard: true
  })
);
