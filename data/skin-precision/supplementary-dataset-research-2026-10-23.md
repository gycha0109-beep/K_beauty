# BEJEWELY 보충 피부 이미지 데이터 소싱 검증 v2 — 2026-10-23

> 기준: "이름만 있는 데이터셋" 금지. 실제 배포처, 포함 이미지·라벨 단위, 확보 경로, 상업적 이용과 얼굴 초상권, 빈틈을 각각 기록한다.
> **이 문서는 조사 결과이며 원본 사진 다운로드·권리 승인을 뜻하지 않는다.** 제공자의 라이선스와 얼굴 이미지 권리·개인정보 처리·국외 이전을 독립적으로 확인할 때까지 상용 학습 원본으로 승격 금지.

## 즉시 검토할 후보

### A. AI-Hub 71645, 이미 보유한 한국인 피부상태 측정 데이터 (기본 바탕)

- https://aihub.or.kr/aihubdata/data/view.do?dataSetSn=71645
- 주석: 볼 모공/이마·볼 색소 전문가 등급, 관련 장비 측정값, 입술 건조도 등; 여드름 **점 좌표**도 원본 라벨에 존재함을 확인. `acne:null`은 *무여드름 음성*이 아니다.
- 현재 Google Drive에 Validation JPG 1,391장(107개 식별자×13각도)과 TL/VL 라벨 ZIP 보임. 학습용 TS 사진은 이 시점 Google Drive에서 위치 미확인. 보유 수량이 곧 유효 학습 샘플 수가 아니다.
- **사용 방향:** 모공 가시성 *부위 등급*, 색소 *부위 등급*, 여드름 병변 *점 좌표* 기준선; 입술 건조도는 볼 건조감으로 전이해 주장 금지.
- **결여:** 개별 모공 마스크, 색소 점별 마스크, 얼굴 각질·요철 정답, 홍조 마스크, 표면 광택/진짜 피지 분리를 위한 판정 기준.
- 제공기관 연구자 관련 사이트 https://leejeongho3214.github.io/NIA/ 는 원본과 연계된 **모공·색소·입술 건조도 등급 모델 학습/테스트 코드** 및 체크포인트·분할 파일을 안내함. 체크포인트 암호는 이메일 문의. 연구 참고 대상이며 상업 모델 사용권 별도 확인.
- 이용 제한: 사용 허가, 제3자 열람 및 국외 반출, 파생 주석·모델 상용 이용 허가 확인 필요. 파일 취득과 권한 승인은 별개.

### B. MEMI-DS (기미 영역 마스크 데이터, 외부 공개 후보) — 색소 우선

- 공개 배포: https://figshare.com/articles/figure/MEMI-DS_A_Benchmark_Melasma_Image_Dataset_for_Image_Segmentation/29209229
- 논문/발표: https://www.dfki.de/web/forschung/projekte-publikationen/publikation/16681
- **716개 기미 사진 및 대응 segmentation annotation**이라는 논문 설명. figshare 배포 페이지 165.53 MB 및 **CC BY 4.0** 표기.
- BEJEWELY에 유효한 작업: 기미 *영역 분할* 학습·데이터 형식 프로토타입. **주근깨나 모든 색소 반점의 위치 마스크로 일반화하면 안 됨**; 특히 색소와 그림자/후염증 흔적에 대한 별도 독립 평가 필요.
- **권리 게이트:** CC BY 표기만으로 원 얼굴 사진의 재사용 동의/초상권·모델학습 목적·국외 사용 적법성은 자동 확인되지 않는다. 저자/저장소에서 배포사진 포함 범위, 임상 동의, 재사용 조건 확인.
- 상태: source verified, permission unverified; 원본 아직 다운로드·라벨 개별 검수 안 함.

### C. Nexdata 7,262 Facial Skin Defects / 2,499,771 bounding boxes — 주근깨·점·잡티 유력

- 공식 판매사: https://www.nexdata.ai/datasets/computervision/1829
- 소개: https://github.com/Nexdata-AI/Facial-Skin-Defects-Dataset-7262-Images-with-Acne-Moles-Scars-and-Freckles
- 7,262 얼굴 사진, **2,499,771 bbox**, 카테고리 `acne, moles, scars, herpes/sores, speckles, freckles, others`; 스마트폰 촬영.
- **실제 장점:** 피부 반점/주근깨의 *개별 위치* 라벨. **bbox이지 색소 경계 정확한 pixel mask가 아님**.
- **제한:** 소개 repo에는 학습용 이미지 풀셋 자체가 없다. 정식 **Commercial License 구매/견적** 필요; 샘플 bbox/라벨링 규칙, 각 클래스 수, 이미지 품질, 얼굴동의/국외 처리, 재배포 제한 검토.
- 상태: vendor commercial candidate / unlicensed; 수치와 품질은 공급자 주장이지 직접 검증 결과가 아님.

