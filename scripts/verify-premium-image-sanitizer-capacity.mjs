import assert from "node:assert/strict";
import { sanitizePremiumReportProductImages } from "../lib/security/image-source-policy.js";

const runtimeSizedDecisionBundle = Object.fromEntries(
  Array.from({ length: 2100 }, (_, index) => [
    `bounded_${index}`,
    index
  ])
);
const runtimeSizedReport = {
  decisionBundle: runtimeSizedDecisionBundle,
  freeResult: {
    topPick: {
      id: "fixture-top-pick",
      name: "Fixture",
      image_url:
        "https://img.hwahae.co.kr/products/12345/12345_20260715123456.jpg"
    }
  }
};

const sanitized = sanitizePremiumReportProductImages(runtimeSizedReport);
assert.ok(sanitized && typeof sanitized === "object" && !Array.isArray(sanitized));
assert.equal(Object.keys(sanitized.decisionBundle).length, 2100);
assert.equal(sanitized.freeResult.topPick.id, "fixture-top-pick");
assert.equal(
  sanitized.freeResult.topPick.image_url,
  "https://img.hwahae.co.kr/products/12345/12345_20260715123456.jpg"
);

const oversized = {
  decisionBundle: Object.fromEntries(
    Array.from({ length: 4097 }, (_, index) => [
      `oversized_${index}`,
      index
    ])
  )
};
const oversizedSanitized = sanitizePremiumReportProductImages(oversized);
assert.deepEqual(
  oversizedSanitized,
  { decisionBundle: null },
  "a subtree beyond the finite traversal ceiling must fail closed without retaining data"
);

const cyclic = {};
cyclic.self = cyclic;
assert.equal(
  sanitizePremiumReportProductImages(cyclic)?.self,
  null,
  "cycles must not be traversed"
);

console.log("premium image sanitizer capacity verification passed");
