import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  buildExistingRecommendationSnapshot,
  resolveShadowAuditCandidateSource
} from "../lib/functional-shadow-adapter.js";
import { compareFunctionalShadowResults } from "../lib/functional-shadow-comparison.js";
import { buildFunctionalCandidateAudit } from "../lib/functional-candidate-audit.js";
import { resolveFunctionalGoalPolicy } from "../lib/functional-goal-policy.js";

const OUTPUT_DIR = path.join(process.cwd(), "tmp", "functional-shadow-audit");

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
      id: "shadow-hydration-cream",
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
      id: "shadow-legacy-serum",
      category: "serum",
      skin_types: ["dry"],
      concerns: ["dehydration"],
      texture: "lotion",
      finish: "natural",
      irritation_risk: "low",
      sensitivity_safe: true,
      ingredient_signals: {
        functional: [{ label: "skin hydration", count: 1 }]
      }
    },
    {
      id: "shadow-tone-active",
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
      id: "shadow-sparse",
      category: "serum"
    }
  ];
}

function renderMarkdown({ comparison, candidateSource }) {
  const summary = comparison.comparisonSummary;
  const status = comparison.candidateStatusComparison;

  return [
    "# Functional Shadow Audit Summary",
    "",
    `- existing unique products: ${summary.existingUniqueCount}`,
    `- functional ranked / blocked / insufficient: ${summary.functionalRankedCount} / ${summary.functionalBlockedCount} / ${summary.functionalInsufficientDataCount}`,
    `- overlap: ${summary.overlapCount} (${summary.overlapRate})`,
    `- topPick match: ${summary.topPickMatch}`,
    `- existing selected but blocked: ${status.existingSelectedButBlocked.length}`,
    `- existing selected but insufficient data: ${status.existingSelectedButInsufficientData.length}`,
    `- functional top candidates missing from existing: ${status.functionalTopCandidatesNotInExisting.length}`,
    `- comparison confidence: ${summary.comparisonConfidence}`,
    `- candidate source: ${candidateSource.sourceType} (${candidateSource.sourceCount})`,
    "",
    "## Policy Notes",
    ...comparison.policyNotes.map((note) => `- ${note}`),
    "",
    "## Divergences",
    ...comparison.divergences.map((item) => `- ${item.type}: ${item.productId || "n/a"}`)
  ].join("\n");
}

const surveyContract = survey();
const goalPolicy = resolveFunctionalGoalPolicy({
  surveyContract: {
    goals: surveyContract.goals,
    safety: surveyContract.safety
  },
  freeResultPriority: { axis: "dehydration" }
});
const candidateProducts = products();
const existingResult = {
  candidateSourceCoverage: "complete",
  topPick: candidateProducts[1],
  premiumReport: {
    supportingProducts: [candidateProducts[0]],
    budgetAlternatives: [candidateProducts[3]]
  }
};
const existingSnapshot = buildExistingRecommendationSnapshot(existingResult);
const candidateSource = resolveShadowAuditCandidateSource({
  existingCandidateSource: candidateProducts,
  existingRecommendationSnapshot: existingSnapshot
});
const functionalAudit = buildFunctionalCandidateAudit({
  products: candidateSource.products,
  surveyContract,
  goalPolicy,
  options: {
    includeBlocked: true,
    includeInsufficientData: true,
    maxRankedCandidates: 10
  }
});
const comparison = compareFunctionalShadowResults({
  existingSnapshot,
  functionalAudit
});
const output = {
  existingSnapshot,
  candidateSource: {
    sourceType: candidateSource.sourceType,
    sourceCount: candidateSource.sourceCount,
    excludedCount: candidateSource.excludedCount,
    notes: candidateSource.notes
  },
  functionalSummary: functionalAudit.summary,
  comparison
};

await mkdir(OUTPUT_DIR, { recursive: true });
await writeFile(path.join(OUTPUT_DIR, "summary.json"), JSON.stringify(output, null, 2), "utf8");
await writeFile(path.join(OUTPUT_DIR, "summary.md"), renderMarkdown({ comparison, candidateSource }), "utf8");

console.log("functional-shadow-audit summary");
console.log(JSON.stringify(comparison.comparisonSummary, null, 2));
console.log("candidateStatusComparison");
console.log(JSON.stringify(comparison.candidateStatusComparison, null, 2));
