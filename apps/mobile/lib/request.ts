export const MOBILE_READ_TIMEOUT_MS = 20_000;
// Cancelling transport does not cancel server-side analysis or undo writes.
export const MOBILE_ANALYZE_TIMEOUT_MS = 180_000;

export class NativeTransportError extends Error {
  constructor(readonly code: "mobile_request_timeout" | "mobile_request_cancelled") {
    super(code);
    this.name = "NativeTransportError";
  }
}

/** Bound both headers and body download, including fetch implementations ignoring abort. */
export async function fetchWithTimeout(
  input: string,
  init: RequestInit = {},
  timeoutMs = MOBILE_READ_TIMEOUT_MS,
  onTransportSettled?: () => void
): Promise<Response> {
  const controller = new AbortController();
  const parent = init.signal;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let cancel: (() => void) | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    cancel = () => {
      reject(new NativeTransportError("mobile_request_cancelled"));
      controller.abort();
    };
    if (parent?.aborted) { cancel(); return; }
    parent?.addEventListener("abort", cancel, { once: true });
    timer = setTimeout(() => {
      reject(new NativeTransportError("mobile_request_timeout"));
      controller.abort();
    }, timeoutMs);
  });
  try {
    if (parent?.aborted) { onTransportSettled?.(); return await deadline; }
    return await Promise.race([
      (async () => {
        try {
          const response = await fetch(input, { ...init, signal: controller.signal });
          // Native JSON clients must not stay pending after receiving only headers.
          await response.clone().text();
          return response;
        } finally { onTransportSettled?.(); }
      })(),
      deadline
    ]);
  } finally {
    clearTimeout(timer);
    if (cancel) parent?.removeEventListener("abort", cancel);
  }
}
