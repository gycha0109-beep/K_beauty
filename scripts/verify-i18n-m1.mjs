import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFileSync(join(root, relativePath), "utf8");

const productSource = read("lib/product-source.js");
const productApi = read("app/api/current-products/products/route.js");
const nativeClient = read("apps/mobile/features/premium/premium-client.ts");
const nativeSelector = read("apps/mobile/features/premium/NativeCurrentProductsSelector.tsx");
const nativeShell = read("apps/mobile/lib/mobile-shell.tsx");
const premiumWeb = read("app/result/full-report/page.js");
const webSelector = read("components/current-products/CurrentProductsSelector.jsx");

assert.match(productSource, /const CURRENT_PRODUCT_OPTION_FIELDS\s*=\s*"[^"]*brand_en, name_en[^"]*"/);
assert.match(productSource, /\.\.\.mapCurrentProductOption\(product\)/);
assert.match(productSource, /brand_en:\s*typeof product\.brand_en/);
assert.match(productSource, /name_en:\s*typeof product\.name_en/);
assert.match(productApi, /fields:\s*\[[^\]]*"brand_en",\s*"name_en"/);
assert.match(nativeClient, /brandEn:\s*typeof product\.brand_en/);
assert.match(nativeClient, /nameEn:\s*typeof product\.name_en/);
assert.match(nativeSelector, /locale === "en" \? product\.brandEn \|\| product\.brand : product\.brand/);
assert.match(nativeSelector, /locale === "en" \? product\.nameEn \|\| product\.name : product\.name/);
assert.match(nativeSelector, /selection\.productId === product\.id/);
assert.match(nativeShell, /SecureStore\.getItemAsync\(LOCALE_PREFERENCE_KEY\)/);
assert.match(nativeShell, /SecureStore\.setItemAsync\(LOCALE_PREFERENCE_KEY, locale\)/);
assert.match(nativeShell, /userSelectedLocale\.current = true/);
assert.match(nativeShell, /<MobileShellContext\.Provider value=\{value\}>\{children\}<\/MobileShellContext\.Provider>/);
assert.match(premiumWeb, /function getLocalePath\(pathname, nextLocale, savedReportId = null\)/);
assert.match(premiumWeb, /encodeURIComponent\(savedReportId\)/);
assert.match(premiumWeb, /getLocalePath\(pathname, "ko", savedReportId\)/);
assert.match(premiumWeb, /getLocalePath\(pathname, "en", savedReportId\)/);

assert.match(webSelector, /locale === "en" \? product\.brand_en \|\| product\.brand : product\.brand/);
assert.match(webSelector, /locale === "en" \? product\.name_en \|\| product\.name : product\.name/);
assert.ok(!webSelector.includes("createBrowserSupabaseClient"), "current-products API already provides display names");
assert.ok(!webSelector.includes("localizeProductsForEnglish"), "no duplicate product name fetch");
console.log("I18N_KO_EN_M1_STATIC=PASS");
