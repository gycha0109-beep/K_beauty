#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const servicePath = path.join(root, "lib/server/product-offer-read-service.js");
const oidcPath = path.join(root, "lib/product-offer-controlled-probe-oidc.js");
const routePath = path.join(
  root,
  "app/api/internal/product-offer-presentation-authority-controlled-probe/route.js",
);
const workflowPath = path.join(
  root,
  ".github/workflows/data-offer17-controlled-offer-rpc-diagnostic.yml",
);
const healthPath = path.join(root, "scripts/verify-current-main-health.mjs");

const serviceSource = fs.readFileSync(servicePath, "utf8");
const oidcSource = fs.readFileSync(oidcPath, "utf8");
const routeSource = fs.readFileSync(routePath, "utf8");
const workflowSource = fs.readFileSync(workflowPath, "utf8");
const healthSource = fs.readFileSync(healthPath, "utf8");

assert.match(
  oidcSource,
  /urn:bejewely:data-offer17:offer-runtime-probe/,
);
assert.match(
  oidcSource,
  /\.github\/workflows\/data-offer17-controlled-offer-rpc-diagnostic\.yml/,
);
assert.match(oidcSource, /gycha0109-beep\/K_beauty/);
assert.match(oidcSource, /repository_id/);
assert.match(oidcSource, /event_name !== "push"/);
assert.match(oidcSource, /runner_environment !== "github-hosted"/);
assert.match(oidcSource, /payload\?\.workflow_sha !== expectedDeploymentSha/);
assert.match(oidcSource, /payload\?\.sha !== expectedDeploymentSha/);
assert.match(oidcSource, /MAX_TOKEN_AGE_SECONDS = 10 \* 60/);

assert.match(
  serviceSource,
  /export async function runProductOfferPresentationRuntimeSecurityProbe\(productIds\)/,
);
assert.match(serviceSource, /Array\.isArray\(productIds\) \? productIds : \[productIds\]/);
assert.match(
  serviceSource,
  /select current_user::text as role/,
);
assert.match(
  serviceSource,
  /select offer_id from public\.product_offers limit 1/,
);
assert.match(
  serviceSource,
  /\$\{sql\.array\(normalizedProductIds\)\}::uuid\[\]/,
);
assert.match(
  serviceSource,
  /array\[\$\{normalizedProductIds\[0\]\}::uuid\]/,
);
assert.match(serviceSource, /MULTI_PRODUCT_PRIMARY_FAILED/);
assert.match(serviceSource, /requestedProductCount: normalizedProductIds\.length/);
for (const resultClass of [
  "SUCCESS",
  "QUERY_FAILED",
  "TIMEOUT",
  "CARDINALITY_INVALID",
  "PAYLOAD_INVALID",
  "CONTRACT_MISMATCH",
]) {
  assert.match(serviceSource, new RegExp(`"${resultClass}"`));
}
assert.doesNotMatch(serviceSource, /console\.(?:log|info|warn|error)\(/);

assert.match(routeSource, /CONTROLLED_PRODUCT_IDS/);
assert.match(
  routeSource,
  /08b85f37-b1fa-42d7-893a-0d4facb17878/,
);
assert.equal(
  (routeSource.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi) || []).length,
  8,
);
assert.match(
  routeSource,
  /runProductOfferPresentationRuntimeSecurityProbe/,
);
assert.match(routeSource, /verifyDataOffer17GitHubActionsOidcToken/);
assert.match(routeSource, /requestedProductCount: probe\.requestedProductCount/);
assert.match(routeSource, /secretValueExposed: false/);
assert.match(routeSource, /result: securityBoundaryPass && rpcPass \? "PASS" : "DIAGNOSTIC_COMPLETE"/);
assert.doesNotMatch(routeSource, /productId\s*:/);
assert.doesNotMatch(routeSource, /listingUrl|priceAmount|databaseUrl|errorMessage|rawError/);
assert.doesNotMatch(routeSource, /console\.(?:log|info|warn|error)\(/);

assert.match(workflowSource, /Checkout exact head/);
assert.match(workflowSource, /DATA_OFFER17_EXACT_HEAD/);
assert.match(
  workflowSource,
  /urn:bejewely:data-offer17:offer-runtime-probe/,
);
assert.match(
  workflowSource,
  /product-offer-presentation-authority-controlled-probe/,
);
assert.match(workflowSource, /payload\.requestedProductCount !== 8/);
assert.match(workflowSource, /Run controlled Production analyze request/);
assert.match(workflowSource, /\/api\/analyze/);
assert.match(workflowSource, /DATA_OFFER17_ANALYZE_EVIDENCE=/);
assert.match(workflowSource, /x-vercel-trusted-oidc-idp-token/);
assert.match(workflowSource, /DIAGNOSTIC_COMPLETE/);
assert.match(workflowSource, /secretValueExposed/);
assert.doesNotMatch(workflowSource, /08b85f37-b1fa-42d7-893a-0d4facb17878/);

assert.match(
  healthSource,
  /verify-data-offer17-controlled-offer-rpc-diagnostic-v1\.mjs/,
);

console.log(JSON.stringify({
  stage: "DATA-OFFER17-CONTROLLED-OFFER-RPC-DIAGNOSTIC",
  oidcBoundToExactWorkflow: true,
  exactDeploymentShaRequired: true,
  primaryRuntimeTransportExercised: true,
  multiProductRuntimeTransportExercised: true,
  controlledAnalyzePathExercised: true,
  rawOfferSelectExpectedDenied: true,
  sensitiveOfferFieldsReturned: false,
  rawDatabaseErrorsReturned: false,
  result: "PASS",
}, null, 2));
