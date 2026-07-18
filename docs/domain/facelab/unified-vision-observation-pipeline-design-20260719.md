# Bejewely 통합 Vision Observation 파이프라인 설계 — 2026-07-19

## 0. 상태와 범위

- 상태: **설계 및 자체 리뷰 완료 / 구현 전**
- 기준 커밋: `88303dfc3a90f92b5ab57c74d1d05bf85fbd9a60`
- 기준 브랜치: `codex/survey-input-contract-refactor`
- 설계 브랜치: `design/unified-vision-observation-pipeline`
- 목적: 운영 온보딩에서 동일 사진이 `/api/analyze`와 `/api/face-reading`으로 각각 전송되는 구조를 **사진 관찰 1회 + 도메인별 투영** 구조로 개편한다.
- 비범위: 제품 점수 정책, 상품 DB, 결제, 인증/RLS, Saved Report 소유권, Premium 정책 의미 변경

---

## 1. 현재 구조

```text
imageFile
├─ POST /api/analyze
│  ├─ Vision: 피부 신호·사진 관찰
│  ├─ deterministic Skin Match
│  └─ Text: 선택 제품 설명
└─ POST /api/face-reading
   └─ Vision: 적합성·얼굴 구조·locale별 Face Lab 문장
```

현재 운영 요청 1회당 provider 호출:

```text
이미지 포함 2회
이미지 미포함 1회
```

### 확인된 결함

1. 동일 이미지의 encoding과 image token을 중복 소비한다.
2. 두 Vision 요청이 서로 다른 적합성·화질·가림 판단을 낼 수 있다.
3. Skin Match와 Face Lab이 동일 사진에 대해 상충하는 관찰값을 가질 수 있다.
4. Face Lab의 관찰과 locale별 표현이 결합되어 있다.
5. 사용자의 한 행동이 두 analysis guard와 두 idempotency 흐름으로 나뉜다.
6. 클라이언트가 두 요청의 완료·부분 실패를 조정한다.
7. 두 route의 prompt와 normalizer가 독립적으로 drift한다.

---

## 2. 핵심 결정

### 채택

```text
사진 1장
→ locale·설문과 독립된 canonical Vision 관찰 1회
→ Skin projection
→ Face Lab projection
→ locale별 deterministic 표현
→ 필요할 때만 이미지 없는 text enhancer
```

### 폐기

```text
사진 + 설문 + 제품 + Skin Match + Face Lab + 모든 문장
→ 하나의 거대 multimodal prompt
```

폐기 이유:

- 제품 선택 authority가 LLM으로 이동할 위험
- 지나치게 큰 JSON 계약
- 한 도메인 오류가 전체 결과를 무효화
- locale과 사진 관찰의 재결합
- 테스트·회귀 원인 분리 어려움

---

## 3. 필수 목표

1. 운영 온보딩의 정상 요청에서 이미지 포함 provider attempt를 **최대 1회**로 제한한다.
2. Skin Match와 Face Lab이 동일한 정규화 관찰 번들을 사용한다.
3. Vision prompt에서 locale, 설문, 현재 제품, 추천 결과를 제거한다.
4. 제품 선택은 기존 deterministic decision engine이 계속 소유한다.
5. KO/EN 표현은 사진 재전송 없이 생성한다.
6. Skin과 Face Lab의 부분 성공·실패를 독립적으로 표현한다.
7. 기존 `/api/analyze` 결과와 Face Lab envelope를 additive하게 호환한다.
8. 원본 이미지, data URL, raw provider 응답을 저장하지 않는다.
9. 기존 anonymous write grant와 Premium 저장 계약을 확장하지 않는다.

### 비목표

- 첫 구현에서 얼굴 파생 데이터 DB cache를 추가하지 않는다.
- Production에서 old/new Vision을 동시에 호출하지 않는다.
- text renderer를 초기부터 하나로 합치지 않는다.
- provider 오류 시 이미지를 자동 재전송하지 않는다.
- 이번 개편에서 analysis guard DB/RPC 계약을 재설계하지 않는다.

---

## 4. 목표 아키텍처

