import assert from "node:assert/strict";
import {
  deletePremiumReportSessionById,
  extractPremiumSessionId,
  fetchPremiumReportSessionById,
  hashIdentifier
} from "./premium-browser-journey-core.mjs";

const sessionId = "stage10b_session_123456";
const encoded = Buffer.from(
  JSON.stringify({
    scope: "premium-report",
    exp: Date.now() + 60_000,
    sid: sessionId,
    owner: "redacted"
  }),
  "utf8"
).toString("base64url");

assert.equal(extractPremiumSessionId(`${encoded}.signature`), sessionId);
assert.equal(extractPremiumSessionId("malformed"), null);
assert.equal(
  extractPremiumSessionId(
    `${Buffer.from(JSON.stringify({ scope: "wrong", sid: sessionId })).toString("base64url")}.signature`
  ),
  null
);

const originalFetch = globalThis.fetch;
const requests = [];
let rowExists = true;
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(input);
  const method = init.method || "GET";
  requests.push({
    method,
    pathname: url.pathname,
    sessionFilter: url.searchParams.get("session_id")
  });

  assert.equal(url.pathname, "/rest/v1/premium_report_sessions");
  assert.equal(url.searchParams.get("session_id"), `eq.${sessionId}`);
  assert.equal(init.headers.apikey, "service-role-test-key");
  assert.equal(init.headers.Authorization, "Bearer service-role-test-key");

  if (method === "DELETE") {
    const rows = rowExists ? [{ session_id: sessionId }] : [];
    rowExists = false;
    return new Response(JSON.stringify(rows), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  }

  return new Response(
    JSON.stringify(rowExists ? [{ session_id: sessionId }] : []),
    { status: 200, headers: { "content-type": "application/json" } }
  );
};

try {
  const config = {
    supabaseUrl: "https://project-ref.supabase.co",
    serviceRoleKey: "service-role-test-key"
  };
  assert.deepEqual(await fetchPremiumReportSessionById(config, sessionId), {
    session_id: sessionId
  });
  assert.deepEqual(await deletePremiumReportSessionById(config, sessionId), [
    sessionId
  ]);
  assert.equal(await fetchPremiumReportSessionById(config, sessionId), null);
  assert.deepEqual(
    requests.map(({ method, sessionFilter }) => ({ method, sessionFilter })),
    [
      { method: "GET", sessionFilter: `eq.${sessionId}` },
      { method: "DELETE", sessionFilter: `eq.${sessionId}` },
      { method: "GET", sessionFilter: `eq.${sessionId}` }
    ]
  );
} finally {
  globalThis.fetch = originalFetch;
}

console.log(
  JSON.stringify(
    {
      status: "passed",
      assertions: 15,
      exactIdSelection: true,
      exactIdDeletion: true,
      exactIdResidueZero: true,
      emittedSessionHash: hashIdentifier(sessionId),
      rawSessionIdEmitted: false
    },
    null,
    2
  )
);
