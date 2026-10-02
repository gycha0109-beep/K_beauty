import assert from "node:assert/strict";
import {
  FACE_LAB_IDENTITY_LOCK,
  FACE_LAB_RENDER_SPEC_VERSION
} from "../lib/face-lab-v2/render-adapter.js";
import {
  FACE_LAB_SIMULATION_INSTRUCTION_VERSION,
  compileFaceLabSimulationInstruction
} from "../lib/face-lab-v2/simulation-instructions.js";
import {
  FACE_LAB_AI_SIMULATION_VERSION,
  FACE_LAB_SIMULATION_FIDELITY_VERSION,
  FACE_LAB_SIMULATION_REQUIRED_CHECKS,
  generateFaceLabSimulationCore
} from "../lib/face-lab-v2/simulation-service-core.js";
import {
  FACE_LAB_SIMULATION_PROVIDER_CONFIG_VERSION,
  buildFaceLabSimulationProviderConfig,
  fingerprintFaceLabSimulationProviderConfig
} from "../lib/face-lab-v2/simulation-provider-config.js";
import {
  OPENAI_IMAGE_EDITS_URL,
  OPENAI_IMAGE_EDIT_MODEL,
  executeOpenAiImageEdit
} from "../lib/openai-image-edit-runtime-core.js";