### D. FaceSkin-Q + SGA-UNet — 광택 / 실제 유분 / 수분 평가의 가장 직접적인 신규 후보

- 원저자 코드·다운로드 신청: https://github.com/CISLAB-web/SGAUnet
- 원저자 발표: https://www.nature.com/articles/s41598-026-65848-z
- 코드 공개 `README.md`: 데이터 신청 Google Form `https://forms.gle/Df8r7Dxf9yanb95j7`; FaceSkin-Q는 두 가지 조명 환경에서 촬영되었으며 **glossiness, moisture, sebum, elasticity** 연속값 학습 연구. `data_load/load_skin_q.py`는 입력 JSON `shapes[].label` 네 측정치와 `description` 조명 조건 파싱. 일부 주석에 누락값/형식 오류가 있다는 저자 경고.
- **실제 장점:** 얼굴에서 사진의 반사광과 **실제 피지량(sebum) 측정 타깃을 분리해 학습/오류를 평가**하는 데 유용. 논문은 모공/주름 전통영상 처리에서 생성된 *약한 의사 마스크*를 보조 감독으로 사용. 의사 마스크를 전문가의 개별 모공 정답으로 취급하지 않는다.
- **확인되지 않은 것:** 신청 승인 여부, 대상자 수, 실제 다운로드 파일 구조, 사용권의 상업 허용 여부, 얼굴 초상권/데이터 반출, 측정 장비 정의. 신청 전 '상업 목적 원본 데이터 사용/국외 이전 허용?' 질의 필수.
- **중요 코드 품질 주의:** `data_load/load_skin_q.py` 일부 malformed `label`을 네 값 모두 **0.0**으로 대체하는 분기가 있어, 원본 코드를 그대로 학습에 재사용하면 '실제 0'과 '오류'를 혼동할 위험. 별도 결측 플래그/제외, 수치 범위, 피험자 분할 검증 필요.
- 상태: author-source verified, access request required, rights unclear; 원본 취득하지 않음.

### E. Rupam.ai Bharatiya Skin Dataset (유료 상용 라이선스 명시) — 여러 항목의 등급 후보

- 라이선스 원문: https://rupam.ai/en/legal/dataset-license
- 공급사 설명: **50,000+** 피부 사진과 14개 속성(모공 가시성, 색소, 질감, 보습, 유분 등)을 주장. 일부 피부톤 범위(Fitzpatrick III–VI) 중심.
- **장점:** 8개 관찰 항목의 *이미지 수준 등급*과 다양한 톤 사례. 공간 좌표/마스크 정답 존재 여부는 확인되지 않음.
- **권리:** 상용 학습은 별도 유료 commercial licence 계약 의무. 서명/범위에 따라 학습/검증 가능, 원본 재배포 금지, 일부 관할 국외 이동에 사전 동의 필요. 값과 'expert' 품질은 독립 검증 전까지 공급사 주장.
- 상태: paid/review, 비용 견적 미확보, 실제 샘플 미취득.

### F. Nexdata 26,090 Facial Skin Defects — 이미지 단위 잡티·여드름 자국 보조 후보

- 공급사 소개: https://github.com/Nexdata-AI/26090-Images-Human-Facial-Skin-Defects-Data
- 판매 페이지: https://www.nexdata.ai/datasets/computervision/1052
- GitHub README는 **26,090장**, 판매 페이지는 **21,302장**을 표기해 **수량 불일치** 존재. 판매 페이지 기준 분류는 여드름, 여드름 자국, stains, 주름, 다크서클.
- **제한:** .jpg 파일 및 이미지 범주별 라벨로 기술되어 있어 *반점 개별 bbox/mask 확보 여부 불확실*. 추정 없이 공급사에 확인. 구매 전 샘플 JSON/마스크·클래스별 독립 피험자 수·라이선스 명확화.
- 상태: candidate only, 숫자·세부 라벨 공급사 검증 필요.

## 조건부/연구 전용 후보 — 상용 데이터에 바로 섞지 않는다

