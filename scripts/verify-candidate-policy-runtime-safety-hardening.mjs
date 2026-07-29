import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  buildCandidatePolicyRuntimeSafetyContext,
  CANDIDATE_POLICY_RUNTIME_SAFETY_CONTEXT_VERSION
} from "../lib/candidate-policy-runtime-safety.js";
import { buildCandidatePolicyGoalContext } from "../lib/candidate-policy-goal-context.js";
import {
  buildEvaluatorBoundaryPolicyRuntimeTelemetry,
  resolveEvaluatorBoundaryPolicyRuntimeControl,
  validateEvaluatorBoundaryPolicyRuntimeTelemetry
} from "../lib/evaluator-boundary-policy-runtime-observability.js";
import { buildEvaluatorBoundaryPolicyRuntime } from "../lib/evaluator-boundary-policy-runtime.js";
import { buildEvaluatorBoundaryPolicyShadow } from "../lib/evaluator-boundary-policy-shadow.js";

const SCHEMA_VERSION = "candidate-policy-runtime-safety-evidence-v1";
const EXPECTED_SCENARIOS = [
  "R01", "R02", "R03", "R04", "R05", "R06", "R07",
  "R09", "R10", "R11", "R13", "R14"
];
let assertionCount = 0;

function check(value, message) {
  assertionCount += 1;
  assert.ok(value, message);
}

function equal(actual, expected, message) {
  assertionCount += 1;
  assert.equal(actual, expected, message);
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value).sort().map((key) => [key, stable(value[key])])
  );
}

function semanticHash(value) {
  return createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
}

function product(id, overrides = {}) {
  return {
    id,
    category: "treatment",
    irritation_risk: "low",
    sensitivity_safe: true,
    concerns: ["dehydration"],
    ingredient_signals: {
      functional: [{ label: "skin hydration", count: 3 }]
    },
    ...overrides
  };
}

function safetyContext(stabilizationMode) {
  return buildCandidatePolicyRuntimeSafetyContext({
    sharedContext: {
      safetyState: {
        level: stabilizationMode ? "stabilize_first" : "stable",
        activeExpansionAllowed: !stabilizationMode,
        protectionMustMaintain: true
      }
    },
    functionalPolicy: {
      version: "functional-policy-v1",
      planMode: stabilizationMode ? "HOLD" : "START",
      recommendationSuppressed: stabilizationMode,
      reasonCodes: [stabilizationMode ? "fixture_stabilize" : "fixture_stable"],
      safety: {
        level: stabilizationMode ? "stabilize_first" : "stable",
        activeExpansionAllowed: !stabilizationMode,
        protectionMustMaintain: true
      }
    }
  });
}

function goalContext() {
  return buildCandidatePolicyGoalContext({
    surveyContract: {
      goals: { primaryConcern: "dehydration" }
    },
    sharedContext: {
      version: "shared-skin-decision-context-v3",
      skinState: { priorityAxis: "dehydration" }
    },
    functionalPolicy: {
      version: "functional-policy-v1",
      priorityAxis: "dehydration"
    },
    effectivePolicySource: "raw"
  });
}

function runtime(products, context = safetyContext(false)) {
  return buildEvaluatorBoundaryPolicyRuntime({
    products,
    surveyContract: {
      safety: {
        recentSkinChange: context?.stabilizationMode ? "yes" : "no",
        sensitivityRisk: context?.stabilizationMode ? "high" : "low",
        rednessRisk: context?.stabilizationMode ? "high" : "low"
      }
    },
    goalPolicy: {
      rankingGoal: "dehydration",
      safetyGoal: context?.stabilizationMode ? "stabilize" : "maintain",
      recommendationGuard: context?.stabilizationMode ? "stabilize_first" : "none",
      recentInstability: context?.stabilizationMode === true,
      highSensitivity: context?.stabilizationMode === true
    },
    candidateSafetyContext: context,
    candidateGoalContext: goalContext()
  });
}

