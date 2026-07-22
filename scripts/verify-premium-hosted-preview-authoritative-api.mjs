import assert from "node:assert/strict";
import { createHostedAuthoritativeApiClient } from "./premium-hosted-preview-authoritative-api.mjs";

const cliCalls = [];
const cliClient = createHostedAuthoritativeApiClient({
  env: {},
  platform: "win32",
  fetchImpl: async () => {
    throw new Error("fetch_must_not_run");
  },
  execFileImpl: async (command, args, options) => {
    cliCalls.push({ command, args, options });
    return { stdout: JSON.stringify({ source: command, endpoint: args[1] }) };
  }
});

assert.deepEqual(cliClient.modes, {
  github: "authenticated-cli",
  vercel: "authenticated-cli"
});
assert.equal((await cliClient.github("/repos/example/repo/pulls/1", "github_failed")).source, "gh.exe");
assert.equal((await cliClient.vercel("/v13/deployments/dpl_1", "vercel_failed")).source, "vercel.cmd");
assert.deepEqual(cliCalls[0].args, ["api", "/repos/example/repo/pulls/1"]);
assert.deepEqual(cliCalls[1].args, ["api", "/v13/deployments/dpl_1"]);
assert.equal(cliCalls.every((call) => call.options.windowsHide === true && call.options.maxBuffer === 4 * 1024 * 1024), true);

const fetchCalls = [];
const tokenClient = createHostedAuthoritativeApiClient({
  env: {
    GITHUB_TOKEN: "github-secret",
    VERCEL_TOKEN: "vercel-secret"
  },
  platform: "linux",
  fetchImpl: async (url, options) => {
    fetchCalls.push({ url, options });
    return {
      status: 200,
      async json() {
        return { url };
      }
    };
  },
  execFileImpl: async () => {
    throw new Error("cli_must_not_run");
  }
});

assert.deepEqual(tokenClient.modes, {
  github: "bearer-token",
  vercel: "bearer-token"
});
await tokenClient.github("/repos/example/repo/pulls/1", "github_failed");
await tokenClient.vercel("/v13/deployments/dpl_1", "vercel_failed");
assert.equal(fetchCalls[0].url, "https://api.github.com/repos/example/repo/pulls/1");
assert.equal(fetchCalls[1].url, "https://api.vercel.com/v13/deployments/dpl_1");
assert.equal(fetchCalls[0].options.headers.Authorization, "Bearer github-secret");
assert.equal(fetchCalls[1].options.headers.Authorization, "Bearer vercel-secret");
assert.equal(fetchCalls.every((call) => call.options.redirect === "manual"), true);

const invalidJsonClient = createHostedAuthoritativeApiClient({
  env: {},
  platform: "linux",
  execFileImpl: async () => ({ stdout: "not-json" })
});
await assert.rejects(
  invalidJsonClient.github("/repos/example/repo", "github_failed"),
  /github_failed:invalid_json/
);

const failedCliClient = createHostedAuthoritativeApiClient({
  env: {},
  platform: "linux",
  execFileImpl: async () => {
    const error = new Error("missing");
    error.code = "ENOENT";
    throw error;
  }
});
await assert.rejects(
  failedCliClient.vercel("/v13/deployments/dpl_1", "vercel_failed"),
  /vercel_failed:cli_failed:unavailable/
);

console.log("premium hosted preview authoritative API verification passed");
