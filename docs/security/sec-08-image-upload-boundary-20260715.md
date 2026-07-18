# SEC-08 image upload decode and canonicalization boundary

## Scope

This remediation hardens the existing in-memory image flow for `/api/analyze`, `/api/face-reading`, and the optional `/api/full-report` face image. It does not add Supabase Storage, change database schema or RLS, call a hosted target, change provider contracts, or persist an original upload. Existing stored premium rows remain readable without a data migration.

`sharp` `0.34.5`, already present through Next.js in the lockfile, is now an exact direct production dependency. Routes import the decoder through `lib/server/image-upload-boundary.js`; client code imports only the cheap MIME and byte-size preflight from `lib/upload-validation.js`.

## Server validation contract

Only JPEG, PNG, and WebP are accepted. A multipart upload must be a non-empty `File`, no larger than 8MB, with an exact `image/jpeg`, `image/png`, or `image/webp` MIME. Before `formData()` parsing, a present and valid `Content-Length` that clearly exceeds the bounded multipart allowance is rejected; a missing header does not skip the later file and byte checks.

The server reads the file bytes once after the existing analysis request guard. It then requires all of the following before provider preparation:

- declared MIME, exact magic-byte format, and Sharp decoded format agree;
- Sharp metadata and a complete re-encode succeed with fail-closed decoding;
- orientation-aware width and height are each at most 8192;
- total pixels are at most 16,777,216;
- page/frame count is exactly one;
- APNG animation chunks and animated WebP chunks are absent;
- canonical output is non-empty and no larger than 8MB.

The accepted image is auto-oriented and re-encoded to the same JPEG, PNG, or WebP format. Sharp's default output metadata policy removes EXIF, ICC, comments, and other input metadata. Re-encoding also removes bytes after the decoded image. The canonical output is decoded and signature-checked again. Routes use only the returned canonical MIME, bytes, dimensions, and data URL; client MIME and original bytes are not used for provider payloads.

Decoder and parser failures return a generalized 400 response. Raw bytes, base64, data URLs, and Sharp error messages are not logged or returned.

## Premium persistence boundary

`/api/full-report` treats `imageUrl` as optional. A supplied value must be an exact base64 data URL for one of the three allowed MIME types, must fit the pre-decode encoded-length bound, and must pass the same signature, decode, dimension, frame, and canonicalization checks. Remote, blob, file, JavaScript, non-image data URLs, whitespace-bearing base64, malformed base64, and MIME/signature mismatches are rejected.

The request body is boundedly scanned for the repository's face-image aliases. Only top-level `imageUrl` may carry the new image; nested `imageUrl`, `imagePreviewDataUrl`, legacy `imagePreview`, and related face-image aliases fail closed. The canonical data URL is the only request image value passed into a new Face Lab summary and then into `premium_report_sessions` readback and account `saved_reports` persistence. Existing stored rows are not rewritten or deleted.

## Client alignment

The onboarding and Face Lab file inputs now advertise exactly `image/jpeg,image/png,image/webp`. The shared client handler rejects an empty, oversized, or differently typed file before object-URL preview and before analysis/sessionStorage flow. This client check is a UX guard only; every route invocation still performs the byte-level server validation.

## Verification

`scripts/verify-sec08-image-upload-boundary.mjs` has a frozen 55-ID case manifest, separately fixed expected count, exact catalog/observed-set checks, and one machine-readable result per case. Missing, duplicate, unknown, unobserved, failed, or count-mismatched cases prevent the PASS marker and exit non-zero.

The 55/55 run covered canonical JPEG/PNG/WebP, EXIF orientation, metadata and trailing-payload removal, route ordering, full-report projection, MIME/signature mismatches, disguised HTML/JavaScript/ZIP/PDF, truncated and malformed files, width/height/pixel limits, animated WebP, APNG, SVG/GIF/AVIF/HEIF, base64 and URL failures, canonical output limits, nested/legacy aliases, and scan depth/cycle limits. Independent OS TEMP mutations for missing, duplicate, unknown, unobserved, and expected-count mismatch all returned non-zero without the PASS marker.

The analysis result boundary, analysis RLS, premium release, analysis request guard, and provider runtime-log sanitization verifiers passed. JavaScript syntax, Playwright discovery, targeted invalid-upload smoke, all three `@smoke` tests, `npm run build`, and `git diff --check` passed. No provider, hosted Supabase, Storage, seller, production API, commit, or push action was performed.

## Residual scope

The application retains its existing 8MB source-file UX contract. Vercel's approximately 4.5MB request ingress limit can reject some uploads before application code runs; deployment-specific request limits remain a separate hosted verification and UX-alignment item. The application-side boundary does not claim to raise that infrastructure limit.

Native camera behavior, provider-side image interpretation, historical stored image cleanup, image Storage, and remote deployment verification are outside this remediation. An independent security commit gate is required before commit.
