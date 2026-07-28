import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import {
  readPurchaseAnchorSources,
  verifyPurchaseAnchorContract
} from "./lib/purchase-anchor-contract.mjs";

const root = process.cwd();
const require = createRequire(import.meta.url);
const { parse: parseJavaScript } = require("next/dist/compiled/babel/parser");
const checkedFiles = [];
const DANGEROUS_OBJECT_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const EXPECTED_REQUIRED_CASE_COUNT = 42;
const REQUIRED_CASE_IDS = Object.freeze([
  "direct_olive_young",
  "direct_hwahae",
  "direct_official_brand",
  "reject_hostname_suffix",
  "reject_query_substring",
  "reject_userinfo",
  "reject_hostname_lookalike",
  "reject_protocol_relative",
  "reject_javascript_scheme",
  "reject_data_scheme",
  "reject_file_scheme",
  "reject_blob_scheme",
  "reject_http_scheme",
  "reject_nonstandard_port",
  "reject_ipv4_loopback",
  "reject_ipv6_loopback",
  "reject_localhost",
  "reject_trailing_dot",
  "reject_punycode_lookalike",
  "reject_control_character",
  "reject_surrounding_whitespace",
  "reject_malformed_url",
  "reject_overlong_url",
  "reject_unapproved_cultbeauty",
  "reject_unapproved_koolseoul",
  "reject_unapproved_beautyofjoseon_store",
  "reject_official_brand_mismatch",
  "reject_source_hint_expansion",
  "fallback_query_encoding",
  "none_empty_query",
  "project_product_aliases",
  "legacy_premium_recursive_projection",
  "analyze_recursive_projection",
  "all_aliases_unknown_depth",
  "none_product_projection",
  "overdepth_payload",
  "oversized_array_payload",
  "oversized_object_payload",
  "cyclic_payload",
  "legacy_null_payload",
  "legacy_array_payload",
  "response_wiring"
]);
const IMPLEMENTED_CASE_IDS = Object.freeze([...REQUIRED_CASE_IDS]);
const requiredCaseIdSet = new Set(REQUIRED_CASE_IDS);
const observedCaseCounts = new Map();
const caseResults = [];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function getDuplicateIds(ids) {
  const seen = new Set();
  const duplicates = new Set();

  for (const id of ids) {
    if (seen.has(id)) {
      duplicates.add(id);
    }
    seen.add(id);
  }

  return [...duplicates].sort();
}

function assertExactCaseCatalog(ids, label) {
  const duplicates = getDuplicateIds(ids);
  const idSet = new Set(ids);
  const missing = REQUIRED_CASE_IDS.filter((id) => !idSet.has(id));
  const unknown = [...idSet].filter((id) => !requiredCaseIdSet.has(id)).sort();

  assert(duplicates.length === 0, `${label}: duplicate case ID(s): ${duplicates.join(",")}`);
  assert(ids.length === EXPECTED_REQUIRED_CASE_COUNT, `${label}: expected ${EXPECTED_REQUIRED_CASE_COUNT} IDs, received ${ids.length}`);
  assert(missing.length === 0, `${label}: missing required case ID(s): ${missing.join(",")}`);
  assert(unknown.length === 0, `${label}: unknown case ID(s): ${unknown.join(",")}`);
}

function recordCaseResult(id, status, reason = null) {
  const result = reason ? { id, status, reason } : { id, status };
  caseResults.push(result);
  console.log(`SEC07_CASE_RESULT=${JSON.stringify(result)}`);
}

function runCase(id, callback) {
  const count = (observedCaseCounts.get(id) || 0) + 1;
  observedCaseCounts.set(id, count);

  if (!requiredCaseIdSet.has(id)) {
    recordCaseResult(id, "FAIL", "unknown_case_id");
    return;
  }

  if (count > 1) {
    recordCaseResult(id, "FAIL", "duplicate_execution");
    return;
  }

  try {
    callback();
    recordCaseResult(id, "PASS");
  } catch (error) {
    recordCaseResult(id, "FAIL", error instanceof Error ? error.message : "unexpected_error");
  }
}

