#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  DOCUMENT_LOCALE_HEADER_NAME,
  normalizeDocumentLocale,
  resolveDocumentLocale
} from "../lib/document-locale.js";

assert.equal(DOCUMENT_LOCALE_HEADER_NAME, "x-bejewely-locale");
assert.equal(resolveDocumentLocale("/"), "ko");
assert.equal(resolveDocumentLocale("/result"), "ko");
assert.equal(resolveDocumentLocale("/en"), "en");
assert.equal(resolveDocumentLocale("/en/"), "en");
assert.equal(resolveDocumentLocale("/en/result"), "en");
assert.equal(resolveDocumentLocale("/english"), "ko");
assert.equal(resolveDocumentLocale("/enough"), "ko");
assert.equal(normalizeDocumentLocale("en"), "en");
assert.equal(normalizeDocumentLocale("ko"), "ko");
assert.equal(normalizeDocumentLocale("invalid"), "ko");
assert.equal(normalizeDocumentLocale(null), "ko");

const [middlewareSource, layoutSource, clientSyncSource, englishPageSource] = await Promise.all([
  readFile(new URL("../middleware.js", import.meta.url), "utf8"),
  readFile(new URL("../app/layout.js", import.meta.url), "utf8"),
  readFile(new URL("../components/i18n/DocumentLocaleSync.jsx", import.meta.url), "utf8"),
  readFile(new URL("../app/en/page.js", import.meta.url), "utf8")
]);

assert.match(middlewareSource, /DOCUMENT_LOCALE_HEADER_NAME/);
assert.match(middlewareSource, /resolveDocumentLocale\(request\.nextUrl\.pathname\)/);
assert.match(middlewareSource, /const localeRequestHeaders = getLocaleForwardedRequestHeaders\(request\);/);
assert.ok(
  middlewareSource.indexOf("const localeRequestHeaders = getLocaleForwardedRequestHeaders(request);") <
    middlewareSource.indexOf("if (isDocumentRequest(request))"),
  "locale headers must be prepared before document classification"
);
assert.match(
  middlewareSource,
  /return updateSession\(request, \{\s*requestHeaders: localeRequestHeaders\s*\}\);/
);
assert.match(layoutSource, /requestHeaders\.get\(DOCUMENT_LOCALE_HEADER_NAME\)/);
assert.match(layoutSource, /<html lang=\{locale\}/);
assert.match(layoutSource, /<DocumentLocaleSync \/>/);
assert.match(clientSyncSource, /document\.documentElement\.lang = resolveDocumentLocale\(pathname\)/);
assert.match(englishPageSource, /canonical: "\/en"/);
assert.match(englishPageSource, /"ko-KR": "\/"/);
assert.match(englishPageSource, /"en-US": "\/en"/);

console.log("Document locale contract: PASS");
