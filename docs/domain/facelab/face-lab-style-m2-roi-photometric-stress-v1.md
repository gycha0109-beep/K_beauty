# Face Lab Style M2 — ROI/광원 스트레스 검증 v1 (2026-10-21)

**상태: 연구용 Draft / 자동 얼굴 검출·피부색 정확도 미검증 / 운영 미연결**

## 범위와 실제 구현

이 작업은 이전 M2 합성 RGB→Lab/LCH, 랜드마크 기반 ROI *제안* 및 반복 촬영 비교 도구를 결합한 회귀 테스트입니다. **사진에서 실제 얼굴을 자동으로 검출하거나 독립 피부 세그먼트를 생성하는 기능을 구현한 것이 아닙니다.** 새 `reviewed-roi-sampling.js`는 **외부가 제공한 원본 좌표 FaceMesh 랜드마크 및 독립적으로 승인된 피부 이진 마스크**가 있어야 측정에 도달합니다. 독립 검수가 없는 경우 항상 `insufficient_evidence`로 보류합니다. FaceMesh 좌표가 존재한다는 사실은 피부 영역·조명 적합성 검증이 아닙니다.

- ROI 제안: `proposePersonalColorCheekRegions` (기존). 원본 이미지 좌표, 단일 얼굴, geometry bounded.
- 폴리곤/마스크 생성: `buildPersonalColorCheekMasks` (기존). 좌우 볼 중첩, 좌우 스왑, 픽셀 수, 제외 영역 검증.
- **보강된 승인 경계:** `measurePersonalColorReviewedCheekRoi`. 독립 검수 4항목(피부 ROI·제외 마스크·조명 안정성·원본 방향), 별도 피부 영역 이진 마스크 2개, 추가 제외 폴리곤이 모두 제공되어야 함. 제안 ROI의 사용 픽셀이 독립 마스크 범위 밖이면 보류.
- **측정:** 승인 경계에 도달해도 결과는 `measurement_only`, 계절/undertone/색상 적합성은 null. 원본, 얼굴 좌표, 마스크, 화장품 상품정보는 저장/반환하지 않음.
- **합성 스트레스:** `scripts/verify-face-lab-v2-personal-color-roi-photometric-stress.mjs`에서 동일 모의 픽셀에 채널 가중치(warm/cool), 밝기(증가/감소), 채도(증가/감소), 좌우 비균일 조명, 랜드마크 이동, 좌우 볼 외부 배경 오염, 제외 마스크 주입을 적용해 CIELAB 색차와 방향성, HOLD 응답을 검증.
- **CI:** `scripts/verify-face-lab-v2-foundation.mjs`에서 회귀 스크립트 import. `.github/workflows/face-lab-v2-foundation.yml`의 PR/push paths가 관련 변경을 트리거.

## 스트레스 결과의 해석 기준

| 입력 | 기대 행동 | 금지하는 해석 |
| --- | --- | --- |
| 동일 RGB/동일 ROI | ΔE76 = 0, 결정론성 | 실기기 반복 정확도 PASS |
| 합성 웜/쿨 조명 | Lab b* 변화, ΔE76 증가 | 단일 사진의 실제 조명 자동 판별 |
| 합성 노출 +/− | Lab L* 변화, ΔE76 증가 | 피부가 실제 밝아지거나 어두워짐 |
| 합성 채도 +/− | Lab chroma 변화, ΔE76 증가 | 원래 피부 undertone/계절형 |
| 좌우 조명 비균일 | 두 볼 L*가 다른 방향으로 변함 | 실사진의 그림자 자동 정확 검출 |
| FaceMesh 제안 영역 이동 | 독립 피부 마스크 밖이면 HOLD | 랜드마크만으로 자동 진위 판단 |
| 피부 영역 밖 RGB 교란 | 독립 마스크 안의 볼 측정 유지 | 자동 피부 세그먼트 성공 |
| 독립 ROI 없이 제안만 존재 | 측정 보류 | 랜드마크만으로 피부색 확정 |
| 원본 방향 불명·미러 프리뷰 | 측정 보류 | 좌우 볼 자동 매핑 승인 |
| 검수자가 색광/백밸 불안정 표시 | 측정 보류 | 비통제 광원에서도 정확 |
| 상위 Vision이 색광을 **거짓으로 안정적이라 판정** | 연구 측정 수치는 변할 수 있음; 외부 검수 없는 운영 승인 금지 | 단일 이미지에서 조명 오염을 정확히 자동 감지했다고 주장 |

수치 ΔE76은 **겉보기 사진 RGB의 거리**이며 calibration accuracy가 아닙니다. 임의 ΔE 임계값으로 퍼스널 컬러를 판정하거나 자동 화이트밸런스 보정을 정당화하지 않습니다.

## 실제 얼굴 사진 이용 제한

2026-10-17 사용자 제공 기준/변환본 사진은 GitHub에 등록하지 않았으며 이번 CI synthetic suite도 사용자 원본, 얼굴 crop, 랜드마크, EXIF를 포함하지 않습니다. 원본/얼굴 경로를 코드 또는 로그에 기록하지 마십시오. 실제 사진의 ROI 제안 IoU, 분할 오탐율, 사용자 동의·보안 저장·기기별 화이트밸런스 정확도는 **아직 미검증**입니다.

## 남은 단계

1. 개인정보·참가 동의와 실제 카메라 촬영/검수 데이터 운영 승인.
2. 적합한 로컬 FaceMesh/피부 ROI 검출기의 출처, 저작권, 성능, 사진 좌표·EXIF 회전 처리 검증.
3. 전문가가 검수한 피부 마스크 참조 집합으로 자동 ROI의 오탐률/재현성 평가. 임의로 원본 사진이나 실사용 개인정보를 CI에 추가하지 않음.
4. 화이트밸런스·색상 정확도의 독립 참조(색표준/교정된 측정), 실기기별 통계 및 UX/Human 리뷰 후 운영 전환 여부 별도 승인.
5. 공급망 보안 및 release gate는 기존 M6과 독립적으로 해결. 이번 변경은 production, Auth, DB, Storage, Provider, 결제, 사용자별 피부 진단 정책을 수정하지 않음.

**재현**: `node scripts/verify-face-lab-v2-personal-color-roi-photometric-stress.mjs` 또는 `node scripts/verify-face-lab-v2-foundation.mjs`. PASS여도 출시 승인 아님.

Watchtower-Track: face-research
