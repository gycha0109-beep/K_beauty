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
assert.equal(result.version, "face-lab-style-route-v4");
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

const minimalTargetStyle = {
  ...targetStyle,
  changeTolerance: "minimal"
};
const minimalResult = buildStyleRoutes(styleDelta, {
  locale: "en",
  targetStyle: minimalTargetStyle
});
assert.ok(
  minimalResult.routes.every((route) => route.actions.length <= 2),
  "minimal change tolerance must reduce actual route action count, not only route metadata"
);
assert.ok(
  minimalResult.routes.every((route) =>
    route.actions.every((action) => !["moderate", "strong"].includes(action.strength))
  ),
  "minimal change tolerance must bound actual action strength"
);
assert.ok(
  minimalResult.routes.every((route) => route.changeMagnitude === "low"),
  "minimal change tolerance must keep comparison metadata aligned with bounded execution"
);

const lightMakeupTargetStyle = {
  ...targetStyle,
  constraints: {
    ...targetStyle.constraints,
    makeup: { intensity: "light" }
  }
};
const lightMakeupResult = buildStyleRoutes(styleDelta, {
  locale: "en",
  targetStyle: lightMakeupTargetStyle
});
const lightMakeupActions = lightMakeupResult.routes
  .flatMap((route) => route.actions)
  .filter((action) => action.domain === "makeup");
assert.ok(lightMakeupActions.length > 0, "light makeup fixture must retain an executable makeup action");
assert.ok(
  lightMakeupActions.every((action) => !["moderate", "strong"].includes(action.strength)),
  "light makeup intensity must cap actual makeup execution strength at light"
);

const strongMakeupDelta = {
  ...styleDelta,
  priorities: styleDelta.priorities.map((item) =>
    item.domain === "makeup"
      ? { ...item, strength: "strong" }
      : item
  )
};
const mediumMakeupTargetStyle = {
  ...targetStyle,
  constraints: {
    ...targetStyle.constraints,
    makeup: { intensity: "medium" }
  }
};
const mediumMakeupResult = buildStyleRoutes(strongMakeupDelta, {
  locale: "en",
  targetStyle: mediumMakeupTargetStyle
});
const mediumMakeupActions = mediumMakeupResult.routes
  .flatMap((route) => route.actions)
  .filter((action) => action.domain === "makeup");
assert.ok(mediumMakeupActions.length > 0, "medium makeup fixture must retain an executable makeup action");
assert.ok(
  mediumMakeupActions.every((action) => action.strength !== "strong"),
  "medium makeup intensity must cap strong makeup execution at moderate"
);
assert.ok(
  mediumMakeupActions.some((action) => action.strength === "moderate"),
  "medium makeup intensity must remain distinct from the light cap"
);

const expressiveMakeupTargetStyle = {
  ...targetStyle,
  constraints: {
    ...targetStyle.constraints,
    makeup: { intensity: "expressive" }
  }
};
const expressiveMakeupResult = buildStyleRoutes(strongMakeupDelta, {
  locale: "en",
  targetStyle: expressiveMakeupTargetStyle
});
assert.ok(
  expressiveMakeupResult.routes
    .flatMap((route) => route.actions)
    .some((action) => action.domain === "makeup" && action.strength === "strong"),
  "expressive makeup intensity must preserve strong execution when Style Delta supports it"
);

const strongToleranceDelta = {
  ...styleDelta,
  priorities: styleDelta.priorities.map((item) =>
    ["hair", "makeup"].includes(item.domain)
      ? { ...item, strength: "strong" }
      : item
  )
};
const lightToleranceTargetStyle = {
  ...targetStyle,
  changeTolerance: "light",
  constraints: {
    ...targetStyle.constraints,
    makeup: { intensity: "expressive" }
  }
};
const lightToleranceResult = buildStyleRoutes(strongToleranceDelta, {
  locale: "en",
  targetStyle: lightToleranceTargetStyle
});
assert.ok(
  lightToleranceResult.routes
    .flatMap((route) => route.actions)
    .every((action) => action.strength !== "strong"),
  "light change tolerance must cap strong execution at moderate across styling domains"
);

const moderateToleranceTargetStyle = {
  ...lightToleranceTargetStyle,
  changeTolerance: "moderate"
};
const moderateToleranceResult = buildStyleRoutes(strongToleranceDelta, {
  locale: "en",
  targetStyle: moderateToleranceTargetStyle
});
assert.ok(
  moderateToleranceResult.routes
    .flatMap((route) => route.actions)
    .some((action) => action.strength === "strong"),
  "moderate change tolerance must preserve supported strong actions and remain distinct from light"
);

for (const legacyMakeupIntensity of ["grooming_only", "none"]) {
  const legacyMakeupResult = buildStyleRoutes(styleDelta, {
    locale: "en",
    targetStyle: {
      ...targetStyle,
      constraints: {
        ...targetStyle.constraints,
        makeup: { intensity: legacyMakeupIntensity }
      }
    }
  });

  assert.ok(
    legacyMakeupResult.routes.every((route) => !route.domains.includes("makeup")),
    `legacy ${legacyMakeupIntensity} preference must not reintroduce makeup execution after restore`
  );
  assert.ok(
    legacyMakeupResult.routes
      .flatMap((route) => route.actions)
      .every((action) => action.domain !== "makeup"),
    `legacy ${legacyMakeupIntensity} preference must remove makeup actions from mixed routes`
  );
}

const constrainedTargetStyle = {
  ...targetStyle,
  constraints: {
    ...targetStyle.constraints,
    lifestyle: {
      dailyMinutes: 5,
      budgetBand: "low",
      maintenanceTolerance: "low"
    }
  }
};
const constrainedResult = buildStyleRoutes(styleDelta, {
  locale: "en",
  targetStyle: constrainedTargetStyle
});
assert.equal(
  constrainedResult.defaultRouteId,
  "low_effort",
  "tight daily-time, budget, and maintenance constraints must change the default execution route"
);
const constrainedDefault = constrainedResult.routes.find(
  (route) => route.routeId === constrainedResult.defaultRouteId
);
assert.ok(constrainedDefault, "constrained default route must be present in the returned route set");
assert.ok(
  constrainedDefault.actions.length <= 2,
  "constrained default execution must remain materially lighter than multi-action alternatives"
);
assert.deepEqual(
  constrainedDefault.constraintFit.softTradeoffs,
  [],
  "the default constrained route must not claim a fit while carrying known lifestyle tradeoffs"
);

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
