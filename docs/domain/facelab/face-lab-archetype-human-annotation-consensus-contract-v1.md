# Face Lab Archetype Human Annotation / Consensus Dataset Contract v1

## 0. 상태

| 항목 | 값 |
| --- | --- |
| 단계 | `FACE-EVAL-B` |
| 계약 버전 | `1.0.0` |
| 구현 경계 | `@bejewely/face-contracts` pure validator |
| 실제 Human dataset | 없음 |
| Production 연결 | 금지 |
| Archetype calibration | `not_ready` 유지 |
| Weight / threshold 변경 | 없음 |
| Provider call | 없음 |

이 문서는 Human annotation을 수집하거나 Archetype을 production에 활성화하지 않는다. 실제 평가 데이터를 향후 어떤 identity, blind state, label, consensus, split, privacy, integrity 규칙으로 보존할지를 고정한다.

현재 구현은 다음 additive schema를 제공한다.

- `face-lab-archetype-review-item-v1`
- `face-lab-archetype-review-session-v1`
- `face-lab-archetype-human-annotation-v1`
- `face-lab-archetype-annotation-set-v1`
- `face-lab-archetype-consensus-v1`
- `face-lab-archetype-adjudication-v1`
- `face-lab-archetype-dataset-manifest-v1`

## 1. 목적

이 계약의 목적은 다음 질문에 답하는 것이다.

> 실제 Human Archetype evaluation data를 어떤 JSON contract, reviewer/session provenance, blind state, label/evidence representation, consensus artifact, subject grouping, split identity, integrity/privacy 규칙으로 저장하고 검증할 것인가?

계약은 구조와 불변식을 정의한다. reviewer 수, consensus algorithm, numerical threshold, sample size 또는 calibration 결과는 정하지 않는다.

## 2. Authority Boundary

다음 authority는 서로 다르다.

```text
Generation intent
!= Observed visual fact
!= Engine ranking
!= Individual Human annotation
!= Human consensus
!= Dataset promotion
!= Production activation
```

추가 불변식:

- reviewer disagreement는 bad data가 아니다.
- `uncertain`은 negative label이 아니다.
- `not_assessable`은 `uncertain`과 다르다.
- top-1은 complete Human truth가 아니다.
- adjudication은 historical annotation overwrite가 아니다.
- consensus는 forced unanimity가 아니다.
- synthetic label은 Real Human consensus가 아니다.

## 3. Relationship to FACE-EVAL-A

FACE-EVAL-A는 근거 class를 다음처럼 분리한다.

1. Technical Fixture
2. Controlled Synthetic Evidence
3. Human-Annotated Real Development Evidence
4. Real Validation Evidence
5. Locked Real Holdout

FACE-EVAL-B는 이 중 Real Human annotation과 consensus를 표현하는 저장 계약이다. Technical/Synthetic evidence의 정상 동작이 Real Human truth를 대신하지 않는다. Development, Validation, Locked Holdout은 같은 dataset 안에서도 보호된 별도 split이다.

FACE-EVAL-A의 현재 미결정값을 그대로 유지한다.

- reviewer count: `TBD`
- consensus algorithm: `not-yet-determined`
- consensus transition threshold: `TBD`
- confidence calibration method: `TBD`
- sample and holdout size: `TBD`
- adjudication trigger: `TBD`

## 4. Evaluation Identity Model

평가 단위는 다음 identity를 분리한다.

| Identity | 역할 |
| --- | --- |
| `subjectId` | 실제 한 사람의 opaque identity |
| `subjectGroupId` | 같은 subject에 속하는 capture 묶음 |
| `leakageGroupId` | exact/near-duplicate, derivative, burst, crop family 묶음 |
| `imageId` | 개별 image identity |
| `reviewItemId` | reviewer에게 발행되는 평가 단위 |
| `datasetId` / `datasetVersion` | dataset lineage와 immutable version |
| `splitId` / `splitRole` | protected evaluation split |
| `taxonomyVersion` | 평가 대상 Archetype key 집합 |
| `registryVersion` | scorer rubric snapshot |
| `observationSchemaVersion` | 구조 관찰 계약 |
| `reviewerId` | pseudonymous reviewer token |
| `reviewSessionId` | 한 reviewer의 blind review session |
| `annotationId` | 제출된 개별 Human annotation |

