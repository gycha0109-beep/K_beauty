# Bejewely 통합 Vision Observation 파이프라인 구현·리뷰 — 2026-07-19

## 0. 상태

- 구현 상태: 완료
- 최종 코드 검증 기준 SHA: `70ef673fec6f19421ced16d00a1b14eea0c17ea5`
- 작업 브랜치: `design/unified-vision-observation-pipeline`
- 대상 PR: `#50`
- Production 병합·배포: 미실행
- 실제 사진/provider 호출 검증: 미실행

## 1. 구현 결과

운영 온보딩의 기존 구조:

```text
POST /api/analyze       -> image-bearing Skin Vision
POST /api/face-reading  -> image-bearing Face Lab Vision
```

개편 구조:

```text
POST /api/analyze 1회
  -> Canonical Vision Observation 1회
  -> Skin projection
  -> Face Lab projection
  -> deterministic Skin Match
  -> optional image-free product explanation
```

정상 온보딩 요청 기준:

```text
image upload mutation: 2 -> 1
image-bearing provider attempt: 2 -> 최대 1
client idempotency key: 2 -> 1
```

`/api/face-reading`은 Hosted Evaluation과 standalone 도구를 위한 compatibility route로 유지하되, 직접 provider payload를 만들지 않고 공통 Vision service를 사용한다.

## 2. 신규 경계

### Canonical contract

- `lib/vision-observation-contract.js`
- schema: `vision-observation-v1`
- prompt: `vision-observation-prompt-v1`
- locale, survey, current products, recommendation 결과를 Vision prompt에서 제거
- image eligibility, skin enum observations, face enum observations만 생성

### Normalizer

- `lib/vision-observation-normalizer.js`
- 기존 image eligibility 및 Face Lab observation normalizer 재사용
- Skin/Face subtree 독립 정규화
- root JSON 또는 eligibility invalid 시 fail-closed
- raw provider response 미보존

### Provider service

- `lib/server/vision-observation-service.js`
- operational image-bearing provider request site를 한 파일로 제한
- 자동 image retry 없음
- redirect 거부
- 전체 request/response lifecycle timeout
- response body streaming byte cap
- model/token cap 검증
- 숫자형 token usage와 attempt 수만 sanitized telemetry로 기록

### Projectors

- `lib/skin-observation-projector.js`
  - canonical skin data를 기존 `photoAnalysis` shape로 투영
  - survey alignment를 Vision이 아니라 deterministic server policy로 계산
  - KO/EN copy는 사진 재전송 없이 생성

- `lib/face-lab-observation-projector.js`
  - canonical face observations를 기존 Face Lab envelope로 투영
  - KO/EN deterministic presentation 생성
  - celebrity match 제거
  - personality/identity claim 제거
  - unavailable field에 `balanced/medium/neutral` 값을 주입하지 않음
  - partial coverage는 `insufficient_evidence`로 fail-closed

## 3. Route와 client 변경

### `/api/analyze`

- 기존 `extractPhotoAnalysis()` image call 제거
- common Vision service 1회 호출
- Skin Match와 Face Lab이 동일 bundle 사용
- Vision 실패 시 Skin Match는 survey fallback 유지
- Vision 실패 시 Face Lab은 unavailable
- Vision 실패 후 product explanation provider call을 연쇄 실행하지 않음
- Face Lab은 anonymous persistence fingerprint 계산 이후 최종 response에만 추가
- Premium report에는 sanitized Face Lab summary만 연결
- response schema version `2`

### `/api/face-reading`

- direct OpenAI URL/payload 제거
- common Vision service와 Face Lab projector 사용
- 기존 analysis guard 및 envelope 계약 유지

### onboarding client

- parallel `/api/face-reading` fetch 제거
- Face Lab용 별도 idempotency key 제거
- `/api/analyze` response의 `data.faceLab` 사용
- 기존 sessionStorage 결과 shape 유지

## 4. 구현 리뷰에서 발견·수정한 문제

1. **Provider timeout이 header 수신 후 해제되던 문제**
   - body read까지 동일 timeout 범위에 포함했다.

