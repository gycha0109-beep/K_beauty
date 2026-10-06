import assert from "node:assert/strict";
import test from "node:test";
import { runtimeGateConfig, verifyMobileRuntime, workflowPath } from "./await-mobile-android-runtime.mjs";

const env = {
  GITHUB_REPOSITORY: "gycha0109-beep/K_beauty", EXPECTED_SHA: "a".repeat(40),
  GITHUB_TOKEN: "fixture-token-never-log", MOBILE_RUNTIME_EXPECTED_EVENT: "push",
  MOBILE_RUNTIME_RUN_ID: "123", MOBILE_RUNTIME_RUN_ATTEMPT: "2",
};
const config = runtimeGateConfig(env);
function fixture() {
  const run = { id: 123, workflow_id: 456, path: workflowPath, repository: { full_name: env.GITHUB_REPOSITORY },
    head_sha: config.sha, event: config.event, run_attempt: config.attempt, status: "completed", conclusion: "success" };
  return [
    { id: 456, path: workflowPath }, run,
    { total_count: 4, jobs: ["Android Debug APK Build", "Android Native Shell Smoke", "Android Store Capture 20A", "Android Store Capture 20B"]
      .map((name) => ({ name, run_id: 123, run_attempt: 2, head_sha: config.sha, status: "completed", conclusion: "success" })) },
    { total_count: 4, artifacts: ["bejewely-mobile-android-debug", "bejewely-mobile-native-shell", "bejewely-mobile-20a-store-capture", "bejewely-mobile-20b-store-capture"]
      .map((prefix) => ({ name: `${prefix}-${config.sha}`, expired: false, size_in_bytes: 100, workflow_run: { id: 123, head_sha: config.sha } })) },
    structuredClone(run),
  ];
}
function mockFetch(payloads) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    assert.equal(options.redirect, "error");
    assert.equal(new URL(url).origin, "https://api.github.com");
    assert.equal(options.headers.Authorization, `Bearer ${env.GITHUB_TOKEN}`);
    calls.push(url);
    assert.ok(calls.length <= payloads.length, "must not poll or retry");
    return { ok: true, json: async () => payloads[calls.length - 1] };
  };
  return { fetchImpl, calls };
}

test("certifies only exact completed producer, all four jobs and artifacts, and stable latest attempt", async () => {
  const mock = mockFetch(fixture());
  assert.deepEqual(await verifyMobileRuntime(config, mock), { runId: 123, attempt: 2, sha: config.sha, event: "push" });
  assert.equal(mock.calls.length, 5);
  assert.ok(mock.calls[2].endsWith("/runs/123/attempts/2/jobs?per_page=100"));
  assert.equal(mock.calls[1], mock.calls[4]);
});

const runCases = [
  ["wrong run", { id: 999 }], ["wrong workflow", { workflow_id: 999 }],
  ["wrong workflow path", { path: ".github/workflows/mobile-ios-shell.yml" }],
  ["wrong repository", { repository: { full_name: "other/repo" } }],
  ["wrong SHA", { head_sha: "b".repeat(40) }], ["wrong event", { event: "pull_request" }],
  ["stale attempt", { run_attempt: 3 }], ["running producer", { status: "in_progress", conclusion: null }],
  ["failed producer", { conclusion: "failure" }], ["cancelled producer", { conclusion: "cancelled" }],
];
for (const [label, change] of runCases) test(`rejects ${label} without waiting`, async () => {
  const payloads = fixture(); Object.assign(payloads[1], change);
  const mock = mockFetch(payloads);
  await assert.rejects(verifyMobileRuntime(config, mock));
  assert.equal(mock.calls.length, 2);
});

for (const [label, mutate] of [
  ["workflow lookup mismatch", (p) => p[0].path = "wrong"],
  ["missing job", (p) => { p[2].jobs.pop(); p[2].total_count--; }],
  ["skipped job", (p) => p[2].jobs[1].conclusion = "skipped"],
  ["wrong job attempt", (p) => p[2].jobs[0].run_attempt = 1],
  ["wrong job run", (p) => p[2].jobs[0].run_id = 999],
  ["wrong job SHA", (p) => p[2].jobs[0].head_sha = "b".repeat(40)],
  ["duplicate job", (p) => { p[2].jobs.push(p[2].jobs[0]); p[2].total_count++; }],
  ["truncated jobs", (p) => p[2].total_count = 101],
  ["missing artifact", (p) => { p[3].artifacts.pop(); p[3].total_count--; }],
  ["expired artifact", (p) => p[3].artifacts[0].expired = true],
  ["empty artifact", (p) => p[3].artifacts[0].size_in_bytes = 0],
  ["wrong artifact run", (p) => p[3].artifacts[0].workflow_run.id = 999],
  ["wrong artifact SHA", (p) => p[3].artifacts[0].workflow_run.head_sha = "b".repeat(40)],
  ["duplicate artifact", (p) => { p[3].artifacts.push(p[3].artifacts[0]); p[3].total_count++; }],
  ["truncated artifacts", (p) => p[3].total_count = 101],
  ["rerun during lookup", (p) => p[4].run_attempt = 3],
  ["rerun still executing", (p) => p[4].status = "in_progress"],
]) test(`rejects ${label}`, async () => {
  const payloads = fixture(); mutate(payloads);
  await assert.rejects(verifyMobileRuntime(config, mockFetch(payloads)));
});

for (const status of [401, 403, 404, 429, 500]) test(`fails closed on HTTP ${status}`, async () => {
  let calls = 0;
  await assert.rejects(verifyMobileRuntime(config, { fetchImpl: async () => { calls++; return { ok: false, status }; } }), new RegExp(`HTTP ${status}`));
  assert.equal(calls, 1);
});
test("aborts a request and never exposes network credentials", async () => {
  const fetchImpl = (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(new Error(env.GITHUB_TOKEN)), { once: true });
  });
  await assert.rejects(verifyMobileRuntime(config, { fetchImpl, timeoutMs: 5 }), (error) => {
    assert.ok(error.message.includes("timed out")); assert.ok(!error.message.includes(env.GITHUB_TOKEN)); return true;
  });
});
test("invalid JSON is rejected without exposing response details", async () => {
  await assert.rejects(verifyMobileRuntime(config, { fetchImpl: async () => ({ ok: true, json: async () => { throw new Error(env.GITHUB_TOKEN); } }) }), (error) => !error.message.includes(env.GITHUB_TOKEN));
});
for (const change of [
  { GITHUB_REPOSITORY: "owner/repo/../other" }, { EXPECTED_SHA: "short" }, { GITHUB_TOKEN: "" },
  { MOBILE_RUNTIME_RUN_ID: "1;echo unsafe" }, { MOBILE_RUNTIME_RUN_ID: "0" },
  { MOBILE_RUNTIME_RUN_ID: "9007199254740992" }, { MOBILE_RUNTIME_RUN_ATTEMPT: "" },
  { MOBILE_RUNTIME_RUN_ATTEMPT: "1.5" }, { MOBILE_RUNTIME_EXPECTED_EVENT: "pull_request_target" },
  { GITHUB_API_URL: "https://untrusted.invalid" },
]) test(`rejects invalid ${Object.keys(change)[0]} input`, () => assert.throws(() => runtimeGateConfig({ ...env, ...change })));
