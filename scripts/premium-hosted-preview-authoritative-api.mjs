import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";

const defaultExecFile = promisify(execFileCallback);

function optionalValue(value) {
  const normalized = String(value || "").trim();
  return normalized || null;
}

function parseJson(value, code) {
  try {
    return JSON.parse(String(value || ""));
  } catch {
    throw new Error(`${code}:invalid_json`);
  }
}

async function fetchBearerJson(url, token, code, fetchImpl) {
  const response = await fetchImpl(url, {
    redirect: "manual",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "User-Agent": "bejewely-premium-hosted-verifier"
    }
  });
  if (response.status !== 200) throw new Error(`${code}:${response.status}`);
  return response.json();
}

async function execJson(command, args, code, execFileImpl) {
  let result;
  try {
    result = await execFileImpl(command, args, {
      encoding: "utf8",
      windowsHide: true,
      maxBuffer: 4 * 1024 * 1024
    });
  } catch (error) {
    const exitCode = Number.isInteger(error?.code) ? error.code : "unavailable";
    throw new Error(`${code}:cli_failed:${exitCode}`);
  }
  return parseJson(result?.stdout, code);
}

export function createHostedAuthoritativeApiClient({
  env = process.env,
  platform = process.platform,
  fetchImpl = fetch,
  execFileImpl = defaultExecFile
} = {}) {
  const githubToken = optionalValue(env.GITHUB_TOKEN);
  const vercelToken = optionalValue(env.VERCEL_TOKEN);
  const githubCommand = platform === "win32" ? "gh.exe" : "gh";
  const vercelCommand = platform === "win32" ? "vercel.cmd" : "vercel";

  return {
    async github(path, code) {
      if (githubToken) {
        return fetchBearerJson(`https://api.github.com${path}`, githubToken, code, fetchImpl);
      }
      return execJson(githubCommand, ["api", path], code, execFileImpl);
    },

    async vercel(path, code) {
      if (vercelToken) {
        return fetchBearerJson(`https://api.vercel.com${path}`, vercelToken, code, fetchImpl);
      }
      return execJson(vercelCommand, ["api", path], code, execFileImpl);
    },

    modes: {
      github: githubToken ? "bearer-token" : "authenticated-cli",
      vercel: vercelToken ? "bearer-token" : "authenticated-cli"
    }
  };
}
