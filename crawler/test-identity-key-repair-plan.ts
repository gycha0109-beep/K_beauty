import assert from "node:assert/strict";

import { buildIdentityKeyRepairPlan } from "./lib/identity-key-repair-plan.js";

const rows = buildIdentityKeyRepairPlan([
  {
    id: "current",
    brand: "토리든",
    name: "다이브인 저분자 히알루론산 토너",
    normalized_brand: "토리든",
    normalized_name: "다이브인 저분자 히알루론산 토너",
  },
  {
    id: "compact",
    brand: "코스노리",
    name: "판테놀 베리어 토너",
    normalized_brand: "코스노리",
    normalized_name: "판테놀베리어토너",
  },
  {
    id: "material",
    brand: "라운드랩",
    name: "1025 독도 로션",
    normalized_brand: "라운드랩",
    normalized_name: "자작나무 수분 로션",
  },
  {
    id: "brand-drift",
    brand: "Dr.G",
    name: "Green Mild Up Sun+",
    normalized_brand: "dr.g",
    normalized_name: "green mild up sun",
  },
]);

assert.equal(rows.find((row) => row.productId === "current")?.disposition, "current");
assert.equal(
  rows.find((row) => row.productId === "compact")?.disposition,
  "safe_mechanical_candidate",
);
assert.deepEqual(
  rows.find((row) => row.productId === "compact")?.reasons,
  ["legacy_compact_name_key"],
);
assert.equal(
  rows.find((row) => row.productId === "material")?.disposition,
  "manual_review_required",
);
assert.equal(
  rows.find((row) => row.productId === "material")?.reasons.includes("material_name_key_drift"),
  true,
);
assert.equal(
  rows.find((row) => row.productId === "brand-drift")?.disposition,
  "manual_review_required",
);
assert.equal(
  rows.find((row) => row.productId === "brand-drift")?.reasons.includes("brand_key_drift"),
  true,
);

const collisionRows = buildIdentityKeyRepairPlan([
  {
    id: "collision-a",
    brand: "Brand",
    name: "Same Product",
    normalized_brand: "brand",
    normalized_name: "sameproduct",
  },
  {
    id: "collision-b",
    brand: "Brand",
    name: "Same Product",
    normalized_brand: "brand",
    normalized_name: "same product legacy",
  },
]);

assert.equal(collisionRows.every((row) => row.disposition === "blocked_proposed_collision"), true);
assert.deepEqual(
  collisionRows.find((row) => row.productId === "collision-a")?.proposedCollisionProductIds,
  ["collision-b"],
);

const missingRows = buildIdentityKeyRepairPlan([
  {
    id: "missing",
    brand: "Brand",
    name: null,
    normalized_brand: "brand",
    normalized_name: null,
  },
]);
assert.equal(missingRows[0]?.disposition, "blocked_missing_identity");

console.log("identity-key-repair-plan checks passed");