function finalizeCaseExecution() {
  const observedIds = [...observedCaseCounts.keys()];
  const unobserved = REQUIRED_CASE_IDS.filter((id) => !observedCaseCounts.has(id));
  const unknown = observedIds.filter((id) => !requiredCaseIdSet.has(id)).sort();
  const duplicates = observedIds.filter((id) => observedCaseCounts.get(id) > 1).sort();
  const unrecorded = REQUIRED_CASE_IDS.filter((id) => !caseResults.some((result) => result.id === id));
  const failures = caseResults.filter((result) => result.status !== "PASS");

  assert(unobserved.length === 0, `observed cases: unobserved required case ID(s): ${unobserved.join(",")}`);
  assert(unknown.length === 0, `observed cases: unknown case ID(s): ${unknown.join(",")}`);
  assert(duplicates.length === 0, `observed cases: duplicate case ID(s): ${duplicates.join(",")}`);
  assert(unrecorded.length === 0, `observed cases: no result recorded for case ID(s): ${unrecorded.join(",")}`);
  assert(failures.length === 0, `case failure(s): ${failures.map((result) => result.id).join(",")}`);
  assert(caseResults.length === EXPECTED_REQUIRED_CASE_COUNT, `observed cases: expected ${EXPECTED_REQUIRED_CASE_COUNT} results, received ${caseResults.length}`);

  console.log(`SEC07_CASE_SUMMARY=${JSON.stringify({
    required: EXPECTED_REQUIRED_CASE_COUNT,
    observed: observedIds.length,
    passed: caseResults.length,
    failed: 0
  })}`);
}

function read(path) {
  checkedFiles.push(path);
  return readFileSync(resolve(root, path), "utf8");
}

function readSourceText(path) {
  return read(path).replace(/\r\n?/g, "\n");
}

function walkAst(node, callback) {
  if (!node || typeof node !== "object") return;
  callback(node);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      for (const item of value) walkAst(item, callback);
    } else {
      walkAst(value, callback);
    }
  }
}

function parseModule(source) {
  return parseJavaScript(source, {
    sourceType: "module",
    plugins: ["jsx"]
  });
}

function isIdentifier(node, name) {
  return node?.type === "Identifier" && node.name === name;
}

function isCall(node, calleeName, argumentName) {
  return (
    node?.type === "CallExpression" &&
    isIdentifier(node.callee, calleeName) &&
    (argumentName === undefined || isIdentifier(node.arguments?.[0], argumentName))
  );
}

function unwrapConditionalCall(node) {
  return node?.type === "ConditionalExpression" ? node.consequent : node;
}

function verifyAnalyzePremiumBoundaryWiring(source) {
  const ast = parseModule(source);
  const bindings = new Map();
  let sessionPayloadConsumesBoundary = false;
  let publicResponseUsesPurchaseBoundary = false;

  walkAst(ast, (node) => {
    if (node.type === "VariableDeclarator" && node.id?.type === "Identifier") {
      bindings.set(node.id.name, node.init);
    }
    if (
      node.type === "ObjectProperty" &&
      isIdentifier(node.key, "premiumReport") &&
      isIdentifier(node.value, "premiumSessionReport")
    ) {
      sessionPayloadConsumesBoundary = true;
    }
    if (
      isCall(node, "sanitizeAnalyzeResultProductImages") &&
      isCall(node.arguments?.[0], "sanitizeAnalyzeResultPurchaseLinks")
    ) {
      publicResponseUsesPurchaseBoundary = true;
    }
  });

  return (
    isCall(
      unwrapConditionalCall(bindings.get("purchaseSanitizedPremiumReport")),
      "sanitizePremiumReportPurchaseLinks",
      "premiumReport"
    ) &&
    isCall(
      unwrapConditionalCall(bindings.get("premiumSessionReport")),
      "sanitizePremiumReportProductImages",
      "purchaseSanitizedPremiumReport"
    ) &&
    sessionPayloadConsumesBoundary &&
    publicResponseUsesPurchaseBoundary
  );
}

