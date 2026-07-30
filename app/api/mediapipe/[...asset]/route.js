const CACHE_CONTROL = "public, max-age=31536000, s-maxage=31536000, immutable";
const MAX_ASSET_BYTES = 40 * 1024 * 1024;

const ASSET_MAP = Object.freeze({
  "face_landmarker.task": Object.freeze({
    contentType: "application/octet-stream",
    expectedBytes: 3758596,
    kind: "model",
    url: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
  }),
  "vision_bundle.mjs": Object.freeze({
    contentType: "text/javascript; charset=utf-8",
    expectedBytes: 136993,
    kind: "javascript",
    url: "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/vision_bundle.mjs"
  }),
  "wasm/vision_wasm_internal.js": Object.freeze({
    contentType: "text/javascript; charset=utf-8",
    expectedBytes: 322044,
    kind: "javascript",
    url: "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm/vision_wasm_internal.js"
  }),
  "wasm/vision_wasm_internal.wasm": Object.freeze({
    contentType: "application/wasm",
    expectedBytes: 11153617,
    kind: "wasm",
    url: "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm/vision_wasm_internal.wasm"
  }),
  "wasm/vision_wasm_nosimd_internal.js": Object.freeze({
    contentType: "text/javascript; charset=utf-8",
    expectedBytes: 321847,
    kind: "javascript",
    url: "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm/vision_wasm_nosimd_internal.js"
  }),
  "wasm/vision_wasm_nosimd_internal.wasm": Object.freeze({
    contentType: "application/wasm",
    expectedBytes: 10481398,
    kind: "wasm",
    url: "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm/vision_wasm_nosimd_internal.wasm"
  })
});

function createHeaders(asset, upstream, byteLength) {
  const headers = new Headers({
    "Cache-Control": CACHE_CONTROL,
    "Content-Length": String(byteLength),
    "Content-Type": asset.contentType,
    "Cross-Origin-Resource-Policy": "same-origin",
    "X-Bejewely-MediaPipe-Asset-Bytes": String(byteLength),
    "X-Content-Type-Options": "nosniff"
  });
  const etag = upstream.headers.get("etag");

  if (etag) {
    headers.set("ETag", etag);
  }

  return headers;
}

function isValidAssetBody(asset, bytes, upstreamContentType) {
  if (
    bytes.byteLength !== asset.expectedBytes ||
    bytes.byteLength === 0 ||
    bytes.byteLength > MAX_ASSET_BYTES ||
    upstreamContentType.toLowerCase().includes("text/html")
  ) {
    return false;
  }

  if (asset.kind === "wasm") {
    return (
      bytes[0] === 0x00 &&
      bytes[1] === 0x61 &&
      bytes[2] === 0x73 &&
      bytes[3] === 0x6d
    );
  }

  if (asset.kind === "javascript" || asset.kind === "model") {
    const prefix = new TextDecoder().decode(bytes.subarray(0, Math.min(bytes.byteLength, 64)));
    return !/^\s*(?:<!doctype\s+html|<html)\b/i.test(prefix);
  }

  return false;
}

export async function GET(_request, context) {
  const params = await context.params;
  const assetPath = Array.isArray(params?.asset) ? params.asset.join("/") : "";
  const asset = ASSET_MAP[assetPath];

  if (!asset) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  try {
    const upstream = await fetch(asset.url, {
      cache: "force-cache",
      next: { revalidate: 31536000 }
    });

    if (!upstream.ok || !upstream.body) {
      return Response.json({ error: "asset_unavailable" }, { status: 502 });
    }

    const body = await upstream.arrayBuffer();
    const bytes = new Uint8Array(body);
    const upstreamContentType = upstream.headers.get("content-type") || "";

    if (!isValidAssetBody(asset, bytes, upstreamContentType)) {
      return Response.json({ error: "asset_integrity_failed" }, { status: 502 });
    }

    return new Response(body, {
      headers: createHeaders(asset, upstream, bytes.byteLength),
      status: 200
    });
  } catch {
    return Response.json({ error: "asset_unavailable" }, { status: 502 });
  }
}