같은 subject의 여러 image를 독립 subject처럼 계산하지 않는다. `subjectId`, `subjectGroupId`, `leakageGroupId` 중 하나라도 같은 family를 나타내면 protected split 사이에 나눌 수 없다.

## 5. Review Item Contract

`face-lab-archetype-review-item-v1`은 다음을 결합한다.

- dataset / split identity
- subject, subject group, leakage group, image identity
- `human_annotated_real` evidence class
- taxonomy / registry / observation schema version
- evaluation consent, retention policy, withdrawal state
- raw path가 아닌 opaque asset reference
- creation time와 digest

`opaqueAssetRef`는 `asset_<opaque token>` 형태만 허용한다. Windows path, absolute/relative path, URL, base64, Provider payload 또는 정상 Face Lab saved report reference를 허용하지 않는다.

Review item validator는 historical/tombstone 표현을 위해 모든 withdrawal state를 읽을 수 있다. 다만 annotation binding은 `withdrawalState = active`만 허용하므로 철회된 subject를 새 review session과 annotation에 결합할 수 없다.

## 6. Reviewer / Session Contract

`face-lab-archetype-review-session-v1`은 다음을 가진다.

- pseudonymous `reviewerId`
- reviewer policy version
- annotation contract version
- dataset / split / taxonomy / registry binding
- 발행된 review item id/digest 목록
- explicit blind state
- `issued | sealed` session state
- issued/sealed time와 session digest

`reviewerId`는 `reviewer_...` opaque token이다. 실명, 이메일, 전화번호를 요구하거나 저장하지 않는다. Reviewer cohort가 필요하면 개인정보와 분리된 별도 versioned policy metadata로 관리하며 이 v1 normal artifact에 넣지 않는다.

Review item list는 id와 digest가 모두 고유해야 한다.

## 7. Blind-State Contract

Blind state는 암묵적으로 추정하지 않는다. v1 Human session은 다음 값이 모두 `true`여야 한다.

```json
{
  "generationTargetHidden": true,
  "syntheticPromptHidden": true,
  "engineOutputHidden": true,
  "peerAnnotationsHidden": true,
  "consensusHidden": true
}
```

따라서 reviewer에게 generation target, synthetic prompt, engine top candidate/ranking/score/margin/hold, 이전 reviewer 답, consensus를 노출한 session은 이 계약의 blind evidence가 아니다.

## 8. Assessability

각 annotation은 label 전에 assessability를 기록한다.

- `assessable`
- `uncertain_assessability`
- `not_assessable`

`uncertain_assessability`와 `not_assessable`은 reason code를 최소 하나 가져야 한다.

허용 reason code:

- `face_not_reviewable`
- `pose_blocks_structure`
- `crop_blocks_structure`
- `occlusion`
- `image_quality`
- `heavy_edit_or_filter_possible`
- `insufficient_visible_evidence`
- `archetype_boundary_ambiguous`
- `other_contract_defined_reason`

`not_assessable`이면 top-1 또는 후보를 강제할 수 없다. `uncertain_assessability`는 `uncertain` label state와 결합한다.

## 9. Human Archetype Annotation

현재 taxonomy hypothesis는 다음 key에 version binding된다.

```text
wolf
cat
puppy
deer
tofu
potato
dino
```

이 목록은 validated production truth가 아니다.

`face-lab-archetype-human-annotation-v1`의 label state:

- `ranked`: top-1이 있고 optional ordered alternatives를 보존
- `ambiguous`: top-1 없이 두 개 이상의 close candidate를 보존
- `uncertain`: 평가 가능한 truth label을 만들지 못함
- `not_assessable`: image 자체가 구조 평가에 부적합

