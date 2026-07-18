# Bejewely 통합 Vision Observation 파이프라인 설계 — 2026-07-19

## 0. 문서 상태

- 상태: 설계 완료 / 구현 전
- 기준 커밋: `88303dfc3a90f92b5ab57c74d1d05bf85fbd9a60`
- 기준 브랜치: `codex/survey-input-contract-refactor`
- 설계 브랜치: `design/unified-vision-observation-pipeline`
- 범위: 운영 사용자 흐름에서 동일 사진이 `/api/analyze`와 `/api/face-reading`으로 각각 전송되어 Vision 분석이 두 번 수행되는 구조를 단일 이미지 관찰 파이프라인으로 개편한다.
- 비범위: 제품 추천 점수 정책, 상품 DB 스키마, 결제, 인증 정책, RLS, Saved Report 소유권, Premium Decision Bundle의 정책 의미 변경

---

## 1. 확인된 현재 구조

온보딩 클라이언트는 한 번의 제출에서 동일한 `imageFile`을 다음 두 경로로 보낸다.

```text
imageFile
├─ POST /api/analyze
└─ POST /api/face-reading
```

### 1.1 `/api/analyze`

1. 사진을 data URL로 변환한다.
2. `extractPhotoAnalysis()`가 이미지 포함 OpenAI 요청을 수행한다.
3. 피부 관찰값을 `photoAnalysis`로 정규화한다.
4. 결정 엔진이 제품과 루틴을 결정한다.
5. `generateProductExplanations()`가 이미지 없는 텍스트 요청으로 설명문을 생성한다.

### 1.2 `/api/face-reading`

1. 동일 사진을 다시 data URL로 변환한다.
2. 이미지 적합성, 얼굴 구조 관찰, Face Lab 표현문을 한 프롬프트에서 생성한다.
3. locale에 따라 `base_data`와 `features`의 언어가 달라진다.
4. 별도의 analysis guard, idempotency key, rate-limit 창을 사용한다.

### 1.3 현재 문제

- 한 사용자 제출이 이미지 포함 provider 호출 2회를 발생시킨다.
- 이미지 인코딩과 업로드 토큰을 중복 소비한다.
- 두 Vision 호출이 서로 다른 적합성·화질·가림 판단을 낼 수 있다.
- Skin Match와 Face Lab이 동일 사진에 대해 상충하는 관찰값을 가질 수 있다.
- Face Lab의 관찰과 locale별 표현문이 결합되어 언어 전환 시 재분석이 필요하다.
- 사용자의 한 행동이 두 개의 analysis guard 요청으로 집계된다.
- 클라이언트가 두 요청의 부분 실패와 완료 시점을 조정해야 한다.

---

## 2. 설계 목표

### 2.1 필수 목표

1. 한 사용자 제출에서 이미지 포함 provider 요청을 정확히 1회 수행한다.
2. Skin Match와 Face Lab이 동일한 정규화 관찰 번들을 사용한다.
3. 이미지 관찰은 locale과 설문 응답에서 분리한다.
4. 제품 선택 권한은 기존 결정 엔진에 유지한다.
5. 한국어·영어 표현 생성은 이미지 재전송 없이 수행한다.
6. 피부 분석과 Face Lab의 부분 성공·부분 실패를 독립적으로 표현한다.
7. 기존 `/api/analyze` 공개 응답과 Face Lab envelope를 점진적으로 호환한다.
8. 원본 이미지, data URL, raw provider 응답을 저장하지 않는다.

### 2.2 비목표

- 이미지 한 장에서 추천 제품까지 provider가 직접 결정하게 만들지 않는다.
- 모든 사용자용 설명문을 하나의 거대 provider 프롬프트에 합치지 않는다.
- 구현 첫 단계에서 DB 기반 얼굴 관찰 캐시를 추가하지 않는다.
- 기존 Saved Report와 Premium 보고서의 의미를 일괄 마이그레이션하지 않는다.

---

## 3. 최종 목표 구조

