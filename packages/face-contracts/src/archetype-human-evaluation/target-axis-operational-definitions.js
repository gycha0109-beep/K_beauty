export const TARGET_AXIS_OPERATIONAL_DEFINITION_SCHEMA_VERSION =
  "face-lab-target-axis-operational-definition-contract-v1";
export const TARGET_AXIS_OPERATIONAL_DEFINITION_CONTRACT_VERSION =
  "face-lab-target-axis-operational-definitions-20260814-v1";
export const TARGET_AXIS_REVIEWER_PACKET_SCHEMA_VERSION =
  "face-lab-target-axis-reviewer-safe-cue-definition-packet-v1";

export const TARGET_AXIS_DISPOSITIONS = Object.freeze([
  "RETAIN_WITH_OPERATIONAL_DEFINITION",
  "RETAIN_AS_COMPOSITE_WITH_CONSTITUENT_RULES",
  "DECOMPOSITION_REQUIRED_BEFORE_DIRECT_USE"
]);

export const TARGET_AXIS_HUMAN_AUDIT_READINESS = Object.freeze([
  "READY_FOR_BLIND_HUMAN_CUE_AUDIT",
  "NOT_READY_REQUIRES_DECOMPOSITION",
  "NOT_READY_REQUIRES_VALIDATION"
]);

const deepFreeze = (value) => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
};

const axis = (definition) => definition;

