import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const requiredFiles = [
  "apps/mobile/package.json",
  "apps/mobile/app.json",
  "apps/mobile/tsconfig.json",
  "apps/mobile/app/_layout.tsx",
  "apps/mobile/app/index.tsx",
  "apps/mobile/app/analyze.tsx",
  "apps/mobile/app/my.tsx",
  "apps/mobile/lib/env.ts",
  "packages/shared/package.json",
  "packages/shared/src/index.ts",
  "packages/shared/README.md",
  "docs/architecture/mobile-foundation.md"
];

function fail(message) {
  console.error(`MOBILE_0_ARCHITECTURE_FOUNDATION_STATIC=FAIL ${message}`);
  process.exit(1);
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

for (const relativePath of requiredFiles) {
  if (!fs.existsSync(path.join(root, relativePath))) {
    fail(`missing:${relativePath}`);
  }
}

const rootPackage = readJson("package.json");
for (const workspace of ["apps/*", "packages/*", "tools/*"]) {
  if (!rootPackage.workspaces?.includes(workspace)) {
    fail(`workspace:${workspace}`);
  }
}

const mobilePackage = readJson("apps/mobile/package.json");
if (mobilePackage.name !== "@bejewely/mobile" || mobilePackage.main !== "expo-router/entry") {
  fail("mobile-package-contract");
}
for (const forbiddenDependency of ["next", "react-dom", "server-only"]) {
  if (mobilePackage.dependencies?.[forbiddenDependency] || mobilePackage.devDependencies?.[forbiddenDependency]) {
    fail(`mobile-dependency:${forbiddenDependency}`);
  }
}
if (mobilePackage.dependencies?.["@bejewely/shared"] !== "*") {
  fail("shared-workspace-link");
}

const appConfig = readJson("apps/mobile/app.json");
if (appConfig.expo?.scheme !== "bejewely" || !appConfig.expo?.plugins?.includes("expo-router")) {
  fail("expo-router-config");
}
if (appConfig.expo?.experiments?.typedRoutes !== true) {
  fail("typed-routes-disabled");
}

const sharedPackage = readJson("packages/shared/package.json");
if (sharedPackage.name !== "@bejewely/shared") {
  fail("shared-package-name");
}

function collectSourceFiles(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (["node_modules", ".expo", ".expo-ci-dist"].includes(entry.name)) continue;
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(absolutePath));
      continue;
    }
    if (/\.(?:js|jsx|ts|tsx|mjs|cjs)$/.test(entry.name)) files.push(absolutePath);
  }
  return files;
}

const forbiddenSourcePatterns = [
  { label: "next-import", pattern: /(?:from\s+["']next(?:\/|["'])|require\(["']next)/ },
  { label: "react-dom", pattern: /["']react-dom(?:\/|["'])/ },
  { label: "server-only", pattern: /["']server-only["']/ },
  { label: "web-window", pattern: /\bwindow\s*\./ },
  { label: "web-document", pattern: /\bdocument\s*\./ },
  { label: "web-storage", pattern: /\b(?:localStorage|sessionStorage)\b/ },
  { label: "web-alias-import", pattern: /(?:from\s+|import\s*)["']@\// },
  { label: "secret-service-role", pattern: /SUPABASE_SERVICE_ROLE_KEY|SERVICE_ROLE_KEY/ },
  { label: "secret-provider", pattern: /OPENAI_API_KEY|GEMINI_API_KEY|VERCEL_TOKEN|DATABASE_PASSWORD|DB_PASSWORD/ },
  { label: "hardcoded-local-api", pattern: /https?:\/\/(?:localhost|127\.0\.0\.1|10\.0\.2\.2)(?::\d+)?/ }
];

for (const sourceFile of collectSourceFiles(path.join(root, "apps/mobile"))) {
  const content = fs.readFileSync(sourceFile, "utf8");
  for (const { label, pattern } of forbiddenSourcePatterns) {
    if (pattern.test(content)) {
      fail(`${label}:${path.relative(root, sourceFile)}`);
    }
  }
}

for (const sourceFile of collectSourceFiles(path.join(root, "packages/shared"))) {
  const content = fs.readFileSync(sourceFile, "utf8");
  if (/from\s+["'](?:next|react-native|react-dom|server-only)(?:\/|["'])/.test(content)) {
    fail(`shared-platform-import:${path.relative(root, sourceFile)}`);
  }
}

const envSource = fs.readFileSync(path.join(root, "apps/mobile/lib/env.ts"), "utf8");
for (const requiredEnvName of [
  "EXPO_PUBLIC_API_BASE_URL",
  "EXPO_PUBLIC_SUPABASE_URL",
  "EXPO_PUBLIC_SUPABASE_ANON_KEY"
]) {
  if (!envSource.includes(requiredEnvName)) fail(`env-contract:${requiredEnvName}`);
}
if (envSource.includes("NEXT_PUBLIC_")) fail("mobile-env-web-prefix");

console.log("MOBILE_0_ARCHITECTURE_FOUNDATION_STATIC=PASS");
