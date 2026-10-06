import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import test from "node:test";
import ts from "typescript";
import * as surveyContract from "@bejewely/shared/survey";
import { verifyMobilePublicEnv } from "./verify-mobile-public-env.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
function load(relative, imports = {}, globals = {}) {
  const filename = path.resolve(root, relative);
  const source = readFileSync(filename, "utf8");
  const js = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true,
    target: ts.ScriptTarget.ES2022
  } }).outputText;
  const module = { exports: {} };
  const context = { module, exports: module.exports,
    require(name) {
      if (Object.hasOwn(imports, name)) return imports[name];
      if (name.startsWith(".")) {
        const base = path.resolve(path.dirname(filename), name);
        const target = [base + ".ts", base + ".tsx"].find(existsSync);
        if (target) return load(path.relative(root, target), imports, globals);
      }
      throw new Error(`Unmocked import: ${name}`);
    },
    URL, URLSearchParams, Date, Math, Promise, Map, Set, Array, AbortController,
    setTimeout, clearTimeout, queueMicrotask, ...globals
  };
  vm.runInNewContext(js, context, { filename: relative });
  return module.exports;
}
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function session(owner) { return { user: { id: owner }, access_token: `fixture-${owner}` }; }
const redirect = "bejewely://auth/callback";

test("PKCE callback accepts approved code only and rejects injected tokens/URLs", () => {
  const { parseNativeAuthCode } = load("apps/mobile/lib/auth-callback.ts");
  assert.equal(parseNativeAuthCode(`${redirect}?code=fixture-code`, redirect), "fixture-code");
  for (const value of [
    `${redirect}#access_token=x&refresh_token=y`, `${redirect}?access_token=x&refresh_token=y`,
    `${redirect}?code=x&access_token=y`, `${redirect}?code=x&code=y`,
    "https://example.invalid/auth/callback?code=x", "bejewely://evil/callback?code=x",
    "bejewely://auth/callback/extra?code=x", "bejewely://user@auth/callback?code=x",
    `${redirect}?error=denied`, `${redirect}?code=${"x".repeat(9000)}`
  ]) assert.throws(() => parseNativeAuthCode(value, redirect));
});

test("request ownership rejects A response after B, logout, unmount and reversed navigation", () => {
  const scope = load("apps/mobile/lib/request-scope.ts").createNativeRequestScope();
  scope.setOwner("A"); const a = scope.begin("dashboard");
  scope.setOwner("B"); const b = scope.begin("dashboard");
  assert.equal(scope.isCurrent(a), false); assert.equal(scope.isCurrent(b), true);
  const oldMonth = scope.begin("dashboard"); const newMonth = scope.begin("dashboard");
  assert.equal(scope.isCurrent(oldMonth), false); assert.equal(scope.isCurrent(newMonth), true);
  scope.setOwner(null); assert.equal(scope.isCurrent(newMonth), false);
  scope.setOwner("A"); const mounted = scope.begin("detail");
  scope.invalidate(); assert.equal(scope.isCurrent(mounted), false);
});

function authModule(client, extra = {}) {
  return load("apps/mobile/lib/auth.ts", {
    "expo-apple-authentication": {}, "expo-linking": {}, "expo-crypto": {},
    "./env": {}, "./supabase": { getMobileSupabaseClient: () => client }, ...extra
  });
}

test("initial session read cannot overwrite a newer auth event", async () => {
  const initial = deferred(); let event; const seen = [];
  const auth = authModule({ auth: {
    getSession: () => initial.promise,
    onAuthStateChange: (callback) => { event = callback; return { data: { subscription: { unsubscribe() {} } } }; }
  } });
  const stop = auth.observeNativeSession((value) => seen.push(value?.user.id ?? null));
  event("SIGNED_IN", session("B"));
  initial.resolve({ data: { session: session("A") }, error: null }); await flush();
  assert.deepEqual(seen, ["B"]); stop();
  event("SIGNED_OUT", null); assert.deepEqual(seen, ["B"]);
});

