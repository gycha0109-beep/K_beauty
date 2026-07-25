import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadDotenv } from "dotenv";
import { createServerClient } from "@supabase/ssr";
import { chromium } from "playwright";
import {
  FAILURE_CATEGORIES,
  JourneyFailure,
  fetchAuthUser,
  hashIdentifier,
  inspectStorageState,
  requireCondition
} from "./premium-browser-journey-core.mjs";
import { captureAccountSession } from "./premium-browser-journey-local-auth.mjs";

const AUTH_COOKIE_PATTERN = /^sb-([a-z0-9]+)-auth-token(?:\.\d+)?$/i;
const SUPABASE_URL_PATTERN = /https:\/\/[a-z0-9-]+\.supabase\.(?:co|in)/gi;
const LEGACY_ANON_KEY_PATTERN = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;
const PUBLISHABLE_KEY_PATTERN = /sb_publishable_[A-Za-z0-9_-]+/g;
const MAX_DISCOVERY_RESOURCES = 40;
const MAX_DISCOVERY_BODY_BYTES = 2 * 1024 * 1024;

let envLoaded = false;

function loadLocalEnvironment() {
  if (envLoaded) return;
  envLoaded = true;
  for (const name of [".env.local", ".env"]) {
    const path = resolve(process.cwd(), name);
    if (existsSync(path)) loadDotenv({ path, override: false, quiet: true });
  }
}

function authCookie(cookie) {
  return AUTH_COOKIE_PATTERN.test(String(cookie?.name || ""));
}

function normalizeCookieDomain(value) {
  return String(value || "").trim().replace(/^\./, "").toLowerCase();
}

function normalizeSupabaseUrl(value) {
  const raw = String(value || "").trim().replace(/\/$/, "");
  if (!raw) return "";
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return "";
    return url.origin;
  } catch {
    return "";
  }
}

function normalizeHttpsHost(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw.includes("://") ? raw : `https://${raw}`);
    if (url.protocol !== "https:") return "";
    return url.hostname.toLowerCase();
  } catch {
    return "";
  }
}

