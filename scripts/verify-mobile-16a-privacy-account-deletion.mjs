import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mobileRoot = join(repoRoot, "apps", "mobile");
const read = (...parts) => readFileSync(join(repoRoot, ...parts), "utf8");
const mobileRead = (...parts) => readFileSync(join(mobileRoot, ...parts), "utf8");

const readiness = JSON.parse(mobileRead("store-readiness.json"));
const deletionRoute = read("app", "api", "my", "account", "route.js");
const deletionService = read("lib", "auth", "account-deletion.js");
const webDeletionPanel = read("components", "account", "AccountDeletionPanel.jsx");
const privacyPolicy = read("components", "legal", "PrivacyPolicy.jsx");
const nativeAuth = mobileRead("lib", "auth.ts");
const nativeSupabase = mobileRead("lib", "supabase.ts");
const nativeDeletion = mobileRead("lib", "account-deletion.ts");
const nativeDeletionCard = mobileRead("components", "NativeAccountDeletionCard.tsx");
const nativeLayout = mobileRead("app", "_layout.tsx");
const nativePrivacyScreen = mobileRead("app", "privacy-account.tsx");

for (const path of [
  ["app", "privacy", "page.js"],
  ["app", "en", "privacy", "page.js"],
  ["app", "account-deletion", "page.js"],
  ["app", "en", "account-deletion", "page.js"]
]) {
  assert.ok(existsSync(join(repoRoot, ...path)), `Missing public MOBILE-16A route: ${path.join("/")}`);
}

assert.equal(readiness.mobile16AContract?.privacyPolicyUrl, "https://k-beauty-two.vercel.app/privacy");
assert.equal(readiness.mobile16AContract?.externalAccountDeletionUrl, "https://k-beauty-two.vercel.app/account-deletion");
assert.equal(readiness.mobile16AContract?.accountDeletionApiPath, "/api/my/account");
assert.equal(readiness.mobile16AContract?.mobilePrivacyAccountPath, "/privacy-account");
assert.equal(readiness.mobile16AContract?.authDeleteMode, "hard");
assert.deepEqual(readiness.mobile16AContract?.explicitCustomerPurgeTables, [
  "analysis_results",
  "recommendation_logs",
  "analysis_requests",
  "profiles"
]);
assert.equal(readiness.mobile16AContract?.privacyContactEnvironmentKey, "NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL");
assert.ok(readiness.externalBlockers.some((item) => item.id === "apple_sign_in_token_revocation_authority" && item.status === "external_pending"));
assert.ok(readiness.externalBlockers.some((item) => item.id === "privacy_contact" && item.status === "external_pending"));

