# Face Lab V2 / P1-D2C5 — 실제 상품 저장·권한·공개 조회 설치 전 사전 설계 v1

- 기준일: 2026-10-09
- 기준 저장소: `gycha0109-beep/K_beauty`, 시작 본선 `2718e7c3419ef4602177e29e5396c468d6849551`
- 작업 분류: **설계**. 대상은 운영 Supabase DB·인증/권한·Storage·관리 API에 향후 영향을 주므로 고위험 보호 영역으로 분류한다.
- 이번 수행: 저장소 코드와 이전 승인 문서 기반의 정적 조사 및 **설치 전 상세 계약** 작성.
- 이번 비수행: hosted/production 연결, SQL 실행, 마이그레이션·RLS·GRANT·역할·Storage·인증·API·배포·결제·실상품 수정, 외부 이미지 모델 호출 모두 **0**.
- 설계 상태: 본 문서의 테이블·역할·함수 이름은 설치된 객체/승인된 권한이 아니라 **제안안**. 배포 동등성 증거와 실제 권한 승인 없이는 실행하지 않는다.

## 0. 핵심 의사결정과 진행 경계

**이번 4나의 결정:** 새 스킨케어 공용 상품/분류에 연결하지 않고, 비공개 Face Lab 상품 저장 영역에 **불변 자료 버전 + 승인 사건 + 현재 공개 포인터 + 철회 세대**를 둔다. 브라우저와 일반 Supabase 인증 역할에 내부 원문/수정 권한을 제공하지 않는다.

다음 단계는 운영 설치가 아니다. 먼저 아래 네 가지 산출물을 확정한다.

1. **실제 환경 동등성 조사**: 저장소의 배포 경로와 Supabase 프로젝트, Data API 노출 스키마, 관리자 권한/비공개 Storage의 읽기 전용 증거를 확보한다.
2. **스키마·조회 거래·권한 상세 명세**: 설치할 자료 구조, 고유 제약, 최소권한 역할, 원자적 승인 및 철회, 서버 조회 결과를 확정한다.
3. **비운영 검증 준비**: 격리된 시험 DB에서 재현 가능한 설치/롤백 및 실제 SQL 권한·경합 시험 시나리오를 작성한다.
4. **배포 변경 게이트**: 사용자 별도 명시 승인을 받은 후에만 migration/RLS/Storage/인증/API를 단계적으로 적용한다.

실제 DB를 수정하지 않고 구현 가능한 부분(모의 계약·테스트)은 #1196에서 선행 완료했다.

## 1. 현 저장소 계약·재사용 범위

