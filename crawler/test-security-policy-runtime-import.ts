import {
  assertSafeProductImageForWriter,
  resolveSafeProductImage,
} from "../lib/security/image-source-policy.js";

const valid = "https://img.hwahae.co.kr/products/123/123_20260822120000.jpg";
const invalid = "https://example.com/products/123/123_20260822120000.jpg";

if (resolveSafeProductImage(valid) !== valid) {
  throw new Error("crawler_security_policy_runtime_import_valid_case_failed");
}

if (resolveSafeProductImage(invalid) !== null) {
  throw new Error("crawler_security_policy_runtime_import_invalid_case_failed");
}

if (assertSafeProductImageForWriter(valid) !== valid) {
  throw new Error("crawler_security_policy_writer_runtime_import_failed");
}

console.log("crawler security policy runtime import: PASS");
