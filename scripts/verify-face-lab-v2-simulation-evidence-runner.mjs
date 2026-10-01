import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  FACE_LAB_AI_SIMULATION_VERSION
} from "../lib/face-lab-v2/simulation-service-core.js";
import {
  FACE_LAB_SIMULATION_INSTRUCTION_VERSION
} from "../lib/face-lab-v2/simulation-instructions.js";
import {
  buildFaceLabSimulationCanonical,
  hashFaceLabSimulationRenderSpec,
  normalizeFaceLabSimulationState,
  reconstructFaceLabSimulationRenderAuthority
} from "../lib/face-lab-v2/simulation-render-authority.js";
import {
  buildFaceLabSimulationEvidencePacket,
  FACE_LAB_SIMULATION_EVIDENCE_PACKET_VERSION,
  FACE_LAB_SIMULATION_EVIDENCE_TRACE_VERSION
} from "../lib/face-lab-v2/evaluation/simulation-evidence-packet.js";
import {
  buildFaceLabV2CoverageCohort
} from "../lib/face-lab-v2/evaluation/harness.js";

function buildReadyFixture() {
  const cohort =
    buildFaceLabV2CoverageCohort({
      caseCount: 12
    });

  for (const item of cohort.cases) {
    const initialState = {
      surveyAnswers:
        item.surveyAnswers,
      targetFinderResult: null,
      selectedRouteId: null
    };
    const normalized =
      normalizeFaceLabSimulationState(
        initialState
      );
    const preview =
      buildFaceLabSimulationCanonical({
        analysis: item.analysis,
        normalizedState: normalized,
        locale: "ko"
      });
    const routeId =
      preview?.routes?.routes?.[0]
        ?.routeId;

    if (!routeId) continue;

    const rawState = {
      ...initialState,
      selectedRouteId: routeId
    };
    const reconstructed =
      reconstructFaceLabSimulationRenderAuthority({
        analysis: item.analysis,
        rawState,
        locale: "ko"
      });

    if (
      reconstructed.status === "ready"
    ) {
      return {
        item,
        rawState,
        reconstructed
      };
    }
  }

  throw new Error(
    "no deterministic coverage fixture produced a renderable simulation authority"
  );
}

const fixture =
  buildReadyFixture();

assert.equal(
  fixture.reconstructed.status,
  "ready"
);
assert.ok(
  /^[a-f0-9]{64}$/.test(
    fixture.reconstructed
      .renderSpecSha256
  )
);
assert.equal(
  hashFaceLabSimulationRenderSpec(
    fixture.reconstructed.renderSpec
  ),
  fixture.reconstructed
    .renderSpecSha256
);

const responseMeta = {
  simulationVersion:
    FACE_LAB_AI_SIMULATION_VERSION,
  instructionVersion:
    FACE_LAB_SIMULATION_INSTRUCTION_VERSION,
  routeId:
    fixture.reconstructed
      .renderSpec.routeId,
  lookId:
    fixture.reconstructed
      .renderSpec.lookId,
  renderSpecSha256:
    fixture.reconstructed
      .renderSpecSha256
};

const sourceBytes =
  Buffer.from(
    "canonical-source-image-fixture"
  );
const outputBytes =
  Buffer.from(
    "generated-output-image-fixture"
  );

const packet =
  buildFaceLabSimulationEvidencePacket({
    caseId: "GATE-G-B-FIXTURE-001",
    analysis: fixture.item.analysis,
    rawState: fixture.rawState,
    locale: "ko",
    canonicalSourceImageBytes:
      sourceBytes,
    outputImageBytes:
      outputBytes,
    responseMeta
  });

assert.equal(packet.status, "ready");
assert.equal(
  packet.packetVersion,
  FACE_LAB_SIMULATION_EVIDENCE_PACKET_VERSION
);
assert.equal(
  packet.traceVersion,
  FACE_LAB_SIMULATION_EVIDENCE_TRACE_VERSION
);
assert.equal(
  packet.trace.renderSpecSha256,
  responseMeta.renderSpecSha256
);
assert.equal(
  packet.trace.routeId,
  responseMeta.routeId
);
assert.equal(
  packet.trace.lookId,
  responseMeta.lookId
);
assert.equal(
  packet.trace.sourceImageSha256.length,
  64
);
assert.equal(
  packet.trace.outputImageSha256.length,
  64
);
assert.equal(
  packet.trace.analysisSha256.length,
  64
);
assert.equal(
  packet.trace.faceLabV2StateSha256.length,
  64
);
assert.equal(
  packet.rawImagesIncluded,
  false
);
assert.equal(packet.analysis, undefined);
assert.equal(packet.faceLabV2State, undefined);
assert.equal(
  packet.evaluation.verdict,
  "not_evaluated"
);
assert.equal(
  packet.evaluation.checks
    .identity_preservation.status,
  "not_evaluated"
);
assert.equal(
  packet.evaluation.checks
    .route_adherence.status,
  "not_evaluated"
);
assert.equal(
  packet.evaluation.checks
    .edit_scope.status,
  "not_evaluated"
);
assert.ok(
  ["not_evaluated", "not_applicable"]
    .includes(
      packet.evaluation.checks
        .color_fidelity.status
    )
);

