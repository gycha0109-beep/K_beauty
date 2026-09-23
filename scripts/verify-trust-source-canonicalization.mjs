#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  canonicalizeOfficialHtmlTextV1,
  digestOfficialContent,
} from "../lib/trust/official-source-fetch.mjs";

const a = Buffer.from(`<!doctype html>
<html><head>
<script nonce="abc">window.__nonce="abc";</script>
<style>.x{color:red}</style>
</head><body>
<!-- request-id: one -->
<main data-request="111">
<h1>Birch Moisturizing Soothing Gel</h1>
<p>Hydrating gel &amp; soothing care.</p>
</main>
</body></html>`);

const b = Buffer.from(`<!doctype html>
<html><head>
<script nonce="xyz">window.__nonce="xyz";</script>
<style>.x{color:blue}</style>
</head><body>
<!-- request-id: two -->
<main data-request="999">
<h1>Birch   Moisturizing Soothing Gel</h1>
<p>Hydrating gel &amp; soothing care.</p>
</main>
</body></html>`);

const changed = Buffer.from(`<!doctype html><html><body>
<main><h1>Birch Moisturizing Soothing Gel</h1>
<p>Hydrating gel &amp; soothing care with a changed formula.</p></main>
</body></html>`);

const canonicalA = canonicalizeOfficialHtmlTextV1(a);
const canonicalB = canonicalizeOfficialHtmlTextV1(b);
assert.equal(canonicalA, canonicalB, "volatile markup must not change canonical text");

const digestA = digestOfficialContent(a, "canonical-html-text", "v1");
const digestB = digestOfficialContent(b, "canonical-html-text", "v1");
const digestChanged = digestOfficialContent(changed, "canonical-html-text", "v1");
assert.equal(digestA.digestBasis, "canonical-html-text-v1");
assert.equal(digestA.digest, digestB.digest, "equivalent visible text must hash identically");
assert.notEqual(digestA.digest, digestChanged.digest, "visible semantic text change must alter digest");

const rawA = digestOfficialContent(a, "live-page-bytes", "v1");
const rawB = digestOfficialContent(b, "live-page-bytes", "v1");
assert.notEqual(rawA.digest, rawB.digest, "raw byte adapter must preserve byte-level differences");

assert.throws(
  () => digestOfficialContent(a, "unsupported", "v1"),
  /SOURCE_VERIFICATION_PROFILE_ADAPTER_UNSUPPORTED/
);

console.log("TRUST_PHASE8G_CANONICAL_HTML_ADAPTER_VERIFIED");
