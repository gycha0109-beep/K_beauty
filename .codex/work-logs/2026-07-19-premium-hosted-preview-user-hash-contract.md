# Premium Hosted Preview User Hash Contract Correction

## 발견

실제 로그인 캡처는 `hashIdentifier(user.id)`를 사용해 `sha256:<64 hex>` 형식의 사용자 식별자 해시를 만든다.

반면 login evidence validator와 manifest 예시는 접두어 없는 64자리 hex를 기대했다. 이 상태에서는 정상 Google 로그인도 다음 단계에서 항상 거부된다.

```text
capture: sha256:<64 hex>
validator: <64 hex>
→ login_evidence_user_hash_invalid
```

## 보정

사용자 식별자 해시의 canonical 형식을 아래로 단일화했다.

```text
sha256:<64 lowercase hexadecimal characters>
```

적용:

- manifest의 Account A/B `expectedUserIdHash`
- Google login capture evidence의 `userIdHash`
- preflight identity comparison
- DB ownership evidence
- cleanup owner binding

파일 자체 SHA-256 값인 `storageStateHash`, `catalogHash`, manifest hash 등은 기존처럼 접두어 없는 64자리 hex를 유지한다.

## 검증

- prefixed user hash 허용
- unprefixed evidence user hash 거부
- unprefixed expected user hash 거부
- provider/deployment/storage-state 검증 회귀 유지
- manifest example 형식 수정

## 자체 리뷰

최초:

- Critical 1: 모든 정상 login evidence가 validator에서 거부됨
- Important 1: 사용자 ID 해시와 파일 해시 형식이 문서상 구별되지 않음

최종:

- Critical 0
- Important 0
- Medium 0

## 범위

- 해시 표현 계약만 보정
- raw user UUID 저장·출력 없음
- Production, DB/schema/RLS/Auth 정책, runtime/UI 변경 없음
- merge 및 Draft 해제 없음
