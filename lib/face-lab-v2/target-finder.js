import {
  TARGET_STYLE_AXES,
  getTargetStylePrototype,
  isTargetStyleKey
} from "./target-style-registry.js";

export const TARGET_FINDER_CANDIDATE_SET_VERSION = "target-finder-cards-v2";

const TARGET_FINDER_REFERENCE_CARDS = Object.freeze({
  natural: {
    ko: ["힘을 뺀 질감", "낮은 대비", "가벼운 정돈"],
    en: ["Relaxed texture", "Low contrast", "Light grooming"]
  },
  sophisticated: {
    ko: ["정돈된 마감", "선명한 포인트", "균형 잡힌 대비"],
    en: ["Polished finish", "Defined focal point", "Controlled contrast"]
  },
  soft: {
    ko: ["곡선 흐름", "부드러운 경계", "낮은 각"],
    en: ["Curved flow", "Soft edges", "Lower angularity"]
  },
  defined: {
    ko: ["또렷한 선", "구조감", "선택적 대비"],
    en: ["Defined lines", "Structure", "Selective contrast"]
  },
  cute_playful: {
    ko: ["가벼운 움직임", "생기 포인트", "발랄한 비율"],
    en: ["Light movement", "Fresh accents", "Playful proportions"]
  },
  mature_calm: {
    ko: ["차분한 실루엣", "절제된 포인트", "정돈된 마감"],
    en: ["Calm silhouette", "Restrained accents", "Controlled finish"]
  },
  minimal: {
    ko: ["포인트 최소화", "낮은 시각 무게", "깔끔한 선"],
    en: ["Few accents", "Low visual weight", "Clean lines"]
  },
  statement_glam: {
    ko: ["강한 한두 포인트", "높은 존재감", "선명한 마감"],
    en: ["Strong focal accents", "High presence", "Defined finish"]
  },
  classic: {
    ko: ["유행 의존도 낮음", "균형 잡힌 선", "절제된 마감"],
    en: ["Low trend dependence", "Balanced lines", "Restrained finish"]
  },
  trendy: {
    ko: ["현재 유행 신호", "새로운 비율", "포인트 변화"],
    en: ["Current trend cues", "New proportions", "Directional accents"]
  }
});

export const TARGET_FINDER_ROUNDS = [
  {
    roundId: "natural-vs-sophisticated",
    focus: ["naturalPolished"],
    a: "natural",
    b: "sophisticated"
  },
  {
    roundId: "soft-vs-defined",
    focus: ["softSharp"],
    a: "soft",
    b: "defined"
  },
  {
    roundId: "playful-vs-mature",
    focus: ["playfulMature"],
    a: "cute_playful",
    b: "mature_calm"
  },
  {
    roundId: "minimal-vs-statement",
    focus: ["minimalStatement"],
    a: "minimal",
    b: "statement_glam"
  },
  {
    roundId: "classic-vs-trendy",
    focus: ["classicTrendy"],
    a: "classic",
    b: "trendy"
  }
];

const CHOICES = new Set(["a", "b", "both", "neither"]);

function midpoint(a, b) {
  return Number(((a + b) / 2).toFixed(3));
}

function buildReferenceCard(targetKey, locale = "ko") {
  const cues = TARGET_FINDER_REFERENCE_CARDS[targetKey];
  const resolvedLocale = locale === "en" ? "en" : "ko";
  const assetSlot = `/facelab/target-finder/v2/${targetKey}.webp`;

  return {
    assetReady: false,
    assetPath: null,
    assetSlot,
    cues: cues?.[resolvedLocale] || [],
    purpose: "style_preference_reference"
  };
}

