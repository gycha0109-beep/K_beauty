import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildFunctionalCandidateAudit } from "../lib/functional-candidate-audit.js";
import { resolveFunctionalGoalPolicy } from "../lib/functional-goal-policy.js";

const OUTPUT_DIR = path.join(process.cwd(), "tmp", "functional-candidate-audit");

function survey() {
  return {
    skinState: {
      skinType: "dry",
      sensitivity: "medium",
      postWashFeeling: "tight",
      afternoonSkinChange: "more_dry"
    },
    goals: {
      primaryConcern: "dehydration",
      secondaryConcerns: ["barrier"]
    },
    safety: {
      recentSkinChange: "no",
      recentlyChangedProduct: "no",
      sensitivityRisk: "medium",
      drynessRisk: "high",
      rednessRisk: "low"
    },
    preferences: {
      preferredTexture: "cream",
      mostDislikedFeel: "sticky"
    },
    sunscreen: {
      whiteCastHate: false,
      toneUpWanted: false,
      makeupUse: false,
      eyeSensitive: false,
      sourceCompleteness: "answered"
    }
  };
}

function products() {
  return [
    {
      id: "audit-hydration-cream",
      category: "moisturizer_cream",
      product_form: "cream",
      skin_types: ["dry"],
      concerns: ["dehydration", "barrier"],
      texture: "cream",
      finish: "natural",
      irritation_risk: "low",
      sensitivity_safe: true,
      ingredient_signals: {
        functional: [
          { label: "skin hydration", count: 8 },
          { label: "moisture evaporation blocking", count: 4 },
          { label: "skin protection", count: 3 }
        ]
      },
      market_signals: { review_count: 2000, rating: 4.5 }
    },
    {
      id: "audit-tone-active",
      category: "treatment",
      skin_types: ["dry"],
      concerns: ["uneven_tone"],
      texture: "lotion",
      finish: "natural",
      irritation_risk: "medium",
      sensitivity_safe: null,
      ingredient_signals: {
        functional: [{ label: "whitening", count: 8 }]
      }
    },
    {
      id: "audit-sparse",
      category: "serum"
    }
  ];
}

const surveyContract = survey();
const goalPolicy = resolveFunctionalGoalPolicy({
  surveyContract: {
    goals: surveyContract.goals,
    safety: surveyContract.safety
  },
  freeResultPriority: { axis: "dehydration" }
});
const audit = buildFunctionalCandidateAudit({
  products: products(),
  surveyContract,
  goalPolicy,
  options: {
    includeBlocked: true,
    includeInsufficientData: true,
    maxRankedCandidates: 10
  }
});

await mkdir(OUTPUT_DIR, { recursive: true });
await writeFile(
  path.join(OUTPUT_DIR, "summary.json"),
  JSON.stringify(audit.summary, null, 2),
  "utf8"
);

console.log("functional-candidate-audit summary");
console.log(JSON.stringify(audit.summary, null, 2));