function verifyFullReportBoundaryWiring(source) {
  const ast = parseModule(source);
  let helperUsesPurchaseBoundary = false;
  let savedResponseUsesHelper = false;
  let sessionResponseUsesHelper = false;

  const containsIdentifier = (node, name) => {
    let found = false;
    walkAst(node, (child) => {
      if (isIdentifier(child, name)) found = true;
    });
    return found;
  };

  walkAst(ast, (node) => {
    if (
      node.type === "FunctionDeclaration" &&
      isIdentifier(node.id, "sanitizePremiumReportForBoundary")
    ) {
      walkAst(node.body, (child) => {
        if (
          isCall(child, "sanitizePremiumReportProductImages") &&
          isCall(child.arguments?.[0], "sanitizePremiumReportPurchaseLinks")
        ) {
          helperUsesPurchaseBoundary = true;
        }
      });
    }
    if (isCall(node, "sanitizePremiumReportForBoundary")) {
      const argument = node.arguments?.[0];
      if (containsIdentifier(argument, "savedReport") && containsIdentifier(argument, "premium_report")) {
        savedResponseUsesHelper = true;
      }
      if (isIdentifier(argument, "authoritativePremiumReport")) {
        sessionResponseUsesHelper = true;
      }
    }
  });

  return helperUsesPurchaseBoundary && savedResponseUsesHelper && sessionResponseUsesHelper;
}

function assertPurchaseAnchorMutationRejected({ label, sourceRoot, mutate }) {
  const sources = readPurchaseAnchorSources({ root: sourceRoot });
  const sourceOverrides = mutate({ ...sources });
  let rejected = false;

  try {
    verifyPurchaseAnchorContract({ root: sourceRoot, sourceOverrides });
  } catch {
    rejected = true;
  }

  assert(rejected, `purchase anchor weakening was accepted: ${label}`);
}

async function loadResolver() {
  const source = read("lib/product-purchase-link.js");
  return import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
}

function assertResult(result, expectedKind, label) {
  assert(result.kind === expectedKind, `${label}: expected ${expectedKind}, received ${result.kind}`);
  assert(Object.keys(result).sort().join(",") === "href,kind,source", `${label}: resolver returned an unexpected field`);

  if (expectedKind === "none") {
    assert(result.href === null && result.source === null, `${label}: none must not return a URL`);
    return;
  }

  assert(typeof result.href === "string" && result.href.startsWith("https://"), `${label}: URL must be HTTPS`);
}

function collectPurchaseUrlEntries(value, path = [], entries = []) {
  if (!value || typeof value !== "object") {
    return entries;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => collectPurchaseUrlEntries(item, [...path, String(index)], entries));
    return entries;
  }

  for (const [key, child] of Object.entries(value)) {
    const nextPath = [...path, key];
    if (resolver.PRODUCT_PURCHASE_URL_ALIASES.includes(key)) {
      entries.push({ path: nextPath.join("."), key, value: child });
    }
    collectPurchaseUrlEntries(child, nextPath, entries);
  }

  return entries;
}

function assertCanonicalPurchaseEntries(payload, expectedByPath, label) {
  const entries = collectPurchaseUrlEntries(payload);
  const actualPaths = entries.map((entry) => entry.path).sort();
  const expectedPaths = Object.keys(expectedByPath).sort();
  assert(
    actualPaths.join("|") === expectedPaths.join("|"),
    `${label}: purchase URL aliases remained outside recognized product nodes (${actualPaths.join(",") || "none"})`
  );

  for (const entry of entries) {
    assert(entry.key === "buy_link", `${label}: canonical product URL must use buy_link only`);
    assert(entry.value === expectedByPath[entry.path], `${label}: canonical URL mismatch at ${entry.path}`);
    assert(typeof entry.value === "string" && entry.value.startsWith("https://"), `${label}: canonical URL must be HTTPS`);
  }
}

