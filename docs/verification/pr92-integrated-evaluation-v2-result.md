# PR92 Integrated Evaluation V2 Gate

- Commit: `7ecb97a61729cd6558ec94b8136dddf50e015896`
- Runner: `Linux`
- Node target: `24`

## npm ci

PASS

## syntax

PASS

## integrated evaluation v2

FAIL (exit 1)

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

FAIL (exit 1)

## candidate goal alignment

PASS

## candidate current findings

PASS

## architecture guard

PASS

## optimized build

FAIL (exit 1)

## diff hygiene

PASS

## Result

PR92_INTEGRATED_EVALUATION_V2_GATE_FAIL

## Log tail

```text

Error: Candidate current findings context invalid: candidate_current_findings_shared_context_version_invalid
    at buildCandidatePolicyCurrentFindingsContext (file:///home/runner/work/K_beauty/K_beauty/lib/candidate-policy-current-findings-context.js:304:11)
    at buildCandidatePolicyGoalContext (file:///home/runner/work/K_beauty/K_beauty/lib/candidate-policy-goal-context.js:107:34)
    at goalContext (file:///home/runner/work/K_beauty/K_beauty/scripts/verify-candidate-policy-runtime-safety-hardening.mjs:92:10)
    at runtime (file:///home/runner/work/K_beauty/K_beauty/scripts/verify-candidate-policy-runtime-safety-hardening.mjs:126:27)
    at materializeEvidence (file:///home/runner/work/K_beauty/K_beauty/scripts/verify-candidate-policy-runtime-safety-hardening.mjs:177:10)
    at file:///home/runner/work/K_beauty/K_beauty/scripts/verify-candidate-policy-runtime-safety-hardening.mjs:270:15
    at ModuleJob.run (node:internal/modules/esm/module_job:439:25)
    at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
    at async node:internal/modules/esm/loader:643:26
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5)

Node.js v24.18.0
### candidate goal alignment

> k-beauty-ai-skin-test@0.1.0 verify:candidate-policy-goal-alignment
> node scripts/verify-candidate-policy-goal-alignment.mjs

(node:2334) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///home/runner/work/K_beauty/K_beauty/lib/candidate-policy-goal-context.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /home/runner/work/K_beauty/K_beauty/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
{"status":"PASS","verifier":"candidate-policy-goal-alignment","assertionCount":403,"scenarioCount":18,"matrixCombinationCount":128,"negativeControlCount":12,"semanticHashFirst":"59f4ecb480d18ea410f4bdf0c7d501e63b3a971e688946a7b1f439cf47eb84a9","semanticHashSecond":"59f4ecb480d18ea410f4bdf0c7d501e63b3a971e688946a7b1f439cf47eb84a9","cleanupCompleted":true}
### candidate current findings

> k-beauty-ai-skin-test@0.1.0 verify:candidate-policy-current-findings
> node scripts/verify-candidate-policy-current-findings-integration.mjs

(node:2357) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///home/runner/work/K_beauty/K_beauty/lib/candidate-policy-current-findings-context.js is not specified and it doesn't parse as CommonJS.
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
 ✓ Compiled successfully in 21.1s
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

(node:2527) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///home/runner/work/K_beauty/K_beauty/lib/candidate-policy-goal-context.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /home/runner/work/K_beauty/K_beauty/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
node:internal/modules/run_main:107
    triggerUncaughtException(
    ^

AssertionError [ERR_ASSERTION]: functional hold

'START' !== 'HOLD'

    at equal (file:///home/runner/work/K_beauty/K_beauty/scripts/verify-premium-integrated-evaluation-v2.mjs:59:10)
    at file:///home/runner/work/K_beauty/K_beauty/scripts/verify-premium-integrated-evaluation-v2.mjs:402:3
    at scenario (file:///home/runner/work/K_beauty/K_beauty/scripts/verify-premium-integrated-evaluation-v2.mjs:73:3)
    at file:///home/runner/work/K_beauty/K_beauty/scripts/verify-premium-integrated-evaluation-v2.mjs:387:1
    at ModuleJob.run (node:internal/modules/esm/module_job:439:25)
    at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
    at async node:internal/modules/esm/loader:643:26
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5) {
  generatedMessage: false,
  code: 'ERR_ASSERTION',
  actual: 'START',
  expected: 'HOLD',
  operator: 'strictEqual',
  diff: 'simple'
}

Node.js v24.18.0
### diff hygiene
```
