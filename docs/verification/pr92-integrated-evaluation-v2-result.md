# PR92 Integrated Evaluation V2 Gate

- Commit: `a21b08e914f6b1143c7020bfbdf49cf8a7a23406`
- Runner: `Linux`
- Node target: `24`

## npm ci

PASS

## syntax

PASS

## integrated evaluation v2

FAIL (exit 1)

## shared context

PASS

## functional policy

PASS

## routine policy

PASS

## condition policy

PASS

## cross-domain consistency

PASS

## premium decision state

PASS

## premium report reentry

PASS

## candidate runtime safety

PASS

## candidate goal alignment

PASS

## candidate current findings

PASS

## architecture guard

PASS

## optimized build

FAIL (exit 1)

## diff hygiene

FAIL (exit 2)

## Result

PR92_INTEGRATED_EVALUATION_V2_GATE_FAIL

## Log tail

```text
      recentExposureState: 'none_reported',
      recentExposures: [],
      reactionLinkState: 'none_reported',
      reactionLinkedExposures: [],
      unknownExposurePresent: false,
      concentrationOrStrengthInferred: false
    },
    safetyState: {
      level: 'stable',
      sensitiveBurden: false,
      sensitivePriority: false,
      highSensitiveAxes: [],
      activeBurden: false,
      activeExpansionAllowed: true,
      exfoliationExpansionAllowed: true,
      protectionMustMaintain: true,
      recentSkinChange: 'no',
      recentlyChangedProduct: 'no',
      reasonCodes: []
    },
    routineBurdenState: {
      cleansingBurden: 'normal',
      layerBurden: 'unknown',
      activeStackBurden: 'none',
      makeupLayerBurden: 'normal',
      duplicateAxisBurden: false,
      unknownProductBurden: false,
      selectedSlotCount: 0,
      completeness: 'minimal'
    },
    environmentState: {
      outdoorExposure: false,
      heatExposure: false,
      humidityExposure: false,
      airconExposure: false,
      maskExposure: false,
      makeupUse: false,
      completeness: 'available'
    },
    conditionSignalState: {
      rednessOrIrritation: 'no',
      drynessOrTightness: 'no',
      oilinessIncrease: 'no',
      breakoutIncrease: 'unknown',
      flakingIncrease: 'unknown',
      productReaction: 'no',
      recentSkinChange: 'no',
      recentProductChange: 'no',
      completeness: 'partial'
    },
    evidenceLedger: [
      { key: 'priority_axis', source: 'free_result', value: 'pores' },
      { key: 'concern_score:barrier', source: 'free_result', value: 8 },
      { key: 'concern_score:redness', source: 'free_result', value: 6 },
      {
        key: 'concern_score:dehydration',
        source: 'free_result',
        value: 10
      },
      {
        key: 'concern_score:oiliness',
        source: 'free_result',
        value: 7
      },
      { key: 'concern_score:acne', source: 'free_result', value: 9 },
      { key: 'concern_score:pores', source: 'free_result', value: 24 },
      {
        key: 'concern_score:uneven_tone',
        source: 'free_result',
        value: 5
      },
      { key: 'concern_score:uv', source: 'free_result', value: 12 },
      {
        key: 'active_exposure_count',
        source: 'current_products',
        value: 0
      },
      {
        key: 'duplicate_active_axes',
        source: 'current_products',
        value: []
      },
      {
        key: 'safety_level',
        source: 'shared_context',
        value: 'stable'
      },
      {
        key: 'routine_burden',
        source: 'shared_context',
        value: {
          cleansingBurden: 'normal',
          layerBurden: 'unknown',
          activeStackBurden: 'none',
          makeupLayerBurden: 'normal',
          duplicateAxisBurden: false,
          unknownProductBurden: false,
          selectedSlotCount: 0,
          completeness: 'minimal'
        }
      },
      {
        key: 'condition_signals',
        source: 'survey',
        value: {
          rednessOrIrritation: 'no',
          drynessOrTightness: 'no',
          oilinessIncrease: 'no',
          breakoutIncrease: 'unknown',
          flakingIncrease: 'unknown',
          productReaction: 'no',
          recentSkinChange: 'no',
          recentProductChange: 'no',
          completeness: 'partial'
        }
      },
      {
        key: 'skin_state',
        source: 'survey_and_concern_scores',
        value: {
          skinType: 'combination',
          sensitivity: 'low',
          burdenAxesKnown: [
            'barrier',
            'redness',
            'dehydration',
            'oiliness',
            'acne',
            'pores',
            'uneven_tone',
            'uv'
          ]
        }
      },
      {
        key: 'concern_state',
        source: 'shared_context',
        value: {
          priorityAxis: 'pores',
          completeness: 'complete',
          unknownAxes: []
        }
      },
      {
        key: 'photo_evidence_state',
        source: 'photo',
        value: {
          status: 'not_provided',
          evidenceAvailable: false,
          failureReason: null
        }
      },
      {
        key: 'recent_exposure_state',
        source: 'survey_and_current_products',
        value: 'none_reported'
      },
      {
        key: 'reaction_link_state',
        source: 'survey_and_current_products',
        value: 'none_reported'
      },
      {
        key: 'uncertainty_state',
        source: 'shared_context',
        value: {
          level: 'medium',
          reasons: [ 'photo_not_provided' ],
          confidenceCeiling: 'medium'
        }
      }
    ],
    metadata: { source: 'locale-en', warnings: [] },
    concernState: {
      priorityAxis: 'pores',
      priorityScore: 24,
      scores: {
        barrier: 8,
        redness: 6,
        dehydration: 10,
        oiliness: 7,
        acne: 9,
        pores: 24,
        uneven_tone: 5,
        uv: 12
      },
      knownAxes: [
        'barrier',
        'redness',
        'dehydration',
        'oiliness',
        'acne',
        'pores',
        'uneven_tone',
        'uv'
      ],
      unknownAxes: [],
      completeness: 'complete',
      surveyPhotoAlignment: 'unknown'
    },
    uncertaintyState: {
      level: 'medium',
      reasons: [ 'photo_not_provided' ],
      confidenceCeiling: 'medium',
      unknownPreserved: true,
      factsMayBeInferred: false
    }
  },
  operator: 'deepStrictEqual',
  diff: 'simple'
}

Node.js v24.18.0
### diff hygiene
docs/verification/pr92-integrated-evaluation-v2-result.md:140: trailing whitespace.
+   Generating static pages (6/26) 
docs/verification/pr92-integrated-evaluation-v2-result.md:141: trailing whitespace.
+   Generating static pages (12/26) 
docs/verification/pr92-integrated-evaluation-v2-result.md:142: trailing whitespace.
+   Generating static pages (19/26) 
```