function assertNoDangerousKeys(value, path = []) {
  if (!value || typeof value !== "object") {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoDangerousKeys(item, [...path, String(index)]));
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    assert(!DANGEROUS_OBJECT_KEYS.has(key), `dangerous key escaped at ${[...path, key].join(".")}`);
    assertNoDangerousKeys(child, [...path, key]);
  }
}

assert(Object.isFrozen(REQUIRED_CASE_IDS), "required case manifest must be frozen");
assertExactCaseCatalog(REQUIRED_CASE_IDS, "required case manifest");
assertExactCaseCatalog(IMPLEMENTED_CASE_IDS, "implemented case catalog");
console.log(`SEC07_CASE_MANIFEST=${JSON.stringify({ required: REQUIRED_CASE_IDS, expectedCount: EXPECTED_REQUIRED_CASE_COUNT })}`);

const resolver = await loadResolver();

const directCases = [
  {
    id: "direct_olive_young",
    label: "Olive Young product detail",
    value: { buyLink: "https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A0000001", brand: "Round Lab", name: "Dokdo Toner" },
    source: "olive_young"
  },
  {
    id: "direct_hwahae",
    label: "Hwahae product detail",
    value: { buyLink: "https://www.hwahae.co.kr/products/2094548", brand: "Anua", name: "Heartleaf Toner" },
    source: "hwahae"
  },
  {
    id: "direct_official_brand",
    label: "official brand product",
    value: { buyLink: "https://beautyofjoseon.com/products/relief-sun?variant=1#details", brand: "Beauty of Joseon", name: "Relief Sun" },
    source: "official:beautyofjoseon"
  }
];

for (const testCase of directCases) {
  runCase(testCase.id, () => {
    const result = resolver.resolveProductPurchaseLink(testCase.value);
    assertResult(result, "direct", testCase.label);
    assert(result.source === testCase.source, `${testCase.label}: unexpected source`);
  });
}

const rejectedDirectCases = [
  { id: "reject_hostname_suffix", buyLink: "https://oliveyoung.co.kr.evil.example/store/goods/getGoodsDetail.do" },
  { id: "reject_query_substring", buyLink: "https://evil.example/?next=oliveyoung.co.kr" },
  { id: "reject_userinfo", buyLink: "https://oliveyoung.co.kr@evil.example/store/goods/getGoodsDetail.do" },
  { id: "reject_hostname_lookalike", buyLink: "https://fakeoliveyoung.co.kr/store/goods/getGoodsDetail.do" },
  { id: "reject_protocol_relative", buyLink: "//evil.example/store/goods/getGoodsDetail.do" },
  { id: "reject_javascript_scheme", buyLink: "javascript:alert(1)" },
  { id: "reject_data_scheme", buyLink: "data:text/html,unsafe" },
  { id: "reject_file_scheme", buyLink: "file:///tmp/product" },
  { id: "reject_blob_scheme", buyLink: "blob:https://oliveyoung.co.kr/unsafe" },
  { id: "reject_http_scheme", buyLink: "http://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do" },
  { id: "reject_nonstandard_port", buyLink: "https://www.oliveyoung.co.kr:8443/store/goods/getGoodsDetail.do" },
  { id: "reject_ipv4_loopback", buyLink: "https://127.0.0.1/store/goods/getGoodsDetail.do" },
  { id: "reject_ipv6_loopback", buyLink: "https://[::1]/store/goods/getGoodsDetail.do" },
  { id: "reject_localhost", buyLink: "https://localhost/store/goods/getGoodsDetail.do" },
  { id: "reject_trailing_dot", buyLink: "https://www.oliveyoung.co.kr./store/goods/getGoodsDetail.do" },
  { id: "reject_punycode_lookalike", buyLink: "https://xn--oliveyoung-9za.co.kr/store/goods/getGoodsDetail.do" },
  { id: "reject_control_character", buyLink: "https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do\nhttps://evil.example" },
  { id: "reject_surrounding_whitespace", buyLink: " https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do " },
  { id: "reject_malformed_url", buyLink: "not a URL" },
  { id: "reject_overlong_url", buyLink: `https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?${"x".repeat(2100)}` },
  { id: "reject_unapproved_cultbeauty", buyLink: "https://www.cultbeauty.com/products/unsafe" },
  { id: "reject_unapproved_koolseoul", buyLink: "https://koolseoul.com/products/unsafe" },
  { id: "reject_unapproved_beautyofjoseon_store", buyLink: "https://the-beautyofjoseon.store/products/unsafe" }
];

