import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(join(repoRoot, path), "utf8");
const listing = JSON.parse(read("docs/store/mobile-store-listing-final.json"));
const support = read("components/support/SupportPanel.jsx");
const koreanPage = read("app/support/page.js");
const englishPage = read("app/en/support/page.js");

assert.equal(listing.scope.appStoreSupportUrlFrozen, true);
assert.equal(listing.appStore.supportUrl.status, "repository_route_implemented_external_contact_pending");
assert.equal(listing.appStore.supportUrl.value, "https://k-beauty-two.vercel.app/support");
assert.equal(listing.appStore.supportUrl.englishValue, "https://k-beauty-two.vercel.app/en/support");
assert.equal(listing.appStore.supportUrl.contactEnvironmentKey, "NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL");
assert.equal(listing.appStore.supportUrl.contactStatus, "external_pending");
assert.equal(listing.repositoryPending.includes("app_store_support_route_and_url"), false);
assert.ok(listing.externalPending.includes("public_support_contact_configuration"));

assert.match(koreanPage, /SupportPanel/);
assert.match(koreanPage, /locale="ko"/);
assert.match(koreanPage, /고객 지원 \| BEJEWELY/);
assert.match(englishPage, /SupportPanel/);
assert.match(englishPage, /locale="en"/);
assert.match(englishPage, /Support \| BEJEWELY/);

assert.match(support, /NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL/);
assert.match(support, /data-support-contact="email"/);
assert.match(support, /data-support-contact="missing"/);
assert.match(support, /mailto:/);
assert.match(support, /\/privacy/);
assert.match(support, /\/en\/privacy/);
assert.match(support, /\/account-deletion/);
assert.match(support, /\/en\/account-deletion/);
assert.doesNotMatch(support, /@gmail\.com|@naver\.com|@daum\.net|@outlook\.com/i);
assert.doesNotMatch(support, /MOBILE-|native shell|server authority|Supabase redirect allow-list/i);

console.log("MOBILE_19A_PUBLIC_SUPPORT_ROUTES=PASS");
console.log("MOBILE_19A_SUPPORT_CONTACT_ENV_BOUNDARY=PASS");
console.log("MOBILE_19A_APP_STORE_SUPPORT_URL=FROZEN_EXTERNAL_CONTACT_PENDING");