const AXES = [
  axis({
    axisPath: "observations.outline.faceShape",
    currentEnumValues: ["oval", "round", "square", "oblong", "heart", "diamond", "triangle", "mixed"],
    semanticRole: "whole-outline composite used only after constituent outline observations",
    disposition: "RETAIN_AS_COMPOSITE_WITH_CONSTITUENT_RULES",
    observableTarget: "The visible frontal facial perimeter considered through face length, upper-face width, cheek width, lower-face width, taper, and lower-contour direction changes.",
    referenceFrame: "Use the visible face perimeter and within-face width relationships; never use the image frame, hairstyle, or a population norm as the reference.",
    constituentObservations: [
      "observations.vertical.faceLengthBalance",
      "observations.outline.foreheadWidthVsCheek",
      "observations.outline.jawWidthVsCheek",
      "observations.outline.jawTaper",
      "observations.outline.cheekboneProminence",
      "observations.outline.jawlineAngularity"
    ],
    valueDefinitions: {
      oval: "The visible outline is longer than it is broad, the cheek region is the broadest or jointly broadest area, and the perimeter narrows gradually toward a rounded lower face without a strong corner.",
      round: "The visible outline has similar vertical and horizontal extent, broad curved cheeks, and a rounded lower perimeter with little taper or corner definition.",
      square: "The visible outline has similar vertical and horizontal extent, with upper, cheek, and lower-face widths remaining comparatively even and with clear lower-contour direction changes.",
      oblong: "The visible outline is distinctly longer than broad while upper, cheek, and lower-face widths remain comparatively even rather than tapering into an oval pattern.",
      heart: "The upper face is visibly wider than the lower face, cheek width remains prominent, and the lower perimeter tapers toward a narrower chin.",
      diamond: "The cheek region is visibly wider than both the upper face and lower face, with narrowing toward both forehead and chin.",
      triangle: "The lower face is visibly wider than the upper face, with width increasing toward the jaw rather than tapering toward the chin.",
      mixed: "Two or more constituent patterns conflict such that no single listed outline pattern dominates; mixed is not a substitute for insufficient evidence."
    },
    neighborContrasts: [
      "oval versus round: elongated perimeter with gradual taper versus similar vertical and horizontal extent with broad continuous curvature",
      "oval versus oblong: gradual cheek-to-jaw taper and rounded lower perimeter versus comparatively even widths along a long outline",
      "round versus square: continuously curved lower perimeter versus visible lower-contour direction changes and comparatively even widths",
      "square versus oblong: similar vertical and horizontal extent versus a distinctly elongated outline with comparatively even widths",
      "heart versus diamond: upper face remains a dominant width versus cheek width clearly exceeds both upper and lower face",
      "triangle versus heart: lower face is the wider end versus upper face is the wider end",
      "mixed versus uncertain: mixed requires visible conflicting constituent patterns; uncertain means the evidence cannot support the comparison"
    ],
    ambiguityRules: [
      "Use uncertain when the perimeter is visible but adjacent constituent patterns cannot be distinguished reliably.",
      "Use mixed only when contradictory constituent patterns are themselves visible."
    ],
    notAssessableConditions: ["non-frontal pose", "substantial hair occlusion", "forehead or chin cropped", "perspective distortion", "insufficient outline visibility"],
    imageConditionWarnings: ["hair occlusion", "head pose", "lens perspective", "cropping", "expression changing jaw width"],
    humanReviewerInstruction: "Inspect the named constituent relationships before choosing a composite outline token. Do not classify from a vague overall resemblance.",
    observerPrototypeInstruction: "Report constituent outline evidence first, then choose one composite token only when one defined pattern is supported.",
    evidenceTags: ["upper_face_wider", "cheek_region_widest", "lower_face_wider", "outline_longer_than_broad", "outline_height_width_similar", "lower_outline_rounded", "lower_outline_corners_visible", "constituent_patterns_conflict"],
    generationTokenParity: "exact",
    generationOperationalParity: "UNVALIDATED",
    generationParityNote: "Generation requests use the same shape tokens but do not consume these constituent-pattern definitions.",
    currentProductionObserverConsumesDefinition: false,
    rubricDependency: { sourceRegistryVersion: "face-lab-archetype-rubric-20260727", leverage: "REQUIRED_FOR_ONE_OR_MORE_TARGETS" },
    validationStatus: "READY_FOR_BLIND_HUMAN_CUE_AUDIT"
  }),
  axis({
    axisPath: "observations.outline.jawlineAngularity",
    currentEnumValues: ["soft", "moderate", "angular"],
    semanticRole: "lower-face contour geometry",
    disposition: "RETAIN_WITH_OPERATIONAL_DEFINITION",
    observableTarget: "Visible curvature and direction changes along the mandibular perimeter from the side of the lower face through the chin transition.",
    referenceFrame: "Use the frontal lower-face silhouette under level pose and even illumination; judge geometry rather than shadow darkness or facial thinness.",
    constituentObservations: ["lower-face contour curvature", "jaw corner visibility", "chin-transition direction change"],
    valueDefinitions: {
      soft: "The lower-face perimeter changes direction gradually, with rounded transitions and no clearly dominant jaw corner.",
      moderate: "The lower-face perimeter shows a visible but not dominant change of direction, between gradual curvature and a clearly cornered contour.",
      angular: "The lower-face perimeter shows a clearly visible corner or abrupt direction change that remains evident independently of shadow darkness."
    },
    neighborContrasts: [
      "soft versus moderate: gradual continuous curvature versus a visible localized direction change",
      "moderate versus angular: visible but subdued direction change versus a clearly dominant corner or abrupt transition"
    ],
    ambiguityRules: ["Use uncertain when lighting or partial contour visibility prevents separating a geometric corner from a shadow edge."],
    notAssessableConditions: ["jaw occluded by hair or beard", "non-frontal pose", "lower face cropped", "harsh directional shadow", "heavy retouching"],
    imageConditionWarnings: ["lighting", "facial hair", "hair occlusion", "pose", "retouching"],
    humanReviewerInstruction: "Follow the visible lower-face perimeter and classify its direction changes; do not use darkness, thinness, or hairstyle as the deciding signal.",
    observerPrototypeInstruction: "Describe lower-contour curvature and corner evidence before selecting soft, moderate, or angular.",
    evidenceTags: ["jaw_curve_gradual", "jaw_direction_change_visible", "jaw_corner_dominant", "shadow_confounds_contour"],
    generationTokenParity: "exact",
    generationOperationalParity: "UNVALIDATED",
    generationParityNote: "Generation phrases name jawline contour categories but do not consume this geometry rule.",
    currentProductionObserverConsumesDefinition: false,
    rubricDependency: { sourceRegistryVersion: "face-lab-archetype-rubric-20260727", leverage: "MIXED" },
    validationStatus: "READY_FOR_BLIND_HUMAN_CUE_AUDIT"
  }),
  axis({
    axisPath: "observations.vertical.faceLengthBalance",
    currentEnumValues: ["short", "balanced", "long"],
    semanticRole: "within-face vertical-to-horizontal proportion",
    disposition: "RETAIN_WITH_OPERATIONAL_DEFINITION",
    observableTarget: "The visible vertical extent from the upper facial boundary to the chin considered against the broad visible cheek region of the same face.",
    referenceFrame: "Use the face's own visible vertical extent and cheek-region width; image framing is not the reference.",
    constituentObservations: ["upper facial boundary visibility", "chin visibility", "visible face height", "cheek-region width"],
    valueDefinitions: {
      short: "The visible vertical extent is subdued relative to the broad cheek-region width, producing a compressed vertical proportion.",
      balanced: "Neither the visible vertical extent nor cheek-region width clearly dominates the within-face proportion.",
      long: "The visible vertical extent is prominent relative to the cheek-region width, producing an elongated vertical proportion."
    },
    neighborContrasts: [
      "short versus balanced: vertical extent is visibly subordinate versus neither dimension clearly dominates",
      "balanced versus long: neither dimension clearly dominates versus vertical extent visibly dominates"
    ],
    ambiguityRules: ["Use uncertain when the upper facial boundary is only partly visible but the within-face proportion can still be considered without a reliable category."],
    notAssessableConditions: ["upper facial boundary not visible", "chin cropped", "strong pitch", "perspective distortion", "face perimeter obscured"],
    imageConditionWarnings: ["hairline visibility", "chin visibility", "head pitch", "lens perspective", "cropping"],
    humanReviewerInstruction: "Compare visible face height with cheek-region width on the same face. Do not compare the face with the image frame or a demographic norm.",
    observerPrototypeInstruction: "State the within-face vertical-versus-cheek-width relationship before selecting short, balanced, or long.",
    evidenceTags: ["vertical_extent_subordinate", "vertical_horizontal_neither_dominates", "vertical_extent_prominent", "upper_boundary_partial"],
    generationTokenParity: "exact",
    generationOperationalParity: "UNVALIDATED",
    generationParityNote: "Generation names face-length balance but does not consume the same within-face reference.",
    currentProductionObserverConsumesDefinition: false,
    rubricDependency: { sourceRegistryVersion: "face-lab-archetype-rubric-20260727", leverage: "MIXED" },
    validationStatus: "READY_FOR_BLIND_HUMAN_CUE_AUDIT"
  }),
  axis({
    axisPath: "observations.eyes.eyeDirection",
    currentEnumValues: ["upturned", "level", "downturned", "mixed"],
    semanticRole: "bilateral eye-corner directional relation",
    disposition: "RETAIN_WITH_OPERATIONAL_DEFINITION",
    observableTarget: "The visible vertical relation of each eye's outer corner to its inner corner.",
    referenceFrame: "Evaluate each visible eye from inner to outer corner in a direct frontal, level, neutral-expression image.",
    constituentObservations: ["left inner-to-outer eye-corner relation", "right inner-to-outer eye-corner relation"],
    valueDefinitions: {
      upturned: "Both assessable eyes show the outer corner visibly higher than the inner corner.",
      level: "Both assessable eyes show no clear upward or downward outer-corner displacement.",
      downturned: "Both assessable eyes show the outer corner visibly lower than the inner corner.",
      mixed: "The two assessable eyes show meaningfully different directional patterns, including opposite directions or one directional eye with the other level."
    },
    neighborContrasts: [
      "upturned versus level: outer corners are visibly higher versus no clear vertical displacement",
      "level versus downturned: no clear vertical displacement versus outer corners are visibly lower",
      "directional versus mixed: both eyes support one pattern versus the two eyes support different patterns"
    ],
    ambiguityRules: ["Use uncertain when both corners are visible but their vertical relation cannot be distinguished reliably."],
    notAssessableConditions: ["one or both eye corners occluded", "non-frontal pose", "head roll", "expression distorts eye corners", "insufficient sharpness"],
    imageConditionWarnings: ["head roll", "yaw", "expression", "eyeliner", "hair occlusion"],
    humanReviewerInstruction: "Judge each eye's inner-to-outer corner relation. Do not use eyebrow direction as the deciding signal.",
    observerPrototypeInstruction: "Record bilateral eye-corner relations, then select upturned, level, downturned, or mixed.",
    evidenceTags: ["outer_eye_corner_higher", "outer_eye_corner_level", "outer_eye_corner_lower", "bilateral_direction_differs"],
    generationTokenParity: "exact",
    generationOperationalParity: "UNVALIDATED",
    generationParityNote: "Generation uses the same direction tokens but does not consume the bilateral canthus rule.",
    currentProductionObserverConsumesDefinition: false,
    rubricDependency: { sourceRegistryVersion: "face-lab-archetype-rubric-20260727", leverage: "REQUIRED_FOR_ONE_OR_MORE_TARGETS" },
    validationStatus: "READY_FOR_BLIND_HUMAN_CUE_AUDIT"
  }),
  axis({
    axisPath: "observations.eyes.eyeLength",
    currentEnumValues: ["short", "medium", "long"],
    semanticRole: "horizontal eye-opening span",
    disposition: "RETAIN_WITH_OPERATIONAL_DEFINITION",
    observableTarget: "The horizontal span between visible inner and outer eye-opening endpoints, kept distinct from vertical aperture.",
    referenceFrame: "Use both eyes in the context of the same visible face width and neighboring central-feature scale; no validated single reference dominates yet.",
    constituentObservations: ["horizontal eye-opening span", "visible face-width context", "neighboring central-feature scale"],
    valueDefinitions: {
      short: "The horizontal eye-opening span appears compact in the same-face width and neighboring-feature context.",
      medium: "The horizontal eye-opening span is neither clearly compact nor clearly prominent in the same-face context.",
      long: "The horizontal eye-opening span appears prominent in the same-face width and neighboring-feature context."
    },
    neighborContrasts: [
      "short versus medium: horizontal span is clearly compact versus not clearly compact or prominent",
      "medium versus long: span is not clearly compact or prominent versus clearly prominent"
    ],
    ambiguityRules: ["Use uncertain when plausible reference frames disagree or the horizontal endpoints are visible but category separation remains unreliable."],
    notAssessableConditions: ["eye endpoints occluded", "non-frontal pose", "strong perspective", "insufficient sharpness", "one eye not visible"],
    imageConditionWarnings: ["yaw", "perspective", "eyeliner", "occlusion", "sharpness"],
    humanReviewerInstruction: "Judge horizontal span only. Do not substitute vertical eye openness for eye length, and use uncertain when same-face reference cues disagree.",
    observerPrototypeInstruction: "Describe horizontal span and the same-face reference evidence separately before selecting a token.",
    evidenceTags: ["horizontal_eye_span_compact", "horizontal_eye_span_intermediate", "horizontal_eye_span_prominent", "reference_frames_disagree"],
    generationTokenParity: "exact",
    generationOperationalParity: "UNVALIDATED",
    generationParityNote: "Generation specifies horizontal length but does not freeze the same qualitative reference frame.",
    currentProductionObserverConsumesDefinition: false,
    rubricDependency: { sourceRegistryVersion: "face-lab-archetype-rubric-20260727", leverage: "REQUIRED_FOR_ONE_OR_MORE_TARGETS" },
    validationStatus: "NOT_READY_REQUIRES_VALIDATION"
  }),
  axis({
    axisPath: "observations.eyes.eyeOpenness",
    currentEnumValues: ["narrow", "medium", "wide"],
    semanticRole: "vertical eye-opening aperture",
    disposition: "RETAIN_WITH_OPERATIONAL_DEFINITION",
    observableTarget: "The visible vertical opening between upper and lower eyelid margins, considered separately from horizontal eye length.",
    referenceFrame: "Use each eye's own horizontal span and cautious iris or sclera exposure evidence under neutral expression.",
    constituentObservations: ["vertical eyelid aperture", "horizontal eye span", "iris exposure", "sclera exposure", "expression state"],
    valueDefinitions: {
      narrow: "Vertical eyelid aperture is visibly compressed relative to the same eye's horizontal span, with limited iris or sclera exposure consistent with that aperture.",
      medium: "Vertical aperture is neither clearly compressed nor clearly expanded relative to the same eye's horizontal span.",
      wide: "Vertical eyelid aperture is visibly expanded relative to the same eye's horizontal span, with increased iris or sclera exposure consistent with that aperture."
    },
    neighborContrasts: [
      "narrow versus medium: aperture is clearly compressed versus neither compressed nor expanded",
      "medium versus wide: aperture is neither compressed nor expanded versus clearly expanded"
    ],
    ambiguityRules: ["Use uncertain when expression or eyelid position may be transient but visible evidence remains partially interpretable."],
    notAssessableConditions: ["eyes partly closed", "expression not neutral", "eye occlusion", "non-frontal pose", "insufficient sharpness"],
    imageConditionWarnings: ["expression", "blink state", "yaw", "eyeliner", "sharpness"],
    humanReviewerInstruction: "Judge vertical aperture relative to the same eye's horizontal span. Do not use horizontal eye length as the category itself.",
    observerPrototypeInstruction: "Describe vertical aperture and supporting exposure evidence before selecting narrow, medium, or wide.",
    evidenceTags: ["vertical_eye_aperture_compressed", "vertical_eye_aperture_intermediate", "vertical_eye_aperture_expanded", "expression_may_affect_aperture"],
    generationTokenParity: "exact",
    generationOperationalParity: "UNVALIDATED",
    generationParityNote: "Generation names eye openness but does not consume this vertical-aperture reference rule.",
    currentProductionObserverConsumesDefinition: false,
    rubricDependency: { sourceRegistryVersion: "face-lab-archetype-rubric-20260727", leverage: "REQUIRED_FOR_ONE_OR_MORE_TARGETS" },
    validationStatus: "READY_FOR_BLIND_HUMAN_CUE_AUDIT"
  }),
  axis({
    axisPath: "observations.featureLayout.featureScale",
    currentEnumValues: ["small", "medium", "large", "mixed"],
    semanticRole: "composite scale of a frozen central-feature set",
    disposition: "RETAIN_AS_COMPOSITE_WITH_CONSTITUENT_RULES",
    observableTarget: "The visible scale of eyes, brows, nose, and lips relative to the same visible face, assessed per feature before aggregation.",
    referenceFrame: "Use the same face perimeter as the shared context. Cheekbones and jawline are excluded from this v1 scale aggregate.",
    constituentObservations: ["eyes", "brows", "nose", "lips"],
    valueDefinitions: {
      small: "Most assessable constituent features appear visually compact relative to the same face.",
      medium: "Most assessable constituent features are neither clearly compact nor clearly prominent relative to the same face.",
      large: "Most assessable constituent features appear visually prominent in scale relative to the same face.",
      mixed: "Assessable constituent features support materially different scale categories; mixed does not mean uncertain."
    },
    neighborContrasts: [
      "small versus medium: most constituents are clearly compact versus mostly intermediate",
      "medium versus large: most constituents are mostly intermediate versus clearly prominent",
      "uniform category versus mixed: constituents broadly agree versus support materially different scale categories"
    ],
    ambiguityRules: ["Use uncertain when too few constituent features are reliable or when borderline constituents do not establish either agreement or heterogeneity."],
    notAssessableConditions: ["face perimeter unavailable", "multiple central features occluded", "strong perspective", "expression distorts features", "insufficient sharpness"],
    imageConditionWarnings: ["perspective", "expression", "makeup", "occlusion", "cropping"],
    humanReviewerInstruction: "Assess eyes, brows, nose, and lips separately, then aggregate. Do not include cheekbones or jawline, and do not use mixed as uncertainty.",
    observerPrototypeInstruction: "Record per-feature scale evidence for the frozen constituent set before selecting the composite token.",
    evidenceTags: ["eyes_scale_compact", "brows_scale_compact", "nose_scale_prominent", "lips_scale_prominent", "feature_scales_mostly_intermediate", "feature_scales_heterogeneous"],
    generationTokenParity: "exact",
    generationOperationalParity: "UNVALIDATED",
    generationParityNote: "Generation uses holistic scale tokens without consuming the frozen constituent set or aggregation rule.",
    currentProductionObserverConsumesDefinition: false,
    rubricDependency: { sourceRegistryVersion: "face-lab-archetype-rubric-20260727", leverage: "MIXED" },
    validationStatus: "READY_FOR_BLIND_HUMAN_CUE_AUDIT"
  }),
  axis({
    axisPath: "observations.featureLayout.featureConcentration",
    currentEnumValues: ["spread", "balanced", "centered"],
    semanticRole: "composite spatial distribution of central facial features",
    disposition: "RETAIN_AS_COMPOSITE_WITH_CONSTITUENT_RULES",
    observableTarget: "The spatial distribution of eyes, brows, nose, and lips relative to the visible facial center and perimeter.",
    referenceFrame: "Use the midpoint of the visible facial outline and the same-face perimeter under frontal, level pose; feature size is not the deciding signal.",
    constituentObservations: ["eyes position", "brows position", "nose position", "lips position", "visible facial center", "face perimeter"],
    valueDefinitions: {
      spread: "The major central features collectively occupy a broader portion of the visible face and sit farther from the facial center.",
      balanced: "The major central features show neither a clearly broad distribution nor a clearly center-clustered distribution.",
      centered: "The major central features collectively cluster more closely around the facial center, leaving more peripheral facial area."
    },
    neighborContrasts: [
      "spread versus balanced: broad distribution clearly dominates versus neither broad nor center-clustered distribution dominates",
      "balanced versus centered: neither distribution dominates versus center clustering clearly dominates"
    ],
    ambiguityRules: ["Use uncertain when pose or perimeter visibility prevents a stable facial-center judgment or when feature positions conflict."],
    notAssessableConditions: ["non-frontal pose", "face perimeter unavailable", "central features occluded", "strong perspective", "cropping"],
    imageConditionWarnings: ["yaw", "lens perspective", "cropping", "facial expression", "occlusion"],
    humanReviewerInstruction: "Judge feature positions relative to the same facial center and perimeter. Do not infer concentration from feature size or face narrowness alone.",
    observerPrototypeInstruction: "Describe the distribution of the frozen central-feature set before selecting spread, balanced, or centered.",
    evidenceTags: ["features_broadly_distributed", "feature_distribution_intermediate", "features_cluster_near_center", "feature_positions_conflict"],
    generationTokenParity: "exact",
    generationOperationalParity: "UNVALIDATED",
    generationParityNote: "Generation names concentration tokens without consuming this center-and-perimeter constituent rule.",
    currentProductionObserverConsumesDefinition: false,
    rubricDependency: { sourceRegistryVersion: "face-lab-archetype-rubric-20260727", leverage: "MIXED" },
    validationStatus: "READY_FOR_BLIND_HUMAN_CUE_AUDIT"
  }),
  axis({
    axisPath: "observations.visualLanguage.straightCurveBalance",
    currentEnumValues: ["curved", "balanced", "straight"],
    semanticRole: "composite line-geometry balance",
    disposition: "RETAIN_AS_COMPOSITE_WITH_CONSTITUENT_RULES",
    observableTarget: "The balance of visibly curved versus visibly straight geometry across brows, eye openings, nose bridge or edges, jawline, and lip contour.",
    referenceFrame: "Assess the frozen facial-structure set separately; exclude hairstyle, clothing, background, and makeup graphics.",
    constituentObservations: ["brows", "eye openings", "nose bridge or edges", "jawline", "lip contour"],
    valueDefinitions: {
      curved: "Curved geometry visibly predominates across the assessable constituent structures.",
      balanced: "Assessable constituent structures contain a visible mixture of curved and straight geometry without either consistently predominating.",
      straight: "Straight or sharply directional geometry visibly predominates across the assessable constituent structures."
    },
    neighborContrasts: [
      "curved versus balanced: curved geometry consistently predominates versus neither geometry consistently predominates",
      "balanced versus straight: neither geometry consistently predominates versus straight geometry consistently predominates"
    ],
    ambiguityRules: ["Use uncertain when constituents are visible but too contradictory or borderline to establish predominance; balanced requires a supported mixture, not lack of judgment."],
    notAssessableConditions: ["most constituent structures occluded", "non-frontal pose", "heavy makeup changes line appearance", "expression changes contours", "insufficient sharpness"],
    imageConditionWarnings: ["makeup", "expression", "pose", "occlusion", "retouching"],
    humanReviewerInstruction: "Assess only the frozen facial structures. Balanced requires visible curved and straight evidence; uncertain means the evidence cannot support the balance.",
    observerPrototypeInstruction: "Record per-structure curve or straight evidence before selecting the holistic balance token.",
    evidenceTags: ["brow_curves_predominate", "eye_contours_curved", "nose_edges_straight", "jaw_directions_straight", "lip_contour_curved", "line_geometry_mixed_supported"],
    generationTokenParity: "exact",
    generationOperationalParity: "UNVALIDATED",
    generationParityNote: "Generation uses the same balance tokens but does not consume the frozen structure inventory or aggregation rule.",
    currentProductionObserverConsumesDefinition: false,
    rubricDependency: { sourceRegistryVersion: "face-lab-archetype-rubric-20260727", leverage: "MIXED" },
    validationStatus: "READY_FOR_BLIND_HUMAN_CUE_AUDIT"
  }),
  axis({
    axisPath: "observations.visualLanguage.contourDefinition",
    currentEnumValues: ["soft", "moderate", "defined"],
    semanticRole: "composite visibility of structural facial boundaries",
    disposition: "RETAIN_AS_COMPOSITE_WITH_CONSTITUENT_RULES",
    observableTarget: "The visibility and geometric continuity of the facial perimeter, jawline boundary, and cheek transition after separating structural evidence from photographic edge enhancement.",
    referenceFrame: "Use the named facial boundaries under even lighting and stable sharpness; record image-condition evidence independently.",
    constituentObservations: ["facial perimeter", "jawline boundary", "cheek transition"],
    valueDefinitions: {
      soft: "Named structural boundaries transition gradually and are not strongly delineated when image conditions are suitable.",
      moderate: "Named structural boundaries are visible and localized without consistently strong delineation.",
      defined: "Named structural boundaries remain clearly delineated across multiple assessable regions without relying on harsh shadow or sharpening artifacts."
    },
    neighborContrasts: [
      "soft versus moderate: boundaries transition gradually versus visible localized delineation",
      "moderate versus defined: localized delineation versus clear delineation across multiple regions"
    ],
    ambiguityRules: ["Use uncertain when structural and photographic edge evidence cannot be separated reliably."],
    notAssessableConditions: ["uneven or harsh lighting", "blur or oversharpening", "heavy makeup contouring", "retouching possible", "named boundaries occluded"],
    imageConditionWarnings: ["lighting", "contrast", "sharpness", "editing", "makeup"],
    humanReviewerInstruction: "Use only the named facial boundaries and separate structural delineation from shadow, makeup, contrast, and sharpening.",
    observerPrototypeInstruction: "Report structural boundary evidence and image-condition confounds separately before selecting a token.",
    evidenceTags: ["facial_perimeter_gradual", "jaw_boundary_localized", "multiple_boundaries_clearly_delineated", "photographic_edge_confound"],
    generationTokenParity: "exact",
    generationOperationalParity: "UNVALIDATED",
    generationParityNote: "Generation names contour definition but does not separate structural boundary visibility from photographic contrast using this rule.",
    currentProductionObserverConsumesDefinition: false,
    rubricDependency: { sourceRegistryVersion: "face-lab-archetype-rubric-20260727", leverage: "REQUIRED_FOR_ONE_OR_MORE_TARGETS" },
    validationStatus: "NOT_READY_REQUIRES_VALIDATION"
  }),
  axis({
    axisPath: "observations.visualLanguage.featureContrast",
    currentEnumValues: ["low", "medium", "high"],
    semanticRole: "historical composite contrast label with unresolved meaning",
    disposition: "DECOMPOSITION_REQUIRED_BEFORE_DIRECT_USE",
    observableTarget: "No single observable target is frozen because the historical token can conflate tonal or color contrast, geometric scale contrast, and feature-versus-face salience.",
    referenceFrame: "Candidate future components must each declare a feature set and within-image reference; the current aggregate has no defensible shared reference.",
    constituentObservations: ["tonal or color contrast candidate", "geometric scale contrast candidate", "feature-versus-face salience candidate"],
    valueDefinitions: {
      low: "Historical token retained for compatibility; direct evaluation is not allowed until the contrast construct is decomposed.",
      medium: "Historical token retained for compatibility; direct evaluation is not allowed until the contrast construct is decomposed.",
      high: "Historical token retained for compatibility; direct evaluation is not allowed until the contrast construct is decomposed."
    },
    neighborContrasts: [],
    ambiguityRules: ["Do not select low, medium, or high in a new cue audit; mark this axis not_assessable under this contract version."],
    notAssessableConditions: ["always not assessable for direct use until decomposition is frozen and validated"],
    imageConditionWarnings: ["lighting", "white balance", "makeup", "skin tone rendering", "exposure", "editing", "feature scale"],
    humanReviewerInstruction: "Do not classify the historical aggregate. Record not_assessable until separate contrast components are defined in a later contract.",
    observerPrototypeInstruction: "Do not emit a prototype aggregate classification; preserve the historical field only for compatibility.",
    evidenceTags: ["tonal_contrast_candidate", "scale_contrast_candidate", "feature_salience_candidate", "contrast_construct_unresolved"],
    generationTokenParity: "exact",
    generationOperationalParity: "UNVALIDATED",
    generationParityNote: "Generation uses low, medium, and high without resolving which contrast construct is intended.",
    currentProductionObserverConsumesDefinition: false,
    rubricDependency: { sourceRegistryVersion: "face-lab-archetype-rubric-20260727", leverage: "MIXED" },
    validationStatus: "NOT_READY_REQUIRES_DECOMPOSITION"
  })
];

