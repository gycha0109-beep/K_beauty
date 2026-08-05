import { spawn } from "node:child_process";
import { copyFile, mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "..");
const CRAWLER_ROOT = path.join(ROOT, "crawler");
const SUPABASE_CLI_VERSION = process.env.SUPABASE_CLI_VERSION || "2.109.1";
const RUN_ID = `${Date.now()}-${process.pid}`;
const RUNTIME_DIR = path.join(ROOT, "tmp", `admin-product-local-runtime-${RUN_ID}`);
const BATCH_DIR = path.join(ROOT, "tmp", `admin-product-local-batch-${RUN_ID}`);
const NPX = process.platform === "win32" ? "npx.cmd" : "npx";
const NPM = process.platform === "win32" ? "npm.cmd" : "npm";
const DOCKER = process.platform === "win32" ? "docker.exe" : "docker";
const KEEP = process.argv.includes("--keep");

const MIGRATION_SOURCES = [
  "tests/fixtures/admin-product-reviews/20260730140000_product_review_foundation.sql",
  "supabase/migrations/20260730152900_admin_access_foundation.sql",
  "tests/fixtures/product-review-export-intake/20260731170000_product_review_export_intake_fixture.sql",
  "tests/fixtures/admin-product-review-import/20260731190000_review_import_runtime_seed.sql",
  "supabase/migrations/20260804233000_admin_product_candidate_reviews.sql",
  "supabase/migrations/20260804233100_admin_product_candidate_reviews_hardening.sql",
  "supabase/migrations/20260804233200_admin_product_candidate_reviews_security_hardening.sql",
  "supabase/migrations/20260804233300_admin_product_review_import_confirm.sql",
];

let stackStarted = false;

function sanitize(value) {
  return value
    .replace(/(ANON_KEY|SERVICE_ROLE_KEY|JWT_SECRET|DATABASE_URL|DB_URL)=([^\r\n]+)/gi, "$1=[REDACTED]")
    .replace(/(Bearer\s+)[A-Za-z0-9._-]+/gi, "$1[REDACTED]")
    .replace(/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/g, "[REDACTED_JWT]")
    .replace(/(postgres(?:ql)?:\/\/[^:/\s]+:)[^@\s]+@/gi, "$1[REDACTED]@");
}

function commandString(command, args) {
  return [command, ...args]
    .map((part) => (/\s/.test(part) ? JSON.stringify(part) : part))
    .join(" ");
}

function run(command, args, options = {}) {
  const {
    cwd = ROOT,
    env = process.env,
    capture = false,
    quiet = false,
    allowFailure = false,
  } = options;

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      stdout += text;
      if (!capture && !quiet) process.stdout.write(sanitize(text));
    });

    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      stderr += text;
      if (!capture && !quiet) process.stderr.write(sanitize(text));
    });

    child.on("error", (error) => reject(error));
    child.on("close", (code) => {
      const result = { code: code ?? 1, stdout, stderr };
      if ((code ?? 1) === 0 || allowFailure) {
        resolve(result);
        return;
      }

      const output = sanitize(`${stdout}\n${stderr}`).trim();
      const detail = output
        ? `\n${output.split(/\r?\n/).slice(-120).join("\n")}`
        : "";
      reject(
        new Error(
          `${commandString(command, args)} failed with exit ${code}${detail}`,
        ),
      );
    });
  });
}