function scenario(id, result, blockedId = null) {
  const visible = [...result.visibleCandidateIds];
  const blocked = blockedId ? !visible.includes(blockedId) : null;
  const pools = {
    topPick: visible.slice(0, 1),
    alternatives: visible.slice(1, 3),
    supporting: visible.slice(0, 3),
    routine: visible.slice(0, 3),
    budget: visible.slice(0, 3)
  };
  return {
    id,
    visible,
    blocked,
    pools,
    safetyBlockReasonCounts: result.safetyBlockReasonCounts,
    exposureGroupCounts: result.exposureGroupCounts,
    safetyContextValid: result.safetyContextValid,
    policyApplicationStatus: result.policyApplicationStatus
  };
}

function materializeEvidence() {
  const completeSunscreen = product("fixture-sunscreen-complete", {
    category: "sunscreen",
    spf_value: "50+",
    uva_label: "PA++++",
    uv_filter_type: "organic",
    pilling_risk: null,
    ingredient_signals: {
      functional: [{ label: "uv protection", count: 3 }]
    }
  });
  const uvaMissing = { ...completeSunscreen, id: "fixture-sunscreen-uva-missing", uva_label: null };
  const spfMissing = { ...completeSunscreen, id: "fixture-sunscreen-spf-missing", spf_value: null };
  const filterMissing = { ...completeSunscreen, id: "fixture-sunscreen-filter-missing", uv_filter_type: null };
  const active = product("fixture-active-tone", {
    concerns: ["uneven_tone"],
    ingredient_signals: {
      functional: [{ label: "whitening", count: 3 }]
    }
  });
  const maintenance = product("fixture-maintenance-hydration");
  const stable = safetyContext(false);
  const stabilizing = safetyContext(true);

  const results = {
    R01: runtime([completeSunscreen], stable),
    R02: runtime([uvaMissing], stable),
    R03: runtime([spfMissing], stable),
    R04: runtime([filterMissing], stable),
    R05: runtime([completeSunscreen], stable),
    R06: runtime([active], stabilizing),
    R07: runtime([maintenance], stabilizing),
    R09: runtime([active], null),
    R13: runtime([maintenance], stable),
    R14: runtime([active], stable)
  };
  const combined = runtime([uvaMissing, active, maintenance], stabilizing);
  const runtimeParity = runtime([completeSunscreen, uvaMissing, active, maintenance], stabilizing);
  const shadowParity = buildEvaluatorBoundaryPolicyShadow({
    products: [completeSunscreen, uvaMissing, active, maintenance],
    surveyContract: {
      safety: { recentSkinChange: "yes", sensitivityRisk: "high", rednessRisk: "high" }
    },
    goalPolicy: {
      rankingGoal: "dehydration",
      safetyGoal: "stabilize",
      recommendationGuard: "stabilize_first",
      recentInstability: true,
      highSensitivity: true
    },
    candidateSafetyContext: stabilizing,
    candidateGoalContext: goalContext()
  });

  return {
    schemaVersion: SCHEMA_VERSION,
    contextVersion: CANDIDATE_POLICY_RUNTIME_SAFETY_CONTEXT_VERSION,
    scenarios: [
      scenario("R01", results.R01),
      scenario("R02", results.R02, uvaMissing.id),
      scenario("R03", results.R03, spfMissing.id),
      scenario("R04", results.R04, filterMissing.id),
      scenario("R05", results.R05),
      scenario("R06", results.R06, active.id),
      scenario("R07", results.R07),
      scenario("R09", results.R09, active.id),
      scenario("R10", combined, null),
      {
        id: "R11",
        runtimeGroups: runtimeParity.exposureRows.map((row) => row.appliedExposureGroup),
        shadowGroups: shadowParity.receivers.map((row) => row.futureExposureGroup)
      },
      scenario("R13", results.R13),
      scenario("R14", results.R14)
    ],
    blockedCandidateIds: [uvaMissing.id, spfMissing.id, filterMissing.id, active.id],
    preferenceOnlyCandidateId: completeSunscreen.id,
    completeSunscreenId: completeSunscreen.id,
    maintenanceId: maintenance.id,
    activeId: active.id
  };
}