```text
Client
  │ POST /api/analyze
  │ image + survey + locale + currentProducts
  ▼
Analysis Orchestrator
  ├─ existing analysis guard / idempotency
  ├─ upload validation
  ├─ image bytes read once
  ├─ image canonicalization once
  └─ in-memory image digest
        │
        ▼
Canonical Vision Observation Service
  └─ image-bearing provider attempt: max 1
        │
        ▼
VisionObservationBundle v1
  ├─ shared eligibility
  ├─ shared image quality
  ├─ skin observations
  └─ face observations
        │
        ├─ Skin Observation Projector
        │    ├─ existing photoAnalysis shape
        │    └─ deterministic survey alignment
        │
        ├─ Face Lab Projector
        │    ├─ existing FaceLabObservationAnalysis
        │    ├─ deterministic base_data/features
        │    └─ existing Face Lab envelope
        │
        ├─ Skin Match Decision Engine
        │    └─ deterministic product selection
        │
        ├─ optional Product Explanation Renderer
        │    └─ text only
        │
        └─ optional Face Lab Text Enhancer
             └─ text only + strict validation + deterministic fallback

Unified /api/analyze response
  ├─ existing Skin Match public result
  └─ faceLab envelope
```

원칙: **provider는 관찰만 수행하고, 정책과 사용자 표현은 서버 도메인 계층이 소유한다.**

---

## 5. Canonical Vision 계약

### 버전

```text
schemaVersion = vision-observation-v1
promptVersion = vision-observation-prompt-v1
```

### prompt 규칙

- locale, 설문, 현재 제품, 추천 결과를 입력하지 않는다.
- 사용자용 문장을 생성하지 않는다.
- 제품 추천, 성격·행동 추론, 매력도, 운세, 유명인 식별을 금지한다.
- fixed enum, 제한 숫자, 제한 배열만 사용한다.
- 불확실하면 추측하지 않고 `insufficient_evidence`로 낮춘다.
- Skin과 Face section을 독립적으로 작성한다.

### 제안 shape

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
    "evidence": ["single human face is visible"]
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
    "evidence": ["outline and visible skin regions are sufficiently clear"]
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
        "cue": "surface_shine",
        "level": "moderate",
        "confidence": "medium"
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

### 기존 계약 재사용

- `normalizeImageAnalysisEligibility()`를 공통 적합성 authority로 유지한다.
- `normalizeFaceImageQuality()`를 공통 화질 authority로 사용한다.
- `normalizeFaceObservationBundle()`을 face section에 재사용한다.
- 기존 Skin signal axis와 0~5 범위를 유지한다.

### evidence 경계

기존 validator 호환을 위해 eligibility와 quality에 짧은 영어 evidence 문자열을 허용한다.

- 사용자 화면에 직접 표시하지 않는다.
- raw provider body와 함께 저장하지 않는다.
- 로그에 전체 문자열을 남기지 않는다.
- Skin observation은 `area/cue/level/confidence` enum을 우선한다.

---

## 6. 신규 모듈 경계

```text
lib/vision-observation-contract.js
lib/vision-observation-normalizer.js
lib/server/vision-observation-service.js
lib/skin-observation-projector.js
lib/face-lab-observation-projector.js
lib/face-lab-presentation-policy.js
lib/analysis-orchestrator.js
```

### `vision-observation-contract.js`

- schema/prompt version
- enum, max length, JSON shape, prompt rules

### `vision-observation-normalizer.js`

- root JSON parse 후 Skin/Face subtree를 독립 정규화한다.
- 한 subtree 오류가 다른 subtree를 자동 무효화하지 않는다.
- unknown key 제거, score 0~5 제한, enum fail-closed를 수행한다.
- raw provider response를 반환하거나 저장하지 않는다.
- root JSON 자체가 파싱 불가능하면 두 도메인 모두 fallback한다.

### `server/vision-observation-service.js`

- canonicalized image bytes만 입력받는다.
- 이미지 포함 provider request site를 이 파일 하나로 제한한다.
- 정상 운영 요청의 provider attempt는 최대 1회다.
- timeout, response-size cap, model, token cap, telemetry를 소유한다.
- locale/survey/products를 provider body에 넣지 않는다.
- normalized `VisionObservationBundle v1`만 반환한다.

### `skin-observation-projector.js`

- canonical Skin data를 기존 `photoAnalysis` shape로 투영한다.
- label/summary/description을 locale template으로 생성한다.
- `surveyAlignment`를 서버에서 결정한다.
- Skin 분석 불가 시 기존 survey fallback을 반환한다.

### `face-lab-observation-projector.js`

