# TRUST-P8 — Sunscreen Hosted Adoption Plan v1

> Phase A deterministic freeze only. Production Product Fact writes remain zero.

- source main: `e108ec4f0c4ac063d93f106592117456e415295c`
- upstream TRUST-P7 merge: `62ca540d22fa457bb064eca6e19fb12f1338495c`
- plan SHA-256: `305a49987c32382a36e0585ee2e41ce652395e182079db6544f4c73cfe963c8d`
- scope: 3 Subjects / 3 first-party fact sources / 6 propositions
- fact keys: `spf_value`, `uva_label`
- La Roche-Posay Anthelios Sun Fluid: excluded (`FACT_SOURCE_RECOVERY_REQUIRED`)

`content_digest` hashes the stable TRUST-P7 frozen source observation, not live webpage bytes. Proposition keys reuse `product-fact-proposition-pilot-v1` and include the frozen variant in scope. Beauty of Joseon uses `GLOBAL` fact scope; the two AESTURA products use KR fact scope, with international first-party claims narrowed only through their separately frozen KR identity pages.

Phase B remains unauthorized here. After exact-head CI and merge, Production must still show all three targets at Subject 0 / Current 0 before the controlled RPC sequence can run. All six confirmation preflights must be ready before any confirmation. Direct Product Fact DML, schema/RPC/Registry mutation, new fact kinds, recommendation/ranking changes, and La Roche SPF/PA inference remain forbidden.
