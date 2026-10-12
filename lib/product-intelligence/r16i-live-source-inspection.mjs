import { createHash } from "node:crypto";

/**
 * Admin-initiated reachability check for two FIXED seller URLs.
 * It intentionally does not extract checkout prices or infer options.
 * Never use the returned HTML fingerprint as a verified commercial fact.
 */
export const R16I_SOURCE_REFRESH_VERSION = "r16i-r4-d8a-source-refresh-v1";
const SOURCES = Object.freeze([
  Object.freeze({
    key: "official_single",
    label: "에스네이처 공식몰",
    url: "https://www.snature.kr/product/detail.html?product_no=151",
    allowedHosts: ["www.snature.kr", "snature.kr", "m.snature.kr"]
  }),
  Object.freeze({
    key: "hwahae_bundle",
    label: "화해 기획세트",
    url: "https://www.hwahae.co.kr/goods/45194",
    allowedHosts: ["www.hwahae.co.kr", "hwahae.co.kr"]
  })
]);
const MAX_BYTES = 512 * 1024;
const MAX_REDIRECTS = 2;
const MAX_TITLE_LENGTH = 140;
const allowedSource = (candidate, source) => {
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" && !url.username && !url.password &&
      (url.port === "" || url.port === "443") && source.allowedHosts.includes(url.hostname) &&
      url.pathname.length < 1200;
  } catch {
    return false;
  }
};
const status = (source, observedAt, state, more = {}) => Object.freeze({
  key: source.key,
  label: source.label,
  listingUrl: source.url,
  observedAt,
  state,
  checkoutPriceVerified: false,
  selectedOptionVerified: false,
  skuVerified: false,
  approvedPrice: null,
  sourceApproval: false,
  productMutationAuthorized: false,
  ...more
});
async function boundedRead(body) {
  if (!body || typeof body.getReader !== "function") return null;
  const reader = body.getReader();
  let total = 0;
  const chunks = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    return Buffer.concat(chunks.map(x => Buffer.from(x))).toString("utf8");
  } finally {
    reader.releaseLock();
  }
}
function extractTitle(html) {
  const title = html.match(/<title(?:\s[^>]*)?>([\s\S]*?)<\/title\s*>/i)?.[1] ?? "";
  return title.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().slice(0, MAX_TITLE_LENGTH);
}
function challengeDetected(html) {
  const sample = html.slice(0, 32000);
  return /captcha|cloudflare|checking your browser|automated requests|로봇이 아닙니다|보안\s*검증|enable javascript to continue|verify you are human/i.test(sample);
}

export async function inspectR16ISource(source, fetcher = fetch, observedAt = new Date().toISOString()) {
  // Callers cannot choose a destination. Accept only our frozen source identities.
  if (!SOURCES.includes(source) || !allowedSource(source.url, source)) {
    throw new Error("R16I_SOURCE_IDENTITY_NOT_ALLOWED");
  }
  let url = source.url;
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const response = await fetcher(url, {
        method: "GET",
        redirect: "manual",
        cache: "no-store",
        credentials: "omit",
        signal: AbortSignal.timeout(6500),
        headers: {
          "Accept": "text/html",
          "User-Agent": "BEJEWELY-evidence-operator-check/1.0"
        }
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        if (!location) return status(source, observedAt, "REDIRECT_WITHOUT_LOCATION");
        const next = new URL(location, url).href;
        if (!allowedSource(next, source)) return status(source, observedAt, "REDIRECT_BLOCKED");
        if (hop === MAX_REDIRECTS) return status(source, observedAt, "TOO_MANY_REDIRECTS");
        url = next;
        continue;
      }
      if (!response.ok) return status(source, observedAt, response.status === 403 || response.status === 429
        ? "ACCESS_RESTRICTED" : "HTTP_ERROR", { httpStatus: response.status });
      const contentType = response.headers.get("content-type") ?? "";
      if (!/^text\/html(?:;|$)/i.test(contentType))
        return status(source, observedAt, "UNEXPECTED_CONTENT_TYPE", { httpStatus: response.status });
      const length = Number(response.headers.get("content-length"));
      if (Number.isFinite(length) && length > MAX_BYTES)
        return status(source, observedAt, "PAGE_TOO_LARGE", { httpStatus: response.status });
      const html = await boundedRead(response.body);
      if (html === null) return status(source, observedAt, "PAGE_TOO_LARGE", { httpStatus: response.status });
      const digest = createHash("sha256").update(html, "utf8").digest("hex");
      return status(source, observedAt,
        challengeDetected(html) ? "ACCESS_RESTRICTED" : "HTML_VISIBLE_UNVERIFIED", {
          httpStatus: response.status,
          pageTitle: extractTitle(html) || null,
          rawHtmlSha256: digest,
          rawHtmlLength: Buffer.byteLength(html, "utf8"),
          inspectedUrl: url,
          // A visible HTML response is NOT proof of selected option or final checkout price.
          liveCommercialEvidence: false
        });
    }
  } catch {
    return status(source, observedAt, "NETWORK_OR_TIMEOUT_ERROR");
  }
  return status(source, observedAt, "NETWORK_OR_TIMEOUT_ERROR");
}

export async function inspectR16ISources(fetcher = fetch, observedAt = new Date().toISOString()) {
  const results = await Promise.all(SOURCES.map(source => inspectR16ISource(source, fetcher, observedAt)));
  return Object.freeze({
    version: R16I_SOURCE_REFRESH_VERSION,
    observedAt,
    sources: Object.freeze(results),
    commercialFactsApproved: false,
    checkoutVerified: false,
    offerWriteAuthorized: false,
    productWriteAuthorized: false,
    nextAction: "MANUAL_OPTION_CHECKOUT_CAPTURE_AND_OPERATOR_REVIEW"
  });
}
