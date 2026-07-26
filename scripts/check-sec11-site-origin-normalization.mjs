import assert from "node:assert/strict";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const siteOrigin = await import(
  pathToFileURL(resolve(root, "lib/canonical-site-origin.js")).href
);
const signOutPolicy = await import(
  pathToFileURL(resolve(root, "lib/security/signout-request-policy.js")).href
);

const EXPECTED_ORIGIN = "https://app.example.com";

for (const configuredValue of [EXPECTED_ORIGIN, `${EXPECTED_ORIGIN}/`]) {
  const env = {
    VERCEL_ENV: "production",
    NEXT_PUBLIC_SITE_URL: configuredValue
  };
  const normalizedOrigin = siteOrigin.getNormalizedConfiguredProductionOrigin(env);
  const canonicalOrigin = siteOrigin.getCanonicalProductionOrigin(env);
  const runtimeContract = signOutPolicy.getSignOutRuntimeOriginContract({
    vercelEnvironment: env.VERCEL_ENV,
    configuredProductionOrigin: normalizedOrigin,
    canonicalProductionOrigin: canonicalOrigin
  });

  assert.equal(normalizedOrigin, EXPECTED_ORIGIN);
  assert.equal(canonicalOrigin, EXPECTED_ORIGIN);
  assert.equal(runtimeContract.isHostedProduction, true);
  assert.equal(runtimeContract.canonicalProductionOrigin, EXPECTED_ORIGIN);
}

for (const configuredValue of [
  `${EXPECTED_ORIGIN}//`,
  `${EXPECTED_ORIGIN}/path`,
  `${EXPECTED_ORIGIN}/path/`,
  `${EXPECTED_ORIGIN}?query=1`,
  `${EXPECTED_ORIGIN}#fragment`,
  "http://app.example.com",
  "https://localhost",
  ` ${EXPECTED_ORIGIN}`,
  `${EXPECTED_ORIGIN} `
]) {
  const env = {
    VERCEL_ENV: "production",
    NEXT_PUBLIC_SITE_URL: configuredValue
  };
  const normalizedOrigin = siteOrigin.getNormalizedConfiguredProductionOrigin(env);
  const canonicalOrigin = siteOrigin.getCanonicalProductionOrigin(env);
  const runtimeContract = signOutPolicy.getSignOutRuntimeOriginContract({
    vercelEnvironment: env.VERCEL_ENV,
    configuredProductionOrigin: normalizedOrigin,
    canonicalProductionOrigin: canonicalOrigin
  });

  assert.equal(
    runtimeContract.canonicalProductionOrigin,
    null,
    `invalid production origin accepted: ${configuredValue}`
  );
}

const redirect = siteOrigin.getCanonicalProductionRedirectUrl(
  "https://preview.example.com/my?tab=reports",
  {
    VERCEL_ENV: "production",
    NEXT_PUBLIC_SITE_URL: `${EXPECTED_ORIGIN}/`
  }
);
assert.equal(redirect?.href, `${EXPECTED_ORIGIN}/my?tab=reports`);

console.log("SEC11_SITE_ORIGIN_NORMALIZATION=PASS");