function decodeJwtPayload(value) {
  try {
    const segments = String(value || "").split(".");
    if (segments.length !== 3) return null;
    return JSON.parse(Buffer.from(segments[1], "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

function isPublicSupabaseKey(value) {
  const key = String(value || "").trim();
  if (key.startsWith("sb_publishable_")) return true;
  const payload = decodeJwtPayload(key);
  return payload?.role === "anon";
}

function projectUrlFromCookies(cookies) {
  for (const cookie of cookies) {
    const match = String(cookie?.name || "").match(AUTH_COOKIE_PATTERN);
    if (match?.[1]) return `https://${match[1]}.supabase.co`;
  }
  return "";
}

function publicConfigFromEnvironment(cookies) {
  loadLocalEnvironment();
  const supabaseUrl = normalizeSupabaseUrl(
    process.env.PREMIUM_E2E_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    projectUrlFromCookies(cookies)
  );
  const anonKey = String(
    process.env.PREMIUM_E2E_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    ""
  ).trim();
  return {
    supabaseUrl,
    anonKey: isPublicSupabaseKey(anonKey) ? anonKey : ""
  };
}

function scanPublicConfigText(text, current = {}) {
  const input = String(text || "");
  let supabaseUrl = current.supabaseUrl || "";
  let anonKey = current.anonKey || "";
  if (!supabaseUrl) {
    const urlMatch = input.match(SUPABASE_URL_PATTERN)?.[0];
    if (urlMatch) supabaseUrl = normalizeSupabaseUrl(urlMatch);
  }
  if (!anonKey) {
    const publishable = input.match(PUBLISHABLE_KEY_PATTERN)?.find(isPublicSupabaseKey);
    if (publishable) anonKey = publishable;
  }
  if (!anonKey) {
    const legacy = input.match(LEGACY_ANON_KEY_PATTERN)?.find(isPublicSupabaseKey);
    if (legacy) anonKey = legacy;
  }
  return { supabaseUrl, anonKey };
}

async function discoverPublicConfig({ page, context, cookies }) {
  let config = publicConfigFromEnvironment(cookies);
  if (config.supabaseUrl && config.anonKey) return config;

  config = scanPublicConfigText(await page.content().catch(() => ""), config);
  if (config.supabaseUrl && config.anonKey) return config;

  const resourceUrls = await page.evaluate(() => {
    const scripts = Array.from(document.querySelectorAll("script[src]"), (element) => element.src);
    const resources = performance.getEntriesByType("resource").map((entry) => entry.name);
    return Array.from(new Set([...scripts, ...resources]));
  }).catch(() => []);

  for (const url of resourceUrls.slice(0, MAX_DISCOVERY_RESOURCES)) {
    if (config.supabaseUrl && config.anonKey) break;
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      continue;
    }
    if (parsed.origin !== page.url().replace(/^(https?:\/\/[^/]+).*$/, "$1")) continue;
    if (!/\.(?:js|json)(?:\?|$)/i.test(parsed.pathname)) continue;
    const response = await context.request.get(parsed.href, { timeout: 30_000 }).catch(() => null);
    if (!response?.ok()) continue;
    const body = await response.body().catch(() => null);
    if (!body || body.length > MAX_DISCOVERY_BODY_BYTES) continue;
    config = scanPublicConfigText(body.toString("utf8"), config);
  }

  if (!config.supabaseUrl) config.supabaseUrl = projectUrlFromCookies(cookies);
  return config;
}

async function discoverCanonicalOAuthHost(page) {
  loadLocalEnvironment();
  const explicit = normalizeHttpsHost(process.env.PREMIUM_E2E_OAUTH_RETURN_HOST || "");
  if (explicit) return explicit;

  const candidates = await page.evaluate(() => [
    document.querySelector('link[rel="canonical"]')?.getAttribute("href") || "",
    document.querySelector('meta[property="og:url"]')?.getAttribute("content") || "",
    document.querySelector('meta[name="twitter:url"]')?.getAttribute("content") || ""
  ]).catch(() => []);

  for (const candidate of candidates) {
    const host = normalizeHttpsHost(candidate);
    if (host) return host;
  }
  return "";
}

function normalizeSameSite(value) {
  const normalized = String(value || "lax").toLowerCase();
  if (normalized === "strict") return "Strict";
  if (normalized === "none") return "None";
  return "Lax";
}

function cookieExpiry(options = {}) {
  if (typeof options.maxAge === "number") {
    return Math.floor(Date.now() / 1000) + options.maxAge;
  }
  if (options.expires instanceof Date) return Math.floor(options.expires.getTime() / 1000);
  if (options.expires) {
    const parsed = Date.parse(String(options.expires));
    if (Number.isFinite(parsed)) return Math.floor(parsed / 1000);
  }
  return undefined;
}

function toTargetHostCookie(cookie, baseUrl) {
  return {
    name: cookie.name,
    value: cookie.value,
    domain: baseUrl.hostname,
    path: "/",
    secure: true,
    httpOnly: cookie.httpOnly === true,
    sameSite: normalizeSameSite(cookie.sameSite),
    ...(typeof cookie.expires === "number" && cookie.expires > 0 ? { expires: cookie.expires } : {})
  };
}

async function applyCookieWrites(context, baseUrl, writes) {
  const finalWrites = new Map();
  for (const item of writes) finalWrites.set(item.name, item);
  for (const item of finalWrites.values()) {
    await context.clearCookies({ name: item.name, domain: baseUrl.hostname }).catch(() => {});
  }
  const additions = [];
  for (const item of finalWrites.values()) {
    const options = item.options || {};
    if (!item.value || options.maxAge === 0) continue;
    const expires = cookieExpiry(options);
    additions.push({
      name: item.name,
      value: item.value,
      domain: baseUrl.hostname,
      path: "/",
      secure: true,
      httpOnly: options.httpOnly === true,
      sameSite: normalizeSameSite(options.sameSite),
      ...(typeof expires === "number" ? { expires } : {})
    });
  }
  if (additions.length) await context.addCookies(additions);
}

function cookieDomains(cookies) {
  return Array.from(new Set(cookies.filter(authCookie).map((cookie) => normalizeCookieDomain(cookie.domain)))).filter(Boolean).sort();
}

function cookiesForHost(cookies, host) {
  const normalizedHost = normalizeCookieDomain(host);
  return cookies.filter((cookie) => authCookie(cookie) && normalizeCookieDomain(cookie.domain) === normalizedHost);
}

async function normalizeTargetAuthCookies({ context, baseUrl, label }) {
  const targetCookies = await context.cookies(baseUrl.origin);
  const authCookies = targetCookies.filter(authCookie);
  requireCondition(
    authCookies.length > 0,
    FAILURE_CATEGORIES.AUTH,
    `local-auth-${label}`,
    "target_host_auth_cookie_missing_after_normalization"
  );

  for (const cookie of authCookies) {
    await context.clearCookies({ name: cookie.name, domain: cookie.domain }).catch(() => {});
  }
  await context.addCookies(authCookies.map((cookie) => toTargetHostCookie(cookie, baseUrl)));

  const normalizedCookies = await context.cookies(baseUrl.origin);
  const normalizedAuthCookies = normalizedCookies.filter(authCookie);
  requireCondition(
    normalizedAuthCookies.length > 0 && normalizedAuthCookies.every((cookie) =>
      normalizeCookieDomain(cookie.domain) === baseUrl.hostname.toLowerCase() &&
      cookie.secure === true &&
      cookie.path === "/"
    ),
    FAILURE_CATEGORIES.PRECONDITION,
    "configuration",
    "target_host_auth_cookie_normalization_failed"
  );
  return normalizedCookies;
}

async function bridgeCanonicalOAuthCookies({ context, page, baseUrl, allCookies, label }) {
  const canonicalHost = await discoverCanonicalOAuthHost(page);
  if (!canonicalHost || canonicalHost === baseUrl.hostname.toLowerCase()) return false;

  const sourceCookies = cookiesForHost(allCookies, canonicalHost);
  if (!sourceCookies.length) return false;

  for (const cookie of sourceCookies) {
    await context.clearCookies({ name: cookie.name, domain: baseUrl.hostname }).catch(() => {});
  }
  await context.addCookies(sourceCookies.map((cookie) => toTargetHostCookie(cookie, baseUrl)));

  const bridgedCookies = await context.cookies(baseUrl.origin);
  requireCondition(
    bridgedCookies.some(authCookie),
    FAILURE_CATEGORIES.AUTH,
    `local-auth-${label}`,
    "oauth_cookie_bridge_failed"
  );
  console.log(`[${label}] OAuth 세션을 ${canonicalHost}에서 Preview 호스트로 로컬 복제했습니다.`);
  return true;
}

async function captureFromPersistedCookies({
  label,
  profilePath,
  storageStatePath,
  baseUrl,
  previewBypassToken = ""
}) {
  const extraHTTPHeaders = previewBypassToken
    ? {
        "x-vercel-protection-bypass": previewBypassToken,
        "x-vercel-set-bypass-cookie": "true"
      }
    : {};
  const context = await chromium.launchPersistentContext(profilePath, {
    headless: true,
    viewport: { width: 1365, height: 900 },
    extraHTTPHeaders
  });

  try {
    const page = context.pages()[0] || await context.newPage();
    const response = await page.goto(baseUrl.origin, { waitUntil: "domcontentloaded", timeout: 60_000 });
    requireCondition(response && response.status() < 400, FAILURE_CATEGORIES.INFRASTRUCTURE, `local-auth-${label}`, "preview_navigation_failed");

    let targetCookies = await context.cookies(baseUrl.origin);
    let targetAuthCookies = targetCookies.filter(authCookie);
    if (!targetAuthCookies.length) {
      const allCookies = await context.cookies();
      const bridged = await bridgeCanonicalOAuthCookies({ context, page, baseUrl, allCookies, label });
      if (bridged) {
        targetCookies = await context.cookies(baseUrl.origin);
        targetAuthCookies = targetCookies.filter(authCookie);
      }

      if (!targetAuthCookies.length) {
        const otherDomains = cookieDomains(allCookies).filter((domain) => domain !== baseUrl.hostname.toLowerCase());
        if (otherDomains.length) {
          throw new JourneyFailure(
            FAILURE_CATEGORIES.AUTH,
            `local-auth-${label}`,
            "oauth_session_stored_on_different_host",
            `OAuth session host mismatch: ${otherDomains.join(", ")}`
          );
        }
        throw new JourneyFailure(
          FAILURE_CATEGORIES.AUTH,
          `local-auth-${label}`,
          "target_host_auth_cookie_missing"
        );
      }
    }

    targetCookies = await normalizeTargetAuthCookies({ context, baseUrl, label });
    const publicConfig = await discoverPublicConfig({ page, context, cookies: targetCookies });
    requireCondition(
      publicConfig.supabaseUrl && publicConfig.anonKey,
      FAILURE_CATEGORIES.PRECONDITION,
      `local-auth-${label}`,
      "supabase_public_config_missing_for_cookie_capture"
    );

    const jar = new Map(targetCookies.map((cookie) => [cookie.name, { name: cookie.name, value: cookie.value }]));
    const writes = [];
    const supabase = createServerClient(publicConfig.supabaseUrl, publicConfig.anonKey, {
      cookies: {
        getAll() {
          return Array.from(jar.values());
        },
        setAll(items) {
          for (const item of items) {
            jar.set(item.name, { name: item.name, value: item.value });
            writes.push(item);
          }
        }
      }
    });

    const sessionResult = await supabase.auth.getSession();
    requireCondition(
      !sessionResult.error && sessionResult.data?.session?.access_token,
      FAILURE_CATEGORIES.AUTH,
      `local-auth-${label}`,
      "persisted_cookie_session_invalid_or_expired"
    );
    await applyCookieWrites(context, baseUrl, writes);
    await normalizeTargetAuthCookies({ context, baseUrl, label });

    const session = sessionResult.data.session;
    const user = await fetchAuthUser({
      supabaseUrl: publicConfig.supabaseUrl,
      anonKey: publicConfig.anonKey,
      accessToken: session.access_token
    });
    const providers = Array.isArray(user?.app_metadata?.providers)
      ? user.app_metadata.providers
      : [user?.app_metadata?.provider].filter(Boolean);
    requireCondition(user?.is_anonymous === false, FAILURE_CATEGORIES.AUTH, `local-auth-${label}`, "test_account_must_be_permanent");
    requireCondition(providers.includes("google"), FAILURE_CATEGORIES.AUTH, `local-auth-${label}`, "test_account_must_use_google");

    const storageState = await context.storageState({ path: storageStatePath });
    inspectStorageState(storageState, baseUrl.hostname);
    return {
      accessToken: session.access_token,
      anonKey: publicConfig.anonKey,
      supabaseUrl: publicConfig.supabaseUrl,
      userId: user.id,
      userHash: hashIdentifier(user.id),
      provider: "google",
      storageStatePath
    };
  } finally {
    await context.close();
  }
}

export async function captureAccountSessionResilient(options) {
  let cookieError = null;
  try {
    return await captureFromPersistedCookies(options);
  } catch (error) {
    cookieError = error;
  }

  try {
    return await captureAccountSession({
      ...options,
      interactive: false,
      timeoutMs: Math.min(Number(options.timeoutMs || 8_000), 8_000)
    });
  } catch (networkError) {
    if (cookieError instanceof JourneyFailure) throw cookieError;
    throw networkError;
  }
}
