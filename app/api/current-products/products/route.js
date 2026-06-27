import { NextResponse } from "next/server";
import {
  CANONICAL_CURRENT_PRODUCT_CATEGORIES,
  isLegacyCurrentProductCategory,
  normalizeCanonicalCurrentProductCategory
} from "@/lib/current-products";
import { fetchCurrentProductOptions } from "@/lib/product-source";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const rawCategory = String(searchParams.get("category") || "").trim();
  const requestedCategory = normalizeCanonicalCurrentProductCategory(rawCategory);

  if (rawCategory && isLegacyCurrentProductCategory(rawCategory)) {
    return NextResponse.json({
      success: true,
      fields: ["id", "brand", "name", "category", "product_form", "image_url"],
      categories: CANONICAL_CURRENT_PRODUCT_CATEGORIES,
      products: []
    });
  }

  if (rawCategory && !requestedCategory) {
    return NextResponse.json(
      {
        success: false,
        error: "Unsupported category."
      },
      { status: 400 }
    );
  }

  const products = await fetchCurrentProductOptions({ category: requestedCategory });

  return NextResponse.json({
    success: true,
    fields: ["id", "brand", "name", "category", "product_form", "image_url"],
    categories: CANONICAL_CURRENT_PRODUCT_CATEGORIES,
    products
  });
}
