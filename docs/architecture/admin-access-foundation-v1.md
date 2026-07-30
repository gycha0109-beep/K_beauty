# Bejewely Admin Access Foundation v1

## 1. 목적

비주얼리 어드민의 첫 단계는 대시보드나 제품 검수 화면이 아니라 다음 보안 기반을 만드는 것이다.

```text
로그인 확인
→ 관리자 멤버십 확인
→ capability 확인
→ 허용된 작업만 실행
→ 변경 작업 감사 기록
```

이번 단계는 관리자 UI 전체를 구현하지 않는다. `/admin` 최소 진입 화면과 이후 작업이 재사용할 권한·감사 계약만 만든다.

## 2. 현재 기준

- Framework: Next.js 15 App Router
- Auth: Supabase Auth cookie session
- Route pre-check: `middleware.js` + `lib/supabase/middleware.js`
- Final user-data authorization: Supabase RLS
- Server privileged client: `lib/supabase-admin.js`
- `profiles`는 사용자가 자신의 행을 갱신할 수 있으므로 관리자 역할 저장소로 사용하지 않는다.
- Premium의 `admin_override`는 Premium 접근 호환 계약이며 어드민 권한으로 사용하지 않는다.

## 3. 권한 모델

### 역할

| 역할 | 책임 |
| --- | --- |
| `admin_viewer` | 운영 현황과 읽기 전용 데이터 조회 |
| `admin_operator` | 제품 검수와 일반 운영 조치 |
| `admin_privacy` | 동의·철회·삭제 등 개인정보 운영 |
| `admin_owner` | 모든 관리자 capability와 역할 관리 |

### capability

```text
admin.dashboard.read
admin.products.read
admin.products.review
admin.analysis.read
admin.operations.execute
admin.privacy.read
admin.privacy.execute
admin.audit.read
admin.roles.manage
```

애플리케이션은 역할 문자열을 화면마다 직접 비교하지 않고 capability helper를 사용한다. DB 변경 함수도 같은 capability 이름을 최종 권한 경계로 사용한다.

## 4. 데이터 모델

### `admin_memberships`

관리자 역할의 authoritative source다.

- `user_id`: `auth.users(id)`와 1:1
- `role`: 허용된 네 역할 중 하나
- `is_active`: 즉시 비활성화 가능
- `granted_by`: 역할을 부여한 관리자
- `granted_at`, `updated_at`

브라우저 역할은 자신의 활성 멤버십만 읽을 수 있다. 직접 INSERT·UPDATE·DELETE는 허용하지 않는다.

### `admin_audit_logs`

관리자 변경 작업의 append-only 기록이다.

- actor와 당시 역할
- action, target type, target id
- 변경 전·후 JSON
- 필수 사유
- idempotency용 request id
- 제한된 metadata
- 생성 시각

브라우저 직접 쓰기는 금지한다. 활성 관리자만 검증된 DB 함수를 통해 기록할 수 있다. 감사 로그 조회는 `admin_owner`만 허용한다.

## 5. 접근 경계

```text
Middleware
→ 로그인 세션 존재 여부만 확인

/admin Server Layout
→ account user 확인
→ admin_memberships 활성 행 확인
→ admin.dashboard.read capability 확인

향후 Server Action / Route Handler
→ 작업별 capability 재검증

Postgres RLS / security-definer function
→ 데이터 접근과 변경의 최종 차단
```

Middleware에서 DB 멤버십 조회를 수행하지 않는다. 일반 사용자 또는 익명 사용자가 `/admin`에 접근해도 서버 레이아웃에서 fail-closed 처리한다.

## 6. 최초 owner 부여

이 migration은 이메일이나 UUID를 하드코딩하지 않는다.

최초 `admin_owner`는 service-role만 실행할 수 있는 단회 bootstrap 함수로 부여한다. 활성 관리자 행이 이미 존재하면 bootstrap은 실패해야 한다. 이후 역할 관리 UI는 별도 단계에서 구현한다.

## 7. 감사 불변식

- 사유가 없거나 너무 짧으면 기록하지 않는다.
- actor는 현재 Supabase 세션의 `auth.uid()`로 고정한다.
- actor role은 DB의 활성 멤버십에서 다시 읽는다.
- token, cookie, secret, 원본 얼굴 이미지, base64 image를 metadata에 저장하지 않는다.
- 같은 actor/request/action/target 조합의 중복 기록을 막는다.
- 감사 기록 실패 시 향후 고위험 변경 작업은 성공 처리하지 않는다.

## 8. 이번 단계 범위

### 구현

- `admin_memberships`
- `admin_audit_logs`
- DB role/capability helper
- service-role first-owner bootstrap
- 감사 이벤트 기록 함수
- 애플리케이션 capability registry
- 현재 사용자 관리자 접근 resolver
- `/admin` 로그인 pre-check
- `/admin` 서버 권한 재검증
- 최소 관리자 홈
- 정적 계약 verifier
- CI 검증

### 비대상

- 제품 후보 목록·승격
- 사용자·리포트 조회
- 개인정보 삭제 실행
- 관리자 역할 관리 UI
- 실제 운영 KPI
- Face Lab·Skin Match 분석 화면
- 결제·Premium 권한 변경
- hosted Supabase mutation
- Production 배포

## 9. 완료 조건

- 비로그인·익명·일반 로그인 사용자는 `/admin`을 사용할 수 없다.
- Premium `admin_override`만 가진 사용자는 관리자로 인정되지 않는다.
- 활성 멤버십과 capability가 있는 사용자만 관리자 홈을 볼 수 있다.
- 브라우저에서 멤버십·감사 로그를 직접 변경할 수 없다.
- 최초 owner bootstrap은 service-role만 실행할 수 있고 두 번째 bootstrap은 거절된다.
- 감사 함수는 비관리자를 거절하고 사유·request id를 강제한다.
- 관리자 helper는 raw Supabase 오류나 개인정보를 클라이언트에 노출하지 않는다.
- migration replay, 정적 verifier, architecture guard, production build가 통과한다.