const serialized =
  JSON.stringify(packet);
for (const forbidden of [
  "canonical-source-image-fixture",
  "generated-output-image-fixture",
  "sourceImagePath",
  "outputImagePath",
  "data:image/",
  "providerPayload"
]) {
  assert.equal(
    serialized.includes(forbidden),
    false,
    "evidence packet leaked raw/private material: " +
      forbidden
  );
}

const digestMismatch =
  buildFaceLabSimulationEvidencePacket({
    caseId: "GATE-G-B-DIGEST-MISMATCH",
    analysis: fixture.item.analysis,
    rawState: fixture.rawState,
    locale: "ko",
    canonicalSourceImageBytes:
      sourceBytes,
    outputImageBytes:
      outputBytes,
    responseMeta: {
      ...responseMeta,
      renderSpecSha256:
        "f".repeat(64)
    }
  });
assert.equal(
  digestMismatch.status,
  "invalid"
);
assert.equal(
  digestMismatch.reason,
  "response_render_spec_digest_mismatch"
);

const instructionMismatch =
  buildFaceLabSimulationEvidencePacket({
    caseId: "GATE-G-B-INSTRUCTION-MISMATCH",
    analysis: fixture.item.analysis,
    rawState: fixture.rawState,
    locale: "ko",
    canonicalSourceImageBytes:
      sourceBytes,
    outputImageBytes:
      outputBytes,
    responseMeta: {
      ...responseMeta,
      instructionVersion:
        "face-lab-simulation-instruction-old"
    }
  });
assert.equal(
  instructionMismatch.status,
  "invalid"
);
assert.equal(
  instructionMismatch.reason,
  "response_instruction_version_mismatch"
);

const routeMismatch =
  buildFaceLabSimulationEvidencePacket({
    caseId: "GATE-G-B-ROUTE-MISMATCH",
    analysis: fixture.item.analysis,
    rawState: fixture.rawState,
    locale: "ko",
    canonicalSourceImageBytes:
      sourceBytes,
    outputImageBytes:
      outputBytes,
    responseMeta: {
      ...responseMeta,
      routeId: "route:wrong"
    }
  });
assert.equal(
  routeMismatch.status,
  "invalid"
);
assert.equal(
  routeMismatch.reason,
  "response_intent_mismatch"
);

const pending =
  packet.evaluation.checks;
const hardFailure =
  buildFaceLabSimulationEvidencePacket({
    caseId: "GATE-G-B-HARD-FAIL",
    analysis: fixture.item.analysis,
    rawState: fixture.rawState,
    locale: "ko",
    canonicalSourceImageBytes:
      sourceBytes,
    outputImageBytes:
      outputBytes,
    responseMeta,
    checks: {
      ...pending,
      identity_preservation: {
        status: "fail",
        findings: [
          {
            code:
              "IDENTITY_MAJOR_DRIFT",
            targetRef:
              "facial_geometry",
            failureSource:
              "provider"
          }
        ]
      }
    }
  });
assert.equal(
  hardFailure.status,
  "ready"
);
assert.equal(
  hardFailure.evaluation.verdict,
  "fail"
);

const endpointSource =
  readFileSync(
    "app/api/face-lab-simulation-test/route.js",
    "utf8"
  );
const cliSource =
  readFileSync(
    "scripts/build-face-lab-v2-simulation-evidence-packet.mjs",
    "utf8"
  );

for (const required of [
  "normalizeFaceLabSimulationState",
  "buildFaceLabSimulationCanonical",
  "findFaceLabSimulationCanonicalLook",
  "buildFaceLabSimulationRenderSpec",
  "hashFaceLabSimulationRenderSpec",
  '"X-Face-Lab-Render-Spec-SHA256"',
  '"X-Face-Lab-Instruction-Version"'
]) {
  assert.ok(
    endpointSource.includes(required),
    "simulation endpoint is missing shared evidence trace authority: " +
      required
  );
}

assert.ok(
  cliSource.includes(
    "canonicalizeImageBytes"
  )
);
assert.ok(
  cliSource.includes(
    "detectImageSignature"
  )
);
assert.ok(
  cliSource.includes(
    "buildFaceLabSimulationEvidencePacket"
  )
);
assert.ok(
  cliSource.includes(
    "console.log"
  )
);
assert.equal(
  cliSource.includes(
    "generateFaceLabSimulation"
  ),
  false,
  "evidence runner must not invoke the image provider"
);
assert.equal(
  cliSource.includes(
    "writeFile"
  ),
  false,
  "evidence runner must not persist private images or packet files implicitly"
);

console.log(
  "FACE_LAB_V2_SIMULATION_EVIDENCE_RUNNER=PASS"
);
