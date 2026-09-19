# Face Lab R-A2A Metadata Collection Runbook v1

> Track: FACE LAB / Reverse Archetype / Face Space Seed  
> Stage: R-A2A — Metadata collection  
> Production impact: none  
> Acquisition mode: manual metadata capture only

## 1. 목적

R-A2A는 현재 7개 cultural Archetype search seed에 대해 동결된 검색 surface와 query를 실행하고, 상위 결과의 provenance metadata만 수집하는 단계다.

이 단계는 얼굴을 분석하지 않는다.

```text
frozen surface + frozen query
→ ranked result metadata
→ provenance-only RAW candidate
→ collection ledger
```

다음 단계인 R-A2B에서 별도 governance 승인을 받은 candidate만 opaque asset handoff와 blind observation으로 넘어갈 수 있다.

## 2. Frozen scope

Retrieval surfaces:

- Google Images / Korean web
- Naver Image Search / Korean web
- Bing Images / Korean web

Queries:

- 7 Archetype search seeds
- seed당 8 query strata
- 총 56 queries

Collection task:

```text
1 surface × 1 query = 1 batch
```

총 계획:

```text
3 surfaces × 56 queries = 168 batches

168 batches × top 5 = 최대 840 metadata candidates
```

## 3. Authority files

- `source-manifest.json`
- `query-manifest.json`
- `collection-ledger.json`

경로:

```text
evidence/facelab/reverse-archetype/pilot-v1/
```

현재 ledger run은 하나의 `runId`를 사용한다.

다른 run의 batch를 현재 ledger에 섞으면 validator가 실패해야 한다.

## 4. Collection plan 확인

전체 168개 task 계획:

```bash
npm run plan:face-lab-reverse-archetype-collection
```

계획에는 각 task마다 다음이 포함된다.

- retrieval surface
- query ID
- query string
- query family
- Archetype search-context label
- requested depth
- acquisition mode

Archetype label은 search provenance다. ground truth가 아니다.

## 5. Batch 단위

한 batch는 정확히 하나의:

```text
retrievalSurfaceId + queryId
```

조합만 담당한다.

예:

```text
google_images_ko_web
+
wolf:general
→ "늑대상" 상위 5개 결과
```

완료 batch는 rank 1~5가 모두 존재해야 한다.

rank가 중복되거나 하나라도 빠지면 `complete`로 저장할 수 없다.

## 6. Collection context

각 batch에는 실제 수집 상황을 기록한다.

필수:

- `signedInState`: signed_out / signed_in
- `profileState`: fresh_profile / existing_profile / unknown
- `safeSearchState`: on / off / unknown
- `deviceClass`: desktop_web / mobile_web
- locale
- language

권장 기본:

```text
signed_out
fresh_profile
desktop_web
ko-KR
ko
```

단 실제 상태와 다르면 실제 상태를 기록한다.

## 7. Candidate metadata

각 rank에서 저장하는 것은 metadata뿐이다.

필수 provenance:

- opaque run ID
- opaque candidate ID
- frozen query ID / string / family
- retrieval surface
- origin domain
- result rank
- result URL
- landing URL
- image URL/reference
- retrieval timestamp
- acquisition mode
- raw image retention flag = false

금지:

- raw image bytes
- local downloaded image
- base64 image
- ground-truth label
- Face Lab observation
- current Archetype scorer output
- identity recognition result

## 8. URL 기록 규칙

가능한 한 현재 surface에서 확인 가능한 실제 참조를 기록한다.

- `resultUrl`: 검색 결과 항목 또는 해당 result를 재식별할 수 있는 URL
- `landingUrl`: 원본 게시 페이지
- `imageUrl`: 해당 result가 가리키는 이미지 URL 또는 surface에서 제공하는 이미지 reference URL

필드를 신뢰성 있게 얻을 수 없으면 값을 만들어 넣지 않는다.

그 task를 완주할 수 없다면 `blocked` batch로 남긴다.

다른 검색 API나 다른 검색엔진의 결과로 대체하지 않는다.

## 9. Complete vs Blocked

### complete

조건:

- frozen query 그대로 실행
- frozen surface 사용
- rank 1~5 모두 기록
- provenance validation PASS

### blocked

다음과 같은 경우 사용할 수 있다.

- surface에서 필요한 metadata를 신뢰성 있게 얻을 수 없음
- 검색 결과 surface가 예상과 달라 rank를 보존할 수 없음
- access / policy / technical restriction
- 기타 provenance integrity 문제

`blockedReason`은 필수다.

Blocked는 실패를 숨기는 값이 아니라 연구 provenance다.

## 10. 금지되는 대체

다음은 금지한다.

```text
Google Images task
→ generic web search API 결과로 채움

Naver Image Search task
→ 다른 검색엔진 결과로 채움

top-5 중 rank 3을 못 찾음
→ rank 6으로 메움

직접 image URL을 못 찾음
→ 추측 URL 생성
```

검색 surface/rank 자체가 연구 변수이기 때문이다.

## 11. Ledger 검증

현재 collection ledger 상태 확인:

```bash
npm run validate:face-lab-reverse-archetype-collection -- evidence/facelab/reverse-archetype/pilot-v1/collection-ledger.json
```

출력 핵심:

- plannedBatches
- completeBatches
- blockedBatches
- pendingBatches
- plannedCandidates
- capturedCandidates
- bySurface
- byArchetype
- missingTasks

## 12. Ledger lifecycle

초기:

```text
status = open
batches = []
```

진행 중:

```text
open
→ complete / blocked batch 누적
→ coverage 재검증
```

모든 168개 task가 complete 또는 blocked로 명시되기 전에는 ledger를 `sealed`로 바꾸지 않는다.

Validator가 pending batch가 있는 sealed ledger를 거부한다.

## 13. Descriptor query 주의

`{label} 특징` query는 descriptor/content 결과가 많이 나올 수 있다.

이 query의 search result를 다른 face-photo query와 동일한 face sample이라고 가정하지 않는다.

R-A2A에서는 rank provenance를 그대로 수집한다.

R-A2B eligibility에서 실제 단일 얼굴 사진이 아니면 명시적으로 제외될 수 있다.

## 14. Gendered query 주의

`남자`, `여자`는 검색 query context일 뿐이다.

검색 결과 인물의 실제 성별을 얼굴에서 추론하거나 검증하지 않는다.

이 field를 Face Representation의 sensitive-attribute truth로 사용하지 않는다.

## 15. R-A2A 완료 조건

R-A2A는 다음 조건에서 종료할 수 있다.

- 168개 frozen task 모두 complete 또는 blocked
- duplicate surface/query batch 없음
- complete batch는 frozen top-5 ranks 완전
- 모든 RAW candidate validation PASS
- raw image retention = false
- ground truth / observation / scorer output 혼입 없음
- blocked reason 보존
- final coverage report 생성
- ledger seal 가능

R-A2A 완료는 이미지 처리 승인이나 R-A2B 시작 승인을 의미하지 않는다.
