#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const offerSource = fs.readFileSync(path.join(root, "lib/product-offer-read-path.js"), "utf8");
const purchaseSource = fs.readFileSync(path.join(root, "lib/product-purchase-link.js"), "utf8");

assert.match(offerSource, /legacy_product_buy_link_v1::oliveyoung/);
assert.match(
  offerSource,
  /legacy_product_buy_link_v1::oliveyoung[\s\S]{0,320}sourceHint:\s*"olive_young"/,
);
assert.match(
  offerSource,
  /legacy_product_buy_link_v1::oliveyoung[\s\S]{0,420}allowedProductScopeStates:\s*new Set\(\["product_subject_unresolved"\]\)/,
);
assert.match(
  offerSource,
  /legacy_product_buy_link_v1::oliveyoung[\s\S]{0,520}priceAuthority:\s*false/,
);
assert.match(
  purchaseSource,
  /source:\s*"olive_young"[\s\S]{0,260}oliveyoung\.co\.kr[\s\S]{0,320}getGoodsDetail/,
);

console.log("Commerce Olive Young migration presentation contract: PASS");
console.log("- source_name: legacy_product_buy_link_v1");
console.log("- seller_key: oliveyoung");
console.log("- source_hint: olive_young");
console.log("- product_scope_state: product_subject_unresolved");
console.log("- price_authority: false");