```text
Client
  │
  │ POST /api/analyze (image + survey + locale + currentProducts)
  ▼
Analysis Orchestrator
  │
  ├─ request guard / idempotency / upload validation
  ├─ image bytes read once
  ├─ provider image canonicalization once
  │
  ▼
Canonical Vision Observation Service
  │  image-bearing provider call: exactly 1
  ▼
VisionObservationBundle v1
  │
  ├─ Skin Observation Projector
  │    ├─ existing photoAnalysis shape
  │    └─ deterministic survey alignment
  │
  ├─ Face Lab Projector
  │    ├─ existing observation analysis shape
  │    ├─ deterministic structured Face Lab
  │    └─ optional text-only locale renderer
  │
  ├─ Skin Match Decision Engine
  │    └─ product selection remains deterministic
  │
  └─ Product Explanation Renderer
       └─ optional text-only provider call, no image

Unified /api/analyze response
  ├─ existing Skin Match result
  └─ faceLab envelope
```

핵심 원칙은 **이미지 관찰과 사용자용 표현을 분리하는 것**이다.

---

## 4. Canonical Vision Observation 계약

### 4.1 계약 이름

```text
VisionObservationBundle v1
schemaVersion = "vision-observation-v1"
promptVersion = "vision-observation-prompt-v1"
```

### 4.2 설계 원칙

- provider prompt에는 locale을 넣지 않는다.
- provider prompt에는 설문 답변을 넣지 않는다.
- provider는 보이는 사실만 반환한다.
- 모든 값은 고정 enum, 제한된 정수 범위, 제한된 배열 길이를 사용한다.
- 사용자용 문장, 제품 추천, 성격 해석, 유명인 식별을 생성하지 않는다.
- 기존 `image-analysis-eligibility`와 `face-lab-observation-contract`를 재사용하되 단일 루트 계약으로 묶는다.

### 4.3 제안 스키마

```json
{
  "schemaVersion": "vision-observation-v1",
  "eligibility": {
    "status": "eligible",
    "source": "vision",
    "imageType": "photorealistic_human",
    "humanFaceCount": 1,
    "faceLabEligible": true,
    "skinAnalysisEligible": true,
    "faceLabFailureReason": null,
    "skinFailureReason": null,
    "confidence": 0.95,
    "evidence": ["single frontal human face visible"]
  },
  "quality": {
    "faceVisibility": "clear",
    "faceScale": "adequate",
    "pose": {
      "yaw": "frontal",
      "pitch": "level",
      "roll": "level"
    },
    "occlusion": {
      "forehead": "none",
      "brows": "none",
      "eyes": "none",
      "cheeks": "none",
      "jawline": "none"
    },
    "sharpness": "clear",
    "exposure": "balanced",
    "lightingUniformity": "even",
    "whiteBalance": "stable",
    "filterOrEditing": "none_detected",
    "makeupCoverage": "none_or_light",
    "structureSuitability": "suitable",
    "colorSuitability": "suitable",
    "evidence": ["facial outline and skin surface are visible"]
  },
  "skin": {
    "signals": {
      "barrier": 0,
      "dehydration": 0,
      "oiliness": 0,
      "redness": 0,
      "acne": 0,
      "pores": 0,
      "uneven_tone": 0,
      "uv": 0
    },
    "observations": [
      {
        "key": "oiliness",
        "area": "t_zone",
        "confidence": "medium",
        "cue": "surface_shine",
        "level": "moderate"
      }
    ]
  },
  "face": {
    "observations": {
      "outline": {},
      "vertical": {},
      "eyes": {},
      "featureLayout": {},
      "visualLanguage": {},
      "colorAppearance": {}
    }
  }
}
```

### 4.4 evidence 처리

기존 계약과의 호환을 위해 v1에서는 eligibility와 quality에 짧은 영어 evidence 문자열을 허용한다. 다만 이 문자열은 다음 용도로만 사용한다.

- 정규화 유효성 검증
- 내부 진단
- Face Lab structured field의 provenance