for (const testCase of rejectedDirectCases) {
  runCase(testCase.id, () => {
    assertResult(
      resolver.resolveProductPurchaseLink({ buyLink: testCase.buyLink, brand: "Round Lab", name: "Dokdo Toner" }),
      "fallback",
      `unsafe URL ${testCase.buyLink.slice(0, 48)}`
    );
  });
}

runCase("reject_official_brand_mismatch", () => {
  assertResult(
    resolver.resolveProductPurchaseLink({
      buyLink: "https://beautyofjoseon.com/products/relief-sun",
      brand: "Anua",
      name: "Heartleaf Toner"
    }),
    "fallback",
    "official host and brand mismatch"
  );
});
runCase("reject_source_hint_expansion", () => {
  assertResult(
    resolver.resolveProductPurchaseLink({
      buyLink: "https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do",
      brand: "Round Lab",
      name: "Dokdo Toner",
      sourceHint: "hwahae"
    }),
    "fallback",
    "source hint may only narrow"
  );
});

runCase("fallback_query_encoding", () => {
  const fallback = resolver.resolveProductPurchaseLink({
    buyLink: "https://evil.example/unsafe",
    brand: "  라운드랩\n",
    name: "  1025 독도 토너 & 세럼  "
  });
  assertResult(fallback, "fallback", "Korean fallback query");
  assert(new URL(fallback.href).searchParams.get("query") === "라운드랩 1025 독도 토너 & 세럼", "fallback query must normalize and encode brand/name only");
});

runCase("none_empty_query", () => {
  assertResult(resolver.resolveProductPurchaseLink({ buyLink: "https://evil.example/unsafe" }), "none", "empty fallback query");
});

runCase("project_product_aliases", () => {
  const projected = resolver.projectProductPurchaseLink({
    id: "product-1",
    brand: "Round Lab",
    name: "Dokdo Toner",
    buy_link: "javascript:alert(1)",
    buyLink: "https://evil.example/raw",
    purchase_url: "https://evil.example/raw",
    purchaseUrl: "https://evil.example/raw",
    externalUrl: "https://evil.example/raw",
    href: "https://evil.example/raw",
    metadata: {
      buy_link: "javascript:alert(1)",
      purchaseUrl: "https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A0000001"
    }
  });
  const projectedFallback = resolver.resolveProductPurchaseLink({
    buyLink: "javascript:alert(1)",
    brand: "Round Lab",
    name: "Dokdo Toner"
  });
  assert(projected.buy_link === projectedFallback.href, "product projection must replace an unsafe direct URL with resolver fallback");
  assert(
    !("buyLink" in projected) &&
      !("purchase_url" in projected) &&
      !("purchaseUrl" in projected) &&
      !("externalUrl" in projected) &&
      !("href" in projected),
    "product projection must remove raw URL aliases"
  );
  assert(!("buy_link" in projected.metadata) && !("purchaseUrl" in projected.metadata), "product projection must remove nested raw URL aliases");
});

const oliveYoungUrl = "https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A0000001";
const hwahaeUrl = "https://www.hwahae.co.kr/products/2094548";
const officialUrl = "https://beautyofjoseon.com/products/relief-sun?variant=1#details";
const fallbackUrl = resolver.resolveProductPurchaseLink({
  buyLink: "javascript:alert(1)",
  brand: "Round Lab",
  name: "Dokdo Toner"
}).href;