Annotation은 review session, review item, reviewer, taxonomy, registry, evidence-tag registry에 결합된다. 제출 후 `sealed`이며 amendment는 새 annotation의 `supersedesAnnotationDigest`로 표현한다. 원본 annotation을 덮어쓰지 않는다.

## 10. Ranking / Alternatives

`rankedAlternatives` 배열 순서는 preference order다. Numeric distance나 score가 아니다.

불변식:

- taxonomy 밖 key 금지
- duplicate key 금지
- top-1을 alternatives에 다시 넣는 것 금지
- top-1 없는 `ranked` 금지
- alternatives 개수에 calibration 의미의 임의 상한/필수 숫자를 두지 않음

`cat > wolf > deer`는 `top1 = cat`, `rankedAlternatives = [wolf, deer]`로 보존한다.

## 11. Ambiguity

`ambiguous`는 forced top-1을 만들지 않는다.

```json
{
  "state": "ambiguous",
  "top1": null,
  "rankedAlternatives": ["cat", "wolf"],
  "ambiguityCandidates": ["wolf", "cat"],
  "confidence": "low"
}
```

`ambiguityCandidates`는 close candidate set이며, `rankedAlternatives`는 reviewer가 순서를 줄 수 있을 때 그 order를 보존한다. 두 배열은 같은 unique candidate set을 가져야 한다. 후보가 두 개 이상이어야 한다는 조건은 consensus threshold가 아니라 `ambiguity`라는 구조의 최소 의미 조건이다.

## 12. Confidence

v1 confidence는 categorical 값이다.

- `low`
- `medium`
- `high`
- `not_applicable`

근거 없는 0~100 점수를 만들지 않는다. Confidence는 beauty, personality, health 또는 diagnostic certainty가 아니라 현재 visual Archetype annotation 판단의 확신도다.

`uncertain`은 `low`, `not_assessable`은 `not_applicable`을 사용한다. 실제 calibration method는 후속 policy에서 정한다.

## 13. Visible Evidence Tags

Evidence tag registry는 `face-lab-archetype-human-evidence-tags-v1`이다.

허용 tag:

- `outline.overall_shape`
- `outline.jaw_structure`
- `vertical.face_length_balance`
- `eyes.direction`
- `eyes.length`
- `eyes.openness`
- `feature_layout.scale`
- `feature_layout.concentration`
- `visual_language.line_balance`
- `visual_language.contour_definition`
- `visual_language.feature_contrast`

Tag는 Human이 본 visible reason axis다. Engine contribution ledger 또는 archetype별 expected value를 복사하지 않는다. Personality, physiognomy, health, ethnicity, beauty score, celebrity similarity를 허용하지 않는다.

v1은 free-text note를 제외한다. Consensus authority가 free-text parsing에 의존하거나 PII가 유입되는 것을 막기 위함이다. 후속 contract에서 note가 필요하면 구조적 tag와 분리하고 privacy policy를 먼저 정의해야 한다.

## 14. Annotation Immutability

Submitted annotation은 다음에 결합된다.

- `annotationId`
- `annotationContractVersion`
- session / review item id와 digest
- reviewer identity
- taxonomy / registry version
- submitted time
- `annotationDigest`

Engine 결과를 본 뒤 historical annotation을 수정하지 않는다. Correction은 새 annotation을 만들고 `supersedesAnnotationDigest`로 predecessor를 가리킨다. Annotation set은 동일 reviewer의 historical annotation과 superseding annotation을 동시에 independent evidence로 계산할 수 없다.

## 15. Annotation Set

`face-lab-archetype-annotation-set-v1`은 하나의 review item에 대한 sealed independent annotation reference 집합이다.

각 source reference:

```json
{
  "annotationId": "flann_<opaque>",
  "annotationDigest": "<sha256>",
  "reviewerId": "reviewer_<opaque>"
}
```

