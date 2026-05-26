# PROJECT_SYNC_RULES

이 문서는 비주얼리 프로젝트의 브랜치 운영, 집/학원 PC 동기화, 원격 기준 판단 규칙만 다룬다.

세부 기능, 데이터 파이프라인, 크롤링, AI 문서 구조, 특정 브랜치 상태는 이 문서에 넣지 않는다.

---

## 1. 기준본 원칙

- 기준본은 항상 GitHub 원격 브랜치다.
- 집 PC와 학원 PC는 작업 환경일 뿐, 기준본이 아니다.
- 현재 작업 브랜치의 기준은 `origin/<current-branch>`다.
- 로컬 상태가 헷갈리면 로컬 판단보다 원격 브랜치 기준으로 확인한다.
- 프로젝트 폴더째 복사/덮어쓰기로 동기화하지 않는다.
- 특정 feature 브랜치명을 이 문서에 고정하지 않는다.

---

## 2. 작업 시작 전 체크 및 집/학원 공통 루틴

작업 시작 전에는 반드시 현재 브랜치와 원격 차이를 확인한다.

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

현재 브랜치가 작업하려는 브랜치가 아니면 작업 대상 브랜치를 확인한 뒤 전환한다.

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
- 작업 브랜치명은 고정하지 않는다.

---

## 3. 작업 종료 전 체크

작업 종료 전에는 현재 변경 상태와 원격 반영 필요 여부를 확인한다.

```bash
git status
git log --oneline -n 5
git rev-list --left-right --count HEAD...origin/<current-branch>
```

원칙:

- 코드 변경이 있으면 push 전 `npm run build`를 실행한다.
- 문서-only 변경이라도 가능하면 `git diff --check`를 확인한다.
- 로컬이 원격보다 앞서 있으면 검증 후 push한다.
- 작업한 PC를 떠나기 전에는 가능한 한 push까지 완료한다.

---

## 4. 브랜치 운영 기준

- `main`은 배포 가능 기준으로 유지한다.
- 일반 작업은 `feature/*` 브랜치에서 진행한다.
- 긴급 수정은 `fix/*` 브랜치에서 진행한다.
- 실험은 `experiment/*` 브랜치에서 진행한다.
- 백업 브랜치는 필요한 경우에만 `backup/YYYY-MM-DD-purpose` 형식으로 만든다.
- backup 브랜치는 통째 merge하지 않는다.
- backup 브랜치에서는 필요한 파일만 선별 복구한다.

---

## 5. main과 작업 브랜치 동기화 기준

main에 새 변경이 생겼고 작업 브랜치에서 계속 작업해야 하면, main을 작업 브랜치에 먼저 반영한다.

```bash
git checkout <work-branch>
git fetch origin --prune
git merge origin/main
npm run build
```

주의:

- 위 작업은 working tree가 clean일 때만 진행한다.
- `main → work-branch`는 최신 main 반영이다.
- `work-branch → main`은 작업 완료 후 최종 병합이다.
- 두 방향을 혼동하지 않는다.

---

## 6. 금지 사항

- 프로젝트 폴더째 덮어쓰기 금지
- working tree가 dirty한 상태에서 pull 금지
- `git pull --ff-only` 실패 후 임의 merge/rebase 금지
- backup 브랜치 통째 merge 금지
- `git add .` 남발 금지
- `package.json` / `package-lock.json` 통째 복구 금지
- `supabase/config.toml` 복구 금지
- `.env*` 커밋 금지
- `node_modules`, build output, cache, browser profile, cookie, session 파일 커밋 금지
- 특정 feature 브랜치명을 장기 운영 규칙에 고정 금지