사용자 화면에는 직접 노출하지 않는다. Skin observation은 가능한 한 `area`, `cue`, `level`, `confidence` enum으로 구성하여 locale 의존성을 제거한다.

---

## 5. 서버 모듈 경계

### 5.1 신규 모듈

```text
lib/vision-observation-contract.js
lib/vision-observation-normalizer.js
lib/server/vision-observation-service.js
lib/skin-observation-projector.js
lib/face-lab-observation-projector.js
lib/face-lab-presentation-policy.js
lib/analysis-orchestrator.js
```

### 5.2 책임

#### `vision-observation-contract.js`

- provider JSON shape
- enum 목록
- prompt rules
- schema/prompt version 상수

#### `vision-observation-normalizer.js`

- provider 응답을 fail-closed로 정규화
- 기존 `normalizeImageAnalysisEligibility()` 재사용
- 기존 `normalizeFaceImageQuality()`와 `normalizeFaceObservationBundle()` 재사용
- 피부 signal 0~5 범위 제한
- 허용되지 않은 key 제거
- raw response 미보존

#### `server/vision-observation-service.js`

- canonicalized image bytes를 입력받는다.
- 이미지 포함 provider 요청을 단 한 곳에서 수행한다.
- timeout, response-size cap, model, token cap, provider logging을 소유한다.
- provider payload에 locale, survey, products를 넣지 않는다.
- 결과로 normalized `VisionObservationBundle v1`만 반환한다.

#### `skin-observation-projector.js`

- canonical skin observation을 기존 `photoAnalysis` shape로 투영한다.
- label, description, summary를 locale map 또는 deterministic template으로 생성한다.
- `surveyAlignment`는 Vision이 아니라 서버 결정 함수가 계산한다.
- skin 분석 불가 시 기존 fallback shape를 반환한다.

#### `face-lab-observation-projector.js`

- canonical face observations에서 기존 `FaceLabObservationAnalysis`를 구성한다.
- 기존 Face Lab envelope의 `analysis` 필드를 유지한다.
- face 분석 불가 시 failure reason을 그대로 전달한다.

#### `face-lab-presentation-policy.js`

- 얼굴형, 구조 키워드, 색상 방향, 헤어 방향을 canonical enum에서 deterministic하게 계산한다.
- 사용자용 KO/EN 문장을 locale별 template으로 렌더링한다.
- 성격·운세·매력도·유명인 식별을 생성하지 않는다.
- 기존 `buildFaceLabLaunchData()`가 요구하는 shape로 adapter를 제공한다.

#### `analysis-orchestrator.js`

- upload validation
- image canonicalization
- canonical Vision 호출
- Skin projection
- Skin Match 결정 엔진
- Face Lab projection
- optional text renderers
- partial failure 조립
- 공개 응답 생성

---

## 6. 단일 public route

### 6.1 `/api/analyze`를 orchestration authority로 유지

새 공개 엔드포인트를 추가하기보다 기존 `/api/analyze`를 통합 진입점으로 유지한다.

이유:

- 현재 온보딩, 익명 저장 grant, Premium report session이 이미 `/api/analyze` 응답에 결합되어 있다.
- 새 mutation route를 추가하면 인증·rate limit·idempotency·저장 계약을 다시 이중화하게 된다.
- 기존 결과 페이지는 `/api/analyze` payload를 중심으로 동작한다.

### 6.2 응답 확장

기존 필드를 제거하지 않고 다음 필드를 추가한다.

```json
{
  "summary": "...",
  "topPick": {},
  "morning": [],
  "night": [],
  "faceLab": {
    "status": "available",
    "source": "vision",
    "failureReason": null,
    "analyzedAt": "...",
    "eligibility": {},
    "data": {
      "base_data": {},
      "features": {},
      "structured": {},
      "analysis": {}
    }
  },
  "meta": {
    "visionObservationSchemaVersion": "vision-observation-v1",
    "imageProviderCallCount": 1
  }
}
```

