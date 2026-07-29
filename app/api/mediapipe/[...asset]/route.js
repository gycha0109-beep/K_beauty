const CACHE_CONTROL = "public, max-age=31536000, s-maxage=31536000, immutable";
const MAX_ASSET_BYTES = 40 * 1024 * 1024;

const ASSET_MAP = Object.freeze({
  "face_landmarker.task": Object.freeze({
    contentType: "application/octet-stream",
    url: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
  }),
  "vision_bundle.mjs": Object.freeze({
    contentType: "text/javascript; charset=utf-8",
    url: "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/vision_bundle.mjs"
  }),
  "wasm/vision_wasm_internal.js": Object.freeze({
    contentType: "text/javascript; charset=utf-8",
    url: "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm/vision_wasm_internal.js"
  }),
  "wasm/vision_wasm_internal.wasm": Object.freeze({
    contentType: "application/wasm",
    url: "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm/vision_wasm_internal.wasm"
  }),
  "wasm/vision_wasm_nosimd_internal.js": Object.freeze({
    contentType: "text/javascript; charset=utf-8",
    url: "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm/vision_wasm_nosimd_internal.js"
  }),
  "wasm/vision_wasm_nosimd_internal.wasm": Object.freeze({
    contentType: "application/wasm",
    url: "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm/vision_wasm_nosimd_internal.wasm"
  })
});

function createHeaders(asset, upstream) {
  const headers = new Headers({
    "Cache-Control": CACHE_CONTROL,
    "Content-Type": asset.contentType,
    "Cross-Origin-Resource-Policy": "same-origin",
    "X-Content-Type-Options": "nosniff"
  });
  const contentLength = upstream.headers.get("content-length");
  const etag = upstream.headers.get("etag");

  if (contentLength) {
    headers.set("Content-Length", contentLength);
  }
  if (etag) {
    headers.set("ETag", etag);
  }

  return headers;
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

    const contentLength = Number(upstream.headers.get("content-length") || 0);
    if (contentLength > MAX_ASSET_BYTES) {
      await upstream.body.cancel();
      return Response.json({ error: "asset_too_large" }, { status: 502 });
    }

    return new Response(upstream.body, {
      headers: createHeaders(asset, upstream),
      status: 200
    });
  } catch {
    return Response.json({ error: "asset_unavailable" }, { status: 502 });
  }
}