runCase("legacy_premium_recursive_projection", () => {
const legacyPremiumPayload = JSON.parse(JSON.stringify({
  buy_link: "javascript:alert(1)",
  metadata: {
    buy_link: oliveYoungUrl,
    purchaseUrl: "javascript:alert(1)",
    note: "https://example.test/text-only-url"
  },
  freeResult: {
    topPick: {
      id: "olive",
      brand: "Round Lab",
      name: "Dokdo Toner",
      buy_link: oliveYoungUrl,
      metadata: { buy_link: "javascript:alert(1)" }
    },
    alternative: {
      id: "unsafe",
      brand: "Round Lab",
      name: "Dokdo Toner",
      buy_link: "javascript:alert(1)"
    },
    products: [{ id: "hwahae", brand: "Anua", name: "Heartleaf Toner", purchaseUrl: hwahaeUrl }],
    metadata: { purchaseUrl: "javascript:alert(1)" }
  },
  supportingProducts: [{ role: "support", product: { id: "official", brand: "Beauty of Joseon", name: "Relief Sun", buy_link: officialUrl } }],
  fullRoutine: {
    morningSteps: [{ buy_link: "javascript:alert(1)", product: { id: "routine", brand: "Round Lab", name: "Dokdo Toner", buy_link: oliveYoungUrl } }],
    nightSteps: []
  },
  budgetAlternatives: [{ id: "budget", brand: "Round Lab", name: "Dokdo Toner", buy_link: "javascript:alert(1)" }],
  currentProductVerdicts: [{ product: { id: "current", brand: "Round Lab", name: "Dokdo Toner", buy_link: oliveYoungUrl } }],
  unknownItems: [{ buyLink: oliveYoungUrl, nested: { purchase_url: "javascript:alert(1)" } }],
  deep: { a: { b: { c: { purchase_url: "javascript:alert(1)" } } } },
  constructor: { buy_link: "javascript:alert(1)" }
}));
Object.defineProperty(legacyPremiumPayload, "__proto__", {
  value: { buy_link: "javascript:alert(1)" },
  enumerable: true,
  configurable: true
});
const sanitizedPremiumPayload = resolver.sanitizePremiumReportPurchaseLinks(legacyPremiumPayload);
assertCanonicalPurchaseEntries(sanitizedPremiumPayload, {
  "freeResult.alternative.buy_link": fallbackUrl,
  "freeResult.products.0.buy_link": hwahaeUrl,
  "freeResult.topPick.buy_link": oliveYoungUrl,
  "supportingProducts.0.product.buy_link": officialUrl,
  "fullRoutine.morningSteps.0.product.buy_link": oliveYoungUrl,
  "budgetAlternatives.0.buy_link": fallbackUrl,
  "currentProductVerdicts.0.product.buy_link": oliveYoungUrl
}, "legacy premium payload");
assertNoDangerousKeys(sanitizedPremiumPayload);
assert(sanitizedPremiumPayload.metadata.note === "https://example.test/text-only-url", "non-purchase text must remain intact");
});

runCase("analyze_recursive_projection", () => {
  const analyzePayload = resolver.sanitizeAnalyzeResultPurchaseLinks({
    topPick: { id: "top", brand: "Round Lab", name: "Dokdo Toner", buy_link: oliveYoungUrl },
    alternative: { id: "alt", brand: "Round Lab", name: "Dokdo Toner", buy_link: "javascript:alert(1)" },
    metadata: { buy_link: "javascript:alert(1)", purchaseUrl: oliveYoungUrl }
  });
  assertCanonicalPurchaseEntries(analyzePayload, {
    "alternative.buy_link": fallbackUrl,
    "topPick.buy_link": oliveYoungUrl
  }, "analyze payload");
});

runCase("all_aliases_unknown_depth", () => {
  for (const alias of resolver.PRODUCT_PURCHASE_URL_ALIASES) {
    const aliasPayload = resolver.sanitizePurchaseLinkPayload({ nested: { [alias]: "javascript:alert(1)" } });
    assert(collectPurchaseUrlEntries(aliasPayload).length === 0, `raw URL alias ${alias} must be removed at unknown depth`);
  }
});

