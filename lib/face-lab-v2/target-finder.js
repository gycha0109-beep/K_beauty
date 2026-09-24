import {
  TARGET_STYLE_AXES,
  getTargetStylePrototype,
  isTargetStyleKey
} from "./target-style-registry.js";

export const TARGET_FINDER_CANDIDATE_SET_VERSION = "target-finder-cards-v1";

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

export function getTargetFinderRound(index) {
  const round = TARGET_FINDER_ROUNDS[index];
  if (!round) return null;

  return {
    ...round,
    candidateA: {
      candidateId: `${round.roundId}:a`,
      targetKey: round.a,
      referenceAssetKey: `target-finder/${TARGET_FINDER_CANDIDATE_SET_VERSION}/${round.a}`,
      vector: getTargetStylePrototype(round.a)
    },
    candidateB: {
      candidateId: `${round.roundId}:b`,
      targetKey: round.b,
      referenceAssetKey: `target-finder/${TARGET_FINDER_CANDIDATE_SET_VERSION}/${round.b}`,
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

  const positive = [...scores.entries()]
    .filter(([key]) => isTargetStyleKey(key))
    .sort((left, right) => right[1] - left[1]);

  const topScore = positive[0]?.[1] ?? 0;
  const candidateLabels = positive
    .filter(([, score]) => score === topScore || score > 0)
    .map(([key]) => key)
    .slice(0, 2);

  const fallbackLabels = candidateLabels.length
    ? candidateLabels
    : ["natural", "sophisticated"];

  return {
    candidateSetVersion: TARGET_FINDER_CANDIDATE_SET_VERSION,
    rounds: normalized,
    candidateLabels: fallbackLabels,
    estimatedVector: estimateVectorFromRounds(normalized),
    userApproved: false
  };
}
