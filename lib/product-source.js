import { createClient } from "@supabase/supabase-js";
import * as core from "./product-source-core.js";
import {
  attachRecommendationMetadataTransport,
  identifyRecommendationMetadataFallbacks
} from "./recommendation-metadata-transport.js";

export const PRODUCT_SOURCE_UNAVAILABLE_CODE = core.PRODUCT_SOURCE_UNAVAILABLE_CODE;
export const ProductSourceUnavailableError = core.ProductSourceUnavailableError;
export const isProductSourceUnavailableError = core.isProductSourceUnavailableError;

const METADATA_CACHE_TTL_MS = 5 * 60 * 1000;
const METADATA_SELECT_FIELDS = [
  "id",
  "skin_types",
  "concerns",
  "texture",
  "finish",
  "irritation_risk",
  "sensitivity_safe",
  "cleansing_profile",
  "balm_functional_tags",
  "balm_usage_scope",
  "balm_type",
  "is_primary_moisturizer",
  "balm_caution_tags",
  "balm_research_confidence",
  "spf_value",
  "uva_label",
  "water_resistant_minutes",
  "uv_filter_type",
  "tone_up",
  "white_cast",
  "eye_sting",
  "pilling_risk"
].join(", ");

let metadataRowsById = null;
let metadataRowsLoadedAt = 0;
let metadataRowsPromise = null;

function getSupabaseConfig() {
  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey =
    process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return {
    supabaseUrl: supabaseUrl.startsWith("http")
      ? supabaseUrl
      : `https://${supabaseUrl}`,
    supabaseAnonKey
  };
}

async function fetchMetadataRows() {
  const config = getSupabaseConfig();
  if (!config) {
    return new Map();
  }

  try {
    const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    const { data, error } = await supabase
      .from("products")
      .select(METADATA_SELECT_FIELDS)
      .limit(500);

    if (error || !Array.isArray(data)) {
      return new Map();
    }

    return new Map(
      data
        .filter((row) => row?.id)
        .map((row) => [String(row.id), row])
    );
  } catch {
    return new Map();
  }
}

async function getMetadataRowsById() {
  if (
    metadataRowsById &&
    Date.now() - metadataRowsLoadedAt < METADATA_CACHE_TTL_MS
  ) {
    return metadataRowsById;
  }

  if (!metadataRowsPromise) {
    metadataRowsPromise = fetchMetadataRows()
      .then((rows) => {
        metadataRowsById = rows;
        metadataRowsLoadedAt = Date.now();
        return rows;
      })
      .finally(() => {
        metadataRowsPromise = null;
      });
  }

  return metadataRowsPromise;
}

function attachMetadata(product, source, role) {
  if (!product) {
    return product;
  }

  const sourceRow = source || { id: product.id };
  return attachRecommendationMetadataTransport(product, sourceRow, {
    role,
    metadataFallbacksApplied: identifyRecommendationMetadataFallbacks(sourceRow)
  });
}

export function buildRecommendationProductFromSource(source) {
  return attachMetadata(
    core.buildRecommendationProductFromSource(source),
    source,
    "recommendation_product"
  );
}

export async function fetchCurrentProductOptions(options = {}) {
  return core.fetchCurrentProductOptions(options);
}

export async function fetchCurrentProductSnapshotsByIds(productIds = []) {
  const snapshots = await core.fetchCurrentProductSnapshotsByIds(productIds);
  if (!snapshots.length) {
    return snapshots;
  }

  const rows = await getMetadataRowsById();
  return snapshots.map((snapshot) =>
    attachMetadata(
      snapshot,
      rows.get(String(snapshot.id)) || null,
      "current_product_snapshot"
    )
  );
}

export async function getRecommendationProducts() {
  const products = await core.getRecommendationProducts();
  const rows = await getMetadataRowsById();

  return products.map((product) =>
    attachMetadata(
      product,
      rows.get(String(product.id)) || null,
      "recommendation_product"
    )
  );
}