function validateEvidence(evidence) {
  const errors = [];
  const rows = new Map((Array.isArray(evidence?.scenarios) ? evidence.scenarios : [])
    .map((row) => [row.id, row]));
  if (evidence?.schemaVersion !== SCHEMA_VERSION) errors.push("invalid_schema_version");
  if (JSON.stringify([...rows.keys()]) !== JSON.stringify(EXPECTED_SCENARIOS)) {
    errors.push("scenario_exact_set_mismatch");
  }
  const visible = (id, candidateId) => rows.get(id)?.visible?.includes(candidateId) === true;
  if (!visible("R01", evidence.completeSunscreenId)) errors.push("complete_sunscreen_blocked");
  for (const id of ["R02", "R03", "R04"]) {
    if (rows.get(id)?.blocked !== true) errors.push(`${id.toLowerCase()}_protection_fail_open`);
  }
  if (!visible("R05", evidence.preferenceOnlyCandidateId)) errors.push("preference_only_sunscreen_blocked");
  if (rows.get("R06")?.blocked !== true) errors.push("stabilization_active_fail_open");
  if (!visible("R07", evidence.maintenanceId)) errors.push("stabilization_maintenance_blocked");
  if (rows.get("R09")?.blocked !== true ||
      rows.get("R09")?.safetyContextValid !== false) {
    errors.push("missing_context_fail_open");
  }
  const r10 = rows.get("R10");
  for (const pool of ["topPick", "alternatives", "supporting", "routine", "budget"]) {
    if ((r10?.pools?.[pool] || []).some((id) => evidence.blockedCandidateIds.includes(id))) {
      errors.push(`blocked_candidate_in_${pool}`);
    }
  }
  if (JSON.stringify(rows.get("R11")?.runtimeGroups) !==
      JSON.stringify(rows.get("R11")?.shadowGroups)) {
    errors.push("shadow_runtime_safety_parity_mismatch");
  }
  if (!visible("R13", evidence.maintenanceId)) errors.push("non_sunscreen_regression");
  if (!visible("R14", evidence.activeId)) errors.push("stable_active_regression");
  return { valid: errors.length === 0, errors };
}

const first = materializeEvidence();
const second = materializeEvidence();
const firstValidation = validateEvidence(first);
const secondValidation = validateEvidence(second);
check(firstValidation.valid, firstValidation.errors.join(","));
check(secondValidation.valid, secondValidation.errors.join(","));
equal(semanticHash(first), semanticHash(second), "R15 semantic rerun drift");
const firstRows = new Map(first.scenarios.map((row) => [row.id, row]));
equal(firstRows.get("R01").visible.length, 1, "R01 complete sunscreen hidden");
equal(firstRows.get("R02").visible.length, 0, "R02 UVA missing fail-open");
equal(firstRows.get("R03").visible.length, 0, "R03 SPF missing fail-open");
equal(firstRows.get("R04").visible.length, 0, "R04 filter missing fail-open");
equal(firstRows.get("R05").visible.length, 1, "R05 preference-only missing hidden");
equal(firstRows.get("R06").visible.length, 0, "R06 stabilization active fail-open");
equal(firstRows.get("R07").visible.length, 1, "R07 maintenance blocked");
equal(firstRows.get("R09").visible.length, 0, "R09 missing context fail-open");
equal(
  firstRows.get("R02").safetyBlockReasonCounts.sunscreen_protection_metadata_incomplete,
  1,
  "R02 fail-closed reason missing"
);
equal(
  firstRows.get("R06").safetyBlockReasonCounts.stabilization_active_expansion_blocked,
  1,
  "R06 stabilization reason missing"
);

const defaultControl = resolveEvaluatorBoundaryPolicyRuntimeControl({ NODE_ENV: "production" });
equal(defaultControl.runtimeEnabled, false, "R08 runtime default must remain disabled");

