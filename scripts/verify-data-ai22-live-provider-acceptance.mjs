#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  PRODUCT_QUERY_BETA_QUALITY_GATES
} from "../lib/product-query-beta-quality-evaluation-contract.mjs";
import {
  DATA_AI20_MAX_APPROVED_ACCOUNTS
} from "../lib/product-query-authenticated-beta-controlled-activation.mjs";

let assertions = 0;
function check(condition, message) {
  assert.ok(condition, message);
  assertions += 1;
}

const corpus = JSON.parse(
  readFileSync("fixtures/data-ai22/product-query-quality-cases.json", "utf8")
);
const service = readFileSync(
  "lib/server/product-query-beta-quality-live-service.js",
  "utf8"
);
const route = readFileSync(
  "app/api/my/product-query-beta/quality-evaluation/route.js",
  "utf8"
);
const workflow = readFileSync(
  ".github/workflows/data-ai22-live-provider-acceptance.yml",
  "utf8"
);

check(
  corpus.cases.length === 30 &&
    corpus.cases.length === PRODUCT_QUERY_BETA_QUALITY_GATES.corpusCaseCount,
  "live acceptance must bind the complete 30-case DATA-AI22 corpus"
);

check(
  service.includes("DATA_AI22_LIVE_BATCH_SIZE = 5") &&
    service.includes("DATA_AI22_LIVE_BATCH_COUNT = 6") &&
    service.includes("slice(start, start + DATA_AI22_LIVE_BATCH_SIZE)"),
  "live acceptance must expose exactly six fixed five-case batches"
);

check(
  service.includes("testCase.query") &&
    service.includes("runNaturalLanguageProductQueryShadow") &&
    service.includes("evaluateProductQueryQualityObservation"),
  "live service must execute only source-controlled fixture queries through the real provider shadow path"
);

check(
  service.includes("Promise.all(cases.map") &&
    service.includes("limit: 5"),
  "each bounded batch must evaluate five cases concurrently with the existing result bound"
);

check(
  service.includes("productResultsReturned: false") &&
    service.includes("rawAccountIdReturned: false") &&
    service.includes("accountHashReturned: false") &&
    service.includes("accessTokenReturned: false") &&
    service.includes('persistence: "none"'),
  "live service must declare non-sensitive output and no persistence"
);

check(
  !service.includes("writeSafeLog") &&
    !service.includes("recommendation_logs") &&
    !service.includes(".insert(") &&
    !service.includes(".upsert("),
  "live service must not add logging or persistence writes"
);

check(
  route.includes('authContext.transport !== "cookie"') &&
    route.includes("authContext.user?.is_anonymous !== false") &&
    route.includes("evaluateProductQueryAuthenticatedBetaRuntime") &&
    route.includes("evaluateProductQueryAuthenticatedBetaControlledActivation"),
  "live route must require cookie-authenticated existing beta cohort access"
);

check(
  DATA_AI20_MAX_APPROVED_ACCOUNTS === 3,
  "live acceptance must inherit the maximum three-account cohort"
);

check(
  route.includes("export const maxDuration = 30") &&
    route.includes('keys[0] !== "batch"') &&
    route.includes('return json({ ok: false, error: "invalid_batch" }, 400)'),
  "live route must accept only one bounded batch selector and no arbitrary query payload"
);

check(
  !route.includes("request.text(") &&
    !route.includes("request.json(") &&
    !route.includes("body.query") &&
    !route.includes("searchParams.get(\"query\")"),
  "live route must not accept raw query input"
);

check(
  route.includes("VERCEL_GIT_COMMIT_SHA") &&
    route.includes("productResultsReturned: false") &&
    route.includes("rawAccountIdReturned: false") &&
    route.includes("accountHashReturned: false") &&
    route.includes("accessTokenReturned: false") &&
    route.includes("persisted: false"),
  "receipt must bind exact deployment while excluding identity/token/product-result material"
);

check(
  !route.includes("authContext.user.id,") &&
    !route.includes("subjectHash") &&
    !route.includes("accessToken:") &&
    !route.includes("query: testCase.query"),
  "response construction must not return account identity, hash, token, or raw fixture query"
);

check(
  workflow.includes("timeout-minutes: 5") &&
    workflow.includes("timeout-minutes: 7"),
  "DATA-AI22 live acceptance CI must stay below the long-CI threshold"
);

check(
  workflow.includes("/api/my/product-query-beta/quality-evaluation?batch=1") &&
    workflow.includes('test "$status" = "401"'),
  "exact Production preflight must prove anonymous live-quality access remains closed"
);

check(
  !workflow.includes("BEJEWELY_PRODUCT_QUERY_BETA_APPROVED_ACCOUNT_HASHES") &&
    !workflow.includes("DATA_AI_HOSTED_PREVIEW_ACCESS_TOKEN"),
  "CI must not materialize cohort hashes or retired bearer tokens"
);

console.log(
  `DATA-AI22 live provider acceptance verifier: PASS (${assertions} assertions)`
);
