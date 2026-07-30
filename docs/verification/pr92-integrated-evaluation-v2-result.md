# PR92 Integrated Evaluation V2 Gate

- Commit: `6cd58c051e96881ca1101e1631719d200fa8dd2f`
- Runner: `Linux`
- Node target: `24`

## npm ci

PASS

## syntax

PASS

## integrated evaluation v2

PASS

## shared context

PASS

## functional policy

PASS

## routine policy

PASS

## condition policy

PASS

## cross-domain consistency

PASS

## premium decision state

PASS

## premium report reentry

PASS

## candidate runtime safety

PASS

## candidate goal alignment

PASS

## candidate current findings

PASS

## architecture guard

PASS

## optimized build

PASS

## diff hygiene

FAIL (exit 2)

## Result

PR92_INTEGRATED_EVALUATION_V2_GATE_FAIL

## Log tail

```text
### npm ci

added 118 packages, and audited 119 packages in 13s

31 packages are looking for funding
  run `npm fund` for details

4 high severity vulnerabilities

To address issues that do not require attention, run:
  npm audit fix

To address all issues (including breaking changes), run:
  npm audit fix --force

Run `npm audit` for details.
npm warn allow-scripts 1 package has install scripts not yet covered by allowScripts:
npm warn allow-scripts   sharp@0.34.5 (install: node install/check.js || npm run build)
npm warn allow-scripts
npm warn allow-scripts Run `npm approve-scripts --allow-scripts-pending` to review, or `npm approve-scripts <pkg>` to allow.
### syntax
### integrated evaluation v2

> k-beauty-ai-skin-test@0.1.0 verify:premium-integrated-evaluation-v2
> node scripts/verify-premium-integrated-evaluation-v2.mjs

(node:2098) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///home/runner/work/K_beauty/K_beauty/lib/candidate-policy-goal-context.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /home/runner/work/K_beauty/K_beauty/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
premium integrated evaluation v2 verified: 401 assertions, 21 logical scenarios, 28 variants, 6 negative cases, semantic hash 93192f940bd50bd3e1e2fd6d58f6d03fae17b75b3e7bf1951953ce89e9c5d0eb
### shared context

> k-beauty-ai-skin-test@0.1.0 verify:shared-skin-decision-context
> node scripts/verify-shared-skin-decision-context-v4.mjs

(node:2117) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///home/runner/work/K_beauty/K_beauty/lib/shared-skin-decision-context-v4.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /home/runner/work/K_beauty/K_beauty/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
verify-shared-skin-decision-context-v4: ok (74 assertions)
### functional policy
(node:2124) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///home/runner/work/K_beauty/K_beauty/lib/functional-plan-decision.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /home/runner/work/K_beauty/K_beauty/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
verify-functional-policy-single-source: ok
### routine policy
(node:2131) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///home/runner/work/K_beauty/K_beauty/lib/routine-policy.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /home/runner/work/K_beauty/K_beauty/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
verify-routine-policy-single-source: PASS
### condition policy
(node:2138) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///home/runner/work/K_beauty/K_beauty/lib/condition-policy.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /home/runner/work/K_beauty/K_beauty/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
verify-condition-policy-single-source: PASS
### cross-domain consistency
(node:2145) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///home/runner/work/K_beauty/K_beauty/lib/cross-domain-consistency.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /home/runner/work/K_beauty/K_beauty/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
cross-domain consistency verifier passed
### premium decision state
(node:2152) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///home/runner/work/K_beauty/K_beauty/lib/premium-condition-responses.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /home/runner/work/K_beauty/K_beauty/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
verify-premium-decision-state: ok
### premium report reentry
premium report re-entry contract verification passed
(node:2159) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///home/runner/work/K_beauty/K_beauty/lib/premium-report-reentry.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /home/runner/work/K_beauty/K_beauty/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
### candidate runtime safety

> k-beauty-ai-skin-test@0.1.0 verify:candidate-policy-runtime-safety
> node scripts/verify-candidate-policy-runtime-safety-hardening.mjs

(node:2178) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///home/runner/work/K_beauty/K_beauty/lib/candidate-policy-runtime-safety.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /home/runner/work/K_beauty/K_beauty/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
{"status":"PASS","verifier":"candidate-policy-runtime-safety-hardening","assertionCount":33,"scenarioCount":12,"negativeControlCount":8,"semanticHashFirst":"17fcc29d3a3fdc24d4a3a80c1f10c63b3567e80fae8200b16b04d9e653912dce","semanticHashSecond":"17fcc29d3a3fdc24d4a3a80c1f10c63b3567e80fae8200b16b04d9e653912dce","cleanupCompleted":true}
### candidate goal alignment

> k-beauty-ai-skin-test@0.1.0 verify:candidate-policy-goal-alignment
> node scripts/verify-candidate-policy-goal-alignment.mjs

(node:2201) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///home/runner/work/K_beauty/K_beauty/lib/candidate-policy-goal-context.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /home/runner/work/K_beauty/K_beauty/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
{"status":"PASS","verifier":"candidate-policy-goal-alignment","assertionCount":403,"scenarioCount":18,"matrixCombinationCount":128,"negativeControlCount":12,"semanticHashFirst":"59f4ecb480d18ea410f4bdf0c7d501e63b3a971e688946a7b1f439cf47eb84a9","semanticHashSecond":"59f4ecb480d18ea410f4bdf0c7d501e63b3a971e688946a7b1f439cf47eb84a9","cleanupCompleted":true}
### candidate current findings

> k-beauty-ai-skin-test@0.1.0 verify:candidate-policy-current-findings
> node scripts/verify-candidate-policy-current-findings-integration.mjs

(node:2224) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///home/runner/work/K_beauty/K_beauty/lib/candidate-policy-current-findings-context.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /home/runner/work/K_beauty/K_beauty/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
candidate policy current findings integration verified: 57 assertions, 18 scenarios, 2 negative controls, semantic hash c3f0fa7eab9f05e490042fb8cb9d823236e594e2087250820956c3f0b90445be
### architecture guard

> k-beauty-ai-skin-test@0.1.0 architecture:guard
> node scripts/architecture-guard.mjs

[architecture-guard] No architecture-sensitive files changed.
Architecture docs update: not needed
Ghost-code audit: passed
### optimized build

> k-beauty-ai-skin-test@0.1.0 build
> next build

⚠ No build cache found. Please configure build caching for faster rebuilds. Read more: https://nextjs.org/docs/messages/no-cache
Attention: Next.js now collects completely anonymous telemetry regarding usage.
This information is used to shape Next.js' roadmap and prioritize features.
You can learn more, including how to opt-out if you'd not like to participate in this anonymous program, by visiting the following URL:
https://nextjs.org/telemetry

   ▲ Next.js 15.5.18

   Creating an optimized production build ...
<w> [webpack.cache.PackFileCacheStrategy] Serializing big strings (101kiB) impacts deserialization performance (consider using Buffer instead and decode when needed)
<w> [webpack.cache.PackFileCacheStrategy] Serializing big strings (231kiB) impacts deserialization performance (consider using Buffer instead and decode when needed)
 ✓ Compiled successfully in 17.0s
   Linting and checking validity of types ...
   Collecting page data ...
   Generating static pages (0/26) ...
   Generating static pages (6/26) 
   Generating static pages (12/26) 
   Generating static pages (19/26) 
 ✓ Generating static pages (26/26)
   Finalizing page optimization ...
   Collecting build traces ...

Route (app)                                                      Size  First Load JS
┌ ƒ /                                                           187 B         233 kB
├ ƒ /_not-found                                                 181 B         103 kB
├ ƒ /api/analyze                                                181 B         103 kB
├ ƒ /api/auth/signout                                           181 B         103 kB
├ ƒ /api/current-products/products                              181 B         103 kB
├ ƒ /api/face-reading                                           181 B         103 kB
├ ƒ /api/full-report                                            181 B         103 kB
├ ƒ /api/full-report/session                                    181 B         103 kB
├ ƒ /api/internal/candidate-policy-preview-kill-switch-probe    181 B         103 kB
├ ƒ /api/internal/candidate-policy-preview-runtime-probe        181 B         103 kB
├ ƒ /api/internal/production-env-preview-readiness-probe        181 B         103 kB
├ ƒ /api/my/check-in                                            181 B         103 kB
├ ƒ /api/my/dashboard                                           181 B         103 kB
├ ƒ /api/my/save-report                                         181 B         103 kB
├ ƒ /api/premium/access                                         181 B         103 kB
├ ƒ /api/results                                                181 B         103 kB
├ ƒ /api/results/[shareId]                                      181 B         103 kB
├ ƒ /api/track                                                  181 B         103 kB
├ ƒ /auth/callback                                              181 B         103 kB
├ ƒ /en                                                         186 B         233 kB
├ ƒ /en/my                                                      144 B         185 kB
├ ƒ /en/my/check-in                                           2.44 kB         112 kB
├ ƒ /en/result                                                  201 B         403 kB
├ ƒ /en/result/full-report                                      197 B         276 kB
├ ƒ /en/result/full-report/loading                              271 B         107 kB
├ ƒ /en/test-full-report                                        393 B         282 kB
├ ƒ /en/test-result                                             368 B         409 kB
├ ○ /icon.png                                                     0 B            0 B
├ ƒ /ko/my                                                      181 B         103 kB
├ ƒ /ko/my/check-in                                             181 B         103 kB
├ ƒ /loading                                                   2.7 kB         148 kB
├ ƒ /my                                                         144 B         185 kB
├ ƒ /my/check-in                                              2.44 kB         112 kB
├ ○ /opengraph-image.png                                          0 B            0 B
├ ƒ /r/[shareId]                                              2.03 kB         238 kB
├ ƒ /result                                                     200 B         403 kB
├ ƒ /result/full-report                                         196 B         276 kB
├ ƒ /result/full-report/loading                                 270 B         107 kB
├ ƒ /test-full-report                                           388 B         282 kB
├ ƒ /test-result                                                367 B         409 kB
└ ○ /twitter-image.png                                            0 B            0 B
+ First Load JS shared by all                                  102 kB
  ├ chunks/1255-b28ea36bf0cdbd65.js                           46.2 kB
  ├ chunks/4bd1b696-f785427dddbba9fb.js                       54.2 kB
  └ other shared chunks (total)                                  2 kB


ƒ Middleware                                                  92.7 kB

○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand


> k-beauty-ai-skin-test@0.1.0 postbuild
> npm run verify:premium-integrated-evaluation-v2


> k-beauty-ai-skin-test@0.1.0 verify:premium-integrated-evaluation-v2
> node scripts/verify-premium-integrated-evaluation-v2.mjs

(node:2392) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///home/runner/work/K_beauty/K_beauty/lib/candidate-policy-goal-context.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /home/runner/work/K_beauty/K_beauty/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
premium integrated evaluation v2 verified: 401 assertions, 21 logical scenarios, 28 variants, 6 negative cases, semantic hash 93192f940bd50bd3e1e2fd6d58f6d03fae17b75b3e7bf1951953ce89e9c5d0eb
### diff hygiene
docs/verification/pr92-integrated-evaluation-v2-result.md:293: trailing whitespace.
++   Generating static pages (6/26) 
docs/verification/pr92-integrated-evaluation-v2-result.md:295: trailing whitespace.
++   Generating static pages (12/26) 
docs/verification/pr92-integrated-evaluation-v2-result.md:297: trailing whitespace.
++   Generating static pages (19/26) 
```
