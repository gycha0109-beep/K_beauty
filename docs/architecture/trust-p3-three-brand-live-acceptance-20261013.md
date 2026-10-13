# TRUST P3 three-brand live observation — 2026-10-13

The P3 parser currently passes synthetic contract fixtures but has no verified real-official-page yield. This guardrail trial measures that gap without weakening source/identity/variant policy.

## Frozen cases

- Torriden DIVE IN Watery Moisture Sunscreen, 60ml, existing exact governed subject and official KR product page.
- Beauty of Joseon Relief Sun Rice + Probiotics, catalog 50ml, existing exact governed subject and official global product page.
- Aestura Derma UV365 Red Calming Tone-Up Sunscreen, catalog 40ml, exact governed subject and official KR product page.

These are **existing bound subjects**, not newly discovered SKUs. The freeze includes product ID, source ID and subject ID from an actual production Supabase read, without credentials in the live runner. `sourceKind` is not itself authorization to create a new source binding.

## Execution and evidence

Only a commit explicitly marked `P3-LIVE-TRIAL` can execute the new read-only job in the existing `trust-phase5b-7d-static.yml` CI owner. Three independent official domains receive at most robots.txt and one previously governed exact product URL each, only if same-origin, HTTPS, robots and crawl-delay policies permit; no external search and no third-party proxy. No raw page or full INCI list is stored. Actions artifact freezes HTTP status group, content digest, identity and variant gate, scoped direct claim status, and per-product blockers. Do not infer market from domain or catalog and do not treat recognized SPF/PA text as a confirmed Fact.

The acceptance criterion is truthful measurement of real official page extraction coverage with 0 new Subjects, 0 Product Fact/Recommendation writes, 0 AI API use and no bypass. A 0% yield is a blocker diagnosis, not license to weaken provenance requirements.

Next: adjudicate actual real-site output, test any supported official markup variants and only then propose P3 improvements. P4 auto-confirmation remains disabled until independently governed machine-actor permission, audit, rollback and kill-switch contracts pass.

Watchtower-Track: pipeline-reliability
