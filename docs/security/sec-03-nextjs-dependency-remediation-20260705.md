# SEC-03 Next.js 의존성 취약점 최소 보정

## 1. 작업 목적

`npm audit --omit=dev --json`에서 확인된 Next.js 관련 production 취약점을 Next.js 15.5 패치 라인 안에서 보정한다. React, React DOM, Supabase, OpenAI SDK, API route, 데이터베이스, 환경변수, 배포 설정은 범위에서 제외했다.

## 2. 작업 전 production dependency 상태

| 항목 | manifest 범위 | lockfile 실제 버전 | 비고 |
| --- | --- | --- | --- |
| Next.js | `^15.0.0` | `15.5.14` | App Router framework direct dependency |
| React | `^19.0.0` | `19.2.4` | 변경 대상 아님 |
| React DOM | `^19.0.0` | `19.2.4` | 변경 대상 아님 |

작업 전 production audit 요약은 High 1건, Moderate 1건, 총 2건이었다.

## 3. audit에서 확인된 실제 취약점

| package | installed version | severity | dependency path | advisory / fixed range | production 영향 |
| --- | --- | --- | --- | --- | --- |
| `next` | `15.5.14` | High | `node_modules/next` | `GHSA-q4gf-8mx6-v5v3` `<15.5.15`, `GHSA-8h8q-6873-q5fj` `<15.5.16`, `GHSA-26hh-7cqf-hhc6` `<15.5.18`, 그 외 High advisory도 15.5.16 이전 범위 | 직접 production dependency |
| `postcss` | `8.4.31` | Moderate | `node_modules/next/node_modules/postcss` | `GHSA-qx2v-qp2m-jg93`, `<8.5.10` | Next.js가 고정한 transitive production dependency |

`postcss@8.5.8`은 root dev toolchain에도 존재하지만, 위 audit finding은 그 패키지가 아니라 Next.js 하위의 `8.4.31` 노드였다. `npm audit fix --omit=dev --dry-run`의 비강제 계획은 최신 15.5 patch인 15.5.20을 선택했지만, actual advisory의 가장 높은 High fixed boundary는 15.5.18이다. 따라서 최종 변경은 15.5.18과 별도 PostCSS override로 최소화했다.

## 4. 적용한 변경

| 항목 | 변경 전 | 변경 후 | 변경 이유 |
| --- | --- | --- | --- |
| `next` | `^15.0.0` / lockfile `15.5.14` | exact `15.5.18` | 같은 15.5 패치 라인에서 audit의 가장 높은 High fixed boundary인 `15.5.18`을 정확히 적용한다. 더 높은 patch, minor, major로 이동하지 않는다. |
| `overrides.next.postcss` | 없음 | `8.5.10` | Next.js가 pin한 vulnerable `8.4.31`에만 advisory의 최소 fixed version을 적용한다. root PostCSS, React, React DOM은 변경하지 않는다. |
| `package-lock.json` | Next 15.5.14 tree | Next 15.5.18 tree 및 nested PostCSS 8.5.10 | npm install로 생성했다. Next의 `@next/env`와 플랫폼별 SWC 패키지는 framework version sync에 따라 함께 갱신됐다. |

`next@15.5.18`과 `postcss@8.5.10`은 각각 이 작업에서 필요한 최소 안전 범위로 고정했다. `latest`, major upgrade, `npm audit fix --force`, 수동 lockfile 편집은 사용하지 않았다.

## 5. 변경하지 않은 dependency

* React와 React DOM은 lockfile의 `19.2.4`를 유지했다. Next.js 15.5.18의 peer dependency 범위와 호환되며, 이번 audit 해결에 별도 변경이 필요하지 않았다.
* Supabase, OpenAI SDK, framer-motion, Playwright, Tailwind, Autoprefixer 등은 변경하지 않았다.
* `npm outdated`에는 최신 major 또는 unrelated update가 표시되지만, 이번 범위는 Next.js production 취약점 보정이므로 후속 작업으로 분리한다.

## 6. 검증 결과

| 검증 | 결과 |
| --- | --- |
| `npm install --ignore-scripts` | 통과, Next.js 15.5.18 및 nested PostCSS override lockfile 반영 |
| `npm ls next react react-dom --depth=0` | `next@15.5.18`, `react@19.2.4`, `react-dom@19.2.4` |
| `npm ls next postcss --all` | `next@15.5.18` 하위 `postcss@8.5.10 overridden` 확인 |
| `npm audit --omit=dev --json` | production vulnerabilities 0건 |
| `npm run build` | 통과, Next.js 15.5.18 production build 완료 |
| `npm run lint` | 미통과. 기존 `next lint`가 ESLint 초기 설정 대화형 prompt를 열었고, 설정 변경 금지 원칙에 따라 선택하지 않고 종료했다. |
| test/typecheck | `package.json`에 독립 script가 없어 미실행 |

## 7. 남은 위험 및 배포 전 확인

* Vercel 또는 실제 hosting 환경에서 lockfile 기반으로 재설치하고 production build를 재확인한다.
* 배포 후 `/my` 보호 route, 공유 report route, 이미지 최적화, 분석 API의 smoke test를 수행한다. 실제 사용자 데이터나 provider 호출은 포함하지 않는다.
* `overrides.next.postcss`는 Next.js 15.5의 pin을 보안 fixed version으로 제한하는 조치다. 향후 Next.js patch release가 patched PostCSS를 직접 포함하면 override를 재검토한다.
* Next.js security advisory와 15.5 backport 종료 여부를 정기적으로 모니터링하고, 향후 major upgrade는 별도 호환성 작업으로 진행한다.

## 8. 결론

작업 전 production audit의 High 1건과 Moderate 1건은 모두 해소되어 `npm audit --omit=dev --json` 결과가 0건이 됐다. Next.js major/minor, React 계열, 애플리케이션 코드는 변경하지 않았으며, 남은 위험은 배포 환경의 재현 build 및 smoke test 확인이다. 다음 권장 보안 작업은 SEC-02 analysis table RLS/grant 배포 검증이다.
