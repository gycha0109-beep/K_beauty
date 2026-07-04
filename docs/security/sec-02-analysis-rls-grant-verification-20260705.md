# SEC-02 분석 데이터 RLS·grant 검증

## 1. 목적 및 범위

이번 작업은 분석 흐름에서 얼굴 사진, 설문, 무료 분석 결과, 프리미엄 결과, My 리포트/체크인/다이어리 데이터가 Supabase table, RPC, Storage 정책으로 어떻게 보호되는지 확인하기 위한 SEC-02 검증이다.

범위는 저장소 정적 조사와 연결된 Supabase 프로젝트의 metadata-only read 검증이다. 실제 사용자 row, report row, image object, secret 값은 조회하지 않았다. migration apply, db push, policy 변경, Storage 설정 변경, 기능 코드 수정도 하지 않았다.

검증 기준은 Supabase Data API가 table grant와 RLS를 함께 요구한다는 현재 공식 문서 기준과, SQL로 생성한 노출 schema table은 RLS와 grant를 명시적으로 검증해야 한다는 운영 원칙이다.

## 2. 확인한 분석 데이터 자산

| 자산 | 직접 browser 접근 여부 | server route 접근 여부 | service role 사용 여부 | user_id/owner 컬럼 | public 공유 필요 여부 | 민감도 | 현재 RLS 근거 |
| -- | -- | -- | -- | -- | -- | -- | -- |
| `analysis_requests` | 의도 없음 | `/api/results`, `/api/my/save-report` | 예 | `user_id` nullable | 아니오 | 높음 | 원격 metadata: RLS on, `service_role` grant만 확인. 저장소 migration 자체에는 RLS 문 없음 |
| `analysis_results` | 의도 없음 | `/api/results`, `/api/results/[shareId]`, `/r/[shareId]`, `/api/my/save-report` | 예 | `user_id` nullable | 예, `is_public=true` 또는 owner | 높음 | 원격 metadata: RLS on, `service_role` grant만 확인. 공유는 server helper에서 owner/public 검증 |
| `saved_reports` | 로그인 사용자 Supabase client 경로 | `/api/full-report`, `/api/my/save-report`, My dashboard | 아니오, 일부 cleanup은 admin | `user_id` not null | 아니오 | 높음 | migration에서 RLS on, anon revoke, authenticated owner policy, anonymous auth user 제외 |
| `skin_profiles` | 로그인 사용자 Supabase client 경로 | `/api/my/save-report`, `/api/my/check-in`, My dashboard | profile upsert fallback에서 admin 가능 | `user_id` not null | 아니오 | 높음 | migration에서 RLS on, anon revoke, authenticated owner policy, anonymous auth user 제외 |
| `daily_checkins` | 로그인 사용자 Supabase client 경로 | `/api/my/check-in`, My dashboard | 아니오 | `user_id` not null | 아니오 | 높음 | migration에서 RLS on, anon revoke, authenticated owner policy, anonymous auth user 제외 |
| `routine_logs` | 로그인 사용자 Supabase client 경로 | `/api/my/check-in`, My dashboard | 아니오 | `user_id` not null | 아니오 | 중간 | migration에서 RLS on, anon revoke, authenticated owner policy, anonymous auth user 제외 |
| `premium_report_sessions` | 의도 없음 | `/api/analyze`, `/api/full-report` | 예 | 없음, signed cookie `session_id` | 아니오 | 높음 | migration에서 RLS on. 원격 metadata: `service_role` grant만 확인 |
| `analysis_request_rate_windows` | 의도 없음 | `/api/analyze`, `/api/face-reading` guard | 예 | raw owner 없음, hash subject | 아니오 | 중간 | 저장소 SEC-01 migration에는 RLS/service_role-only 존재. 확인한 원격에는 아직 table 없음 |
| `analysis_request_idempotency` | 의도 없음 | `/api/analyze`, `/api/face-reading` guard | 예 | raw owner 없음, hash subject | 아니오 | 중간 | 저장소 SEC-01 migration에는 RLS/service_role-only 존재. 확인한 원격에는 아직 table 없음 |
| Supabase Storage 분석 이미지 bucket | 현재 app/lib 경로 없음 | 현재 없음 | 현재 없음 | 해당 없음 | 현재 없음 | 높음 | 원격 `storage.buckets` 결과가 빈 목록. object policy 적용 대상 없음 |

## 3. 코드상 데이터 접근 흐름