function estimateVectorFromRounds(rounds) {
  const vector = Object.fromEntries(TARGET_STYLE_AXES.map((axis) => [axis, 0.5]));

  rounds.forEach((round) => {
    const definition = TARGET_FINDER_ROUNDS.find(
      (candidate) => candidate.roundId === round.roundId
    );
    const axis = definition?.focus?.[0];
    if (!axis || !TARGET_STYLE_AXES.includes(axis)) return;

    const aVector = getTargetStylePrototype(definition.a);
    const bVector = getTargetStylePrototype(definition.b);
    const aValue = aVector?.[axis];
    const bValue = bVector?.[axis];

    if (typeof aValue !== "number" || typeof bValue !== "number") return;

    if (round.choice === "a") {
      vector[axis] = aValue;
    } else if (round.choice === "b") {
      vector[axis] = bValue;
    } else if (round.choice === "both") {
      vector[axis] = midpoint(aValue, bValue);
    } else if (round.choice === "neither") {
      vector[axis] = 0.5;
    }
  });

  return vector;
}

function normalizeRounds(rounds) {
  if (!Array.isArray(rounds)) return [];

  return rounds
    .map((round) => {
      const definition = TARGET_FINDER_ROUNDS.find(
        (candidate) => candidate.roundId === round?.roundId
      );
      if (!definition || !CHOICES.has(round?.choice)) return null;

      return {
        roundId: definition.roundId,
        a: definition.a,
        b: definition.b,
        choice: round.choice
      };
    })
    .filter(Boolean)
    .slice(0, TARGET_FINDER_ROUNDS.length);
}

export function getTargetFinderRound(index, locale = "ko") {
  const round = TARGET_FINDER_ROUNDS[index];
  if (!round) return null;

  return {
    ...round,
    candidateA: {
      candidateId: `${round.roundId}:a`,
      targetKey: round.a,
      referenceAssetKey: `target-finder/${TARGET_FINDER_CANDIDATE_SET_VERSION}/${round.a}`,
      reference: buildReferenceCard(round.a, locale),
      vector: getTargetStylePrototype(round.a)
    },
    candidateB: {
      candidateId: `${round.roundId}:b`,
      targetKey: round.b,
      referenceAssetKey: `target-finder/${TARGET_FINDER_CANDIDATE_SET_VERSION}/${round.b}`,
      reference: buildReferenceCard(round.b, locale),
      vector: getTargetStylePrototype(round.b)
    }
  };
}

export function buildTargetFinderResult(rounds) {
  const normalized = normalizeRounds(rounds);
  const scores = new Map();

  normalized.forEach((round) => {
    const currentA = scores.get(round.a) || 0;
    const currentB = scores.get(round.b) || 0;

    if (round.choice === "a") {
      scores.set(round.a, currentA + 2);
    } else if (round.choice === "b") {
      scores.set(round.b, currentB + 2);
    } else if (round.choice === "both") {
      scores.set(round.a, currentA + 1);
      scores.set(round.b, currentB + 1);
    } else {
      scores.set(round.a, currentA - 1);
      scores.set(round.b, currentB - 1);
    }
  });

  const estimatedVector = estimateVectorFromRounds(normalized);
  const observedAxes = new Set(
    normalized.flatMap((round) => {
      const definition = TARGET_FINDER_ROUNDS.find(
        (candidate) => candidate.roundId === round.roundId
      );
      return definition?.focus || [];
    })
  );

  const distanceFromEstimate = (key) => {
    const prototype = getTargetStylePrototype(key);
    const values = [...observedAxes]
      .map((axis) => [prototype?.[axis], estimatedVector?.[axis]])
      .filter(([prototypeValue, estimateValue]) =>
        typeof prototypeValue === "number" && typeof estimateValue === "number"
      );

    if (!values.length) return Number.POSITIVE_INFINITY;

    return values.reduce(
      (sum, [prototypeValue, estimateValue]) =>
        sum + ((prototypeValue - estimateValue) ** 2),
      0
    ) / values.length;
  };

  const candidateLabels = [...scores.entries()]
    .filter(([key, score]) => isTargetStyleKey(key) && score > 0)
    .sort((left, right) => {
      const scoreDiff = right[1] - left[1];
      if (scoreDiff) return scoreDiff;
      return distanceFromEstimate(left[0]) - distanceFromEstimate(right[0]);
    })
    .map(([key]) => key)
    .slice(0, 2);

  return {
    candidateSetVersion: TARGET_FINDER_CANDIDATE_SET_VERSION,
    rounds: normalized,
    candidateLabels,
    estimatedVector,
    userApproved: false
  };
}
