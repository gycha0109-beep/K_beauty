#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  PRODUCT_QUERY_AUTHENTICATED_BETA_UX,
  PRODUCT_QUERY_AUTHENTICATED_BETA_UX_CONTRACT_VERSION
} from "../lib/product-query-authenticated-beta-ux-contract.mjs";

let assertions = 0;
function check(condition, message) {
  assert.ok(condition, message);
  assertions += 1;
}

const contract = PRODUCT_QUERY_AUTHENTICATED_BETA_UX;

check(
  contract.contractVersion === PRODUCT_QUERY_AUTHENTICATED_BETA_UX_CONTRACT_VERSION &&
    contract.contractVersion === "product-query-authenticated-beta-ux-v1" &&
    contract.phase === "DATA-AI23",
  "DATA-AI23 beta UX contract must be frozen"
);

check(
  contract.accessBoundary.authenticatedOnly === true &&
    contract.accessBoundary.explicitServerSideBetaEligibilityRequired === true &&
    contract.accessBoundary.clientMayChooseEligibility === false &&
    contract.accessBoundary.anonymousTraffic === false &&
    contract.accessBoundary.automaticTrafficSampling === false &&
    contract.accessBoundary.publicSearchCutover === false,
  "beta UX must remain authenticated and server-side cohort gated"
);

check(
  contract.authorityBoundary.providerRole === "intent_parsing_only" &&
    contract.authorityBoundary.providerProductSelection === false &&
    contract.authorityBoundary.providerRankingAuthority === false &&
    contract.authorityBoundary.deterministicRankingAuthority ===
      "existing_recommendation_engine" &&
    contract.authorityBoundary.queryProvenance === "query_only" &&
    contract.authorityBoundary.profileMerge === false &&
    contract.authorityBoundary.savedProfileRead === false &&
    contract.authorityBoundary.historyRead === false,
  "DATA-AI23 must not expand recommendation or profile authority"
);

check(
  contract.dataBoundary.persistence === "none" &&
    contract.dataBoundary.rawQueryPersistence === false &&
    contract.dataBoundary.recommendationLogWrite === false &&
    contract.dataBoundary.productionWrite === false &&
    contract.dataBoundary.accessTokenPersistence === false &&
    contract.dataBoundary.rawAccountIdPersistence === false &&
    contract.dataBoundary.accountHashPersistence === false &&
    contract.dataBoundary.telemetryPersistence === false,
  "DATA-AI23 must remain non-persistent"
);

check(
  contract.uxBoundary.entrySurface === "my_dashboard" &&
    contract.uxBoundary.hiddenWhenIneligible === true &&
    contract.uxBoundary.boundedResultContract === "product-query-preview-v1" &&
    contract.uxBoundary.maxQueryLength === 500 &&
    contract.uxBoundary.maxResultCount === 5 &&
    contract.uxBoundary.betaFailureIsolatedFromDashboard === true &&
    contract.uxBoundary.existingPostRouteReused === true &&
    contract.uxBoundary.newEligibilityRouteAdded === false,
  "DATA-AI23 UX scope must stay bounded to the existing beta route"
);

const dashboard = readFileSync("lib/my/dashboard.js", "utf8");
check(
  dashboard.includes("isProductQueryBetaAvailable") &&
    dashboard.includes("evaluateProductQueryAuthenticatedBetaControlledActivation") &&
    dashboard.includes("evaluateProductQueryAuthenticatedBetaStaticGate") &&
    dashboard.includes("evaluateProductQueryAuthenticatedBetaRuntime") &&
    dashboard.includes("subject: user.id") &&
    dashboard.includes("productQueryBetaAvailable: isProductQueryBetaAvailable(user)"),
  "My dashboard must compute beta eligibility only on the server"
);

const myDashboard = readFileSync("components/my/MyDashboard.jsx", "utf8");
check(
  myDashboard.includes('import ProductQueryBetaCard from "@/components/my/ProductQueryBetaCard"') &&
    myDashboard.includes("productQueryBetaAvailable") &&
    myDashboard.includes("productQueryBetaAvailable ?") &&
    myDashboard.includes("<ProductQueryBetaCard copy={copy.productQueryBeta} />"),
  "My dashboard must render the beta card only for eligible users"
);

const card = readFileSync("components/my/ProductQueryBetaCard.jsx", "utf8");
check(
  card.includes('fetch("/api/my/product-query-beta"') &&
    card.includes('method: "POST"') &&
    card.includes("JSON.stringify({ query: normalizedQuery })") &&
    card.includes("maxLength={500}") &&
    card.includes("payload.result") &&
    card.includes("product.whyPicked") &&
    card.includes("product.cautionNote"),
  "beta card must reuse the existing bounded POST contract"
);

for (const forbidden of [
  "localStorage",
  "sessionStorage",
  "BEJEWELY_PRODUCT_QUERY_BETA_APPROVED_ACCOUNT_HASHES",
  "accessToken",
  "accountHash",
  "rawAccountId",
  "console.log",
  "navigator.sendBeacon"
]) {
  check(!card.includes(forbidden), `client beta card must not persist or emit sensitive material: ${forbidden}`);
}

const route = readFileSync("app/api/my/product-query-beta/route.js", "utf8");
check(
  route.includes("export async function POST(request)") &&
    !route.includes("export async function GET") &&
    route.includes("explicitServerSideBetaEligibilityRequired: true") &&
    route.includes("automaticTrafficSampling: false") &&
    route.includes("publicSearchCutover: false") &&
    route.includes("persisted: false"),
  "existing beta route must remain POST-only and fail-closed"
);

const config = JSON.parse(readFileSync("vercel.json", "utf8"));
check(
  config?.env?.BEJEWELY_PRODUCT_QUERY_BETA_ENABLED === "true" &&
    config?.env?.BEJEWELY_PRODUCT_QUERY_BETA_RUNTIME_AUTHORIZED === "true" &&
    config?.env?.BEJEWELY_PRODUCT_QUERY_BETA_EMERGENCY_DISABLE === "false" &&
    config?.env?.BEJEWELY_PRODUCT_QUERY_BETA_AUTOMATIC_TRAFFIC_SAMPLING === "false" &&
    config?.env?.BEJEWELY_PRODUCT_QUERY_BETA_PUBLIC_SEARCH_CUTOVER === "false" &&
    config?.env?.BEJEWELY_PRODUCT_QUERY_BETA_PERSISTENCE === "none" &&
    !Object.hasOwn(config.env, "BEJEWELY_PRODUCT_QUERY_BETA_APPROVED_ACCOUNT_HASHES"),
  "source-safe limited-beta activation manifest must remain unchanged"
);

const copy = readFileSync("lib/my/i18n.js", "utf8");
check(
  (copy.match(/productQueryBeta:/g) || []).length === 2 &&
    copy.includes("입력 내용과 추천 결과를 저장하지 않습니다.") &&
    copy.includes("Your query and recommendation results are not persisted."),
  "beta UX must provide Korean and English non-persistence copy"
);

check(
  contract.rolloutBoundary.cohortExpansion === false &&
    contract.rolloutBoundary.generalAvailability === false &&
    contract.rolloutBoundary.publicActivation === false &&
    contract.nextRequiredPhase ===
      "data_ai24_privacy_safe_operational_observability",
  "DATA-AI23 must not perform cohort expansion or GA"
);

console.log(
  `DATA-AI23 authenticated beta UX verifier: PASS (${assertions} assertions)`
);
