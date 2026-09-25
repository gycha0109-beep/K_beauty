import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {
  FRONTIER_CONTRACT,
  INVENTORY_CONTRACT,
  FRONTIER_STATES,
  auditSourceFrontier,
  classifyFrontierOutcome,
} from "./trust-source-frontier-audit.mjs";

const inventoryPath = "docs/evidence/trust-phase8h-source-frontier-inventory-v1.json";
const inventory = JSON.parse(await fs.readFile(inventoryPath, "utf8"));

assert.equal(inventory.contract, INVENTORY_CONTRACT);
assert.equal(inventory.source_count, inventory.sources.length);
assert.equal(inventory.source_count, 36);
assert.equal(new Set(inventory.sources.map((row) => row.source_id)).size, inventory.sources.length);
assert.ok(inventory.sources.every((row) => String(row.canonical_locator || "").startsWith("https://")));

const source = { canonical_locator: "https://example.com/product" };
assert.equal(classifyFrontierOutcome(source, { ok: true, finalUrl: "https://example.com/product", contentType: "text/html" }).state, "HEALTHY_SAME_LOCATOR");
assert.equal(classifyFrontierOutcome(source, { ok: true, finalUrl: "https://example.com/new-product", contentType: "text/html" }).state, "REDIRECTED");
assert.equal(classifyFrontierOutcome(source, { ok: false, error: new Error("SOURCE_BLOCKED:http_404") }).state, "TERMINAL_MISSING");
assert.equal(classifyFrontierOutcome(source, { ok: false, error: new Error("SOURCE_BLOCKED:http_410") }).state, "TERMINAL_MISSING");
assert.equal(classifyFrontierOutcome(source, { ok: false, error: new Error("TRANSIENT_FAILURE:http_429") }).state, "TRANSIENT_FAILURE");
assert.equal(classifyFrontierOutcome(source, { ok: false, error: new Error("SOURCE_BLOCKED:https_only") }).state, "SOURCE_BLOCKED");

const fixture = {
  contract: INVENTORY_CONTRACT,
  snapshot_at: "2026-09-25T00:00:00.000Z",
  source_count: 5,
  sources: [
    { source_id: "s1", publisher: "A", source_kind: "official_product_page", canonical_locator: "https://example.com/1" },
    { source_id: "s2", publisher: "B", source_kind: "official_product_page", canonical_locator: "https://example.com/2" },
    { source_id: "s3", publisher: "C", source_kind: "official_product_page", canonical_locator: "https://example.com/3" },
    { source_id: "s4", publisher: "D", source_kind: "official_product_page", canonical_locator: "https://example.com/4" },
    { source_id: "s5", publisher: "E", source_kind: "official_product_page", canonical_locator: "https://example.com/5" },
  ],
};
const outcomes = new Map([
  ["s1", { ok: true, finalUrl: "https://example.com/1", contentType: "text/html" }],
  ["s2", { ok: true, finalUrl: "https://example.com/2-new", contentType: "text/html" }],
  ["s3", { ok: false, error: new Error("SOURCE_BLOCKED:http_404") }],
  ["s4", { ok: false, error: new Error("TRANSIENT_FAILURE:http_429") }],
  ["s5", { ok: false, error: new Error("SOURCE_BLOCKED:unsupported_content_type") }],
]);
const audit = await auditSourceFrontier(fixture, {
  concurrency: 3,
  observedAt: () => "2026-09-25T00:00:01.000Z",
  probe: async (row) => outcomes.get(row.source_id),
});
assert.equal(audit.contract, FRONTIER_CONTRACT);
assert.equal(audit.source_count, 5);
assert.deepEqual(audit.counts, {
  HEALTHY_SAME_LOCATOR: 1,
  REDIRECTED: 1,
  TERMINAL_MISSING: 1,
  TRANSIENT_FAILURE: 1,
  SOURCE_BLOCKED: 1,
});
assert.equal(audit.mutation_policy, "READ_ONLY_NO_PRODUCTION_WRITE");
assert.equal(audit.authority, "TRANSPORT_FRONTIER_ONLY_NOT_RELOCATION_AUTHORITY");
assert.deepEqual(FRONTIER_STATES, [
  "HEALTHY_SAME_LOCATOR",
  "REDIRECTED",
  "TERMINAL_MISSING",
  "TRANSIENT_FAILURE",
  "SOURCE_BLOCKED",
]);

const implementation = await fs.readFile("scripts/trust-source-frontier-audit.mjs", "utf8");
for (const forbidden of ["createClient(", ".rpc(", ".insert(", ".update(", ".delete(", "apply_migration"]) {
  assert.equal(implementation.includes(forbidden), false, `frontier audit must stay read-only: ${forbidden}`);
}

console.log("TRUST_PHASE8H_SOURCE_FRONTIER_AUDIT_VERIFIED");
