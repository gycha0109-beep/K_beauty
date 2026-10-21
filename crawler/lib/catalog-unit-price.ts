/**
 * Catalog size_ml is the volume of one physical container, never a bundle total.
 * Seller offer quantities and bonus minis are not inputs to this calculation.
 */
export function calculatePhysicalUnitPricePer10Ml(input: {
  priceMin: number | string | null | undefined;
  sizeMl: number | string | null | undefined;
  category: string | null | undefined;
}): number | null {
  if (input.category === "toner_pad" || input.priceMin == null || input.sizeMl == null) {
    return null;
  }

  const price = Number(input.priceMin);
  const physicalMl = Number(input.sizeMl);
  if (!Number.isFinite(price) || !Number.isFinite(physicalMl) || price < 0 || physicalMl <= 0) {
    return null;
  }

  return Math.round((price * 10 / physicalMl + Number.EPSILON) * 100) / 100;
}
