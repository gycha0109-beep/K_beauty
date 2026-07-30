import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildSharedSkinDecisionContext } from "../lib/shared-skin-decision-context-v4.js";

let assertions = 0;

function check(condition, message) {
  assertions += 1;
  assert.ok(condition, message);
}

function equal(actual, expected, message) {
  assertions += 1;
  assert.equal(actual, expected, message);
}

function deepEqual(actual, expected, message) {
  assertions += 1;
  assert.deepEqual(actual, expected, message);
}

function baseReport(extra = {}) {
  return {
    freeResult: {
      priority: { axis: "barrier", score: 24 },
      scoring: {
        concernScores: {
          barrier: { total: 24 },
          redness: { total: 20 },
          dehydration: { total: 18 },
          oiliness: { total: 8 },
          acne: { total: 10 },
          pores: { total: 12 },
          uneven_tone: { total: 6 },
          uv: { total: 14 }
        }
      },
      answers: {
        recentSkinChange: "no",
        recentlyChangedProduct: "no",
        productReaction: "no",
        environmentExposure: []
      }
    },
    photoEvidenceState: { status: "not_provided" },
    currentProducts: null,
    ...extra
  };
}

function activeProduct({
  id = "active-serum",
  category = "serum",
  axisLabel = "Exfoliation"
} = {}) {
  return {
    status: "selected",
    category,
    productId: id,
    productSnapshot: {
      id,
      brand: "Fixture",
      name: "Fixture Product",
      category,
      ingredient_signals: {
        functional: [{ label: axisLabel, count: 4 }]
      }
    }
  };
}

function build(report) {
  return buildSharedSkinDecisionContext(report, { source: "verify_shared_context_v4" });
}

const noPhoto = build(baseReport());
equal(noPhoto.context.version, "shared-skin-decision-context-v4", "v4 context must be authoritative");
equal(noPhoto.context.photo.status, "not_provided", "no-photo state must remain explicit");
equal(noPhoto.context.photo.evidenceAvailable, false, "no-photo must not create evidence");
equal(noPhoto.context.photo.factsMayBeInferred, false, "no-photo must not authorize inference");
equal(noPhoto.context.concernState.completeness, "complete", "all concern axes must be recognized");
equal(noPhoto.context.concernState.priorityAxis, "barrier", "priority must remain canonical");
deepEqual(noPhoto.context.concernState.unknownAxes, [], "complete concern input must have no unknown axes");
equal(noPhoto.context.uncertaintyState.unknownPreserved, true, "unknown preservation is invariant");
check(noPhoto.context.uncertaintyState.reasons.includes("photo_not_provided"), "no-photo uncertainty reason is required");
equal(noPhoto.context.safetyState.protectionMustMaintain, true, "protection invariant must remain");

const unavailablePhoto = build(baseReport({
  photoEvidenceState: {
    status: "unavailable",
    failureReason: "analysis_unavailable",
    source: "vision"
  }
}));
equal(unavailablePhoto.context.photo.status, "unavailable", "analysis failure must differ from no-photo");
equal(unavailablePhoto.context.photo.failureReason, "analysis_unavailable", "analysis failure reason must remain");
check(
  unavailablePhoto.context.uncertaintyState.reasons.includes("photo_analysis_unavailable"),
  "analysis failure must cap certainty"
);

const surveyOnly = build(baseReport({
  photoEvidenceState: { status: "unknown" }
}));
equal(surveyOnly.context.photo.status, "unknown", "unpersisted photo state must remain unknown");
check(
  surveyOnly.context.uncertaintyState.reasons.includes("photo_availability_unknown"),
  "unknown photo availability must not be treated as no-photo or success"
);

const selected = build(baseReport({
  currentProducts: {
    selections: [activeProduct()],
    summary: { total: 1, selectedCount: 1 }
  }
}));
equal(selected.context.productExposureState.selectedCount, 1, "selected product must be retained");
equal(selected.context.productExposureState.activeExposurePresent, true, "known active exposure must be detected");
deepEqual(selected.context.productExposureState.recentExposures, [], "recent exposure requires explicit linkage");
deepEqual(selected.context.productExposureState.reactionLinkedExposures, [], "reaction exposure requires explicit linkage");
equal(selected.context.productExposureState.concentrationOrStrengthInferred, false, "strength must not be inferred");

const notInDb = build(baseReport({
  currentProducts: {
    selections: [{ status: "not_in_db", category: "serum" }],
    summary: { total: 1, notInDbCount: 1 }
  }
}));
equal(notInDb.context.productExposureState.unknownProductCount, 1, "not_in_db must remain unknown");
equal(notInDb.context.productExposureState.unknownExposurePresent, true, "unknown exposure must be explicit");
check(
  notInDb.context.uncertaintyState.reasons.includes("current_product_evidence_incomplete"),
  "unknown product must cap certainty"
);

const mixed = build(baseReport({
  currentProducts: {
    selections: [
      activeProduct({ id: "known-treatment", category: "serum" }),
      { status: "not_in_db", category: "toner_pad" }
    ],
    summary: { total: 2, selectedCount: 1, notInDbCount: 1 }
  }
}));
equal(mixed.context.productExposureState.selectedCount, 1, "mixed input must retain selected row");
equal(mixed.context.productExposureState.unknownProductCount, 1, "mixed input must retain unknown row");
equal(mixed.context.productExposureState.completeness, "partial", "mixed input must be partial");

const notUsing = build(baseReport({
  currentProducts: {
    selections: [{ status: "not_using", category: "sunscreen" }],
    summary: { total: 1, notUsingCount: 1 }
  }
}));
equal(notUsing.context.productExposureState.rows[0].sourceState, "not_using", "not_using must remain distinct");
equal(notUsing.context.productExposureState.activeExposurePresent, false, "not_using must not create active exposure");

