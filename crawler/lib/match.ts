export interface MatchableProductRecordLike {
  id: string;
  normalized_name: string;
  normalized_brand: string;
  category?: string | null;
}

export interface ProductMatchResult<TProduct extends MatchableProductRecordLike> {
  kind: "exact" | "same_brand_near_name" | "none";
  product: TProduct | null;
  confidence: number | null;
}

function uniqueTokens(value: string): string[] {
  return Array.from(new Set(value.split(" ").map((token) => token.trim()).filter(Boolean)));
}

function computeTokenOverlapScore(leftTokens: string[], rightTokens: string[]): number {
  if (leftTokens.length === 0 || rightTokens.length === 0) {
    return 0;
  }

  const rightTokenSet = new Set(rightTokens);
  const sharedTokenCount = leftTokens.filter((token) => rightTokenSet.has(token)).length;

  if (sharedTokenCount === 0) {
    return 0;
  }

  const leftCoverage = sharedTokenCount / leftTokens.length;
  const rightCoverage = sharedTokenCount / rightTokens.length;

  return (leftCoverage + rightCoverage) / 2;
}

function computeContainmentScore(leftName: string, rightName: string): number {
  if (!leftName || !rightName) {
    return 0;
  }

  if (leftName === rightName) {
    return 1;
  }

  if (leftName.includes(rightName) || rightName.includes(leftName)) {
    return Math.min(leftName.length, rightName.length) / Math.max(leftName.length, rightName.length);
  }

  return 0;
}

function computeNearNameConfidence(leftName: string, rightName: string): number {
  const leftTokens = uniqueTokens(leftName);
  const rightTokens = uniqueTokens(rightName);
  const tokenOverlapScore = computeTokenOverlapScore(leftTokens, rightTokens);
  const containmentScore = computeContainmentScore(leftName, rightName);

  return Number((tokenOverlapScore * 0.8 + containmentScore * 0.2).toFixed(2));
}

export function findBestProductMatch<TProduct extends MatchableProductRecordLike>(
  products: TProduct[],
  input: {
    canonicalBrand: string;
    canonicalName: string;
  },
): ProductMatchResult<TProduct> {
  if (!input.canonicalBrand || !input.canonicalName) {
    return {
      kind: "none",
      product: null,
      confidence: null,
    };
  }

  const exactMatch =
    products.find(
      (product) =>
        product.normalized_brand === input.canonicalBrand &&
        product.normalized_name === input.canonicalName,
    ) ?? null;

  if (exactMatch) {
    return {
      kind: "exact",
      product: exactMatch,
      confidence: 1,
    };
  }

  const sameBrandCandidates = products.filter(
    (product) => product.normalized_brand === input.canonicalBrand,
  );

  if (sameBrandCandidates.length === 0) {
    return {
      kind: "none",
      product: null,
      confidence: null,
    };
  }

  const rankedNearCandidates = sameBrandCandidates
    .map((product) => ({
      product,
      confidence: computeNearNameConfidence(input.canonicalName, product.normalized_name),
      sharedTokens: computeTokenOverlapScore(
        uniqueTokens(input.canonicalName),
        uniqueTokens(product.normalized_name),
      ),
    }))
    .filter((entry) => entry.confidence >= 0.78 && entry.sharedTokens >= 0.75)
    .sort((left, right) => right.confidence - left.confidence);

  if (rankedNearCandidates.length === 0) {
    return {
      kind: "none",
      product: null,
      confidence: null,
    };
  }

  return {
    kind: "same_brand_near_name",
    product: rankedNearCandidates[0]?.product ?? null,
    confidence: rankedNearCandidates[0]?.confidence ?? null,
  };
}