`/api/analyze`는 cheap image/form validation 후 SEC-01 `guardAnalysisRequest`를 통과하고, 그 뒤에 image data URL 생성과 OpenAI 호출을 수행한다. 이 route는 분석 결과를 `analysis_results`에 직접 저장하지 않고 `premium_report_sessions`에 프리미엄 session payload를 service role로 저장한다.

`/api/face-reading`도 image validation 후 SEC-01 guard를 통과한 다음 image data URL을 만들어 OpenAI로 보낸다. 이 route에는 `analysis_requests`, `analysis_results`, Storage write 경로가 없다.

무료 결과 저장 및 공유는 `/api/results`가 담당한다. 신규 공유 저장은 write token 또는 로그인 사용자 확인 뒤 service role로 `analysis_requests`와 `analysis_results`를 insert한다. 기존 private share publish는 `.eq("share_id", shareId).eq("user_id", userId)` 조건으로 owner row만 `is_public=true`로 바꾼다.

공유 URL 조회는 `lib/analysis-result-access.js`의 `getAnalysisResultForShare`로 통일되어 있다. 이 helper는 service role로 `share_id` row를 읽은 뒤 `is_public=false`이면 현재 Supabase user를 확인하고 `currentUser.id === data.user_id`일 때만 반환한다.

My 저장은 `/api/my/save-report`가 account user만 허용한 뒤 user cookie Supabase client로 `skin_profiles`, `saved_reports`를 처리하고, private share 생성을 위해 service role로 `analysis_requests`/`analysis_results`를 생성한다. 생성된 share는 `is_public=false`이고 `saved_reports.source_type/source_session_id`로 연결된다.

프리미엄 저장/재조회는 `/api/full-report`가 `savedReportId` 요청에서 account user와 bearer Supabase client를 요구하고, `saved_reports.id`, `saved_reports.user_id`, `report_type='premium'`을 모두 조건으로 조회한다. 신규 premium report session은 `premium_report_sessions`에 service role로 저장되고 signed httpOnly cookie `session_id`로 재조회된다.

My dashboard/check-in은 cookie 기반 Supabase user를 확인하고 `skin_profiles`, `saved_reports`, `daily_checkins`, `routine_logs`를 모두 `.eq("user_id", user.id)`로 제한한다.

## 4. table별 예상 권한 모델

| table | 예상 권한 모델 |
| -- | -- |
| `analysis_requests` | browser direct grant 없음. server service-role route만 insert/delete/read. 공개 조회 불필요 |
| `analysis_results` | browser direct grant 없음. 공개/owner 공유는 server helper에서만 처리. direct anon/authenticated SELECT 없음 |
| `saved_reports` | authenticated account user가 본인 row만 CRUD. anon 직접 접근 금지. anonymous Supabase Auth user도 제외 |
| `skin_profiles` | authenticated account user가 본인 row만 CRUD. anon 직접 접근 금지. anonymous Supabase Auth user도 제외 |
| `daily_checkins` | authenticated account user가 본인 row만 CRUD. anon 직접 접근 금지. anonymous Supabase Auth user도 제외 |
| `routine_logs` | authenticated account user가 본인 row만 CRUD. anon 직접 접근 금지. anonymous Supabase Auth user도 제외 |
| `premium_report_sessions` | browser direct grant 없음. server service-role route만 insert/read/update/delete |
| SEC-01 guard tables | browser direct grant 없음. service-role RPC/table 접근만 허용 |
| Storage image bucket | 현재 없음. 향후 생성 시 private bucket, signed URL, owner/report namespace policy 필요 |

## 5. migration 기준 RLS·grant 조사 결과

`supabase/migrations/20260424_align_analysis_results_share_schema.sql`은 `analysis_requests`, `analysis_results`를 만들고 `user_id`, `image_url`, `share_id`, `is_public`, `result_json`을 정의하지만, 이 파일 자체에는 RLS enable, anon/authenticated revoke, service_role grant가 없다.

`supabase/migrations/20260506070849_create_premium_report_sessions.sql`은 `premium_report_sessions`를 만들고 RLS를 enable한다. browser role policy는 저장소 기준으로 확인되지 않았다.

`supabase/migrations/20260520170737_add_revisit_core_tables.sql`은 `skin_profiles`, `saved_reports`, `daily_checkins`, `routine_logs`를 만들고 RLS enable, authenticated owner policy, anon revoke, authenticated CRUD grant를 포함한다.