### G. PS-Net facial pore segmentation 연구 (공개 데이터 다운로드 불가)

- 논문: https://link.springer.com/article/10.1007/s44267-025-00088-9
- 연구에는 **18명**, 볼 패치 **3,750장(400×400)**, DoG로 만든 거친 모공 마스크 + 테스트용 사람 수동 마스크가 존재.
- 하지만 저자 **Data availability: 기업 제한으로 원 데이터 미공개; 합리적 요청 시 저자 문의**. 동일 피험자의 반복 촬영 3,750장을 3,750명으로 세면 심각한 오류.
- **활용:** pseudo-label/refinement 방법론 조사, 저자 협의로 사용권 확인, **BEJEWELY 독립 소유 데이터에서 전문가 정답 제작**. 미공개 데이터를 이미 확보한 것으로 표기 금지.
- 상태: research lead only / no verified image access or commercial rights.

### H. SKINCON — scale/각질 개념의 판정 기준 참고 (얼굴 미세 각질 직접 정답은 아님)

- https://skincon-dataset.github.io/
- Fitzpatrick17k 피부질환 이미지 **3,230장에 48개 임상 개념** (예: `scale`), DDI 이미지 656장에 추가 주석.
- **비적합:** 화장품 수준의 볼/코 미세 들뜸 위치 mask가 아님, 임상 질환 다양. 베이스 사진 Fitzpatrick17k는 **CC BY-NC-SA**; 상업 학습 불가(별도 권리 취득 제외). 개념/의사 검수 지침만 참고.
- 상태: restricted for commercialization.

### I. FFHQ-Wrinkle — 주름/질감 보조 연구만 (NC)

- https://github.com/labhai/ffhq-wrinkle-dataset
- 수동 주름 마스크 1,000장, 약한 마스크 50,000장. **CC BY-NC-SA 4.0**, 상용 사용 금지. 주름 마스크는 피부결/요철/건조 각질 픽셀 정답이 아님.
- 상태: restricted.

### J. Kaggle Facial Skin (Acne/Pigmentation/Pores/Wrinkles) — 신뢰성 검토용에 한함

- https://www.kaggle.com/datasets/shijo96john/facial-skin-acne-pigmentation-pores-wrinkles
- 피부 분류형 `Dark Spots, Acne, Blackheads, Whiteheads, Pigmentation, Pores, Redness, Wrinkles` 카테고리. 제3자 색인에 Apache-2.0 표기.
- **한계:** 재수집 원본 얼굴 권리, 원천/라벨 검증 및 구체적 이미지 수 미확인. 이미지 *분류 라벨*이라 병변 위치/mask gold가 아님. Apache 메타데이터만으로 원본 얼굴 상용학습 승인을 추정하지 않는다.
- 상태: hold.

## 실제 구현에서 반드시 추가할 정답 단위

| 분석 항목 | 현재 우선 데이터 | 새롭게 만들어야 할 정답 | 결과 용어 |
| --- | --- | --- | --- |
| 모공 | AI-Hub 등급 + FaceSkin-Q 구조 의사 마스크 | 코·볼 근접 촬영에 개별 모공/패치 가시성 수동 검수 | `모공 가시성` |
| 잡티 | AI-Hub 색소 등급 + MEMI-DS 기미 마스크 + Nexdata 7,262 bbox | PIH / 기미 / 주근깨 유사 / 그림자 hard negative와 반점 마스크 | `색소 반점` |
| 주근깨 | Nexdata 7,262 bbox | 사람별 확인된 주근깨 양성/혼동 부류 검증 세트 | `주근깨 유사 반점` |
| 피부결·요철 | AI-Hub 피부 패치 + 고화질 사진 + 주름 연구법 | 볼/턱 미세 요철 위치 및 등급, 조명·노이즈 통제 | `피부결/요철` |
| 광택 | FaceSkin-Q 이미지 + glossiness/sebum 수치 | 조명 하이라이트와 광택의 구분 주석; 동일인 이중 조명 검증 | `표면 광택` |
| 각질·건조 징후 | SKINCON `scale`의 개념 참조 + 별도 동의 사진 | 얼굴/볼/코 각질 들뜸 **점·작은 마스크·심각도** 및 false-positive(화장, 압축, 필터) | `눈에 보이는 각질·들뜸` |
| 피부 수분/피지량 | AI-Hub 측정값 또는 FaceSkin-Q 타깃 | 장비로 측정된 값 외의 RGB 사진에서 물리량 확정 금지 | `참고 추정` 또는 미표시 |

