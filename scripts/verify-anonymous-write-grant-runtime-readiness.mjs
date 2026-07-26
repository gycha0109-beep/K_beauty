import assert from "node:assert/strict";
import {
  RPC_VISIBILITY_READY_CODE,
  runAnonymousGrantRpcContract,
  waitForAnonymousGrantRpcVisibility
} from "./lib/anonymous-write-grant-runtime-readiness.mjs";

function sequence(values) {
  let index = 0;
  return async () => values[Math.min(index++, values.length - 1)];
}

function ready() {
  return { error: { code: RPC_VISIBILITY_READY_CODE }, status: 400 };
}

function dependencies(overrides = {}) {
  return {
    probeRpc: async () => ready(),
    createRpc: async () => ({ data: { created: 2 }, error: null }),
    selectRows: async () => ({
      rows: [{ operation: "result:create" }, { operation: "track:create" }],
      error: false
    }),
    deleteRows: async () => ({ error: false }),
    countRows: async () => ({ count: 0, error: false }),
    sleep: async () => {},
    now: () => 0,
    ...overrides
  };
}

{
  const result = await waitForAnonymousGrantRpcVisibility(dependencies());
  assert.equal(result.ok, true);
  assert.equal(result.probeAttempts, 1);
  assert.equal(result.safeErrorCode, "22023");
}

{
  const result = await waitForAnonymousGrantRpcVisibility(dependencies({
    probeRpc: sequence([
      { error: { code: "PGRST202" }, status: 404 },
      { error: { code: "PGRST202" }, status: 404 },
      ready()
    ])
  }));
  assert.equal(result.ok, true);
  assert.equal(result.probeAttempts, 3);
}

for (const response of [
  { error: { code: "42501" }, status: 400 },
  { error: { code: "PGRST301" }, status: 401 },
  { error: { code: "PGRST301" }, status: 403 }
]) {
  const result = await waitForAnonymousGrantRpcVisibility(dependencies({
    probeRpc: async () => response
  }));
  assert.equal(result.ok, false);
  assert.equal(result.probeAttempts, 1);
  assert.match(result.failureMarker, /permission_denied|auth_failed/);
}

{
  let clock = 0;
  const result = await waitForAnonymousGrantRpcVisibility(dependencies({
    probeRpc: async () => {
      throw new TypeError("safe synthetic network failure");
    },
    sleep: async () => {
      clock += 1_000;
    },
    now: () => clock,
    timeoutMs: 2_000,
    maxAttempts: 60
  }));
  assert.equal(result.failureMarker, "anonymous_grant_rpc_visibility_timeout");
  assert.equal(result.probeAttempts, 3);
}

{
  const result = await waitForAnonymousGrantRpcVisibility(dependencies({
    probeRpc: async () => ({ data: { unexpected: true }, error: null, status: 200 })
  }));
  assert.equal(result.failureMarker, "anonymous_grant_rpc_probe_contract_invalid");
}

{
  let actualCreateCalls = 0;
  const diagnostic = await runAnonymousGrantRpcContract(dependencies({
    createRpc: async () => {
      actualCreateCalls += 1;
      return { data: null, error: { code: "22023", message: "must not leak", details: "no", hint: "no" } };
    }
  }));
  assert.equal(actualCreateCalls, 1);
  assert.equal(diagnostic.actualCreateRpcAttempts, 1);
  assert.equal(diagnostic.failureMarker, "anonymous_grant_rpc_execution_failed");
  assert.equal(JSON.stringify(diagnostic).includes("must not leak"), false);
}

{
  const diagnostic = await runAnonymousGrantRpcContract(dependencies({
    selectRows: async () => ({ rows: [{ operation: "result:create" }], error: false })
  }));
  assert.equal(diagnostic.failureMarker, "anonymous_grant_row_contract_invalid");
}

{
  const diagnostic = await runAnonymousGrantRpcContract(dependencies({
    createRpc: async () => ({ data: null, error: { code: "22023" } }),
    deleteRows: async () => ({ error: true })
  }));
  assert.equal(diagnostic.primaryFailureMarker, "anonymous_grant_rpc_execution_failed");
  assert.equal(diagnostic.cleanupFailureMarker, "anonymous_grant_cleanup_failed");
  assert.equal(diagnostic.failureMarker, "anonymous_grant_cleanup_failed");
}

console.log("[anonymous-write-grant-runtime-readiness] PASS");
