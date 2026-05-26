# AGENTS.md

## 0. 기본 원칙

작업 전 요청을 다음 유형 중 하나로 분류한다.

- 실행형
- 진단형
- 설계형
- 리뷰형
- 복구형

분류 기준은 `.codex/AI_ROUTER.md`를 따른다.

---

## 1. Core Rules

- 요청과 직접 관련된 파일만 확인하거나 수정한다.
- 요청 없는 대규모 리팩토링은 하지 않는다.
- 기존 핵심 플로우와 데이터 호환성을 깨뜨리지 않는다.
- 불확실하면 구현하지 말고 원인, 선택지, 리스크를 보고한다.
- 검증하지 않은 내용을 성공으로 보고하지 않는다.
- 작업 완료 후 변경 파일, 검증 결과, 남은 리스크만 간결하게 보고한다.

---

## 2. Git / Branch

- 브랜치/집·학원 PC 동기화/로컬 데이터/Hwahae 파이프라인 기준은 `.codex/PROJECT_SYNC_RULES.md`를 우선 참조한다.
- 기존 변경사항은 임의로 덮어쓰거나 되돌리지 않는다.
- 현재 브랜치가 작업 목적과 맞지 않으면 작업을 시작하지 말고 보고한다.
- 작업 완료 후 현재 브랜치와 변경 파일 목록을 보고한다.

---

## 3. Protected Areas

사용자 승인 없이 아래 영역을 직접 수정하지 않는다.

- `.env*`
- 인증 / 권한 / 리다이렉트
- DB schema / migration / policy
- 결제 / 개인정보 / production data
- API response field names
- 저장 데이터 구조
- 배포 설정
- 패키지 대규모 변경

필요해 보이면 수정하지 말고 제안만 한다.

---

## 4. Risk Levels

- Low: 문구, 아이콘, 작은 스타일, 단순 문서 수정 → 실행형 가능
- Medium: 컴포넌트 구조, 레이아웃, 결과 생성 로직, 여러 파일 수정 → 실행형 가능, 검증 필수
- High: API, DB query, 저장 로직, 인증, 환경 변수, 외부 연동 → 먼저 진단형, 명확한 지시가 있을 때만 제한 실행
- Critical: 결제, 개인정보, production DB, 권한 정책, 배포 설정 → 중단 후 보고

---

## 5. Context

필요 시 `.codex/AI_CONTEXT.md`를 확인한다.

- Active: 현재 작업에 반영할 최신 기준
- Bridge: 참고 기준
- Candidates: 검토 후보
- Deactivated: 되살리지 않을 방향

Deactivated 내용을 현재 기준으로 되살리지 않는다.

---

## 6. 문서 로드 정책

작업 전 모든 문서를 무조건 읽지 않는다.

기본 참조:

- `AGENTS.md`
- `.codex/AI_ROUTER.md`
- `.codex/AI_CONTEXT.md`

조건부 참조:

- 검증 필요: `.codex/AI_REVIEW_CHECKLIST.md`
- Medium 이상 작업 또는 문제 발생: `.codex/AI_WORK_LOG.md`

원칙:

- 라우팅 판단 후 필요한 문서만 추가 확인한다.
- 상세 로그는 매번 읽지 않는다.
- 오래된 로그보다 `AI_CONTEXT.md`의 Active 기준을 우선한다.

---

## 7. Validation

작업 후 필요한 범위에서 `.codex/AI_REVIEW_CHECKLIST.md`를 기준으로 검증한다.

기본 기준:

- 빌드 / 테스트 / 실행 확인
- 핵심 플로우 유지
- 주요 사용자 액션 유지
- 런타임 에러 없음
- Protected Areas 침범 없음
- 작업 목표 달성

검증하지 못한 항목은 성공으로 보고하지 않는다.

---

## 8. Stop Conditions

아래 상황이면 임의로 계속 수정하지 말고 원인과 복구 후보를 보고한다.

- 빌드 / 테스트 / 실행 실패
- 핵심 플로우 실패
- 기존 응답 / 데이터 호환성 깨짐
- Protected Areas 영향 발생
- 수정 범위가 예상보다 커짐
- 원인 파악 없이 파일을 계속 수정해야 함

---

## 9. Work Log

Medium 이상 작업 또는 문제가 발생한 작업은 `.codex/AI_WORK_LOG.md`에 남긴다.

기록 형식은 `.codex/AI_WORK_LOG.md`를 따른다.

작업 후 `AI_WORK_LOG.md`의 규칙 승격 후보 중 현재 작업에 계속 적용할 기준이 있으면, `.codex/AI_CONTEXT.md`의 Active / Bridge / Candidates / Deactivated 중 어디에 넣을지 제안한다.

단, 사용자 승인 없이 `AI_CONTEXT.md`를 직접 수정하지 않는다.

---

## 10. Feedback Handling

- 비유적 피드백은 문제 탐지용으로 해석한다.
- 실제 수정은 structure / hierarchy / spacing / contrast / state / feedback / accessibility 단위로 수행한다.
- 화면이나 결과물 품질 판단은 가능한 경우 실제 출력물 기준으로 한다.
