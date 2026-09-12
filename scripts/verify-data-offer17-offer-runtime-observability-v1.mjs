#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  PRODUCT_OFFER_RUNTIME_TELEMETRY_EVENT,
  PRODUCT_OFFER_RUNTIME_TELEMETRY_SCHEMA_VERSION,
  buildProductOfferRuntimeTelemetry,
  emitProductOfferRuntimeTelemetry,
} from "../lib/product-offer-runtime-observability.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const servicePath = path.join(root, "lib/server/product-offer-read-service.js");
const helperPath = path.join(root, "lib/product-offer-runtime-observability.js");
const healthPath = path.join(root, "scripts/verify-current-main-health.mjs");
const workflowPath = path.join(
  root,
  ".github/workflows/data-offer17-offer-runtime-observability.yml",
);

const serviceSource = fs.readFileSync(servicePath, "utf8");
const helperSource = fs.readFileSync(helperPath, "utf8");
const healthSource = fs.readFileSync(healthPath, "utf8");
const workflowSource = fs.readFileSync(workflowPath, "utf8");

assert.equal(
  PRODUCT_OFFER_RUNTIME_TELEMETRY_SCHEMA_VERSION,
  "product-offer-runtime-observability-v1",
);
assert.equal(PRODUCT_OFFER_RUNTIME_TELEMETRY_EVENT, "product_offer_authority_runtime");

const expectedKeys = [
  "event",
  "schemaVersion",
  "status",
  "requestedProductCount",
  "returnedOfferCount",
];

const success = buildProductOfferRuntimeTelemetry({
  status: "success",
  requestedProductCount: 3,
  returnedOfferCount: 2,
});
assert.deepEqual(Object.keys(success), expectedKeys);
assert.deepEqual(success, {
  event: "product_offer_authority_runtime",
  schemaVersion: "product-offer-runtime-observability-v1",
  status: "success",
  requestedProductCount: 3,
  returnedOfferCount: 2,
});

const failure = buildProductOfferRuntimeTelemetry({
  status: "failure",
  requestedProductCount: 4,
  returnedOfferCount: 99,
});
assert.deepEqual(Object.keys(failure), expectedKeys);
assert.equal(failure.status, "failure");
assert.equal(failure.requestedProductCount, 4);
assert.equal(failure.returnedOfferCount, 0);
assert.throws(
  () => buildProductOfferRuntimeTelemetry({ status: "unknown" }),
  /product_offer_runtime_telemetry_status_invalid/,
);

const logEntries = [];
const logger = {
  info(...args) {
    logEntries.push({ level: "info", args });
  },
  warn(...args) {
    logEntries.push({ level: "warn", args });
  },
};

emitProductOfferRuntimeTelemetry(success, logger);
emitProductOfferRuntimeTelemetry(failure, logger);
assert.equal(logEntries.length, 2);
assert.equal(logEntries[0].level, "info");
assert.equal(logEntries[1].level, "warn");
assert.equal(logEntries[0].args[0], "[product-offer-authority-runtime]");
assert.equal(logEntries[1].args[0], "[product-offer-authority-runtime]");
assert.deepEqual(Object.keys(logEntries[0].args[1]), expectedKeys);
assert.deepEqual(Object.keys(logEntries[1].args[1]), expectedKeys);

const forbiddenTelemetryKeys = new Set([
  "productId",
  "productIds",
  "listingUrl",
  "price",
  "priceAmount",
  "credential",
  "databaseUrl",
  "sql",
  "error",
  "errorMessage",
]);
for (const entry of logEntries) {
  for (const key of Object.keys(entry.args[1])) {
    assert.equal(forbiddenTelemetryKeys.has(key), false, `forbidden telemetry key: ${key}`);
  }
}

assert.match(
  serviceSource,
  /import \{ emitProductOfferRuntimeTelemetry \} from "@\/lib\/product-offer-runtime-observability"/,
);
assert.match(
  serviceSource,
  /emitProductOfferRuntimeTelemetry\(\{\s*status: "success",\s*requestedProductCount,\s*returnedOfferCount: offers\.length,\s*\}\)/,
);
assert.match(
  serviceSource,
  /emitProductOfferRuntimeTelemetry\(\{\s*status: "failure",\s*requestedProductCount,\s*returnedOfferCount: 0,\s*\}\)/,
);
assert.match(serviceSource, /throw error;/);
assert.doesNotMatch(serviceSource, /console\.(?:log|info|warn|error)\(/);
assert.doesNotMatch(helperSource, /productIds|listingUrl|priceAmount|databaseUrl|errorMessage/);
assert.match(
  healthSource,
  /verify-data-offer17-offer-runtime-observability-v1\.mjs/,
);
assert.match(workflowSource, /Checkout exact head/);
assert.match(workflowSource, /DATA_OFFER17_EXACT_HEAD/);
assert.match(
  workflowSource,
  /node scripts\/verify-data-offer17-offer-runtime-observability-v1\.mjs/,
);

console.log(JSON.stringify({
  stage: "DATA-OFFER17",
  telemetrySchemaVersion: PRODUCT_OFFER_RUNTIME_TELEMETRY_SCHEMA_VERSION,
  event: PRODUCT_OFFER_RUNTIME_TELEMETRY_EVENT,
  successObservable: true,
  failureObservable: true,
  sensitiveCommerceFieldsLogged: false,
  recommendationSemanticsChanged: false,
  result: "PASS",
}, null, 2));
