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
  const afternoonState = answers.afternoonState || answers.afternoonSkinChange;

  if (afternoonState === "more_oily") {
    return {
      title: "가볍게 참고할 포인트",
      description:
        "오후에 유분이 빨리 올라오면, 리치한 보습보다 가벼운 레이어링이 더 오래 편하게 가는 경우가 많습니다.",
    };
  }

  if (afternoonState === "more_dry") {
    return {
      title: "가볍게 참고할 포인트",
      description:
        "오후에 다시 건조해진다면, 강한 기능성보다 수분이 빠지지 않게 잡아주는 쪽이 먼저 체감되기 쉽습니다.",
    };
  }

  if (afternoonState === "red_or_irritated") {
    return {
      title: "가볍게 참고할 포인트",
      description:
        "열감이나 마찰 자극이 올라오는 날에는, 단계를 늘리기보다 저자극으로 단순하게 가는 편이 더 안정적입니다.",
    };
  }

  return {
    title: "가볍게 참고할 포인트",
    description:
      "지금 단계에서는 많이 더하기보다, 꾸준히 쓰기 쉬운 제품 몇 개로 루틴을 단순하게 맞추는 편이 가장 안정적입니다.",
  };
}
