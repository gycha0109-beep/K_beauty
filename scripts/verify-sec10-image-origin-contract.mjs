import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const EXPECTED_REQUIRED_CASE_COUNT = 44;
export const REQUIRED_CASE_IDS = Object.freeze([
  "P01_APPROVED_HWHAE_URL",
  "P02_CANONICAL_URL_RETURN",
  "P03_MATCHING_PRODUCT_IDS",
  "P04_LEGACY_PRODUCT_PROJECTION",
  "P05_ABSENT_IMAGE_NONE",
  "P06_PLACEHOLDER_DESCRIPTOR",
  "P07_RENDERER_SECURITY_ATTRIBUTES",
  "P08_FACE_DATA_URL_PRESERVED",
  "A01_HTTP_REJECTED",
  "A02_PROTOCOL_RELATIVE_REJECTED",
  "A03_JAVASCRIPT_REJECTED",
  "A04_DATA_URL_REJECTED",
  "A05_BLOB_URL_REJECTED",
  "A06_FILE_URL_REJECTED",
  "A07_USERINFO_REJECTED",
  "A08_PASSWORD_REJECTED",
  "A09_EXPLICIT_443_REJECTED",
  "A10_NONSTANDARD_PORT_REJECTED",
  "A11_LOCALHOST_REJECTED",
  "A12_IPV4_REJECTED",
  "A13_IPV6_REJECTED",
  "A14_TRAILING_DOT_REJECTED",
  "A15_HOSTNAME_SUBSTRING_REJECTED",
  "A16_SUFFIX_LOOKALIKE_REJECTED",
  "A17_FAKE_PREFIX_REJECTED",
  "A18_PUNYCODE_LOOKALIKE_REJECTED",
  "A19_CONTROL_CHARACTER_REJECTED",
  "A20_NEWLINE_REJECTED",
  "A21_EXCESSIVE_LENGTH_REJECTED",
  "A22_QUERY_REJECTED",
  "A23_FRAGMENT_REJECTED",
  "A24_PATH_CONTRACT_REJECTED",
  "L01_PRODUCT_SOURCE_PROJECTION",
  "L02_CURRENT_PRODUCTS_RESPONSE",
  "L03_ANALYZE_RESPONSE_CANONICAL_ONLY",
  "L04_PREMIUM_PERSISTENCE_CANONICAL_ONLY",
  "L05_FULL_REPORT_LEGACY_REJECTED",
  "L06_UNKNOWN_NESTED_ALIAS_REJECTED",
  "L07_AVATAR_FAIL_CLOSED",
  "L08_WRITER_REJECTS_UNAPPROVED",
  "C01_EXACT_IMG_SRC_CANDIDATE",
  "C02_CSP_WILDCARD_ABSENT",
  "C03_CSP_BROAD_HTTPS_ABSENT",
  "C04_CSP_REJECTED_HOSTS_ABSENT"
]);

const root = process.cwd();
const VALID_URL = "https://img.hwahae.co.kr/products/12345/12345_20260715123456.jpg";
const MALICIOUS_URL = "javascript:alert(1)";
const REJECTED_HOSTS = [
  "shop.ideaseller.kr",
  "manyo.us",
  "cutipop.com",
  "d1flfk77wl2xk4.cloudfront.net",
  "d2c3d01lcpw2ui.cloudfront.net",
  "googleusercontent.com"
];

