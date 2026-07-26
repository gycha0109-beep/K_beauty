# Unified Vision Provider Smoke — 2026-07-19

## 1. 실행 기준 SHA

- Repository: `gycha0109-beep/K_beauty`
- PR: `#50`
- Branch: `design/unified-vision-observation-pipeline`
- Base: `codex/survey-input-contract-refactor`
- Smoke 기준 HEAD: `a19993d3bfb90c233651f820e1248d2ab3d6d2da`
- 검증된 구현 SHA: `70ef673fec6f19421ced16d00a1b14eea0c17ea5`
- 구현 SHA 이후 변경: 구현·최종 리뷰 문서 1개 추가, runtime 변경 없음
- 시작 시 PR 상태: open, ready, mergeable

## 2. 환경

- 실행 환경: Windows 로컬 격리 worktree
- Node.js: `v24.14.0`
- npm: `11.9.0`
- Next.js: `15.5.18`
- Provider: OpenAI
- Model: `gpt-4o-mini`
- Production route, Vercel Preview, Production 배포는 사용하지 않음
- 원격 Supabase는 사용하지 않음
- API key, Authorization header, 원본 이미지, base64, raw Provider body는 출력·저장하지 않음

## 3. 호출 예산

| 항목 | 예산 | 실제 |
| --- | ---: | ---: |
| 고유 사진 | 최대 2장 | Provider 전송 1장 |
| image-bearing Provider attempt | 최대 2회 | 1회 |
| fixture당 attempt | 최대 1회 | Lane B 1회, Lane A 0회 |
| 자동 retry | 0회 | 0회 |
| 429 retry | 0회 | 0회 |
| timeout/network/schema retry | 0회 | 0회 |

Provider 인증 실패 직후 남은 호출 예산과 관계없이 전체 실 Provider 실행을 중단했다.

## 4. Fixture 선정 근거

기존 private Face Lab Hosted Evaluation manifest에서 콘텐츠가 서로 다른 fixture를 선택했다. 새 이미지를 추가하거나 복사하지 않았다.

| fixtureId | lane | 조건 태그 | 선택 목적 | Provider 전송 |
| --- | --- | --- | --- | --- |
| `subject-a-frontal-clear` | A | frontal, clear, even_light, no_occlusion | Skin과 Face Lab 모두 정상 분석 가능한 E2E 기준 | 아니오 |
| `subject-a-lower-face-occluded` | B | frontal, lower_face_occlusion | 제한 조건에서 partial 또는 fail-closed 품질 확인 | 예, 1회 |

실제 파일 경로, 이미지 hash, 이미지 내용은 기록하지 않았다.

## 5. Lane A 결과

**결과: NOT RUN / 환경 차단**

Lane A는 실제 `/api/analyze`를 호출하기 전에 로컬 analysis guard와 anonymous write-grant를 만족할 격리 Supabase를 준비하려 했다. `.env.local`의 Supabase 대상은 localhost가 아니므로 원격 대상은 사용하지 않았다.

로컬 Supabase 초기화는 첫 migration 적용 중 기준 `public.products` relation이 없어 중단됐다. 임시 DB schema 보정은 smoke 범위를 벗어나므로 수행하지 않았다.

- `/api/analyze` 호출: 0회
- `/api/face-reading` 호출: 0회
- image-bearing Provider attempt: 0회
- Skin Match 응답 계약: runtime 미검증
- Face Lab envelope: runtime 미검증
- anonymous write-grant: runtime 미검증

## 6. Lane B 결과

**결과: FAIL / Provider 인증 실패**

DB에 의존하지 않는 localhost 전용 임시 harness에서 `subject-a-lower-face-occluded`를 canonical Vision service에 한 번 전달했다. harness는 임시 token을 요구했고 `127.0.0.1`에만 바인딩됐다.

Provider는 HTTP `401`을 반환했다.

- canonical Vision service 호출: 1회
- image-bearing Provider attempt: 1회
- 자동 retry: 0회
- failure category: `authentication_failed`
- canonical bundle 생성: 실패
- Skin projection KO/EN: 실행되지 않음
- Face Lab projection KO/EN: 실행되지 않음
- projection 추가 Provider 호출: 검증 불가

인증 실패 지침에 따라 동일 fixture 재호출, 다른 fixture 호출, 코드 수정은 수행하지 않았다.

## 7. Provider token/latency 지표

| fixtureId | lane | provider | model | httpStatus | image attempts | input tokens | output tokens | total tokens | durationMs | schema | prompt |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| `subject-a-lower-face-occluded` | B | openai | gpt-4o-mini | 401 | 1 | null | null | null | 725 | vision-observation-v1 | vision-observation-prompt-v1 |

