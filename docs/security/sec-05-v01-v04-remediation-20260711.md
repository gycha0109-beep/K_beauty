# SEC-05 V01-V04 보정

## 목적

SEC-05 v2 검증에서 확인된 V01~V04 커밋 차단 결함을 최소 범위로 보정한다. 대상은 anonymous result/track write grant의 client 분기, result transport payload, anonymous public result persistence, result single-use replay 방어다.

이번 보정은 premium entitlement, saved report, check-in, share permission, SEC-01 guard table, 환경변수, migration 적용을 포함하지 않는다.

## V01: Anonymous Auth 분류

`getBrowserPermanentSupabaseAccessToken()`은 Supabase user object의 `is_anonymous === false`인 영구 account만 bearer token으로 반환한다. anonymous session, session refresh, user 없음, 분류되지 않은 user는 anonymous grant state를 유지한다.

Result share와 result/full-report tracking caller는 영구 account token이 있을 때만 anonymous grant state를 제거한다. 따라서 anonymous Supabase session은 v2 result/track token과 analysis run ID를 계속 사용한다. Server-side account 권한 판정은 변경하지 않았다.

## V02: Transport와 Persistence 분리

`analysisRunId`는 response body와 별도 `/api/results` request field에서만 resource match에 사용한다. Anonymous result persistence payload에서는 제거한다.

Client는 anonymous 저장 전 `analysisRunId`, analyze `meta`, Face Lab supplemental payload를 제거한다. Server는 `analysisRunId`가 token `resourceId`와 일치하는지 계속 확인하며, result object에 섞여 들어온 transport/supplemental key는 canonical persistence validator가 거부한다.

## V03: Canonical Persistence/Fingerprint 계약

`canonicalizeAnonymousResultForPersistence()`와 `canonicalizeAnonymousSurveyForPersistence()`가 anonymous public result의 유일한 persistence shape다. `/api/analyze`는 이 canonical object와 survey form으로 grant fingerprint를 만들고, `/api/results`는 같은 helper로 request body를 정규화한 뒤 그 반환값만 DB insert에 사용한다.

| 저장·fingerprint 포함 필드 |
| --- |
| `summary`, `priority`, `topPick`, `alternative`, `amFocus`, `pmFocus` |
| `routineStructure`, `morning`, `night`, `warnings` |
| `photoEvidence`, `photoObservations`, `surveyEvidence`, `scoring` |

Product는 id/name/brand/step/reason/comparison reason/buy link/image URL/price range/use time만 canonical object에 남긴다. 알려지지 않은 top-level field는 거부하고, 알려지지 않은 product field는 canonical object와 DB payload에서 제거한다. `meta`, Face Lab, `analysisRunId`, client image name은 anonymous public persistence에 저장하지 않는다.

Fingerprint는 HMAC-SHA-256으로 locale, normalized survey form, 위 canonical result 전체를 stable serialization해 계산한다. Survey alias, string trim, boolean, array upper bound도 persistence 전에 같은 방식으로 정규화한다. Object key order는 영향을 주지 않고, array order는 결과 의미를 보존한다. raw result body는 grant table에 저장하지 않는다.

## V04: Result Single-Use 및 Unique Linkage

`result:create` use는 최초 claim 이후 재claim하지 않는다. 같은 fingerprint의 use가:

- `in_progress`: 새 write를 시작하지 않는다. 이미 `analysis_results` row가 있으면 use ID로 찾아 complete/replay하고, 없으면 409을 반환한다.
- `completed`: use ID로 기존 canonical result만 반환한다.
- `failed`: 새 write를 허용하지 않고 새 분석을 요구한다.

`track:create`의 최대 3회 retry와 event dedupe는 변경하지 않았다.

Migration은 `analysis_results.anonymous_write_grant_use_id` nullable FK와 partial unique index를 추가한다. Anonymous result insert는 claim RPC가 반환한 use ID를 이 column에 기록한다. Account 및 기존 row는 `NULL`이므로 기존 insert와 호환된다. 복구는 더 이상 `analysis_requests.session_id`를 사용하지 않고 use ID의 unique result row만 조회한다.

Complete 응답이 유실돼도 재요청은 `in_progress` use ID로 기존 result를 찾아 complete할 수 있다. 저장 row가 없으면 재claim하지 않아 process crash는 fail-closed이며 새 분석/token이 필요하다.

## V05 처리

V05 cleanup lease/grace 문제는 이번 범위에서 수정하지 않았다. Cleanup retention은 별도 Low-risk 보정으로 남는다. 새 result FK는 `ON DELETE SET NULL`을 사용하므로 cleanup이 canonical result row를 삭제하지는 않는다.

## Verifier 강화

`scripts/verify-anonymous-write-grant-v2.mjs`는 다음을 실제 helper 실행 또는 강화된 static contract로 확인한다.

- anonymous/permanent/unclassified Supabase user 분류
- anonymous persistence payload의 transport/meta/Face Lab 제거와 server-side 거부
- canonical persistence field set과 product field fingerprint
- real token signature helper를 이용한 altered claim 검증
- result no-reclaim branch, use ID 반환, session ID 복구 제거
- analysis result use-ID nullable linkage와 unique index
- account row의 nullable field 호환

## 배포 순서

1. `20260711032649_sec_05_anonymous_write_grants.sql`을 검토하고 적용한다.
2. `ANONYMOUS_WRITE_GRANT_SECRET`과 기존 SEC-01 guard secret을 server-only로 설정했는지 확인한다.
3. guard table/RPC privilege, `analysis_results` new column/index, `recommendation_logs` FK/index를 metadata로 확인한다.
4. 코드 배포 후 anonymous analyze → result save → replay → track 및 permanent account save/track smoke test를 실행한다.
5. disposable local DB에서 result no-reclaim, complete-loss recovery, same-use unique insert, track dedupe/max-use를 동시 connection으로 검증한다.

Migration 또는 secret 없이 code만 배포되면 anonymous result persistence는 fail-closed되어야 한다.

## 남은 검증

Local Docker/Supabase가 현재 사용할 수 없어 migration apply, RPC privilege, DB unique index, result concurrency는 `NEEDS_LOCAL_DB_TEST`다. Production Supabase, OpenAI, 실제 사용자 데이터에는 접근하거나 write하지 않았다.
