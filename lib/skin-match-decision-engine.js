import {
  buildSkinMatchDecisionBundle as buildCoreSkinMatchDecisionBundle,
  resolveDecisionProductSlot
} from "@/lib/skin-match-decision-engine-core";

export { resolveDecisionProductSlot };

export async function buildSkinMatchDecisionBundle(input, options = {}) {
  const decision = await buildCoreSkinMatchDecisionBundle(input, options);

  if (Array.isArray(options.products) && options.products.length) {
    return decision;
  }

  try {
    const { projectDecisionWithCurrentProductOffers } = await import(
      "@/lib/server/product-offer-read-service"
    );
    return await projectDecisionWithCurrentProductOffers(decision);
  } catch {
    return decision;
  }
}