`meta.imageProviderCallCount`는 개발·검증 환경에서만 노출하거나 서버 로그 전용으로 제한할 수 있다.

### 6.3 클라이언트 변경

제거 대상:

```text
requestFaceLabResult()
faceLabPromise
faceLabIdempotencyKey
POST /api/face-reading 병렬 호출
```

변경 후:

```text
POST /api/analyze 1회
→ data.faceLab 사용
```

사용자 제출당 idempotency key도 하나만 생성한다.

---

## 7. `/api/face-reading` 호환 정책

### 7.1 즉시 삭제하지 않는다

다음 사용처 때문에 호환 route를 유지한다.

- Hosted Evaluation
- 독립 Face Lab 호출 가능성
- 기존 테스트·도구

### 7.2 구현 방식

- route 내부의 직접 OpenAI 호출을 제거한다.
- `vision-observation-service`를 호출한다.
- canonical observation에서 Face Lab projection만 반환한다.
- 이 route가 호출되면 이미지 provider 호출 1회는 발생하지만, 운영 온보딩은 더 이상 이 route를 호출하지 않는다.

### 7.3 장기 방향

Hosted Evaluation은 최종적으로 `/api/face-reading`의 localized `base_data/features`보다 `VisionObservationBundle`의 canonical face section을 평가하도록 전환한다.

---

## 8. 표현 생성 전략

### 8.1 초기 구현 권고: deterministic core + optional text enhancer

Face Lab 전체를 이미지 provider가 직접 서술하게 하지 않는다.

```text
canonical observations
→ deterministic Face Lab core
→ optional text-only locale enhancer
→ validation
→ deterministic fallback
```

### 8.2 초기 단계에서 텍스트 호출을 합치지 않는 이유

다음 두 표현 도메인은 독립 실패가 가능해야 한다.

- 제품 설명
- Face Lab 스타일 설명

둘을 하나의 거대한 JSON 응답으로 합치면 한쪽 schema 오류가 다른 쪽까지 무효화한다. 따라서 첫 개편에서는 다음을 허용한다.

```text
1 image-bearing call
+ 0~1 product explanation text call
+ 0~1 Face Lab text enhancer call
```

단, Face Lab text enhancer는 필수가 아니다. deterministic renderer가 기준 결과를 항상 제공해야 한다.

### 8.3 후속 최적화 조건

다음 지표가 확보된 뒤에만 text renderer 통합을 검토한다.

- 각 renderer의 실패율
- 평균 prompt/completion tokens
- deterministic fallback 사용률
- schema invalid 비율
- 사용자 품질 평가

---

## 9. Survey alignment 분리

현재 피부 Vision prompt는 설문 context를 받아 `surveyAlignment`를 함께 생성한다. 통합 구조에서는 이를 금지한다.

### 이유

- 같은 사진이 설문 답변에 따라 다른 관찰값을 생성할 수 있다.
- canonical observation의 재사용성이 사라진다.
- locale 또는 설문 변경 시 재분석이 필요해진다.

### 변경

```text
Vision: 사진에서 보이는 신호만 반환
Server: skin signals와 survey context를 비교해 alignment 계산
```

제안 함수:

```text
buildSurveyPhotoAlignment({ skinObservation, surveyContract, locale })
```

결과 shape는 기존 `photoObservations.surveyAlignment`를 유지한다.

---

## 10. 부분 성공 계약

단일 provider 응답이라고 해서 Skin Match와 Face Lab을 all-or-nothing으로 처리하지 않는다.

| 상태 | Skin Match | Face Lab |
|---|---|---|
| skin=true, face=true | 사진 반영 | 사용 가능 |
| skin=true, face=false | 사진 반영 | photo_ineligible |
| skin=false, face=true | 설문 중심 fallback | 사용 가능 |
| skin=false, face=false | 설문 중심 fallback | unavailable |
| provider failure | 설문 중심 fallback | unavailable |
| Face Lab renderer failure | 영향 없음 | deterministic fallback |
| product explanation failure | deterministic explanation | 영향 없음 |