2. **Response size cap이 body 전체 수신 후에만 검사되던 문제**
   - Web Stream reader로 읽는 동안 1 MiB 초과 시 즉시 cancel하도록 수정했다.

3. **Face Lab projector가 누락 필드를 기본값으로 채우던 문제**
   - observation fallback parameter를 제거했다.
   - 실제 available field만 문장과 legacy shape에 반영한다.

4. **Partial observation을 full available 결과로 표시할 수 있던 문제**
   - partial은 `insufficient_evidence`로 축소했다.

5. **Vision 실패 뒤 text provider call이 연쇄 실행되던 문제**
   - successful Vision telemetry가 있을 때만 product explanation call을 허용한다.

6. **구형 Hosted Evaluation verifier가 route-local locale prompt를 강제하던 문제**
   - canonical prompt와 locale projector를 각각 검증하도록 전환했다.

7. **정적 fallback 탐지 verifier의 오탐 가능성**
   - 호출 정규식 대신 projector 함수 시그니처를 직접 검증하도록 보정했다.

8. **Token 절감 검증 지표가 로그에 남지 않던 문제**
   - provider usage의 숫자형 input/output token과 attempt 수만 별도 기록한다.

## 5. 보안·개인정보 경계

유지 또는 강화된 경계:

- 이미지 bytes는 요청 메모리에서만 사용
- data URL, image bytes, raw provider body 저장 금지
- provider payload 로그 금지
- free-form evidence 전체 로그 금지
- anonymous result strict allowlist 유지
- Face Lab 전체 payload를 anonymous result fingerprint에 포함하지 않음
- standalone route의 기존 rate-limit/idempotency policy 유지
- Production old/new dual-run 없음
- 자동 image retry 없음
- canonical observation DB cache 없음

## 6. 실행 검증

검증 브랜치는 구현 SHA 위에 validation workflow 파일 하나만 추가해 실행했으며 병합하지 않고 폐기했다.

실행 결과:

```text
npm ci                                      PASS
npm run verify:unified-vision-pipeline      PASS
npm run face-lab:eval:verify                PASS
npm run architecture:guard                  PASS
npm run build                               PASS
git diff --check                            PASS
```

검증 run:

- GitHub Actions run ID: `29657038740`
- validation PR: `#57` — closed, not merged
- 사진 전송: 0
- OpenAI 호출: 0

Vercel Preview는 계정 build-rate limit 때문에 이번 최종 검증 수단으로 사용할 수 없었고, GitHub Actions의 clean `npm ci` + production `next build`로 대체했다.

## 7. 최종 리뷰 판정

- Critical 결함: 0
- Important 미해결 결함: 0
- 구조 개편 DoD: 충족
- 병합 전 필수 코드 보완: 없음

## 8. 남은 외부 검증 리스크

다음은 코드·정적 검증만으로 확정할 수 없다.

1. 실제 provider가 combined canonical schema를 `max_tokens=2200` 안에서 안정적으로 완성하는지
2. 실제 input/output token 감소율
3. 실제 p50/p95 latency
4. Skin/Face observation 품질과 cross-contamination 여부
5. deterministic Face Lab copy의 사용자 체감 품질
6. 원본 이미지 해상도 최적화 효과

현재 구현은 동일 사진 중복 전송을 제거했지만, 별도 이미지 resize/transcode 라이브러리는 추가하지 않았다. 따라서 **image-bearing 호출 수는 50% 감소하지만 실제 전체 token 비용이 정확히 50% 감소한다고 단정하지 않는다.** 다음 Hosted smoke는 소수 fixture로 실행하고 usage telemetry를 기준으로 평가한다.

## 9. 최종 결론

운영 사용자 흐름의 동일 사진 이중 Vision 분석은 제거됐다. Skin Match와 Face Lab은 하나의 locale-neutral canonical observation을 공유하며, locale별 결과는 이미지 재전송 없이 서버 projector에서 생성된다. 기존 보안·저장 경계를 유지하면서 compatibility route와 Hosted Evaluation도 공통 service에 연결됐다.