assert.equal(
  FACE_LAB_SIMULATION_INSTRUCTION_VERSION,
  "face-lab-simulation-instruction-v1"
);
assert.equal(
  FACE_LAB_AI_SIMULATION_VERSION,
  "face-lab-ai-simulation-v1"
);
assert.equal(
  FACE_LAB_SIMULATION_FIDELITY_VERSION,
  "face-lab-simulation-fidelity-v1"
);
assert.deepEqual(
  FACE_LAB_SIMULATION_REQUIRED_CHECKS,
  [
    "identity_preservation",
    "route_adherence",
    "color_fidelity",
    "edit_scope"
  ]
);
assert.equal(
  OPENAI_IMAGE_EDIT_MODEL,
  "gpt-image-2.5-sunburst"
);
assert.equal(
  FACE_LAB_SIMULATION_PROVIDER_CONFIG_VERSION,
  "face-lab-simulation-provider-config-v1"
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

assert.ok(
  expectedProviderAuthority
);
assert.match(
  expectedProviderAuthority.fingerprint,
  /^[a-f0-9]{64}$/
);

const fingerprintMutations = [
  {
    field: "provider",
    value: "fixture-openai"
  },
  {
    field: "operation",
    value: "images.generate"
  },
  {
    field: "endpoint",
    value:
      "https://api.openai.com/v1/images/generations"
  },
  {
    field: "model",
    value: "fixture-model-v2"
  },
  {
    field: "quality",
    value: "medium"
  },
  {
    field: "size",
    value: "1024x1024"
  },
  {
    field: "outputFormat",
    value: "webp"
  },
  {
    field: "n",
    value: 2
  }
];

for (
  const mutation of
  fingerprintMutations
) {
  const fingerprint =
    fingerprintFaceLabSimulationProviderConfig({
      ...expectedProviderAuthority.config,
      [mutation.field]:
        mutation.value
    });

  assert.ok(
    fingerprint
  );
  assert.notEqual(
    fingerprint,
    expectedProviderAuthority.fingerprint,
    mutation.field +
      " must change provider config fingerprint"
  );
}

for (
  const nonAuthorityMutation of
  [
    {
      timeoutMs: 123_456
    },
    {
      maxInputBytes: 123_456
    },
    {
      maxResponseBytes: 654_321
    },
    {
      apiKey: "sk-must-not-enter-config"
    },
    {
      instruction:
        "must-not-enter-config"
    },
    {
      requestId:
        "req-must-not-enter-config"
    }
  ]
) {
  assert.equal(
    fingerprintFaceLabSimulationProviderConfig({
      ...expectedProviderAuthority.config,
      ...nonAuthorityMutation
    }),
    expectedProviderAuthority.fingerprint
  );
}

const providerConfigSerialized =
  JSON.stringify({
    ...expectedProviderAuthority.config
  });
const providerConfigKeys =
  Object.keys(
    expectedProviderAuthority.config
  );

for (
  const forbiddenKey of
  [
    "apiKey",
    "Authorization",
    "instruction",
    "prompt",
    "requestId",
    "image",
    "imageBuffer",
    "sourceImage",
    "outputImage",
    "usage"
  ]
) {
  assert.equal(
    providerConfigKeys.includes(
      forbiddenKey
    ),
    false,
    "provider config leaked forbidden runtime key: " +
      forbiddenKey
  );
}

for (
  const forbiddenLiteral of
  [
    "sk-must-not-enter-config",
    "must-not-enter-config",
    "req-must-not-enter-config"
  ]
) {
  assert.equal(
    providerConfigSerialized.includes(
      forbiddenLiteral
    ),
    false,
    "provider config leaked forbidden runtime value"
  );
}

const renderSpec = {
  adapterVersion:
    "face-lab-render-adapter-v1",
  renderSpecVersion:
    FACE_LAB_RENDER_SPEC_VERSION,
  status: "ready",
  reason: "render_spec_built",
  routeId: "route-balanced",
  lookId: "look-route-balanced",
  identityLock: [
    ...FACE_LAB_IDENTITY_LOCK
  ],
  operations: [
    {
      operationId:
        "render-operation:hair_shape",
      slotKey: "hair_shape",
      sourceMode: "execution_only",
      targetRegions: ["hair"],
      candidateRef: null,
      entityType: null,
      variantId: null,
      criteria: {
        requiredAttributes: {},
        preferredAttributes: {
          styleKeys: [
            "soft-curve-layers"
          ]
        },
        excludedAttributes: {}
      },
      candidateAttributes: {},
      application: {
        placement: [],
        direction: [
          "얼굴선 주변에 소프트 커브 레이어"
        ],
        intensity: "light",
        notes: [
          "정수리 높이는 과장하지 않음"
        ]
      },
      colorAuthority: {
        fidelityState: "none",
        renderGuarantee:
          "not_pixel_exact",
        primaryAnchor: null,
        alternateAnchors: [],
        candidateSemanticAttributes: {},
        requestedSemanticAttributes: {},
        preferredSemanticAttributes: {}
      }
    },
    {
      operationId:
        "render-operation:lip_color",
      slotKey: "lip_color",
      sourceMode: "candidate_bound",
      targetRegions: ["lips"],
      candidateRef:
        "product_variant:11111111-1111-1111-1111-111111111111:012-rosewood",
      entityType: "product_variant",
      variantId: "012-rosewood",
      criteria: {
        requiredAttributes: {
          hueFamily: "rose",
          chroma: "medium",
          opacity: "buildable",
          finish: ["satin", "glossy"]
        },
        preferredAttributes: {
          glossLevel: "medium"
        },
        excludedAttributes: {}
      },
      candidateAttributes: {
        hueFamily: "rose",
        undertone: "neutral_cool",
        chroma: "medium",
        opacity: "buildable",
        finish: "satin",
        glossLevel: "medium"
      },
      application: {
        placement: ["full lip"],
        direction: [
          "립 경계를 정돈하되 지나치게 날카롭게 자르지 않음"
        ],
        intensity: "moderate",
        notes: []
      },
      colorAuthority: {
        fidelityState:
          "applied_reference",
        renderGuarantee:
          "not_pixel_exact",
        primaryAnchor: {
          anchorId:
            "applied-reference-01",
          role:
            "applied_reference",
          colorSpace: "cie_lab",
          value: {
            l: 51.2,
            a: 27.4,
            b: 6.3
          },
          evidenceRefs: [
            "applied_reference:fixture"
          ]
        },
        alternateAnchors: [
          {
            anchorId:
              "brand-swatch-01",
            role: "brand_swatch",
            colorSpace: "srgb_hex",
            value: "#9A5061",
            evidenceRefs: [
              "brand_swatch:fixture"
            ]
          }
        ],
        candidateSemanticAttributes: {
          hueFamily: "rose",
          undertone:
            "neutral_cool",
          chroma: "medium",
          opacity: "buildable",
          finish: "satin",
          glossLevel: "medium"
        },
        requestedSemanticAttributes: {
          hueFamily: "rose",
          chroma: "medium",
          opacity: "buildable",
          finish: [
            "satin",
            "glossy"
          ]
        },
        preferredSemanticAttributes: {
          glossLevel: "medium"
        }
      },
      renderIdentity: {
        shadeKey: "012-rosewood",
        displayLabel: "012 Rosewood"
      }
    }
  ],
  conflictsResolved: [
    "주 포인트 하나를 남기고 나머지는 한 단계 낮춤"
  ],
  remainingTradeoffs: [],
  providerPayload: null,
  imageModelInvoked: false
};

const compiled =
  compileFaceLabSimulationInstruction(
    renderSpec
  );

assert.equal(compiled.status, "ready");
assert.equal(
  compiled.reason,
  "simulation_instruction_compiled"
);
assert.equal(
  compiled.operationCount,
  2
);
assert.equal(
  compiled.routeId,
  "route-balanced"
);
assert.equal(
  compiled.lookId,
  "look-route-balanced"
);
assert.ok(
  compiled.instruction.includes(
    "Keep the exact same person"
  )
);
assert.ok(
  compiled.instruction.includes(
    "facial_geometry"
  )
);
assert.ok(
  compiled.instruction.includes(
    "Do not change any styling area that is not explicitly listed below"
  )
);
assert.ok(
  compiled.instruction.includes(
    "Source mode: execution-only"
  )
);
assert.ok(
  compiled.instruction.includes(
    "not a claim that a specific commercial product is being reproduced"
  )
);
assert.ok(
  compiled.instruction.includes(
    renderSpec.operations[1]
      .candidateRef
  )
);
assert.ok(
  compiled.instruction.includes(
    "applied_reference color anchor applied-reference-01: CIE Lab L=51.20 a=27.40 b=6.30"
  )
);
assert.ok(
  compiled.instruction.includes(
    "brand_swatch color anchor brand-swatch-01: sRGB HEX #9A5061"
  )
);
assert.ok(
  compiled.instruction.includes(
    "do not assume it proves exact applied appearance on this person"
  )
);
assert.ok(
  compiled.instruction.includes(
    "rendered output is not guaranteed pixel-exact"
  )
);

const noUnlistedArea =
  compileFaceLabSimulationInstruction({
    ...renderSpec,
    operations: [
      renderSpec.operations[1]
    ]
  });

assert.equal(
  noUnlistedArea.status,
  "ready"
);
assert.equal(
  noUnlistedArea.instruction.includes(
    "Slot hair_shape"
  ),
  false,
  "an absent slot must not become an image edit instruction"
);

for (const invalidSpec of [
  null,
  {
    ...renderSpec,
    renderSpecVersion:
      "face-lab-render-spec-v999"
  },
  {
    ...renderSpec,
    status: "invalid"
  },
  {
    ...renderSpec,
    providerPayload: {}
  },
  {
    ...renderSpec,
    imageModelInvoked: true
  },
  {
    ...renderSpec,
    identityLock: ["identity"]
  },
  {
    ...renderSpec,
    operations: [
      {
        ...renderSpec.operations[0],
        sourceMode: "arbitrary"
      }
    ]
  },
  {
    ...renderSpec,
    operations: [
      {
        ...renderSpec.operations[0],
        candidateRef:
          "product:leak"
      }
    ]
  }
]) {
  assert.equal(
    compileFaceLabSimulationInstruction(
      invalidSpec
    ).status,
    "invalid"
  );
}

const sourcePng = Buffer.from([
  0x89, 0x50, 0x4e, 0x47,
  0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x00
]);

const outputPng = Buffer.from([
  0x89, 0x50, 0x4e, 0x47,
  0x0d, 0x0a, 0x1a, 0x0a,
  0x01, 0x02, 0x03, 0x04
]);

const providerPayload = {
  created: 1,
  data: [
    {
      b64_json:
        outputPng.toString(
          "base64"
        )
    }
  ],
  usage: {
    total_tokens: 321
  }
};

const loggedEvents = [];
let observedRequest = null;

const providerResult =
  await executeOpenAiImageEdit({
    apiKey: "sk-test-redacted",
    imageBuffer: sourcePng,
    mimeType: "image/png",
    instruction:
      compiled.instruction,
    fetchImpl: async (
      url,
      options
    ) => {
      observedRequest = {
        url,
        options
      };

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
              "req_fixture_123"
          }
        }
      );
    },
    logEvent: (event) => {
      loggedEvents.push(
        structuredClone(event)
      );
      return event;
    }
  });