provider 실패가 전체 추천 실패로 이어지지 않도록 현재 Skin Match fallback 철학을 유지한다.

---

## 11. 보안·개인정보 경계

### 11.1 이미지

- 이미지 bytes는 요청 수명 동안만 메모리에 둔다.
- image canonicalization은 한 번만 수행한다.
- 원본·canonical image·data URL을 DB, 로그, report artifact에 저장하지 않는다.
- provider 요청 payload를 로그에 출력하지 않는다.

### 11.2 얼굴 파생 데이터

- raw provider JSON을 저장하지 않는다.
- normalize 이후 필요한 enum과 제한된 evidence만 사용한다.
- 공개 응답에는 기존 UI와 reentry에 필요한 projection만 넣는다.
- Premium 저장에는 기존 `faceLabSummary`와 현재 허용된 observation projection만 사용한다.
- 신규 DB 캐시는 별도 개인정보·보존기간 설계 없이 추가하지 않는다.

### 11.3 로그

허용:

```text
analysisRunId
stage
provider
model
status
durationMs
inputTokens
outputTokens
imageProviderCallCount
schemaVersion
failureCategory
```

금지:

```text
image bytes
data URL
raw provider body
free-form evidence 전체
authorization header
cookie
사용자 이메일
절대 파일 경로
```

---

## 12. Analysis Guard와 idempotency

### 12.1 운영 흐름

- 온보딩은 `analyze` policy만 소비한다.
- `face-reading` policy는 standalone compatibility route에만 남긴다.
- 한 제출에서 하나의 idempotency key를 사용한다.

### 12.2 fingerprint

기존 fingerprint는 upload의 name/type/size descriptor를 포함한다. 통합 구현에서는 provider 실행 전에 계산한 image SHA-256을 내부 execution fingerprint에 추가한다.

```text
providerExecutionFingerprint = HMAC(
  principal + imageSha256 + normalizedSurvey + currentProducts + schemaVersion
)
```

- raw SHA-256을 공개 로그에 쓰지 않는다.
- guard의 기존 principal/rate-limit 선점은 유지한다.
- idempotency row에 raw 이미지 또는 raw survey를 저장하지 않는다.

### 12.3 quota 재조정

기존 `analyze`와 `face-reading` limit을 단순 합산하지 않는다. 통합 호출의 실제 provider 비용과 이용 정책을 기준으로 별도 검토한다. 초기 구현에서는 `analyze` limit을 유지하고 운영 지표를 수집한 뒤 조정한다.

---

## 13. 버전·호환 계약

### 13.1 신규 버전

```text
visionObservationSchemaVersion = vision-observation-v1
visionObservationPromptVersion = vision-observation-prompt-v1
faceLabPresentationVersion = face-lab-presentation-v2
analyzeResponseSchemaVersion = 2
```

### 13.2 기존 저장 결과

- 기존 Saved Report는 현재 legacy adapter로 계속 읽는다.
- 신규 결과에만 `visionObservationSchemaVersion`을 기록한다.
- 기존 결과를 새 canonical observation으로 가장하지 않는다.
- 재진입 시 저장된 localized presentation을 우선한다.
- 저장된 canonical observation이 없는 legacy 결과에서 locale 변경을 요구하면 legacy 표시만 제공하고 재분석했다고 주장하지 않는다.

---

## 14. 구현 단계

### Phase 0 — 계약과 pure verifier

- `VisionObservationBundle v1` 계약 작성
- normalizer 작성
- skin/face projector pure test
- locale invariance test
- eligibility matrix test
- provider prompt에 locale/survey/product가 없는지 static guard

완료 기준:

- provider fixture를 사용한 모든 pure test PASS
- 기존 image eligibility와 Face Lab observation contract 회귀 PASS

### Phase 1 — 공통 provider service

- 이미지 canonicalization boundary
- 단일 image-bearing provider execution site
- provider telemetry
- 기존 routes와 분리된 pure service 검증

완료 기준:

