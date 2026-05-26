"use client";

import { useEffect } from "react";
import ErrorState from "@/components/common/ErrorState";

export default function Error({ error }) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" && error) {
      console.error("[app/error]", error);
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
