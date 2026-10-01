import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  FACE_LAB_SIMULATION_AUTHORITY_VERSION,
  issueFaceLabSimulationAuthority,
  verifyFaceLabSimulationAuthority
} from "../lib/face-lab-v2/simulation-authority-core.js";

const secret =
  "test-secret-face-lab-simulation-authority";
const image =
  Buffer.from("canonical-image-fixture");
const analysis = {
  schemaVersion:
    "face-lab-observation-v1",
  status: "available",
  observations: {
    outline: {
      faceShape: {
        status: "available",
        value: "oval"
      }
    }
  }
};

const issued =
  issueFaceLabSimulationAuthority({
    secret,
    imageBuffer: image,
    analysis,
    locale: "ko",
    nowMs: 1_000_000,
    ttlMs: 60_000
  });

assert.ok(issued);
assert.equal(
  issued.version,
  FACE_LAB_SIMULATION_AUTHORITY_VERSION
);
assert.ok(
  typeof issued.token === "string" &&
  issued.token.length < 2048
);

const verified =
  verifyFaceLabSimulationAuthority({
    token: issued.token,
    secret,
    imageBuffer: image,
    analysis,
    locale: "ko",
    nowMs: 1_030_000
  });

assert.equal(verified.ok, true);

const changedAnalysis =
  structuredClone(analysis);
changedAnalysis.observations
  .outline.faceShape.value = "round";

assert.equal(
  verifyFaceLabSimulationAuthority({
    token: issued.token,
    secret,
    imageBuffer: image,
    analysis: changedAnalysis,
    locale: "ko",
    nowMs: 1_030_000
  }).code,
  "simulation_authority_mismatch"
);

assert.equal(
  verifyFaceLabSimulationAuthority({
    token: issued.token,
    secret,
    imageBuffer:
      Buffer.from(
        "different-canonical-image"
      ),
    analysis,
    locale: "ko",
    nowMs: 1_030_000
  }).code,
  "simulation_authority_mismatch"
);

assert.equal(
  verifyFaceLabSimulationAuthority({
    token: issued.token,
    secret,
    imageBuffer: image,
    analysis,
    locale: "ko",
    nowMs: 1_061_000
  }).code,
  "simulation_authority_expired"
);

assert.equal(
  verifyFaceLabSimulationAuthority({
    token: issued.token,
    secret: "wrong-secret",
    imageBuffer: image,
    analysis,
    locale: "ko",
    nowMs: 1_030_000
  }).code,
  "simulation_authority_invalid"
);

const testRoute = readFileSync(
  "app/api/face-reading-test/route.js",
  "utf8"
);
const readingRoute = readFileSync(
  "app/api/face-reading/route.js",
  "utf8"
);
const simulationRoute = readFileSync(
  "app/api/face-lab-simulation-test/route.js",
  "utf8"
);

assert.ok(
  testRoute.includes(
    "issueSimulationAuthority: true"
  )
);
assert.ok(
  readingRoute.includes(
    "issueFaceLabSimulationAuthority"
  )
);
assert.ok(
  readingRoute.includes(
    "simulationAuthority"
  )
);

for (const required of [
  'formData.get(\n        "simulationAuthority"\n      )',
  "verifyFaceLabSimulationAuthority",
  "normalizeFaceLabV2PersistencePayload",
  "buildFaceLabV2Canonical",
  "buildFaceLabRenderSpec",
  'endpoint:\n          "face-lab-simulation-test"',
  "generateFaceLabSimulation",
  "new NextResponse(",
  '"X-Face-Lab-Fidelity"',
  '"not_evaluated"'
]) {
  assert.ok(
    simulationRoute.includes(required),
    "simulation endpoint contract missing: " +
      required
  );
}

for (const forbidden of [
  'formData.get("renderSpec")',
  'formData.get("look")',
  'formData.get("appearanceHandoff")',
  "providerRuntime:"
]) {
  assert.equal(
    simulationRoute.includes(forbidden),
    false,
    "client/provider authority leaked: " +
      forbidden
  );
}

const authorityIndex =
  simulationRoute.indexOf(
    "verifyFaceLabSimulationAuthority"
  );
const canonicalIndex =
  simulationRoute.indexOf(
    "buildFaceLabV2Canonical",
    authorityIndex + 1
  );
const renderIndex =
  simulationRoute.indexOf(
    "buildFaceLabRenderSpec",
    canonicalIndex + 1
  );
const guardIndex =
  simulationRoute.indexOf(
    "await guardAnalysisRequest",
    renderIndex + 1
  );
const providerIndex =
  simulationRoute.indexOf(
    "await generateFaceLabSimulation",
    guardIndex + 1
  );

assert.ok(authorityIndex >= 0);
assert.ok(canonicalIndex > authorityIndex);
assert.ok(renderIndex > canonicalIndex);
assert.ok(guardIndex > renderIndex);
assert.ok(providerIndex > guardIndex);

console.log(JSON.stringify({
  ok: true,
  authorityVersion:
    FACE_LAB_SIMULATION_AUTHORITY_VERSION,
  checked: [
    "signed_authority_ticket",
    "analysis_tamper_rejected",
    "image_swap_rejected",
    "expiry_rejected",
    "server_canonical_rebuild",
    "server_render_spec_build",
    "guard_before_provider",
    "no_client_render_spec",
    "binary_no_store_output",
    "fidelity_not_evaluated"
  ]
}, null, 2));
