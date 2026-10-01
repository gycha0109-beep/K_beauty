import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const CLIENT_PATH = "app/face-lab-test/FaceLabTestClient.jsx";
const SECTION_PATH = "components/full-report/PremiumFaceLabSection.jsx";
const REVIEW_PANEL_PATH = "components/face-lab-test/FaceLabSimulationReviewPanel.jsx";

const client = (await readFile(CLIENT_PATH, "utf8")).replace(/\r\n/g, "\n");
const section = (await readFile(SECTION_PATH, "utf8")).replace(/\r\n/g, "\n");
const reviewPanel = (await readFile(REVIEW_PANEL_PATH, "utf8")).replace(/\r\n/g, "\n");

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
requireFragment(client, 'response.headers.get("X-Face-Lab-Review-Case-Id")', "review case response metadata");
requireFragment(client, 'response.headers.get("X-Face-Lab-Review-Ticket")', "review ticket response metadata");
requireFragment(client, 'response.headers.get("X-Face-Lab-Review-Expires-At")', "review expiry response metadata");
requireFragment(client, 'response.headers.get("X-Face-Lab-Provider-Config-Version")', "provider config version metadata");
requireFragment(client, 'response.headers.get("X-Face-Lab-Provider-Config-Fingerprint")', "provider config fingerprint metadata");
requireFragment(client, 'fetch("/api/face-lab-simulation-review-test"', "review endpoint");
requireFragment(client, 'mode: "template"', "review template mode");
requireFragment(client, 'mode: "submit"', "review submit mode");
requireFragment(client, 'setReviewAuthority(nextReviewAuthority);', "review ticket retention");
requireFragment(client, 'payload?.trace?.renderSpecSha256 !== authority.renderSpecSha256', "review template trace binding");
requireFragment(client, 'payload?.trace?.providerConfigVersion !== authority.providerConfigVersion', "review provider config version binding");
requireFragment(client, 'payload?.trace?.providerConfigFingerprint !== authority.providerConfigFingerprint', "review provider config fingerprint binding");
requireFragment(client, 'payload?.trace?.providerConfigFingerprint !== reviewAuthority.providerConfigFingerprint', "review submit provider config binding");
requireFragment(client, 'simulationImageUrl && reviewAuthority', "review panel output gating");
requireFragment(client, '<FaceLabSimulationReviewPanel', "review panel wiring");
requireFragment(client, 'resetReview();', "review invalidation on simulation reset");
requireFragment(client, 'simulationRequestSequenceRef.current += 1;', "stale simulation invalidation");
requireFragment(client, 'reviewRequestSequenceRef.current += 1;', "stale review invalidation");
requireFragment(client, 'Fidelity는 아직 평가되지 않았습니다.', "unverified fidelity copy");
requireFragment(client, 'simulationState?.selectedRouteId', "committed route gating");
requireFragment(client, 'simulationStatus !== "generating"', "duplicate generation gating");

assert.doesNotMatch(
  client,
  /formData\.append\("(?:renderSpec|look|appearanceHandoff|providerRuntime|providerPayload|prompt)"/,
  "client must not submit render/provider authority"
);

requireFragment(reviewPanel, 'data-face-lab-simulation-review-panel', "review panel marker");
requireFragment(reviewPanel, '(keys || []).map((key) => [key, null])', "null-default response maps");
requireFragment(reviewPanel, 'const complete =', "review completeness gate");
requireFragment(reviewPanel, 'disabled={!complete || submitStatus === "submitting"}', "review submit gating");
requireFragment(reviewPanel, 'reviewerRef: "operator-01"', "pseudonymous UAT reviewer ref");
requireFragment(reviewPanel, 'identityScopeReview: result.identityScopeReview', "safe identity review export");
requireFragment(reviewPanel, 'routeColorReview: result.routeColorReview', "safe route/color review export");
requireFragment(reviewPanel, 'Review JSON 복사', "review JSON export");
requireFragment(reviewPanel, '다시 평가', "review reset action");
requireFragment(reviewPanel, '이번 Render Spec에는 별도 색상 평가 대상이 없습니다.', "color N/A state");

assert.doesNotMatch(
  reviewPanel,
  /reviewTicket|simulationAuthority|sourceImageSha256|outputImageSha256|providerPayload|data:image\//,
  "review panel must not receive or export authority/image/provider material"
);

assert.doesNotMatch(
  reviewPanel,
  /\b(?:score|점수|rating)\b/i,
  "review panel must not introduce numeric scoring"
);

const exportStart = reviewPanel.indexOf("const exportPayload = {");
const exportEnd = reviewPanel.indexOf("navigator.clipboard.writeText", exportStart);
assert.ok(exportStart >= 0 && exportEnd > exportStart, "review export payload boundary missing");
const exportSlice = reviewPanel.slice(exportStart, exportEnd);
for (const forbidden of [
  "token",
  "ticket",
  "image",
  "renderSpecSha256",
  "analysis",
  "faceLabV2State",
  "provider"
]) {
  assert.equal(
    exportSlice.toLowerCase().includes(forbidden.toLowerCase()),
    false,
    "review export leaked forbidden material: " + forbidden
  );
}

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
