const ANDROID_PACKAGE = "com.bejewely.mobile";
const SHA256_PATTERN = /^([A-F0-9]{2}:){31}[A-F0-9]{2}$/i;

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    }
  });
}

function getFingerprints() {
  return (process.env.MOBILE_ANDROID_APP_LINK_SHA256_CERT_FINGERPRINTS || "")
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);
}

export function GET() {
  const fingerprints = getFingerprints();

  if (!fingerprints.length || fingerprints.some((value) => !SHA256_PATTERN.test(value))) {
    return json({ error: "mobile_android_app_link_fingerprint_not_configured" }, 503);
  }

  return json([
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: ANDROID_PACKAGE,
        sha256_cert_fingerprints: fingerprints
      }
    }
  ]);
}
