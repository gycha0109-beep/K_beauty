# Face Lab SC-06D — 실제 얼굴 / 스타일 이미지 동반 블라인드 평가 UI

> 2026-10-23 · 상태: **OFFLINE UI GENERATOR / SYNTHETIC CASE CONTRACT / ACTUAL VISUALS NOT PROVIDED**
> 선행 PR #1399, 인간 평가 실사진 권리 보호: SC-05. 오프라인 평가 편의 도구이며 운영 Face Lab 추천이나 서비스 화면이 아님.

## 1. 왜 사진 입력을 강제하는가

SC-06C에서 생성된 7쌍은 **가상 구조 관찰값**에서 Current vs SC-06B 후보의 변화가 reviewer-visible인 케이스다. 진짜 얼굴에 더 잘 어울린다는 판정을 사진 없이 내려서는 안 된다.

평가자는 다음 3개 **동일 인물** 자료가 준비된 케이스에서만 점수를 입력한다.

1. **원본 얼굴 사진** — 연구 평가 목적 동의·이용 권한·철회/삭제가 확인되고, 해당 케이스의 관찰값과 일치하는 사진.
2. **추천 A 실제 스타일 적용 이미지** — 해당 A의 행동/강도/경로를 동일 인물에게 시각적으로 적용한 이미지.
3. **추천 B 실제 스타일 적용 이미지** — 동일한 인물·배경/조명/각도·해상도 등 조건에서 B만 변경한 이미지.

현재 코드는 실제 인물 사진을 갖고 있지 않으며, A/B 스타일 합성 이미지를 생성하거나 '미리 생성돼 있다'고 주장하지 않는다. **이 준비는 사용자/운영자가 별도로 수행**해야 한다. 생성형 A/B 변환을 쓰는 경우 사진 기반 관찰 정답과 동등하지 않다.

## 2. 실행 방법

GitHub PR #1400을 체크아웃한 뒤 **리포지터리 외부 디렉터리**를 준비한다.

```bash
node scripts/build-face-lab-style-check-visual-review-ui-sc06d.mjs \
  --output-file=/absolute/private/visual-review.html
```

생성된 HTML을 로컬 브라우저에서 연다. 인터넷 연결·백엔드 인증·API·서버·DB·이미지 전송은 필요 없다. 이미지 3장은 각 문항의 파일 입력창에서 직접 선택한다. 여러 문항의 이미지도 탭 내 Blob Object URL로 보존되며 탭을 닫으면 해제된다.

Windows PowerShell 예시 (대상 디렉터리가 이미 있어야 함):

```powershell
node .\scripts\build-face-lab-style-check-visual-review-ui-sc06d.mjs --output-file=C:\FaceLabPrivateReview\visual-review.html
```

생성기는 쓰기 1회(`wx`)만 허용하며 리포지터리 내부 출력/기존 파일 덮어쓰기를 차단한다. 생성된 파일은 reviewer-only packet만 포함하며, SC-06C confidential operator manifest를 포함하지 않는다.

## 3. 평가 UI

- 상단: 7개 문항 진행 표시, synthetic Target·face cue 요약, 스타일 범위.
- 이미지: 원본 1장 / A 스타일 1장 / B 스타일 1장. 형식 JPEG/PNG/WebP, 개별 20 MB 이내.
- 행동: A/B 각각 domain, parameter, strength, neutral explanation. Current/Candidate나 후보 relation ID를 보여주지 않음.
- 네 항목: **실제 얼굴 적합성(추가)**, 기존 계약의 `target_fit`, `specificity`, `evidence_action_linkage`; 각 `A/B/tie/uncertain/not_assessable`.
- 확인: 운영자가 입력한 이미지가 허용된 자료이며 동일인·조건에 대응한다고 직접 체크. 이 문항은 사진 3장, 체크, 4개 verdict 없이는 완료되지 않음.
- 기록: 이유 선택 입력.
- 내보내기: 평가값/packet ID/item SHA/조건 확인 여부만 `facelab-visual-review-draft.json`로 다운로드. **사진 파일·Blob URL·실제 후보 엔진 정답 매핑 미포함**.

## 4. 보안 및 검증 경계

- 파일을 처리하는 것은 로컬 브라우저 `File`과 `URL.createObjectURL`; 앱 자체는 fetch/XHR, 서버 POST, `localStorage`, `sessionStorage`를 사용하지 않음.
- 파일 내 CSP는 `default-src 'none'`, `connect-src 'none'`, `img-src blob:`. 브라우저 확장·OS 접근 통제까지 보증하는 것은 아님.
- 패킷은 기존 SHA-256 검증 후 삽입. 사진 원본은 패킷에 삽입하지 않는다.
- **사람 평가 결과는 unsealed local draft**: 기존 Human Pairwise `judgmentDigest` / 2인 독립 봉인 / reveal mapping / 실제 참가자 동의 확인을 대체하지 않는다.
- 이미지 파일을 눈으로 확인했다고 해서 synthetic field와 실사진 cue가 자동 매칭·검증된 것이 아니다. `sameSubjectAndUseRightsOperatorAttested`는 기록된 진술이지 권리 검증 증명이 아니다.
- 실제 후보 이미지를 만들 때 동일 인물의 눈/턱 특징 자체를 바꿔버리면 추천 품질 비교가 무효가 될 수 있다. 이 경우 `not_assessable`로 남겨야 한다.

## 5. 로드맵

- 기술 근거 추적 SC-02/03/04, 사람 연구 준비 SC-05, 전체 필드 실측 SC-06, 후보 SC-06B, 텍스트 blind SC-06C: 기존 각 테스트 PR.
- **이번 SC-06D**: 7개 블라인드 평가 항목을 실제 얼굴 + A/B 스타일 시각 자료에 연결할 수 있는 **오프라인 로컬 인터페이스**.
- 아직 미완료: 실사진 권리 확인, 표본 구축, A/B 시각 자료 렌더링·품질 확인, 독립 2인 Human 판단, 보류/의견불일치 처리, SC-07 운영 정책 릴리스.
