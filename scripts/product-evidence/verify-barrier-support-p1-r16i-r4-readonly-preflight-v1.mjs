#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import { evaluateOfferCompositionShadow } from "../../lib/product-offer-composition-shadow.js";
import { evaluateR16IR4Preflight, digestR16IR4Prestate, R16I_R4_VERSION } from "../../lib/product-offer-r16i-r4-readonly-preflight.mjs";

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const base = readJson("evidence/product-decision-axis-non-numeric-shadow-v2/barrier-support-p1-r16i-r4-readonly-prestate-20261010.json");
const compositionFixture = readJson("evidence/product-decision-axis-non-numeric-shadow-v2/barrier-support-p1-r16i-r3-offer-composition-shadow-fixture-v1.json");
const composition = evaluateOfferCompositionShadow(compositionFixture);
const clone = () => structuredClone(base);
assert.equal(base.contract_version, R16I_R4_VERSION);
assert.equal(composition.decision, "REVIEW_REQUIRED");
const clean = evaluateR16IR4Preflight(base, composition);
assert.equal(clean.decision, "REVIEW_REQUIRED");
assert.equal(clean.production_writes_authorized, false);
assert.equal(clean.offer_writes_authorized, false);
assert.equal(clean.subject_writes_authorized, false);
assert.equal(clean.ranking_writes_authorized, false);
assert.equal(clean.recommendation_delta_authorized, false);
assert.equal(clean.live_readback_verified, false);
assert.equal(clean.planned_sql, null);
assert.equal(clean.rollback_sql, null);
assert.equal(clean.approval_token, null);
assert.equal(clean.optimistic_write_lock, null);
assert.equal(clean.proposed_product_size_ml, null);
assert.equal(clean.proposed_product_price_krw, null);
assert.equal(clean.proposed_buy_link, null);
assert.equal(clean.proposed_offer_id, null);
assert.equal(clean.proposed_subject_id, null);
assert.equal(clean.options.length, 3);
assert.ok(clean.options.every((o) => o.write_set === null && o.before_after_fields_approved === false));
assert.equal(clean.options[0].status, "PREFERRED_DESIGN_ONLY");
assert.match(clean.prestate_sha256, /^[a-f0-9]{64}$/);
assert.equal(clean.prestate_sha256, digestR16IR4Prestate(base));
// JSON key order must not change the canonical hash.
const reordered = clone();
reordered.product = Object.fromEntries(Object.entries(reordered.product).reverse());
assert.equal(digestR16IR4Prestate(reordered), clean.prestate_sha256);

let rejected = 0;
function blocked(name, mutate, reason) {
  const snapshot = clone();
  mutate(snapshot);
  const got = evaluateR16IR4Preflight(snapshot, composition);
  assert.equal(got.decision, "BLOCKED", name);
  assert.ok(got.reasons.includes(reason), name + " " + got.reasons.join(","));
  assert.equal(got.production_writes_authorized, false, name);
  assert.equal(got.planned_sql, null, name);
  rejected++;
}
const contract = "INVALID_READ_ONLY_SNAPSHOT_CONTRACT";
const product = "PRODUCT_IDENTITY_PRICE_OR_REVISION_DRIFT";
const binding = "SOURCE_BINDING_REVISION_OR_SCOPE_DRIFT";
const intake = "INTAKE_REVISION_OR_REVIEW_SCOPE_DRIFT";
blocked("contract tampered", x => x.contract_version = "another", contract);
blocked("source authority impersonation", x => x.source_kind = "PRODUCTION_WRITE_ALLOWED", contract);
blocked("write grant forged", x => x.allow_production_write = true, contract);
blocked("approval forged", x => x.operator_approval_granted = true, contract);
blocked("current price fabricated", x => x.current_price_verified = true, contract);
blocked("physical verification fabricated", x => x.physical_components_verified = true, contract);
blocked("write statements attached", x => x.write_commands = ["UPDATE products"], contract);
blocked("observed time invalid", x => x.observed_at = "not-a-time", contract);
blocked("catalog id substituted", x => x.product.id = "00000000-0000-4000-8000-000000000099", product);
blocked("catalog size changed", x => x.product.size_ml = 80, product);
blocked("bundle price moved to single", x => x.product.unit_price_per_10ml = 3737.5, product);
blocked("historical price altered", x => x.product.price_min = 25000, product);
blocked("shop url switched", x => x.product.buy_link = "https://example.invalid/", product);
blocked("product optimistic revision changed", x => x.product.updated_at = "2026-10-11T09:32:38+09:00", product);
blocked("review count reassigned", x => x.product.market_signals.review_count = 43000, product);
blocked("binding removed", x => x.bindings = [], binding);
blocked("binding replaced", x => x.bindings[0].binding_id = "00000000-0000-4000-8000-000000000099", binding);
blocked("binding revision changed", x => x.bindings[0].updated_at = "2026-10-11T10:10:29+09:00", binding);
blocked("binding scope upgraded", x => x.bindings[0].product_scope_state = "product", binding);
blocked("intake missing", x => x.intakes = [], intake);
blocked("intake approved without owner", x => x.intakes[0].trust_state = "APPROVED", intake);
blocked("intake revision changed", x => x.intakes[0].updated_at = "2026-10-11T00:53:57+09:00", intake);
blocked("offer created", x => x.conflicting_offers.push({ offer_id: "unknown" }), "TARGET_OFFER_OR_SELLER_LISTING_COLLISION");
blocked("subject invented", x => x.subjects.push({ subject_id: "unknown" }), "UNAPPROVED_PRODUCT_FACT_SUBJECT");
const corruptedComposition = { ...composition, primary_units: 1 };
const rejectedComposition = evaluateR16IR4Preflight(base, corruptedComposition);
assert.equal(rejectedComposition.decision, "BLOCKED");
assert.ok(rejectedComposition.reasons.includes("COMPOSITION_SHADOW_NOT_SAFE_FOR_REVIEW"));
assert.equal(evaluateR16IR4Preflight(base, null).decision, "BLOCKED");
const moduleText = fs.readFileSync("lib/product-offer-r16i-r4-readonly-preflight.mjs", "utf8");
assert.doesNotMatch(moduleText, /\b(fetch|axios|createClient|postgres)\s*\(/);
assert.doesNotMatch(moduleText, /\.insert\s*\(|\.upsert\s*\(|\.update\s*\(|\.rpc\s*\(/);
assert.doesNotMatch(moduleText, /process\.env|from\s+["']server-only/);
assert.equal(base.allow_production_write, false);
assert.equal(base.operator_approval_granted, false);
assert.equal(base.write_commands, null);
console.log(JSON.stringify({
  status: "PASS", stage: "R16I-R4-A-C",
  baseline: "2026-10-10T21:25:21.686838+09:00",
  review_decision: clean.decision,
  blocked_mutations: rejected + 2,
  prestate_sha256: clean.prestate_sha256,
  option_count: clean.options.length,
  live_write_authority: false,
  production_writes: 0
}));