test("duplicate PKCE callback performs one exchange and token fallback never sets session", async () => {
  const exchange = deferred(); let exchanges = 0; let direct = 0;
  const auth = authModule({ auth: {
    exchangeCodeForSession: () => { exchanges++; return exchange.promise; },
    setSession: () => { direct++; }, getSession: async () => ({ data: { session: session("A") } })
  } });
  await assert.rejects(auth.completeNativeAuthFromUrl(`${redirect}#access_token=x&refresh_token=y`));
  const a = auth.completeNativeAuthFromUrl(`${redirect}?code=fixture`);
  const b = auth.completeNativeAuthFromUrl(`${redirect}?code=fixture`);
  exchange.resolve({ data: { session: session("A") }, error: null });
  await Promise.all([a, b]); await auth.completeNativeAuthFromUrl(`${redirect}?code=fixture`);
  assert.equal(exchanges, 1); assert.equal(direct, 0);
});

test("Apple sends hashed nonce to provider and raw nonce to auth verification", async () => {
  let appleOptions, authOptions;
  const auth = authModule({ auth: { signInWithIdToken: async (options) => {
    authOptions = options; return { data: { session: { ...session("A"), user: { id: "A", user_metadata: {} } } } };
  } } }, {
    "expo-crypto": { getRandomBytesAsync: async () => new Uint8Array(32).fill(7),
      CryptoDigestAlgorithm: { SHA256: "SHA-256" }, digestStringAsync: async (_algorithm, nonce) => `hash-${nonce}` },
    "expo-apple-authentication": { isAvailableAsync: async () => true,
      AppleAuthenticationScope: { FULL_NAME: "name", EMAIL: "email" },
      signInAsync: async (options) => { appleOptions = options; return { identityToken: "fixture-id-token" }; } }
  });
  await auth.signInNativeWithApple();
  assert.equal(authOptions.nonce, "07".repeat(32));
  assert.equal(appleOptions.nonce, `hash-${authOptions.nonce}`);
});

test("SDK session mutations serialize A deletion cleanup before B callback; stale logout never signs B out", async () => {
  const signout = deferred(); let owner = "A", exchanges = 0, signouts = 0, rawClears = 0;
  const auth = authModule({ auth: {
    getSession: async () => ({ data: { session: session(owner) }, error: null }),
    signOut: async () => { signouts++; await signout.promise; owner = null; return { error: null }; },
    exchangeCodeForSession: async () => { exchanges++; owner = "B"; return { data: { session: session("B") }, error: null }; }
  } }, { "./supabase": { getMobileSupabaseClient: () => ({ auth: {
    getSession: async () => ({ data: { session: owner ? session(owner) : null }, error: null }),
    signOut: async () => { signouts++; await signout.promise; owner = null; return { error: null }; },
    exchangeCodeForSession: async () => { exchanges++; owner = "B"; return { data: { session: session("B") }, error: null }; }
  } }), clearMobileSupabaseSessionStorage: async () => { rawClears++; } } });
  const clear = auth.clearNativeSessionAfterAccountDeletion("A"); await flush();
  const signin = auth.completeNativeAuthFromUrl(`${redirect}?code=B-login`); await flush();
  assert.equal(exchanges, 0); signout.resolve(); await clear; await signin;
  assert.equal(owner, "B"); assert.equal(rawClears, 0);
  await auth.signOutNative("A"); assert.equal(signouts, 1); assert.equal(owner, "B");
  assert.equal(await auth.clearNativeSessionAfterAccountDeletion("A"), false);
  assert.equal(signouts, 1);
});

test("transport deadline bounds a fetch ignoring abort and a stalled response body", async () => {
  for (const fetch of [() => new Promise(() => {}), async () => ({ clone: () => ({ text: () => new Promise(() => {}) }) })]) {
    const request = load("apps/mobile/lib/request.ts", {}, { fetch });
    await assert.rejects(request.fetchWithTimeout("https://example.invalid", {}, 5), { code: "mobile_request_timeout" });
  }
});