`supabase/migrations/20260531123349_restrict_anonymous_user_data_policies.sql`은 Supabase anonymous auth user가 `authenticated` role로 매핑되는 점을 보정하기 위해 owner policy에 `coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false` 조건을 추가한다.

`supabase/migrations/20260704221747_sec_01_analysis_request_guard.sql`은 SEC-01 guard table과 RPC의 RLS, anon/authenticated revoke, service_role grant, function execute revoke/grant를 포함한다. 이 파일은 이번 작업에서 수정하지 않았다.

## 6. 원격 Supabase 메타데이터 검증 결과

연결된 Supabase 프로젝트에서 metadata-only query를 실행했다. 조회 대상은 PostgreSQL catalog, `information_schema.role_table_grants`, `pg_policies`, `pg_proc`, `storage.buckets`, `supabase_migrations.schema_migrations`였고, 실제 분석 row, user row, report row, image object는 조회하지 않았다.

확인 결과:

| 항목 | 원격 metadata 결과 |
| -- | -- |
| `analysis_requests` | RLS enabled, forced false, `service_role` grant만 확인 |
| `analysis_results` | RLS enabled, forced false, `service_role` grant만 확인 |
| `premium_report_sessions` | RLS enabled, forced false, `service_role` grant만 확인 |
| `saved_reports` | RLS enabled, authenticated CRUD + service_role grant, anon grant 없음 |
| `skin_profiles` | RLS enabled, authenticated CRUD + service_role grant, anon grant 없음 |
| `daily_checkins` | RLS enabled, authenticated CRUD + service_role grant, anon grant 없음 |
| `routine_logs` | RLS enabled, authenticated CRUD + service_role grant, anon grant 없음 |
| My 계열 policies | `auth.uid() = user_id`와 `is_anonymous=false` 조건 확인 |
| `analysis_requests`/`analysis_results` policies | 별도 browser role policy 없음 |
| `premium_report_sessions` policies | 별도 browser role policy 없음 |
| analysis/premium function | 분석 관련 privileged RPC는 원격에 없고, 확인된 privileged function은 `service_role` execute만 허용 |
| Storage buckets | 빈 목록. 현재 분석 이미지 bucket 없음 |
| SEC-01 guard table/function | 확인한 원격에는 아직 없음. SEC-01 배포 적용 여부는 별도 확인 필요 |

따라서 확인한 원격 환경 기준으로는 `analysis_requests`/`analysis_results` direct browser 접근을 가능하게 하는 RLS/grant 결함은 확인되지 않았다.

## 7. 위험 판정

| 상태 | 개수 | 내용 |
| -- | --: | -- |
| confirmed | 0 | 현재 확인한 remote metadata 기준 직접 RLS/grant 취약점 없음 |
| likely | 0 | 코드와 migration 근거만으로 취약점으로 볼 항목 없음 |
| needs-deployment-verification | 3 | clean replay/다른 배포 환경의 analysis table RLS·grant, SEC-01 migration 적용 여부, 향후 Storage bucket/policy |

## 8. 발견사항

### SEC-02-DV-01 repository migration replay 기준 analysis table RLS가 self-contained하지 않음

- 상태: needs-deployment-verification
- 근거: `20260424_align_analysis_results_share_schema.sql`에는 `analysis_requests`/`analysis_results` 생성과 share schema만 있고 RLS/grant 문이 없다. 반면 확인한 원격 metadata는 두 table 모두 RLS on, `service_role` grant-only 상태다.
- 영향: 현재 확인한 원격은 안전 상태로 보이지만, 다른 환경이나 clean replay DB가 같은 상태인지 repository만으로 보장되지 않는다.
- 권장: `docs/security/sec-02-analysis-rls-verification.sql`을 각 Supabase 환경에서 실행해 RLS/grant를 확인한다. 실제 누락 환경이 확인될 때만 별도 최소 migration을 작성한다.

### SEC-02-DV-02 분석 이미지 Storage 정책은 현재 적용 대상이 없음

- 상태: needs-deployment-verification
- 근거: app/lib에서 `storage.from`, `.upload`, signed/public URL 경로가 확인되지 않았고, 원격 `storage.buckets` metadata도 빈 목록이다. 현재 저장 row의 `image_url`은 `buildAnalysisRequestRow`/`buildAnalysisResultRow`에서 `null`로 저장된다.
- 영향: 현재 Storage object 접근 정책 결함은 재현 대상이 없지만, 향후 얼굴 사진을 Supabase Storage에 저장하면 bucket privacy와 object policy가 별도 보안 경계가 된다.
- 권장: 분석 이미지 bucket을 도입할 때 private bucket, MIME/size 제한, owner/report namespace, signed URL 만료, delete/revoke 동작을 별도 migration과 검증 SQL로 정의한다.

