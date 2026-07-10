import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = process.cwd();
const ROUTE_PATH = path.join(ROOT, "app", "api", "analyze", "route.js");
const WRITER_PATH = path.join(ROOT, "lib", "shadow-boundary-dry-run-artifact-writer.js");
const REQUIRED_DYNAMIC_IMPORTS = [
  "@/lib/shadow-dry-run-snapshot-contract",
  "@/lib/shadow-boundary-dry-run-helper",
  "@/lib/shadow-boundary-dry-run-artifact-writer"
];

function occurrenceIndexes(source, needle) {
  const indexes = [];
  let offset = 0;
  while (offset < source.length) {
    const index = source.indexOf(needle, offset);
    if (index < 0) break;
    indexes.push(index);
    offset = index + needle.length;
  }
  return indexes;
}

function addViolation(violations, code) {
  if (!violations.includes(code)) violations.push(code);
}

export function validateShadowDryRunRouteSources({ routeSource = "", writerSource = "" } = {}) {
  const violations = [];
  const functionStart = routeSource.indexOf("async function runShadowBoundaryDryRunIfEnabled");
  const functionEnd = routeSource.indexOf("function hasAnalyzeResponseShape", functionStart);

  if (functionStart < 0 || functionEnd <= functionStart) {
    addViolation(violations, "missing_shadow_dry_run_route_helper");
    return { valid: false, violations };
  }

  const routeHelper = routeSource.slice(functionStart, functionEnd);
  const guardEnd = routeHelper.indexOf("try {");
  const guardBlock = guardEnd >= 0 ? routeHelper.slice(0, guardEnd) : "";
  if (!guardBlock.includes('process.env.NODE_ENV !== "development"')) {
    addViolation(violations, "missing_development_guard");
  }
  if (!guardBlock.includes('process.env.DEV_ONLY_SHADOW_BOUNDARY_DRY_RUN !== "1"')) {
    addViolation(violations, "missing_explicit_flag_guard");
  }
  if (guardEnd < 0 || !guardBlock.includes("return;")) {
    addViolation(violations, "missing_guard_return_before_dynamic_import");
  }

  for (const modulePath of REQUIRED_DYNAMIC_IMPORTS) {
    const importNeedle = `import("${modulePath}")`;
    const indexes = occurrenceIndexes(routeSource, importNeedle);
    const expectedMinimumIndex = functionStart + Math.max(guardEnd, 0);
    const insideGuardedHelper = indexes.length === 1 && indexes[0] > expectedMinimumIndex && indexes[0] < functionEnd;
    if (!insideGuardedHelper) {
      addViolation(violations, "dynamic_import_outside_guard");
    }
  }

  const persistenceIndex = routeSource.lastIndexOf("const premiumSessionToken = await createPremiumReportSession");
  const responseIndex = routeSource.lastIndexOf("const response = NextResponse.json(responsePayload)");
  const captureIndex = routeSource.lastIndexOf("await captureFunctionalShadowIfEnabled");
  const callSiteIndex = routeSource.lastIndexOf("await runShadowBoundaryDryRunIfEnabled");
  const returnIndex = routeSource.lastIndexOf("return response;");
  if (persistenceIndex < 0 || responseIndex < 0 || captureIndex < 0 || callSiteIndex < 0 || returnIndex < 0) {
    addViolation(violations, "missing_expected_route_insertion_boundaries");
  } else if (
    !(persistenceIndex < callSiteIndex && responseIndex < callSiteIndex && captureIndex < callSiteIndex && callSiteIndex < returnIndex)
  ) {
    addViolation(violations, "unsafe_route_insertion_order");
  }

  const responsePayloadStart = routeSource.lastIndexOf("const responsePayload = {");
  const responsePayloadEnd = routeSource.indexOf("const response = NextResponse.json(responsePayload);", responsePayloadStart);
  const responsePayloadBlock =
    responsePayloadStart >= 0 && responsePayloadEnd > responsePayloadStart
      ? routeSource.slice(responsePayloadStart, responsePayloadEnd)
      : "";
  const routeTail = callSiteIndex >= 0 && returnIndex > callSiteIndex
    ? routeSource.slice(callSiteIndex, returnIndex)
    : "";

  if (
    /responsePayload\s*(?:\.|\[[^\]]+\])\s*(?:shadow|dryRun|boundaryHint|receiver)\w*\s*=/i.test(routeHelper + routeTail) ||
    /Object\.assign\s*\(\s*responsePayload\s*,[^)]*(?:shadow|dryRun|boundaryHint|receiver)/is.test(routeHelper + routeTail) ||
    /\b(?:shadow|dryRun|boundaryHint|receiver)\w*\s*:/i.test(responsePayloadBlock) ||
    /NextResponse\.json\([^)]*(?:shadow|dryRun|boundaryHint|receiver)/is.test(routeSource)
  ) {
    addViolation(violations, "shadow_merged_into_response");
  }

  const mutationScope = `${routeHelper}\n${routeTail}`;
  if (
    /\b(?:decision|publicDecision|recommendationResult)\.(?:topPick|supportingProducts|budgetAlternatives)(?:\[[^\]]+\])?\s*=/i.test(
      mutationScope
    ) ||
    /\b(?:decision|publicDecision|recommendationResult)\.(?:topPick|supportingProducts|budgetAlternatives)\.(?:push|splice|sort|reverse|pop|shift|unshift)\s*\(/i.test(
      mutationScope
    )
  ) {
    addViolation(violations, "recommendation_output_mutation_detected");
  }

  const persistenceScopeStart = routeSource.lastIndexOf("const premiumSessionReport");
  const persistenceScope = persistenceScopeStart >= 0 && returnIndex > persistenceScopeStart
    ? routeSource.slice(persistenceScopeStart, returnIndex)
    : "";
  if (
    /\b(?:premiumSessionReport|premiumReport|storePayload|savedReport|persistencePayload)\s*(?:\.|\[[^\]]+\])\s*(?:shadow|dryRun|boundaryHint|receiver)\w*\s*=/i.test(
      persistenceScope
    )
  ) {
    addViolation(violations, "shadow_merged_into_persistence_payload");
  }

  if (routeSource.includes("functional-candidate-policy") || routeSource.includes("candidate-policy-hint-receiver-contract")) {
    addViolation(violations, "candidate_policy_runtime_connection_detected");
  }
  if (/\bthrow\b/.test(routeHelper)) {
    addViolation(violations, "route_failure_can_propagate");
  }
  if (!routeHelper.includes("shadow-boundary-dry-run:non-blocking-failure")) {
    addViolation(violations, "missing_non_blocking_route_failure_handler");
  }

  if (!writerSource.includes('from "node:fs/promises"')) {
    addViolation(violations, "missing_local_file_writer");
  }
  if (!writerSource.includes('const OUTPUT_SUBDIRECTORY = ["tmp", "shadow-boundary-dry-run"]')) {
    addViolation(violations, "writer_output_not_local_tmp_only");
  }
  if (!writerSource.includes("isWithinOutputRoot(resolved, outputRoot)")) {
    addViolation(violations, "writer_output_boundary_check_missing");
  }
  if (!writerSource.includes("validateShadowRuntimeDryRunArtifact")) {
    addViolation(violations, "artifact_schema_validation_missing");
  }
  if (!writerSource.includes('envLike?.NODE_ENV === "development"')) {
    addViolation(violations, "writer_development_guard_missing");
  }
  if (!writerSource.includes('envLike?.DEV_ONLY_SHADOW_BOUNDARY_DRY_RUN === "1"')) {
    addViolation(violations, "writer_explicit_flag_guard_missing");
  }

  const sanitizationIndex = writerSource.indexOf("const sanitization = sanitizeShadowBoundaryDryRunArtifactForWrite");
  const mkdirIndex = writerSource.indexOf("await fileSystem.mkdir");
  const writeIndex = writerSource.indexOf("await fileSystem.writeFile");
  if (sanitizationIndex < 0 || mkdirIndex < 0 || writeIndex < 0 || sanitizationIndex > mkdirIndex || sanitizationIndex > writeIndex) {
    addViolation(violations, "schema_validation_not_before_write");
  }
  if (
    /@supabase\//.test(writerSource) ||
    /\bcreateClient\s*\(/.test(writerSource) ||
    /\.(?:insert|update|delete|upsert|rpc|upload)\s*\(/.test(writerSource) ||
    /\.storage\b/.test(writerSource)
  ) {
    addViolation(violations, "writer_db_or_supabase_mutation_detected");
  }
  if (
    /(?:\.|\b)(?:productName|product_name|brand|purchaseUrl|purchase_url|reviewText|review_text|rawForm|raw_form|imageUrl|image_url|base64|pii|fullApiResponseBody|full_api_response_body|apiKey|secretValue)\s*(?:=|:)/.test(
      writerSource
    )
  ) {
    addViolation(violations, "writer_forbidden_field_recording_detected");
  }
  if (/\bthrow\b/.test(writerSource) || !writerSource.includes("artifact_write_failed_non_blocking")) {
    addViolation(violations, "writer_failure_can_propagate");
  }

  return {
    valid: violations.length === 0,
    violations
  };
}

export function runShadowDryRunRouteStaticGuardForWorkspace() {
  const routeSource = readFileSync(ROUTE_PATH, "utf8");
  const writerSource = readFileSync(WRITER_PATH, "utf8");
  const result = validateShadowDryRunRouteSources({ routeSource, writerSource });

  for (const protectedFile of [
    "lib/skin-match-decision-engine.js",
    "lib/functional-ranking-contract.js",
    "lib/functional-candidate-policy.js"
  ]) {
    const diff = execFileSync("git", ["diff", "--", protectedFile], {
      cwd: ROOT,
      encoding: "utf8"
    });
    if (diff !== "") addViolation(result.violations, `protected_file_changed:${protectedFile}`);
  }

  return {
    valid: result.violations.length === 0,
    violations: result.violations
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const result = runShadowDryRunRouteStaticGuardForWorkspace();
  assert.equal(result.valid, true, `shadow route static guard failed: ${result.violations.join(", ")}`);
  console.log("verify-shadow-dry-run-route-static-guard passed");
}