const telemetry = buildEvaluatorBoundaryPolicyRuntimeTelemetry({
  control: {
    runtimeEnabled: true,
    disableRequested: false,
    killSwitchSuppressedExecution: false,
    scopeValidationFailed: false,
    canaryScope: "local_synthetic_probe"
  },
  runtimeResult: runtime([
    product("fixture-telemetry-active", {
      ingredient_signals: { functional: [{ label: "whitening", count: 3 }] }
    })
  ], safetyContext(true))
});
check(validateEvaluatorBoundaryPolicyRuntimeTelemetry(telemetry).valid, "R12 telemetry invalid");
check(!/product(name|id)|brand|url|survey/i.test(JSON.stringify(telemetry)), "R12 forbidden field");

const negativeControls = [];
function negative(id, mutate, expectedError) {
  const tampered = structuredClone(first);
  mutate(tampered);
  const validation = validateEvidence(tampered);
  check(!validation.valid, `${id} unexpectedly passed`);
  check(validation.errors.includes(expectedError), `${id} failed outside intended assertion`);
  negativeControls.push({ id, rejected: true, reason: expectedError });
}

negative("NC01", (value) => {
  const row = value.scenarios.find((item) => item.id === "R02");
  row.visible = ["fixture-sunscreen-uva-missing"];
  row.blocked = false;
}, "r02_protection_fail_open");
negative("NC02", (value) => {
  const row = value.scenarios.find((item) => item.id === "R06");
  row.visible = [value.activeId];
  row.blocked = false;
}, "stabilization_active_fail_open");
negative("NC03", (value) => {
  value.scenarios.find((item) => item.id === "R10").pools.alternatives =
    ["fixture-sunscreen-uva-missing"];
}, "blocked_candidate_in_alternatives");
negative("NC04", (value) => {
  value.scenarios.find((item) => item.id === "R10").pools.budget =
    ["fixture-active-tone"];
}, "blocked_candidate_in_budget");
negative("NC05", (value) => {
  value.scenarios.find((item) => item.id === "R05").visible = [];
}, "preference_only_sunscreen_blocked");
negative("NC06", (value) => {
  const row = value.scenarios.find((item) => item.id === "R09");
  row.visible = [value.activeId];
  row.blocked = false;
  row.safetyContextValid = true;
}, "missing_context_fail_open");

const forbiddenTelemetry = { ...telemetry, productName: "forbidden-fixture-field" };
check(
  !validateEvaluatorBoundaryPolicyRuntimeTelemetry(forbiddenTelemetry).valid,
  "NC07 forbidden telemetry field was accepted"
);
negativeControls.push({ id: "NC07", rejected: true, reason: "forbidden_telemetry_field" });

const tempRoot = await mkdtemp(path.join(os.tmpdir(), "candidate-safety-verifier-"));
try {
  await writeFile(path.join(tempRoot, "safety-evidence.json"), "{\"schemaVersion\":\"stale\"}\n");
  const staleEvidence = JSON.parse(
    await readFile(path.join(tempRoot, "safety-evidence.json"), "utf8")
  );
  check(
    validateEvidence(staleEvidence).errors.includes("invalid_schema_version"),
    "NC08 malformed pre-existing artifact was accepted"
  );
  const isolated = await mkdtemp(path.join(tempRoot, "isolated-"));
  await writeFile(
    path.join(isolated, "safety-evidence.json"),
    `${JSON.stringify(materializeEvidence(), null, 2)}\n`
  );
  const files = (await readdir(isolated)).sort();
  equal(JSON.stringify(files), JSON.stringify(["safety-evidence.json"]), "NC08 artifact exact set");
  const isolatedEvidence = JSON.parse(
    await readFile(path.join(isolated, "safety-evidence.json"), "utf8")
  );
  check(validateEvidence(isolatedEvidence).valid, "NC08 stale artifact was reused");
  negativeControls.push({ id: "NC08", rejected: true, reason: "isolated_fresh_output" });
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}

check(assertionCount >= 24, "assertion floor regressed");
process.stdout.write(`${JSON.stringify({
  status: "PASS",
  verifier: "candidate-policy-runtime-safety-hardening",
  assertionCount,
  scenarioCount: EXPECTED_SCENARIOS.length,
  negativeControlCount: negativeControls.length,
  semanticHashFirst: semanticHash(first),
  semanticHashSecond: semanticHash(second),
  cleanupCompleted: true
})}\n`);
