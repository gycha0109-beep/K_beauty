# GitHub Actions Validation Budget Policy

## 1. 목적

엄격한 검증 수준은 유지하되, 중간 커밋·문서 수정·결과 보고서 추가마다 전체 Security closeout과 Production build가 반복 실행되는 문제를 방지한다.

이 정책은 검증 항목을 줄이는 정책이 아니다. **검증 시점을 최종 HEAD로 집중하는 정책**이다.

## 2. 기본 원칙

```text
구현 중
→ 로컬 focused verifier
→ 로컬 security suite
→ 로컬 build
→ 자체 리뷰와 결함 수정
→ 결과 문서까지 완료
→ 최종 HEAD에서 GitHub Actions 1회
```

중간 커밋마다 Actions를 실행하지 않는다.

## 3. Full validation 실행 조건

`Security closeout verifiers` workflow는 PR 본문에 다음 marker가 있을 때만 실행한다.

```html
<!-- run-full-validation -->
```

실행 절차:

1. 구현과 자체 리뷰를 완료한다.
2. 검증 결과 문서와 PR 본문까지 먼저 정리한다.
3. PR 본문에 marker를 추가한다.
4. workflow 결과를 확인한다.
5. 성공 후 marker를 제거한다.

Marker 제거로 `edited` 이벤트가 발생하더라도 job 조건이 false이므로 runner는 할당되지 않는다.

## 4. 재실행 규칙

### 코드 또는 계약 결함

```text
marker 제거
→ 로컬 수정·검증
→ 결과 문서 갱신
→ marker 재추가
→ 최종 Actions 1회
```

### GitHub 또는 runner의 일시적 장애

코드 변경이 없다면 새 workflow를 만들지 않고 실패 job만 재실행한다.

### Hosted 검증

Hosted deployment 또는 외부 권한이 필요한 단계는 일반 security workflow와 분리한다.

- 로컬 payload·계약·cleanup simulation을 먼저 통과한다.
- exact-SHA Hosted run은 한 번만 실행한다.
- 실패 후 원인 확인 전 자동 retry를 금지한다.
- 진단용 workflow를 여러 종류로 병렬 생성하지 않는다.

## 5. 문서 전용 변경

다음 변경은 full security workflow를 실행하지 않는다.

- Markdown 문서
- `docs/**`
- `.codex/**`

문서 변경이 runtime 계약 또는 workflow 자체를 바꾸는 경우에는 별도 정적 검토를 수행한다. 코드 검증 결과를 변경하는 문서는 코드와 함께 최종 HEAD에 포함한 뒤 한 번만 검증한다.

## 6. Concurrency

동일 PR에서 새로운 final validation이 시작되면 이전 실행은 취소한다.

```text
cancel-in-progress = true
```

이는 빠르게 연속된 PR 수정으로 중복 runner가 동시에 소비되는 것을 방지한다.

## 7. Workflow 작성 규칙

새 기능 전용 workflow는 다음 조건을 만족해야 한다.

- 자동 `synchronize` 실행을 기본값으로 사용하지 않는다.
- 최종 marker, 명시적 dispatch, 또는 외부 조건이 필요한 단일 authoritative run만 허용한다.
- 하나의 job에서 순차 검증해 job별 분 단위 반올림 낭비를 줄인다.
- `timeout-minutes`를 실제 상한에 맞게 둔다.
- 성공 artifact는 증거상 필요한 경우만 업로드한다.
- 임시 workflow는 검증 종료 후 삭제한다.
- 결과 문서 추가를 이유로 전체 workflow를 다시 실행하지 않도록 결과 문서를 먼저 작성한다.

## 8. 브랜치 적용 범위

### `main` 기반 신규 PR

`main`에 이 정책이 반영된 뒤 생성되거나 최신 base를 반영한 PR은 공통 workflow 정책을 상속한다.

### 이미 열린 `main` 기반 PR

Workflow 파일을 자체 수정하지 않았다면 최신 `main`을 반영한 시점부터 공통 정책을 사용한다. 진행 중인 PR을 모두 즉시 수정할 필요는 없다.

### Stacked branch

과거 base branch를 대상으로 하는 stacked PR은 `main` workflow를 자동으로 상속하지 않는다. 다만 다음 경우에만 개별 반영한다.

- 해당 branch에서 추가 구현을 계속한다.
- 기존 자동 workflow가 실제로 계속 실행된다.
- branch가 이후 통합 기준으로 사용된다.

완료된 Draft branch와 보존용 branch를 일괄 수정하지 않는다.

## 9. CandidatePolicy Stage 11F 적용

Stage 11F는 다음 방식으로 진행한다.

- 개발 중 Actions 실행 0회
- Hosted 실행 기능 구현 금지
- validate-only local verifier 사용
- 코드·리뷰 수정·결과 문서 완료 후 final workflow 1회
- 실패 시 원인 수정 후 1회 재실행
- 문서만 추가한 후 별도 Production build 재실행 금지

## 10. 비대상

이 정책은 다음을 허용하지 않는다.

- 검증 항목 삭제
- security verifier 생략
- Production build 생략
- 실패를 PASS로 처리
- Hosted exact-SHA 검증 대체
- branch protection 우회

검증 강도는 유지하고 Actions 호출 횟수만 제한한다.
