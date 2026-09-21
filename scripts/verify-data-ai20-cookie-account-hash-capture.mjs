#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync(
  "app/api/my/product-query-beta/account-hash/route.js",
  "utf8"
);

assert.ok(
  route.includes("resolveRouteSupabaseAuth(request)") &&
    route.includes('authContext.transport !== "cookie"') &&
    route.includes("authContext.user?.is_anonymous !== false"),
  "account-hash capture must require a permanent cookie-authenticated user"
);

assert.ok(
  route.includes("hashProductQueryBetaSubject(authContext.user.id)") &&
    route.includes('source: "current_cookie_authenticated_user"'),
  "account-hash capture must derive SHA-256 from the current cookie-authenticated user"
);

assert.ok(
  route.includes("rawAccountIdReturned: false") &&
    route.includes("persisted: false") &&
    !route.includes("authContext.user.id,") &&
    !route.includes("userId:") &&
    !route.includes("rawAccountId:"),
  "route must not return or persist raw account identifiers"
);

assert.ok(
  route.includes('process.env.VERCEL_ENV') &&
    route.includes("BEJEWELY_PRODUCT_QUERY_BETA_RUNTIME_AUTHORIZED"),
  "temporary enrollment route must remain Production/beta-runtime gated"
);

console.log("DATA-AI20 cookie account-hash capture verifier: PASS");
