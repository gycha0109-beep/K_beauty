# Dependency Security Triage and Remediation Result

## 1. Scope

This change remediates the four high-severity package findings reported by `npm audit` at CandidateExposurePolicy Stage 11M final Head.

```text
base SHA: 87e3c6b8028b50b84a8bff7f2fc43087b2b78a20
package remediation commit: 4d5a8b1d6c81772eab34685209fbb34f40d898ec
baseline audit: 4 high, 0 critical
product-file boundary: package.json + package-lock.json
application code changes: 0
Production changes: 0
```

The four findings were package-level findings, not four independent vulnerabilities:

```text
next       direct runtime dependency
postcss    direct build dependency and Next transitive dependency
sharp      direct runtime dependency and Next optional dependency
picomatch  transitive build dependency
```

## 2. Baseline findings

### next 15.5.18

The baseline was within advisory ranges covering Server Action denial of service, custom-server Server Action SSRF, rewrite destination SSRF, cache confusion, Edge Server Action payload handling, image optimization SVG denial of service, and Server Function endpoint disclosure.

Repository inspection found no `"use server"` directive and no custom rewrite configuration. This reduces observed reachability for several advisories but does not make the vulnerable runtime acceptable for integration.

### postcss 8.5.8 / 8.5.10

The baseline graph contained a root PostCSS version and a separate Next-nested PostCSS version within advisory ranges for unsafe `sourceMappingURL` handling and CSS stringify output.

Repository inspection found no direct `postcss.parse` use and no user-controlled CSS processing path. The package remains part of the build toolchain and was upgraded.

### sharp 0.34.5

The baseline graph contained direct and Next-nested Sharp installations below 0.35.0, affected by inherited libvips advisories.

Repository inspection found no direct Sharp import. Next image optimization still loads Sharp as a runtime component, so both direct and nested copies were unified at a fixed version.

### picomatch 2.3.1 / 4.0.3

The transitive Tailwind toolchain contained Picomatch versions affected by incorrect glob matching and ReDoS advisories. The lockfile was refreshed to fixed versions.

## 3. Remediation

```text
next:                   15.5.18 -> 15.5.22
sharp:                  0.34.5  -> 0.35.3
postcss:                8.5.x   -> 8.5.25
next override postcss:  8.5.10  -> 8.5.25
next override sharp:    absent  -> 0.35.3
picomatch:              2.3.1   -> 2.3.2
picomatch nested:       4.0.3   -> 4.0.5
nanoid lock refresh:    3.3.11  -> 3.3.17
```

The Next-specific Sharp override is required because upgrading only the direct Sharp dependency leaves Next's optional nested Sharp installation vulnerable.

## 4. Resolved graph

```text
next@15.5.22
├── postcss@8.5.25 deduped
└── sharp@0.35.3 deduped

postcss@8.5.25
sharp@0.35.3
picomatch@2.3.2
picomatch@4.0.5
```

## 5. Validation evidence

Baseline evidence collection:

```text
GitHub Actions run: 30867908477
artifact: 8876800176
artifact SHA-256: e1705b29be56cb75bf12fd6b8a9e6608cbb8f10ba1312b151d354aa185e0d04c
```

Validated and published remediation candidate:

```text
GitHub Actions run: 30868613935
job: 91865714696
artifact: 8877061116
artifact SHA-256: b9028d01375aa6104a97cae6a613e1c1e5b4c749503fe52f34b7f4d731a1bb59
exact product-file boundary: PASS, 2 files
npm ci: PASS
npm audit: PASS, 0 vulnerabilities
security-closeout preparation: PASS, 16/16
security-closeout verifiers: PASS, 61/61
architecture guard: PASS
ghost-code audit: PASS
Next.js 15.5.22 production build: PASS
static pages: PASS, 26/26
Next image optimization smoke: PASS, HTTP 200 image/png
```

The image smoke exercised:

```text
/_next/image?url=%2Ficon.png&w=64&q=75
```

This verifies that the Sharp 0.35.3 override is compatible with the current Next 15.5.22 image optimization path for the repository's PNG fixture.

## 6. Boundaries

```text
application source changes: 0
API contract changes: 0
database changes: 0
Hosted diagnostic requests: 0
Provider calls: 0
Production changes: 0
merge: not performed
```

This result proves the audited dependency graph is clean at the recorded npm registry state and that the repository's current verifier/build/image-smoke suite passes. It does not prove that future advisories will remain absent.

## 7. Final status

```text
dependency_security_advisories_remediated_audit_clean_full_validation_pass
```