async function exists(target) {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

function parseEnv(output) {
  const values = {};
  for (const rawLine of output.split(/\r?\n/)) {
    const line = rawLine.trim();
    const match = line.match(/^(?:export\s+)?([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[match[1]] = value;
  }
  return values;
}

function step(message) {
  process.stdout.write(`[AHR-3L] ${message}\n`);
}

async function ensureDocker() {
  step("Docker 확인");
  try {
    await run(DOCKER, ["info"], { capture: true });
  } catch {
    throw new Error(
      "Docker Desktop이 실행 중이 아닙니다. Docker Desktop을 켠 뒤 다시 실행하세요.",
    );
  }
}

async function ensureCrawlerDependencies() {
  const tsxBinary = path.join(
    CRAWLER_ROOT,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "tsx.cmd" : "tsx",
  );
  if (await exists(tsxBinary)) return;

  step("crawler 의존성 설치");
  await run(NPM, ["ci", "--no-audit", "--no-fund"], {
    cwd: CRAWLER_ROOT,
  });
}

async function prepareRuntime() {
  step("격리 Supabase 작업공간 준비");
  await rm(RUNTIME_DIR, { recursive: true, force: true });
  await rm(BATCH_DIR, { recursive: true, force: true });
  await mkdir(RUNTIME_DIR, { recursive: true });
  await mkdir(BATCH_DIR, { recursive: true });

  await run(
    NPX,
    [
      "--yes",
      `supabase@${SUPABASE_CLI_VERSION}`,
      "init",
      "--workdir",
      RUNTIME_DIR,
      "--force",
    ],
    { capture: true },
  );

  const migrationDir = path.join(RUNTIME_DIR, "supabase", "migrations");
  await mkdir(migrationDir, { recursive: true });
  for (const relativeSource of MIGRATION_SOURCES) {
    const source = path.join(ROOT, relativeSource);
    if (!(await exists(source))) {
      throw new Error(`필수 파일이 없습니다: ${relativeSource}`);
    }
    await copyFile(source, path.join(migrationDir, path.basename(relativeSource)));
  }
}

async function startAndReset() {
  step("로컬 Supabase 시작");
  await run(
    NPX,
    [
      "--yes",
      `supabase@${SUPABASE_CLI_VERSION}`,
      "start",
      "--workdir",
      RUNTIME_DIR,
      "--exclude",
      "realtime,storage-api,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor",
    ],
    { capture: true },
  );
  stackStarted = true;

  step("migration 전체 재생");
  await run(
    NPX,
    [
      "--yes",
      `supabase@${SUPABASE_CLI_VERSION}`,
      "db",
      "reset",
      "--workdir",
      RUNTIME_DIR,
    ],
    { capture: true },
  );
}

async function runtimeEnvironment() {
  const status = await run(
    NPX,
    [
      "--yes",
      `supabase@${SUPABASE_CLI_VERSION}`,
      "status",
      "--workdir",
      RUNTIME_DIR,
      "-o",
      "env",
    ],
    { capture: true },
  );
  const values = parseEnv(status.stdout);
  if (!values.API_URL || !values.SERVICE_ROLE_KEY) {
    throw new Error(
      "로컬 Supabase API_URL 또는 SERVICE_ROLE_KEY를 읽지 못했습니다.",
    );
  }
  return {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: values.API_URL,
    SUPABASE_SERVICE_ROLE_KEY: values.SERVICE_ROLE_KEY,
  };
}

async function runRuntimeChecks(env) {
  const reviewedCsv = path.join(BATCH_DIR, "reviewed.csv");
  const requestId = `local-${RUN_ID}`;

  step("검수 대상 export");
  await run(
    NPM,
    [
      "run",
      "reviews:export",
      "--",
      "--status",
      "queued",
      "--out-dir",
      BATCH_DIR,
      "--limit",
      "5",
    ],
    { cwd: CRAWLER_ROOT, env },
  );

  step("검수 파일 fixture 작성");
  await run(
    NPX,
    ["tsx", "tests/prepare-reviewed-intake-local-fixture.ts", BATCH_DIR],
    { cwd: CRAWLER_ROOT, env },
  );

  step("dry-run 검증");
  await run(
    NPM,
    [
      "run",
      "reviews:import-reviewed",
      "--",
      "--file",
      reviewedCsv,
      "--dry-run",
    ],
    { cwd: CRAWLER_ROOT, env },
  );

  step("권한·stale·atomic confirm·retry·conflict 검증");
  await run(
    NPM,
    [
      "run",
      "verify:product-review-intake-confirm:local-runtime",
      "--",
      reviewedCsv,
      "30000000-0000-4000-8000-000000000001",
      "30000000-0000-4000-8000-000000000003",
      requestId,
    ],
    { cwd: CRAWLER_ROOT, env },
  );
}

async function cleanup() {
  if (KEEP) {
    step(`--keep 지정: 작업공간 유지 ${RUNTIME_DIR}`);
    return;
  }

  if (stackStarted) {
    step("로컬 Supabase 종료 및 데이터 삭제");
    await run(
      NPX,
      [
        "--yes",
        `supabase@${SUPABASE_CLI_VERSION}`,
        "stop",
        "--workdir",
        RUNTIME_DIR,
        "--no-backup",
      ],
      { capture: true, allowFailure: true },
    );
  }
  await rm(RUNTIME_DIR, { recursive: true, force: true });
  await rm(BATCH_DIR, { recursive: true, force: true });
}

async function main() {
  try {
    await ensureDocker();
    await ensureCrawlerDependencies();
    await prepareRuntime();
    await startAndReset();
    const env = await runtimeEnvironment();
    await runRuntimeChecks(env);
    step("PASS: Production 변경 없이 AHR-3L 로컬 검증 완료");
  } finally {
    await cleanup();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`[AHR-3L] FAIL: ${sanitize(message)}\n`);
  process.exitCode = 1;
});
