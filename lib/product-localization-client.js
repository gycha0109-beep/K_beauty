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

  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase
    .from("products")
    .select("id,name_en,brand_en")
    .in("id", [...productIds]);

  if (error || !Array.isArray(data)) {
    return () => {};
  }

  const localizedById = new Map(
    data
      .filter((row) => row?.id && (row?.name_en || row?.brand_en))
      .map((row) => [row.id, row])
  );

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