const CONTRACT_WITHOUT_DIGEST = {
  schemaVersion: TARGET_AXIS_OPERATIONAL_DEFINITION_SCHEMA_VERSION,
  contractVersion: TARGET_AXIS_OPERATIONAL_DEFINITION_CONTRACT_VERSION,
  status: "evaluation_ready_not_production_active",
  authorityPurpose: "human_and_observer_discriminability_evaluation",
  historicalObserverDefinitionVersion: "face-lab-observation-prompt-v1-label-only",
  newEvaluationDefinitionVersion: TARGET_AXIS_OPERATIONAL_DEFINITION_CONTRACT_VERSION,
  productionConsumption: {
    observation: false,
    generation: false,
    scoring: false
  },
  responseOptions: ["uncertain", "not_assessable"],
  commonReviewerRules: {
    visibleEvidenceOnly: true,
    populationNormsForbidden: true,
    numericThresholdsActivated: false,
    forcedCategoryForbidden: true,
    uncertainMeaning: "The feature is visible, but neighboring categories cannot be distinguished reliably.",
    notAssessableMeaning: "The image does not provide enough valid evidence because of pose, occlusion, quality, expression, lighting, makeup, perspective, or an axis-specific limitation."
  },
  axes: AXES,
  blindHumanPacketRequirements: {
    hidden: [
      "generation condition",
      "GenerationSpec",
      "generation prompt",
      "intended cue",
      "Archetype target",
      "shadow scorer output",
      "previous Vision output",
      "historical diagnostic result",
      "semantic target filename"
    ],
    visible: ["opaque candidate identifier", "image", "operational cue definitions", "enum options", "uncertain", "not_assessable", "allowed evidence tags", "Human-contract confidence scale"],
    currentOperatorIndependent: false,
    currentConversationIndependent: false,
    forcedArchetypeTop1: false
  }
};

