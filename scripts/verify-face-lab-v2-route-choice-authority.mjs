import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildFaceLabV2Canonical,
  resolveFaceLabV2RouteSelection
} from "../lib/face-lab-v2/canonical-composer.js";
import { buildFaceLabV2ResultPresentation } from "../lib/face-lab-v2/result-presentation.js";
import { buildFaceLabV2TargetSweepCohort } from "../lib/face-lab-v2/evaluation/target-responsiveness.js";

const empty = resolveFaceLabV2RouteSelection({ routes: [] }, null);
assert.deepEqual(empty, { route: null, selectionState: "no_route" });

const onlyRoute = { routeId: "only" };
const single = resolveFaceLabV2RouteSelection(
  { routes: [onlyRoute], defaultRouteId: "only" },
  null
);
assert.equal(single.route, onlyRoute);
assert.equal(single.selectionState, "single_route_auto");

const routeA = { routeId: "a" };
const routeB = { routeId: "b" };
const preview = resolveFaceLabV2RouteSelection(
  { routes: [routeA, routeB], defaultRouteId: "b" },
  null
);
assert.equal(preview.route, routeB);
assert.equal(preview.selectionState, "default_preview");

const explicit = resolveFaceLabV2RouteSelection(
  { routes: [routeA, routeB], defaultRouteId: "b" },
  "a"
);
assert.equal(explicit.route, routeA);
assert.equal(explicit.selectionState, "user_selected");

const invalid = resolveFaceLabV2RouteSelection(
  { routes: [routeA, routeB], defaultRouteId: "b" },
  "missing"
);
assert.equal(invalid.route, routeB);
assert.equal(invalid.selectionState, "default_preview");

const cohort = buildFaceLabV2TargetSweepCohort();
const caseDef = cohort.cases[0];
const canonicalPreview = buildFaceLabV2Canonical({
  analysis: caseDef.analysis,
  surveyAnswers: caseDef.surveyAnswers,
  resultId: "route-choice-preview"
});

assert.equal(canonicalPreview.routes.routes.length, 3);
assert.equal(canonicalPreview.routes.selectionState, "default_preview");
assert.equal(
  canonicalPreview.routes.selectedRouteId,
  canonicalPreview.routes.defaultRouteId,
  "default route may be computed internally as preview but must not imply user choice"
);

const previewView = buildFaceLabV2ResultPresentation(canonicalPreview, {
  locale: "ko"
});
assert.equal(previewView.routes.selectionState, "default_preview");
assert.equal(previewView.routes.selectionCommitted, false);
assert.equal(previewView.routes.selectedRouteId, null);
assert.ok(previewView.routes.selectionPrompt);
assert.equal(
  previewView.routes.cards.filter((route) => route.selected).length,
  0,
  "default preview must not render as a user-selected route"
);
assert.equal(
  previewView.routes.cards.filter((route) => route.defaultCandidate).length,
  1,
  "exactly one emitted route must remain identifiable as the starting point"
);
assert.ok(
  previewView.routes.cards.find((route) => route.defaultCandidate)?.defaultLabel
);
assert.equal(previewView.execution.domains.length, 0);
assert.equal(previewView.look, null);
assert.equal(previewView.productGuides.length, 0);

const chosenRouteId = canonicalPreview.routes.routes[0].routeId;
const canonicalChosen = buildFaceLabV2Canonical({
  analysis: caseDef.analysis,
  surveyAnswers: caseDef.surveyAnswers,
  selectedRouteId: chosenRouteId,
  resultId: "route-choice-explicit"
});
assert.equal(canonicalChosen.routes.selectionState, "user_selected");
assert.equal(canonicalChosen.routes.selectedRouteId, chosenRouteId);

const chosenView = buildFaceLabV2ResultPresentation(canonicalChosen, {
  locale: "ko"
});
assert.equal(chosenView.routes.selectionCommitted, true);
assert.equal(chosenView.routes.selectedRouteId, chosenRouteId);
assert.equal(chosenView.routes.selectionPrompt, null);
assert.equal(
  chosenView.routes.cards.filter((route) => route.selected).length,
  1
);
assert.ok(
  chosenView.execution.domains.length > 0,
  "explicit route choice must unlock route-scoped execution"
);
assert.ok(chosenView.look, "explicit route choice must unlock composed look");

const apiSource = readFileSync("app/api/premium/face-lab-v2/route.js", "utf8");
assert.ok(apiSource.includes("function committedRouteId("));
assert.ok(apiSource.includes('selectionState === "default_preview"'));
assert.ok(
  apiSource.includes("selectedRouteId: committedRouteId(canonicalV2, normalized.selectedRouteId)")
);

const componentSource = readFileSync(
  "components/full-report/PremiumFaceLabSection.jsx",
  "utf8"
);
assert.ok(componentSource.includes("function committedRouteIdFromResult("));
assert.ok(componentSource.includes('["user_selected", "single_route_auto"]'));
assert.ok(componentSource.includes("committedRouteIdFromResult(result)"));

console.log(JSON.stringify({
  ok: true,
  preview: {
    routeCount: canonicalPreview.routes.routes.length,
    defaultRouteId: canonicalPreview.routes.defaultRouteId,
    internalPreviewRouteId: canonicalPreview.routes.selectedRouteId,
    presentationSelectedRouteId: previewView.routes.selectedRouteId,
    selectionState: previewView.routes.selectionState,
    executionDomainCount: previewView.execution.domains.length
  },
  explicit: {
    selectedRouteId: chosenView.routes.selectedRouteId,
    selectionState: canonicalChosen.routes.selectionState,
    executionDomains: chosenView.execution.domains.map((item) => item.domain)
  }
}, null, 2));