test("caller cancellation aborts transport and removes listeners after success", async () => {
  let signal;
  const request = load("apps/mobile/lib/request.ts", {}, { fetch: async (_url, options) => {
    signal = options.signal;
    return { clone: () => ({ text: async () => "{}" }) };
  } });
  const controller = new AbortController();
  await request.fetchWithTimeout("https://example.invalid", { signal: controller.signal });
  controller.abort(); assert.equal(signal.aborted, false);
  await assert.rejects(request.fetchWithTimeout("https://example.invalid", { signal: controller.signal }), { code: "mobile_request_cancelled" });
});

test("timeout ends waiting but does not release an upload photo before the native transport settles", async () => {
  const transport = deferred(); let released = 0;
  const request = load("apps/mobile/lib/request.ts", {}, { fetch: () => transport.promise });
  await assert.rejects(request.fetchWithTimeout("https://example.invalid", {}, 5, () => { released++; }), { code: "mobile_request_timeout" });
  assert.equal(released, 0);
  transport.resolve({ clone: () => ({ text: async () => "{}" }) }); await flush();
  assert.equal(released, 1);
});

// Deterministic hook scheduling runs the actual screen effects and event handlers.
// This is logic regression evidence, not native rendering or gesture verification.
function hooks() {
  const slots = []; let cursor = 0; let pending = []; let changed = false;
  const same = (a, b) => a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
  const react = { __esModule: true,
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState(initial) {
      const i = cursor++; if (!slots[i]) slots[i] = { value: typeof initial === "function" ? initial() : initial };
      return [slots[i].value, (next) => {
        const value = typeof next === "function" ? next(slots[i].value) : next;
        if (!Object.is(value, slots[i].value)) { slots[i].value = value; changed = true; }
      }];
    },
    useRef(initial) { const i = cursor++; return (slots[i] ??= { current: initial }); },
    useMemo(factory, deps) {
      const i = cursor++; if (!slots[i] || !same(slots[i].deps, deps)) slots[i] = { deps, value: factory() };
      return slots[i].value;
    },
    useCallback(callback, deps) { return react.useMemo(() => callback, deps); },
    useEffect(effect, deps) {
      const i = cursor++; const previous = slots[i];
      if (!previous || !same(previous.deps, deps)) {
        slots[i] = { deps, cleanup: previous?.cleanup };
        pending.push(() => { slots[i].cleanup?.(); slots[i].cleanup = effect(); });
      }
    }
  };
  let component, tree;
  function render() { cursor = 0; changed = false; tree = component(); const effects = pending; pending = []; effects.forEach((run) => run()); }
  return { react, mount(value) { component = value; render(); },
    async settle() { for (let i = 0; i < 15; i++) { await flush(); if (changed) render(); else break; } return tree; },
    tree() { return tree; }, unmount() { slots.forEach((slot) => slot?.cleanup?.()); }
  };
}
function find(node, predicate) {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) { for (const value of node) { const result = find(value, predicate); if (result) return result; } return null; }
  if (predicate(node)) return node;
  return find(node.props?.children, predicate);
}

test("actual My screen keeps B dashboard/form after delayed A; logout discards pending response", async () => {
  const h = hooks(); let event; const calls = [];
  const model = load("apps/mobile/lib/my.ts", { "./env": {} });
  const screen = load("apps/mobile/app/my.tsx", {
    react: h.react, "react-native": { StyleSheet: { create: (value) => value },
      AppState: { addEventListener: () => ({ remove() {} }) }, Alert: { alert() {} } },
    "expo-router": { useIsFocused: () => true },
    "../components/ScreenShell": { ScreenShell: "shell" }, "../components/NativeAppleSignInButton": {},
    "../features/my/NativeMyDiaryView": { NativeMyDiaryView: "diary" },
    "../lib/auth": { observeNativeSession: (callback) => { event = callback; callback(session("A")); return () => {}; } },
    "../lib/copy": { MOBILE_COPY: { ko: { my: {} } } },
    "../lib/mobile-shell": { useMobileShell: () => ({ locale: "ko", palette: {} }) },
    "../lib/supabase": { getMobileSupabaseClient: () => ({}) },
    "../lib/my": { ...model, getNativeLocalDate: () => "2026-10-03", getNativeDiaryMonth: () => "2026-10",
      fetchNativeMyDashboard: (user, options) => { const result = deferred(); calls.push({ owner: user.user.id, options, ...result }); return result.promise; } }
  }, { React: h.react, setInterval: () => 1, clearInterval() {} });
  h.mount(screen.default); await h.settle(); event(session("B")); await h.settle();
  const dashboard = (owner) => ({ hasProfile: true, fixtureOwner: owner, todayCheckin: {
    checkin_date: "2026-10-03", memo: `memo ${owner}`, context: {} } });
  calls[1].resolve(dashboard("B")); await h.settle(); calls[0].resolve(dashboard("A")); await h.settle();
  assert.equal(find(h.tree(), (node) => node.type === "diary").props.dashboard.fixtureOwner, "B");
  assert.equal(find(h.tree(), (node) => typeof node.props?.onChangeText === "function").props.value, "memo B");
  event(session("A")); await h.settle(); event(null); await h.settle();
  calls[2].resolve(dashboard("A")); await h.settle();
  assert.equal(find(h.tree(), (node) => node.type === "diary"), null);
  h.unmount();
});

