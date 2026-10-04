# Bounded Android listener backport

These four sources are copied without semantic changes from Software Mansion's
[PR #4413](https://github.com/software-mansion/react-native-screens/pull/4413),
merge `b3badd012f83679b12f4e29f2e28eceaa4830efd`.
The installed npm package is **4.26.2**, declared by Expo's `~4.26.0` range.
The pre-fix sources match upstream `244e348c6a2c9568515371b849960cd5da2a08ec`.
Upstream `cpp/legacy/` maps to this package's `cpp/`. MIT license is retained.

`manifest.json` records each original/replacement SHA-256, normalized to LF.
`fixtures/` preserves originals for deterministic guard tests; it is never copied into a build.
The guard resolves the actual mobile dependency, requires all-original or all-patched
state, and rejects version/source drift before mutation. Replacement failure rolls
back already-written files; an interrupted process requires a clean install.
There is no runtime download, dependency upgrade, or global install hook.

Only the existing Android debug, unsigned preflight and signed build owners invoke
the guard after clean installation and before prebuild. Signing credentials and
release authorization remain governed by their existing contracts.
