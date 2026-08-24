import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

const PRODUCT_STORAGE_KEYS = ["skinTestResult", "pendingSaveReport"];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function readStoredJson(storage, key) {
  const raw = storage.getItem(key);
  if (!raw) return { raw: null, value: null };

  try {
    return { raw, value: JSON.parse(raw) };
  } catch {
    return { raw, value: null };
  }
}

function collectProductIds(value, ids) {
  if (Array.isArray(value)) {
    for (const item of value) collectProductIds(item, ids);
    return;
  }

  if (!value || typeof value !== "object") return;

  const id = typeof value.id === "string" ? value.id.trim() : "";
  const looksLikeProduct = id && UUID_RE.test(id) && (typeof value.name === "string" || typeof value.brand === "string");
  if (looksLikeProduct) ids.add(id);

  for (const child of Object.values(value)) collectProductIds(child, ids);
}

function localizeProducts(value, localizedById) {
  if (Array.isArray(value)) {
    return value.map((item) => localizeProducts(item, localizedById));
  }

  if (!value || typeof value !== "object") return value;

  const localized = typeof value.id === "string" ? localizedById.get(value.id) : null;
  const next = {};

  for (const [key, child] of Object.entries(value)) {
    next[key] = localizeProducts(child, localizedById);
  }

  if (!localized) return next;

  if (typeof value.name === "string" && localized.name_en) {
    next.name = localized.name_en;
  }
  if (typeof value.brand === "string" && localized.brand_en) {
    next.brand = localized.brand_en;
  }

  return next;
}

async function loadEnglishProductDisplayMap(productIds) {
  if (!productIds.size) return new Map();

  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase
    .from("products")
    .select("id,name_en,brand_en")
    .in("id", [...productIds]);

  if (error || !Array.isArray(data)) {
    return new Map();
  }

  return new Map(
    data
      .filter((row) => row?.id && (row?.name_en || row?.brand_en))
      .map((row) => [row.id, row])
  );
}

export async function localizeProductPayloadForEnglish(value) {
  if (!value || typeof value !== "object") return value;

  const productIds = new Set();
  collectProductIds(value, productIds);

  if (!productIds.size) return value;

  const localizedById = await loadEnglishProductDisplayMap(productIds);
  return localizedById.size ? localizeProducts(value, localizedById) : value;
}

export async function localizeStoredProductsForEnglish(storage = globalThis?.sessionStorage) {
  if (!storage) return () => {};

  const snapshots = new Map();
  const parsedByKey = new Map();
  const productIds = new Set();

  for (const key of PRODUCT_STORAGE_KEYS) {
    const { raw, value } = readStoredJson(storage, key);
    snapshots.set(key, raw);
    if (value) {
      parsedByKey.set(key, value);
      collectProductIds(value, productIds);
    }
  }

  if (!productIds.size) return () => {};

  const localizedById = await loadEnglishProductDisplayMap(productIds);
  if (!localizedById.size) return () => {};

  for (const [key, value] of parsedByKey) {
    storage.setItem(key, JSON.stringify(localizeProducts(value, localizedById)));
  }

  return () => {
    for (const [key, raw] of snapshots) {
      if (raw === null) storage.removeItem(key);
      else storage.setItem(key, raw);
    }
  };
}

function isFullReportRequest(input) {
  try {
    const rawUrl = typeof input === "string"
      ? input
      : input instanceof Request
        ? input.url
        : String(input || "");
    const url = new URL(rawUrl, globalThis.location?.origin || "http://localhost");
    return url.pathname === "/api/full-report";
  } catch {
    return false;
  }
}

export function installEnglishFullReportResponseLocalization() {
  if (typeof globalThis.fetch !== "function") return () => {};

  const originalFetch = globalThis.fetch.bind(globalThis);
  const localizedFetch = async (...args) => {
    const response = await originalFetch(...args);

    if (!response.ok || !isFullReportRequest(args[0])) {
      return response;
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return response;
    }

    const payload = await response.clone().json().catch(() => null);
    if (!payload || typeof payload !== "object") {
      return response;
    }

    const localizedPayload = await localizeProductPayloadForEnglish(payload);
    if (localizedPayload === payload) {
      return response;
    }

    const headers = new Headers(response.headers);
    headers.set("content-type", "application/json");

    return new Response(JSON.stringify(localizedPayload), {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  };

  globalThis.fetch = localizedFetch;

  return () => {
    if (globalThis.fetch === localizedFetch) {
      globalThis.fetch = originalFetch;
    }
  };
}
