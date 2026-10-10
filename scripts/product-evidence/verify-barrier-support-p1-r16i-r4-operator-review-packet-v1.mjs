#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import { evaluateOfferCompositionShadow } from "../../lib/product-offer-composition-shadow.js";
import { buildR16IR4OperatorReviewPacket, R16I_R4_D0_PACKET_VERSION } from "../../lib/product-offer-r16i-r4-operator-review-packet.mjs";

const readJson = (path) => JSON.parse(fs.readFileSync(path, "utf8"));
const snapshot = readJson("evidence/product-decision-axis-non-numeric-shadow-v2/barrier-support-p1-r16i-r4-readonly-prestate-20261010.json");
const fixture = readJson("evidence/product-decision-axis-non-numeric-shadow-v2/barrier-support-p1-r16i-r3-offer-composition-shadow-fixture-v1.json");
const composition = evaluateOfferCompositionShadow(fixture);
const original = structuredClone(snapshot);
const packet = buildR16IR4OperatorReviewPacket(snapshot, composition);

assert.equal(packet.contract_version, R16I_R4_D0_PACKET_VERSION);
assert.equal(packet.decision, "REVIEW_REQUIRED");
assert.equal(packet.product_id, snapshot.product.id);
assert.match(packet.prestate_sha256, /^[0-9a-f]{64}$/);
assert.equal(packet.source_kind, "HISTORICAL_READ_ONLY_OBSERVATION");
assert.equal(packet.correction_options.length, 3);
assert.equal(packet.correction_options[0].status, "PREFERRED_DESIGN_ONLY");
assert.ok(packet.correction_options.every(x => x.write_set === null && x.selected_by_operator === false && x.option_approved === false));
assert.equal(packet.presentation.official_single.size_ml, 80);
assert.equal(packet.presentation.official_single.unit_price_krw, null);
assert.equal(packet.presentation.retailer_bundle.primary_quantity, 2);
assert.equal(packet.presentation.retailer_bundle.cream_total_ml, 160);
assert.equal(packet.presentation.retailer_bundle.gift_serum_ml, 10);
assert.equal(packet.presentation.retailer_bundle.currently_verified_price_krw, null);
assert.ok(packet.fields_requiring_separate_approval.length >= 18);
assert.deepEqual(packet.fields_requiring_separate_approval.find(x => x.entity === "products" && x.field === "size_ml")?.before, 160);
assert.deepEqual(packet.fields_requiring_separate_approval.find(x => x.entity === "products" && x.field === "price_min")?.before, 29900);
assert.ok(packet.fields_requiring_separate_approval.every(x => x.after === null && x.proposed_operation === null && x.owner_confirmed === false && x.source_authority_confirmed === false && x.write_authorized === false));
assert.ok(packet.unresolved_requirements.includes("SUPPLY_CHAIN_SECURITY_ISSUE_1208_CLOSED"));
assert.ok(packet.unresolved_requirements.includes("PDA_164_X_12_RECOMMENDATION_INVARIANCE"));
assert.equal(packet.operator_review.selected_option, null);
assert.equal(packet.operator_review.decision, "NOT_REQUESTED");
assert.equal(packet.operator_review.can_approve_in_packet, false);
assert.equal(packet.execution.sql, null);
assert.equal(packet.execution.rollback_sql, null);
assert.equal(packet.execution.optimistic_lock, null);
assert.equal(packet.execution.authorized, false);
assert.equal(packet.execution.fresh_readback, false);
assert.equal(packet.release_ready, false);
for (const key of ["production_writes_authorized", "offer_writes_authorized", "subject_writes_authorized", "recommendation_adoption_authorized"]) assert.equal(packet[key], false, key);

// Returned packet may be deeply frozen; its caller's snapshot must remain untouched/mutable.
assert.deepEqual(snapshot, original);
assert.equal(Object.isFrozen(snapshot.product.market_signals), false);
assert.equal(Object.isFrozen(packet), true);
assert.equal(Object.isFrozen(packet.fields_requiring_separate_approval[0]), true);
assert.equal(Object.isFrozen(packet.fields_requiring_separate_approval.find(x=>x.field === "market_signals").before), true);
assert.throws(() => { packet.operator_review.decision = "APPROVED"; }, TypeError);
assert.throws(() => { packet.fields_requiring_separate_approval[0].after = 80; }, TypeError);

let blockedCount=0;
function expectBlocked(name, mutate, reason) {
  const copy = structuredClone(snapshot);
  mutate(copy);
  const result = buildR16IR4OperatorReviewPacket(copy, composition);
  assert.equal(result.decision, "BLOCKED", name);
  assert.equal(result.production_writes_authorized, false, name);
  assert.equal(result.release_ready, false, name);
  assert.deepEqual(result.fields_requiring_separate_approval, [], name);
  assert.equal(result.execution.sql, null, name);
  if (reason) assert.ok(result.reasons.includes(reason), name);
  blockedCount++;
}
expectBlocked("fake operator approval", x => x.operator_approval_granted = true, "INVALID_READ_ONLY_SNAPSHOT_CONTRACT");
expectBlocked("fake approved changes", x => x.approved_changes = [{ path:"products.size_ml", after:80 }], "UNTRUSTED_APPROVAL_OR_EXECUTION_PAYLOAD");
expectBlocked("fake signature", x => x.approval_signature = "forged", "UNTRUSTED_APPROVAL_OR_EXECUTION_PAYLOAD");
expectBlocked("fake embedded write plan", x => x.execution_plan = { sql: "UPDATE products" }, "UNTRUSTED_APPROVAL_OR_EXECUTION_PAYLOAD");
expectBlocked("fake approved fields", x => x.approved_after = {size_ml:80}, "UNTRUSTED_APPROVAL_OR_EXECUTION_PAYLOAD");
expectBlocked("changed catalog row", x => x.product.size_ml = 80, "PRODUCT_IDENTITY_PRICE_OR_REVISION_DRIFT");
expectBlocked("source binding changed", x => x.bindings[0].source_url = "https://example.invalid", "SOURCE_BINDING_REVISION_OR_SCOPE_DRIFT");
expectBlocked("unapproved subject", x => x.subjects.push({subject_id:"test"}), "UNAPPROVED_PRODUCT_FACT_SUBJECT");
expectBlocked("unreviewed offer", x => x.conflicting_offers.push({offer_id:"test"}), "TARGET_OFFER_OR_SELLER_LISTING_COLLISION");
const tamperedComposition = buildR16IR4OperatorReviewPacket(snapshot, {...composition, primary_units: 4});
assert.equal(tamperedComposition.decision, "BLOCKED");
assert.equal(tamperedComposition.release_ready, false);
blockedCount++;
const code = fs.readFileSync("lib/product-offer-r16i-r4-operator-review-packet.mjs", "utf8");
assert.doesNotMatch(code, /\b(fetch|axios|createClient|postgres)\s*\(/);
assert.doesNotMatch(code, /\.insert\s*\(|\.upsert\s*\(|\.update\s*\(|\.rpc\s*\(/);
assert.doesNotMatch(code, /process\.env|from\s+["']server-only/);
console.log(JSON.stringify({
  status:"PASS", stage:"R16I-R4-D0", packet_decision:packet.decision,
  field_review_rows:packet.fields_requiring_separate_approval.length,
  unresolved_gates:packet.unresolved_requirements.length,
  blocked_cases:blockedCount, operational_approval:false,
  production_writes:0
}));