- canonical Face data로 기존 `FaceLabObservationAnalysis`를 구성한다.
- envelope의 `source: "vision"`은 호환을 위해 유지한다.
- derived field는 내부적으로 `source: "derived_from_vision"`을 사용한다.
- Face 분석 불가 시 eligibility failure reason을 보존한다.

### `face-lab-presentation-policy.js`

- 얼굴형, 구조 키워드, 색상·헤어 방향을 canonical enum에서 deterministic하게 계산한다.
- KO/EN 문장을 locale template으로 렌더링한다.
- 기존 `features.physiognomy` key는 compatibility adapter로만 유지한다.
- `real_tendency`에 성격·행동 단정을 생성하지 않는다.
- 유명인/lookalike 결과는 계속 빈 값으로 유지한다.
- 기존 `buildFaceLabLaunchData()` 입력 shape를 제공한다.

### `analysis-orchestrator.js`

- upload validation
- image read/canonicalization
- canonical Vision acquisition
- Skin/Face projection
- Skin Match engine
- optional text renderer
- partial failure
- public/Premium/anonymous persistence 경계

---

## 7. `/api/analyze`를 단일 운영 진입점으로 유지

새 public mutation route를 만들지 않는다.

이유:

- anonymous write grant와 Premium report session이 이미 `/api/analyze`에 결합되어 있다.
- 새 route는 인증, rate limit, idempotency, 저장 계약을 다시 이중화한다.
- 결과 페이지가 `/api/analyze` payload를 기준으로 동작한다.

### 응답 조립 순서

`faceLab`을 기존 anonymous persistence payload에 넣지 않는다.

```text
decision
→ publicDecision (기존 Skin Match allowlist 그대로)
→ anonymousPersistenceResult(publicDecision)
→ anonymous write grant
→ premiumReport + sanitized faceLabSummary
→ responsePayload = publicDecision + meta + faceLab
```

이 순서를 지켜 `canonicalizeAnonymousResultForPersistence()`의 strict allowlist를 유지한다.