assert.equal(
  observedRequest.url,
  OPENAI_IMAGE_EDITS_URL
);
assert.equal(
  observedRequest.options.method,
  "POST"
);
assert.equal(
  observedRequest.options.redirect,
  "manual"
);
assert.equal(
  observedRequest.options.headers
    .Authorization,
  "Bearer sk-test-redacted"
);
assert.ok(
  observedRequest.options.body
    instanceof FormData
);
assert.equal(
  observedRequest.options.body.get(
    "model"
  ),
  OPENAI_IMAGE_EDIT_MODEL
);
assert.equal(
  observedRequest.options.body.get(
    "quality"
  ),
  "high"
);
assert.equal(
  observedRequest.options.body.get(
    "size"
  ),
  "auto"
);
assert.equal(
  observedRequest.options.body.get(
    "output_format"
  ),
  "png"
);
assert.equal(
  observedRequest.options.body.get(
    "n"
  ),
  "1"
);
assert.equal(
  observedRequest.options.body.get(
    "prompt"
  ),
  compiled.instruction
);

const imagePart =
  observedRequest.options.body.get(
    "image[]"
  );
assert.ok(
  imagePart instanceof Blob
);
assert.equal(
  imagePart.type,
  "image/png"
);
assert.equal(
  imagePart.size,
  sourcePng.length
);

