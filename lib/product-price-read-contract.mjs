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

/**
 * Display ONLY a positive, independently known canonical Product price.
 * Seller checkout amounts must be rendered by the separate Offer consumer.
 * Missing/zero/invalid prices cannot become "0원" via Number(null).
 */
export function formatKnownProductPriceLabel(priceMin, priceMax, locale = "ko") {
  const min = normalizeKnownProductPrice(priceMin);
  const max = normalizeKnownProductPrice(priceMax);
  const pending = locale === "en" ? "Price pending" : "가격 정보 확인 중";

  if (min == null && max == null) return pending;
  if (min != null && max != null && min > max) return pending;

  const prices = min != null && max != null && min === max
    ? [min]
    : [min, max].filter((price) => price != null);
  const amount = prices.map((price) => price.toLocaleString("ko-KR")).join("~");
  return amount + (locale === "en" ? " KRW" : "원");
}