test("actual My draft survives token refresh and midnight; yesterday's draft cannot be saved silently", async () => {
  const h = hooks(); let event, tick, confirm; let date = "2026-10-03"; const reads = [], saves = [];
  const model = load("apps/mobile/lib/my.ts", { "./env": {} });
  const screen = load("apps/mobile/app/my.tsx", {
    react: h.react, "react-native": { StyleSheet: { create: (value) => value },
      AppState: { addEventListener: () => ({ remove() {} }) }, Alert: { alert: (_title, _body, options) => { confirm = options.at(-1).onPress; } } },
    "expo-router": { useIsFocused: () => true },
    "../components/ScreenShell": { ScreenShell: "shell" }, "../components/NativeAppleSignInButton": {},
    "../features/my/NativeMyDiaryView": { NativeMyDiaryView: "diary" },
    "../lib/auth": { observeNativeSession: (callback) => { event = callback; callback(session("A")); return () => {}; } },
    "../lib/copy": { MOBILE_COPY: { ko: { my: {} } } },
    "../lib/mobile-shell": { useMobileShell: () => ({ locale: "ko", palette: {} }) },
    "../lib/supabase": { getMobileSupabaseClient: () => ({}) },
    "../lib/my": { ...model, getNativeLocalDate: () => date, getNativeDiaryMonth: () => date.slice(0, 7),
      fetchNativeMyDashboard: () => { const value = deferred(); reads.push(value); return value.promise; },
      saveNativeCheckin: async (user, value) => { saves.push({ owner: user.user.id, ...value }); } }
  }, { React: h.react, setInterval: (callback) => { tick = callback; return 1; }, clearInterval() {} });
  const dashboard = () => ({ hasProfile: true, todayCheckin: { checkin_date: date, memo: "server memo", context: {} } });
  const memo = () => find(h.tree(), (node) => typeof node.props?.onChangeText === "function");
  h.mount(screen.default); await h.settle(); reads[0].resolve(dashboard()); await h.settle();
  const staleEdit = memo().props.onChangeText;
  memo().props.onChangeText("unsaved draft"); await h.settle();
  event({ ...session("A"), access_token: "fixture-refreshed" }); await h.settle();
  assert.equal(memo().props.value, "unsaved draft"); assert.equal(reads.length, 1);
  date = "2026-10-04"; tick(); await h.settle(); reads[1].resolve(dashboard()); await h.settle();
  assert.equal(memo().props.value, "unsaved draft");
  byId(h, "mobile-checkin-save").props.onPress(); await h.settle(); assert.equal(saves.length, 0); assert.ok(confirm);
  confirm(); await h.settle(); reads[2].resolve(dashboard()); await h.settle();
  byId(h, "mobile-checkin-save").props.onPress(); await h.settle();
  assert.equal(saves[0].checkinDate, "2026-10-04");
  event(session("B")); await h.settle(); staleEdit("A's stale draft"); await h.settle();
  assert.notEqual(memo()?.props.value, "A's stale draft"); h.unmount();
});

