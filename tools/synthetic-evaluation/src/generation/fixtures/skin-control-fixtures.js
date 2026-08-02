import {
  EXCLUSION_POLICY_VERSION,
  GENERATION_REFERENCE_PRESERVE_ORDER,
  GENERATION_SPEC_SCHEMA_VERSION
} from "@bejewely/face-contracts";
import { deepFreeze } from "../canonicalize-generation-spec.js";

const SUBJECT = deepFreeze({
  syntheticPersonOnly: true,
  adultAgeBand: "20s",
  presentation: "feminine",
  regionalAppearanceHint: "korean_appearance_hint",
  personCount: 1
});

const CAPTURE = deepFreeze({
  mediaStyle: "realistic_documentary_reference",
  pose: "direct_frontal",
  gaze: "camera",
  expression: "neutral",
  framing: "head_and_shoulders",
  headVisibility: "full_head_neck_upper_shoulders",
  background: "plain_light_gray",
  lighting: "soft_even_diffuse",
  whiteBalance: "natural",
  focus: "sharp_face",
  aspectRatio: "1:1",
  width: 1024,
  height: 1024
});

const APPEARANCE = deepFreeze({
  hairColor: "dark_brown_black",
  hairStyle: "tied_back",
  hairFaceClearance: "away_from_forehead_and_cheeks",
  clothing: "plain_crew_neck_top",
  glasses: false,
  jewelry: false,
  visibleAccessories: false,
  visibleMakeup: "none"
});

const PROVENANCE = deepFreeze({
  campaignId: "skin-control-abcd-v1",
  authoredBy: "campaign_planner",
  sourceTemplateId: "skin-control-reference-portrait",
  sourceTemplateVersion: "1.0.0",
  createdAt: "2026-08-02T00:00:00.000Z",
  notes: null
});

const INDEPENDENT_VARIATION = deepFreeze({
  pairingMode: "independent",
  referenceCandidateId: null,
  mutationScope: "full_generation",
  preserve: []
});

function skinIntent({ redness, blemishes }) {
  return {
    baselineTexture: "natural_visible_pores",
    redness,
    blemishes,
    oiliness: "not_targeted",
    dryness: "not_targeted"
  };
}

function buildFixture(id, skin) {
  return deepFreeze({
    id,
    spec: {
      schemaVersion: GENERATION_SPEC_SCHEMA_VERSION,
      purpose: "skin_cue_control",
      subject: SUBJECT,
      capture: CAPTURE,
      appearance: APPEARANCE,
      featureIntent: null,
      archetypeIntent: null,
      skinIntent: skin,
      variation: INDEPENDENT_VARIATION,
      exclusionPolicyVersion: EXCLUSION_POLICY_VERSION,
      provenance: PROVENANCE
    }
  });
}

const NO_REDNESS = deepFreeze({ severity: "none", regions: [], pattern: "none" });
const MILD_REDNESS = deepFreeze({
  severity: "mild",
  regions: ["left_cheek", "right_cheek", "sides_of_nose"],
  pattern: "diffuse"
});
const NO_BLEMISHES = deepFreeze({
  severity: "none",
  regions: [],
  countBand: "none",
  pattern: "none"
});
const MILD_BLEMISHES = deepFreeze({
  severity: "mild",
  regions: ["left_cheek", "right_cheek", "chin"],
  countBand: "three_to_five",
  pattern: "discrete"
});

export const SKIN_CONTROL_FIXTURES = deepFreeze({
  A: buildFixture("A_clean", skinIntent({ redness: NO_REDNESS, blemishes: NO_BLEMISHES })),
  B: buildFixture("B_redness_only", skinIntent({ redness: MILD_REDNESS, blemishes: NO_BLEMISHES })),
  C: buildFixture("C_blemishes_only", skinIntent({ redness: NO_REDNESS, blemishes: MILD_BLEMISHES })),
  D: buildFixture("D_combined", skinIntent({ redness: MILD_REDNESS, blemishes: MILD_BLEMISHES }))
});

export function createPairedSkinEditDraft(skin, referenceCandidateId) {
  return {
    ...SKIN_CONTROL_FIXTURES.D.spec,
    purpose: "paired_skin_edit",
    skinIntent: JSON.parse(JSON.stringify(skin)),
    variation: {
      pairingMode: "reference_edit",
      referenceCandidateId,
      mutationScope: "skin_only",
      preserve: [...GENERATION_REFERENCE_PRESERVE_ORDER]
    }
  };
}