export const FACE_LAB_TARGET_AXIS_OPERATIONAL_DEFINITION_CONTRACT = deepFreeze({
  ...CONTRACT_WITHOUT_DIGEST,
  contractDigest: "8e630605ece0629da6a51e30829297688c27f10a3a92be6a3c8e3413f546bb46"
});

const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const exactKeys = (value, keys) => isObject(value) &&
  Object.keys(value).sort().join("|") === [...keys].sort().join("|");

export function validateTargetAxisOperationalDefinitionContract(value) {
  const errors = [];
  const topKeys = [
    "schemaVersion", "contractVersion", "status", "authorityPurpose",
    "historicalObserverDefinitionVersion", "newEvaluationDefinitionVersion",
    "productionConsumption", "responseOptions", "commonReviewerRules", "axes",
    "blindHumanPacketRequirements", "contractDigest"
  ];
  if (!exactKeys(value, topKeys)) return { ok: false, errors: ["contract_shape_invalid"] };
  if (value.schemaVersion !== TARGET_AXIS_OPERATIONAL_DEFINITION_SCHEMA_VERSION ||
      value.contractVersion !== TARGET_AXIS_OPERATIONAL_DEFINITION_CONTRACT_VERSION ||
      value.status !== "evaluation_ready_not_production_active" ||
      !/^[a-f0-9]{64}$/.test(value.contractDigest || "")) {
    errors.push("contract_identity_invalid");
  }
  if (!exactKeys(value.productionConsumption, ["observation", "generation", "scoring"]) ||
      Object.values(value.productionConsumption).some((item) => item !== false)) {
    errors.push("production_consumption_invalid");
  }
  if (!Array.isArray(value.axes) || value.axes.length !== 11 ||
      new Set(value.axes.map((item) => item.axisPath)).size !== 11) {
    errors.push("axis_set_invalid");
  }
  const axisKeys = [
    "axisPath", "currentEnumValues", "semanticRole", "disposition", "observableTarget",
    "referenceFrame", "constituentObservations", "valueDefinitions", "neighborContrasts",
    "ambiguityRules", "notAssessableConditions", "imageConditionWarnings",
    "humanReviewerInstruction", "observerPrototypeInstruction", "evidenceTags",
    "generationTokenParity", "generationOperationalParity", "generationParityNote",
    "currentProductionObserverConsumesDefinition", "rubricDependency", "validationStatus"
  ];
  for (const item of value.axes || []) {
    if (!exactKeys(item, axisKeys) || !TARGET_AXIS_DISPOSITIONS.includes(item.disposition) ||
        !TARGET_AXIS_HUMAN_AUDIT_READINESS.includes(item.validationStatus) ||
        !Array.isArray(item.currentEnumValues) || item.currentEnumValues.length < 2 ||
        new Set(item.currentEnumValues).size !== item.currentEnumValues.length ||
        !exactKeys(item.valueDefinitions, item.currentEnumValues) ||
        item.currentEnumValues.some((token) => !item.valueDefinitions[token]?.trim()) ||
        !Array.isArray(item.ambiguityRules) || item.ambiguityRules.length === 0 ||
        !Array.isArray(item.notAssessableConditions) || item.notAssessableConditions.length === 0 ||
        !Array.isArray(item.evidenceTags) || item.evidenceTags.length === 0 ||
        item.generationTokenParity !== "exact" ||
        item.generationOperationalParity !== "UNVALIDATED" ||
        item.currentProductionObserverConsumesDefinition !== false) {
      errors.push(`axis_invalid:${item?.axisPath || "unknown"}`);
    }
    if (item.disposition !== "DECOMPOSITION_REQUIRED_BEFORE_DIRECT_USE" && item.neighborContrasts.length !== item.currentEnumValues.length - 1) {
      errors.push(`neighbor_contrasts_invalid:${item.axisPath}`);
    }
    if (item.disposition === "DECOMPOSITION_REQUIRED_BEFORE_DIRECT_USE" && item.validationStatus !== "NOT_READY_REQUIRES_DECOMPOSITION") {
      errors.push(`decomposition_readiness_invalid:${item.axisPath}`);
    }
  }
  return { ok: errors.length === 0, errors };
}

