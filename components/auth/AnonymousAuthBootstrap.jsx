"use client";

import { useEffect } from "react";
import { ensureBrowserSupabaseSession } from "@/lib/supabase/browser-client";
import { writeSafeLog } from "@/lib/security/error-redaction";

let anonymousBootstrapPromise = null;

export default function AnonymousAuthBootstrap() {
  useEffect(() => {
    if (!anonymousBootstrapPromise) {
      anonymousBootstrapPromise = ensureBrowserSupabaseSession()
        .catch(() => {
          writeSafeLog("warn", {
            event: "client_operation_failed",
            category: "session_unavailable",
            operation: "client",
            dependency: "supabase",
            retryable: true
          });
        })
        .finally(() => {
          anonymousBootstrapPromise = null;
        });
    }
  }, []);

  return null;
}
