import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function requireText(relativePath, text, label) {
  const content = read(relativePath);
  if (!content.includes(text)) {
    throw new Error(`${label}: missing ${JSON.stringify(text)} in ${relativePath}`);
  }
}

const serverClient = "lib/supabase/server-client.js";
const dashboardRoute = "app/api/my/dashboard/route.js";
const checkInRoute = "app/api/my/check-in/route.js";
const webServerClient = "lib/supabase/server.js";
const mobilePackage = "apps/mobile/package.json";
const mobileSupabase = "apps/mobile/lib/supabase.ts";
const mobileAuth = "apps/mobile/lib/auth.ts";
const mobileCallback = "apps/mobile/app/auth/callback.tsx";
const mobileLayout = "apps/mobile/app/_layout.tsx";
const mobileAppConfig = "apps/mobile/app.json";

requireText(serverClient, "export async function resolveRouteSupabaseAuth(request)", "dual auth resolver");
requireText(serverClient, "const accessToken = getBearerToken(request)", "bearer resolution");
requireText(serverClient, "await createServerSupabaseClient()", "cookie fallback");
requireText(serverClient, 'transport: "bearer"', "bearer transport marker");
requireText(serverClient, 'transport: "cookie"', "cookie transport marker");
requireText(serverClient, "supabase.auth.getUser()", "server token verification");

requireText(dashboardRoute, "resolveRouteSupabaseAuth(request)", "dashboard dual auth");
requireText(dashboardRoute, "authContext", "dashboard auth injection");
requireText(checkInRoute, "resolveRouteSupabaseAuth(request)", "check-in dual auth");

requireText(webServerClient, 'import { cookies } from "next/headers"', "web cookie authority");
requireText(webServerClient, "cookieStore.getAll()", "web cookie read path");

requireText(mobilePackage, '"expo-secure-store": "~57.0.2"', "SDK57 secure store dependency");
requireText(mobileSupabase, 'import { GoTrueClient } from "@supabase/auth-js"', "standalone native auth client");
requireText(mobileSupabase, 'import * as SecureStore from "expo-secure-store"', "encrypted native storage");
requireText(mobileSupabase, "SECURE_STORE_CHUNK_SIZE = 400", "bounded secure-store chunks");
requireText(mobileSupabase, "SECURE_STORE_MAX_CHUNKS = 256", "bounded secure-store capacity");
requireText(mobileSupabase, "SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY", "device-only keychain accessibility");
requireText(mobileSupabase, "SecureStore.setItemAsync", "secure session writes");
requireText(mobileSupabase, "SecureStore.getItemAsync", "secure session reads");
requireText(mobileSupabase, "SecureStore.deleteItemAsync", "secure session deletion");
requireText(mobileSupabase, 'expo-file-system/legacy', "legacy session migration read path");
requireText(mobileSupabase, "FileSystem.readAsStringAsync", "legacy plaintext session migration");
requireText(mobileSupabase, "FileSystem.deleteAsync", "legacy plaintext deletion");
requireText(mobileSupabase, "withStorageQueue", "serialized secure storage mutations");
requireText(mobileSupabase, 'persistSession: true', "native session persistence");
requireText(mobileSupabase, 'autoRefreshToken: true', "native refresh");
requireText(mobileSupabase, 'flowType: "pkce"', "native PKCE");
requireText(mobileAppConfig, '"expo-secure-store"', "SecureStore config plugin");
requireText(mobileAppConfig, '"configureAndroidBackup": true', "SecureStore Android backup exclusion");

if (read(mobileSupabase).includes("FileSystem.writeAsStringAsync")) {
  throw new Error("native auth must not persist new session material as plaintext files");
}

if (read(mobileSupabase).includes('from "@supabase/supabase-js"')) {
  throw new Error("native auth must not bundle the Supabase core client");
}

requireText(mobileAuth, 'provider: "google"', "native Google OAuth");
requireText(mobileAuth, 'bejewely://auth/callback', "native callback scheme");
requireText(mobileAuth, "exchangeCodeForSession(code)", "PKCE callback exchange");
requireText(mobileAuth, "supabase.auth.setSession", "implicit callback fallback");
requireText(mobileAuth, 'Authorization: `Bearer ${session.access_token}`', "Bearer API header");
requireText(mobileCallback, "completeNativeAuthFromUrl(authUrl)", "native callback handler");
requireText(mobileLayout, 'name="auth/callback"', "callback route registration");
requireText(mobileLayout, "href: null", "callback tab hiding");
requireText(mobileAppConfig, '"scheme": "bejewely"', "native scheme registration");

for (const relativePath of [mobileSupabase, mobileAuth, mobileCallback, dashboardRoute, checkInRoute]) {
  const content = read(relativePath).toLowerCase();
  if (content.includes("service_role") || content.includes("supabase_service_role")) {
    throw new Error(`client/server auth boundary violation in ${relativePath}`);
  }
}

console.log("MOBILE_AUTH_COOKIE_PATH=PASS");
console.log("MOBILE_AUTH_BEARER_PATH=PASS");
console.log("MOBILE_AUTH_STANDALONE_GOTRUE=PASS");
console.log("MOBILE_AUTH_SECURE_STORE_CHUNKING=PASS");
console.log("MOBILE_AUTH_LEGACY_PLAINTEXT_MIGRATION=PASS");
console.log("MOBILE_AUTH_NATIVE_PKCE_PERSISTENCE=PASS");
console.log("MOBILE_AUTH_SECRET_BOUNDARY=PASS");
console.log("MOBILE_AUTH_FOUNDATION=PASS");