export function canonicalizeTargetAxisOperationalDefinitionContract(value) {
  const semantic = Object.fromEntries(Object.entries(value).filter(([key]) => key !== "contractDigest"));
  const sort = (item) => Array.isArray(item)
    ? item.map(sort)
    : isObject(item)
      ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, sort(item[key])]))
      : item;
  return JSON.stringify(sort(semantic));
}

export function projectTargetAxisDefinitionsForReviewer(
  value = FACE_LAB_TARGET_AXIS_OPERATIONAL_DEFINITION_CONTRACT
) {
  if (!validateTargetAxisOperationalDefinitionContract(value).ok) return null;
  return deepFreeze({
    schemaVersion: TARGET_AXIS_REVIEWER_PACKET_SCHEMA_VERSION,
    definitionContractVersion: value.contractVersion,
    responseOptions: [...value.responseOptions],
    commonReviewerRules: structuredClone(value.commonReviewerRules),
    axes: value.axes.map((item) => ({
      axisPath: item.axisPath,
      currentEnumValues: [...item.currentEnumValues],
      disposition: item.disposition,
      observableTarget: item.observableTarget,
      referenceFrame: item.referenceFrame,
      constituentObservations: [...item.constituentObservations],
      valueDefinitions: structuredClone(item.valueDefinitions),
      neighborContrasts: [...item.neighborContrasts],
      ambiguityRules: [...item.ambiguityRules],
      notAssessableConditions: [...item.notAssessableConditions],
      imageConditionWarnings: [...item.imageConditionWarnings],
      humanReviewerInstruction: item.humanReviewerInstruction,
      evidenceTags: [...item.evidenceTags],
      validationStatus: item.validationStatus
    }))
  });
}