function read(path) {
  return readFileSync(resolve(root, path), "utf8").replace(/\r\n?/g, "\n");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertExactSet(actualValues, expectedValues, label) {
  const actual = [...new Set(actualValues)].sort();
  const expected = [...new Set(expectedValues)].sort();
  assert(actual.length === actualValues.length, `${label}: duplicate ID`);
  assert(expected.length === expectedValues.length, `${label}: required manifest duplicate ID`);
  assert(JSON.stringify(actual) === JSON.stringify(expected), `${label}: exact set mismatch`);
}

function hasImageAlias(value, path = []) {
  const aliases = new Set([
    "image_url",
    "imageUrl",
    "thumbnail_url",
    "thumbnailUrl",
    "product_image",
    "productImage",
    "product_image_url",
    "productImageUrl",
    "image_src",
    "imageSrc",
    "image"
  ]);

  if (Array.isArray(value)) {
    return value.some((item, index) => hasImageAlias(item, [...path, index]));
  }

  if (!value || typeof value !== "object") {
    return false;
  }

  return Object.entries(value).some(([key, child]) => {
    const childPath = [...path, key];
    const allowedProductImage = key === "image_url" && (
      childPath.join(".") === "topPick.image_url" ||
      childPath.join(".") === "freeResult.topPick.image_url" ||
      /^fullRoutine\.(morningSteps|nightSteps)\.\d+\.product\.image_url$/.test(childPath.join("."))
    );
    const allowedFaceImage = childPath.join(".") === "faceLabSummary.imageUrl";

    if (aliases.has(key) && !allowedProductImage && !allowedFaceImage) {
      return true;
    }

    return hasImageAlias(child, childPath);
  });
}

const policyUrl = pathToFileURL(resolve(root, "lib/security/image-source-policy.js")).href;
const policy = await import(policyUrl);

function assertRejected(value, label) {
  assert(policy.resolveSafeProductImage(value) === null, `${label}: URL should be rejected`);
  assert(policy.parseProductImageSource(value).kind === "none", `${label}: parser should return none`);
}

const catalog = Object.freeze([
  { id: "P01_APPROVED_HWHAE_URL", run() {
    const result = policy.parseProductImageSource(VALID_URL);
    assert(result.kind === "approved" && result.source === "hwahae", "approved Hwahae URL rejected");
  } },
  { id: "P02_CANONICAL_URL_RETURN", run() {
    assert(policy.resolveSafeProductImage(VALID_URL) === VALID_URL, "canonical URL was not returned exactly");
  } },
  { id: "P03_MATCHING_PRODUCT_IDS", run() {
    assert(policy.resolveSafeProductImage(VALID_URL) === VALID_URL, "matching directory and file IDs failed");
    assertRejected("https://img.hwahae.co.kr/products/12345/54321_20260715123456.jpg", "mismatched product ID");
  } },
  { id: "P04_LEGACY_PRODUCT_PROJECTION", run() {
    const result = policy.sanitizeAnalyzeResultProductImages({ topPick: { id: "legacy", name: "Legacy", image_url: VALID_URL } });
    assert(result.topPick.image_url === VALID_URL, "approved legacy product image was not projected");
  } },
  { id: "P05_ABSENT_IMAGE_NONE", run() {
    assert(policy.resolveSafeProductImage(null) === null, "absent image should resolve to none");
  } },
  { id: "P06_PLACEHOLDER_DESCRIPTOR", run() {
    assert(policy.getProductImageDescriptor({ image_url: MALICIOUS_URL }).kind === "none", "rejected image should use placeholder descriptor");
  } },
  { id: "P07_RENDERER_SECURITY_ATTRIBUTES", run() {
    const descriptor = policy.getProductImageDescriptor({ image_url: VALID_URL });
    const source = read("components/common/SafeProductImage.jsx");
    const renderers = [
      "app/result/page.js",
      "app/result/full-report/page.js",
      "components/full-report/PremiumRoutineConsultSection.jsx",
      "components/result/free-v2/FreeResultV2RecommendationGuideStep.jsx"
    ].map(read);
    assert(descriptor.kind === "approved" && descriptor.src === VALID_URL, "renderer descriptor did not approve canonical URL");
    assert(source.includes('referrerPolicy="no-referrer"'), "renderer must use no-referrer");
    assert(source.includes('data-product-image-state="placeholder"'), "renderer placeholder state missing");
    assert(source.includes("onError={() => setFailedSrc(descriptor.src)}"), "renderer load-error fallback missing");
    assert(renderers.every((renderer) => renderer.includes('from "@/components/common/SafeProductImage"')), "product renderer is not wired to SafeProductImage");
    assert(renderers.every((renderer) => !/<img[\s\S]{0,240}src=\{[^}]*image_url/.test(renderer)), "product renderer contains a raw image_url src");
  } },
  { id: "P08_FACE_DATA_URL_PRESERVED", run() {
    const faceDataUrl = "data:image/jpeg;base64,AA==";
    const result = policy.sanitizePremiumReportProductImages({
      faceLabSummary: { imageUrl: faceDataUrl },
      metadata: { imageUrl: faceDataUrl }
    });
    const rejectedLegacyFace = policy.sanitizePremiumReportProductImages({
      faceLabSummary: { imageUrl: "https://avatar.example/face.jpg" }
    });
    assert(result.faceLabSummary.imageUrl === faceDataUrl, "SEC-08 face data URL was removed");
    assert(!("imageUrl" in rejectedLegacyFace.faceLabSummary), "legacy remote face image should be removed");
    assert(!("imageUrl" in result.metadata), "unknown data URL alias should be removed");
  } },
  { id: "A01_HTTP_REJECTED", run() { assertRejected(VALID_URL.replace("https:", "http:"), "http"); } },
  { id: "A02_PROTOCOL_RELATIVE_REJECTED", run() { assertRejected(VALID_URL.replace("https:", ""), "protocol relative"); } },
  { id: "A03_JAVASCRIPT_REJECTED", run() { assertRejected(MALICIOUS_URL, "javascript"); } },
  { id: "A04_DATA_URL_REJECTED", run() { assertRejected("data:image/jpeg;base64,AA==", "data URL"); } },
  { id: "A05_BLOB_URL_REJECTED", run() { assertRejected("blob:https://example.com/id", "blob URL"); } },
  { id: "A06_FILE_URL_REJECTED", run() { assertRejected("file:///products/12345/12345_20260715123456.jpg", "file URL"); } },
  { id: "A07_USERINFO_REJECTED", run() { assertRejected(VALID_URL.replace("https://", "https://user@"), "userinfo"); } },
  { id: "A08_PASSWORD_REJECTED", run() { assertRejected(VALID_URL.replace("https://", "https://user:pass@"), "password"); } },
  { id: "A09_EXPLICIT_443_REJECTED", run() { assertRejected(VALID_URL.replace(".kr/", ".kr:443/"), "explicit 443"); } },
  { id: "A10_NONSTANDARD_PORT_REJECTED", run() { assertRejected(VALID_URL.replace(".kr/", ".kr:8443/"), "nonstandard port"); } },
  { id: "A11_LOCALHOST_REJECTED", run() { assertRejected(VALID_URL.replace("img.hwahae.co.kr", "localhost"), "localhost"); } },
  { id: "A12_IPV4_REJECTED", run() { assertRejected(VALID_URL.replace("img.hwahae.co.kr", "127.0.0.1"), "IPv4"); } },
  { id: "A13_IPV6_REJECTED", run() { assertRejected(VALID_URL.replace("img.hwahae.co.kr", "[::1]"), "IPv6"); } },
  { id: "A14_TRAILING_DOT_REJECTED", run() { assertRejected(VALID_URL.replace(".kr/", ".kr./"), "trailing dot"); } },
  { id: "A15_HOSTNAME_SUBSTRING_REJECTED", run() { assertRejected(`https://evil.example/products/12345/12345_20260715123456.jpg/img.hwahae.co.kr`, "hostname substring"); } },
  { id: "A16_SUFFIX_LOOKALIKE_REJECTED", run() { assertRejected(VALID_URL.replace("img.hwahae.co.kr", "img.hwahae.co.kr.evil.example"), "suffix lookalike"); } },
  { id: "A17_FAKE_PREFIX_REJECTED", run() { assertRejected(VALID_URL.replace("img.hwahae.co.kr", "evil-img.hwahae.co.kr"), "fake prefix"); } },
  { id: "A18_PUNYCODE_LOOKALIKE_REJECTED", run() { assertRejected(VALID_URL.replace("img.hwahae.co.kr", "xn--img-hwahae-9za.co.kr"), "punycode lookalike"); } },
  { id: "A19_CONTROL_CHARACTER_REJECTED", run() { assertRejected(`${VALID_URL}\u0000`, "control character"); } },
  { id: "A20_NEWLINE_REJECTED", run() { assertRejected(`${VALID_URL}\n`, "newline"); } },
  { id: "A21_EXCESSIVE_LENGTH_REJECTED", run() { assertRejected(`${VALID_URL}${"a".repeat(2050)}`, "excessive length"); } },
  { id: "A22_QUERY_REJECTED", run() { assertRejected(`${VALID_URL}?v=1`, "query"); } },
  { id: "A23_FRAGMENT_REJECTED", run() { assertRejected(`${VALID_URL}#preview`, "fragment"); } },
  { id: "A24_PATH_CONTRACT_REJECTED", run() {
    [
      "https://img.hwahae.co.kr/products/12345/54321_20260715123456.jpg",
      "https://img.hwahae.co.kr/products/%31%32%33%34%35/12345_20260715123456.jpg",
      "https://img.hwahae.co.kr/products/12345//12345_20260715123456.jpg",
      "https://img.hwahae.co.kr/products/12345/12345_20260715123456.png",
      "https://img.hwahae.co.kr/products/12345/12345_20260715123456.JPG"
    ].forEach((value) => assertRejected(value, "path contract"));
  } },
  { id: "L01_PRODUCT_SOURCE_PROJECTION", run() {
    const projected = policy.projectProductImage({ id: "p1", image_url: "https://manyo.us/image.jpg", brand: "Brand" });
    const source = read("lib/product-source.js");
    assert(!("image_url" in projected) && projected.brand === "Brand", "product projection retained a rejected URL");
    assert(source.includes("image_url: resolveSafeProductImage(product.image_url)"), "product source is not wired to the resolver");
  } },
  { id: "L02_CURRENT_PRODUCTS_RESPONSE", run() {
    const result = policy.sanitizePremiumReportProductImages({ currentProducts: { selections: [{ productSnapshot: { id: "p1", image_url: MALICIOUS_URL } }] } });
    const source = `${read("lib/current-products.js")}\n${read("lib/product-source.js")}`;
    assert(!("image_url" in result.currentProducts.selections[0].productSnapshot), "current-products snapshot retained rejected URL");
    assert(source.includes("resolveSafeProductImage(product.image_url)"), "current-products response is not wired to resolver");
  } },
  { id: "L03_ANALYZE_RESPONSE_CANONICAL_ONLY", run() {
    const result = policy.sanitizeAnalyzeResultProductImages({ topPick: { image_url: VALID_URL }, metadata: { image_url: MALICIOUS_URL } });
    const source = read("app/api/analyze/route.js");
    assert(result.topPick.image_url === VALID_URL && !hasImageAlias(result.metadata), "analyze boundary projection failed");
    assert(source.includes("sanitizeAnalyzeResultProductImages("), "analyze response is not wired to image sanitizer");
  } },
  { id: "L04_PREMIUM_PERSISTENCE_CANONICAL_ONLY", run() {
    const result = policy.sanitizePremiumReportProductImages({ fullRoutine: { morningSteps: [{ product: { image_url: VALID_URL } }] }, report: { image_url: MALICIOUS_URL } });
    const source = read("app/api/full-report/route.js");
    assert(result.fullRoutine.morningSteps[0].product.image_url === VALID_URL && !hasImageAlias(result.report), "premium persistence projection failed");
    assert(source.includes("sanitizePremiumReportForBoundary"), "full-report persistence is not wired to boundary sanitizer");
  } },
  { id: "L05_FULL_REPORT_LEGACY_REJECTED", run() {
    const result = policy.sanitizePremiumReportProductImages({ freeResult: { topPick: { name: "Legacy", image_url: "https://cutipop.com/image.jpg" } } });
    assert(!("image_url" in result.freeResult.topPick), "legacy rejected URL survived full-report read");
  } },
  { id: "L06_UNKNOWN_NESTED_ALIAS_REJECTED", run() {
    const result = policy.sanitizePremiumReportProductImages({ metadata: { image_url: VALID_URL }, nested: [{ thumbnailUrl: VALID_URL }] });
    assert(!hasImageAlias(result), "unknown nested image alias was approved");
    assert(!JSON.stringify(result).includes(VALID_URL), "unknown approved-host URL survived outside a product node");
  } },
  { id: "L07_AVATAR_FAIL_CLOSED", run() {
    const source = read("components/auth/AuthNav.jsx");
    const profileSource = read("lib/auth/profile-upsert.js");
    assert(policy.resolveSafeAvatarImage("https://lh3.googleusercontent.com/avatar") === null, "external avatar should be disabled");
    assert(policy.buildAvatarInitials({ displayName: "Jane Doe", email: "jane@example.com" }) === "JD", "avatar initials failed");
    assert(!source.includes("avatar_url") && !source.includes("metadata.picture") && !source.includes("<img"), "AuthNav still renders arbitrary avatar URL");
    assert(!profileSource.includes("avatar_url:"), "profile upsert still copies external avatar URL");
  } },
  { id: "L08_WRITER_REJECTS_UNAPPROVED", run() {
    const source = read("crawler/lib/supabase.ts");
    let error = null;
    try {
      policy.assertSafeProductImageForWriter("https://shop.ideaseller.kr/image.png");
    } catch (caught) {
      error = caught;
    }
    assert(error?.code === "PRODUCT_IMAGE_SOURCE_REJECTED", "writer did not reject unapproved URL");
    assert(!String(error?.message).includes("ideaseller"), "writer error exposed raw URL");
    assert(source.indexOf("assertSafeProductImageForWriter(requestedImageUrl)") < source.indexOf("getProductDetailRecord(client, productId)"), "writer validation must run before DB access");
  } },
  { id: "C01_EXACT_IMG_SRC_CANDIDATE", run() {
    assert(policy.PRODUCT_IMAGE_CSP_DIRECTIVE === "img-src 'self' data: blob: https://img.hwahae.co.kr;", "CSP img-src candidate mismatch");
  } },
  { id: "C02_CSP_WILDCARD_ABSENT", run() {
    assert(!policy.PRODUCT_IMAGE_CSP_DIRECTIVE.includes("*"), "CSP must not contain wildcard");
  } },
  { id: "C03_CSP_BROAD_HTTPS_ABSENT", run() {
    assert(!/(^|\s)https:(\s|;|$)/.test(policy.PRODUCT_IMAGE_CSP_DIRECTIVE), "CSP must not allow broad https:");
  } },
  { id: "C04_CSP_REJECTED_HOSTS_ABSENT", run() {
    assert(REJECTED_HOSTS.every((host) => !policy.PRODUCT_IMAGE_CSP_DIRECTIVE.includes(host)), "CSP contains rejected product or avatar host");
    assert(JSON.stringify(policy.APPROVED_PRODUCT_IMAGE_HOSTS) === JSON.stringify(["img.hwahae.co.kr"]), "approved host registry must contain exactly one host");
  } }
]);

const catalogIds = catalog.map((item) => item.id);

assert(REQUIRED_CASE_IDS.length === EXPECTED_REQUIRED_CASE_COUNT, "required case count mismatch");
assert(catalog.length === EXPECTED_REQUIRED_CASE_COUNT, "implemented case count mismatch");
assertExactSet(REQUIRED_CASE_IDS, REQUIRED_CASE_IDS, "manifest");
assertExactSet(catalogIds, REQUIRED_CASE_IDS, "catalog");

const observed = new Map();
let failed = false;

for (const item of catalog) {
  if (observed.has(item.id)) {
    throw new Error(`duplicate observed case: ${item.id}`);
  }

  try {
    await item.run();
    observed.set(item.id, "PASS");
    console.log(`SEC10_CASE_RESULT=${JSON.stringify({ id: item.id, result: "PASS" })}`);
  } catch (error) {
    failed = true;
    observed.set(item.id, "FAIL");
    console.error(`SEC10_CASE_RESULT=${JSON.stringify({ id: item.id, result: "FAIL", error: error?.message || "case_failed" })}`);
  }
}

assert(observed.size === EXPECTED_REQUIRED_CASE_COUNT, "observed case count mismatch");
assertExactSet([...observed.keys()], REQUIRED_CASE_IDS, "observed");
assert([...observed.values()].every((value) => value === "PASS") && !failed, "one or more SEC-10 cases failed");

console.log(`SEC10_IMAGE_ORIGIN_CASES=${observed.size}/${EXPECTED_REQUIRED_CASE_COUNT}`);
console.log("SEC10_IMAGE_ORIGIN_CONTRACT=PASS");