### additive response

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
      "analysis": {},
      "presentationSource": "deterministic"
    }
  },
  "meta": {
    "schemaVersion": 2,
    "source": "skin-match-v2",
    "visionObservationSchemaVersion": "vision-observation-v1"
  }
}
```

Provider attempt 수와 token usage는 Production public response에 넣지 않고 telemetry에만 기록한다.

### persistence 경계

- anonymous result allowlist는 변경하지 않는다.
- Face Lab full payload를 anonymous result 테이블에 추가하지 않는다.
- Premium에는 기존 `sanitizePremiumFaceLabSummary()` 결과만 포함한다.
- Face Lab envelope는 현재처럼 sessionStorage에 둘 수 있으나 localStorage/DB로 승격하지 않는다.

---

## 8. 클라이언트 cutover

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

호환:

- `skinTestResult`에는 `/api/analyze` 응답 전체를 저장한다.
- `skinTestFaceLabFull`은 필요하면 `data.faceLab`에서 계속 채운다.
- 기존 Face Lab envelope reader를 유지한다.
- 사용자 제출당 idempotency key는 하나만 생성한다.

`faceLab` 누락 시 `/api/face-reading`을 자동 호출하지 않는다. unavailable UI로 처리한다. 자동 fallback은 장애 시 중복 image call을 되살린다.

---

## 9. `/api/face-reading` compatibility route

즉시 삭제하지 않는다.

사용처:

- Hosted Evaluation
- 독립 Face Lab 도구
- 기존 회귀 테스트

변경:

- route 내부 direct OpenAI fetch를 제거한다.
- `vision-observation-service`를 호출한다.
- canonical observation에서 Face Lab projection만 반환한다.
- standalone 호출은 image provider attempt 1회를 사용한다.
- 운영 온보딩은 이 route를 호출하지 않는다.

장기적으로 Hosted Evaluation은 localized `base_data/features`보다 canonical face observation과 deterministic projection을 분리 평가한다.

---

## 10. 표현 생성

```text
canonical observations
→ deterministic Skin/Face core
→ optional text-only enhancer
→ strict validation
→ deterministic fallback
```

초기 허용 범위:

```text
image-bearing provider: 최대 1회
product explanation text: 0~1회
Face Lab text enhancer: 0~1회
```

Face Lab enhancer는 필수가 아니다. enhancer 실패 시 deterministic 결과를 유지한다.

초기부터 text renderer를 합치지 않는 이유:

- 제품 설명과 Face Lab은 실패 도메인이 다르다.
- 한쪽 schema 오류가 다른 쪽 결과를 제거하면 안 된다.
- 각 renderer의 token/실패율을 먼저 측정해야 한다.

후속 통합 판단 지표:

- prompt/completion token
- schema invalid 비율
- fallback 비율
- p50/p95 latency
- 사용자 품질 평가

---

## 11. Survey alignment 분리

현재 photo Vision prompt에서 설문 context를 제거한다.

```text
Vision: 사진에서 보이는 신호만 반환
Server: canonical Skin observation과 survey contract를 비교
```

제안 함수:

```text
buildSurveyPhotoAlignment({ skinObservation, surveyContract, locale })
```

이유:

- 설문이 달라도 사진 관찰은 같아야 한다.
- locale 변경이 관찰 결과를 바꾸면 안 된다.
- alignment는 관찰이 아니라 정책 결과다.

기존 `photoObservations.surveyAlignment` shape는 유지한다.

---

## 12. 부분 성공과 단일 실패 지점

| 상태 | Skin Match | Face Lab |
|---|---|---|
| skin=true, face=true | 사진 반영 | available |
| skin=true, face=false | 사진 반영 | photo_ineligible |
| skin=false, face=true | survey fallback | available |
| skin=false, face=false | survey fallback | unavailable |
| provider/root JSON failure | survey fallback | unavailable |
| Face Lab renderer failure | 영향 없음 | deterministic fallback |
| product explanation failure | deterministic explanation | 영향 없음 |

### 통합 구조의 단점

분리 호출에서는 한 Vision 요청만 실패하고 다른 요청은 성공할 수 있다. 통합 호출에서는 transport 또는 root JSON 실패가 Skin과 Face 모두에 영향을 준다.

완화:

- Skin Match는 기존 survey fallback을 유지한다.
- Face Lab은 unavailable로 안전하게 축소한다.
- 이미지를 자동 재전송하지 않는다.
- 재시도는 사용자의 새 분석 요청으로만 수행한다.

---

## 13. 보안·개인정보

### 이미지

- 요청 수명 동안만 메모리에 둔다.
- canonicalization은 한 번만 수행한다.
- 원본/canonical image/data URL을 DB, 로그, artifact에 저장하지 않는다.
- provider payload를 로그에 출력하지 않는다.

### 얼굴 파생 데이터

- raw provider JSON을 저장하지 않는다.
- normalized enum과 제한 evidence만 내부에서 사용한다.
- public response에는 기존 UI/reentry에 필요한 projection만 포함한다.
- 신규 server cache는 별도 보존·삭제·권한 설계 전까지 금지한다.

### 허용 telemetry

```text
analysisRunId
stage
provider
model
status
durationMs
inputTokens
outputTokens
imageProviderAttemptCount
schemaVersion
failureCategory
```

### 금지 telemetry

```text
image bytes
data URL
raw provider body
free-form evidence 전체
image digest 원문
authorization/cookie/email
절대 파일 경로
```

---

## 14. Analysis Guard와 fingerprint

### 초기 구현 원칙

이번 개편에서는 기존 `guardAnalysisRequest()`의 DB/RPC와 atomic claim 계약을 변경하지 않는다.

- 온보딩은 `analyze` policy만 소비한다.
- `face-reading` policy는 standalone route에만 남긴다.
- 기존 request fingerprint의 upload descriptor(name/type/size)와 전체 form/locale/currentProducts 계약을 유지한다.
- 초기에는 `analyze` limit을 유지하고 실제 비용 지표 후 조정한다.
- 기존 두 policy limit을 단순 합산하지 않는다.

### 신규 Vision input fingerprint

image bytes를 읽은 뒤 메모리에서 다음 fingerprint를 계산한다.

```text
visionInputFingerprint = HMAC(
  imageDigest + canonicalizationVersion + model + promptVersion + schemaVersion
)
```

용도:

- provider telemetry correlation
- fixture 비교
- 향후 별도 승인된 cache 설계의 후보 key

규칙:

- survey, currentProducts, locale을 넣지 않는다.
- raw image digest나 fingerprint를 public response/log에 출력하지 않는다.
- DB idempotency row에는 저장하지 않는다.

### content-hash idempotency는 별도 작업

현재 upload descriptor는 content hash가 아니므로 동일 name/type/size의 다른 이미지 구분이 제한적이다. 이를 해결하려면 guard의 rate-limit 선점과 idempotency claim을 두 단계로 분리하거나 RPC 계약을 변경해야 한다.

이번 구조 개편에서는 범위를 확대하지 않고 다음 별도 보안 작업으로 남긴다.

```text
analysis guard content-hash fingerprint hardening
```

---

## 15. 버전과 legacy

```text
visionObservationSchemaVersion = vision-observation-v1
visionObservationPromptVersion = vision-observation-prompt-v1
faceLabPresentationVersion = face-lab-presentation-v2
analyzeResponseSchemaVersion = 2
```

- 기존 Saved Report는 legacy adapter로 계속 읽는다.
- 신규 결과만 새 버전을 선언한다.
- legacy 결과를 canonical observation 결과로 가장하지 않는다.
- anonymous persistence fingerprint와 allowlist는 유지한다.
- 저장된 localized presentation을 재진입 시 우선한다.
- DB에 canonical observation이 없는 legacy report를 locale만 바꿔 새 분석 결과처럼 재생성하지 않는다.

---

## 16. 구현 단계

### Phase 0 — 계약과 pure verifier

- exact schema/prompt contract
- normalizer
- Skin/Face projector
- locale invariance
- eligibility matrix
- prompt에 locale/survey/products가 없는지 static guard

완료 기준:

- synthetic fixture PASS
- 기존 eligibility/Face observation 회귀 PASS
- malformed subtree 독립 fallback PASS

### Phase 1 — 공통 provider service

- image canonicalization boundary
- image-bearing provider execution site 단일화
- max one attempt
- response-size/token cap
- telemetry

완료 기준:

- allowlist 밖 image-bearing provider request site 0개
- 정상 요청당 image provider attempt 1개

### Phase 2 — `/api/analyze` 통합

- Skin projection
- Face Lab projection
- additive Face Lab envelope
- partial failure
- Premium `faceLabSummary`
- anonymous persistence 경계 유지

완료 기준:

- `/api/analyze`만으로 Skin Match와 Face Lab UI 데이터 생성
- anonymous write grant 회귀 PASS
- Premium session/save/reentry 회귀 PASS

### Phase 3 — 클라이언트 cutover

- 병렬 Face Lab request 제거
- idempotency key 하나
- sessionStorage 호환
- 결과 페이지 KO/EN 회귀

완료 기준:

- 브라우저 network에서 image upload mutation 1회
- Face Lab/Skin Match 표시
- 누락 시 추가 image request 없음

### Phase 4 — `/api/face-reading` adapter

- direct provider fetch 제거
- common service 사용
- Hosted Evaluation canonical contract 전환

완료 기준:

- standalone route image attempt 1회
- evaluator locale별 image 재분석 0회

### Phase 5 — text 최적화

- Face Lab enhancer 품질 측정
- product/Face renderer 통합 여부 결정
- total token과 latency 비교

### 별도 후속 보안 작업

- analysis guard content-hash fingerprint hardening
- 필요 시 DB/RPC migration과 독립 verifier

---

## 17. 검증 계획

### 구조

- 온보딩 source에 `/api/face-reading` fetch가 없다.
- `/api/analyze`가 orchestrator를 사용한다.
- image-bearing provider call site가 한 곳이다.
- compatibility route가 common service를 우회하지 못한다.

### 계약

- unknown key 제거
- invalid enum fail-closed
- Skin score 0~5
- eligibility/domain consistency
- Skin/Face subtree 독립 fallback
- root parse failure global fallback

### locale invariance

같은 canonical bundle의 KO/EN projection에서 동일해야 하는 값:

```text
eligibility
quality
skin signal scores
face enum observations
coverage/status
```

달라질 수 있는 값:

```text
label
summary
description
hair/style direction copy
product explanation copy
```

### 브라우저

- `/api/analyze` 1회
- Face Lab tab 정상
- Skin Match 정상
- anonymous grant 정상
- Premium 진입/저장/재진입 정상
- KO/EN 정상

### 비용·성능

필수 지표:

```text
image_provider_attempts_per_analysis
image_input_tokens
vision_prompt_tokens
vision_completion_tokens
text_tokens_by_renderer
provider_429_count
fallback_count_by_domain
p50/p95 latency
```

Acceptance:

- image provider attempt: 2 → 1
- image-bearing request count: 50% 감소
- total 비용 감소율은 측정값으로 판정하며 50%라고 가정하지 않는다.
- p95 latency 초과 시 prompt/schema 축소를 우선한다.

---

## 18. Rollout과 rollback

### 순서

1. server가 additive `faceLab` 응답을 생성한다.
2. Preview에서 통합 response를 검증한다.
3. 클라이언트를 단일 request로 전환한다.
4. Hosted Preview에서 network/provider telemetry를 검증한다.
5. Production 배포한다.

### feature flag

`UNIFIED_VISION_PIPELINE_ENABLED`는 client cutover 전 server 검증에만 사용한다.

- cutover 전: on/off 비교 가능
- cutover 후: flag off로 old dual route를 자동 복원하지 않는다.
- cutover 후 rollback은 server와 client를 함께 이전 배포로 되돌리는 atomic deployment rollback으로 수행한다.

### dual-run 금지

Production에서 old/new Vision을 동시에 실행하지 않는다. 비교는 비개인 synthetic/local fixture와 Hosted Evaluation에서만 수행한다.

---

## 19. 자체 리뷰 결과

### 리뷰에서 수정한 문제

1. **하나의 거대 multimodal prompt 안**  
   관찰만 provider에 남기고 정책·표현을 분리했다.

2. **설문을 Vision prompt에 유지하던 안**  
   canonical 독립성을 위해 survey alignment를 post-processing으로 이동했다.

3. **`/api/face-reading` 즉시 삭제 안**  
   Hosted Evaluation과 standalone 도구를 위해 adapter로 유지했다.

4. **Face Lab을 `publicDecision`에 직접 추가하던 안**  
   anonymous strict allowlist를 깨므로 persistence 이후 response에 붙이도록 순서를 고정했다.

5. **통합 provider 실패의 단일 실패 지점 누락**  
   Skin survey fallback과 Face unavailable 축소를 명시했다.

6. **legacy `physiognomy`의 성격 추론 위험**  
   key는 adapter로만 유지하고 행동·성격 단정을 금지했다.

7. **provider retry가 이미지 1회 목표를 깨는 문제**  
   정상 운영 request의 image-bearing provider attempt를 최대 1회로 고정했다.

8. **provider fingerprint에 survey/products/locale을 넣었던 문제**  
   Vision input fingerprint에서 제거했다.

9. **content digest를 기존 guard fingerprint에 즉시 넣으려던 문제**  
   현재 atomic DB/RPC 계약과 충돌하므로 별도 보안 작업으로 분리했다.

10. **client cutover 후 feature flag rollback 문제**  
    cutover 후에는 atomic deployment rollback만 허용하도록 수정했다.

### 남은 구현 리스크

1. 통합 JSON이 커져 schema invalid나 latency가 증가할 수 있다.
2. Skin/Face section 간 cross-contamination 가능성이 있다.
3. deterministic Face Lab 문장 품질이 현재 provider prose와 달라질 수 있다.
4. `face-lab-launch.js`의 legacy 자유 텍스트 의존성이 크다.
5. additive response가 기존 verifier와 saved-report flow에 미치는 영향을 확인해야 한다.
6. 현재 upload descriptor 기반 idempotency의 content collision 한계는 남는다.
7. provider image canonicalization 기능이 기준 브랜치에 실제로 존재하는지 구현 전에 재확인해야 한다.

### 최종 판정

- Critical 설계 결함: **0**
- Important 미해결 설계 결함: **0**
- 구현 검증이 필요한 중요 리스크: **7**
- 설계 종료 조건: **구현 착수 가능한 수준 도달**

---

## 20. 구현 착수 게이트

- [ ] 본 설계 승인
- [ ] exact schema/enum 확정
- [ ] model과 token cap 확정
- [ ] deterministic Face Lab 최소 출력 계약 확정
- [ ] `/api/analyze` schema v2 호환 목록 확정
- [ ] anonymous/Premium 저장 회귀 목록 확정
- [ ] Hosted Evaluation 전환 범위 확정
- [ ] Preview 비용·품질·latency acceptance 확정

구현 순서:

```text
contract
→ pure normalizer/projector
→ provider service
→ /api/analyze integration
→ persistence/security regression
→ client cutover
→ /api/face-reading adapter
→ Hosted Evaluation migration
```