runCase("none_product_projection", () => {
  const noneProduct = resolver.projectProductPurchaseLink({ id: "none", brand: "", name: "", buy_link: "javascript:alert(1)" });
  assert(!Object.prototype.hasOwnProperty.call(noneProduct, "buy_link"), "product without a usable resolver result must not expose a URL field");
});

runCase("overdepth_payload", () => {
  const tooDeep = { current: null };
  let cursor = tooDeep;
  for (let index = 0; index <= resolver.PRODUCT_PURCHASE_LINK_LIMITS.maxPayloadDepth; index += 1) {
    cursor.next = {};
    cursor = cursor.next;
  }
  cursor.buy_link = "javascript:alert(1)";
  assert(resolver.sanitizePurchaseLinkPayload(tooDeep) !== undefined, "over-depth payload must fail closed without throwing");
  assert(collectPurchaseUrlEntries(resolver.sanitizePurchaseLinkPayload(tooDeep)).length === 0, "over-depth payload must not retain a purchase URL alias");
});

runCase("oversized_array_payload", () => {
  const oversizedArray = Array.from({ length: resolver.PRODUCT_PURCHASE_LINK_LIMITS.maxPayloadArrayLength + 1 }, () => ({ buy_link: "javascript:alert(1)" }));
  assert(resolver.sanitizePurchaseLinkPayload({ oversizedArray }).oversizedArray === null, "oversized arrays must fail closed");
});

runCase("oversized_object_payload", () => {
  const oversizedObject = Object.fromEntries(
    Array.from({ length: resolver.PRODUCT_PURCHASE_LINK_LIMITS.maxPayloadObjectKeys + 1 }, (_, index) => [`field${index}`, "safe"])
  );
  oversizedObject.buy_link = "javascript:alert(1)";
  assert(resolver.sanitizePurchaseLinkPayload({ oversizedObject }).oversizedObject === null, "oversized objects must fail closed");
});

runCase("cyclic_payload", () => {
  const cyclicPayload = { metadata: { buy_link: "javascript:alert(1)" } };
  cyclicPayload.self = cyclicPayload;
  assert(resolver.sanitizePurchaseLinkPayload(cyclicPayload).self === null, "cyclic payloads must fail closed");
});

runCase("legacy_null_payload", () => {
  assert(Object.keys(resolver.sanitizePremiumReportPurchaseLinks(null)).length === 0, "null legacy premium payload must fail closed");
});

runCase("legacy_array_payload", () => {
  assert(Object.keys(resolver.sanitizePremiumReportPurchaseLinks([])).length === 0, "array legacy premium payload must fail closed");
});

