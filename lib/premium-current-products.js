import "server-only";

import { sanitizeCurrentProducts } from "@/lib/current-products";
import { buildCurrentProductVerdicts } from "@/lib/current-product-verdicts";
import { fetchCurrentProductSnapshotsByIds } from "@/lib/product-source";

function getProductLookup(products = []) {
  return new Map(products.map((product) => [String(product?.id || "").trim(), product]).filter(([id]) => id));
}

function buildSummary(selections) {
  return {
    total: selections.length,
    selectedCount: selections.filter((item) => item.status === "selected").length,
    notInDbCount: selections.filter((item) => item.status === "not_in_db").length,
    notUsingCount: selections.filter((item) => item.status === "not_using").length,
    sunscreenStatus: selections.find((item) => item.category === "sunscreen")?.status || "unknown"
  };
}

export async function buildPremiumCurrentProductsSnapshot(input) {
  const selections = sanitizeCurrentProducts(input);

  if (!selections.length) {
    return null;
  }

  const productIds = selections
    .filter((item) => item.status === "selected")
    .map((item) => item.productId);
  const snapshots = await fetchCurrentProductSnapshotsByIds(productIds);
  const productLookup = getProductLookup(snapshots);
  const selectionsWithSnapshots = selections.map((selection) => {
    if (selection.status !== "selected") {
      return selection;
    }

    const productSnapshot = productLookup.get(selection.productId) || null;

    return {
      ...selection,
      productSnapshot
    };
  });

  return {
    selections: selectionsWithSnapshots,
    summary: buildSummary(selectionsWithSnapshots)
  };
}

export function buildPremiumCurrentProductVerdicts(currentProducts, report, locale = "ko") {
  const freeResult = report?.freeResult && typeof report.freeResult === "object"
    ? report.freeResult
    : {};

  return buildCurrentProductVerdicts(currentProducts, {
    locale,
    priorityAxis: freeResult?.priority?.axis || freeResult?.mainConcern || "",
    answers: freeResult?.answers || {}
  });
}
