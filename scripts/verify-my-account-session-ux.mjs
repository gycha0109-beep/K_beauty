#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  evaluateSignOutRequest,
  getSignOutPolicyContract,
  getSignOutRedirectLocation
} from "../lib/security/signout-request-policy.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function includes(source, needle, label) {
  assert.ok(source.includes(needle), `${label}: missing ${JSON.stringify(needle)}`);
}

const myMenu = read("components/my/MyDashboardMenu.jsx");
const appMenu = read("components/navigation/AppHamburgerMenu.jsx");
const authNav = read("components/auth/AuthNav.jsx");
const signOutPolicy = read("lib/security/signout-request-policy.js");
const health = read("scripts/verify-current-main-health.mjs");

// My navigation stays locale-aware and exposes account identity only through the scoped My menu.
includes(myMenu, 'href: "/my"', "KO My navigation");
includes(myMenu, 'href: "/en/my"', "EN My navigation");
includes(myMenu, "href: copy.paths.home", "locale-aware new-analysis navigation");
includes(myMenu, "showAccountIdentity", "My account identity opt-in");
includes(appMenu, "showAccountIdentity = false", "account identity default-off boundary");
includes(appMenu, "showAccountIdentity={showAccountIdentity}", "account identity transport");

// The identity is the authenticated session email and is not added to any dashboard API payload.
includes(authNav, 'typeof user.email === "string" ? user.email.trim() : ""', "session email identity");
includes(authNav, "showAccountIdentity && accountEmail", "scoped session identity rendering");
includes(authNav, "{accountEmail}", "account identity display");

// Logout remains POST-only from the UI and preserves locale through a bounded enum-like query.
includes(authNav, 'const signOutAction = isEnglish ? "/api/auth/signout?locale=en" : "/api/auth/signout?locale=ko";', "bounded logout locale action");
includes(authNav, '<form method="post" action={signOutAction}>', "POST logout form");

assert.equal(
  getSignOutRedirectLocation("https://bejewely.test/api/auth/signout?locale=en"),
  "/en",
  "English logout must return to /en"
);
assert.equal(
  getSignOutRedirectLocation("https://bejewely.test/api/auth/signout?locale=ko"),
  "/",
  "Korean logout must return to /"
);
assert.equal(
  getSignOutRedirectLocation("https://bejewely.test/api/auth/signout?locale=ja"),
  "/",
  "unsupported locale must fail closed to /"
);
assert.equal(
  getSignOutRedirectLocation("https://bejewely.test/api/auth/signout?returnTo=https://evil.example"),
  "/",
  "arbitrary redirect input must never be reflected"
);
assert.equal(getSignOutRedirectLocation("not-a-url"), "/", "invalid URL must fail closed");

const policyContract = getSignOutPolicyContract();
assert.equal(policyContract.path, "/api/auth/signout");
assert.equal(policyContract.redirectLocation, "/");
assert.deepEqual(policyContract.redirectLocations, ["/", "/en"]);
assert.equal(policyContract.allowedMethods, "POST, OPTIONS");

const sameOriginDecision = evaluateSignOutRequest({
  requestUrl: "https://bejewely.test/api/auth/signout?locale=en",
  requestHeaders: new Headers({
    Origin: "https://bejewely.test",
    "Sec-Fetch-Site": "same-origin"
  })
});
assert.equal(sameOriginDecision.allowed, true, "same-origin POST contract must remain allowed");

const crossOriginDecision = evaluateSignOutRequest({
  requestUrl: "https://bejewely.test/api/auth/signout?locale=en",
  requestHeaders: new Headers({
    Origin: "https://evil.example",
    "Sec-Fetch-Site": "cross-site"
  })
});
assert.equal(crossOriginDecision.allowed, false, "cross-origin signout must remain denied");

const decisionIndex = signOutPolicy.indexOf("const decision = evaluateSignOutRequest");
const signOutIndex = signOutPolicy.indexOf('supabase.auth.signOut({ scope: "local" })');
assert.ok(decisionIndex >= 0 && signOutIndex > decisionIndex, "origin decision must precede session mutation");
includes(signOutPolicy, "if (!decision.allowed)", "fail-closed signout origin gate");
includes(signOutPolicy, "Location: getSignOutRedirectLocation(request?.url)", "bounded locale redirect use");

// MY-5 must not grow into destructive account/data management.
const changedSurface = `${myMenu}\n${appMenu}\n${authNav}`;
assert.doesNotMatch(
  changedSurface,
  /deleteAccount|delete-account|account\/delete|회원\s*탈퇴|계정\s*삭제|데이터\s*전체\s*삭제/i,
  "MY-5 must not introduce destructive account controls"
);

includes(
  health,
  'run("My account/session UX contract", node, ["--experimental-default-type=module", "scripts/verify-my-account-session-ux.mjs"]);',
  "canonical health integration"
);

console.log("MY ACCOUNT SESSION UX VERIFIER: PASS");