- 저장소에서 canonical service 외 이미지 포함 OpenAI request site가 허용 목록 밖에 없음
- request당 provider image call count 1

### Phase 2 — `/api/analyze` 통합

- Skin projection 연결
- Face Lab projection 연결
- 응답에 `faceLab` 추가
- partial failure contract 적용
- Premium summary projection 연결

완료 기준:

- `/api/analyze` 단독 호출로 기존 Skin Match와 Face Lab UI 데이터 생성
- 이미지 provider 실패 시 설문 fallback 유지

### Phase 3 — 클라이언트 단일 요청 전환

- 병렬 `/api/face-reading` 호출 제거
- idempotency key 하나로 축소
- sessionStorage result shape 호환
- 결과 페이지 회귀

완료 기준:

- 브라우저 네트워크 로그에서 사용자 제출당 image upload mutation 1회
- 결과 페이지 KO/EN PASS

### Phase 4 — `/api/face-reading` compatibility adapter

- direct provider fetch 제거
- common service와 Face Lab projector 사용
- Hosted Evaluation의 canonical contract 전환

완료 기준:

- standalone route도 image-bearing provider call 1회
- evaluator가 locale별 재분석 없이 canonical face observations 평가

### Phase 5 — text renderer 최적화

- Face Lab optional text enhancer 품질 측정
- 필요 시 product/Face Lab text renderer 통합 검토
- token budget과 schema failure율 비교

---

## 15. 검증 계획

### 15.1 구조 검증

- 온보딩 source에 `/api/face-reading` fetch가 없음
- `/api/analyze`가 unified orchestrator를 사용함
- 이미지 포함 provider request site가 정확히 한 모듈에만 존재함
- provider prompt에 `locale`, survey JSON, products가 없음

### 15.2 계약 검증

- unknown key 제거
- 잘못된 enum fail-closed
- skin score 0~5 clamp
- face observation coverage 계산 회귀
- eligibility와 domain availability 일관성

### 15.3 결과 검증

- 같은 canonical bundle을 KO/EN projector에 넣었을 때 enum·score·eligibility 동일
- 사용자용 문장만 locale에 따라 변경
- 동일 입력 반복 시 deterministic core 동일
- Face Lab renderer 실패가 Skin Match에 영향을 주지 않음
- product explanation 실패가 Face Lab에 영향을 주지 않음

### 15.4 브라우저 검증

- 사진 1회 업로드
- `/api/analyze` 1회
- Face Lab tab 정상 표시
- Skin Match 결과 정상 표시
- 익명 저장 grant 정상
- Premium 진입·저장·재진입 정상

### 15.5 비용 검증

필수 telemetry:

```text
image_provider_requests_per_analysis = 1
input_image_tokens
vision_prompt_tokens
vision_completion_tokens
text_prompt_tokens
text_completion_tokens
provider_429_count
fallback_count_by_domain
```

비교 기준:

- 기존: 이미지 포함 2회
- 목표: 이미지 포함 1회
- 통과 조건: 동일 fixture 집합 기준 image provider request 50% 감소

---

## 16. Rollout과 rollback

### 16.1 feature flag

```text
UNIFIED_VISION_PIPELINE_ENABLED
```

- Preview에서 먼저 활성화한다.
- Production은 Hosted Preview와 비용 검증 후 활성화한다.
- flag off 시 기존 route를 유지할 수 있으나, 클라이언트가 다시 이중 호출하도록 자동 fallback하지 않는다.
- rollback은 서버 orchestration 구현을 이전 `/api/analyze` 경로로 되돌리는 명시적 배포로 수행한다.

### 16.2 dual-run 금지

Production에서 old Vision과 unified Vision을 동시에 호출해 shadow 비교하지 않는다. 비용과 개인정보 노출 면적이 다시 두 배가 되기 때문이다.

비교는 다음으로 제한한다.

- 비개인 synthetic fixture
- 승인된 local fixture
- Hosted Evaluation

---

## 17. 설계 리뷰 결과

### 17.1 검토 중 수정한 사항

