import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const ROUTE_PATH = path.join(ROOT, "app", "api", "analyze", "route.js");
const WRITER_PATH = path.join(ROOT, "lib", "shadow-boundary-dry-run-artifact-writer.js");

const route = readFileSync(ROUTE_PATH, "utf8");
const writer = readFileSync(WRITER_PATH, "utf8");
const routeDiff = execFileSync("git", ["diff", "--", "app/api/analyze/route.js"], {
  cwd: ROOT,
  encoding: "utf8"
});

const functionStart = route.indexOf("async function runShadowBoundaryDryRunIfEnabled");
const functionEnd = route.indexOf("function hasAnalyzeResponseShape", functionStart);
assert(functionStart >= 0 && functionEnd > functionStart, "shadow dry-run route helper should exist");

const routeHelper = route.slice(functionStart, functionEnd);
const guardEnd = routeHelper.indexOf("try {");
const guardBlock = routeHelper.slice(0, guardEnd);
assert(guardBlock.includes('process.env.NODE_ENV !== "development"'));
assert(guardBlock.includes('process.env.DEV_ONLY_SHADOW_BOUNDARY_DRY_RUN !== "1"'));
assert(guardBlock.includes("return;"), "flag-off path must return before dynamic imports");

for (const modulePath of [
  "@/lib/shadow-dry-run-snapshot-contract",
  "@/lib/shadow-boundary-dry-run-helper",
  "@/lib/shadow-boundary-dry-run-artifact-writer"
]) {
  const importIndex = routeHelper.indexOf(`import("${modulePath}")`);
  assert(importIndex > guardEnd, `${modulePath} must load only after the guard`);
}

const persistenceIndex = route.lastIndexOf("const premiumSessionToken = await createPremiumReportSession");
const responseIndex = route.lastIndexOf("const response = NextResponse.json(responsePayload)");
const captureIndex = route.lastIndexOf("await captureFunctionalShadowIfEnabled");
const callSiteIndex = route.lastIndexOf("await runShadowBoundaryDryRunIfEnabled");
const returnIndex = route.lastIndexOf("return response;");
assert(persistenceIndex >= 0 && persistenceIndex < callSiteIndex, "dry-run call must follow premium persistence");
assert(responseIndex >= 0 && responseIndex < callSiteIndex, "dry-run call must follow response construction");
assert(captureIndex >= 0 && captureIndex < callSiteIndex, "dry-run call must remain outside existing capture helper");
assert(callSiteIndex < returnIndex, "dry-run call must run before response return");

assert(route.includes("const responsePayload = {"));
assert(route.includes("const response = NextResponse.json(responsePayload);"));
assert(!route.includes("functional-candidate-policy"), "CandidatePolicy runtime must not be imported");
assert(!route.includes("candidate-policy-hint-receiver-contract"), "receiver runtime must not be imported");

const addedLines = routeDiff
  .split(/\r?\n/)
  .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
  .map((line) => line.slice(1));
const addedSource = addedLines.join("\n");
assert(!/NextResponse\.json\([^)]*(?:shadow|dryRun)/s.test(addedSource));
assert(!/responsePayload\.(?:shadow|dryRun|boundaryHint|receiver)/.test(addedSource));
assert(
  !/\b(?:decision|publicDecision|responsePayload|recommendationResult)\.(?:topPick|supportingProducts|budgetAlternatives)\s*=/.test(
    addedSource
  ),
  "recommendation outputs must remain read-only"
);
assert(!/premiumSessionReport\.(?:shadow|dryRun|boundaryHint|receiver)/.test(addedSource));

assert(writer.includes('from "node:fs/promises"'));
assert(writer.includes('["tmp", "shadow-boundary-dry-run"]'));
assert(writer.includes("validateShadowRuntimeDryRunArtifact"));
assert(writer.includes('envLike?.NODE_ENV === "development"'));
assert(writer.includes('envLike?.DEV_ONLY_SHADOW_BOUNDARY_DRY_RUN === "1"'));
assert(writer.includes("artifact_write_failed_non_blocking"));
assert(!/@supabase\//.test(writer));
assert(!/\.(?:insert|update|delete|upsert|rpc|upload)\s*\(/.test(writer));
assert(!/createClient\s*\(/.test(writer));

for (const protectedFile of [
  "lib/skin-match-decision-engine.js",
  "lib/functional-ranking-contract.js",
  "lib/functional-candidate-policy.js"
]) {
  const diff = execFileSync("git", ["diff", "--", protectedFile], {
    cwd: ROOT,
    encoding: "utf8"
  });
  assert.equal(diff, "", `${protectedFile} must remain unchanged`);
}

console.log("verify-shadow-dry-run-route-static-guard passed");