| 기존 근거 | 실제 책임 | 4나에서의 취급 |
| --- | --- | --- |
| `independent-execution-candidate.js` (#1183) | item/variant/slot/evidence 형식 검사 | 실행 대상과 종류/옵션 계약 재사용. **실제 출처 검증 아님** |
| `independent-look-preview-bridge.js` (#1184) | 증거 형식과 참고 이미지 목록에서 비실행 합성 지시서 생성 | `dry_run` 유지. 실행 가능 객체 반환 금지 |
| `independent-catalog-review-state.js` (#1190) | 순수 상태 전이, 내용 지문, 리뷰 개정번호/철회 세대 | 정책 계산 재사용; 역할 문자열을 실제 권한으로 해석 금지 |
| `independent-catalog-publication-gate.js` (#1190) | 각 자료의 심사 기록과 내용 지문 비교 | 오프라인 자체 정합성만 확인. 클라이언트 제공 `reviewRecords` 사용 금지 |
| `independent-catalog-published-read-core.js` (#1196) | 주입된 `source.readSnapshot/verifySnapshot`으로 사전/사후 재확인 | **모의 공급자 API**. 신뢰 원천이 자체 보장되지 않으므로 생산 인증 경계로 직접 사용 금지 |
| `scripts/fixtures/face-lab-independent-catalog-memory-store.mjs` (#1196) | 모의 head/review/epoch 비교, 기대 개정번호, 중복 요청 | 시험용 비교 대조군. DB 트랜잭션/역할/RLS 보증 아님 |
| `lib/supabase/server.js`, `lib/supabase/server-client.js` | 쿠키/액세스 토큰 기반 `auth.getUser()` 인증 경로 | 기존 사용자를 검증할 기반이지만 DB 자료 읽기 권한과 동일하지 않음 |
| `lib/admin/access.js`, `lib/admin/capabilities.js` | `admin_memberships`, `admin_viewer/operator/privacy/owner`, 기존 상품 검토 권한 | 회원·접근 모델을 재사용하되 `admin.products.review`를 Face Lab publish/revoke에 자동 상속 금지 |
| `lib/server/face-lab-catalog-product-try-on-reader.js` | 아직 기존 `products` 기반 조회, 승인 공급자 없으면 거부 | 건드리지 않고 새로운 Face Lab 전용 서버 경계 사용 |
| 관리자 감사 관련 기존 migration | `admin_audit_logs` 및 민감 값 차단·함수 권한 이력 | 행위 감사 재사용 **후보**. Face Lab 승인 사건 원장의 대체물이 아님 |

**관측 제한:** 저장소에 보이는 권한·테이블 선언이 현재 배포 DB의 설치/접속 정책을 보증하지 않는다. 과거 읽기 전용 연구에서 호스팅 프로젝트가 진짜 배포 환경과 같은지 확인되지 않았다.

## 2. 설치 전 감사: 실제 DB/환경을 먼저 식별

사용자 별도 허가를 받은 **읽기 전용 감사 작업**에서 아래 항목을 검증한다. 이 문서 작성 자체에서는 실행하지 않는다.

| 점검 영역 | 필요한 확인 증거 | 차단 조건 |
| --- | --- | --- |
| 배포 연결 동등성 | 현재 배포 앱·프로젝트 식별자 비교 결과(비밀 제외), 대상 DB 및 이력 버전 | 프로젝트 불명확, staging/prod 혼동 |
| PostgreSQL 상태 | 서버 버전, 대상 스키마/객체 목록, migration 상태, 확장 및 현재 기본 권한 | 예상과 다른 migration/충돌 객체 |
| Data API | 노출 스키마 목록, 각 역할의 GRANT, 함수 기본 EXECUTE, 적용 중인 노출 정책 | 비공개 스키마 노출 또는 원치 않는 기본 GRANT |
| RLS | 모든 유관 테이블의 ENABLE/FORCE 상태, 직접 읽기/쓰기 RLS, 보안 권한 상승 함수 | 역할 시뮬레이션 불가, deny를 증명할 수 없음 |
| 기존 관리자 | 활성 회원/권한 판정 함수·감사 경로의 실제 설치 상태 | `admin.products.review`가 Face Lab 권한으로 오인 |
| Storage | 새 비공개 참고 이미지 버킷 도입 여부, 기존 버킷 접근/서명 URL·캐시 정책 | 원본 이미지 및 얼굴 사진 권한/저장 영역 혼동 |
| 런타임 실행 | 읽기 전용 DB 접근을 서버에서 수행할 수 있는 배포/연결 방식 | 브라우저로 DB 자격증명·서명 파일 경로 노출 |

실사 기록은 프로젝트 식별용 **비밀 아닌 결과/객체명/권한 집계만** 남기고 JWT, service key, DB URL, 얼굴 사진, 원본 이미지는 출력·반출하지 않는다. 감사 실행에는 별도 인증·승인이 필요하다.

### 2.1 2026년 Supabase Data API 변경 주의

Supabase 공식 2026-04-28 보안 변경 공지에 따르면 **신규 프로젝트는 2026-05-30부터 새 `public` 테이블을 Data API에 자동 노출하지 않는 설정이 기본**이며, **기존 프로젝트에는 2026-10-30부터 강제 적용** 예정이다. 이 변경은 테이블 GRANT와 RLS를 별도 관리한다.

- 공개/비공개 노출 여부를 **현재 기본값으로 추측하지 않는다**.
- 내부 Face Lab 전용 테이블은 기본 비공개, `anon`/`authenticated` 무권한을 의도적으로 테스트한다.
- 만일 향후 공개 API/투영이 필요해도 필요한 최소 객체에만 명시적 권한을 부여하며, 권한 오류를 광범위 GRANT로 해결하지 않는다.
- 현행 DB의 보안 상태는 해당 공지만으로 알 수 없다.

근거: https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically , https://supabase.com/docs/guides/api/securing-your-api

## 3. 권장 논리 저장 모델: 불변 버전과 가변 포인터 분리

사용자 요구를 충족하는 최소 책임을 아래 **9종 개념 자료**에 매핑한다. 하나의 논리 자료가 반드시 한 테이블이어야 한다는 의미는 아니다. 실제 물리 DDL은 다음 세부 리뷰에서 확정.

| 자료 후보 이름 | 의미/대표 필드 | 핵심 제약 |
| --- | --- | --- |
| `face_lab_items` | `item_id`, kind, execution_type, canonical identity, lifecycle | ID 불변/재사용 금지, 스킨케어 상품 FK 필수 아님 |
| `face_lab_variants` | `item_id`, `variant_id`, 실제 호수·색/모델 식별 근거 | (`item_id`, `variant_id`) 유일, 교차 연결 금지 |
| `face_lab_source_versions` | `scope`(item/variant/shade/capability/asset), `target_ref`, `content_revision`, `source_digest`, 버전 고정 payload | (`scope`, `target_ref`, `content_revision`) 유일; 배포 후 불변; 값/지문 일치 |
| `face_lab_evidence` | 출처 종류·원본 참조·주장 범위·검토/관찰일·권리 만료·증거 지문 | 변경은 새 버전; 증거 문자열은 승인 자체가 아님 |
| `face_lab_reference_assets` | `asset_id`, candidate/slot/role, 비공개 객체 key, MIME/size/SHA-256, license_scope, expiry | 파일 교체 시 새 객체/검수; 이종 상품/부위 이미지 재사용 차단 |
| `face_lab_review_heads` | `scope`, `target_ref`, 현재 심사 상태·개정번호·자료 버전·철회 세대 | 같은 심사 대상에 현재 head 1개. 기대 revision으로 CAS |
| `face_lab_review_events` | 사건 ID, review target, verified actor, action/reason, 전후 상태, request_id, occurred_at | 사건 append-only; 변경/삭제 불가; 중복 요청 재적용 금지 |
| `face_lab_publication_versions` | `publication_id`, version, 선택 대상별 승인 source-version/asset 참조 집합·지문 | 불변 공개 묶음. 혼합 버전·미승인 근거 금지 |
| `face_lab_publication_heads` | 선택 대상 키, current publication id/version, head revision, 현재 철회 세대/상태 | 동일 선택 키에 head 1개; 철회·갱신 atomic |

**최소 인덱스/제약 대상:** 각 ID의 unique, 버전 복합 유일, `review_heads(scope,target_ref)` unique, `publication_heads(selection_key)` unique, 감사 사건의 `request_id+actor+target` 고유성, 공개 대상 선택/부위 조회 인덱스. 실제 인덱스 정의·키의 DB 타입·무결성 제약은 데이터 증가량 및 스키마 리뷰에서 확정한다.

### 3.1 중복 정체성 방지와 속성 출처

- `faceLabItemId` / `faceLabVariantId`는 자체 발급하며 변경하지 않는다.
- 브랜드 상품의 표시명·색상명이 같아도 무단 병합하지 않는다. 외부 SKU/판매처 링크는 **증거 또는 선택적 대응표**다.
- 컬러 계열/발색/피니시 등 가상 체험에 영향 주는 속성은 개별 실제 옵션의 `source_versions` 버전과 출처 증거에 묶는다.
- `capability`는 해당 선택 후보·Face Lab Appearance Slot별로 승인하며 상품 종류만으로 자동 승인하지 않는다.
- `service`·`color_palette`는 기본 guidance-only. 실제 이미지 상품으로 임의 변환하지 않는다.
- 사용자 얼굴 사진·추구미·분석 결과·생성 이미지는 상품 관리 자료에 저장하지 않는다.

### 3.2 공개 묶음의 완결 조건

공개본은 서버가 읽은 증거로 다음 모두 충족해야 한다.

1. 각 선택 대상의 item/variant/shade/capability/asset 중 필요한 자료 범위가 빠짐없이 존재.
2. 자료 source digest와 실제 승인 심사 revision 및 published content revision이 일치.
3. 파일 사용 허가 목적/범위/유효 기간이 현재 요청과 맞고 현재 철회되지 않음.
4. 참조 파일의 실제 객체 ID·candidateRef·slotKey·role이 일치.
5. 구성 자료/승인 사건을 하나의 **불변 공개 버전**으로 고정하고, head를 그 버전으로 원자적으로 교체.
6. head 교체 성공 전에는 새 버전을 '공개됨'으로 반환하지 않는다.

## 4. 최소권한 권고와 실제 인증 경계

### 4.1 권장 기본 접근 모델

**우선 제안:** Face Lab 자료를 별도 비공개 스키마에 두고, 브라우저에서 접근 불가능한 **서버 전용 최소권한 읽기/쓰기 경계**로만 접근한다. 스키마를 Data API에 노출하지 않는다.

- **읽기 역할**: 현재 공개된 최소 투영에 필요한 SELECT만. 원본 검수 자료/권한 관리/쓰기/삭제 불가.
- **관리자 업무 역할**: 서버에서 신원·업무 권한 확인 후 제한된 심사·공개·철회 거래만 허용. 임의 테이블 UPDATE/DELETE 불가.
- **사용자/브라우저**: `anon`/`authenticated`의 비공개 테이블 직접 SELECT/INSERT/UPDATE/DELETE 기본 거부.
- **실제 DB 연결 방식**: 별도 좁은 DB 접속 역할(A)을 우선 비교. 현재 앱의 Supabase SDK/인증 흐름 때문에 어렵다면, 호출자 검사·권한·실행 맥락이 한정된 내부 서버/RPC(B) 대안을 별도 심사. **현재 어느 것도 설치됐다고 주장하지 않는다**.
- 신규 API/뷰/함수 도입 시 `SECURITY DEFINER` 및 기본 `PUBLIC EXECUTE` 노출 위험을 독립적으로 감사. 단순 SQL 권한 에러를 해결하기 위해 `service_role`이나 기존 Recommendation 함수 사용 금지.

### 4.2 현재 관리자와 신규 업무 권한 매핑

현재 소스 `admin_memberships`의 역할은 `admin_viewer`, `admin_operator`, `admin_privacy`, `admin_owner`이며, `ADMIN_CAPABILITIES`에는 `admin.products.review`가 있다. **Face Lab 고유 권한은 현재 정의되지 않음.**

제안 업무 권한:
- `face_lab.catalog.read`: 내부 상품 목록/심사 상태 확인
- `face_lab.catalog.create`: 초안/수정/심사 요청
- `face_lab.catalog.review`: 근거 확인, 승인/반려
- `face_lab.catalog.publish`: 공개본 작성 및 포인터 갱신
- `face_lab.catalog.revoke`: 철회/중지

이 권한은 사용자 로그인 상태, 활성 관리자 회원 여부, **별도의 승인된 매핑 기록**을 서버에서 매번 확인한다. `admin_operator`/기존 상품 검수 권한에 묵시적으로 자동 부여하지 않는다. 1인 운영 시 동일 관리자가 둘 이상의 권한을 가질 수는 있으나 자기 승인/긴급 철회는 정책으로 명시하며 **행위·근거·사건은 별도 기록**한다.

실제 쓰기 요청에서는 CSRF/Origin, 재인증 필요성, idempotency key, 권한 회수 후 stale JWT, 감사 민감정보 차단도 검증한다. 이용자가 제출한 actorRole/approvalState를 신뢰하지 않는다.

## 5. 승인·공개·철회는 단일 DB 거래

### 5.1 제안 상태 전이

```text
draft -> in_review -> approved -> published
             |             |            |
          rejected       revise     suspend/revoke
             |             |            |
           revise        draft       re-review
```

현재 `transitionFaceLabCatalogReview()`의 규칙을 핵심 정책으로 재사용하되, 실제 실행에는 아래 원자성 보장이 추가되어야 한다.

1. 서버 신원/특수 기능 권한을 확인하고 `request_id`, target, expected_revision, action, 이유, 증거 범위를 검사.
2. 거래 시작. 대상 review head와 관련 publication head/권리 상태를 잠금 또는 조건부 비교-갱신.
3. 같은 요청 ID가 이전에 처리됐는지 확인. 동일 요청이면 이전 결과, 다른 payload면 충돌.
4. 기존 버전/권한/실제 근거 확인. 내용 지문은 신뢰된 DB payload에서 계산하여 비교.
5. 새 review head, append-only 사건, 공개본 버전 및 head 갱신/철회 세대를 **한 거래로 확정**.
6. 일부라도 실패하면 전체 ROLLBACK. 감사 이벤트만 남고 권한 상태가 바뀌지 않는 불일치 금지.
7. 성공 후 변경 결과를 최소 필드로 반환. 권한 오류는 내부 정보 과다 노출 금지.

읽기용 캐시는 상품명/이미지 표시만을 위한 비권위 자료다. **실행 가능 여부, 재생성, 신규 결과 저장/보내기는 최신 상태 조회가 필수**다.

### 5.2 철회 기준과 경합 한계

- 상품/옵션/부위/참고 이미지 중 하나가 철회/권리 만료되면 해당 의존성을 가진 모든 공개본은 신규 사용 불가.
- `revocation_epoch`는 단조 증가. 수정·일시중지·철회 뒤 다시 공개하더라도 과거 세대값 재사용 금지.
- 공개본과 current head/review epoch를 조회하는 **동일한 트랜잭션 스냅샷**을 확보하고, 읽기 완료 후 생성/외부 실행 직전에 현재 상태를 다시 확인.
- 현재 #1196의 `readSnapshot()/verifySnapshot()` 연속 호출은 **모의 검증**이고 실제 DB에서 두 별도 SELECT가 영구적인 원자적 권한을 만드는 것은 아니다. 실제 구현에서 DB 거래 경계와 마지막 '사용 승인' 지점을 명시해야 한다.
- 철회 확정 후 시작되는 **새 조회·새 실행 요청**을 거부하는 것이 기본 보장. 철회 전에 이미 외부 모델로 전송된 작업까지 취소한다고 보장하지 않는다. 추후 결과 공개 금지/취소 지원/비용 정책 분리.
- 데이터 장애/시간 만료 판정 실패/철회 상태 누락/권한 DB 단절 시 무조건 fail-closed.

## 6. 읽기 서비스 계약 — 기존 오프라인 모형과 호환

### 6.1 외부 입력

```text
readPublishedFaceLabSelection({
  faceLabItemId,
  faceLabVariantId?,   // 실물 상품에서는 필수
  slotKey
})
```

클라이언트는 ID와 적용 부위만 제출한다. server-side session/plan/userContext는 **검증된 서버에서만** 획득한다. 사용자가 `reviewRecords`, `sourceDigest`, `storageKey`, `approved`, 원본/참고 이미지 URL, 검수자 역할을 공급할 수 없어야 한다.

### 6.2 서버 내부 순서

1. 실제 세션 인증/기능 허용/사용량을 검사.
2. 입력 유효성/요청 제한. 범위 밖 상품·옵션·Slot은 차단.
3. 비공개 DB 역할/트랜잭션으로 **해당 사용자가 선택한 item/variant/slot의 공개본만** 조회.
4. 해당 공개본의 의존 source version과 심사/철회 head 일치 여부를 한 거래에서 검사. 각각의 DB 조회를 따로 수행하면서 맞을 것으로 가정하지 않는다.
5. 조립한 서버 자료만 기존 `validateFaceLabIndependentExecutionCandidate()`, `composeFaceLabReviewedLookDryRun()`에 전달.
6. 비공개 이미지의 소유/용도/권리 만료 메타 확인. 이미지 실제 바이트 확인은 별도 서버 비공개 로더 책임.
7. 결과에는 최소 상품 표시/선택 상태만 노출. 증거 원문, 감사 사건, 내부 저장 경로, 비밀 값을 반환하지 않는다.
8. 무료 `dry_run` 단계에서는 반드시 `authority=null`, `renderReady=false`, `providerRequest=null`.

**주의:** 기존 mock-only 코어의 주입 `source`는 브라우저로부터 받는 운영 API 인수가 될 수 없다. 운영 어댑터는 `server-only` 모듈 내부의 고정된 신뢰 자료 공급자로 구현하고, 브라우저가 함수/조회 결과/권한 객체를 주입하지 못하게 해야 한다.

### 6.3 결과 형태

- 내부: `available`(현 공개본 확인), `guidance_only`, `not_ready`, `unavailable`.
- 외부: 화면 표시용 최소 필드와 요청 가능/불가 정보. 사용자에게 공개본 이력 원문/DB 에러 내부 사유를 주지 않는다.
- `available`은 서버가 자료를 읽을 수 있다는 뜻이지 **이미지 생성권이나 외부 이미지 처리 권한**이 아니다.
- 무료/안전 테스트는 기존 `dry_run` + 모든 provider 비실행 필드를 그대로 유지한다.

## 7. 비공개 참고 이미지: 상품 승인과 별개 검증

- 상품 사실 출처와 이미지 이용 허가/적용 목적은 별개로 심사한다.
- 브랜드 공식 사이트에 이미지가 존재하는 사실은 유료 이미지 편집/모델 입력에 대한 라이선스 승인이 아니다.
- 비공개 Storage 버킷은 사용자 얼굴 원본/분석 결과 저장 공간과 분리. 상품 reference도 signed URL을 사용자에게 장기 제공하지 않는다.
- 이미지를 새 버전으로 등록할 때 Storage API로 별도 immutable object key에 업로드한 후 서버 측에서 파일 MIME/길이/바이트 SHA-256를 확인하고 해당 자료 버전과 결속.
- 참고 이미지의 `assetRef`·role·slot·candidateRef와 검수 증거/만료/철회 세대 일치 확인. 외부 URL만 있는 경우 이미지 적용을 열지 않는다.
- 실제 모델 요청 직전 서버가 원본 바이트를 읽어 재검증. Storage 객체의 `storage` 스키마에 SQL 직접 INSERT/DELETE 금지.
- 서명 URL/브라우저 캐시가 이미 외부로 전달된 뒤에는 철회 즉시 물리적 접근 불능을 보장하지 않으므로, 신규 생성 입력을 서버 측 권한검증 경계로 제한.

## 8. 설치·권한 검증·되돌리기 계획

### 8.1 4나에서 준비할 산출물(운영 변경 없음)

- 설치 대상 프로젝트 식별·배포 동등성 및 기존 마이그레이션 충돌 확인 결과.
- 물리 DDL/제약/인덱스/데이터 보존·삭제 기준 최종 리뷰.
- 최소권한 읽기 역할, 관리자 한정 심사/공개/철회 역할 및 SQL GRANT/RLS 매트릭스.
- SSR/DB 연결 모델(A vs B), 서버 권한·오류 매핑 및 감사 경계 설명.
- 실제 이미지 버킷·정책/원본 검증·권리 만료 자료 관리 명세.
- 격리 DB 설치 및 롤백 방법, 중복 요청/철회 경합·권한 우회·기존 추천 회귀 검증 계획.

### 8.2 시험 DB에 먼저 설치할 때의 게이트

- 실제 운영 DB가 아니라 **명시된 격리 테스트 대상**에서만 마이그레이션 리허설.
- `anon`/`authenticated`로 내부 테이블/뷰/RPC 조회·수정 시 **거부되는지** 직접 증명.
- 관리자 역할별 허용/거부, 데이터 범위/권한 회수 시점, SQL 오류 노출/감사 사건을 시험.
- 두 독립 DB 연결에서 CAS/잠금 경합·즉시 철회 판정·중복 요청/ROLLBACK을 확인.
- 리뷰 레코드를 위조하거나 오래된 공개본을 주입해도 서버의 최신 DB 원천에서 거부 확인.
- 비공개 Storage 버킷·만료/철회 권리·실제 이미지 SHA 불일치·원본 접근 제한 시험.
- 예상 결과 및 실패 원인 기록. 하나라도 실패하면 배포 변경 승인 중단.

### 8.3 운영 배포 시 예상되는 롤백

1. Feature flag로 **Face Lab 실상품 조회/신규 생성만** 안전 중지. 얼굴 분석·스타일 탐색 등 비상품 기능 유지.
2. 새 서버 조회 경계 비활성화 후, 최종 승인된 기존 모의 `dry_run` 동작 또는 사용 불가 메시지로 제한.
3. DB 권한 정책/객체 롤백은 현재 실제 배포 객체·의존성/데이터 여부를 재확인 후 **별도 승인된 되돌리기 SQL**로만 처리. 보호 테이블 무단 DROP 금지.
4. 이미 철회된 상품·이미지를 백업 복원으로 다시 허용하지 않도록 current revocation/rights를 재확인.
5. 자동/수동 회귀에서 기존 스킨케어 추천·기존 Face Lab 분석/추구미·관리자 기능이 정상인지 점검.

## 9. 승인·검증 체크리스트

| 검증 차원 | 필수 PASS |
| --- | --- |
| 정체성 | 동일 상품/옵션 ID 재사용·교차 연결 불가 |
| 버전 | item/variant/shade/capability/asset 최신 발행 자료와 심사 content digest 일치 |
| 권한 | 사용자/비승인 관리자/폐기된 세션의 모든 보호 쓰기 및 내부 읽기 차단 |
| 공개 | 공개본 생성과 head 변경 원자적 처리, 미완성/혼합 버전 거부 |
| 동시성 | 예상 개정번호 불일치/중복 request_id/동시 철회와 공개에서 안전 판정 |
| 철회 | 철회된 항목 의존 공개본의 새 선택·재실행·이미지 생성 진입 차단 |
| Storage | 원본 권리·목적·객체 SHA256·MIME·용량·만료 검사 통과 |
| 정보 누출 | 증거 원문·DB 권한·감사 로그·파일 경로·JWT/키·얼굴 사진 누출 없음 |
| 격리 | 기존 스킨케어 Product Fact/분류/RLS/추천 점수와 독립 |
| 비용 | 실제 모델·결제 호출 0회, 비용 발생 경로 비활성 |
| 복원 | 롤백 이후에도 최신 철회 상태 유지 및 기존 UI/로그인·루틴 비영향 |

**이 표는 향후 검증해야 할 조건이며, 현 시점에 PASS라고 선언하는 항목이 아니다.**

## 10. 다음 작업 묶음과 종료 조건

| 순서 | 과업 | 환경 변경 여부 | 종료 조건 |
| --- | --- | --- | --- |
| **4나-1** | 배포 DB/권한/Storage **읽기 전용 실사** 및 프로젝트 동등성 증거 | 쓰기 없음, 조회 권한 별도 승인 | 배포 식별+권한/데이터 노출 계약 확인 |
| **4나-2** | DDL, GRANT/RLS, 권한/관리자 심사 거래, 공개 조회 프로젝션 상세 최종 명세 | 문서/정적 검증만 | 객체·제약·최소권한·동시성·롤백 리뷰 완료 |
| **4나-3** | 격리 테스트 DB 리허설 및 역할별 DB 테스트 | 시험 대상 설치만, 별도 승인 | 정상/거부/경합/철회/복구 시험 PASS |
| **4다** | 실제 호스팅 DB/Storage/관리자/서버 조회 설치 | **명시적 운영 변경 승인 필요** | 실제 권한·배포·철회·이미지 검증 완료 |
| **5** | 실물 상품·이미지 소량 승인 등록/최소 관리자 UI | 별도 콘텐츠·권리 승인 | 출처·권리 갖춘 제품만 노출 |
| **6** | 유료 이미지 편집 소규모 시험 | 별도 비용/대상/횟수 승인 | 정해진 비용과 안전 요건 내 품질 검증 |

**A — 이번 설계 완성:** 현행 코드/관리 권한 확인, 논리 스키마·거래·철회·보안·배포 단계·위험/검증 기준이 문서화됨.

**B — 실제 프로젝트 읽기 전용 감사 완료:** 배포 대상과 프로젝트 동일성·관리 권한/Storage/스키마 현황이 안전하게 확인됨. **이번 작업에서 수행하지 않음.**

**C — 실제 스키마·권한·서버 연결 운영 완료:** 격리/운영 테스트와 비공개 이미지 권리 검증 통과. **이번 작업에서 수행하지 않음.**

## 11. 관련 기준

- #1194 운영 저장·조회 경계 설계: `face-lab-v2-p1-d2c4-governed-storage-read-boundary-design-v1.md`
- #1196 실제 코드 계약: `independent-catalog-published-read-core.js`, `scripts/fixtures/face-lab-independent-catalog-memory-store.mjs`
- 공식 Data API 보안: https://supabase.com/docs/guides/api/securing-your-api
- 공식 Custom Schemas: https://supabase.com/docs/guides/api/using-custom-schemas
- 공식 RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- 공식 Storage 접근 통제: https://supabase.com/docs/guides/storage/security/access-control

**완료 뒤 다음 최우선 과업은 4나-1, 즉 실제 배포 환경 동등성 및 최소권한 읽기 전용 실사다. 실사 결과가 없으면 실물 상품 DB 설치나 광범위 권한 부여를 진행하지 않는다.**
