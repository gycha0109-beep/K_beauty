import assert from "node:assert/strict";

import { resolveProductIdentity } from "./lib/identity-resolution.js";

const baseCandidate = {
  id: "candidate-1",
  source_name: "hwahae",
  external_type: "products",
  external_id: "101",
  brand_name_raw: "Beauty of Joseon",
  product_name_raw: "Relief Sun Rice + Probiotics 50ml",
  category_path: "sunscreen",
};

const baseProduct = {
  id: "product-1",
  brand: "조선미녀",
  name: "맑은쌀 선크림",
  brand_en: "Beauty of Joseon",
  name_en: "Relief Sun Rice + Probiotics",
  category: "sunscreen",
  external_source: null,
  external_type: null,
  external_id: null,
};

{
  const result = resolveProductIdentity(baseCandidate, [baseProduct]);

  assert.equal(result.state, "resolved");
  assert.equal(result.productId, "product-1");
  assert.equal(result.method, "english_exact");
}

{
  const result = resolveProductIdentity(baseCandidate, [
    {
      ...baseProduct,
      external_source: "hwahae",
      external_type: "products",
      external_id: "101",
    },
  ]);

  assert.equal(result.state, "resolved");
  assert.equal(result.method, "external_id_exact");
}

{
  const result = resolveProductIdentity(baseCandidate, [
    baseProduct,
    {
      ...baseProduct,
      id: "product-2",
    },
  ]);

  assert.equal(result.state, "identity_ambiguous");
  assert.equal(result.productId, null);
  assert.equal(result.blockers.includes("strong_signal_conflict"), true);
}

{
  const result = resolveProductIdentity(baseCandidate, [
    baseProduct,
    {
      ...baseProduct,
      id: "product-2",
      brand_en: "Other Brand",
      name_en: "Other Product",
      external_source: "hwahae",
      external_type: "products",
      external_id: "101",
    },
  ]);

  assert.equal(result.state, "identity_ambiguous");
  assert.equal(result.productId, null);
}

{
  const result = resolveProductIdentity(
    {
      ...baseCandidate,
      product_name_raw: "Relief Sun Rice Probiotics Aqua",
    },
    [baseProduct],
  );

  assert.equal(result.state, "unresolved");
  assert.equal(result.productId, null);
  assert.equal(result.suggestions.length, 1);
  assert.equal(result.suggestions[0]?.productId, "product-1");
}

{
  const result = resolveProductIdentity(baseCandidate, [
    {
      ...baseProduct,
      category: "cleanser",
    },
  ]);

  assert.equal(result.state, "unresolved");
  assert.equal(result.productId, null);
  assert.equal(result.blockers.includes("category_conflict"), true);
}

console.log("identity-resolution checks passed");
