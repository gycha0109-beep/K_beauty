# PROJECT_SYNC_RULES

이 문서는 비주얼리 프로젝트의 **집 PC / 학원 PC / 브랜치 / 로컬 데이터 / Codex 문서 동기화 기준**이다.

목표는 다음과 같다.

- 집과 학원 로컬 상태가 뒤엉키는 상황 방지
- `main` / 작업 브랜치 혼동 방지
- `.gitignore` 때문에 작업물이 사라지거나 숨어 보이는 문제 방지
- 화해 데이터, Chrome profile, env, AI 문서가 섞이는 문제 방지
- Codex에게 일관된 기준 제공

---

## 1. 기준본 원칙

- 기준본은 항상 **GitHub 원격 브랜치**다.
- 집 PC와 학원 PC는 작업 환경일 뿐, 기준본이 아니다.
- 현재 작업 브랜치의 기준은 항상 `origin/<current-branch>`다.
- 로컬 상태가 헷갈리면 로컬 판단보다 원격 브랜치 기준으로 확인한다.
- 프로젝트 폴더째 복사/덮어쓰기로 동기화하지 않는다.

```text
기준본 = origin/<current-branch>
집 PC = 작업 환경 A
학원 PC = 작업 환경 B
```

---

## 2. 작업 시작 전 체크 및 집/학원 공통 루틴

작업 시작 전에는 반드시 현재 브랜치와 원격 차이를 확인한다.
집 PC와 학원 PC 어느 환경에서 작업을 시작할 때도 같은 루틴을 따른다.

```bash
git branch --show-current
git status
git fetch origin --prune
git rev-list --left-right --count HEAD...origin/<current-branch>
```

해석:

```text
0 0 = 로컬과 원격이 동기화됨. 작업 가능.
0 N = 원격이 앞서 있음. git pull --ff-only 후 작업.
N 0 = 로컬이 앞서 있음. push 필요 여부 확인.
N M = 로컬과 원격이 갈라짐. 작업 중단 후 진단.
```

현재 브랜치가 작업하려는 브랜치가 아니면 먼저 작업 대상 브랜치를 확인한 뒤 전환한다.

```bash
git checkout <target-branch>
```

전환 후 다시 확인한다.

```bash
git status
git rev-list --left-right --count HEAD...origin/<target-branch>
```

원칙:

- working tree가 clean이 아니면 pull하지 않는다.
- pull은 기본적으로 `git pull --ff-only`만 사용한다.
- `git pull --ff-only`는 `git status`가 clean이고 원격 차이가 `0 N`일 때만 실행한다.
- `git pull --ff-only`가 실패하면 merge/rebase를 임의 실행하지 말고 즉시 중단한 뒤 원인을 진단한다.
- `main`에서 바로 기능 작업하지 않는다.
- 작업 브랜치명은 고정하지 않는다. 항상 현재 작업 대상 브랜치를 기준으로 판단한다.

---

## 3. 작업 종료 전 체크

최종 동기화를 한다고 하면 아래 순서로 확인한다.

```bash
npm run build
git status
git log --oneline -n 5
```

문제 없으면 원격에 push한다.

```bash
git push
```

원칙:

- push 전 working tree가 clean인지 확인한다.
- build 실패 상태로 push하지 않는다.
- 단, 명시적으로 WIP 공유가 필요한 경우는 예외로 기록한다.

---

## 4. 파일 관리 기준

### Git에 포함할 파일

프로젝트 재현과 운영에 필요한 파일은 Git에 포함한다.

`.env*`, `node_modules`, build output, 브라우저 프로필, 캐시성 파일은 Git에 올리지 않는다.

### 선별 데이터 기준

- 재사용 가능한 작은 문서/CSV/fixture는 Git 후보.
- 대용량 raw dump, 임시 JSON, 브라우저 자동화 부산물은 `_local_data/`로 보낸다.
- 화해 원본과 실행 부산물은 Git에 넣지 않는다.
- DB import에 필요한 최종 정리본은 Git 포함 가능하다.
- 특정 데이터 파이프라인의 raw/output 기준은 해당 `data/**/README.md` 또는 `notes.md`에 둔다.

---

## 5. 브랜치 운영 기준

- `main`은 배포 가능 기준으로 유지한다.
- 일반 작업은 `feature/*` 브랜치에서 진행한다.
- 긴급 수정은 `fix/*` 브랜치에서 진행한다.
- 실험은 `experiment/*` 브랜치에서 진행한다.
- 백업 브랜치는 `backup/YYYY-MM-DD-purpose` 형식으로 만든다.
- 흐름이 불명확한 백업 브랜치는 만들지 않는다.

예시:

```text
feature/<feature-name>
feature/hwahae-data-pipeline
fix/error-state
experiment/free-result-ui
backup/2026-05-27-home-leftovers
```

원칙:

- backup 브랜치는 통째 merge하지 않는다.
- backup 브랜치에서는 필요한 파일만 선별 복구한다.
- `package.json`, `package-lock.json`, `supabase/config.toml`은 backup에서 통째 복구하지 않는다.
- 특정 feature 브랜치가 main에 merge되어 없어져도 이 문서는 계속 유효해야 한다.

---

## 6. main과 작업 브랜치 동기화 기준

`main`에 새 변경이 생겼고 작업 브랜치에서 계속 작업해야 하면, `main`을 작업 브랜치에 먼저 반영한다.

```bash
git checkout <working-branch>
git fetch origin --prune
git merge origin/main
npm run build
```

단, working tree가 clean이 아니면 먼저 진단한다.

주의:

- `main -> working branch`는 최신 main 반영이다.
- `working branch -> main`은 작업 완료 후 최종 병합이다.
- 두 방향을 혼동하지 않는다.
- 이 문서에서는 특정 feature 브랜치명을 기준으로 쓰지 않는다.

---

## 7. 로컬 데이터 위치

로컬 데이터와 화해 부산물은 Git 포함 전 별도 진단한다.

예명은 `local_data/`

---

## 8. 금지 사항

- 프로젝트 폴더째 덮어쓰기 금지
- `git add .` 남발 금지
- working tree가 dirty한 상태에서 pull 금지
- backup 브랜치 통째 merge 금지
- `package.json` / `package-lock.json` 통째 복구 금지
- `supabase/config.toml` 복구 금지
- Chrome profile / cookie / session / cache 커밋 금지
- `.codex/` 전체 ignore 금지
- `.codex/*.md` ignore 금지
- `main` 직접 작업 최소화
- 특정 feature 브랜치명을 장기 운영 기준으로 고정 금지

---

## 9. 현재 적용 기준 요약

현재 운영 판단은 다음 기준을 따른다.

- 집 PC와 학원 PC는 항상 `origin/<current-branch>`를 기준으로 맞춘다.
- 특정 feature 브랜치가 아니라 현재 작업 브랜치를 기준으로 판단한다.
- `main` 최신 변경사항이 필요하면 `main -> working branch` 방향으로 먼저 반영한다.
- 작업 브랜치 전체를 `main`에 합치는 작업은 별도 최종 단계로 둔다.
- 집/학원 중 한쪽에서 작업을 끝내면 가능한 한 push까지 완료한다.
- 다음 작업자는 항상 `git fetch origin --prune`과 원격 차이 확인으로 시작한다.