### SEC-02-INFO-01 SEC-01 guard migration은 확인한 원격에 아직 없음

- 상태: needs-deployment-verification
- 근거: 저장소에는 `20260704221747_sec_01_analysis_request_guard.sql`이 있지만, 확인한 원격 metadata에서는 `analysis_request_rate_windows`, `analysis_request_idempotency`, 관련 RPC가 존재하지 않았다.
- 영향: SEC-02 분석 데이터 RLS 결함은 아니지만, 공개 AI endpoint 비용 남용 방어 배포 상태 확인이 필요하다.
- 권장: SEC-01 배포 전 checklist에서 migration 적용 여부와 service_role-only RPC grant를 별도로 확인한다.

## 9. 작성한 보정 migration

작성하지 않았다.

이유:

- 확인한 원격 metadata 기준 `analysis_requests`, `analysis_results`, `premium_report_sessions`는 이미 RLS enabled이고 `anon`/`authenticated` direct grant가 없다.
- My 계열 table은 owner policy와 anonymous auth user 제외 조건이 확인되었다.
- Storage bucket은 현재 존재하지 않아 policy 보정 대상이 없다.
- repository migration의 self-contained gap은 확인됐지만, 현재 원격 안전 상태와 다른 환경 drift 검증이 먼저 필요하다. 추측성 migration은 이번 원칙에 맞지 않는다.

## 10. 운영자용 SQL Editor 검증 절차

1. Supabase Dashboard의 target project에서 SQL Editor를 연다.
2. `docs/security/sec-02-analysis-rls-verification.sql` 전체를 실행한다.
3. 결과에서 다음을 확인한다.
   - `analysis_requests`, `analysis_results`, `premium_report_sessions`의 `rls_enabled = true`
   - 위 세 table에 `anon`, `authenticated`, `PUBLIC` grant 없음
   - `saved_reports`, `skin_profiles`, `daily_checkins`, `routine_logs` policy에 `auth.uid() = user_id`와 `is_anonymous=false` 조건 존재
   - broad `USING (true)` 또는 `WITH CHECK (true)` policy 없음
   - privileged function execute가 `service_role`에만 허용
   - Storage bucket이 생긴 경우 public=false와 object policy 확인
4. 실제 사용자 row, report row, image object는 조회하지 않는다.

## 11. 배포 전 확인 항목

- 모든 production/preview/staging Supabase project에서 SEC-02 verification SQL을 실행해 metadata만 확인한다.
- `analysis_requests`, `analysis_results`가 RLS on + service_role-only grant인지 확인한다.
- public share는 direct DB policy가 아니라 `/r/[shareId]`와 `/api/results/[shareId]` server helper를 통해서만 열리는지 확인한다.
- `saved_reports`, `skin_profiles`, `daily_checkins`, `routine_logs` owner policy가 anonymous auth user를 제외하는지 확인한다.
- SEC-01 migration 적용 전후 guard table/function grant가 service_role-only인지 별도 확인한다.
- 분석 사진 Storage bucket을 만들 경우 bucket public 여부, object policy, signed URL 만료, 삭제 후 접근 불가를 별도 검증한다.

## 12. SEC-05와의 경계

`/api/results`의 anonymous write token은 분석 저장 허가 수단이며, 이번 SEC-02는 table RLS/grant와 route-level owner/public access만 검증했다. write token의 resource binding, replay 방지, anonymous session과 특정 analysis intent 연결은 SEC-05 범위이며 이번 작업에서 수정하지 않았다.

## 13. 결론 및 다음 권장 작업

현재 저장소와 확인한 원격 Supabase metadata 기준으로, 분석 데이터 table에 대한 direct browser RLS/grant 취약점은 확인되지 않았다. 다만 repository migration만으로 `analysis_requests`/`analysis_results` RLS 상태가 self-contained하게 재현되지는 않으므로, 다른 배포 환경과 clean replay DB에서 SQL 검증을 반복해야 한다.

다음 권장 작업은 SEC-01 migration이 실제 target Supabase 환경에 적용됐는지 확인하고, 적용 전후 guard table/RPC grant가 service_role-only인지 운영 metadata로 검증하는 것이다.
