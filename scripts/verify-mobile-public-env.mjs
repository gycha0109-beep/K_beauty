import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";
import ts from "typescript";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Execute the application's validator without SDK initialization or printing values. */
export function verifyMobilePublicEnv(values) {
  const source = readFileSync(resolve(root, "apps/mobile/lib/env.ts"), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022
  } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(compiled, { exports: module.exports, module, URL,
    process: { env: { ...values, NODE_ENV: "production" } } });
  let env;
  try { env = module.exports.getMobilePublicEnv(); }
  catch {
    throw new Error("Mobile public config is missing or unsafe. Check EXPO_PUBLIC_API_BASE_URL, EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY.");
  }
  const readiness = JSON.parse(readFileSync(resolve(root, "apps/mobile/store-readiness.json"), "utf8"));
  if (env.apiBaseUrl !== readiness.mobile14Contract.canonicalWebOrigin) {
    throw new Error("Release API must match the canonical origin in store-readiness.json");
  }
  if (new URL(env.supabaseUrl).pathname.replace(/\/$/, "") !== "") {
    throw new Error("Release Supabase URL must identify the project origin");
  }
  const key = env.supabaseAnonKey;
  if (!key.startsWith("sb_publishable_")) {
    let role;
    try { role = JSON.parse(Buffer.from(key.split(".")[1] ?? "", "base64url").toString()).role; }
    catch { /* Invalid or non-public legacy key must fail closed. */ }
    if (role !== "anon") throw new Error("Release Supabase key must be publishable or a legacy anon key");
  }
  return true;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    verifyMobilePublicEnv(process.env);
    console.log("MOBILE_RELEASE_PUBLIC_CONFIG=PASS");
    console.log("MOBILE_RELEASE_PROJECT_PAIR_RUNTIME=EXTERNAL_PENDING");
  } catch (error) {
    // Assertion actual/expected can contain public config: emit only our sanitized reason.
    console.error(error instanceof Error ? error.message : "Mobile public config validation failed");
    process.exitCode = 1;
  }
}