runCase("response_wiring", () => {
  const productSource = readSourceText("lib/product-source.js");
  const analyzeRoute = readSourceText("app/api/analyze/route.js");
  const fullReportRoute = readSourceText("app/api/full-report/route.js");
  const freePage = readSourceText("app/result/page.js");
  const fullPage = readSourceText("app/result/full-report/page.js");
  const publicResultBoundary = readSourceText("lib/analysis-results.js");
  const purchaseAnchorSourceRoot = process.env.SEC_PURCHASE_ANCHOR_SOURCE_ROOT
    ? resolve(process.env.SEC_PURCHASE_ANCHOR_SOURCE_ROOT)
    : root;
  const purchaseAnchorContract = verifyPurchaseAnchorContract({ root: purchaseAnchorSourceRoot });

  assert(
    /getTrustedDirectPurchaseUrl\(\{\s*buyLink:\s*product\.buy_link,/.test(productSource),
    "product source must project direct links through the resolver"
  );
  assert(
    verifyAnalyzePremiumBoundaryWiring(analyzeRoute),
    "analyze must pass both the public response and Premium session payload through the executable purchase-link boundary"
  );
  assert(
    verifyFullReportBoundaryWiring(fullReportRoute),
    "full-report must execute the shared purchase-link boundary for saved and session payloads"
  );
  assert(!freePage.includes("isExactOliveYoungProductLink") && !fullPage.includes("isExactOliveYoungProductLink"), "result pages must not keep duplicate substring validators");
  assert(
    purchaseAnchorContract.expectedSourceCount === 7 &&
      purchaseAnchorContract.discoveredSourceCount === 7 &&
      purchaseAnchorContract.verifiedSourceCount === 7,
    "purchase source anchor exact-set must remain 7/7/7"
  );
  assert(
    purchaseAnchorContract.reachableCount === 0 && purchaseAnchorContract.unreachableCount === 7,
    "purchase anchor reachability partition must remain 0/7"
  );
  assertPurchaseAnchorMutationRejected({
    label: "noreferrer removal",
    sourceRoot: purchaseAnchorSourceRoot,
    mutate(sources) {
      sources["app/result/page.js"] = sources["app/result/page.js"].replace(
        'rel="noopener noreferrer"',
        'rel="noopener"'
      );
      return sources;
    }
  });
  assertPurchaseAnchorMutationRejected({
    label: "unregistered source anchor",
    sourceRoot: purchaseAnchorSourceRoot,
    mutate(sources) {
      sources["app/result/page.js"] += `\nfunction UnregisteredPurchaseAnchor() {\n  const purchaseLink = getPurchaseLinkInfo({}, "en");\n  return <a href={purchaseLink.href || undefined} target="_blank" rel="noopener noreferrer">Buy</a>;\n}\n`;
      return sources;
    }
  });
  assertPurchaseAnchorMutationRejected({
    label: "missing source anchor",
    sourceRoot: purchaseAnchorSourceRoot,
    mutate(sources) {
      const descriptor = purchaseAnchorContract.anchors[0];
      sources[descriptor.file] =
        sources[descriptor.file].slice(0, descriptor.sourceStart) +
        sources[descriptor.file].slice(descriptor.sourceEnd);
      return sources;
    }
  });
  assertPurchaseAnchorMutationRejected({
    label: "raw buy_link binding",
    sourceRoot: purchaseAnchorSourceRoot,
    mutate(sources) {
      sources["app/result/page.js"] = sources["app/result/page.js"].replace(
        "href={purchaseLink.href || undefined}",
        "href={product.buy_link}"
      );
      return sources;
    }
  });
  assertPurchaseAnchorMutationRejected({
    label: "resolver provenance removal",
    sourceRoot: purchaseAnchorSourceRoot,
    mutate(sources) {
      sources["app/result/page.js"] = sources["app/result/page.js"].replace(
        "const purchaseLink = getPurchaseLinkInfo(",
        "const purchaseLink = getUntrustedPurchaseLinkInfo("
      );
      return sources;
    }
  });
  assertPurchaseAnchorMutationRejected({
    label: "runtime reachability change",
    sourceRoot: purchaseAnchorSourceRoot,
    mutate(sources) {
      sources["app/result/page.js"] = sources["app/result/page.js"].replace(
        "  const resultSteps = [];",
        "  const sec07ReachabilityMutation = <CategoryCarousel products={[]} form={{}} />;\n  const resultSteps = [];"
      );
      return sources;
    }
  });
  assert(!/buy_link\s*:\s*product\.buy_link/.test(analyzeRoute), "analysis route must not serialize raw product buy_link");
  assert(!/buy_link\s*:\s*item\?\.buy_link/.test(analyzeRoute), "premium alternatives must not serialize raw buy_link");
  const publicProductProjectionStart = publicResultBoundary.indexOf("function projectPublicProduct");
  const publicProductProjectionEnd = publicResultBoundary.indexOf("function projectPublicCategoryPick", publicProductProjectionStart);
  assert(publicProductProjectionStart >= 0 && publicProductProjectionEnd > publicProductProjectionStart, "public product DTO projection must exist");
  assert(
    !publicResultBoundary.slice(publicProductProjectionStart, publicProductProjectionEnd).includes("buy_link"),
    "public result DTO must not expose purchase URLs"
  );
});

finalizeCaseExecution();
console.log(`SEC07_PRODUCT_LINK_BOUNDARY=PASS checked=${checkedFiles.join(",")}`);
