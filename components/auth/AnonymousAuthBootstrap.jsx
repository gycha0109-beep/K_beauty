"use client";

import { useEffect } from "react";
import { ensureBrowserSupabaseSession } from "@/lib/supabase/browser-client";

let anonymousBootstrapPromise = null;

export default function AnonymousAuthBootstrap() {
  useEffect(() => {
    if (!anonymousBootstrapPromise) {
      anonymousBootstrapPromise = ensureBrowserSupabaseSession()
        .catch((error) => {
          console.error("[auth/bootstrap] unexpected failure", error);
        })
        .finally(() => {
          anonymousBootstrapPromise = null;
        });
    }
  }, []);

  return null;
}
