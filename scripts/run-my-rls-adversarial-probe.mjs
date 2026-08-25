import {
  DEDICATED_ACCOUNT_CONFIRMATION,
  FAILURE_CATEGORIES,
  JourneyFailure,
  fetchAuthUser,
  hashIdentifier,
  requireCondition
} from "./premium-browser-journey-core.mjs";

const accessTokenA = String(process.env.MY_E2E_ACCESS_TOKEN_A || "").trim();
const accessTokenB = String(process.env.MY_E2E_ACCESS_TOKEN_B || "").trim();
const expectedUserHashA = String(process.env.MY_E2E_EXPECTED_USER_HASH_A || "").trim();
const expectedUserHashB = String(process.env.MY_E2E_EXPECTED_USER_HASH_B || "").trim();
const supabaseUrl = String(process.env.MY_E2E_SUPABASE_URL || "").trim().replace(/\/$/, "");
const anonKey = String(process.env.MY_E2E_SUPABASE_ANON_KEY || "").trim();
const runId = String(process.env.MY_E2E_RUN_ID || "").trim();

requireCondition(accessTokenA && accessTokenB, FAILURE_CATEGORIES.PRECONDITION, "rls-probe", "two_access_tokens_required");
requireCondition(expectedUserHashA && expectedUserHashB, FAILURE_CATEGORIES.PRECONDITION, "rls-probe", "two_expected_user_hashes_required");
requireCondition(supabaseUrl && anonKey, FAILURE_CATEGORIES.PRECONDITION, "rls-probe", "supabase_public_config_missing");
requireCondition(runId, FAILURE_CATEGORIES.PRECONDITION, "rls-probe", "run_id_missing");
requireCondition(
  process.env.MY_E2E_DEDICATED_ACCOUNT_CONFIRMATION === DEDICATED_ACCOUNT_CONFIRMATION,
  FAILURE_CATEGORIES.PRECONDITION,
  "rls-probe",
  "dedicated_test_accounts_not_confirmed"
);

const [userA, userB] = await Promise.all([
  fetchAuthUser({ supabaseUrl, anonKey, accessToken: accessTokenA }),
  fetchAuthUser({ supabaseUrl, anonKey, accessToken: accessTokenB })
]);
requireCondition(userA.id !== userB.id, FAILURE_CATEGORIES.AUTH, "rls-probe", "accounts_must_be_distinct");
requireCondition(hashIdentifier(userA.id) === expectedUserHashA, FAILURE_CATEGORIES.AUTH, "rls-probe", "unexpected_account_a");
requireCondition(hashIdentifier(userB.id) === expectedUserHashB, FAILURE_CATEGORIES.AUTH, "rls-probe", "unexpected_account_b");

function restUrl(table, query = {}) {
  const url = new URL(`${supabaseUrl}/rest/v1/${table}`);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, String(value));
  return url;
}

async function rest(token, table, { method = "GET", query = {}, body, prefer = "" } = {}) {
  const response = await fetch(restUrl(table, query), {
    method,
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(prefer ? { Prefer: prefer } : {})
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }
  return { ok: response.ok, status: response.status, body: parsed };
}

const marker = `MY_RLS_E2E:${runId}`;
let leakedId = null;

try {
  const forgedInsert = await rest(accessTokenB, "saved_reports", {
    method: "POST",
    query: { select: "id,user_id,title" },
    body: {
      user_id: userA.id,
      report_type: "free",
      source_type: "manual",
      source_session_id: marker,
      title: marker,
      report_version: "free-v1",
      free_result: { adversarialRlsProbe: true, runId }
    },
    prefer: "return=representation"
  });

  if (forgedInsert.ok && Array.isArray(forgedInsert.body) && forgedInsert.body[0]?.id) {
    leakedId = forgedInsert.body[0].id;
    await rest(accessTokenA, "saved_reports", {
      method: "DELETE",
      query: { id: `eq.${leakedId}`, user_id: `eq.${userA.id}`, select: "id" },
      prefer: "return=representation"
    });
    throw new JourneyFailure(
      FAILURE_CATEGORIES.AUTH,
      "rls-forged-owner-insert",
      "forged_owner_insert_allowed"
    );
  }

  requireCondition(
    !forgedInsert.ok && [401, 403].includes(forgedInsert.status),
    FAILURE_CATEGORIES.AUTH,
    "rls-forged-owner-insert",
    `unexpected_forged_insert_status_${forgedInsert.status}`
  );

  const ownerReadback = await rest(accessTokenA, "saved_reports", {
    query: {
      select: "id,user_id,title,source_session_id",
      user_id: `eq.${userA.id}`,
      source_session_id: `eq.${marker}`
    }
  });
  requireCondition(
    ownerReadback.ok && Array.isArray(ownerReadback.body) && ownerReadback.body.length === 0,
    FAILURE_CATEGORIES.AUTH,
    "rls-forged-owner-insert",
    "forged_owner_row_persisted"
  );

  console.log(JSON.stringify({
    ok: true,
    verdict: "MY_RLS_FORGED_OWNER_INSERT_DENIED",
    attackerHash: hashIdentifier(userB.id),
    targetHash: hashIdentifier(userA.id),
    status: forgedInsert.status
  }, null, 2));
} finally {
  if (leakedId) {
    await rest(accessTokenA, "saved_reports", {
      method: "DELETE",
      query: { id: `eq.${leakedId}`, user_id: `eq.${userA.id}`, select: "id" },
      prefer: "return=representation"
    }).catch(() => {});
  }
}
