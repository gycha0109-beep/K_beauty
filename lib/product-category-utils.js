export const MOISTURIZER_CATEGORIES = Object.freeze([
  "moisturizer_lotion_emulsion",
  "moisturizer_gel",
  "moisturizer_cream",
  "moisturizer_balm"
]);

export function isMoisturizerCategory(category) {
  return MOISTURIZER_CATEGORIES.includes(String(category || "").trim().toLowerCase());
}

export function getMoisturizerCategoryLabel(category, locale = "ko") {
  const normalized = String(category || "").trim().toLowerCase();
  const en = locale === "en";

  switch (normalized) {
    case "moisturizer_lotion_emulsion":
      return en ? "Lotion / Emulsion" : "로션 / 에멀전";
    case "moisturizer_gel":
      return en ? "Gel Moisturizer" : "수분 젤";
    case "moisturizer_cream":
      return en ? "Cream" : "크림";
    case "moisturizer_balm":
      return en ? "Balm" : "밤";
    case "moisturizer":
      return en ? "Moisturizer" : "보습제";
    default:
      return "";
  }
}

export function getProductCategorySlot(category) {
  const normalized = String(category || "").trim().toLowerCase();

  if (isMoisturizerCategory(normalized) || normalized === "moisturizer") {
    return "moisturizer";
  }

  if (["toner_pad", "toner_essence"].includes(normalized)) {
    return "toner_essence";
  }

  if (["serum", "ampoule", "essence", "treatment", "serum_ampoule"].includes(normalized)) {
    return "serum";
  }

  return normalized;
}
