# Skin Match Survey Contract v1

이 문서는 무료 Skin Match 설문 문항이 무료 추천, 무료 결과, 유료 리포트에 어떻게 연결되는지 정의한다. `docs/architecture/survey-calculation-audit.md`는 감사 원본으로 유지하고, 신규 정리는 이 문서에 기록한다.

## Contract Table

| 설문 문항 | UI state key | 무료 추천 영향 | 무료 결과 영향 | 유료 리포트 활용 | 구형 payload 처리 | 비고 |
| --- | --- | --- | --- | --- | --- | --- |
| 피부 타입 | `skinType` | 제품 skin type match와 일부 점수 보정에 사용 | 피부 상태 요약과 결과 문맥에 사용 | survey snapshot으로 저장되어 유료 분석 문맥에 사용 가능 | 필수값 누락 시 신규 분석 거절 | 유지 |
| 민감도 | `sensitivity` | irritation risk, sensitivity safe 보정에 사용 | 장벽/민감 관련 결과 문맥에 사용 | survey snapshot으로 저장되어 유료 루틴 주의사항 문맥에 사용 가능 | legacy `sensitivityLevel` alias 허용 | 유지 |
| 주요 고민 | `mainConcerns`, `mainConcern` | concern match, category priority, priority score에 사용 | 관리 우선순위와 레이더/설명 문맥에 사용 | survey snapshot과 premium payload 문맥에 유지 | legacy 단일 `mainConcern` 허용 | 유지 |
| 세안 직후 느낌 | `postWashFeeling` | 건조/유분 관련 보정과 제품 사용감 판단에 사용 | 피부 상태 설명과 근거에 사용 | survey snapshot으로 저장되어 루틴/컨디션 대응 문맥에 사용 가능 | legacy `postCleanseFeel` alias 허용 | 유지 |
| 오후 피부 변화 | `afternoonSkinChange` | 유분/건조/민감 관련 보정에 사용 | 피부 상태 설명과 근거에 사용 | survey snapshot으로 저장되어 컨디션 대응 문맥에 사용 가능 | legacy `afternoonState` alias 허용 | 유지 |
| 세안 횟수 | `cleansingFrequency` | `3_plus`일 때 기존처럼 barrier +3, dehydration +2 survey score 반영 | 과세안/장벽 부담 근거와 루틴 주의 문맥에 사용 | survey snapshot에 보존되어 유료 루틴/컨디션 대응에서 활용 가능 | legacy 값은 문자열로 허용, `once`/`twice`에는 새 가중치 없음 | 유지 |
| 환경 노출 | `environmentExposure` | outdoor, heat, mask, aircon 등 환경 보정에 사용 | 환경 근거와 루틴 방향에 사용 | survey snapshot으로 저장되어 유료 컨디션 대응 문맥에 사용 가능 | JSON array parsing 실패 시 빈 배열 | 유지 |
| 선호 제형 | `preferredTexture` | texture match 점수에 사용 | 추천 이유와 요약 태그에 사용 | survey snapshot으로 저장되어 유료 루틴 문맥에 사용 가능 | legacy `texturePreference` alias 허용 | 유지 |
| 피하고 싶은 일반 사용감 | `mostDislikedFeel` | `sticky`, `greasy`, `heavy`만 일반 제품 사용감 감점에 사용 | 무료 결과 요약 태그와 추천 이유 문맥에 사용 | survey snapshot으로 저장되어 유료 문맥에 사용 가능 | `fragranced`, `pilling`은 신규 UI에서 제거. 구형 값은 오류 없이 허용하되 일반 제품 신규 감점 의미를 만들지 않음 | `fragranced`, 일반 `pilling` 제거 |
| 선크림 고려사항 | `sunscreenConsiderations` -> `whiteCastHate`, `toneUpWanted`, `makeupUse`, `eyeSensitive` | sunscreen hard filter/score에 사용. `makeupUse` + `pilling_risk` 연결 유지 | 선크림 추천 이유와 주의 문맥에 사용 | survey snapshot으로 저장되어 유료 루틴 문맥에 사용 가능 | 누락 시 false 처리 | 일반 `pilling` 제거와 별개로 유지 |
| 성별 | removed, legacy `genderPreference` | 신규 무료 추천 판단에 사용하지 않음. `is_mens` 여성 -3/남성 +1 가중치 제거 | 신규 무료 결과 문맥에 사용하지 않음 | 신규 Skin Match 유료 판단에도 사용하지 않음 | 구형 payload에 포함되어도 오류 없이 무시 | 신규 무료 설문 제거 |

## Removed Free Survey Inputs

- `mostDislikedFeel: fragranced`는 현재 제품 DB 필드, 직접 감점 로직, 추천 계약에 연결되어 있지 않으므로 신규 무료 설문에서 제거한다. 향료 제품 태그, 성분 분석, 리뷰 태깅 확장은 이 계약 범위 밖이다.
- 일반 사용감의 `mostDislikedFeel: pilling`은 일반 제품 메타 감점 계약이 약하므로 신규 무료 설문에서 제거한다. 구형 payload는 허용하지만 일반 제품용 신규 감점 규칙은 만들지 않는다.
- `genderPreference`는 Skin Match 추천 판단에 사용하지 않는다. `is_mens` 기반 여성 패널티/남성 보너스는 제거하며, 성별을 Face Lab 입력이나 별도 프로필 UI로 이동하지 않는다.

## Preserved Rules

- 선크림에서는 `makeupUse`와 `pilling_risk` 연결을 유지한다. `makeupUse: true`일 때 높은 `pilling_risk` 후보를 엄격 필터/감점하는 기존 선크림 로직은 이 계약에서 유지된다.
- `cleansingFrequency === "3_plus"`는 기존 무료 concern score에서 barrier와 dehydration survey signal을 올린다. `once`, `twice`에는 신규 가중치를 추가하지 않는다.
- 무료 분석 완료 시 `skinTestSubmission.form`과 저장 API의 `survey_snapshot`에는 `cleansingFrequency`가 유지되어 유료 리포트/프리미엄 세션에서 사용할 수 있다.

## Legacy Compatibility

- 구형 payload의 `genderPreference`는 오류 없이 수신될 수 있으나 추천 점수, Top Pick, supportingProducts, product ranking에는 영향을 주지 않는다.
- 구형 payload의 `mostDislikedFeel: fragranced` 또는 `pilling`은 오류 없이 통과한다. 신규 UI에는 노출하지 않으며, 신규 일반 제품 감점 의미를 추가하지 않는다.
- 기존 alias인 `sensitivityLevel`, `texturePreference`, `postCleanseFeel`, `afternoonState`, `dislikedFeel`은 API 호환을 위해 유지한다.
