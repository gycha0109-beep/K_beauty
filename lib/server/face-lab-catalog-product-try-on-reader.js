import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  FACE_LAB_CATALOG_TRY_ON_READ_VERSION,
  resolveFaceLabCatalogTryOnRead
} from "@/lib/face-lab-v2/catalog-product-try-on-read-core";

export { FACE_LAB_CATALOG_TRY_ON_READ_VERSION };

/**
 * Authenticated, read-only catalog identity lookup for a future Try-On route.
 * No browser-supplied Product, Subject, Variant, Taxonomy or assets are trusted.
 *
 * An approved server-side read projection is not yet available: by default
 * this returns approved_try_on_projection_unavailable for existing products.
 * Only a future explicitly authorized server adapter may supply the callback.
 * No privileged Product Fact/Taxonomy table access or paid image call occurs.
 */
export async function readFaceLabCatalogTryOnProduct({
  productId,
  variantKey,
  slotKey,
  readApprovedTryOnBundle
} = {}) {
  let supabase;
  try {
    supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) {
      return {
        readVersion: FACE_LAB_CATALOG_TRY_ON_READ_VERSION,
        status: "unavailable",
        reason: "authentication_required",
        selection: null,
        imageModelInvoked: false
      };
    }
  } catch {
    return {
      readVersion: FACE_LAB_CATALOG_TRY_ON_READ_VERSION,
      status: "unavailable",
      reason: "catalog_auth_unavailable",
      selection: null,
      imageModelInvoked: false
    };
  }

  return resolveFaceLabCatalogTryOnRead({
    request: { productId, variantKey, slotKey },
    lookupCatalogProduct: async id => {
      const { data, error } = await supabase
        .from("products")
        .select("id")
        .eq("id", id)
        .maybeSingle();
      if (error) {
        throw new Error("catalog_read_failed");
      }
      return data;
    },
    readApprovedTryOnBundle
  });
}
