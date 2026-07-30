import assert from "node:assert/strict";
import test from "node:test";
import { GET } from "../../app/api/mediapipe/[...asset]/route.js";

const originalFetch = globalThis.fetch;
const LOADER_BYTES = 322_044;

function createJavaScriptBody(byteLength = LOADER_BYTES, prefix = "var createVisionWasm = ") {
  const body = new Uint8Array(byteLength);
  body.fill(0x20);
  body.set(new TextEncoder().encode(prefix));
  return body;
}

async function requestLoader() {
  return GET(new Request("http://localhost/api/mediapipe/wasm/vision_wasm_internal.js"), {
    params: Promise.resolve({
      asset: ["wasm", "vision_wasm_internal.js"]
    })
  });
}

test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("recomputes Content-Length from the decoded upstream body", async () => {
  globalThis.fetch = async () =>
    new Response(createJavaScriptBody(), {
      headers: {
        "content-length": "78444",
        "content-type": "text/javascript; charset=utf-8"
      },
      status: 200
    });

  const response = await requestLoader();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-length"), String(LOADER_BYTES));
  assert.equal(
    response.headers.get("x-bejewely-mediapipe-asset-bytes"),
    String(LOADER_BYTES)
  );
  assert.equal((await response.arrayBuffer()).byteLength, LOADER_BYTES);
});

test("rejects a truncated loader even when upstream returns HTTP 200", async () => {
  globalThis.fetch = async () =>
    new Response(createJavaScriptBody(78_444), {
      headers: {
        "content-length": "78444",
        "content-type": "text/javascript; charset=utf-8"
      },
      status: 200
    });

  const response = await requestLoader();
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), {
    error: "asset_integrity_failed"
  });
});

test("rejects an HTML error document returned as HTTP 200", async () => {
  globalThis.fetch = async () =>
    new Response(createJavaScriptBody(LOADER_BYTES, "<!doctype html><html>"), {
      headers: {
        "content-length": String(LOADER_BYTES),
        "content-type": "text/html; charset=utf-8"
      },
      status: 200
    });

  const response = await requestLoader();
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), {
    error: "asset_integrity_failed"
  });
});
