"use client";

import { useEffect } from "react";
import ErrorState from "@/components/common/ErrorState";
import { writeSafeLog } from "@/lib/security/error-redaction";

export default function Error({ error }) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" && error) {
      writeSafeLog("error", {
        event: "client_operation_failed",
        category: "internal_error",
        operation: "client",
        dependency: "application",
        retryable: false
      });
    }
  }, [error]);

  return (
    <ErrorState
      variant="analysis_failed"
      primaryActionHref="/"
      secondaryActionHref="/"
    />
  );
}
