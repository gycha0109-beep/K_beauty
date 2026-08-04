import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function productionImporters(exportName, excludedFiles = []) {
  const roots = ["app", "components", "hooks", "lib"];
  const matches = [];

  function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        walk(absolute);
      } else if (/\.[cm]?[jt]sx?$/.test(entry.name)) {
        const relative = path.relative(ROOT, absolute).replaceAll("\\", "/");
        if (!excludedFiles.includes(relative) && read(relative).includes(exportName)) {
          matches.push(relative);
        }
      }
    }
  }

  for (const root of roots) {
    const absolute = path.join(ROOT, root);
    if (fs.existsSync(absolute)) walk(absolute);
  }

  return matches.sort();
}

export function buildCandidatePolicyRuntimeReevaluation() {
  const engine = read("lib/skin-match-decision-engine.js");
  const analyzeRoute = read("app/api/analyze/route.js");
  const runtime = read("lib/evaluator-boundary-policy-runtime.js");
  const shadow = read("lib/evaluator-boundary-policy-shadow.js");
  const control = read("lib/evaluator-boundary-policy-runtime-observability.js");

  const functionalCandidatePolicyImporters = productionImporters(
    "buildFunctionalCandidatePolicy",
    ["lib/functional-candidate-policy.js"]
  );

  return {
    schemaVersion: 1,
    decision: "C",
    decisionLabel: "unify_as_canonical_candidate_exposure_policy",
    runtime: {
      entrypoint: "lib/skin-match-decision-engine.js",
      apiCaller: "app/api/analyze/route.js",
      module: "lib/evaluator-boundary-policy-runtime.js",
      isProductionGraph: engine.includes("buildEvaluatorBoundaryPolicyRuntime("),
      filtersCandidateArray:
        engine.includes("visibleCandidateIds") &&
        engine.includes("exposureProducts = scoredProducts.filter"),
      receivesCurrentProductFindingsAtCaller:
        /buildEvaluatorBoundaryPolicyRuntime\(\{[\s\S]*?currentProductFindings[\s\S]*?\}\)/.test(
          engine
        ),
      canonicalStateBuiltAfterLegacyBundle:
        analyzeRoute.indexOf("buildSkinMatchDecisionBundle(") <
        analyzeRoute.indexOf("rebuildPremiumDecisionState("),
      preservesExposureClassesDownstream:
        engine.includes("exposureStatus") &&
        engine.includes("budgetAlternatives"),
      acceptsCurrentProductFindings: runtime.includes("currentProductFindings = null")
    },
    shadow: {
      module: "lib/evaluator-boundary-policy-shadow.js",
      isCalledByEngine: engine.includes("buildEvaluatorBoundaryPolicyShadow("),
      acceptsCurrentProductFindings: shadow.includes("currentProductFindings = null"),
      receivesCurrentProductFindingsAtCaller:
        /buildEvaluatorBoundaryPolicyShadow\(\{[\s\S]*?currentProductFindings[\s\S]*?\}\)/.test(
          engine
        )
    },
    functionalCandidatePolicy: {
      module: "lib/functional-candidate-policy.js",
      productionImporters: functionalCandidatePolicyImporters,
      classification:
        functionalCandidatePolicyImporters.length === 0 ? "verifier_only" : "production_graph"
    },
    control: {
      enableFlag: control.includes(
        "ENABLE_EVALUATOR_BOUNDARY_CANDIDATE_POLICY_RUNTIME"
      ),
      killSwitch: control.includes(
        "DISABLE_EVALUATOR_BOUNDARY_CANDIDATE_POLICY_RUNTIME"
      ),
      productionCanaryScope: control.includes("deployment_canary")
    },
    currentFindingsEffect: {
      rankingContract: true,
      functionalGroupPolicy: true,
      evaluatorRuntimeCaller: false,
      evaluatorShadowCaller: false
    },
    actualCatalogReplay: {
      sourceKind: "read_only_actual_catalog_pure_engine_replay",
      productRows: 164,
      candidateRows: 656,
      scenarios: 4,
      observed: ["safeLowRiskHidden", "serumCategory"],
      notObserved: ["activeLeaningOnly", "metadataIncomplete", "strongCaution"]
    },
    constraints: {
      designOnly: true,
      runtimeActivationAllowed: false,
      candidateVisibilityChangeAllowed: false,
      recommendationOutputChangeAllowed: false
    }
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(buildCandidatePolicyRuntimeReevaluation(), null, 2));
}