assert.match(deletionRoute, /resolveRouteSupabaseAuth\(request\)/);
assert.match(deletionRoute, /authContext\.transport === ["']cookie["']/);
assert.match(deletionRoute, /evaluateSignOutRequest/);
assert.match(deletionRoute, /body\?\.confirmation !== ["']delete_account["']/);
assert.match(deletionRoute, /deleteVerifiedAccount\(authContext\.user/);
assert.doesNotMatch(deletionRoute, /deleteVerifiedAccount\(\s*body/s);
assert.doesNotMatch(deletionRoute, /body\?\.(?:userId|user_id)/);
assert.doesNotMatch(deletionRoute, /body\.(?:userId|user_id)/);
assert.match(deletionRoute, /appleAuthorizationCode/);
assert.match(deletionRoute, /status: 428/);

for (const table of ["analysis_results", "recommendation_logs", "analysis_requests", "profiles"]) {
  assert.ok(deletionService.includes(`table: "${table}"`), `Explicit purge table missing: ${table}`);
}
assert.match(deletionService, /auth\.admin\.deleteUser\(verifiedUser\.id, false\)/);
assert.match(deletionService, /https:\/\/appleid\.apple\.com\/auth\/token/);
assert.match(deletionService, /https:\/\/appleid\.apple\.com\/auth\/oauth2\/v2\/revoke/);
assert.match(deletionService, /APPLE_SIGN_IN_KEY_ID/);
assert.match(deletionService, /APPLE_SIGN_IN_PRIVATE_KEY/);
assert.match(deletionService, /MOBILE_IOS_APPLE_TEAM_ID/);
assert.match(deletionService, /createPrivateKey/);
assert.match(deletionService, /dsaEncoding:\s*["']ieee-p1363["']/);
assert.match(deletionService, /apple_reauthorization_required/);
assert.match(deletionService, /await revokeAppleAuthorization\([\s\S]*?await purgeCustomerData/);

assert.match(webDeletionPanel, /fetch\(["']\/api\/my\/account["']/);
assert.match(webDeletionPanel, /method:\s*["']DELETE["']/);
assert.match(webDeletionPanel, /credentials:\s*["']same-origin["']/);
assert.match(webDeletionPanel, /confirmation:\s*["']delete_account["']/);

assert.match(nativeAuth, /getNativeAppleDeletionAuthorizationCode/);
assert.match(nativeAuth, /credential\.authorizationCode/);
assert.match(nativeAuth, /clearNativeSessionAfterAccountDeletion/);
assert.match(nativeSupabase, /NATIVE_AUTH_STORAGE_KEY\s*=\s*["']bejewely-native-auth["']/);
assert.match(nativeSupabase, /clearMobileSupabaseSessionStorage/);
assert.match(nativeSupabase, /nativeSessionStorage\.removeItem\(NATIVE_AUTH_STORAGE_KEY\)/);
assert.doesNotMatch(nativeAuth, /APPLE_SIGN_IN_PRIVATE_KEY/);
assert.doesNotMatch(nativeDeletion, /APPLE_SIGN_IN_PRIVATE_KEY/);
assert.doesNotMatch(nativeDeletionCard, /APPLE_SIGN_IN_PRIVATE_KEY/);

assert.match(nativeDeletion, /Authorization:\s*`Bearer \$\{session\.access_token\}`/);
assert.match(nativeDeletion, /confirmation:\s*["']delete_account["']/);
assert.match(nativeDeletion, /nativeAccountDeletionNeedsAppleReauthorization/);
assert.match(nativeDeletionCard, /mobile-account-delete/);
assert.match(nativeDeletionCard, /getNativeAppleDeletionAuthorizationCode/);
assert.match(nativeDeletionCard, /deleteNativeAccount/);
assert.match(nativeDeletionCard, /clearNativeSessionAfterAccountDeletion/);
assert.match(nativeDeletionCard, /\/privacy/);
assert.match(nativeDeletionCard, /\/account-deletion/);
assert.match(nativeLayout, /mobile-my-privacy-account/);
assert.match(nativeLayout, /router\.push\(["']\/privacy-account["']\)/);
assert.match(nativeLayout, /Tabs\.Screen name=["']privacy-account["']/);
assert.match(nativePrivacyScreen, /NativeAccountDeletionCard/);

for (const provider of ["Supabase", "Google", "Apple", "OpenAI", "Vercel"]) {
  assert.ok(privacyPolicy.includes(provider), `Privacy policy must disclose ${provider}`);
}
assert.match(privacyPolicy, /NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL/);
assert.match(privacyPolicy, /data-privacy-contact-state=["']missing["']/);
assert.match(privacyPolicy, /계정 삭제 페이지/);
assert.match(privacyPolicy, /Account deletion page/);

console.log("MOBILE_16A_PRIVACY_ACCOUNT_DELETION_SOURCE=PASS");
console.log("MOBILE_16A_APPLE_REVOCATION_AUTHORITY=EXTERNAL_PENDING_FAIL_CLOSED");
console.log("MOBILE_16A_PRIVACY_CONTACT=EXTERNAL_PENDING_FAIL_VISIBLE");