Annotation id, digest, reviewer id는 각각 고유해야 한다. Reviewer 수 minimum은 이 계약에서 정하지 않는다. `independentReviewConfirmed = true`는 reviewer들이 blind session에서 서로의 답을 보지 않았음을 나타낸다.

Binding validator는 source annotation의 review item, taxonomy, contract version, seal state와 reference digest를 다시 확인한다.

## 16. Consensus Contract

`face-lab-archetype-consensus-v1`은 sealed annotation set만 입력으로 사용한다. Engine output과 generation intent는 입력 requirement가 아니다.

필수 output:

- source annotation set과 annotation refs
- assessable annotation count
- ranked / ambiguous / uncertain / not-assessable annotation state counts
- top-1 distribution
- ranked alternative appearance distribution
- ambiguity state/candidates
- confidence distribution
- evidence-tag agreement counts
- disagreement state
- consensus state와 optional consensus label
- algorithm id/version/policy status
- provenance time와 digest

`consensusAlgorithm.policyStatus`는 `specified | not_yet_determined`다. Contract가 algorithm version을 추적할 수 있게 하지만, v1 문서는 majority vote를 production truth algorithm으로 정하지 않는다.

`clear_consensus`만 non-null `consensusLabel`을 허용한다. 다른 state는 label을 강제하지 않는다.

## 17. Consensus States

허용 state:

- `clear_consensus`
- `ambiguous_consensus`
- `insufficient_annotations`
- `not_assessable`
- `disagreement_high`

Exact state transition threshold는 policy-controlled이며 아직 미결정이다. `ambiguous_consensus`는 candidate set을 보존하고 top-1을 만들지 않는다. `not_assessable`은 assessable annotation count가 0이어야 한다.

Distribution count와 denominator는 음수가 될 수 없다. top-1 count 합은 assessable annotation count를 초과할 수 없다. Ambiguous/uncertain annotation 때문에 합이 denominator보다 작을 수 있으며, 그 차이를 임의 label로 채우지 않는다.

## 18. Adjudication Boundary

`face-lab-archetype-adjudication-v1`은 optional append-only artifact다.

원칙:

- raw annotation과 consensus 보존
- adjudicator는 pseudonymous provenance 사용
- adjudication policy version과 reason code 기록
- `engineOutputUsed = false`
- engine 결과에 맞추기 위한 adjudication 금지
- resolution이 필요하면 `superseding_resolution`과 새 label을 기록
- ambiguity를 유지할 수 있음

Adjudication trigger 숫자와 required adjudicator count는 아직 정하지 않는다.

## 19. Subject / Dataset Manifest

`face-lab-archetype-dataset-manifest-v1`은 Real Human evaluation dataset의 identity와 protected split을 보존한다.

최소 field:

- dataset id/version
- `evidenceClass = human_annotated_real`
- taxonomy / registry version
- annotation / consensus contract version
- consent / retention policy version
- split id/role/version/digest
- subject, subject group, leakage group, image, review item
- annotation set, optional consensus artifact
- consent record reference
- withdrawal state와 inclusion state
- manifest digest

Synthetic evidence를 Real split role에 넣지 않는다. Synthetic stress evidence는 별도 toolkit과 evidence class에서 관리한다.

## 20. Split / Leakage Rules

Split role:

- `development`
- `validation`
- `locked_holdout`

Manifest validator는 다음 identity가 서로 다른 protected split role에 나타나면 fail-closed한다.

- `subjectId`
- `subjectGroupId`
- `leakageGroupId`

따라서 같은 사람의 여러 capture, near duplicate, derivative, burst, crop family를 split 사이에 나눌 수 없다. `reviewItemId`도 dataset manifest 전체에서 고유해야 한다.

Locked holdout은 weight/threshold 탐색에 사용하지 않는다. Split 비율과 holdout 크기는 이번 계약에서 정하지 않는다.

