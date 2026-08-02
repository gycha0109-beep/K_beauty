# 2026-08-02 — Toolkit Track #T6 Promotion Policy Implementation

- Branch: `feature/T6-promotion-policy`
- Scope: implemented the reviewed #T6 promotion policy over stored T3/T4/T5 evidence. Added strict promotion contracts, source snapshot assembly, operator re-attestation, rights review, canonical-image visual policy review, duplicate/leakage review, independent promotion review, purpose-scoped G4 derivation, append-only activation/revocation, CLI, tests, and implementation documentation.
- Review corrections: fixed G4 self-referential identity verification; added source-bound G4 verification; validated the complete T3 promotion projection and weakened-attestation rejection; cross-linked snapshot/reviews/evidence/decision/G4/status artifacts; enforced one activation root and one immutable status successor; changed revocation to verify stored G4 and activation authority; hardened status projection against duplicate, mixed, disconnected, cyclic, and branched chains.
- Verification: GitHub Actions run `30743335192` passed on Node 20 and Node 24. Synthetic test and verify suites passed `110/110`; architecture guard and production build passed.
- Boundaries: Provider/network/browser/DB/API/UI/Auth/Payment/Production changes 0; actual human review 0; G5/split/holdout 0; merge not performed.