## 우선 행동 (데이터 다운로드·상용 훈련 시작 아님)

1. **저비용/접근 우선**: 이미 보유한 AI-Hub 라벨의 실제 필드, 부위별 분포, 사진 식별자와 교차 검증. 대학 연구자 사이트의 등급 모델/코드/분할 파일 접속 및 체크포인트 라이선스 문의.
2. **CC BY 4.0 파일 우선 후보**: MEMI-DS 배포본이 실제 716장+마스크가 맞는지, 마스크 좌표·색상·얼굴 동의·권한 확인 후 소규모 형식 검수. 아직 상용 허가로 승격 금지.
3. **무료/연구용 데이터 접근**: FaceSkin-Q Google Form에 상용 모델/국내 서버 사용 가능 여부 질의. 원본 권리·민감사진 외부 공유 불가 조건 우선.
4. **유료 견적 필요성 비교**: Nexdata 7,262 (위치 박스) ↔ Rupam 50k (등급), 카테고리별 10개 **샘플 라벨**과 계약서/해외처리권한/독립 피험자 수를 받아 비교. 위치가 목적인데 등급만 있는 비싼 데이터를 잘못 구매하지 말 것.
5. **핵심 데이터 공백 해결**: 모공 **실제 픽셀 마스크**, 볼/코 **미세 각질**, 광택 조명 구별은 공개 데이터만으로 보장되지 않으므로 별도 명시적 동의 및 전문가 annotation pilot이 필요.
6. **정량 검증**: per-concern sensitivity/precision and masking IoU or MAE, 피부톤/디바이스/조명별 오류, calibration error 측정; 일반 얼굴 사진과 근접 패치 사진 품질 차이 명시. 같은 대상자·세션·파생사진은 서로 다른 split으로 배분하지 않는다.

## 2026-10-23 collection execution status (DO NOT infer download success)

| Source | Current result | Remaining action |
| --- | --- | --- |
| MEMI-DS (figshare) | Publisher metadata/download API endpoint identified; **not downloaded** in connected environment (public Figshare returned HTTP 403 through research browser, no working general-purpose download runtime). Local-only fetch/size/SHA256 script added at `scripts/acquire-skin-open-dataset.mjs`. | On permitted local machine: `node scripts/acquire-skin-open-dataset.mjs --inspect` to confirm actual file names, sizes and article terms. Download only after approving image/face data rights using `--download --license-reviewed --out <private-local-directory>`. Then inspect zip images/masks and source rights. |
| FaceSkin-Q | Official SGA-UNet README verified author **Google Form** application at https://forms.gle/Df8r7Dxf9yanb95j7 ; data are access-requested, **not acquired**. | Authorized applicant submits the form and receives a research/commercial use statement; do not bypass access. A Gmail draft to one proposed investigator address was **not created** because authorization was denied by the provider tool; no email sent. |
| Nexdata 7,262 | Official vendor README verified proprietary **Commercial License**, 7,262 JPEG+JSON, 2,499,771 boxes. **Not purchased/downloaded**. | Quote/sample request draft created in connected Gmail (not sent). Obtain 10 anonymized annotation examples, label definitions, class counts, consent, cross-border and commercial training rights before paying. |
| NIA model checkpoints | Author website/candidate access investigated; **no checkpoint downloaded**, vendor/original data rights unknown. | Gmail inquiry draft created (not sent); confirm exact checkpoint artifacts, licensing, subject split and overlap with existing AI-Hub. |
| Rupam dataset | Published paid-data license reviewed; **not purchased or downloaded**. | Obtain example labels, pricing and commercial rights for images and trained weights. |
| Original AI-Hub | Prior connected Drive discovery: TL and VL archives and 1,391 validation photos, without a verified TS training-photo location. | Do not describe TS as downloaded. Needs separate source/approved location check. |

**Collection status definitions:** `catalogued` (source and label schema published), `access-request-ready` (contact form/draft), `metadata-inspected` (real download API/file metadata returned), `downloaded` (file bytes + hash recorded), `label-verified` (raw sample image and true annotation pair validated), `cleared-for-commercial-use` (documented original photo/privacy and model-license approval). None of the NEW external dataset candidates has reached the last three states here.

**Contact drafts are not sent emails.** Never record a request as submitted unless the user/provider confirms it. Do not copy full external face-photo datasets into public GitHub commits or PR artifacts.
