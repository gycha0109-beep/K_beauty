import assert from "node:assert/strict";
import { buildStyleRoutes } from "../lib/face-lab-v2/route-generator.js";

const styleDelta = {
  status: "available",
  confidence: 0.81,
  evidence: ["fixture:route-quality"],
  priorities: [
    {
      constraintState: "allowed",
      domain: "hair",
      parameter: "outlineDefinition",
      direction: "increase",
      strength: "light",
      expectedEffect: "Hair outline action",
      reason: "face_modifier_contour_already_defined",
      evidence: ["target_axis:softSharp", "face_feature:contourDefinition=defined"]
    },
    {
      constraintState: "allowed",
      domain: "brow_grooming",
      parameter: "definition",
      direction: "increase",
      strength: "moderate",
      expectedEffect: "Brow definition action",
      reason: "target_softSharp_high",
      evidence: ["target_axis:softSharp"]
    },
    {
      constraintState: "allowed",
      domain: "makeup",
      parameter: "boundaryControl",
      direction: "increase",
      strength: "moderate",
      expectedEffect: "Makeup polish action",
      reason: "target_naturalPolished_high",
      evidence: ["target_axis:naturalPolished"]
    },
    {
      constraintState: "allowed",
      domain: "accessories",
      parameter: "visualWeight",
      direction: "increase",
      strength: "moderate",
      expectedEffect: "Accessory statement action",
      reason: "target_minimalStatement_high",
      evidence: ["target_axis:minimalStatement"]
    },
    {
      constraintState: "allowed",
      domain: "color",
      parameter: "temperatureDirection",
      direction: "shift",
      strength: "moderate",
      expectedEffect: "Color temperature action",
      reason: "target_warmCool_cool",
      evidence: ["target_axis:warmCool"]
    }
,
    {
      constraintState: "allowed",
      domain: "face_adjacent_style",
      parameter: "trendSignal",
      direction: "increase",
      strength: "light",
      expectedEffect: "Trend signal action without a V2 execution engine",
      reason: "target_classicTrendy_high",
      evidence: ["target_axis:classicTrendy"]
    }
  ]
};

const targetStyle = {
  changeTolerance: "moderate",
  constraints: {
    makeup: { intensity: "medium" },
    lifestyle: {
      dailyMinutes: 15,
      budgetBand: "standard",
      maintenanceTolerance: "medium"
    }
  }
};

const result = buildStyleRoutes(styleDelta, { locale: "en", targetStyle });
assert.equal(result.status, "available");
assert.equal(result.version, "face-lab-style-route-v2");
assert.ok(result.routes.length >= 2);
assert.ok(
  result.routes.every((route) => !route.domains.includes("face_adjacent_style")),
  "routes must not advertise a domain that has no V2 execution engine"
);
assert.ok(
  result.routes.every((route) => !route.targetFit.totalDimensions.includes("classicTrendy")),
  "target-fit denominator must only include target axes that current route engines can execute"
);

const balanced = result.routes.find((route) => route.strategy === "balanced");
assert.ok(balanced, "balanced route must remain available when several styling domains are actionable");
assert.ok(
  balanced.domains.length >= 2,
  "balanced route must actually distribute actions across multiple domains"
);
assert.ok(
  balanced.targetFit.coveredDimensions.length >= 2,
  "balanced route must cover multiple active target dimensions when they are available"
);
assert.equal(
  balanced.targetFit.totalDimensions.length,
  4,
  "target-fit denominator must come from active target axes, not action count"
);
assert.equal(
  balanced.targetFit.coverage,
  Number((balanced.targetFit.coveredDimensions.length / 4).toFixed(2))
);
assert.equal(
  /[가-힣]/.test(balanced.targetFit.explanation),
  false,
  "English target-fit explanation must not leak Korean copy"
);

const hair = result.routes.find((route) => route.strategy === "hair_led");
assert.ok(hair, "hair-led route must be generated from actionable hair priorities");
assert.ok(
  hair.actions[0].evidence.includes("face_feature:contourDefinition=defined"),
  "route action must preserve face evidence from Style Delta"
);
assert.ok(
  hair.faceEvidence.includes("face_feature:contourDefinition=defined"),
  "route must expose traceable face evidence used by its actions"
);
assert.equal(
  hair.targetFit.coveredDimensions.includes("softSharp"),
  true
);
assert.equal(
  hair.targetFit.totalDimensions.includes("naturalPolished"),
  true
);
assert.equal(
  hair.targetFit.status,
  "bounded",
  "single-axis route must not be labeled supported merely because it has multiple actions"
);

const signatures = result.routes.map((route) =>
  route.actions.map((item) => `${item.domain}:${item.parameter}:${item.direction}`).sort().join("|")
);
assert.equal(new Set(signatures).size, signatures.length, "route action sets must remain meaningfully distinct");

console.log(JSON.stringify({
  ok: true,
  version: result.version,
  routes: result.routes.map((route) => ({
    routeId: route.routeId,
    domains: route.domains,
    targetCoverage: route.targetFit.coverage,
    targetDimensions: route.targetFit.coveredDimensions,
    faceEvidence: route.faceEvidence
  }))
}, null, 2));