assert.equal(
  providerResult.provider,
  "openai"
);
assert.equal(
  providerResult.model,
  OPENAI_IMAGE_EDIT_MODEL
);
assert.deepEqual(
  providerResult.providerConfig,
  expectedProviderAuthority.config
);
assert.equal(
  providerResult.providerConfigFingerprint,
  expectedProviderAuthority.fingerprint
);
assert.equal(
  observedRequest.url,
  providerResult.providerConfig.endpoint
);
assert.equal(
  observedRequest.options.body.get("model"),
  providerResult.providerConfig.model
);
assert.equal(
  observedRequest.options.body.get("quality"),
  providerResult.providerConfig.quality
);
assert.equal(
  observedRequest.options.body.get("size"),
  providerResult.providerConfig.size
);
assert.equal(
  observedRequest.options.body.get("output_format"),
  providerResult.providerConfig.outputFormat
);
assert.equal(
  observedRequest.options.body.get("n"),
  String(providerResult.providerConfig.n)
);
assert.equal(
  providerResult.requestId,
  "req_fixture_123"
);
assert.equal(
  providerResult.mimeType,
  "image/png"
);
assert.deepEqual(
  providerResult.imageBytes,
  outputPng
);
assert.deepEqual(
  providerResult.usage,
  {
    total_tokens: 321
  }
);
assert.equal(
  loggedEvents.length,
  1
);
assert.equal(
  loggedEvents[0].ok,
  true
);
assert.equal(
  loggedEvents[0].stage,
  "face-lab-simulation"
);
assert.equal(
  Object.prototype.hasOwnProperty.call(
    loggedEvents[0],
    "instruction"
  ),
  false
);
assert.equal(
  JSON.stringify(
    loggedEvents[0]
  ).includes(
    outputPng.toString("base64")
  ),
  false
);

const retryEvents = [];
let retryAttemptCount = 0;

