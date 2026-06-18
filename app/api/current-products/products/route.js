import { NextResponse } from "next/server";
import { CURRENT_PRODUCT_CATEGORIES, normalizeCurrentProductCategory } from "@/lib/current-products";
import { fetchCurrentProductOptions } from "@/lib/product-source";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const requestedCategory = normalizeCurrentProductCategory(searchParams.get("category"));

  if (searchParams.get("category") && !requestedCategory) {
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
    categories: CURRENT_PRODUCT_CATEGORIES,
    products
  });
}
