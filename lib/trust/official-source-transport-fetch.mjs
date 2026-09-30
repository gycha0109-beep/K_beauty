import { assertSafeOfficialUrl } from "./official-source-fetch.mjs";

const TRANSPORT_FETCH_TIMEOUT_MS = 10_000;
const TRANSPORT_MAX_REDIRECTS = 3;
const TRANSPORT_USER_AGENT = "BEJEWELY-Trust-Transport/1.0 (+official-source-monitor)";
const TRANSPORT_TRANSIENT_HTTP = new Set([408, 425, 429]);
const TRANSPORT_TRANSIENT_DNS_CODES = new Set(["ENOTFOUND", "EAI_AGAIN"]);

export function classifyOfficialTransportSafetyFailure(rawUrl, error) {
  const code = String(error?.code || "").toUpperCase();
  if (TRANSPORT_TRANSIENT_DNS_CODES.has(code)) {
    let finalUrl = null;
    try {
      finalUrl = new URL(rawUrl).toString();
    } catch {
      // The safety parser owns invalid URL classification.
    }
    return {
      transportResult: "TRANSIENT",
      httpStatus: null,
      finalUrl,
      redirectChain: [],
      contentType: null,
      detail: `TRANSIENT_FAILURE:dns_${code.toLowerCase()}`,
      retryAfterSeconds: 300,
    };
  }

  return {
    transportResult: "BLOCKED",
    httpStatus: null,
    finalUrl: null,
    redirectChain: [],
    contentType: null,
    detail: String(error?.message || error),
    retryAfterSeconds: null,
  };
}

export async function probeOfficialTransport(rawUrl, fetchImpl = fetch) {
  let url;
  try {
    url = await assertSafeOfficialUrl(rawUrl);
  } catch (error) {
    return classifyOfficialTransportSafetyFailure(rawUrl, error);
  }

  const redirectChain = [];

  for (let redirectCount = 0; redirectCount <= TRANSPORT_MAX_REDIRECTS; redirectCount += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TRANSPORT_FETCH_TIMEOUT_MS);
    let response;

    try {
      response = await fetchImpl(url, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "user-agent": TRANSPORT_USER_AGENT,
          accept: "*/*",
        },
      });
    } catch (error) {
      clearTimeout(timer);
      return {
        transportResult: "TRANSIENT",
        httpStatus: null,
        finalUrl: url.toString(),
        redirectChain,
        contentType: null,
        detail: error?.name === "AbortError"
          ? "TRANSIENT_FAILURE:timeout"
          : "TRANSIENT_FAILURE:fetch_error",
        retryAfterSeconds: 300,
      };
    }

    clearTimeout(timer);

    const cancelBody = async () => {
      try {
        if (response.body) await response.body.cancel();
      } catch {
        // Transport monitoring never consumes response bodies.
      }
    };

    const contentType = (response.headers.get("content-type") || "").toLowerCase();
    const status = response.status;

    if ([301, 302, 303, 307, 308].includes(status)) {
      const location = response.headers.get("location");
      await cancelBody();

      if (!location || redirectCount === TRANSPORT_MAX_REDIRECTS) {
        return {
          transportResult: "BLOCKED",
          httpStatus: status,
          finalUrl: url.toString(),
          redirectChain,
          contentType,
          detail: "SOURCE_BLOCKED:redirect_limit",
          retryAfterSeconds: null,
        };
      }

      const redirectTarget = new URL(location, url).toString();
      let nextUrl;
      try {
        nextUrl = await assertSafeOfficialUrl(redirectTarget);
      } catch (error) {
        const classified = classifyOfficialTransportSafetyFailure(
          redirectTarget,
          error,
        );
        if (classified.transportResult === "TRANSIENT") {
          return {
            ...classified,
            httpStatus: status,
            redirectChain,
          };
        }
        return {
          transportResult: "BLOCKED",
          httpStatus: status,
          finalUrl: url.toString(),
          redirectChain,
          contentType,
          detail: String(error?.message || error),
          retryAfterSeconds: null,
        };
      }

      redirectChain.push({
        status,
        from: url.toString(),
        to: nextUrl.toString(),
      });
      url = nextUrl;
      continue;
    }

    await cancelBody();

    if (status === 404 || status === 410) {
      return {
        transportResult: "MISSING",
        httpStatus: status,
        finalUrl: url.toString(),
        redirectChain,
        contentType,
        detail: `SOURCE_MISSING:http_${status}`,
        retryAfterSeconds: null,
      };
    }

    if (TRANSPORT_TRANSIENT_HTTP.has(status) || status >= 500) {
      return {
        transportResult: "TRANSIENT",
        httpStatus: status,
        finalUrl: url.toString(),
        redirectChain,
        contentType,
        detail: `TRANSIENT_FAILURE:http_${status}`,
        retryAfterSeconds: status === 429 ? 900 : 300,
      };
    }

    if (response.ok) {
      return {
        transportResult: redirectChain.length ? "REDIRECTED" : "HEALTHY",
        httpStatus: status,
        finalUrl: url.toString(),
        redirectChain,
        contentType,
        detail: redirectChain.length ? "SOURCE_REDIRECTED" : "SOURCE_HEALTHY",
        retryAfterSeconds: null,
      };
    }

    return {
      transportResult: "BLOCKED",
      httpStatus: status,
      finalUrl: url.toString(),
      redirectChain,
      contentType,
      detail: `SOURCE_BLOCKED:http_${status}`,
      retryAfterSeconds: null,
    };
  }

  return {
    transportResult: "BLOCKED",
    httpStatus: null,
    finalUrl: url?.toString() || null,
    redirectChain,
    contentType: null,
    detail: "SOURCE_BLOCKED:redirect_limit",
    retryAfterSeconds: null,
  };
}
