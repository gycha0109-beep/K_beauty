import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import {
  assertNonProductionSupabaseTarget,
  LOCAL_SHADOW_TEST_WORKDIR
} from "../assert-non-production-supabase-target.mjs";

const LOCAL_DB_CONTAINER = "supabase_db_local-shadow-test";
const LOCAL_ONLY_ENV = {
  NODE_ENV: "development",
  LOCAL_SHADOW_PROVIDER_STUB: "1",
  SHADOW_ROUTE_NON_PRODUCTION_TARGET: "1",
  SHADOW_TEST_DB_DISPOSABLE: "1",
  ANALYSIS_REQUEST_GUARD_SECRET: "local-shadow-analysis-guard-contract",
  ANONYMOUS_WRITE_GRANT_SECRET: "local-shadow-anonymous-grant-contract"
};
const MAX_SERVER_STDERR_BUFFER = 16_384;
const MAX_SERVER_STDERR_EVIDENCE = 1_500;

function sanitizeDiagnosticText(value, maxLength = 256) {
  return String(value || "")
    .replace(/\b(?:https?|postgres(?:ql)?):\/\/\S+/gi, "[redacted-url]")
    .replace(/\b(Bearer\s+)[^\s]+/gi, "$1[redacted]")
    .replace(/\b([A-Z0-9_]*(?:KEY|SECRET|TOKEN|PASSWORD)[A-Z0-9_]*)\s*[:=]\s*[^\s,}]+/gi, "$1=[redacted]")
    .replace(/\b[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}(?:\.[A-Za-z0-9_-]{16,})?\b/g, "[redacted-token]")
    .slice(0, maxLength);
}

function redactSensitiveEnvironmentValues(value, env) {
  let redacted = String(value || "");
  for (const [key, secret] of Object.entries(env || {})) {
    if (!/(?:KEY|SECRET|TOKEN|PASSWORD)/i.test(key) || typeof secret !== "string" || secret.length < 4) continue;
    redacted = redacted.split(secret).join("[redacted]");
  }
  return redacted;
}

function buildRouteDiagnostic(status, payload) {
  const diagnostic = { status };
  for (const field of ["error", "code", "reasonCode"]) {
    if (typeof payload?.[field] === "string" && payload[field]) {
      diagnostic[field] = sanitizeDiagnosticText(payload[field]);
    }
  }
  return diagnostic;
}

function resolveWindowsSupabaseScript(root) {
  const result = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", "(Get-Command supabase -ErrorAction Stop).Source"],
    { cwd: root, encoding: "utf8", windowsHide: true, timeout: 30_000 }
  );
  const scriptPath = String(result.stdout || "").trim();
  return result.status === 0 && scriptPath.toLowerCase().endsWith(".ps1") ? scriptPath : null;
}

function runSupabase(root, args, timeout = 600_000) {
  const options = { cwd: root, encoding: "utf8", windowsHide: true, timeout };
  if (process.platform !== "win32") return spawnSync("supabase", args, options);

  const scriptPath = resolveWindowsSupabaseScript(root);
  return scriptPath
    ? spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-File", scriptPath, ...args], options)
    : { status: null, stdout: "", stderr: "", error: new Error("supabase_powershell_script_unavailable") };
}

