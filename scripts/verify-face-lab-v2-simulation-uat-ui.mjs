import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const CLIENT_PATH = "app/face-lab-test/FaceLabTestClient.jsx";
const SECTION_PATH = "components/full-report/PremiumFaceLabSection.jsx";

const client = (await readFile(CLIENT_PATH, "utf8")).replace(/\r\n/g, "\n");
const section = (await readFile(SECTION_PATH, "utf8")).replace(/\r\n/g, "\n");

function requireFragment(source, fragment, label) {
  assert.ok(source.includes(fragment), `${label}: missing required fragment`);
}

requireFragment(client, 'const [sourceImageFile, setSourceImageFile] = useState(null);', "source image File retention");
requireFragment(client, 'setSourceImageFile(file);', "source image File capture");
requireFragment(client, 'payload?.simulationAuthority?.token', "signed authority capture");
requireFragment(client, 'fetch("/api/face-lab-simulation-test"', "simulation endpoint");
requireFragment(client, 'formData.append("image", sourceImageFile);', "simulation source image");
requireFragment(client, 'formData.append("locale", "ko");', "simulation locale");
requireFragment(client, 'formData.append("simulationAuthority", simulationAuthority.token);', "simulation authority token");
requireFragment(client, 'formData.append("analysis", JSON.stringify(faceLabAnalysis));', "authoritative observation analysis");
requireFragment(client, 'formData.append("faceLabV2State", JSON.stringify(simulationState));', "Face Lab V2 user state");
requireFragment(client, '"Idempotency-Key": globalThis.crypto.randomUUID()', "idempotency key");
requireFragment(client, 'const blob = await response.blob();', "binary image response");
requireFragment(client, 'URL.createObjectURL(blob)', "binary image object URL");
requireFragment(client, 'URL.revokeObjectURL(current);', "object URL revocation");
requireFragment(client, 'response.headers.get("X-Face-Lab-Route-Id")', "route response metadata");
requireFragment(client, 'response.headers.get("X-Face-Lab-Look-Id")', "look response metadata");
requireFragment(client, 'response.headers.get("X-Face-Lab-Fidelity")', "fidelity response metadata");
requireFragment(client, 'Fidelity는 아직 평가되지 않았습니다.', "unverified fidelity copy");
requireFragment(client, 'simulationState?.selectedRouteId', "committed route gating");
requireFragment(client, 'simulationStatus !== "generating"', "duplicate generation gating");

assert.doesNotMatch(
  client,
  /formData\.append\("(?:renderSpec|look|appearanceHandoff|providerRuntime|providerPayload|prompt)"/,
  "client must not submit render/provider authority"
);

requireFragment(section, 'onSimulationStateChange = null', "simulation state callback prop");
requireFragment(section, 'const selectedRouteId = committedRouteIdFromResult(result);', "committed route derivation");
requireFragment(section, 'onSimulationStateChange({', "simulation state emission");
requireFragment(section, 'surveyAnswers,', "survey state emission");
requireFragment(section, 'targetFinderResult: approvedFinder || null,', "finder state emission");
requireFragment(section, 'selectedRouteId', "route state emission");
requireFragment(section, 'emitSimulationState(\n        stored.surveyAnswers,', "restored state emission");
requireFragment(section, 'emitSimulationState(surveyAnswers, approvedFinder, result);', "confirmed state emission");
requireFragment(section, 'clearSimulationState();', "edit invalidation");

assert.doesNotMatch(
  section,
  /onSimulationStateChange\(\{[\s\S]{0,500}(?:renderSpec|appearanceHandoff|providerRuntime|providerPayload|prompt)\s*:/,
  "simulation callback must not expose render/provider authority"
);

console.log("FACE_LAB_V2_SIMULATION_UAT_UI=PASS");