test("actual shell palette keeps text and filled actions at readable contrast in both themes", () => {
  const luminance = (hex) => {
    const channels = hex.slice(1).match(/../g).map((part) => parseInt(part, 16) / 255)
      .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  const ratio = (a, b) => { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  for (const scheme of ["light", "dark"]) {
    const h = hooks();
    const module = load("apps/mobile/lib/mobile-shell.tsx", {
      react: { ...h.react, createContext: () => ({ Provider: "provider" }) },
      "expo-localization": { getLocales: () => [] }, "react-native": { useColorScheme: () => scheme }
    }, { React: h.react });
    h.mount(() => module.MobileShellProvider({ children: [] }));
    const p = h.tree().props.value.palette;
    for (const surface of [p.background, p.surface, p.surfaceMuted]) {
      assert.ok(ratio(p.text, surface) >= 4.5, `${scheme} body text contrast`);
      assert.ok(ratio(p.textMuted, surface) >= 4.5, `${scheme} supporting text contrast`);
      assert.ok(ratio(p.accentText, surface) >= 4.5, `${scheme} accent text contrast`);
    }
    assert.ok(ratio(p.action, p.actionText) >= 4.5, `${scheme} action contrast`); h.unmount();
  }
});

test("release public config rejects missing values, local HTTP, wrong origin and secret credentials", () => {
  const origin = JSON.parse(readFileSync(path.join(root, "apps/mobile/store-readiness.json"))).mobile14Contract.canonicalWebOrigin;
  const values = { EXPO_PUBLIC_API_BASE_URL: origin, EXPO_PUBLIC_SUPABASE_URL: "https://fixture.supabase.co",
    EXPO_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_fixture" };
  assert.equal(verifyMobilePublicEnv(values), true);
  for (const key of Object.keys(values)) assert.throws(() => verifyMobilePublicEnv({ ...values, [key]: "" }));
  for (const url of ["http://fixture.invalid", "https://localhost", "https://192.168.1.1", "https://user:password@fixture.invalid", "https://fixture.invalid?secret=x"]) {
    assert.throws(() => verifyMobilePublicEnv({ ...values, EXPO_PUBLIC_API_BASE_URL: url }));
  }
  for (const key of ["sb_secret_fixture", `x.${Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url")}.x`]) {
    assert.throws(() => verifyMobilePublicEnv({ ...values, EXPO_PUBLIC_SUPABASE_ANON_KEY: key }));
  }
});

test("photo cleanup is confined to owned cache and deferred until upload leases settle", async () => {
  const deleted = [];
  const cache = load("apps/mobile/lib/photo-cache.ts", {
    "expo-file-system/legacy": { cacheDirectory: "file:///app/cache/",
      deleteAsync: async (uri) => { deleted.push(uri); } }
  });
  for (const uri of ["file:///app/documents/private.jpg", "https://fixture.invalid/photo.jpg", "file:///app/cache/../private.jpg", "file:///app/cache/%252e%252e/private.jpg", "file:///app/cache/photo.jpg?x=1"]) {
    assert.equal(await cache.cleanupNativePhoto(uri), false);
  }
  const release = cache.retainNativePhoto("file:///app/cache/camera/photo.jpg");
  assert.equal(await cache.cleanupNativePhoto("file:///app/cache/camera/photo.jpg"), false);
  assert.equal(deleted.length, 0); release(); release(); await flush();
  assert.deepEqual(deleted, ["file:///app/cache/camera/photo.jpg"]);
});

test("actual analyze client requires consent before auth/network and preserves key for 409/429 retry", async () => {
  let authReads = 0; const calls = []; let code = "analysis_request_in_progress"; let status = 409;
  const client = load("apps/mobile/features/analyze/analyze-client.ts", {
    "../../lib/auth": { getNativeSession: async () => { authReads++; return session("A"); } },
    "../../lib/env": { getMobileApiBaseUrl: () => "https://fixture.invalid" },
    "../../lib/survey-contract": surveyContract,
    "../../lib/photo-cache": { retainNativePhoto: () => () => {} },
    "../../lib/request": { MOBILE_ANALYZE_TIMEOUT_MS: 180000, NativeTransportError: class extends Error {},
      fetchWithTimeout: async (_url, options) => { calls.push(options); return {
        ok: false, status, headers: { get: () => "23" }, json: async () => ({ error: code })
      }; } }
  }, { FormData: class { append() {} } });
  const input = { photo: { uri: "file:///fixture.jpg", name: "fixture.jpg", type: "image/jpeg" },
    form: surveyContract.SURVEY_INITIAL_FORM, locale: "en", idempotencyKey: "fixture-same-input", expectedUserId: "A" };
  await assert.rejects(client.submitNativeAnalyze(input), { code: "mobile_analyze_consent_required" });
  assert.equal(authReads, 0); assert.equal(calls.length, 0);
  for (const error of ["analysis_request_in_progress", "analysis_request_already_completed", "analysis_idempotency_conflict", "analysis_request_failed"]) {
    code = error;
    await assert.rejects(client.submitNativeAnalyze({ ...input, consentAccepted: true }), (value) => value.code === error && value.retryAfterSeconds === 23);
  }
  status = 429; code = "rate_limited";
  await assert.rejects(client.submitNativeAnalyze({ ...input, consentAccepted: true }), (value) => value.status === 429 && value.retryAfterSeconds === 23);
  assert.equal(calls.every((call) => call.headers["Idempotency-Key"] === "fixture-same-input"), true);
  const before = calls.length;
  await assert.rejects(client.submitNativeAnalyze({ ...input, consentAccepted: true, expectedUserId: "B" }), { code: "mobile_analyze_account_changed" });
  assert.equal(calls.length, before);
});

function screenFixture(relative, extra = {}, globals = {}) {
  const h = hooks(); let event; let lifecycle;
  const screen = load(relative, {
    react: h.react,
    "react-native": { StyleSheet: { create: (value) => value },
      AppState: { addEventListener: (_name, callback) => { lifecycle = callback; return { remove() {} }; } },
      Alert: { alert() {} }, ...extra["react-native"] },
    "expo-router": { useIsFocused: () => true, useRouter: () => ({ push() {}, replace() {} }), ...extra["expo-router"] },
    "../components/ScreenShell": { ScreenShell: "shell" },
    "../lib/auth": { observeNativeSession: (callback) => { event = callback; callback(session("A")); return () => {}; } },
    "../lib/mobile-shell": { useMobileShell: () => ({ locale: "en", palette: {} }) }, ...extra
  }, { React: h.react, setInterval: () => 1, clearInterval() {}, ...globals });
  h.mount(screen.default);
  return { h, auth: (value) => event(value), background: () => lifecycle("background") };
}
const byId = (h, id) => find(h.tree(), (node) => node.props?.testID === id);

test("actual Analyze screen resets consent on input change and keeps key across manual retry/background", async () => {
  const calls = []; let keys = 0;
  class AnalyzeError extends Error { constructor() { super("fixture retry"); this.retryAfterSeconds = null; } }
  const { h, auth, background } = screenFixture("apps/mobile/app/analyze.tsx", {
    "../lib/copy": { MOBILE_COPY: { en: { analyze: { camera: {} } } } },
    "../lib/survey-contract": surveyContract,
    "../features/camera/NativeFaceCamera": { NativeFaceCamera: "camera" },
    "../features/analyze/NativeAnalyzeSurvey": { NativeAnalyzeSurvey: "survey" },
    "../features/analyze/NativeAnalyzeResult": { NativeAnalyzeResultView: "result" },
    "../lib/photo-cache": { cleanupNativePhoto: async () => true, retainNativePhoto: () => () => {} },
    "../features/analyze/analyze-client": {
      isNativeAnalyzeFormReady: () => true, NativeAnalyzeRequestError: AnalyzeError,
      createNativeAnalyzeIdempotencyKey: () => `fixture-key-${++keys}`,
      submitNativeAnalyze: (input) => { const result = deferred(); calls.push({ input, ...result }); return result.promise; }
    }
  });
  await h.settle();
  const photo = (uri) => ({ uri, name: "fixture.jpg", type: "image/jpeg" });
  find(h.tree(), (node) => node.type === "camera").props.onPhotoChange(photo("file:///fixture-a.jpg")); await h.settle();
  byId(h, "native-analyze-submit").props.onPress(); await h.settle(); assert.equal(calls.length, 0);
  byId(h, "native-analyze-consent").props.onPress(); await h.settle();
  const staleConsent = byId(h, "native-analyze-consent").props.onPress;
  const submit = byId(h, "native-analyze-submit").props.onPress;
  submit(); submit(); await h.settle(); assert.equal(calls.length, 1);
  calls[0].reject(new AnalyzeError()); await h.settle();
  byId(h, "native-analyze-submit").props.onPress(); await h.settle();
  assert.equal(calls[1].input.idempotencyKey, calls[0].input.idempotencyKey);
  background(); await h.settle(); assert.equal(calls[1].input.signal.aborted, true);
  calls[1].resolve({ summary: "late" }); await h.settle();
  assert.equal(find(h.tree(), (node) => node.type === "result"), null);
  find(h.tree(), (node) => node.type === "survey").props.onChange({ ...surveyContract.SURVEY_INITIAL_FORM, sensitivity: "high" }); await h.settle();
  staleConsent(); await h.settle();
  assert.equal(byId(h, "native-analyze-consent").props.accessibilityState.checked, false);
  assert.equal(byId(h, "native-analyze-submit").props.disabled, true);
  auth(session("B")); await h.settle(); assert.equal(byId(h, "native-analyze-consent"), null);
  h.unmount();
});

test("actual saved report screen discards A publication after B and retains published state when sharing cancelled", async () => {
  const reads = [], publishes = []; let shares = 0;
  const { h, auth } = screenFixture("apps/mobile/app/saved-report.tsx", {
    "react-native": { StyleSheet: { create: (value) => value }, Share: { share: async () => { shares++; return { action: "dismissedAction" }; } } },
    "../features/reports/NativeSavedReport": { NativeSavedReport: "report" },
    "../features/reports/saved-report-client": { loadLatestNativeSavedReport: (user) => {
      const value = deferred(); reads.push({ owner: user.user.id, ...value }); return value.promise;
    } },
    "../features/reports/public-share-client": { publishNativeFreeSavedReport: (user) => {
      const value = deferred(); publishes.push({ owner: user.user.id, ...value }); return value.promise;
    } }
  });
  await h.settle();
  reads.at(-1).resolve({ status: "loaded", value: { kind: "free", shareId: "A-report" } }); await h.settle();
  const stalePublish = byId(h, "native-free-public-share-button").props.onPress;
  stalePublish(); stalePublish(); await h.settle(); assert.equal(publishes.length, 1);
  auth(session("B")); await h.settle();
  publishes[0].resolve({ shareUrl: "https://fixture.invalid/r/A" }); await h.settle(); assert.equal(shares, 0);
  reads.at(-1).resolve({ status: "loaded", value: { kind: "free", shareId: "B-report" } }); await h.settle();
  stalePublish(); await h.settle(); assert.equal(publishes.length, 1);
  byId(h, "native-free-public-share-button").props.onPress(); await h.settle();
  publishes[1].resolve({ shareUrl: "https://fixture.invalid/r/B" }); await h.settle();
  assert.equal(shares, 1); assert.ok(byId(h, "native-free-public-share-published"));
  const afterUnmount = byId(h, "native-free-public-share-button").props.onPress;
  h.unmount(); afterUnmount(); await flush(); assert.equal(publishes.length, 2);
});

test("actual Premium screen discards old-owner creation and ignores stale finalization handlers", async () => {
  const access = [], creates = []; const destinations = [];
  const { h, auth } = screenFixture("apps/mobile/app/premium.tsx", {
    "expo-router": { useIsFocused: () => true, useRouter: () => ({ replace: (path) => destinations.push(path), push() {} }) },
    "../features/premium/NativeCurrentProductsSelector": { NativeCurrentProductsSelector: "selector" },
    "../features/premium/premium-client": { NativePremiumRequestError: class extends Error {},
      loadNativePremiumAccess: (user) => { const value = deferred(); access.push({ owner: user.user.id, ...value }); return value.promise; },
      createNativePremiumReport: (input) => { const value = deferred(); creates.push({ input, ...value }); return value.promise; } }
  });
  await h.settle(); access.at(-1).resolve({ canCreatePremium: true }); await h.settle();
  const staleCreate = byId(h, "native-premium-create").props.onPress;
  staleCreate(); staleCreate(); await h.settle(); assert.equal(creates.length, 1);
  auth(session("B")); await h.settle(); creates[0].resolve({}); await h.settle();
  assert.equal(destinations.length, 0);
  access.at(-1).resolve({ canCreatePremium: true }); await h.settle();
  staleCreate(); await h.settle(); assert.equal(creates.length, 1);
  byId(h, "native-premium-create").props.onPress(); await h.settle();
  assert.equal(creates[1].input.session.user.id, "B"); creates[1].resolve({}); await h.settle();
  assert.deepEqual(destinations, ["/saved-report"]);
  const afterUnmount = byId(h, "native-premium-create").props.onPress;
  h.unmount(); afterUnmount(); await flush(); assert.equal(creates.length, 2);
});

test("actual account deletion card never clears B session after delayed A deletion", async () => {
  const h = hooks(); let owner = "A", confirmation; const deletion = deferred(); let clears = 0, notified = 0, writes = 0;
  const card = load("apps/mobile/components/NativeAccountDeletionCard.tsx", {
    react: h.react, "react-native": { StyleSheet: { create: (value) => value }, Alert: { alert: (_title, _body, buttons) => { confirmation = buttons.at(-1).onPress; } } },
    "../lib/mobile-shell": { useMobileShell: () => ({ locale: "en", palette: {} }) }, "../lib/env": {},
    "../lib/auth": { getNativeSession: async () => session(owner), clearNativeSessionAfterAccountDeletion: async () => { clears++; } },
    "../lib/account-deletion": { nativeAccountDeletionNeedsAppleReauthorization: () => false,
      deleteNativeAccount: () => { writes++; return deletion.promise; } }
  }, { React: h.react });
  h.mount(() => card.NativeAccountDeletionCard({ session: session("A"), onDeleted: () => { notified++; } }));
  byId(h, "mobile-account-delete").props.onPress(); confirmation(); confirmation(); await h.settle();
  assert.equal(writes, 1); owner = "B"; deletion.resolve({}); await h.settle();
  assert.equal(clears, 0); assert.equal(notified, 0); h.unmount();
});

test("actual camera discards and cleans a final photo returned after hardware-back close", async () => {
  const h = hooks(), picture = deferred(); const accepted = [], deleted = [];
  const camera = load("apps/mobile/features/camera/NativeFaceCamera.tsx", {
    react: h.react, "expo-camera": { CameraView: "camera-view", useCameraPermissions: () => [{ granted: true }, async () => {}] },
    "expo-router": { useFocusEffect: (callback) => h.react.useEffect(callback, [callback]) },
    "react-native": { StyleSheet: { create: (value) => value }, Modal: "modal" },
    "react-native-safe-area-context": { SafeAreaView: "safe" },
    "../../lib/photo-cache": { cleanupNativePhoto: async (uri) => { deleted.push(uri); return true; } },
    "../../modules/bejewely-face-guide/src/BejewelyFaceGuideModule": { isNativeFaceGuideAvailable: () => false }
  }, { React: h.react, setInterval: () => 1, clearInterval() {} });
  h.mount(() => camera.NativeFaceCamera({ palette: {}, onPhotoChange: (photo) => accepted.push(photo),
    copy: { capture: "Capture", closeCamera: "Close", guidance: { loading: "Guide", unavailable: "Unavailable" } } }));
  await h.settle();
  const view = find(h.tree(), (node) => node.type === "camera-view");
  view.props.ref.current = { takePictureAsync: () => picture.promise }; view.props.onCameraReady(); await h.settle();
  find(h.tree(), (node) => node.props?.accessibilityLabel === "Capture").props.onPress(); await h.settle();
  find(h.tree(), (node) => node.type === "modal").props.onRequestClose(); await h.settle();
  picture.resolve({ uri: "file:///app/cache/late-photo.jpg", width: 100, height: 100 }); await h.settle();
  assert.equal(accepted.length, 0); assert.deepEqual(deleted, ["file:///app/cache/late-photo.jpg"]); h.unmount();
});
