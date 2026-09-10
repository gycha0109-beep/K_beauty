# 2026-09-11 / DATA-OFFER4 seller observation persistence

- Task type: execution / raw seller observation persistence authority. Production deployment, retailer capture, Product binding, Product Fact Subject binding, Offer materialization, recommendation ranking, and read-path activation are excluded.
- Initial baseline: main `e108ec4f0c4ac063d93f106592117456e415295c`, immediately after DATA-OFFER3 merge closure.
- Fresh-main refresh: before PR verification, main advanced by one unrelated TRUST-P8 commit to `ed2b5204f4bd48207e7881974d8041610fabd547`. The advance added five TRUST-P8 files with no overlap with DATA-OFFER4. The branch was fast-forwarded to GitHub's verified merge commit containing both that fresh main and the DATA-OFFER4 head; all prior head CI is discarded and only the resulting refreshed exact head is admissible.
- Source contract: persisted rows originate from the strict Product-agnostic `seller_listing_observation_v1` contract. The mapper accepts no weaker or alternate shape.
- Persistence table: `public.seller_listing_observations` stores one immutable observation event per insert with generated `observation_id` and ingestion `created_at`; source observation time remains `observed_at`.
- Identity separation: the table and mapper contain no `product_id`, `product_subject_id`, or `offer_id`. Raw seller observations cannot self-bind to Product, Product Fact Subject, or current Offer identity.
- Append-only authority: no natural uniqueness is imposed on seller/listing/time, so repeated independent observations are preserved rather than collapsed. `service_role` receives only SELECT and INSERT table privileges. UPDATE and DELETE are additionally blocked by an immutable trigger.
- Evidence preservation: nullable `listing_id` remains nullable; absent price remains a paired null amount/currency; `unknown` availability remains unknown; no price or stock state is inferred during persistence.
- DB defenses: seller/listing/source length and trimming constraints, HTTPS listing locator check, non-negative price, paired amount/currency, uppercase three-letter currency, governed availability enum, mandatory `observed_at`, and mandatory nonblank `source_version`.
- Verification: deterministic mapper verifier checks exact persisted shape and forbidden identity fields. Isolated Supabase runtime checks private access, repeat preservation, null-evidence preservation, absent Product/Subject/Offer columns, mutation denial, and database constraints.
- Production safety: repository search found no automatic `supabase db push` or migration-up path. This migration is checked in for isolated verification only; Production schema/data writes in this task are zero.
- Next boundary: after this persistence layer closes, add an explicitly reviewed seller capture adapter that produces `seller_listing_observation_v1`. Product binding and Offer write authority remain later independent gates.
- Context promotion candidate: none.
