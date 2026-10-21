# KO/EN 제품 표시명 누락 검토표 — 2026-10-21

> 출처: BEJEWELY 운영 Supabase `public.products` 읽기 전용 확인 (제품 176개, `name_en`/ `brand_en` 없는 행 12개).
>
> 이 문서는 **표시명 backfill 승인 후보**이지, 운영 DB 실행 기록이나 추천·태깅 승인서가 아니다. 운영 DB `UPDATE`는 아직 하지 않았다.

## 분류 및 적용 제약

- 12행 중 **기존 `brand`와 `name` 자체가 이미 영문 표기인 10행**: 정식 영문명과 정확히 동일한지 추가 검증 없이 공개 브랜드 공식명으로 인정하지 않는다. 잠정 display-only 원어 fallback은 이미 구현됨. 확정 시에만 `brand_en`/`name_en` 복사 가능.
- **기존 한국어 표시인 2행**: 아래 제조사 공식 영문명 확인됨.
- **`category IS NULL` 10행**: 번역과 별개의 제품 승인·분류 문제. 다국어화 작업에서 카테고리/추천 허용 상태 변경 금지.
- canonical `id`, `brand`, `name`, `normalized_*`, 태그·순위·근거 필드 변경 금지.
- product SQL 규칙의 `products` 기존 값 보존 원칙을 따라, 레코드 식별과 현재값 검증, dry-run 변경 대상 점검, 승인 후 표시 컬럼만 조건부 업데이트하고 재조회한다.

## 영문 표기 공식 확인: 2행

| UUID | 현재 원어 브랜드 / 상품명 | 제조사 확인 영문 표시안 | 근거 |
|---|---|---|---|
| `da5df70c-8cdd-4eb2-93b6-ede46c2f171d` | 파티온 / 노스카나인 트러블 세럼 | `FATION` / `NOSCA9 TROUBLE SERUM` | [FATION 공식 상품정보](https://www.fation.co.kr/product/%EB%85%B8%EC%8A%A4%EC%B9%B4%EB%82%98%EC%9D%B8-3%EC%A2%85-%EC%84%B8%ED%8A%B8-%ED%81%B4%EB%A6%AC%EC%96%B4-%ED%86%A0%EB%84%88%EC%84%B8%EB%9F%BC%ED%81%AC%EB%A6%BC/757/)의 국문/영문 제품명 |
| `08b85f37-b1fa-42d7-893a-0d4facb17878` | 토리든 / 다이브인 무기자차 마일드 선크림 | `Torriden` / `DIVE IN Mild Sun Cream` | [Torriden 공식 영어 제품 설명](https://m.torriden.com/main/html.php?htmid=promotion%2Fpromotion_english%2Fproduct_view%2Fproduct_08.html) |

영문 상품명에는 브랜드를 중복 저장하지 않는 기존 `brand` / `name` 분리 구조를 사용한다.

## 이미 영문 형태로 저장된 원어 상품: 10행

| UUID | `brand` | `name` | `category` |
|---|---|---|---|
| `4608b3b4-8b51-4464-b46e-380b05c1a3d7` | BUSHMAN | Waterproof Pro Suncream | NULL |
| `7e061f3a-e086-4700-8f09-98391008ecc5` | CellFusionC | Aquatica Cooling Sunscreen | NULL |
| `888eca86-af25-4a12-b9ea-47922d83f520` | COSRX | Ultra-Light Invisible Sunscreen SPF50 PA++++ | NULL |
| `df32d800-2f16-4511-8efa-dc353ea1c2ef` | FULLY | Rice Ceramide Moisture Sun Cream | NULL |
| `7c709c04-e299-4ca6-be69-6aaf4a753f13` | SIDMOOL | Dr. Troub Skin Returning Bio Repair + Suncream | NULL |
| `b576991e-79c9-4189-b6e9-527aeeb03566` | SIDMOOL | Dr. Troub Zinc Physical | NULL |
| `7fc45e7c-38aa-41a1-b1a1-c0e09fcd8c17` | SIDMOOL | Jojoba Suncream | NULL |
| `b90bf992-07ae-4f49-a3a4-d90ea6d4a858` | SIDMOOL | MIN JUNG GI Physical Sun Block | NULL |
| `a6994fcd-302f-4e63-acbe-91a3f17a5a65` | SIDMOOL | Physical Daily Sunmilk | NULL |
| `6852eeda-eb1d-4c4e-8bea-b30a26126a9c` | Beauty of Joseon | Day Dew Sunscreen | sunscreen |

## 검증 게이트

1. `id` 정확한 일치 확인, `name_en`/`brand_en`이 계속 비어 있는지 재확인.
2. 10개 원어 영문은 공식 표기와 제품 라인·용량이 동일한지 추가 근거 검토.
3. 적용 후 176행 중 영문 표시 누락 0건인지 읽기 전용 SQL로 확인.
4. 적용 전후 `category` NULL 개수, 추천 후보 집합, canonical identity, 다른 태그 변동이 없음을 확인.
5. DB 변경 기록·승인·롤백 대상을 남기고 기존 제품 운영 파이프라인을 통해 적용한다. **이 문서로 직접 운영 DB를 갱신하지 않는다.**
