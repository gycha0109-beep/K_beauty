import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const read = (path) => readFileSync(resolve(root, path), "utf8");

const fullReportApi = read("app/api/full-report/route.js");
const faceLabApi = read("app/api/premium/face-lab-v2/route.js");
const fullReportPage = read("app/result/full-report/page.js");
const premiumFaceLab = read("components/full-report/PremiumFaceLabSection.jsx");
const composer = read("lib/face-lab-v2/canonical-composer.js");
const styleDelta = read("lib/face-lab-v2/style-delta.js");

assert.ok(fullReportApi.includes("faceLabAnalysis"), "full report must persist validated Face Lab analysis");
assert.ok(
  fullReportApi.includes("getCanonicalFaceLabObservationAnalysis"),
  "stored premium Face Lab analysis must be revalidated"
);
assert.ok(
  fullReportPage.includes("faceLabAnalysis={report?.faceLabAnalysis || null}"),
  "premium page must pass persisted analysis into Face Lab V2"
);
assert.ok(
  fullReportPage.includes("savedReportId={persistedReportId}"),
  "premium page must pass saved report id for mutable Face Lab V2 state"
);

assert.ok(
  premiumFaceLab.includes('fetch("/api/premium/face-lab-v2"'),
  "Face Lab V2 target and route selections must persist through the dedicated endpoint"
);
assert.ok(
  premiumFaceLab.includes("/api/premium/face-lab-v2?savedReportId="),
  "Face Lab V2 must restore saved target state"
);
assert.equal(
  premiumFaceLab.includes("/api/analyze"),
  false,
  "target edits must not re-run photo analysis"
);
assert.ok(
  premiumFaceLab.includes("buildFaceLabV2Canonical"),
  "premium Face Lab must use the canonical V2 composer"
);
assert.equal(
  premiumFaceLab.includes("isFaceLabV2CanonicalResult(stored.canonicalV2)"),
  false,
  "restored state must be recomputed instead of trusting cached canonical output"
);
assert.equal(
  premiumFaceLab.includes("canonicalV2: result"),
  false,
  "local client persistence must not cache canonical output"
);
assert.equal(
  premiumFaceLab.includes("canonicalV2\n        })"),
  false,
  "client server-persistence payload must not submit canonical output as authority"
);

assert.ok(
  faceLabApi.includes('.update({ face_lab: persisted })'),
  "Face Lab V2 must persist in the mutable saved_reports.face_lab field"
);
assert.ok(
  faceLabApi.includes("data.premium_report?.faceLabAnalysis"),
  "Face Lab V2 must recompute from persisted observation analysis"
);
assert.ok(
  faceLabApi.includes("normalizeFaceLabV2PersistencePayload"),
  "Face Lab V2 persistence must normalize survey input"
);
assert.ok(
  faceLabApi.includes("rehydrateSavedV2(data)"),
  "saved Face Lab V2 state must be rehydrated from persisted analysis on load"
);
assert.ok(
  faceLabApi.includes("buildFaceLabV2Canonical"),
  "server persistence must recompute canonical V2 output"
);
const persistedBlock = faceLabApi.match(/const persisted = \{([\s\S]*?)\n  \};/);
assert.ok(persistedBlock, "Face Lab V2 persisted state block must exist");
assert.equal(
  /(^|\n)\s*canonicalV2\s*:/.test(persistedBlock[1]),
  false,
  "saved_reports.face_lab must persist user state, not a stale canonical result"
);
const readSavedBlock = faceLabApi.match(/function readSavedV2\(faceLab\) \{([\s\S]*?)\n\}/);
assert.ok(readSavedBlock, "Face Lab V2 saved-state reader must exist");
assert.equal(
  readSavedBlock[1].includes("faceLab.canonicalV2"),
  false,
  "saved-state reader must never restore a previously persisted canonical cache"
);
assert.ok(
  premiumFaceLab.includes("const resolvedRouteId = result.routes?.selectedRouteId || null"),
  "route persistence must use the canonical composer-resolved route id"
);
assert.ok(
  premiumFaceLab.includes("selectedRouteId: resolvedRouteId"),
  "local revisit state must persist the resolved route id"
);
assert.ok(
  premiumFaceLab.includes("persistServer(surveyAnswers, approvedFinder, resolvedRouteId)"),
  "server revisit state must persist the resolved route id"
);
assert.ok(
  premiumFaceLab.includes("const persistLocal = (value) =>"),
  "Face Lab V2 must isolate local persistence behind a failure-safe boundary"
);
assert.ok(
  premiumFaceLab.includes("try {\n      localStorage.setItem(storageKey"),
  "local persistence failure must not prevent server persistence"
);
assert.equal(
  premiumFaceLab.includes("setSelectedRouteId("),
  false,
  "selected route must have one authority: canonical.routes.selectedRouteId"
);

assert.ok(composer.includes("buildStyleDelta"), "canonical V2 must include Style Delta");
assert.ok(composer.includes("buildStyleRoutes"), "canonical V2 must include comparable routes");
assert.ok(composer.includes("buildHairExecution"), "canonical V2 must include Hair execution");
assert.ok(composer.includes("buildMakeupExecution"), "canonical V2 must include Makeup execution");
assert.ok(composer.includes("buildGroomingExecution"), "canonical V2 must include Grooming execution");
assert.ok(composer.includes("buildLookComposer"), "canonical V2 must include Look Composer");

assert.equal(
  /archetype/i.test(styleDelta),
  false,
  "Archetype must not drive the Style Delta engine"
);

console.log(JSON.stringify({
  ok: true,
  checks: [
    "premium_analysis_persistence",
    "target_without_reanalysis",
    "saved_target_restore",
    "server_rehydration",
    "cached_canonical_not_trusted",
    "resolved_route_persistence",
    "failure_safe_local_persistence",
    "single_selected_route_authority",
    "mutable_face_lab_v2_persistence",
    "canonical_execution_chain",
    "archetype_decoupled"
  ]
}, null, 2));