const unanswered = build(baseReport({
  currentProducts: {
    selections: [{ status: "unanswered", category: "serum" }],
    summary: { total: 1 }
  }
}));
equal(unanswered.context.productExposureState.rows[0].sourceState, "unanswered", "unanswered must remain distinct");
equal(unanswered.context.productExposureState.unknownProductCount, 0, "unanswered is not silently converted to not_in_db");
equal(unanswered.context.productExposureState.activeExposurePresent, false, "unanswered must not create exposure");

const duplicate = build(baseReport({
  currentProducts: {
    selections: [
      activeProduct({ id: "active-one", category: "serum" }),
      activeProduct({ id: "active-two", category: "toner_pad" })
    ],
    summary: { total: 2, selectedCount: 2 }
  }
}));
check(
  duplicate.context.productExposureState.duplicateActiveAxes.includes("exfoliation"),
  "duplicate functional axis must remain explicit"
);

const incompleteConcern = build({
  freeResult: {
    priority: { axis: "pores", score: 15 },
    scoring: { concernScores: { pores: { total: 15 } } },
    answers: {}
  },
  photoEvidenceState: { status: "not_provided" }
});
equal(incompleteConcern.context.concernState.completeness, "partial", "partial concern evidence must remain partial");
check(incompleteConcern.context.concernState.unknownAxes.includes("barrier"), "missing axis must remain unknown");
equal(incompleteConcern.context.uncertaintyState.confidenceCeiling, "medium", "partial evidence must cap confidence");

const recentUnlinked = build(baseReport({
  freeResult: {
    ...baseReport().freeResult,
    answers: {
      ...baseReport().freeResult.answers,
      recentlyChangedProduct: "yes",
      productReaction: "yes"
    }
  },
  currentProducts: {
    selections: [activeProduct()],
    summary: { total: 1, selectedCount: 1 }
  }
}));
equal(
  recentUnlinked.context.productExposureState.recentExposureState,
  "reported_unlinked",
  "recent product change must not be assigned to a product without explicit evidence"
);
equal(
  recentUnlinked.context.productExposureState.reactionLinkState,
  "unresolved",
  "reaction must remain unresolved without an explicit product link"
);
deepEqual(
  recentUnlinked.context.productExposureState.reactionLinkedExposures,
  [],
  "reaction must not be attributed by name/category guess"
);
check(
  recentUnlinked.context.uncertaintyState.reasons.includes("product_reaction_link_unresolved"),
  "unresolved reaction linkage must be recorded"
);

const explicitLink = build(baseReport({
  freeResult: {
    ...baseReport().freeResult,
    answers: {
      ...baseReport().freeResult.answers,
      productReaction: "yes"
    }
  },
  currentProducts: {
    selections: [activeProduct({ id: "linked-product" })],
    summary: { total: 1, selectedCount: 1 }
  },
  currentProductReactionLinks: [
    { productId: "linked-product", evidenceKey: "user_selected_reaction_product" }
  ]
}));
equal(explicitLink.context.productExposureState.reactionLinkState, "linked", "explicit reaction link must be retained");
equal(explicitLink.context.productExposureState.reactionLinkedExposures.length, 1, "linked exposure count must be exact");

const explicitRecent = build(baseReport({
  freeResult: {
    ...baseReport().freeResult,
    answers: {
      ...baseReport().freeResult.answers,
      recentlyChangedProduct: "yes"
    }
  },
  currentProducts: {
    selections: [
      {
        ...activeProduct({ id: "recent-product" }),
        introducedRecently: true
      }
    ],
    summary: { total: 1, selectedCount: 1 }
  }
}));
equal(explicitRecent.context.productExposureState.recentExposureState, "linked", "explicit recent marker must link");
equal(explicitRecent.context.productExposureState.recentExposures.length, 1, "recent exposure count must be exact");

const first = build(baseReport());
const repeated = build({
  ...baseReport(),
  decisionBundle: {
    contextVersion: first.context.version,
    contextHash: first.contextHash,
    contextRevision: first.contextRevision,
    context: first.context
  }
});
equal(repeated.contextHash, first.contextHash, "identical input must have identical hash");
equal(repeated.contextRevision, first.contextRevision, "identical v4 input must preserve revision");

const changed = build({
  ...baseReport({
    freeResult: {
      ...baseReport().freeResult,
      answers: {
        ...baseReport().freeResult.answers,
        recentSkinChange: "yes"
      }
    }
  }),
  decisionBundle: {
    contextVersion: first.context.version,
    contextHash: first.contextHash,
    contextRevision: first.contextRevision,
    context: first.context
  }
});
check(changed.contextHash !== first.contextHash, "changed evidence must change hash");
equal(changed.contextRevision, first.contextRevision + 1, "changed evidence must advance revision");

const ledgerKeys = new Set(noPhoto.context.evidenceLedger.map((item) => item.key));
for (const key of [
  "concern_state",
  "photo_evidence_state",
  "recent_exposure_state",
  "reaction_link_state",
  "uncertainty_state"
]) {
  check(ledgerKeys.has(key), `evidence ledger must include ${key}`);
}

const caller = readFileSync(
  new URL("../lib/premium-decision-state.js", import.meta.url),
  "utf8"
);
check(
  caller.includes('from "./shared-skin-decision-context-v4.js"'),
  "Premium decision state must consume v4 context"
);
check(
  !caller.includes('from "./shared-skin-decision-context.js"'),
  "Premium decision state must not bypass v4 context"
);

console.log(`verify-shared-skin-decision-context-v4: ok (${assertions} assertions)`);