const retryResult =
  await executeOpenAiImageEdit({
    apiKey: "sk-test-redacted",
    imageBuffer: sourcePng,
    mimeType: "image/png",
    instruction:
      compiled.instruction,
    fetchImpl: async () => {
      retryAttemptCount += 1;

      if (
        retryAttemptCount === 1
      ) {
        return new Response(
          JSON.stringify({
            error: {
              message:
                "rate limited fixture"
            }
          }),
          {
            status: 429,
            headers: {
              "content-type":
                "application/json",
              "retry-after-ms":
                "0"
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
              "req_retry_fixture"
          }
        }
      );
    },
    logEvent: (event) => {
      retryEvents.push(
        structuredClone(event)
      );
      return event;
    }
  });

assert.equal(
  retryAttemptCount,
  2
);
assert.equal(
  retryResult.requestId,
  "req_retry_fixture"
);
assert.deepEqual(
  retryResult.imageBytes,
  outputPng
);
assert.equal(
  retryEvents.length,
  2
);
assert.equal(
  retryEvents[0].ok,
  false
);
assert.equal(
  retryEvents[0].status,
  429
);
assert.equal(
  retryEvents[0].errorCategory,
  "rate_limited_retry"
);
assert.equal(
  retryEvents[0].attempt,
  1
);
assert.equal(
  retryEvents[0].retryDelayMs,
  0
);
assert.equal(
  retryEvents[1].ok,
  true
);

let exhaustedAttemptCount = 0;

await assert.rejects(
  () =>
    executeOpenAiImageEdit({
      apiKey: "sk-test",
      imageBuffer: sourcePng,
      mimeType: "image/png",
      instruction:
        compiled.instruction,
      fetchImpl:
        async () => {
          exhaustedAttemptCount += 1;
          return new Response(
            JSON.stringify({
              error: {
                message:
                  "rate limited fixture"
              }
            }),
            {
              status: 429,
              headers: {
                "content-type":
                  "application/json",
                "retry-after-ms":
                  "0"
              }
            }
          );
        },
      logEvent: () => {}
    }),
  /provider_http_429/
);

assert.equal(
  exhaustedAttemptCount,
  2
);

await assert.rejects(
  () =>
    executeOpenAiImageEdit({
      apiKey: "sk-test",
      imageBuffer: sourcePng,
      mimeType: "image/png",
      instruction:
        compiled.instruction,
      fetchImpl: async () =>
        new Response("", {
          status: 307,
          headers: {
            location:
              "https://example.com"
          }
        }),
      logEvent: () => {}
    }),
  /provider_redirect_rejected/
);

await assert.rejects(
  () =>
    executeOpenAiImageEdit({
      apiKey: "sk-test",
      imageBuffer:
        Buffer.from("not-a-png"),
      mimeType: "image/png",
      instruction:
        compiled.instruction,
      fetchImpl: async () => {
        throw new Error(
          "must not be reached"
        );
      },
      logEvent: () => {}
    }),
  /image_signature_invalid/
);

const badOutputPayload = {
  data: [
    {
      b64_json:
        Buffer.from(
          "not-a-png"
        ).toString("base64")
    }
  ]
};

await assert.rejects(
  () =>
    executeOpenAiImageEdit({
      apiKey: "sk-test",
      imageBuffer: sourcePng,
      mimeType: "image/png",
      instruction:
        compiled.instruction,
      fetchImpl: async () =>
        new Response(
          JSON.stringify(
            badOutputPayload
          ),
          {
            status: 200
          }
        ),
      logEvent: () => {}
    }),
  /provider_response_invalid/
);

const coreCalls = [];
const simulation =
  await generateFaceLabSimulationCore({
    apiKey: "sk-test",
    imageBuffer: sourcePng,
    mimeType: "image/png",
    renderSpec,
    model:
      OPENAI_IMAGE_EDIT_MODEL,
    providerRuntime:
      async (request) => {
        coreCalls.push({
          ...request,
          imageBuffer:
            Buffer.from(
              request.imageBuffer
            )
        });

        const providerAuthority =
          buildFaceLabSimulationProviderConfig({
            provider: "openai",
            operation: "images.edit",
            endpoint:
              OPENAI_IMAGE_EDITS_URL,
            model:
              request.model,
            quality:
              request.quality,
            size:
              request.size,
            outputFormat:
              request.outputFormat,
            n: 1
          });

        return {
          provider: "openai",
          model:
            request.model,
          providerConfig:
            providerAuthority.config,
          providerConfigFingerprint:
            providerAuthority.fingerprint,
          status: 200,
          requestId:
            "req_simulation",
          imageBytes:
            outputPng,
          mimeType: "image/png",
          responseBytes: 999,
          outputBytes:
            outputPng.length,
          durationMs: 1234,
          usage: {
            total_tokens: 456
          }
        };
      }
  });

assert.equal(coreCalls.length, 1);
assert.equal(
  coreCalls[0].quality,
  "high"
);
assert.equal(
  coreCalls[0].size,
  "auto"
);
assert.equal(
  coreCalls[0].outputFormat,
  "png"
);
assert.equal(
  coreCalls[0].instruction,
  compiled.instruction
);

assert.equal(
  simulation.simulationVersion,
  FACE_LAB_AI_SIMULATION_VERSION
);
assert.equal(
  simulation.status,
  "ready"
);
assert.equal(
  simulation.providerConfigVersion,
  FACE_LAB_SIMULATION_PROVIDER_CONFIG_VERSION
);
assert.equal(
  simulation.providerConfigFingerprint,
  expectedProviderAuthority.fingerprint
);
assert.equal(
  Object.prototype.hasOwnProperty.call(
    simulation,
    "providerConfig"
  ),
  false,
  "full provider config must remain server-runtime internal"
);
assert.equal(
  simulation.routeId,
  "route-balanced"
);
assert.equal(
  simulation.lookId,
  "look-route-balanced"
);
assert.deepEqual(
  simulation.imageBytes,
  outputPng
);
assert.equal(
  simulation.fidelity.status,
  "not_evaluated",
  "provider success must not be promoted to a fidelity pass"
);
assert.deepEqual(
  simulation.fidelity
    .requiredChecks,
  [
    "identity_preservation",
    "route_adherence",
    "color_fidelity",
    "edit_scope"
  ]
);
assert.deepEqual(
  simulation.fidelity.evidence,
  []
);
assert.equal(
  simulation.telemetry
    .durationMs,
  1234
);
assert.equal(
  Object.prototype.hasOwnProperty.call(
    simulation,
    "instruction"
  ),
  false,
  "compiled prompt must not be exposed in the simulation result envelope"
);
assert.equal(
  Object.prototype.hasOwnProperty.call(
    simulation,
    "providerPayload"
  ),
  false
);

await assert.rejects(
  () =>
    generateFaceLabSimulationCore({
      apiKey: "sk-test",
      imageBuffer: sourcePng,
      mimeType: "image/png",
      renderSpec,
      model:
        OPENAI_IMAGE_EDIT_MODEL,
      providerRuntime:
        async (request) => ({
          provider: "openai",
          model: request.model,
          providerConfig:
            expectedProviderAuthority.config,
          providerConfigFingerprint:
            "f".repeat(64),
          imageBytes:
            outputPng,
          mimeType: "image/png"
        })
    }),
  /simulation_provider_config_invalid/
);

await assert.rejects(
  () =>
    generateFaceLabSimulationCore({
      apiKey: "sk-test",
      imageBuffer: sourcePng,
      mimeType: "image/png",
      renderSpec: {
        ...renderSpec,
        status: "invalid"
      },
      providerRuntime:
        async () => {
          throw new Error(
            "must not be called"
          );
        }
    }),
  /simulation_instruction_render_spec_not_ready/
);

console.log(JSON.stringify({
  ok: true,
  instructionVersion:
    FACE_LAB_SIMULATION_INSTRUCTION_VERSION,
  simulationVersion:
    FACE_LAB_AI_SIMULATION_VERSION,
  providerModel:
    OPENAI_IMAGE_EDIT_MODEL,
  checked: [
    "same_person_instruction",
    "identity_lock",
    "committed_operations_only",
    "execution_only_disclosure",
    "candidate_identity_preserved",
    "applied_reference_serialization",
    "swatch_role_disclosure",
    "not_pixel_exact_disclosure",
    "provider_multipart_contract",
    "provider_config_request_binding",
    "provider_config_fingerprint_mutations",
    "provider_config_non_authority_exclusions",
    "provider_config_privacy",
    "provider_config_result_validation",
    "provider_429_retry_once",
    "provider_429_retry_exhaustion",
    "provider_redirect_rejection",
    "input_signature_validation",
    "output_signature_validation",
    "bounded_result_envelope",
    "no_prompt_logging",
    "fidelity_not_evaluated",
    "no_live_provider_call"
  ]
}, null, 2));
