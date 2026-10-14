// Presentation/read-only price normalization. Seller offer checkout amounts
// are NOT canonical Product price authority. No price policy is selected here.
export function normalizeKnownProductPrice(value) {
  if ((typeof value !== "number" && typeof value !== "string")
    || (typeof value === "string" && value.trim() === "")) {
    return null;
  }
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

// A missing/invalid Product price has NO inferred price band.
export function getKnownProductPriceRange(priceMin, priceMax) {
  const ceiling = normalizeKnownProductPrice(priceMax)
    ?? normalizeKnownProductPrice(priceMin);
  if (ceiling == null) return "";
  if (ceiling < 20000) return "$";
  if (ceiling < 40000) return "$$";
  return "$$$";
}

export function isKnownCheaperProductPrice(candidateMin, topPickMin) {
  const candidate = normalizeKnownProductPrice(candidateMin);
  const top = normalizeKnownProductPrice(topPickMin);
  return candidate != null && top != null && candidate < top;
}
