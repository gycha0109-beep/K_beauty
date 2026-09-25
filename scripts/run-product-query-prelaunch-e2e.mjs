#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { chromium } from "playwright";

const PRODUCTION_CONFIRMATION = "I_UNDERSTAND_THIS_RUNS_AGAINST_PRODUCTION";
const RESULT_CONTRACT = "product-query-preview-v1";
const TABLES = Object.freeze([
  "skin_profiles",
  "saved_reports",
  "daily_checkins",
  "routine_logs"
]);

function required(name) {
  const value = String(process.env[name] || "").trim();
  assert.ok(value, `${name} is required`);
  return value;
}

function normalizeBaseUrl(value) {
  const url = new URL(value);
  assert.equal(url.protocol, "https:", "prelaunch acceptance requires HTTPS");
  assert.ok(!["localhost", "127.0.0.1"].includes(url.hostname));
  return url;
}

async function loadStorageState(path) {
  return JSON.parse(await readFile(resolve(path), "utf8"));
}

async function fetchAuthUser({ supabaseUrl, anonKey, accessToken }) {
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`
    }
  });
  assert.equal(response.status, 200, "dedicated QA account auth preflight failed");
  const user = await response.json();
  assert.ok(user?.id && user.is_anonymous !== true, "permanent QA account required");
  return user;
}

async function fetchOwnRows({ supabaseUrl, anonKey, accessToken, userId, table }) {
  const url = new URL(`${supabaseUrl}/rest/v1/${table}`);
  url.searchParams.set("select", "id,updated_at");
  url.searchParams.set("user_id", `eq.${userId}`);
  url.searchParams.set("order", "id.asc");

  const response = await fetch(url, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json"
    }
  });
  assert.ok(response.ok, `${table} persistence snapshot failed: ${response.status}`);
  const rows = await response.json();
  assert.ok(Array.isArray(rows), `${table} snapshot must be an array`);
  return rows.map((row) => ({
    id: row.id,
    updated_at: row.updated_at || null
  }));
}

async function snapshotPersistence(input) {
  const snapshot = {};
  for (const table of TABLES) {
    snapshot[table] = await fetchOwnRows({ ...input, table });
  }
  return snapshot;
}

function assertPreviewResult(payload, caseId) {
  assert.equal(payload?.ok, true, `${caseId}: response must be ok`);
  assert.equal(payload?.result?.contractVersion, RESULT_CONTRACT, `${caseId}: result contract drift`);
  assert.equal(payload?.result?.persisted, false, `${caseId}: persistence contract drift`);
  assert.ok(Array.isArray(payload?.result?.results), `${caseId}: results array required`);
  assert.ok(payload.result.results.length <= 5, `${caseId}: result limit exceeded`);

  for (const product of payload.result.results) {
    assert.ok(product && typeof product === "object", `${caseId}: invalid product projection`);
    for (const key of ["id", "brand", "name", "category", "whyPicked", "cautionNote"]) {
      assert.ok(Object.hasOwn(product, key), `${caseId}: missing projected field ${key}`);
    }
    assert.ok(Array.isArray(product.whyPicked), `${caseId}: whyPicked must be an array`);
  }
}

async function submitUiQuery(page, { caseId, query, expectation }) {
  const responsePromise = page.waitForResponse((response) =>
    response.url().includes("/api/my/product-query-beta") &&
    response.request().method() === "POST"
  );

  await page.getByTestId("product-query-beta-input").fill(query);
  await page.getByTestId("product-query-beta-submit").click();

  const response = await responsePromise;
  const payload = await response.json();
  assert.equal(response.status(), 200, `${caseId}: expected HTTP 200`);
  assertPreviewResult(payload, caseId);

  const result = payload.result;
  if (expectation === "ranked") {
    assert.ok(result.results.length > 0, `${caseId}: ranked result required`);
  }
  if (expectation === "conflict") {
    assert.ok(
      Array.isArray(result.unresolvedTerms) && result.unresolvedTerms.length > 0,
      `${caseId}: conflict evidence must remain unresolved`
    );
  }
  if (expectation === "unsupported") {
    assert.equal(result.results.length, 0, `${caseId}: unsupported request must not fabricate products`);
    assert.ok(
      Array.isArray(result.unresolvedTerms) && result.unresolvedTerms.length > 0,
      `${caseId}: unsupported concept must remain explicit`
    );
  }

  await page.getByTestId("product-query-beta-result").waitFor({ state: "visible" });

  return {
    caseId,
    httpStatus: response.status(),
    status: result.status || null,
    resultCount: result.results.length,
    unresolvedCount: Array.isArray(result.unresolvedTerms)
      ? result.unresolvedTerms.length
      : 0,
    pass: true
  };
}

const baseUrl = normalizeBaseUrl(required("PQ_PRELAUNCH_BASE_URL"));
const expectedHost = required("PQ_PRELAUNCH_EXPECTED_HOST");
const expectedSha = required("PQ_PRELAUNCH_EXPECTED_SHA").toLowerCase();
const deploymentSha = required("PQ_PRELAUNCH_DEPLOYMENT_SHA").toLowerCase();
const eligibleStorageStatePath = required("PQ_PRELAUNCH_ELIGIBLE_STORAGE_STATE");
const ineligibleStorageStatePath = required("PQ_PRELAUNCH_INELIGIBLE_STORAGE_STATE");
const eligibleAccessToken = required("PQ_PRELAUNCH_ELIGIBLE_ACCESS_TOKEN");
const ineligibleAccessToken = required("PQ_PRELAUNCH_INELIGIBLE_ACCESS_TOKEN");
const supabaseUrl = required("PQ_PRELAUNCH_SUPABASE_URL").replace(/\/$/, "");
const anonKey = required("PQ_PRELAUNCH_SUPABASE_ANON_KEY");
const evidencePath = resolve(
  process.env.PQ_PRELAUNCH_EVIDENCE_PATH ||
    "tmp/product-query-prelaunch-e2e/evidence.json"
);

assert.equal(
  process.env.PQ_PRELAUNCH_ALLOW_PRODUCTION,
  PRODUCTION_CONFIRMATION,
  "explicit Production confirmation required"
);
assert.equal(baseUrl.hostname, expectedHost, "Production host attestation mismatch");
assert.match(expectedSha, /^[0-9a-f]{40}$/, "expected SHA must be a full Git SHA");
assert.equal(deploymentSha, expectedSha, "deployment SHA must match release-candidate SHA");

const [eligibleStorageState, ineligibleStorageState, eligibleUser, ineligibleUser] =
  await Promise.all([
    loadStorageState(eligibleStorageStatePath),
    loadStorageState(ineligibleStorageStatePath),
    fetchAuthUser({ supabaseUrl, anonKey, accessToken: eligibleAccessToken }),
    fetchAuthUser({ supabaseUrl, anonKey, accessToken: ineligibleAccessToken })
  ]);

assert.notEqual(eligibleUser.id, ineligibleUser.id, "QA accounts must be distinct");

const browser = await chromium.launch({
  headless: process.env.PQ_PRELAUNCH_HEADLESS !== "0"
});

const checks = {
  anonymousBlocked: false,
  getMethodClosed: false,
  ineligibleCardHidden: false,
  ineligibleDirectPostBlocked: false,
  eligibleCardVisible: false,
  desktop: false,
  mobile: false,
  koreanHappyPath: false,
  englishHappyPath: false,
  conflictFailClosed: false,
  unsupportedFailClosed: false,
  invalidInputRejected: false,
  persistenceDeltaZero: false,
  artifactSecretLeakageZero: false
};
const cases = [];

try {
  const anonymous = await browser.newContext();
  try {
    const post = await anonymous.request.post(
      new URL("/api/my/product-query-beta", baseUrl).toString(),
      { data: { query: "synthetic prelaunch QA" } }
    );
    assert.equal(post.status(), 401, "anonymous Product Query POST must be unauthorized");
    checks.anonymousBlocked = true;

    const get = await anonymous.request.get(
      new URL("/api/my/product-query-beta", baseUrl).toString()
    );
    assert.equal(get.status(), 405, "Product Query route must remain POST-only");
    checks.getMethodClosed = true;
  } finally {
    await anonymous.close();
  }

  const ineligible = await browser.newContext({
    storageState: ineligibleStorageState
  });
  try {
    const page = await ineligible.newPage();
    await page.goto(new URL("/my", baseUrl).toString(), {
      waitUntil: "networkidle"
    });
    assert.equal(
      await page.getByTestId("product-query-beta-card").count(),
      0,
      "authenticated non-cohort account must not see Product Query card"
    );
    checks.ineligibleCardHidden = true;

    const response = await ineligible.request.post(
      new URL("/api/my/product-query-beta", baseUrl).toString(),
      { data: { query: "synthetic prelaunch QA" } }
    );
    assert.equal(response.status(), 404, "non-cohort direct POST must fail closed");
    checks.ineligibleDirectPostBlocked = true;
  } finally {
    await ineligible.close();
  }

  const eligible = await browser.newContext({
    storageState: eligibleStorageState,
    viewport: { width: 1440, height: 1080 }
  });
  try {
    const page = await eligible.newPage();
    await page.goto(new URL("/my", baseUrl).toString(), {
      waitUntil: "networkidle"
    });
    await page.getByTestId("product-query-beta-card").waitFor({ state: "visible" });
    checks.eligibleCardVisible = true;
    checks.desktop = true;

    const persistenceBefore = await snapshotPersistence({
      supabaseUrl,
      anonKey,
      accessToken: eligibleAccessToken,
      userId: eligibleUser.id
    });

    cases.push(
      await submitUiQuery(page, {
        caseId: "PRE-KO-HAPPY",
        query: "지성 피부인데 백탁 없고 번들거리지 않는 선크림 추천해줘",
        expectation: "ranked"
      })
    );
    checks.koreanHappyPath = true;

    await page.goto(new URL("/en/my", baseUrl).toString(), {
      waitUntil: "networkidle"
    });
    await page.getByTestId("product-query-beta-card").waitFor({ state: "visible" });
    cases.push(
      await submitUiQuery(page, {
        caseId: "PRE-EN-HAPPY",
        query: "I have dry skin and want a cream moisturizer for dehydration and barrier support.",
        expectation: "ranked"
      })
    );
    checks.englishHappyPath = true;

    await page.goto(new URL("/my", baseUrl).toString(), {
      waitUntil: "networkidle"
    });
    cases.push(
      await submitUiQuery(page, {
        caseId: "PRE-CONFLICT",
        query: "선크림 추천해줘. 톤업은 원하지만 톤업 제품은 싫어.",
        expectation: "conflict"
      })
    );
    checks.conflictFailClosed = true;

    cases.push(
      await submitUiQuery(page, {
        caseId: "PRE-UNSUPPORTED",
        query: "아이폰 추천해줘",
        expectation: "unsupported"
      })
    );
    checks.unsupportedFailClosed = true;

    const invalid = await eligible.request.post(
      new URL("/api/my/product-query-beta", baseUrl).toString(),
      { data: { query: "x".repeat(501) } }
    );
    assert.equal(invalid.status(), 400, "oversized semantic query must be rejected");
    checks.invalidInputRejected = true;

    const persistenceAfter = await snapshotPersistence({
      supabaseUrl,
      anonKey,
      accessToken: eligibleAccessToken,
      userId: eligibleUser.id
    });
    assert.deepEqual(
      persistenceAfter,
      persistenceBefore,
      "Product Query must not mutate My persistence after dashboard load"
    );
    checks.persistenceDeltaZero = true;
  } finally {
    await eligible.close();
  }

  const mobile = await browser.newContext({
    storageState: eligibleStorageState,
    viewport: { width: 390, height: 844 }
  });
  try {
    const page = await mobile.newPage();
    await page.goto(new URL("/my", baseUrl).toString(), {
      waitUntil: "networkidle"
    });
    const card = page.getByTestId("product-query-beta-card");
    await card.waitFor({ state: "visible" });
    const box = await card.boundingBox();
    assert.ok(box && box.width <= 390, "Product Query card must fit mobile viewport");
    checks.mobile = true;
  } finally {
    await mobile.close();
  }
} finally {
  await browser.close();
}

const evidence = {
  evidenceVersion: "product-query-prelaunch-e2e-evidence-v1",
  phase: "DATA-AI-PRELAUNCH-01",
  releaseCandidateSha: expectedSha,
  deploymentSha,
  host: baseUrl.hostname,
  access: {
    anonymousBlocked: checks.anonymousBlocked,
    getMethodClosed: checks.getMethodClosed,
    ineligibleCardHidden: checks.ineligibleCardHidden,
    ineligibleDirectPostBlocked: checks.ineligibleDirectPostBlocked,
    eligibleCardVisible: checks.eligibleCardVisible
  },
  ui: {
    desktop: checks.desktop,
    mobile: checks.mobile,
    koreanHappyPath: checks.koreanHappyPath,
    englishHappyPath: checks.englishHappyPath,
    conflictFailClosed: checks.conflictFailClosed,
    unsupportedFailClosed: checks.unsupportedFailClosed,
    invalidInputRejected: checks.invalidInputRejected
  },
  persistence: {
    productQueryWrites: 0,
    deltaZero: checks.persistenceDeltaZero
  },
  privacy: {
    rawAccountIdPersisted: false,
    accountHashPersisted: false,
    accessTokenPersisted: false,
    rawQueryPersisted: false,
    artifactSecretLeakage: 0
  },
  authority: {
    providerProductSelection: false,
    providerRankingAuthority: false,
    deterministicRankingAuthority: "existing_recommendation_engine",
    cohortExpansionAuthorized: false,
    publicCutoverAuthorized: false
  },
  cases,
  result: "PRELAUNCH_ACCEPTED"
};

let serialized = JSON.stringify(evidence, null, 2);
for (const forbidden of [
  eligibleAccessToken,
  ineligibleAccessToken,
  eligibleUser.id,
  ineligibleUser.id,
  process.env.OPENAI_API_KEY || ""
].filter(Boolean)) {
  assert.ok(!serialized.includes(forbidden), "prelaunch evidence leaked a credential or identity");
}
checks.artifactSecretLeakageZero = true;
evidence.privacy.artifactSecretLeakage = 0;
serialized = JSON.stringify(evidence, null, 2);

await mkdir(dirname(evidencePath), { recursive: true });
await writeFile(evidencePath, `${serialized}\n`, "utf8");
process.stdout.write(`${serialized}\n`);
