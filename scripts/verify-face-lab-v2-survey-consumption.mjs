import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const premium = readFileSync(resolve(root, "components/full-report/PremiumFaceLabSection.jsx"), "utf8");
const routes = readFileSync(resolve(root, "lib/face-lab-v2/route-generator.js"), "utf8");
const delta = readFileSync(resolve(root, "lib/face-lab-v2/style-delta.js"), "utf8");
const survey = readFileSync(resolve(root, "lib/face-lab-v2/survey-contract.js"), "utf8");

for (const token of [
  "setContexts",
  "hairLengthChange",
  "setHairLengthChange",
  "dyeAllowed",
  "setDyeAllowed",
  "copy.contextTitle",
  "copy.hairChange",
  "copy.dyeTitle"
]) {
  assert.equal(
    premium.includes(token),
    false,
    `Premium Face Lab must not collect an unconsumed V1 input: ${token}`
  );
}

assert.equal(
  /\n\s*contexts,\n/.test(premium),
  false,
  "new V1 survey payload must not submit context selections that do not affect the engine"
);
assert.equal(
  premium.includes("lengthChange: hairLengthChange"),
  false,
  "new V1 survey payload must not submit unused hair length-change input"
);
assert.equal(
  premium.includes('...(!dyeAllowed ? ["hair_dye"] : [])'),
  false,
  "new V1 survey payload must not manufacture a dye exclusion that no current action consumes"
);

for (const token of [
  "changeTolerance",
  "makeupIntensity",
  "dailyMinutes",
  "budgetBand",
  "maintenanceTolerance"
]) {
  assert.ok(routes.includes(token), `Route generator must consume exposed survey constraint: ${token}`);
}

assert.ok(
  delta.includes("targetStyle?.stylingScope"),
  "Style Delta must consume the exposed styling-scope selection"
);
assert.ok(
  premium.includes("setStylingScope(defaultScopes(value))"),
  "presentation preference must stay bounded to example/default-scope behavior"
);

assert.ok(survey.includes("contexts:"), "legacy stored contexts must remain readable");
assert.ok(survey.includes("lengthChange:"), "legacy stored hair length change must remain readable");
assert.ok(survey.includes("dye:"), "legacy stored dye preference must remain readable");

console.log(JSON.stringify({
  ok: true,
  checks: [
    "no_unconsumed_context_control",
    "no_unconsumed_hair_length_control",
    "no_unconsumed_dye_control",
    "exposed_route_constraints_consumed",
    "styling_scope_consumed",
    "presentation_preference_bounded",
    "legacy_payload_compatibility"
  ]
}, null, 2));