#### A. 하나의 거대 provider 호출에서 관찰·추천·모든 문장을 생성하는 안을 폐기

문제:

- 제품 선택 authority가 LLM으로 이동할 위험
- schema가 지나치게 커짐
- Face Lab 문장 오류가 전체 Skin Match를 무효화
- locale별 재사용이 어려움

수정:

- provider는 canonical observation만 생성
- 제품 선택은 기존 결정 엔진 유지
- 표현은 domain projector/renderer에서 분리

#### B. 설문 context를 Vision prompt에 유지하는 안을 폐기

문제:

- 동일 사진이 설문에 따라 다른 관찰값을 생성
- canonical observation이 재사용 불가능
- survey alignment가 관찰과 섞임

수정:

- Vision은 사진 전용
- survey alignment는 deterministic post-processing

#### C. `/api/face-reading` 즉시 삭제 안을 폐기

문제:

- Hosted Evaluation과 기존 도구가 깨짐
- 독립 Face Lab 계약의 단계적 이전이 불가능

수정:

- compatibility adapter로 유지
- 운영 온보딩에서만 호출 제거

#### D. unified provider 실패를 전체 요청 실패로 처리하는 안을 폐기

문제:

- 현재 설문 기반 fallback보다 회복력이 낮아짐
- Face Lab 실패가 제품 추천을 막음

수정:

- domain별 부분 성공 계약 유지

#### E. canonical face observation을 즉시 DB 캐시하는 안을 폐기

문제:

- 얼굴 파생 데이터 보존 범위 확대
- 보존기간, 삭제, 접근권한 설계가 선행되지 않음

수정:

- 첫 구현은 request-lifetime in-memory 처리
- 기존 sanitized projection만 응답·저장

### 17.2 남은 중요 구현 리스크

1. **Prompt 크기와 schema 준수율**  
   Skin과 Face observation을 하나의 JSON에 넣으면 completion 크기가 커진다. 필드별 최대 길이, enum-only 계약, token cap을 검증해야 한다.

2. **Face Lab 표현 품질 변화**  
   현재는 provider가 localized narrative를 직접 생성한다. deterministic renderer로 전환하면 문장 품질이 달라질 수 있으므로 fixture 기반 비교가 필요하다.

3. **기존 formatter의 legacy 의존성**  
   `face-lab-launch.js`는 자유 텍스트와 legacy token을 많이 처리한다. canonical enum 전용 adapter를 새로 두고 기존 formatter를 직접 확장하지 않는 편이 안전하다.

4. **응답 크기**  
   Skin Match 결과와 Face Lab full payload를 한 응답에 합치면 response size가 증가한다. raw observation 전체를 공개하지 않고 필요한 projection만 포함해야 한다.

5. **guard fingerprint 정확도**  
   기존 upload descriptor는 content hash가 아니다. 통합 구현 시 내부 execution fingerprint에 image hash를 추가하되 rate-limit 선점과 개인정보 경계를 깨지 않아야 한다.

6. **독립 route와 통합 route의 코드 drift**  
   `/api/face-reading`이 common service를 우회하지 못하도록 architecture guard가 필요하다.

### 17.3 최종 판정

- Critical 설계 결함: 0
- Important 미해결 설계 결함: 0
- 구현 시 검증이 필요한 중요 리스크: 6
- 설계 종료 조건: 승인 가능한 구현 명세 수준 도달

---

## 18. 구현 착수 게이트

다음 조건을 모두 만족한 뒤 구현한다.

- [ ] 본 설계 승인
- [ ] `VisionObservationBundle v1` exact schema 확정
- [ ] provider model과 token cap 확정
- [ ] Face Lab deterministic renderer의 최소 출력 계약 확정
- [ ] `/api/analyze` response schema v2 호환 목록 확정
- [ ] Hosted Evaluation 전환 범위 확정
- [ ] Preview 비용·품질 acceptance criteria 확정

구현은 계약 → pure normalizer/projector → provider service → route integration → client cutover → compatibility adapter 순서로 진행한다.