실패 응답에는 usage가 없어 token 수치를 얻지 못했다. `725ms`는 로컬 harness에서 Provider 실패를 수신할 때까지의 시간이다.

## 8. Skin 품질 판정

**Runtime 판정 불가.** Canonical bundle이 생성되지 않아 visible cue, confidence, 조명·메이크업 영향, 설문·사진 근거 분리 품질을 실제 Provider 결과로 검토하지 못했다.

정적 verifier는 Skin projector가 canonical Skin subtree를 사용하고 survey alignment를 후처리함을 확인했지만, 이는 실제 Provider 품질 PASS를 대신하지 않는다.

## 9. Face Lab 품질 판정

**Runtime 판정 불가.** Canonical bundle이 생성되지 않아 구조 cue, 근거 부족 축소, KO/EN 의미 일치, fallback 미삽입을 실제 Provider 결과로 검토하지 못했다.

정적 verifier는 partial Face Lab fail-closed, lookalike 빈 값, 관찰 fallback 주입 금지를 확인했지만, 이는 실제 Provider 품질 PASS를 대신하지 않는다.

## 10. Cross-contamination 판정

**Runtime 판정 불가.** Skin과 Face projection이 생성되지 않았다.

정적 구조상 단일 canonical bundle에서 독립 projector를 사용하고 provider image request site는 공통 service 한 곳뿐임을 확인했다. 실제 결과의 상호 오염 여부는 유효한 Provider 응답으로 다시 검증해야 한다.

## 11. 보안·개인정보 확인

- 원격 Supabase를 호출하지 않았다.
- Production, Vercel Preview, public deployment를 사용하지 않았다.
- Provider key와 Authorization header를 출력하거나 문서화하지 않았다.
- 원본 이미지, base64, data URL, 얼굴 crop, raw Provider response, raw evidence를 저장하지 않았다.
- fixture는 기존 private 위치에서 읽기만 했다.
- 임시 localhost route, dev server, route token, 임시 server log를 제거했다.
- 이미지 artifact나 fixture copy를 Git에 추가하지 않았다.
- Provider 오류는 `authentication_failed` 범주와 HTTP status만 기록했다.

## 12. 발견 문제와 보완

1. 기본 checkout의 `npm ci`는 실행 중인 Next SWC 바이너리 잠금으로 실패했다. 프로세스를 임의 종료하지 않고 동일 HEAD의 격리 worktree에서 재실행해 통과했다.
2. repository migration chain만으로 빈 로컬 Supabase를 초기화할 때 `public.products` 선행 relation이 없어 Lane A 격리 E2E를 구성할 수 없었다. smoke 작업에서 schema를 보정하지 않았다.
3. Provider credential은 존재 여부 확인을 통과했지만 실제 요청에서 HTTP 401로 거부됐다. key 값은 출력·변경하지 않았고 재시도하지 않았다.

필요한 보완:

- 비운영 Provider smoke용 유효 credential 확인
- Production과 분리된 local/test Supabase bootstrap 계약 확보
- 같은 호출 예산으로 Lane A 1회, Lane B 1회를 새 실행으로 재검증

## 13. 최종 PASS/FAIL

**FAIL**

- 정적 검증: PASS
- 실제 Provider smoke: FAIL
- Lane A: NOT RUN
- Lane B: authentication_failed
- image-bearing attempts: 1
- retry: 0
- 개인정보·raw payload 저장: 없음

필수 통과 기준 중 Lane A E2E, canonical schema, KO/EN projection, runtime 품질, cross-contamination 검증을 완료하지 못했다.

## 14. PR #50 병합 가능 여부

**현재 병합 불가.**

PR의 정적 구현 검증은 통과했지만, 이번 작업의 필수 외부 검증인 실제 Provider smoke가 실패했다. PR은 Draft로 전환하고 Provider 인증 및 격리 Lane A 환경을 해결한 뒤 제한된 호출 예산으로 재검증해야 한다.

## 15. 남은 리스크

- 실제 Provider가 canonical JSON을 truncation 없이 반환하는지 미확인
- 실제 token 사용량과 성공 latency 미확인
- `/api/analyze`가 실제 한 번의 image attempt로 Skin과 Face Lab을 함께 반환하는지 미확인
- anonymous write-grant 호환성 runtime 미확인
- 동일 canonical bundle의 KO/EN projection 무호출 재사용 미확인
- 실제 Skin/Face 품질과 cross-contamination 미확인
- 로컬 bootstrap과 production migration 기준 간 불일치 원인 미진단