function parseLocalSupabaseEnv(output) {
  const allowed = new Set(["API_URL", "ANON_KEY", "SERVICE_ROLE_KEY"]);
  return Object.fromEntries(
    String(output || "")
      .replace(/\r\n?/g, "\n")
      .split("\n")
      .map((line) => line.match(/^([A-Z0-9_]+)=(.*)$/))
      .filter((match) => match && allowed.has(match[1]))
      .map((match) => [match[1], match[2].replace(/^["']|["']$/g, "")])
  );
}

export function currentBranch(root = process.cwd()) {
  const result = spawnSync("git", ["branch", "--show-current"], {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
    timeout: 30_000
  });
  return result.status === 0 && String(result.stdout || "").trim()
    ? String(result.stdout).trim()
    : "unknown";
}

export function getLocalShadowRuntimeEnvironment({ root = process.cwd() } = {}) {
  const workdir = path.join(root, LOCAL_SHADOW_TEST_WORKDIR);
  const status = runSupabase(root, ["--workdir", workdir, "status", "--output", "env"]);
  if (status.status !== 0) return { ok: false, reasonCode: "local_supabase_status_failed" };

  const local = parseLocalSupabaseEnv(status.stdout);
  if (!local.API_URL || !local.ANON_KEY || !local.SERVICE_ROLE_KEY) {
    return { ok: false, reasonCode: "local_supabase_status_contract_incomplete" };
  }

  const target = assertNonProductionSupabaseTarget({ env: { NEXT_PUBLIC_SUPABASE_URL: local.API_URL }, root });
  if (!target.safeToRunRoute || target.targetType.includes("hosted")) {
    return { ok: false, reasonCode: "local_target_safety_rejected", target };
  }

  return {
    ok: true,
    target,
    env: {
      ...process.env,
      ...LOCAL_ONLY_ENV,
      NEXT_PUBLIC_SUPABASE_URL: local.API_URL,
      SUPABASE_URL: local.API_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: local.ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: local.SERVICE_ROLE_KEY
    }
  };
}

export function resetLocalShadowState({ root = process.cwd() } = {}) {
  const workdir = path.join(root, LOCAL_SHADOW_TEST_WORKDIR);
  const result = runSupabase(root, ["--workdir", workdir, "db", "reset", "--local", "--yes"]);
  return {
    ok: result.status === 0,
    reasonCode: result.status === 0 ? "local_state_reset" : "local_state_reset_failed"
  };
}

export function queryLocalShadowPostgres(sql, { root = process.cwd() } = {}) {
  return spawnSync(
    "docker",
    ["exec", LOCAL_DB_CONTAINER, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-At", "-c", sql],
    { cwd: root, encoding: "utf8", windowsHide: true, timeout: 120_000 }
  );
}

export function loadLocalAnalyzeFixture({ root = process.cwd() } = {}) {
  const fixturePath = path.join(root, "test", "fixtures", "analyze", "analyze-payload.fixture.json");
  if (!existsSync(fixturePath)) return { ok: false, reasonCode: "fixture_payload_missing" };

  try {
    const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
    const imagePath = path.resolve(root, String(fixture.imageFixturePath || ""));
    return fixture?.formFields && existsSync(imagePath)
      ? { ok: true, fixture, imagePath }
      : { ok: false, reasonCode: "fixture_contract_incomplete" };
  } catch {
    return { ok: false, reasonCode: "fixture_payload_invalid" };
  }
}

export function startLocalShadowServer({ root = process.cwd(), env, port }) {
  const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
  if (!existsSync(nextBin)) return { ok: false, reasonCode: "next_binary_missing", child: null };

  const child = spawn(process.execPath, [nextBin, "dev", "-p", String(port)], {
    cwd: root,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });
  let stderrTail = "";
  child.stdout?.resume();
  child.stderr?.on("data", (chunk) => {
    stderrTail = `${stderrTail}${String(chunk)}`.slice(-MAX_SERVER_STDERR_BUFFER);
  });

  return {
    ok: true,
    child,
    getSanitizedStderr() {
      const lines = sanitizeDiagnosticText(
        redactSensitiveEnvironmentValues(stderrTail, env),
        MAX_SERVER_STDERR_BUFFER
      )
        .replace(/\r\n?/g, "\n")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      return lines.slice(-8).join("\n").slice(-MAX_SERVER_STDERR_EVIDENCE) || null;
    }
  };
}

export async function waitForLocalShadowServer(child, port) {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) return false;
    const listening = await new Promise((resolve) => {
      const socket = net.createConnection({ host: "127.0.0.1", port });
      socket.once("connect", () => { socket.destroy(); resolve(true); });
      socket.once("error", () => resolve(false));
    });
    if (listening) return true;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

export async function stopLocalShadowServer(child, { root = process.cwd() } = {}) {
  if (!child || child.exitCode !== null) return true;

  child.kill();
  const exited = await Promise.race([
    new Promise((resolve) => child.once("exit", () => resolve(true))),
    new Promise((resolve) => setTimeout(() => resolve(false), 10_000))
  ]);
  if (exited || process.platform !== "win32") return Boolean(exited);

  return spawnSync("taskkill.exe", ["/pid", String(child.pid), "/T", "/F"], {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
    timeout: 30_000
  }).status === 0;
}

export async function invokeLocalAnalyzeRoute({ fixture, port }) {
  const imageBytes = await readFile(fixture.imagePath);
  const form = new FormData();
  for (const [key, value] of Object.entries(fixture.fixture.formFields)) form.set(key, String(value));
  form.set("image", new Blob([imageBytes], { type: "image/png" }), "test-face-placeholder.png");

  let response;
  try {
    response = await fetch(`http://127.0.0.1:${port}/api/analyze`, { method: "POST", body: form });
  } catch {
    return { ok: false, reasonCode: "route_request_failed" };
  }

  try {
    const payload = await response.json();
    return {
      ok: true,
      httpStatus: response.status,
      payload,
      diagnostic: buildRouteDiagnostic(response.status, payload)
    };
  } catch {
    return {
      ok: false,
      reasonCode: "route_response_not_json",
      httpStatus: response.status,
      diagnostic: { status: response.status }
    };
  }
}
