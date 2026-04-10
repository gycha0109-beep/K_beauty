import { getRecommendationProducts } from "@/lib/product-source";
import { buildTopPickBundleFromProducts } from "@/lib/top-pick";

export function buildRecommendationBundleFromProducts(answers, productDb, options = {}) {
  return buildTopPickBundleFromProducts(answers, productDb, {
    includeAlternative: options.includeAlternative,
  });
}

export async function buildRecommendationBundle(answers, options = {}) {
  const productDb = await getRecommendationProducts();
  return buildRecommendationBundleFromProducts(answers, productDb, options);
}

export async function recommendProducts(answers, options = {}) {
  return (await buildRecommendationBundle(answers, options)).products;
}

export function buildOptionalSkinNote(answers) {
  if (answers.afternoonSkinChange === "more_oily") {
    return {
      title: "Optional Skin Note",
      description:
        "When oil builds up later in the day, lighter layers usually stay easier to repeat than richer comfort textures.",
    };
  }

  if (answers.afternoonSkinChange === "more_dry") {
    return {
      title: "Optional Skin Note",
      description:
        "If your skin dries out by afternoon, the routine often improves more from holding water in than from adding stronger actives.",
    };
  }

  if (answers.afternoonSkinChange === "red_or_irritated") {
    return {
      title: "Optional Skin Note",
      description:
        "When heat or friction shows up later in the day, lower-irritation layering usually matters more than adding extra steps.",
    };
  }

  return {
    title: "Optional Skin Note",
    description:
      "This MVP is strongest when it narrows the routine to the products you are most likely to keep using consistently.",
  };
}
