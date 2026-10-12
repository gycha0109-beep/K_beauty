# Face Lab P1-D2C14 — Production 서버 연결 ref 최소 readback

## 범위

2026-10-12에 실제 Vercel Production 홈페이지 HTML이 참조한 공개 클라이언트 JS의 Supabase 호스트는 `bygrczggxfuisupcevaz.supabase.co`였습니다. 이 프로젝트는 연결된 Supabase 후보 프로젝트 ID와 일치합니다. 다만 공개 브라우저 번들만으로 서버의 실제 런타임 변수 또는 DB 접속 성공을 확정할 수 없었으므로 **Production DB migration 승인과 운영 객체 변경은 HOLD**입니다.

이번 단계는 Admin owner가 별도 승인 후 호출 가능한 서버 전용 수동 진단만 추가합니다. 자동 실행·크론·배포 후 호출 없음.

## 구현

- `GET /api/admin/face-lab/production-identity`: 인증된 일반 계정의 admin owner에게만 주어지는 `admin.audit.read` capability 검사. 비인가 401/403. 모든 캐시 금지.
- `VERCEL_ENV=production`이 아니면 409, DB HEAD 호출 0회.
- 서버 전용 `getSupabaseAdminConfig().supabaseUrl`이 엄격히 `https://<20자 ref>.supabase.co` 형식인지 검사하고, **공개 번들 관찰로 고정한** `bygrczggxfuisupcevaz`와 비교. 서로 다르면 409, DB HEAD 호출 0회.
- 일치한 경우에만 `createSupabaseAdminClient().from('saved_reports').select('face_lab_revision',{head:true}).limit(0)`을 1회 호출하여 서버의 대상 DB 접근 및 객체 readback 가능 여부를 확인합니다. 성공이면 `dbHeadReadback=ok`이지만 최종 `status=HOLD`입니다.
- 결과 응답은 `serverProjectMatch` boolean / `dbHeadReadback` 등 통제된 값만 포함하며 env URL, 키, 토큰, DB row, 오류 본문, 실행 SQL, 서버 인증 정보는 반환하지 않습니다.

## 한계 및 다음 게이트

1. 서버 프로젝트 URL과 공개 클라이언트 ref의 일치 + 실제 제한된 HEAD 조회는 **관찰된 연결의 간접 증거**입니다. 네트워크 경로, 프로젝트 신원, 데이터베이스 자체에 대한 독립적 attestation은 아니므로 `productionProjectIdentityVerified=false` 유지.
2. HEAD 접근 성공은 `saved_reports.face_lab_revision`의 존재를 간접 시사할 뿐, 저장소 마이그레이션 SQL 적용·역사 기록·RLS/정책/함수 권한 동일성을 보증하지 않습니다.
3. 실제 호스팅 DB 읽기 전용 카탈로그 SQL, migration 확인, GRANT/RLS 변경, migration 실행 등은 이 단계에서 수행하지 않습니다.
4. 현존 `braces` 및 `node-forge` 공급망 경고가 해결되고 CI 통과/병합된 뒤, 승인된 운영 관리자만 필요 시 endpoint를 수동 호출해 결과를 평가합니다. 자동 PASS, 운영 DB 쓰기, 보안 게이트 우회 금지.
5. 본 PR의 자동 CI는 합성값과 route 정적 계약만 테스트하며 운영 서버 호출·DB 연결·비밀값 접근은 없습니다.

## 검증

```bash
node scripts/verify-face-lab-v2-production-identity-readback.mjs
```

완료 조건: Node 테스트 PASS + CodeQL/기존 보안 검증 확인. 보안 게이트 FAIL 동안 PR은 병합 대기.

Watchtower-Track: face-research