## 21. Consent / Privacy / Withdrawal

Service-use consent와 evaluation-data consent를 동일하게 취급하지 않는다. Review item은 다음 opaque provenance를 요구한다.

- `consentRecordId`
- `consentPolicyVersion`
- `retentionPolicyVersion`
- `withdrawalState`

Withdrawal state:

- `active`
- `withdrawal_requested`
- `withdrawn`
- `tombstoned`

Dataset manifest에서 `included = true`는 `active`와 정확히 일치해야 한다. 철회/삭제 과정의 subject를 active calibration set에 조용히 남길 수 없다. 실제 consent UI, identity store, deletion worker, tombstone storage는 별도 privacy/storage 계약의 범위다.

Normal artifact에 reviewer 실명, 이메일, 전화번호, raw image, base64, Provider response 또는 public/local raw path를 저장하지 않는다.

## 22. Digest / Integrity

각 artifact는 자신의 semantic field 전체에 대한 digest를 가진다.

| Artifact | Digest |
| --- | --- |
| Review item | `reviewItemDigest` |
| Session | `sessionDigest` |
| Annotation | `annotationDigest` |
| Annotation set | `annotationSetDigest` |
| Consensus | `consensusDigest` |
| Adjudication | `adjudicationDigest` |
| Dataset manifest | `datasetManifestDigest` |
| Split | `splitDigest` |

Canonical payload는 digest field 하나만 제외한 JSON object를 key-sorted canonical JSON으로 직렬화한 값이다. SHA-256 계산은 runtime/tooling이 수행하고, shared contract는 canonical payload와 supplied SHA-256 함수로 digest를 검증한다. 이 방식은 `@bejewely/face-contracts`에 Node-only crypto나 I/O를 넣지 않는다.

Shape validation과 digest validation은 모두 필요하다. Binding validator는 review item → annotation set → consensus → dataset entry와 optional adjudication의 id/digest chain을 재검증한다. Digest 하나가 유효해도 foreign review item, session, annotation set 또는 taxonomy binding을 정당화하지 않는다.

## 23. Validation Invariants

Validator는 exact-key 방식으로 unknown field를 거부한다.

Fail-closed 항목:

- taxonomy 밖 archetype
- duplicate rank/ambiguity candidate
- top-1과 alternative 중복
- `not_assessable`인데 label 존재
- `ambiguous`인데 forced top-1 또는 candidate set 불일치
- blind state false/missing
- raw/public path 또는 base64-like asset field
- inactive consent로 새 review item 발행
- missing/malformed digest
- mismatched review item/session/taxonomy/registry identity
- duplicate annotation id/digest/reviewer
- unsealed annotation을 annotation set input으로 사용
- consensus source binding mismatch
- clear consensus 외 forced label
- same subject/group/leakage family의 cross-split 배치
- withdrawn item을 included 상태로 유지
- engine output을 사용한 adjudication

## 24. Synthetic Toolkit Relationship

Synthetic toolkit에서 재사용한 것은 다음 principle뿐이다.

- explicit version과 exact-key schema
- immutable digest
- blind state
- sealed artifact
- provenance/binding
- fail-closed validation
- uncertainty preservation
- diagnostic flag와 causal proof의 분리

다음은 재사용하지 않는다.

- skin-cue field
- `requiredOperatorCount = 1`
- synthetic generation target authority
- G-grade/promotion authority
- Solo operator decision schema

Archetype Human evaluation contract는 `synthetic-solo-assessment`에 의존하지 않는다.

## 25. Production Separation

구현은 `packages/face-contracts/src/archetype-human-evaluation/`의 pure constants/validators뿐이다.

연결하지 않는 영역:

- `app/`, `components/`
- production Face Lab API
- `lib/server/`
- DB/Supabase/migration
- production storage
- user-facing UI
- Provider
- canonical result/archetype promotion
- scorer weights/thresholds
- registry lifecycle

