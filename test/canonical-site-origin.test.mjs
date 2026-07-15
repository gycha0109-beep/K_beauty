import assert from "node:assert/strict";
import test from "node:test";
import {
  getCanonicalProductionOrigin,
  getCanonicalProductionRedirectUrl
} from "../lib/canonical-site-origin.js";

const productionEnv = {
  VERCEL_ENV: "production",
  NEXT_PUBLIC_SITE_URL: "https://beauty.example.com"
};

test("production deployment aliases redirect to the configured canonical origin", () => {
  const redirectUrl = getCanonicalProductionRedirectUrl(
    "https://deployment-alias.vercel.app/en/result?step=full",
    productionEnv
  );

  assert.equal(
    redirectUrl?.href,
    "https://beauty.example.com/en/result?step=full"
  );
});

test("canonical production requests and preview deployments do not redirect", () => {
  assert.equal(
    getCanonicalProductionRedirectUrl(
      "https://beauty.example.com/result",
      productionEnv
    ),
    null
  );
  assert.equal(
    getCanonicalProductionRedirectUrl(
      "https://deployment-alias.vercel.app/result",
      { ...productionEnv, VERCEL_ENV: "preview" }
    ),
    null
  );
});

test("canonical production origin must be a credential-free HTTPS origin", () => {
  assert.equal(
    getCanonicalProductionOrigin({
      VERCEL_ENV: "production",
      NEXT_PUBLIC_SITE_URL: "http://beauty.example.com"
    }),
    null
  );
  assert.equal(
    getCanonicalProductionOrigin({
      VERCEL_ENV: "production",
      NEXT_PUBLIC_SITE_URL: "https://user:secret@beauty.example.com"
    }),
    null
  );
});
