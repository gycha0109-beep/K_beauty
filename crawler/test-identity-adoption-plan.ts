import assert from "node:assert/strict";

import { normalizeDatabaseIdentityKey } from "./lib/database-identity-key.js";
import { buildIdentityAdoptionPlan } from "./lib/identity-adoption-plan.js";
import { resolveProductIdentity } from "./lib/identity-resolution.js";

const candidate = {
  id: "candidate-1",
  source_name: "hwahae",
  external_type: "products",
  external_id: "101",
  brand_name_raw: "ROUNDLAB",
  product_name_raw: "Birch Moisture Sun Cream [SPF50+/PA++++]",
  category_path: "sunscreen",
};

const product = {
  id: "product-1",
  brand: "라운드랩",
  name: "자작나무 수분 선크림",
  brand_en: "ROUNDLAB",
  name_en: "Birch Moisture Sun Cream",
  normalized_brand: "라운드랩",
  normalized_name: "자작나무수분선크림",
  category: "sunscreen",
  product_form: null,
  external_source: null,
  external_type: null,
  external_id: null,
};

assert.equal(normalizeDatabaseIdentityKey("  Green   Mild Up Sun+  "), "greenmildupsun+");

{
  const resolution = resolveProductIdentity(candidate, [product]);
  const plan = buildIdentityAdoptionPlan(candidate, [product], resolution, null);

  assert.equal(resolution.state, "resolved");
  assert.equal(resolution.method, "english_exact");
  assert.equal(plan.identityRecordReady, true);
  assert.equal(plan.targetProductId, "product-1");
  assert.equal(plan.targetCanonicalBrand, "라운드랩");
  assert.equal(plan.targetCanonicalName, "자작나무 수분 선크림");
  assert.equal(plan.structuralIdentityState, "waiting_for_promotion_queue");
  assert.equal(plan.evidence?.source_identity.brand, "ROUNDLAB");
  assert.equal(plan.evidence?.target_canonical_identity.brand, "라운드랩");
}

{
  const resolution = resolveProductIdentity(candidate, [product]);
  const plan = buildIdentityAdoptionPlan(candidate, [product], resolution, "queued");

  assert.equal(plan.structuralIdentityState, "identity_side_ready");
  assert.deepEqual(plan.blockers, []);
}

{
  const driftedProduct = {
    ...product,
    normalized_brand: "roundlab",
    normalized_name: "birchmoisturesuncream",
  };
  const resolution = resolveProductIdentity(candidate, [driftedProduct]);
  const plan = buildIdentityAdoptionPlan(candidate, [driftedProduct], resolution, "queued");

  assert.equal(resolution.state, "resolved");
  assert.equal(plan.identityRecordReady, true);
  assert.equal(plan.structuralIdentityState, "blocked_target_identity_key_drift");
  assert.equal(plan.blockers.includes("target_identity_key_drift"), true);
  assert.equal(plan.targetIdentityKeys?.consistent, false);
}

{
  const missingKeyProduct = {
    ...product,
    normalized_brand: null,
  };
  const resolution = resolveProductIdentity(candidate, [missingKeyProduct]);
  const plan = buildIdentityAdoptionPlan(candidate, [missingKeyProduct], resolution, "queued");

  assert.equal(plan.identityRecordReady, true);
  assert.equal(plan.structuralIdentityState, "blocked_target_identity_key_missing");
}

{
  const unresolvedCandidate = {
    ...candidate,
    product_name_raw: "Unknown Sun Cream",
  };
  const resolution = resolveProductIdentity(unresolvedCandidate, [product]);
  const plan = buildIdentityAdoptionPlan(unresolvedCandidate, [product], resolution, "queued");

  assert.equal(resolution.state, "unresolved");
  assert.equal(plan.identityRecordReady, false);
  assert.equal(plan.structuralIdentityState, "blocked_identity_not_resolved");
}

console.log("identity-adoption-plan checks passed");