따라서 현재 production state는 그대로다.

```text
lifecycle = rubric_ready
calibrationStatus = not_ready
productionEligible = false
status = held
decision = null
thresholds = null
```

## 26. Explicit Non-Goals

- 실제 사람 사진 수집
- reviewer 모집 또는 annotation 실행
- consensus 산출
- calibration/metric 실행
- taxonomy 확정/merge/split
- weight 또는 threshold 변경
- production activation
- actual dataset/storage 구축
- consent UI나 deletion worker 구현
- sample/reviewer/holdout 수 결정
- majority vote 또는 adjudication threshold 확정
- raw image를 normal Face Lab report에 저장

## 27. Open Decisions

후속 gate에서 결정할 항목:

- reviewer 수와 independence policy
- consensus algorithm id/version과 numerical transition rule
- confidence calibration method
- ranked-list comparison metric
- evidence-tag agreement metric
- adjudication trigger와 reviewer role separation
- development/validation/holdout sample size와 split ratio
- consent/retention/withdrawal runtime
- protected asset store와 access audit
- dataset amendment/tombstone propagation procedure
- metric별 exact denominator 및 production activation threshold

미결정값은 `TBD`, `policy-controlled`, `not-yet-determined`, `calibration-required`로 유지한다.

## 28. Next Gate

```text
FACE-EVAL-B
Human Annotation / Consensus Dataset Contract v1
  |
  +--> FACE-EVAL-C
  |    Synthetic Archetype Stress Campaign
  |
  +--> Real Human calibration dataset preparation
       consent / reviewer policy / storage / annotation operations
          |
          +--> FACE-ENGINE-2
               Weight + Threshold Calibration
```

FACE-EVAL-B 완료는 contract 준비 완료일 뿐이다. Calibration complete 또는 production activation으로 해석하지 않는다.

## Appendix A. Illustrative review item

아래 example은 synthetic identifier만 사용한 설명용 shape다. 실제 dataset artifact가 아니다.

```json
{
  "schemaVersion": "face-lab-archetype-review-item-v1",
  "reviewItemId": "flri_0123456789abcdef01234567",
  "datasetId": "face-lab-real-eval",
  "datasetVersion": "v1",
  "splitId": "development-v1",
  "splitRole": "development",
  "evidenceClass": "human_annotated_real",
  "subjectId": "flsub_0123456789abcdef01234567",
  "subjectGroupId": "flgrp_0123456789abcdef01234567",
  "leakageGroupId": "flgrp_89abcdef0123456789abcdef",
  "imageId": "flimg_0123456789abcdef01234567",
  "opaqueAssetRef": "asset_0123456789abcdef0123456789abcdef",
  "taxonomyVersion": "face-lab-archetype-taxonomy-v1",
  "registryVersion": "face-lab-archetype-rubric-20260727",
  "observationSchemaVersion": "face-lab-observation-v1",
  "consentAuthority": {
    "consentRecordId": "consent_0123456789abcdef0123456789abcdef",
    "consentPolicyVersion": "evaluation-consent-v1",
    "retentionPolicyVersion": "evaluation-retention-v1",
    "withdrawalState": "active"
  },
  "createdAt": "2026-08-13T00:00:00.000Z",
  "reviewItemDigest": "<sha256>"
}
```

## Appendix B. Illustrative ambiguity annotation

```json
{
  "assessability": {
    "state": "assessable",
    "reasonCodes": []
  },
  "label": {
    "state": "ambiguous",
    "top1": null,
    "rankedAlternatives": ["cat", "wolf"],
    "ambiguityCandidates": ["wolf", "cat"],
    "confidence": "low"
  },
  "evidenceTags": [
    "eyes.direction",
    "feature_layout.concentration"
  ]
}
```

이 예시는 full exact-key artifact가 아니라 annotation 핵심 부분만 보여 준다. Engine score, generation target, raw path, 개인정보는 포함하지 않는다.
